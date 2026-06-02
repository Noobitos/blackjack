import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { targetUsername, amount, destination } = await req.json();
  const amt = Number(amount);
  if (!targetUsername || isNaN(amt) || amt <= 0 || !["pocket", "bank"].includes(destination)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const [admin, target] = await Promise.all([
    prisma.user.findUnique({ where: { id: session.user.id } }),
    prisma.user.findUnique({ where: { username: targetUsername } }),
  ]);

  if (!admin) return NextResponse.json({ error: "Admin not found" }, { status: 404 });
  if (!target) return NextResponse.json({ error: "Target user not found" }, { status: 404 });
  if (Number(admin.pocket) < amt) {
    return NextResponse.json({ error: "Insufficient admin pocket balance" }, { status: 400 });
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: admin.id },
      data: { pocket: Number(admin.pocket) - amt },
    }),
    prisma.user.update({
      where: { id: target.id },
      data:
        destination === "pocket"
          ? { pocket: Number(target.pocket) + amt }
          : { bank: Number(target.bank) + amt },
    }),
    prisma.transaction.create({
      data: {
        userId: admin.id,
        type: "ADMIN_SEND",
        amount: amt,
        note: `Sent to ${targetUsername} (${destination})`,
      },
    }),
    prisma.transaction.create({
      data: {
        userId: target.id,
        type: "ADMIN_SEND",
        amount: amt,
        note: `Received from admin (${destination})`,
      },
    }),
  ]);

  const updatedAdmin = await prisma.user.findUnique({ where: { id: admin.id } });
  return NextResponse.json({ adminPocket: Number(updatedAdmin!.pocket) });
}
