import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { drawCard, isBust, deserializeHand, serializeHand } from "@/lib/blackjack";

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { sessionId } = await req.json();
  const gs = await prisma.gameSession.findUnique({
    where: { id: sessionId },
    include: { table: true },
  });

  if (!gs || gs.userId !== session.user.id) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }
  if (gs.status !== "IN_PROGRESS") {
    return NextResponse.json({ error: "Game already completed" }, { status: 400 });
  }

  let deck = deserializeHand(gs.deck);
  const playerHand = deserializeHand(gs.playerHand);
  const dealerHand = deserializeHand(gs.dealerHand);
  const bet = Number(gs.betAmount);

  const { card, remaining } = drawCard(deck);
  deck = remaining;
  playerHand.push(card);

  if (isBust(playerHand)) {
    const tableBalance = Number(gs.table.balance) + bet;
    const minBet = Number(gs.table.minBet);

    await prisma.$transaction([
      prisma.gameSession.update({
        where: { id: gs.id },
        data: { playerHand: serializeHand(playerHand), deck: serializeHand(deck), status: "COMPLETED", outcome: "LOSS" },
      }),
      prisma.table.update({
        where: { id: gs.tableId },
        data: { balance: tableBalance, isOpen: tableBalance >= minBet * 1.5 },
      }),
      prisma.transaction.create({
        data: { userId: gs.userId, type: "BET_PLACED", amount: bet, note: `Table ${gs.tableId} — BUST` },
      }),
    ]);

    const user = await prisma.user.findUnique({ where: { id: session.user.id } });
    return NextResponse.json({ playerHand, dealerHand, status: "COMPLETED", outcome: "LOSS", payout: 0, pocket: Number(user!.pocket) });
  }

  await prisma.gameSession.update({
    where: { id: gs.id },
    data: { playerHand: serializeHand(playerHand), deck: serializeHand(deck) },
  });

  return NextResponse.json({ playerHand, dealerHand: [dealerHand[0], null], status: "IN_PROGRESS" });
}
