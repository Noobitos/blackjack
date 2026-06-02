import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { POKER_TABLE_CONFIGS } from "@/lib/pokerTables";

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { tableId, buyIn } = await req.json();
  const buyInAmt = Number(buyIn);
  const tableCfg = POKER_TABLE_CONFIGS.find((t) => t.id === Number(tableId) && t.tableType === "MULTIPLAYER");
  if (!tableCfg) return NextResponse.json({ error: "Table not found" }, { status: 404 });

  if (isNaN(buyInAmt) || buyInAmt < tableCfg.minBuyIn || buyInAmt > tableCfg.maxBuyIn) {
    return NextResponse.json({ error: `Buy-in must be between $${tableCfg.minBuyIn.toLocaleString()} and $${tableCfg.maxBuyIn.toLocaleString()}` }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
  if (Number(user.pocket) < buyInAmt) return NextResponse.json({ error: "Insufficient pocket balance" }, { status: 400 });

  // Check if already in a session
  const existingPlayer = await prisma.pokerPlayer.findFirst({
    where: { userId: session.user.id, session: { tableId: Number(tableId), status: { in: ["WAITING", "ACTIVE", "BETWEEN_HANDS"] } } },
    include: { session: true },
  });
  if (existingPlayer) {
    return NextResponse.json({ sessionId: existingPlayer.sessionId, alreadyJoined: true }, { status: 200 });
  }

  // Find or create a WAITING session
  let pokerSession = await prisma.pokerSession.findFirst({
    where: { tableId: Number(tableId), status: "WAITING" },
    include: { players: true },
  });

  if (!pokerSession) {
    pokerSession = await prisma.pokerSession.create({
      data: { tableId: Number(tableId), status: "WAITING" },
      include: { players: true },
    });
  }

  if (pokerSession.players.length >= tableCfg.maxPlayers) {
    return NextResponse.json({ error: "Table is full" }, { status: 400 });
  }

  // Assign next available seat
  const takenSeats = new Set(pokerSession.players.map((p) => p.seat));
  const seat = Array.from({ length: tableCfg.maxPlayers }, (_, i) => i).find((s) => !takenSeats.has(s))!;

  await prisma.$transaction([
    prisma.pokerPlayer.create({
      data: { sessionId: pokerSession.id, userId: session.user.id, seat, chips: buyInAmt, status: "WAITING" },
    }),
    prisma.user.update({ where: { id: session.user.id }, data: { pocket: Number(user.pocket) - buyInAmt } }),
    prisma.transaction.create({ data: { userId: session.user.id, type: "POKER_BUYIN", amount: buyInAmt, note: `Multiplayer Poker buy-in (${tableCfg.name})` } }),
  ]);

  return NextResponse.json({ sessionId: pokerSession.id, seat, yourChips: buyInAmt, pocket: Number(user.pocket) - buyInAmt });
}
