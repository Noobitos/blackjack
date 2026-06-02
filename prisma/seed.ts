import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { TABLE_CONFIGS, STARTING_TABLE_BALANCE } from "../lib/tables";

const prisma = new PrismaClient();

async function main() {
  const adminPassword = await bcrypt.hash("admin123", 12);
  await prisma.user.upsert({
    where: { username: "admin" },
    update: {},
    create: {
      username: "admin",
      password: adminPassword,
      role: "ADMIN",
      pocket: 0,
      bank: 0,
    },
  });
  console.log("Admin account created: admin / admin123");

  for (const cfg of TABLE_CONFIGS) {
    await prisma.table.upsert({
      where: { id: cfg.id },
      update: {},
      create: {
        id: cfg.id,
        name: cfg.name,
        minBet: cfg.minBet,
        maxBet: cfg.maxBet,
        balance: STARTING_TABLE_BALANCE,
        isOpen: true,
      },
    });
  }
  console.log("5 tables seeded with $50M each");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
