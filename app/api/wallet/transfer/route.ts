import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { direction, amount } = await req.json();
  const amt = Number(amount);
  if (!["toBank", "toPocket"].includes(direction) || isNaN(amt) || amt <= 0) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const pocket = Number(user.pocket);
  const bank = Number(user.bank);

  if (direction === "toBank") {
    if (pocket < amt) return NextResponse.json({ error: "Insufficient pocket balance" }, { status: 400 });
    await prisma.$transaction([
      prisma.user.update({
        where: { id: session.user.id },
        data: { pocket: pocket - amt, bank: bank + amt },
      }),
      prisma.transaction.create({
        data: { userId: session.user.id, type: "BANK_DEPOSIT", amount: amt },
      }),
    ]);
  } else {
    if (bank < amt) return NextResponse.json({ error: "Insufficient bank balance" }, { status: 400 });
    await prisma.$transaction([
      prisma.user.update({
        where: { id: session.user.id },
        data: { pocket: pocket + amt, bank: bank - amt },
      }),
      prisma.transaction.create({
        data: { userId: session.user.id, type: "BANK_WITHDRAW", amount: amt },
      }),
    ]);
  }

  const updated = await prisma.user.findUnique({ where: { id: session.user.id } });
  return NextResponse.json({
    pocket: Number(updated!.pocket),
    bank: Number(updated!.bank),
  });
}
