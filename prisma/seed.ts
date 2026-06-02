import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { BLACKJACK_TABLE_CONFIGS, ROULETTE_TABLE_CONFIGS, STARTING_TABLE_BALANCE } from "../lib/tables";
import { POKER_TABLE_CONFIGS, NPC_STARTING_BUDGET } from "../lib/pokerTables";

const prisma = new PrismaClient();

async function main() {
  // Admin account
  const adminPassword = await bcrypt.hash("admin123", 12);
  await prisma.user.upsert({
    where: { username: "admin" },
    update: {},
    create: { username: "admin", password: adminPassword, role: "ADMIN", pocket: 0, bank: 0 },
  });
  console.log("Admin account: admin / admin123");

  // Blackjack tables
  for (const cfg of BLACKJACK_TABLE_CONFIGS) {
    await prisma.table.upsert({
      where: { id: cfg.id },
      update: { tableType: "BLACKJACK" },
      create: { id: cfg.id, name: cfg.name, tableType: "BLACKJACK", minBet: cfg.minBet, maxBet: cfg.maxBet, balance: STARTING_TABLE_BALANCE, isOpen: true },
    });
  }
  console.log("5 blackjack tables seeded");

  // Roulette tables
  for (const cfg of ROULETTE_TABLE_CONFIGS) {
    await prisma.table.upsert({
      where: { id: cfg.id },
      update: { tableType: "ROULETTE" },
      create: { id: cfg.id, name: cfg.name, tableType: "ROULETTE", minBet: cfg.minBetNumber, minBetOutside: cfg.minBetOutside, maxBet: cfg.maxBet, balance: STARTING_TABLE_BALANCE, isOpen: true },
    });
  }
  console.log("2 roulette tables seeded");

  // Poker tables
  for (const cfg of POKER_TABLE_CONFIGS) {
    const pt = await prisma.pokerTable.upsert({
      where: { id: cfg.id },
      update: {},
      create: { id: cfg.id, name: cfg.name, tableType: cfg.tableType, smallBlind: cfg.smallBlind, bigBlind: cfg.bigBlind, minBuyIn: cfg.minBuyIn, maxBuyIn: cfg.maxBuyIn, maxPlayers: cfg.maxPlayers, isOpen: true },
    });

    // Seed NPC budget for NPC table
    if (cfg.tableType === "NPC") {
      await prisma.pokerNpc.upsert({
        where: { tableId: pt.id },
        update: {},
        create: { tableId: pt.id, budget: NPC_STARTING_BUDGET, isActive: true },
      });
    }
  }
  console.log("3 poker tables seeded (1 NPC + 2 multiplayer)");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
