import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  parseGameState, serializeGameState, parseHand,
  applyAction, isRoundDone, advancePhase, resolveShowdown, onlyOneLeft,
  npcDecide, type PlayerState,
} from "@/lib/poker";
import { POKER_TABLE_CONFIGS } from "@/lib/pokerTables";

function buildPlayerStates(dbPlayers: {
  id: string; seat: number; chips: { toString(): string } | number;
  status: string; hand: string | null; isAllIn: boolean; isNpc: boolean; userId: string | null;
}[]): PlayerState[] {
  return dbPlayers.map((p) => ({
    id: p.id, seat: p.seat, chips: Number(p.chips),
    hand: p.hand ? parseHand(p.hand) : null,
    status: p.status, isAllIn: p.isAllIn, isNpc: p.isNpc, userId: p.userId,
  }));
}

// After any action, advance activeSeat to the next eligible player
function advanceSeat(gs: ReturnType<typeof parseGameState>, players: PlayerState[], fromSeat: number) {
  const eligible = players
    .filter((p) => p.status === "ACTIVE" && !p.isAllIn)
    .sort((a, b) => a.seat - b.seat);
  if (eligible.length === 0) return;
  const next = eligible.find((p) => p.seat > fromSeat) ?? eligible[0];
  gs.activeSeat = next.seat;
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { sessionId, action, amount } = await req.json();
  if (!sessionId || !action) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const pokerSession = await prisma.pokerSession.findUnique({
    where: { id: sessionId },
    include: { players: true, table: true },
  });

  if (!pokerSession) return NextResponse.json({ error: "Session not found" }, { status: 404 });
  if (pokerSession.status !== "ACTIVE" || !pokerSession.phase || !pokerSession.gameState) {
    return NextResponse.json({ error: "No active hand" }, { status: 400 });
  }

  const tableCfg = POKER_TABLE_CONFIGS.find((t) => t.id === pokerSession.tableId)!;
  let gs = parseGameState(pokerSession.gameState);
  let players = buildPlayerStates(pokerSession.players);
  let phase = pokerSession.phase;

  const humanPlayer = players.find((p) => p.userId === session.user.id);
  if (!humanPlayer) return NextResponse.json({ error: "Not in this session" }, { status: 403 });
  if (gs.activeSeat !== humanPlayer.seat) return NextResponse.json({ error: "Not your turn" }, { status: 400 });

  const toCall = gs.currentBet - (gs.roundBets[humanPlayer.seat] ?? 0);
  if (action === "CHECK" && toCall > 0) return NextResponse.json({ error: "Cannot check — must call or fold" }, { status: 400 });
  if (action === "CALL" && toCall === 0) return NextResponse.json({ error: "Nothing to call — use CHECK" }, { status: 400 });

  // Apply player action and advance seat
  const raiseAmt = action === "RAISE" ? Number(amount) : 0;
  const callAmt = action === "CALL" ? toCall : 0;
  ;({ gs, players } = applyAction(gs, players, humanPlayer.seat, action, raiseAmt || callAmt));
  advanceSeat(gs, players, humanPlayer.seat);

  // Loop: process NPC turns and phase advances until it's the player's turn or hand ends
  let handResult: { winners: Record<number, number>; handLabels: Record<number, string>; showdown: boolean } | null = null;

  for (let i = 0; i < 20; i++) {
    // Check if only one player remains (everyone else folded)
    const lone = onlyOneLeft(players);
    if (lone) {
      handResult = { winners: { [lone.seat]: gs.pot }, handLabels: {}, showdown: false };
      phase = "SHOWDOWN";
      break;
    }

    // Check if betting round is done
    if (isRoundDone(gs, players)) {
      if (phase === "RIVER") {
        const result = resolveShowdown(gs, players);
        handResult = { ...result, showdown: true };
        phase = "SHOWDOWN";
        break;
      }
      const next = advancePhase(gs, phase, players, pokerSession.dealerSeat);
      gs = next.gs;
      phase = next.phase;
      if (phase === "SHOWDOWN") {
        const result = resolveShowdown(gs, players);
        handResult = { ...result, showdown: true };
        break;
      }
      // activeSeat was set by advancePhase — continue loop to check if NPC acts first
      continue;
    }

    // It's the player's turn — stop and let them act
    if (gs.activeSeat === humanPlayer.seat) break;

    // It must be NPC's turn — process automatically
    const npcPlayer = players.find((p) => p.isNpc);
    if (!npcPlayer || npcPlayer.status === "FOLDED" || npcPlayer.isAllIn) break;

    const npcToCall = gs.currentBet - (gs.roundBets[npcPlayer.seat] ?? 0);
    const decision = npcDecide(
      npcPlayer.hand ?? [], gs.communityCards, gs.pot,
      npcToCall, npcPlayer.chips, tableCfg.bigBlind
    );

    const npcAmount =
      decision.action === "RAISE" ? decision.amount :
      decision.action === "CALL"  ? npcToCall : 0;

    ;({ gs, players } = applyAction(gs, players, npcPlayer.seat, decision.action, npcAmount));
    advanceSeat(gs, players, npcPlayer.seat);
  }

  // Persist
  if (handResult) {
    for (const p of players) p.chips += handResult.winners[p.seat] ?? 0;

    const npcFinal = players.find((p) => p.isNpc)!;
    const humanWon = handResult.winners[humanPlayer.seat] ?? 0;

    const currentNpcBudget = Number(
      (await prisma.pokerNpc.findUnique({ where: { tableId: pokerSession.tableId } }))?.budget ?? 0
    );
    const originalNpcChips = Number(pokerSession.players.find((p) => p.isNpc)!.chips);
    const newNpcBudget = currentNpcBudget - originalNpcChips + npcFinal.chips;
    const npcIsActive = newNpcBudget >= tableCfg.minBuyIn;

    await prisma.$transaction([
      prisma.pokerSession.update({
        where: { id: sessionId },
        data: { status: "BETWEEN_HANDS", phase: "SHOWDOWN", gameState: serializeGameState(gs) },
      }),
      prisma.pokerNpc.update({
        where: { tableId: pokerSession.tableId },
        data: { budget: newNpcBudget, isActive: npcIsActive },
      }),
      ...players.map((p) =>
        prisma.pokerPlayer.update({ where: { id: p.id }, data: { chips: p.chips, status: p.status, isAllIn: p.isAllIn } })
      ),
      ...(humanWon > 0
        ? [prisma.transaction.create({ data: { userId: session.user.id, type: "POKER_WIN", amount: humanWon, note: `Poker NPC hand won` } })]
        : []
      ),
    ]);
  } else {
    await prisma.$transaction([
      prisma.pokerSession.update({ where: { id: sessionId }, data: { phase, gameState: serializeGameState(gs) } }),
      ...players.map((p) =>
        prisma.pokerPlayer.update({ where: { id: p.id }, data: { chips: p.chips, status: p.status, isAllIn: p.isAllIn } })
      ),
    ]);
  }

  const npcFinal = players.find((p) => p.isNpc)!;
  const humanFinal = players.find((p) => p.userId === session.user.id)!;

  return NextResponse.json({
    phase,
    pot: gs.pot,
    communityCards: gs.communityCards,
    yourChips: humanFinal.chips,
    npcChips: npcFinal.chips,
    currentBet: gs.currentBet,
    yourRoundBet: gs.roundBets[humanFinal.seat] ?? 0,
    activeSeat: gs.activeSeat,
    isYourTurn: gs.activeSeat === humanFinal.seat && !handResult,
    handResult: handResult
      ? {
          winners: handResult.winners,
          handLabels: handResult.handLabels,
          showdown: handResult.showdown,
          npcHand: npcFinal.hand ? JSON.stringify(npcFinal.hand) : null,
          yourHand: humanFinal.hand,
        }
      : null,
    yourHand: humanFinal.hand,
    status: handResult ? "BETWEEN_HANDS" : "ACTIVE",
  });
}
