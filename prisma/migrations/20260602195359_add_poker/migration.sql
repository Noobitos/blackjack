-- CreateTable
CREATE TABLE "PokerTable" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "tableType" TEXT NOT NULL,
    "smallBlind" DECIMAL NOT NULL,
    "bigBlind" DECIMAL NOT NULL,
    "minBuyIn" DECIMAL NOT NULL,
    "maxBuyIn" DECIMAL NOT NULL,
    "maxPlayers" INTEGER NOT NULL DEFAULT 6,
    "isOpen" BOOLEAN NOT NULL DEFAULT true
);

-- CreateTable
CREATE TABLE "PokerNpc" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "tableId" INTEGER NOT NULL,
    "budget" DECIMAL NOT NULL DEFAULT 10000000,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "PokerNpc_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "PokerTable" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PokerSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tableId" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'WAITING',
    "phase" TEXT,
    "handNumber" INTEGER NOT NULL DEFAULT 0,
    "dealerSeat" INTEGER NOT NULL DEFAULT 0,
    "gameState" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PokerSession_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "PokerTable" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PokerPlayer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "userId" TEXT,
    "isNpc" BOOLEAN NOT NULL DEFAULT false,
    "seat" INTEGER NOT NULL,
    "chips" DECIMAL NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'WAITING',
    "hand" TEXT,
    "isAllIn" BOOLEAN NOT NULL DEFAULT false,
    "joinedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PokerPlayer_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "PokerSession" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PokerPlayer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "PokerNpc_tableId_key" ON "PokerNpc"("tableId");
