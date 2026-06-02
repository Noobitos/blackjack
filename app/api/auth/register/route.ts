import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const { username, password } = await req.json();

  if (!username || !password) {
    return NextResponse.json({ error: "Username and password required" }, { status: 400 });
  }

  if (username.length < 3 || password.length < 6) {
    return NextResponse.json(
      { error: "Username min 3 chars, password min 6 chars" },
      { status: 400 }
    );
  }

  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) {
    return NextResponse.json({ error: "Username already taken" }, { status: 409 });
  }

  const hashed = await bcrypt.hash(password, 12);
  await prisma.user.create({ data: { username, password: hashed } });

  return NextResponse.json({ ok: true });
}
