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
  if (ps.status !== "BETWEEN_HANDS") return NextResponse.json({ error: "Not between hands" }, { status: 400 });
  if (!ps.players.find((p) => p.userId === session.user.id)) return NextResponse.json({ error: "Not in session" }, { status: 403 });

  const tableCfg = POKER_TABLE_CONFIGS.find((t) => t.id === ps.tableId)!;

  // Remove busted players (chips <= 0)
  const active = ps.players.filter((p) => Number(p.chips) > 0);
  if (active.length < 2) {
    await prisma.pokerSession.update({ where: { id: sessionId }, data: { status: "COMPLETED" } });
    return NextResponse.json({ error: "Not enough players to continue", status: "COMPLETED" }, { status: 400 });
  }

  // Move dealer button
  const seats = active.map((p) => p.seat).sort((a, b) => a - b);
  const prevDealerIdx = seats.indexOf(ps.dealerSeat);
  const newDealerSeat = seats[(prevDealerIdx + 1) % seats.length];
  const handNumber = ps.handNumber + 1;

  const playerList = active.map((p) => ({ seat: p.seat, chips: Number(p.chips) }));
  const { gameState, dealtHands } = initHand(playerList, newDealerSeat, tableCfg.smallBlind, tableCfg.bigBlind);

  await prisma.$transaction([
    prisma.pokerSession.update({
      where: { id: sessionId },
      data: { status: "ACTIVE", phase: "PREFLOP", dealerSeat: newDealerSeat, handNumber, gameState: serializeGameState(gameState) },
    }),
    ...active.map((p) => {
      const blind = gameState.roundBets[String(p.seat)] ?? 0;
      return prisma.pokerPlayer.update({
        where: { id: p.id },
        data: { hand: serializeHand(dealtHands[p.seat] ?? []), chips: Number(p.chips) - blind, status: "ACTIVE", isAllIn: false },
      });
    }),
    // Sitting-out busted players
    ...ps.players.filter((p) => Number(p.chips) <= 0).map((p) =>
      prisma.pokerPlayer.update({ where: { id: p.id }, data: { status: "SITTING_OUT" } })
    ),
  ]);

  return NextResponse.json({ phase: "PREFLOP", handNumber, dealerSeat: newDealerSeat, activeSeat: gameState.activeSeat, pot: gameState.pot, currentBet: gameState.currentBet });
}
