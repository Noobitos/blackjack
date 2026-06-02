import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  parseGameState, serializeGameState, parseHand, serializeHand,
  applyAction, isRoundDone, advancePhase, resolveShowdown, onlyOneLeft,
  type PlayerState,
} from "@/lib/poker";

interface DbPlayer {
  id: string;
  seat: number;
  chips: number | { toString(): string };
  hand: string | null;
  status: string;
  isAllIn: boolean;
  isNpc: boolean;
  userId: string | null;
}

function buildStates(dbPlayers: DbPlayer[]): PlayerState[] {
  return dbPlayers.map((p) => ({
    id: p.id,
    seat: p.seat,
    chips: Number(p.chips),
    hand: p.hand ? parseHand(p.hand) : null,
    status: p.status,
    isAllIn: p.isAllIn,
    isNpc: false,
    userId: p.userId,
  }));
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { sessionId, action, amount } = await req.json();
  const ps = await prisma.pokerSession.findUnique({ where: { id: sessionId }, include: { players: true } });

  if (!ps || ps.status !== "ACTIVE" || !ps.gameState || !ps.phase) return NextResponse.json({ error: "No active hand" }, { status: 400 });

  let gs = parseGameState(ps.gameState);
  let players = buildStates(ps.players as DbPlayer[]);
  let phase = ps.phase;

  const humanPlayer = players.find((p) => p.userId === session.user.id);
  if (!humanPlayer) return NextResponse.json({ error: "Not in this session" }, { status: 403 });
  if (gs.activeSeat !== humanPlayer.seat) return NextResponse.json({ error: "Not your turn" }, { status: 400 });

  const toCall = gs.currentBet - (gs.roundBets[humanPlayer.seat] ?? 0);
  if (action === "CHECK" && toCall > 0) return NextResponse.json({ error: "Cannot check" }, { status: 400 });

  const raiseAmt = action === "RAISE" ? Number(amount) : 0;
  const callAmt = action === "CALL" ? toCall : 0;
  ;({ gs, players } = applyAction(gs, players, humanPlayer.seat, action, raiseAmt || callAmt));

  let handResult: { winners: Record<number, number>; handLabels: Record<number, string>; showdown: boolean } | null = null;

  const lone = onlyOneLeft(players);
  if (lone) {
    handResult = { winners: { [lone.seat]: gs.pot }, handLabels: {}, showdown: false };
    phase = "SHOWDOWN";
  } else if (isRoundDone(gs, players)) {
    if (phase === "RIVER") {
      const result = resolveShowdown(gs, players);
      handResult = { ...result, showdown: true };
      phase = "SHOWDOWN";
    } else {
      const next = advancePhase(gs, phase, players, ps.dealerSeat);
      gs = next.gs;
      phase = next.phase;
      if (phase === "SHOWDOWN") {
        const result = resolveShowdown(gs, players);
        handResult = { ...result, showdown: true };
      }
    }
  } else {
    const active = players.filter((p) => p.status === "ACTIVE" && !p.isAllIn).sort((a, b) => a.seat - b.seat);
    const next = active.find((p) => p.seat > gs.activeSeat) ?? active[0];
    if (next) gs.activeSeat = next.seat;
  }

  if (handResult) {
    for (const p of players) p.chips += handResult.winners[p.seat] ?? 0;

    await prisma.$transaction([
      prisma.pokerSession.update({ where: { id: sessionId }, data: { status: "BETWEEN_HANDS", phase: "SHOWDOWN", gameState: serializeGameState(gs) } }),
      ...players.map((p) => prisma.pokerPlayer.update({ where: { id: p.id }, data: { chips: p.chips, status: p.status, isAllIn: p.isAllIn } })),
      ...players.filter((p) => (handResult!.winners[p.seat] ?? 0) > 0 && p.userId).map((p) =>
        prisma.transaction.create({ data: { userId: p.userId!, type: "POKER_WIN", amount: handResult!.winners[p.seat], note: `Multiplayer Poker hand won` } })
      ),
    ]);
  } else {
    await prisma.$transaction([
      prisma.pokerSession.update({ where: { id: sessionId }, data: { phase, gameState: serializeGameState(gs) } }),
      ...players.map((p) => prisma.pokerPlayer.update({ where: { id: p.id }, data: { chips: p.chips, status: p.status, isAllIn: p.isAllIn } })),
    ]);
  }

  return NextResponse.json({
    phase, pot: gs.pot, communityCards: gs.communityCards, currentBet: gs.currentBet,
    activeSeat: gs.activeSeat, isYourTurn: !handResult && gs.activeSeat === humanPlayer.seat,
    yourHand: humanPlayer.hand, yourRoundBet: gs.roundBets[humanPlayer.seat] ?? 0,
    handResult: handResult
      ? {
          ...handResult,
          allHands: handResult.showdown
            ? players.filter((p) => p.status !== "FOLDED").map((p) => ({ seat: p.seat, hand: p.hand }))
            : null,
        }
      : null,
    status: handResult ? "BETWEEN_HANDS" : "ACTIVE",
    players: players.map((p) => ({ seat: p.seat, chips: p.chips, status: p.status, userId: p.userId })),
  });
}
