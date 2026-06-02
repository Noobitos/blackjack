import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { tableId, amount } = await req.json();
  const amt = Number(amount);
  if (!tableId || isNaN(amt) || amt <= 0) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const [admin, table] = await Promise.all([
    prisma.user.findUnique({ where: { id: session.user.id } }),
    prisma.table.findUnique({ where: { id: Number(tableId) } }),
  ]);

  if (!admin) return NextResponse.json({ error: "Admin not found" }, { status: 404 });
  if (!table) return NextResponse.json({ error: "Table not found" }, { status: 404 });
  if (Number(admin.pocket) < amt) {
    return NextResponse.json({ error: "Insufficient admin pocket balance" }, { status: 400 });
  }

  const newTableBalance = Number(table.balance) + amt;

  await prisma.$transaction([
    prisma.user.update({
      where: { id: admin.id },
      data: { pocket: Number(admin.pocket) - amt },
    }),
    prisma.table.update({
      where: { id: table.id },
      data: { balance: newTableBalance, isOpen: true },
    }),
    prisma.transaction.create({
      data: {
        userId: admin.id,
        type: "TABLE_FUND",
        amount: amt,
        note: `Funded Table ${table.id} (${table.name})`,
      },
    }),
  ]);

  const updatedTable = await prisma.table.findUnique({ where: { id: table.id } });
  return NextResponse.json({
    table: {
      id: updatedTable!.id,
      balance: Number(updatedTable!.balance),
      isOpen: updatedTable!.isOpen,
    },
  });
}
