import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { BLACKJACK_TABLE_CONFIGS, ROULETTE_TABLE_CONFIGS } from "@/lib/tables";

function fmt(n: number) {
  if (n >= 1_000_000) return "$" + (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return "$" + (n / 1_000).toFixed(0) + "K";
  return "$" + n.toLocaleString();
}

export default async function LobbyPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const [user, tables] = await Promise.all([
    prisma.user.findUnique({ where: { id: session.user.id } }),
    prisma.table.findMany({ orderBy: { id: "asc" } }),
  ]);

  if (!user) redirect("/login");

  const pocket = Number(user.pocket);
  const blackjackTables = tables.filter((t) => t.tableType === "BLACKJACK");
  const rouletteTables = tables.filter((t) => t.tableType === "ROULETTE");

  return (
    <div className="min-h-screen bg-felt-dark">
      <Navbar username={user.username} role={user.role} pocket={pocket} />

      <main className="max-w-5xl mx-auto px-6 py-10">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-white mb-1">Choose Your Table</h1>
          <p className="text-gray-400">Pocket: <span className="text-green-400 font-semibold">{fmt(pocket)}</span></p>
        </div>

        {/* Blackjack tables */}
        <h2 className="text-lg font-semibold text-yellow-400 mb-4">♠ Blackjack</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mb-10">
          {blackjackTables.map((table) => {
            const cfg = BLACKJACK_TABLE_CONFIGS.find((c) => c.id === table.id)!;
            const balance = Number(table.balance);
            const minBet = Number(table.minBet);
            const canSit = table.isOpen && pocket >= minBet;

            return (
              <div key={table.id} className={`bg-black/40 border rounded-xl p-5 flex flex-col gap-4 ${table.isOpen ? "border-yellow-600/40" : "border-gray-700/40 opacity-60"}`}>
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded ${cfg?.badge ?? "bg-gray-700"} text-white`}>{table.name}</span>
                  <span className={`text-xs px-2 py-0.5 rounded font-semibold ${table.isOpen ? "bg-green-900/60 text-green-400" : "bg-red-900/60 text-red-400"}`}>
                    {table.isOpen ? "OPEN" : "CLOSED"}
                  </span>
                </div>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between"><span className="text-gray-400">Min bet</span><span className="text-white font-medium">{fmt(minBet)}</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">Max bet</span><span className="text-white font-medium">{fmt(Number(table.maxBet))}</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">House</span><span className={`font-medium ${balance < minBet * 10 ? "text-red-400" : "text-green-400"}`}>{fmt(balance)}</span></div>
                </div>
                {canSit ? (
                  <Link href={`/table/${table.id}`} className="mt-auto block text-center bg-yellow-500 hover:bg-yellow-400 text-black font-bold py-2 rounded">Sit Down</Link>
                ) : (
                  <button disabled className="mt-auto w-full bg-gray-700 text-gray-500 font-bold py-2 rounded cursor-not-allowed">
                    {!table.isOpen ? "Table Closed" : "Insufficient Funds"}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Poker tables */}
        <div className="mb-10">
          <h2 className="text-lg font-semibold text-green-400 mb-4">♠ Poker (Texas Hold'em)</h2>
          <Link
            href="/poker"
            className="block bg-black/40 border border-green-600/30 rounded-xl p-5 hover:border-green-500/60 transition-colors"
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="text-white font-bold">Poker Tables</div>
                <div className="text-gray-400 text-sm mt-1">vs NPC (10M budget) · Multiplayer up to 6 players</div>
              </div>
              <div className="text-green-400 font-semibold text-sm">Enter →</div>
            </div>
          </Link>
        </div>

        {/* Roulette tables */}
        <h2 className="text-lg font-semibold text-red-400 mb-4">🎰 Roulette</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {rouletteTables.map((table) => {
            const cfg = ROULETTE_TABLE_CONFIGS.find((c) => c.id === table.id)!;
            const balance = Number(table.balance);
            const minBetNum = Number(table.minBet);
            const minBetOut = Number(table.minBetOutside ?? table.minBet);
            const canSit = table.isOpen && pocket >= minBetOut;

            return (
              <div key={table.id} className={`bg-black/40 border rounded-xl p-5 flex flex-col gap-4 ${table.isOpen ? "border-red-600/40" : "border-gray-700/40 opacity-60"}`}>
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded ${cfg?.badge ?? "bg-red-700"} text-white`}>{table.name}</span>
                  <span className={`text-xs px-2 py-0.5 rounded font-semibold ${table.isOpen ? "bg-green-900/60 text-green-400" : "bg-red-900/60 text-red-400"}`}>
                    {table.isOpen ? "OPEN" : "CLOSED"}
                  </span>
                </div>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between"><span className="text-gray-400">Numbers min</span><span className="text-white font-medium">{fmt(minBetNum)} <span className="text-gray-500 text-xs">(35:1)</span></span></div>
                  <div className="flex justify-between"><span className="text-gray-400">Outside min</span><span className="text-white font-medium">{fmt(minBetOut)} <span className="text-gray-500 text-xs">(1:1 / 2:1)</span></span></div>
                  <div className="flex justify-between"><span className="text-gray-400">Max bet</span><span className="text-white font-medium">{fmt(Number(table.maxBet))}</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">House</span><span className={`font-medium ${balance < minBetOut * 10 ? "text-red-400" : "text-green-400"}`}>{fmt(balance)}</span></div>
                </div>
                {canSit ? (
                  <Link href={`/roulette/${table.id}`} className="mt-auto block text-center bg-red-600 hover:bg-red-500 text-white font-bold py-2 rounded">Join Table</Link>
                ) : (
                  <button disabled className="mt-auto w-full bg-gray-700 text-gray-500 font-bold py-2 rounded cursor-not-allowed">
                    {!table.isOpen ? "Table Closed" : "Insufficient Funds"}
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
