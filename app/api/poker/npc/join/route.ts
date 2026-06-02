import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { initHand, serializeGameState, serializeHand, type PlayerState } from "@/lib/poker";
import { POKER_TABLE_CONFIGS } from "@/lib/pokerTables";

const NPC_TABLE_ID = 101;

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { buyIn } = await req.json();
  const buyInAmt = Number(buyIn);
  const tableCfg = POKER_TABLE_CONFIGS.find((t) => t.id === NPC_TABLE_ID)!;

  if (isNaN(buyInAmt) || buyInAmt < tableCfg.minBuyIn || buyInAmt > tableCfg.maxBuyIn) {
    return NextResponse.json({ error: `Buy-in must be between $${tableCfg.minBuyIn.toLocaleString()} and $${tableCfg.maxBuyIn.toLocaleString()}` }, { status: 400 });
  }

  const [user, pokerTable] = await Promise.all([
    prisma.user.findUnique({ where: { id: session.user.id } }),
    prisma.pokerTable.findUnique({ where: { id: NPC_TABLE_ID }, include: { npc: true } }),
  ]);

  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
  if (!pokerTable?.npc?.isActive) return NextResponse.json({ error: "NPC table is closed — NPC ran out of funds" }, { status: 400 });
  if (Number(user.pocket) < buyInAmt) return NextResponse.json({ error: "Insufficient pocket balance" }, { status: 400 });

  // Check no existing active NPC session for this user
  const existing = await prisma.pokerSession.findFirst({
    where: { tableId: NPC_TABLE_ID, status: { in: ["ACTIVE", "BETWEEN_HANDS"] }, players: { some: { userId: session.user.id } } },
  });
  if (existing) return NextResponse.json({ error: "You already have an active NPC session", sessionId: existing.id }, { status: 400 });

  const npcChips = Math.min(Number(pokerTable.npc.budget), tableCfg.maxBuyIn);

  // Create session + players
  const pokerSession = await prisma.pokerSession.create({
    data: {
      tableId: NPC_TABLE_ID,
      status: "ACTIVE",
      dealerSeat: 0,
      handNumber: 1,
      players: {
        create: [
          { userId: session.user.id, seat: 0, chips: buyInAmt, status: "ACTIVE" },
          { isNpc: true, seat: 1, chips: npcChips, status: "ACTIVE" },
        ],
      },
    },
    include: { players: true },
  });

  // Deduct buy-in from user pocket + record transaction
  await prisma.$transaction([
    prisma.user.update({ where: { id: session.user.id }, data: { pocket: Number(user.pocket) - buyInAmt } }),
    prisma.transaction.create({ data: { userId: session.user.id, type: "POKER_BUYIN", amount: buyInAmt, note: `NPC Poker buy-in` } }),
  ]);

  // Deal first hand
  const playerList: { seat: number; chips: number }[] = [
    { seat: 0, chips: buyInAmt },
    { seat: 1, chips: npcChips },
  ];
  const { gameState, dealtHands } = initHand(playerList, 0, tableCfg.smallBlind, tableCfg.bigBlind);

  // Save hands + game state
  const playerPlayer = pokerSession.players.find((p) => !p.isNpc)!;
  const npcPlayer = pokerSession.players.find((p) => p.isNpc)!;

  // Deduct blinds from chips
  const playerChipsAfterBlind = buyInAmt - (gameState.roundBets[String(0)] ?? 0);
  const npcChipsAfterBlind = npcChips - (gameState.roundBets[String(1)] ?? 0);

  await prisma.$transaction([
    prisma.pokerSession.update({
      where: { id: pokerSession.id },
      data: { phase: "PREFLOP", gameState: serializeGameState(gameState) },
    }),
    prisma.pokerPlayer.update({
      where: { id: playerPlayer.id },
      data: { hand: serializeHand(dealtHands[0]), chips: playerChipsAfterBlind, status: "ACTIVE" },
    }),
    prisma.pokerPlayer.update({
      where: { id: npcPlayer.id },
      data: { hand: serializeHand(dealtHands[1]), chips: npcChipsAfterBlind, status: "ACTIVE" },
    }),
  ]);

  return NextResponse.json({
    sessionId: pokerSession.id,
    yourChips: playerChipsAfterBlind,
    npcChips: npcChipsAfterBlind,
    pocket: Number(user.pocket) - buyInAmt,
    phase: "PREFLOP",
    pot: gameState.pot,
    communityCards: [],
    yourHand: dealtHands[0],
    activeSeat: gameState.activeSeat,
    currentBet: gameState.currentBet,
    yourRoundBet: gameState.roundBets[String(0)] ?? 0,
    dealerSeat: 0,
    handNumber: 1,
  });
}
