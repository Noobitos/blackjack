import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { POKER_TABLE_CONFIGS } from "@/lib/pokerTables";

function fmt(n: number) {
  if (n >= 1_000_000) return "$" + (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return "$" + (n / 1_000).toFixed(0) + "K";
  return "$" + n.toLocaleString();
}

export default async function PokerLobbyPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) redirect("/login");

  const [pokerTables, activeSessions] = await Promise.all([
    prisma.pokerTable.findMany({ orderBy: { id: "asc" }, include: { npc: true } }),
    prisma.pokerSession.findMany({
      where: { status: { in: ["WAITING", "ACTIVE", "BETWEEN_HANDS"] } },
      include: { players: { where: { status: { not: "SITTING_OUT" } } } },
    }),
  ]);

  const pocket = Number(user.pocket);

  const npcTable = pokerTables.find((t) => t.tableType === "NPC")!;
  const npcSession = activeSessions.find((s) => s.tableId === npcTable.id && s.players.some((p) => p.userId === session.user.id));
  const npcCfg = POKER_TABLE_CONFIGS.find((t) => t.id === npcTable.id)!;

  const multiTables = pokerTables.filter((t) => t.tableType === "MULTIPLAYER");

  return (
    <div className="min-h-screen bg-felt-dark">
      <Navbar username={user.username} role={user.role} pocket={pocket} />

      <main className="max-w-4xl mx-auto px-6 py-10">
        <h1 className="text-3xl font-bold text-white mb-2">Poker</h1>
        <p className="text-gray-400 mb-8">Texas Hold'em · No rake · Real money</p>

        {/* NPC Table */}
        <h2 className="text-lg font-semibold text-green-400 mb-4">🤖 vs NPC</h2>
        <div className="bg-black/40 border border-green-600/30 rounded-xl p-6 mb-8">
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="text-white font-bold text-lg">{npcTable.name}</div>
              <div className="text-gray-400 text-sm">Heads-up Texas Hold'em</div>
            </div>
            <span className={`text-xs px-2 py-1 rounded font-semibold ${npcTable.npc?.isActive ? "bg-green-900/60 text-green-400" : "bg-red-900/60 text-red-400"}`}>
              {npcTable.npc?.isActive ? "OPEN" : "NPC BROKE"}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5 text-sm">
            <div className="bg-gray-900/50 rounded-lg p-3 text-center">
              <div className="text-gray-400 text-xs mb-1">Blinds</div>
              <div className="text-white font-medium">{fmt(Number(npcTable.smallBlind))} / {fmt(Number(npcTable.bigBlind))}</div>
            </div>
            <div className="bg-gray-900/50 rounded-lg p-3 text-center">
              <div className="text-gray-400 text-xs mb-1">Min buy-in</div>
              <div className="text-white font-medium">{fmt(npcCfg.minBuyIn)}</div>
            </div>
            <div className="bg-gray-900/50 rounded-lg p-3 text-center">
              <div className="text-gray-400 text-xs mb-1">Max buy-in</div>
              <div className="text-white font-medium">{fmt(npcCfg.maxBuyIn)}</div>
            </div>
            <div className="bg-gray-900/50 rounded-lg p-3 text-center">
              <div className="text-gray-400 text-xs mb-1">NPC Budget</div>
              <div className={`font-medium ${Number(npcTable.npc?.budget ?? 0) < 1_000_000 ? "text-red-400" : "text-green-400"}`}>
                {fmt(Number(npcTable.npc?.budget ?? 0))}
              </div>
            </div>
          </div>

          {npcSession ? (
            <Link href={`/poker/npc/${npcSession.id}`} className="block text-center bg-green-600 hover:bg-green-500 text-white font-bold py-3 rounded-lg">
              Rejoin Game
            </Link>
          ) : npcTable.npc?.isActive && pocket >= npcCfg.minBuyIn ? (
            <Link href="/poker/npc/join" className="block text-center bg-green-600 hover:bg-green-500 text-white font-bold py-3 rounded-lg">
              Play vs NPC
            </Link>
          ) : (
            <button disabled className="w-full bg-gray-700 text-gray-500 font-bold py-3 rounded-lg cursor-not-allowed">
              {!npcTable.npc?.isActive ? "NPC out of funds" : "Insufficient balance"}
            </button>
          )}
        </div>

        {/* Multiplayer Tables */}
        <h2 className="text-lg font-semibold text-yellow-400 mb-4">👥 vs Players</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {multiTables.map((table) => {
            const cfg = POKER_TABLE_CONFIGS.find((c) => c.id === table.id)!;
            const tableSession = activeSessions.find((s) => s.tableId === table.id);
            const myPlayer = tableSession?.players.find((p) => p.userId === session.user.id);
            const playerCount = tableSession?.players.length ?? 0;

            return (
              <div key={table.id} className="bg-black/40 border border-yellow-600/30 rounded-xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="font-bold text-white">{table.name}</div>
                  <span className="text-xs text-gray-400">{playerCount}/{cfg.maxPlayers} players</span>
                </div>

                <div className="space-y-1 text-sm mb-4">
                  <div className="flex justify-between"><span className="text-gray-400">Blinds</span><span className="text-white">{fmt(Number(table.smallBlind))} / {fmt(Number(table.bigBlind))}</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">Buy-in</span><span className="text-white">{fmt(cfg.minBuyIn)} – {fmt(cfg.maxBuyIn)}</span></div>
                </div>

                {myPlayer ? (
                  <Link href={`/poker/multiplayer/${tableSession!.id}`} className="block text-center bg-yellow-500 hover:bg-yellow-400 text-black font-bold py-2 rounded">
                    Rejoin Table
                  </Link>
                ) : pocket >= cfg.minBuyIn ? (
                  <Link href={`/poker/multiplayer/join?tableId=${table.id}`} className="block text-center bg-yellow-500 hover:bg-yellow-400 text-black font-bold py-2 rounded">
                    Join Table
                  </Link>
                ) : (
                  <button disabled className="w-full bg-gray-700 text-gray-500 font-bold py-2 rounded cursor-not-allowed">
                    Insufficient balance
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
