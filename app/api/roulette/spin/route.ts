import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { spinWheel, resolveBets, isNumberBet, type RouletteBet } from "@/lib/roulette";

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { tableId, bets } = await req.json() as { tableId: number; bets: RouletteBet[] };

  if (!tableId || !Array.isArray(bets) || bets.length === 0) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const [user, table] = await Promise.all([
    prisma.user.findUnique({ where: { id: session.user.id } }),
    prisma.table.findUnique({ where: { id: Number(tableId) } }),
  ]);

  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
  if (!table || table.tableType !== "ROULETTE") return NextResponse.json({ error: "Table not found" }, { status: 404 });
  if (!table.isOpen) return NextResponse.json({ error: "Table is closed" }, { status: 400 });

  const minBetNumber = Number(table.minBet);
  const minBetOutside = Number(table.minBetOutside ?? table.minBet);
  const maxBet = Number(table.maxBet);
  const pocket = Number(user.pocket);

  // Validate each bet
  for (const bet of bets) {
    if (!bet.type || typeof bet.amount !== "number" || bet.amount <= 0) {
      return NextResponse.json({ error: "Invalid bet" }, { status: 400 });
    }
    const min = isNumberBet(bet.type) ? minBetNumber : minBetOutside;
    if (bet.amount < min) {
      return NextResponse.json({ error: `Minimum bet for ${bet.type} is $${min.toLocaleString()}` }, { status: 400 });
    }
    if (bet.amount > maxBet) {
      return NextResponse.json({ error: `Maximum bet is $${maxBet.toLocaleString()}` }, { status: 400 });
    }
    if (bet.type === "straight" && (bet.target == null || bet.target < 0 || bet.target > 36)) {
      return NextResponse.json({ error: "Invalid straight bet target" }, { status: 400 });
    }
  }

  const totalBetAmt = bets.reduce((s, b) => s + b.amount, 0);
  if (totalBetAmt > pocket) {
    return NextResponse.json({ error: "Insufficient pocket balance" }, { status: 400 });
  }

  // Worst-case payout: all straight-up bets win (35:1 each)
  const worstPayout = bets.reduce((s, b) => s + (isNumberBet(b.type) ? b.amount * 35 : b.amount * 2), 0);
  if (Number(table.balance) < worstPayout) {
    return NextResponse.json({ error: "Table cannot cover potential payout" }, { status: 400 });
  }

  const result = spinWheel();
  const { totalBet, totalPayout, winnings } = resolveBets(bets, result);

  // Player net: they already "spent" totalBet, they receive back totalPayout
  const newPocket = pocket - totalBet + totalPayout;
  const newTableBalance = Number(table.balance) + winnings; // winnings = bet - payout (positive = table gains)
  const minBetForClose = minBetOutside;
  const tableStaysOpen = newTableBalance >= minBetForClose * 1.5;

  await prisma.$transaction([
    prisma.user.update({ where: { id: user.id }, data: { pocket: newPocket } }),
    prisma.table.update({
      where: { id: table.id },
      data: { balance: newTableBalance, isOpen: tableStaysOpen },
    }),
    prisma.rouletteGame.create({
      data: {
        userId: user.id,
        tableId: table.id,
        bets: JSON.stringify(bets),
        result,
        totalBet,
        totalPayout,
      },
    }),
    prisma.transaction.create({
      data: {
        userId: user.id,
        type: totalPayout > totalBet ? "BET_WIN" : totalPayout === totalBet ? "BET_PUSH" : "BET_PLACED",
        amount: totalPayout > totalBet ? totalPayout - totalBet : totalBet - totalPayout,
        note: `Roulette Table ${table.id} — Ball landed on ${result}`,
      },
    }),
  ]);

  return NextResponse.json({
    result,
    totalBet,
    totalPayout,
    profit: totalPayout - totalBet,
    pocket: newPocket,
    tableBalance: newTableBalance,
    tableIsOpen: tableStaysOpen,
  });
}
