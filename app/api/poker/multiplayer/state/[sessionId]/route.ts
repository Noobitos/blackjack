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
    include: { players: { include: { user: { select: { username: true } } } } },
  });

  if (!ps) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const me = ps.players.find((p) => p.userId === session.user.id);
  if (!me) return NextResponse.json({ error: "Not in session" }, { status: 403 });

  const gs = ps.gameState ? parseGameState(ps.gameState) : null;

  const players = ps.players.map((p) => ({
    seat: p.seat,
    username: p.user?.username ?? "Unknown",
    chips: Number(p.chips),
    status: p.status,
    isAllIn: p.isAllIn,
    isYou: p.userId === session.user.id,
    roundBet: gs?.roundBets[p.seat] ?? 0,
    // Only reveal hands at showdown or your own hand
    hand:
      p.userId === session.user.id
        ? p.hand ? parseHand(p.hand) : null
        : ps.phase === "SHOWDOWN" && p.status !== "FOLDED" && p.hand
        ? parseHand(p.hand)
        : null,
  }));

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
    activeSeat: gs?.activeSeat,
    isYourTurn: gs?.activeSeat === me.seat && ps.status === "ACTIVE",
    yourRoundBet: gs?.roundBets[me.seat] ?? 0,
    players,
    pocket: Number(user?.pocket ?? 0),
    updatedAt: ps.updatedAt,
  });
}
