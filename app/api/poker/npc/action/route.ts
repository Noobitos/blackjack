import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  parseGameState, serializeGameState, parseHand, serializeHand,
  applyAction, isRoundDone, advancePhase, resolveShowdown, onlyOneLeft,
  npcDecide, type PlayerState, type PokerGameState,
} from "@/lib/poker";
import { POKER_TABLE_CONFIGS } from "@/lib/pokerTables";

const PHASES = ["PREFLOP", "FLOP", "TURN", "RIVER", "SHOWDOWN"] as const;

function buildPlayerStates(dbPlayers: { id: string; seat: number; chips: { toString(): string } | number; status: string; hand: string | null; isAllIn: boolean; isNpc: boolean; userId: string | null }[]): PlayerState[] {
  return dbPlayers.map((p) => ({
    id: p.id,
    seat: p.seat,
    chips: Number(p.chips),
    hand: p.hand ? parseHand(p.hand) : null,
    status: p.status,
    isAllIn: p.isAllIn,
    isNpc: p.isNpc,
    userId: p.userId,
  }));
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

  // Validate action
  const toCall = gs.currentBet - (gs.roundBets[humanPlayer.seat] ?? 0);
  if (action === "CHECK" && toCall > 0) return NextResponse.json({ error: "Cannot check — must call or fold" }, { status: 400 });
  if (action === "CALL" && toCall === 0) return NextResponse.json({ error: "Nothing to call — use CHECK" }, { status: 400 });

  // Apply player action
  const raiseAmt = action === "RAISE" ? Number(amount) : 0;
  const callAmt = action === "CALL" ? toCall : 0;
  ;({ gs, players } = applyAction(gs, players, humanPlayer.seat, action, raiseAmt || callAmt));

  // Game loop: advance phases and process NPC turns
  let handResult: { winners: Record<number, number>; handLabels: Record<number, string>; showdown: boolean } | null = null;
  let iterations = 0;

  while (iterations < 20) {
    iterations++;
    const lone = onlyOneLeft(players);
    if (lone) {
      // Everyone else folded → lone player wins
      handResult = { winners: { [lone.seat]: gs.pot }, handLabels: {}, showdown: false };
      phase = "SHOWDOWN";
      break;
    }

    if (isRoundDone(gs, players)) {
      if (phase === "RIVER") {
        // Showdown
        const result = resolveShowdown(gs, players);
        handResult = { ...result, showdown: true };
        phase = "SHOWDOWN";
        break;
      }
      // Advance to next phase
      const next = advancePhase(gs, phase, players, pokerSession.dealerSeat);
      gs = next.gs;
      phase = next.phase;
      if (phase === "SHOWDOWN") {
        const result = resolveShowdown(gs, players);
        handResult = { ...result, showdown: true };
        break;
      }
    }

    // Check if it's NPC's turn
    const npcPlayer = players.find((p) => p.isNpc);
    if (!npcPlayer || gs.activeSeat !== npcPlayer.seat) break;
    if (npcPlayer.status === "FOLDED" || npcPlayer.isAllIn) break;

    // NPC decides and acts
    const npcHand = npcPlayer.hand ?? [];
    const npcToCall = gs.currentBet - (gs.roundBets[npcPlayer.seat] ?? 0);
    const decision = npcDecide(npcHand, gs.communityCards, gs.pot, npcToCall, npcPlayer.chips, tableCfg.bigBlind);

    const npcAmount = decision.action === "RAISE" ? decision.amount : decision.action === "CALL" ? npcToCall : 0;
    ;({ gs, players } = applyAction(gs, players, npcPlayer.seat, decision.action, npcAmount));
  }

  // ─── Persist state ──────────────────────────────────────────────────────────
  if (handResult) {
    for (const p of players) p.chips += handResult.winners[p.seat] ?? 0;

    const humanWon = handResult.winners[humanPlayer.seat] ?? 0;
    const npcPlayerFinal = players.find((p) => p.isNpc)!;

    const newNpcBudget = Number((await prisma.pokerNpc.findUnique({ where: { tableId: pokerSession.tableId } }))?.budget ?? 0)
      - Number(pokerSession.players.find((p) => p.isNpc)!.chips) + npcPlayerFinal.chips;
    const npcIsActive = newNpcBudget >= tableCfg.minBuyIn;

    await prisma.$transaction([
      prisma.pokerSession.update({ where: { id: sessionId }, data: { status: "BETWEEN_HANDS", phase: "SHOWDOWN", gameState: serializeGameState(gs) } }),
      prisma.pokerNpc.update({ where: { tableId: pokerSession.tableId }, data: { budget: newNpcBudget, isActive: npcIsActive } }),
      ...players.map((p) => prisma.pokerPlayer.update({ where: { id: p.id }, data: { chips: p.chips, status: p.status, isAllIn: p.isAllIn } })),
      ...(humanWon > 0 ? [prisma.transaction.create({ data: { userId: session.user.id, type: "POKER_WIN", amount: humanWon, note: `Poker NPC hand won` } })] : []),
    ]);
  } else {
    const notFolded = players.filter((p) => p.status !== "FOLDED" && !p.isAllIn);
    const nextSeat = notFolded.find((p) => p.seat > gs.activeSeat)?.seat ?? notFolded[0]?.seat ?? gs.activeSeat;
    gs.activeSeat = nextSeat;

    await prisma.$transaction([
      prisma.pokerSession.update({ where: { id: sessionId }, data: { phase, gameState: serializeGameState(gs) } }),
      ...players.map((p) => prisma.pokerPlayer.update({ where: { id: p.id }, data: { chips: p.chips, status: p.status, isAllIn: p.isAllIn } })),
    ]);
  }

  // ─── Build response ─────────────────────────────────────────────────────────
  const npcPlayerFinal2 = players.find((p) => p.isNpc)!;
  const humanFinal = players.find((p) => p.userId === session.user.id)!;
  const npcPlayer = npcPlayerFinal2;

  return NextResponse.json({
    phase,
    pot: gs.pot,
    communityCards: gs.communityCards,
    yourChips: humanFinal.chips,
    npcChips: npcPlayer.chips,
    currentBet: gs.currentBet,
    yourRoundBet: gs.roundBets[humanFinal.seat] ?? 0,
    activeSeat: gs.activeSeat,
    isYourTurn: gs.activeSeat === humanFinal.seat && !handResult,
    handResult: handResult
      ? {
          winners: handResult.winners,
          handLabels: handResult.handLabels,
          showdown: handResult.showdown,
          npcHand: npcPlayer.hand,
          yourHand: humanFinal.hand,
        }
      : null,
    yourHand: humanFinal.hand,
    status: handResult ? "BETWEEN_HANDS" : "ACTIVE",
  });
}
