-- CreateTable
CREATE TABLE "RouletteGame" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "tableId" INTEGER NOT NULL,
    "bets" TEXT NOT NULL,
    "result" INTEGER NOT NULL,
    "totalBet" DECIMAL NOT NULL,
    "totalPayout" DECIMAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RouletteGame_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "RouletteGame_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "Table" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Table" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "tableType" TEXT NOT NULL DEFAULT 'BLACKJACK',
    "minBet" DECIMAL NOT NULL,
    "maxBet" DECIMAL NOT NULL,
    "minBetOutside" DECIMAL,
    "balance" DECIMAL NOT NULL DEFAULT 50000000,
    "isOpen" BOOLEAN NOT NULL DEFAULT true
);
INSERT INTO "new_Table" ("balance", "id", "isOpen", "maxBet", "minBet", "name") SELECT "balance", "id", "isOpen", "maxBet", "minBet", "name" FROM "Table";
DROP TABLE "Table";
ALTER TABLE "new_Table" RENAME TO "Table";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
