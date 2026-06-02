import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  createDeck, shuffleDeck, drawCard, isBlackjack,
  resolveOutcome, calcPayout, serializeHand,
} from "@/lib/blackjack";

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { tableId, betAmount } = await req.json();
  const bet = Number(betAmount);
  const tId = Number(tableId);

  if (isNaN(bet) || bet <= 0 || isNaN(tId)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const [user, table] = await Promise.all([
    prisma.user.findUnique({ where: { id: session.user.id } }),
    prisma.table.findUnique({ where: { id: tId } }),
  ]);

  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
  if (!table) return NextResponse.json({ error: "Table not found" }, { status: 404 });
  if (!table.isOpen) return NextResponse.json({ error: "Table is closed" }, { status: 400 });

  const minBet = Number(table.minBet);
  const maxBet = Number(table.maxBet);
  if (bet < minBet) return NextResponse.json({ error: `Minimum bet is $${minBet.toLocaleString()}` }, { status: 400 });
  if (bet > maxBet) return NextResponse.json({ error: `Maximum bet is $${maxBet.toLocaleString()}` }, { status: 400 });

  const pocket = Number(user.pocket);
  if (pocket < bet) return NextResponse.json({ error: "Insufficient pocket balance" }, { status: 400 });

  const maxPayout = Math.ceil(bet * 2.5);
  if (Number(table.balance) < maxPayout) {
    return NextResponse.json({ error: "Table cannot cover this bet" }, { status: 400 });
  }

  let deck = shuffleDeck(createDeck());
  const { card: p1, remaining: d1 } = drawCard(deck); deck = d1;
  const { card: d1c, remaining: d2 } = drawCard(deck); deck = d2;
  const { card: p2, remaining: d3 } = drawCard(deck); deck = d3;
  const { card: d2c, remaining: d4 } = drawCard(deck); deck = d4;

  const playerHand = [p1, p2];
  const dealerHand = [d1c, d2c];

  const playerBJ = isBlackjack(playerHand);
  const dealerBJ = isBlackjack(dealerHand);

  if (playerBJ || dealerBJ) {
    const outcome = resolveOutcome(playerHand, dealerHand);
    const payout = calcPayout(outcome, bet);
    const tableBalanceDelta = outcome === "LOSS" ? bet : -payout;
    const newTableBalance = Number(table.balance) + tableBalanceDelta;
    const newPocket = pocket - bet + (outcome === "LOSS" ? 0 : bet + payout);

    const gs = await prisma.$transaction(async (tx) => {
      const s = await tx.gameSession.create({
        data: {
          userId: user.id,
          tableId: tId,
          betAmount: bet,
          playerHand: serializeHand(playerHand),
          dealerHand: serializeHand(dealerHand),
          deck: serializeHand([]),
          status: "COMPLETED",
          outcome,
        },
      });
      await tx.user.update({ where: { id: user.id }, data: { pocket: newPocket } });
      await tx.table.update({
        where: { id: tId },
        data: { balance: newTableBalance, isOpen: newTableBalance >= minBet * 1.5 },
      });
      await tx.transaction.create({
        data: {
          userId: user.id,
          type: outcome === "LOSS" ? "BET_PLACED" : outcome === "PUSH" ? "BET_PUSH" : "BET_WIN",
          amount: outcome === "LOSS" ? bet : payout,
          note: `Table ${tId} — ${outcome}`,
        },
      });
      return s;
    });

    return NextResponse.json({ sessionId: gs.id, playerHand, dealerHand, status: "COMPLETED", outcome, payout, pocket: newPocket });
  }

  const gs = await prisma.$transaction(async (tx) => {
    const s = await tx.gameSession.create({
      data: {
        userId: user.id,
        tableId: tId,
        betAmount: bet,
        playerHand: serializeHand(playerHand),
        dealerHand: serializeHand(dealerHand),
        deck: serializeHand(deck),
        status: "IN_PROGRESS",
      },
    });
    await tx.user.update({ where: { id: user.id }, data: { pocket: pocket - bet } });
    return s;
  });

  return NextResponse.json({
    sessionId: gs.id,
    playerHand,
    dealerHand: [dealerHand[0], null],
    status: "IN_PROGRESS",
    pocket: pocket - bet,
  });
}
