import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tables = await prisma.pokerTable.findMany({
    orderBy: { id: "asc" },
    include: {
      npc: true,
      sessions: {
        where: { status: { in: ["WAITING", "ACTIVE", "BETWEEN_HANDS"] } },
        include: { players: { where: { status: { not: "SITTING_OUT" } } } },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  return NextResponse.json(
    tables.map((t) => {
      const activeSession = t.sessions[0];
      const playerCount = activeSession?.players.length ?? 0;
      return {
        id: t.id, name: t.name, tableType: t.tableType,
        smallBlind: Number(t.smallBlind), bigBlind: Number(t.bigBlind),
        minBuyIn: Number(t.minBuyIn), maxBuyIn: Number(t.maxBuyIn),
        maxPlayers: t.maxPlayers, isOpen: t.isOpen,
        playerCount,
        sessionId: activeSession?.id ?? null,
        sessionStatus: activeSession?.status ?? null,
        npcBudget: t.npc ? Number(t.npc.budget) : null,
        npcIsActive: t.npc?.isActive ?? null,
      };
    })
  );
}
