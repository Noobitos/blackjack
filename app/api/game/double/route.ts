import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { drawCard, isBust, dealerShouldHit, resolveOutcome, calcPayout, deserializeHand, serializeHand } from "@/lib/blackjack";

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { sessionId } = await req.json();
  const gs = await prisma.gameSession.findUnique({
    where: { id: sessionId },
    include: { table: true, user: true },
  });

  if (!gs || gs.userId !== session.user.id) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }
  if (gs.status !== "IN_PROGRESS") {
    return NextResponse.json({ error: "Game already completed" }, { status: 400 });
  }

  const bet = Number(gs.betAmount);
  const pocket = Number(gs.user.pocket);
  if (pocket < bet) {
    return NextResponse.json({ error: "Insufficient balance to double down" }, { status: 400 });
  }

  let deck = deserializeHand(gs.deck);
  const playerHand = deserializeHand(gs.playerHand);
  const dealerHand = deserializeHand(gs.dealerHand);
  const totalBet = bet * 2;

  const { card, remaining } = drawCard(deck);
  deck = remaining;
  playerHand.push(card);

  const playerBust = isBust(playerHand);
  if (!playerBust) {
    while (dealerShouldHit(dealerHand)) {
      const { card: dc, remaining: dr } = drawCard(deck);
      deck = dr;
      dealerHand.push(dc);
    }
  }

  const outcome = playerBust ? "LOSS" : resolveOutcome(playerHand, dealerHand);
  const payout = calcPayout(outcome, totalBet);
  const newPocket = pocket - bet + (outcome === "LOSS" ? 0 : totalBet + payout);
  const tableBalanceDelta = outcome === "LOSS" ? totalBet : -payout;
  const newTableBalance = Number(gs.table.balance) + tableBalanceDelta;
  const minBet = Number(gs.table.minBet);

  await prisma.$transaction([
    prisma.gameSession.update({
      where: { id: gs.id },
      data: { betAmount: totalBet, playerHand: serializeHand(playerHand), dealerHand: serializeHand(dealerHand), deck: serializeHand(deck), status: "COMPLETED", outcome },
    }),
    prisma.user.update({ where: { id: gs.userId }, data: { pocket: newPocket } }),
    prisma.table.update({
      where: { id: gs.tableId },
      data: { balance: newTableBalance, isOpen: newTableBalance >= minBet * 1.5 },
    }),
    prisma.transaction.create({
      data: {
        userId: gs.userId,
        type: outcome === "LOSS" ? "BET_PLACED" : outcome === "PUSH" ? "BET_PUSH" : "BET_WIN",
        amount: outcome === "LOSS" ? totalBet : payout,
        note: `Table ${gs.tableId} — DOUBLE — ${outcome}`,
      },
    }),
  ]);

  return NextResponse.json({ playerHand, dealerHand, status: "COMPLETED", outcome, payout, pocket: newPocket, totalBet });
}
