import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { parseGameState, parseHand } from "@/lib/poker";

export async function GET(_req: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { sessionId } = await params;
  const ps = await prisma.pokerSession.findUnique({
    where: { id: sessionId },
    include: { players: true, table: { include: { npc: true } } },
  });

  if (!ps) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const humanPlayer = ps.players.find((p) => p.userId === session.user.id);
  if (!humanPlayer) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const npcPlayer = ps.players.find((p) => p.isNpc);
  const gs = ps.gameState ? parseGameState(ps.gameState) : null;

  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { pocket: true } });

  return NextResponse.json({
    sessionId: ps.id,
    status: ps.status,
    phase: ps.phase,
    handNumber: ps.handNumber,
    dealerSeat: ps.dealerSeat,
    pot: gs?.pot ?? 0,
    communityCards: gs?.communityCards ?? [],
    currentBet: gs?.currentBet ?? 0,
    activeSeat: gs?.activeSeat ?? 0,
    yourChips: Number(humanPlayer.chips),
    npcChips: Number(npcPlayer?.chips ?? 0),
    yourHand: humanPlayer.hand ? parseHand(humanPlayer.hand) : null,
    yourRoundBet: gs?.roundBets[humanPlayer.seat] ?? 0,
    isYourTurn: gs?.activeSeat === humanPlayer.seat && ps.status === "ACTIVE",
    npcBudget: Number(ps.table.npc?.budget ?? 0),
    npcIsActive: ps.table.npc?.isActive ?? false,
    pocket: Number(user?.pocket ?? 0),
  });
}
