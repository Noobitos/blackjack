import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { TABLE_CONFIGS } from "@/lib/tables";

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

  return (
    <div className="min-h-screen bg-felt-dark">
      <Navbar username={user.username} role={user.role} pocket={pocket} />

      <main className="max-w-5xl mx-auto px-6 py-10">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-white mb-1">Choose Your Table</h1>
          <p className="text-gray-400">Your pocket: <span className="text-green-400 font-semibold">{fmt(pocket)}</span></p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tables.map((table) => {
            const cfg = TABLE_CONFIGS.find((c) => c.id === table.id)!;
            const balance = Number(table.balance);
            const minBet = Number(table.minBet);
            const maxBet = Number(table.maxBet);
            const canSit = table.isOpen && pocket >= minBet;

            return (
              <div
                key={table.id}
                className={`bg-black/40 border rounded-xl p-6 flex flex-col gap-4 ${
                  table.isOpen ? "border-yellow-600/40" : "border-gray-700/40 opacity-60"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded ${cfg.badge} text-white`}>
                      {table.name}
                    </span>
                  </div>
                  <span
                    className={`text-xs px-2 py-0.5 rounded font-semibold ${
                      table.isOpen
                        ? "bg-green-900/60 text-green-400"
                        : "bg-red-900/60 text-red-400"
                    }`}
                  >
                    {table.isOpen ? "OPEN" : "CLOSED"}
                  </span>
                </div>

                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Min bet</span>
                    <span className="text-white font-medium">{fmt(minBet)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Max bet</span>
                    <span className="text-white font-medium">{fmt(maxBet)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">House balance</span>
                    <span className={`font-medium ${balance < minBet * 10 ? "text-red-400" : "text-green-400"}`}>
                      {fmt(balance)}
                    </span>
                  </div>
                </div>

                {canSit ? (
                  <Link
                    href={`/table/${table.id}`}
                    className="mt-auto block text-center bg-yellow-500 hover:bg-yellow-400 text-black font-bold py-2 rounded"
                  >
                    Sit Down
                  </Link>
                ) : (
                  <button
                    disabled
                    className="mt-auto block w-full text-center bg-gray-700 text-gray-500 font-bold py-2 rounded cursor-not-allowed"
                  >
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
