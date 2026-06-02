import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { BLACKJACK_TABLE_CONFIGS, ROULETTE_TABLE_CONFIGS, STARTING_TABLE_BALANCE } from "../lib/tables";

const prisma = new PrismaClient();

async function main() {
  const adminPassword = await bcrypt.hash("admin123", 12);
  await prisma.user.upsert({
    where: { username: "admin" },
    update: {},
    create: { username: "admin", password: adminPassword, role: "ADMIN", pocket: 0, bank: 0 },
  });
  console.log("Admin account: admin / admin123");

  for (const cfg of BLACKJACK_TABLE_CONFIGS) {
    await prisma.table.upsert({
      where: { id: cfg.id },
      update: { tableType: "BLACKJACK" },
      create: { id: cfg.id, name: cfg.name, tableType: "BLACKJACK", minBet: cfg.minBet, maxBet: cfg.maxBet, balance: STARTING_TABLE_BALANCE, isOpen: true },
    });
  }
  console.log("5 blackjack tables seeded");

  for (const cfg of ROULETTE_TABLE_CONFIGS) {
    await prisma.table.upsert({
      where: { id: cfg.id },
      update: { tableType: "ROULETTE" },
      create: { id: cfg.id, name: cfg.name, tableType: "ROULETTE", minBet: cfg.minBetNumber, minBetOutside: cfg.minBetOutside, maxBet: cfg.maxBet, balance: STARTING_TABLE_BALANCE, isOpen: true },
    });
  }
  console.log("2 roulette tables seeded");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
