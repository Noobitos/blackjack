import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { initHand, serializeGameState, serializeHand, type PlayerState } from "@/lib/poker";
import { POKER_TABLE_CONFIGS } from "@/lib/pokerTables";

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { sessionId } = await req.json();
  const ps = await prisma.pokerSession.findUnique({
    where: { id: sessionId },
    include: { players: true, table: { include: { npc: true } } },
  });

  if (!ps) return NextResponse.json({ error: "Session not found" }, { status: 404 });
  if (ps.status !== "BETWEEN_HANDS") return NextResponse.json({ error: "Not between hands" }, { status: 400 });

  const humanPlayer = ps.players.find((p) => p.userId === session.user.id);
  if (!humanPlayer) return NextResponse.json({ error: "Not in session" }, { status: 403 });

  const npcPlayer = ps.players.find((p) => p.isNpc)!;
  const tableCfg = POKER_TABLE_CONFIGS.find((t) => t.id === ps.tableId)!;

  // Check if either player is busted
  if (Number(humanPlayer.chips) === 0) {
    await prisma.pokerSession.update({ where: { id: sessionId }, data: { status: "COMPLETED" } });
    return NextResponse.json({ error: "You are out of chips. Game over.", status: "COMPLETED" }, { status: 400 });
  }
  if (Number(npcPlayer.chips) === 0 || !ps.table.npc?.isActive) {
    await prisma.pokerSession.update({ where: { id: sessionId }, data: { status: "COMPLETED" } });
    return NextResponse.json({ error: "NPC is out of chips. You win the session!", status: "COMPLETED" }, { status: 400 });
  }

  // Alternate dealer seat
  const newDealerSeat = ps.dealerSeat === 0 ? 1 : 0;
  const handNumber = ps.handNumber + 1;

  const playerList = [
    { seat: 0, chips: Number(humanPlayer.chips) },
    { seat: 1, chips: Number(npcPlayer.chips) },
  ];
  const { gameState, dealtHands } = initHand(playerList, newDealerSeat, tableCfg.smallBlind, tableCfg.bigBlind);

  const playerChipsAfterBlind = Number(humanPlayer.chips) - (gameState.roundBets[String(0)] ?? 0);
  const npcChipsAfterBlind = Number(npcPlayer.chips) - (gameState.roundBets[String(1)] ?? 0);

  await prisma.$transaction([
    prisma.pokerSession.update({
      where: { id: sessionId },
      data: { status: "ACTIVE", phase: "PREFLOP", dealerSeat: newDealerSeat, handNumber, gameState: serializeGameState(gameState) },
    }),
    prisma.pokerPlayer.update({
      where: { id: humanPlayer.id },
      data: { hand: serializeHand(dealtHands[0]), chips: playerChipsAfterBlind, status: "ACTIVE", isAllIn: false },
    }),
    prisma.pokerPlayer.update({
      where: { id: npcPlayer.id },
      data: { hand: serializeHand(dealtHands[1]), chips: npcChipsAfterBlind, status: "ACTIVE", isAllIn: false },
    }),
  ]);

  return NextResponse.json({
    phase: "PREFLOP",
    handNumber,
    dealerSeat: newDealerSeat,
    pot: gameState.pot,
    communityCards: [],
    yourChips: playerChipsAfterBlind,
    npcChips: npcChipsAfterBlind,
    yourHand: dealtHands[0],
    activeSeat: gameState.activeSeat,
    currentBet: gameState.currentBet,
    yourRoundBet: gameState.roundBets[String(0)] ?? 0,
  });
}
