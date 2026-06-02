import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { initHand, serializeGameState, serializeHand } from "@/lib/poker";
import { POKER_TABLE_CONFIGS } from "@/lib/pokerTables";

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { sessionId } = await req.json();
  const ps = await prisma.pokerSession.findUnique({ where: { id: sessionId }, include: { players: true } });

  if (!ps) return NextResponse.json({ error: "Session not found" }, { status: 404 });
  if (ps.status !== "WAITING") return NextResponse.json({ error: "Game already started" }, { status: 400 });
  if (!ps.players.find((p) => p.userId === session.user.id)) return NextResponse.json({ error: "Not in session" }, { status: 403 });
  if (ps.players.length < 2) return NextResponse.json({ error: "Need at least 2 players" }, { status: 400 });

  const tableCfg = POKER_TABLE_CONFIGS.find((t) => t.id === ps.tableId)!;
  const playerList = ps.players.map((p) => ({ seat: p.seat, chips: Number(p.chips) }));
  const dealerSeat = playerList[0].seat;
  const { gameState, dealtHands } = initHand(playerList, dealerSeat, tableCfg.smallBlind, tableCfg.bigBlind);

  const updates = ps.players.map((p) => {
    const blind = gameState.roundBets[String(p.seat)] ?? 0;
    return prisma.pokerPlayer.update({
      where: { id: p.id },
      data: { hand: serializeHand(dealtHands[p.seat] ?? []), chips: Number(p.chips) - blind, status: "ACTIVE" },
    });
  });

  await prisma.$transaction([
    prisma.pokerSession.update({
      where: { id: sessionId },
      data: { status: "ACTIVE", phase: "PREFLOP", handNumber: 1, dealerSeat, gameState: serializeGameState(gameState) },
    }),
    ...updates,
  ]);

  return NextResponse.json({ phase: "PREFLOP", activeSeat: gameState.activeSeat, pot: gameState.pot, currentBet: gameState.currentBet });
}
