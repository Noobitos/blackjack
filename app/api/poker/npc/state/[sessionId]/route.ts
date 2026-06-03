import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  parseGameState, serializeGameState, parseHand,
  applyAction, isRoundDone, advancePhase, resolveShowdown, onlyOneLeft,
  npcDecide, type PlayerState,
} from "@/lib/poker";
import { POKER_TABLE_CONFIGS } from "@/lib/pokerTables";

function buildStates(dbPlayers: {
  id: string; seat: number; chips: { toString(): string } | number;
  status: string; hand: string | null; isAllIn: boolean; isNpc: boolean; userId: string | null;
}[]): PlayerState[] {
  return dbPlayers.map((p) => ({
    id: p.id, seat: p.seat, chips: Number(p.chips),
    hand: p.hand ? parseHand(p.hand) : null,
    status: p.status, isAllIn: p.isAllIn, isNpc: p.isNpc, userId: p.userId,
  }));
}

function advanceSeat(gs: ReturnType<typeof parseGameState>, players: PlayerState[], fromSeat: number) {
  const eligible = players.filter((p) => p.status === "ACTIVE" && !p.isAllIn).sort((a, b) => a.seat - b.seat);
  if (eligible.length === 0) return;
  const next = eligible.find((p) => p.seat > fromSeat) ?? eligible[0];
  gs.activeSeat = next.seat;
}

export async function GET(_req: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { sessionId } = await params;
  const ps = await prisma.pokerSession.findUnique({
    where: { id: sessionId },
    include: { players: true, table: { include: { npc: true } } },
  });

  if (!ps) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const humanPlayer = ps.players.find((p) => p.userId === session.user.id);
  if (!humanPlayer) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let gs = ps.gameState ? parseGameState(ps.gameState) : null;
  let players = buildStates(ps.players);
  let phase = ps.phase;
  let status = ps.status;
  let changed = false;

  // If the game is active and it's the NPC's turn, auto-resolve NPC actions
  if (gs && phase && status === "ACTIVE") {
    const tableCfg = POKER_TABLE_CONFIGS.find((t) => t.id === ps.tableId)!;
    const npcPlayer = players.find((p) => p.isNpc)!;

    for (let i = 0; i < 20; i++) {
      const lone = onlyOneLeft(players);
      if (lone) {
        // Resolve hand
        const winners = { [lone.seat]: gs.pot };
        for (const p of players) p.chips += winners[p.seat] ?? 0;
        const npcFinal = players.find((p) => p.isNpc)!;
        const humanWon = winners[humanPlayer.seat] ?? 0;
        const origNpcChips = Number(ps.players.find((p) => p.isNpc)!.chips);
        const newBudget = Number(ps.table.npc?.budget ?? 0) - origNpcChips + npcFinal.chips;
        await prisma.$transaction([
          prisma.pokerSession.update({ where: { id: sessionId }, data: { status: "BETWEEN_HANDS", phase: "SHOWDOWN", gameState: serializeGameState(gs) } }),
          prisma.pokerNpc.update({ where: { tableId: ps.tableId }, data: { budget: newBudget, isActive: newBudget >= tableCfg.minBuyIn } }),
          ...players.map((p) => prisma.pokerPlayer.update({ where: { id: p.id }, data: { chips: p.chips, status: p.status, isAllIn: p.isAllIn } })),
          ...(humanWon > 0 ? [prisma.transaction.create({ data: { userId: session.user.id, type: "POKER_WIN", amount: humanWon, note: "Poker NPC hand won" } })] : []),
        ]);
        status = "BETWEEN_HANDS";
        changed = true;
        break;
      }

      if (isRoundDone(gs, players)) {
        if (phase === "RIVER") {
          const result = resolveShowdown(gs, players);
          for (const p of players) p.chips += result.winners[p.seat] ?? 0;
          const npcFinal = players.find((p) => p.isNpc)!;
          const humanWon = result.winners[humanPlayer.seat] ?? 0;
          const origNpcChips = Number(ps.players.find((p) => p.isNpc)!.chips);
          const newBudget = Number(ps.table.npc?.budget ?? 0) - origNpcChips + npcFinal.chips;
          await prisma.$transaction([
            prisma.pokerSession.update({ where: { id: sessionId }, data: { status: "BETWEEN_HANDS", phase: "SHOWDOWN", gameState: serializeGameState(gs) } }),
            prisma.pokerNpc.update({ where: { tableId: ps.tableId }, data: { budget: newBudget, isActive: newBudget >= tableCfg.minBuyIn } }),
            ...players.map((p) => prisma.pokerPlayer.update({ where: { id: p.id }, data: { chips: p.chips, status: p.status, isAllIn: p.isAllIn } })),
            ...(humanWon > 0 ? [prisma.transaction.create({ data: { userId: session.user.id, type: "POKER_WIN", amount: humanWon, note: "Poker NPC hand won" } })] : []),
          ]);
          status = "BETWEEN_HANDS";
          phase = "SHOWDOWN";
          changed = true;
          break;
        }
        const next = advancePhase(gs, phase, players, ps.dealerSeat);
        gs = next.gs; phase = next.phase; changed = true;
        continue;
      }

      if (gs.activeSeat === humanPlayer.seat) break;

      // NPC's turn — auto-act
      if (npcPlayer.status === "FOLDED" || npcPlayer.isAllIn) break;
      const npcToCall = gs.currentBet - (gs.roundBets[npcPlayer.seat] ?? 0);
      const decision = npcDecide(npcPlayer.hand ?? [], gs.communityCards, gs.pot, npcToCall, npcPlayer.chips, tableCfg.bigBlind);
      const npcAmount = decision.action === "RAISE" ? decision.amount : decision.action === "CALL" ? npcToCall : 0;
      ;({ gs, players } = applyAction(gs, players, npcPlayer.seat, decision.action, npcAmount));
      advanceSeat(gs, players, npcPlayer.seat);
      changed = true;
    }

    if (changed && status === "ACTIVE") {
      await prisma.$transaction([
        prisma.pokerSession.update({ where: { id: sessionId }, data: { phase, gameState: serializeGameState(gs) } }),
        ...players.map((p) => prisma.pokerPlayer.update({ where: { id: p.id }, data: { chips: p.chips, status: p.status, isAllIn: p.isAllIn } })),
      ]);
    }
  }

  const npcPlayer = players.find((p) => p.isNpc);
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { pocket: true } });
  const humanFinal = players.find((p) => p.userId === session.user.id)!;

  return NextResponse.json({
    sessionId: ps.id,
    status,
    phase,
    handNumber: ps.handNumber,
    dealerSeat: ps.dealerSeat,
    pot: gs?.pot ?? 0,
    communityCards: gs?.communityCards ?? [],
    currentBet: gs?.currentBet ?? 0,
    activeSeat: gs?.activeSeat ?? 0,
    yourChips: Number(humanFinal.chips),
    npcChips: Number(npcPlayer?.chips ?? 0),
    yourHand: humanFinal.hand ? humanFinal.hand : null,
    yourRoundBet: gs?.roundBets?.[humanFinal.seat] ?? 0,
    isYourTurn: gs?.activeSeat === humanFinal.seat && status === "ACTIVE",
    npcBudget: Number(ps.table.npc?.budget ?? 0),
    npcIsActive: ps.table.npc?.isActive ?? false,
    pocket: Number(user?.pocket ?? 0),
  });
}
