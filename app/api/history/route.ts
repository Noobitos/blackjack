import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [transactions, games, rouletteGames] = await Promise.all([
    prisma.transaction.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.gameSession.findMany({
      where: { userId: session.user.id, status: "COMPLETED" },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { table: { select: { name: true } } },
    }),
    prisma.rouletteGame.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { table: { select: { name: true } } },
    }),
  ]);

  return NextResponse.json({
    transactions: transactions.map((t) => ({ ...t, amount: Number(t.amount) })),
    games: games.map((g) => ({
      id: g.id,
      gameType: "BLACKJACK",
      tableId: g.tableId,
      tableName: g.table.name,
      betAmount: Number(g.betAmount),
      outcome: g.outcome,
      createdAt: g.createdAt,
    })),
    rouletteGames: rouletteGames.map((g) => ({
      id: g.id,
      gameType: "ROULETTE",
      tableId: g.tableId,
      tableName: g.table.name,
      totalBet: Number(g.totalBet),
      totalPayout: Number(g.totalPayout),
      profit: Number(g.totalPayout) - Number(g.totalBet),
      result: g.result,
      createdAt: g.createdAt,
    })),
  });
}
