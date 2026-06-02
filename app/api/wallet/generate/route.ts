import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ADMIN_CASH_GENERATION } from "@/lib/tables";

export async function POST() {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const newPocket = Number(user.pocket) + ADMIN_CASH_GENERATION;
  await prisma.$transaction([
    prisma.user.update({
      where: { id: session.user.id },
      data: { pocket: newPocket },
    }),
    prisma.transaction.create({
      data: {
        userId: session.user.id,
        type: "CASH_GENERATION",
        amount: ADMIN_CASH_GENERATION,
        note: `Generated $${ADMIN_CASH_GENERATION.toLocaleString()}`,
      },
    }),
  ]);

  return NextResponse.json({ pocket: newPocket, generated: ADMIN_CASH_GENERATION });
}
