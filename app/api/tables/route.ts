import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tables = await prisma.table.findMany({ orderBy: { id: "asc" } });
  return NextResponse.json(
    tables.map((t) => ({
      id: t.id,
      name: t.name,
      minBet: Number(t.minBet),
      maxBet: Number(t.maxBet),
      balance: Number(t.balance),
      isOpen: t.isOpen,
    }))
  );
}
