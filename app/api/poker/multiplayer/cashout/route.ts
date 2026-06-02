import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { sessionId } = await req.json();
  const ps = await prisma.pokerSession.findUnique({ where: { id: sessionId }, include: { players: true } });

  if (!ps) return NextResponse.json({ error: "Session not found" }, { status: 404 });
  if (ps.status === "ACTIVE") return NextResponse.json({ error: "Cannot cash out mid-hand" }, { status: 400 });

  const player = ps.players.find((p) => p.userId === session.user.id);
  if (!player) return NextResponse.json({ error: "Not in session" }, { status: 403 });

  const chips = Number(player.chips);
  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  await prisma.$transaction([
    prisma.pokerPlayer.update({ where: { id: player.id }, data: { chips: 0, status: "SITTING_OUT" } }),
    prisma.user.update({ where: { id: session.user.id }, data: { pocket: Number(user.pocket) + chips } }),
    prisma.transaction.create({ data: { userId: session.user.id, type: "POKER_CASHOUT", amount: chips, note: `Multiplayer Poker cash out` } }),
  ]);

  return NextResponse.json({ chipsReturned: chips, pocket: Number(user.pocket) + chips });
}
