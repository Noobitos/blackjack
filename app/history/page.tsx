"use client";
import { useState, useEffect } from "react";
import Navbar from "@/components/Navbar";

function fmt(n: number) {
  return "$" + n.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

const TX_LABELS: Record<string, string> = {
  CASH_GENERATION: "Cash Generated",
  ADMIN_SEND: "Admin Transfer",
  TABLE_FUND: "Table Funded",
  BANK_DEPOSIT: "Deposited to Bank",
  BANK_WITHDRAW: "Withdrawn from Bank",
  BET_PLACED: "Bet Lost",
  BET_WIN: "Bet Won",
  BET_PUSH: "Bet Push",
};

const OUTCOME_COLORS: Record<string, string> = {
  WIN: "text-green-400",
  BLACKJACK: "text-yellow-400",
  LOSS: "text-red-400",
  PUSH: "text-blue-400",
};

export default function HistoryPage() {
  const [wallet, setWallet] = useState({ pocket: 0, username: "", role: "" });
  const [transactions, setTransactions] = useState<{ id: string; type: string; amount: number; note?: string; createdAt: string }[]>([]);
  const [games, setGames] = useState<{ id: string; tableName: string; betAmount: number; outcome: string; createdAt: string }[]>([]);
  const [tab, setTab] = useState<"transactions" | "games">("transactions");

  useEffect(() => {
    fetch("/api/wallet").then((r) => r.json()).then(setWallet);
    fetch("/api/history")
      .then((r) => r.json())
      .then((d) => {
        setTransactions(d.transactions ?? []);
        setGames(d.games ?? []);
      });
  }, []);

  return (
    <div className="min-h-screen bg-felt-dark">
      <Navbar username={wallet.username} role={wallet.role} pocket={wallet.pocket} />

      <main className="max-w-2xl mx-auto px-6 py-10">
        <h1 className="text-2xl font-bold text-white mb-6">History</h1>

        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setTab("transactions")}
            className={`px-4 py-2 rounded text-sm font-semibold ${tab === "transactions" ? "bg-yellow-500 text-black" : "bg-black/40 text-gray-400 hover:text-white"}`}
          >
            Transactions
          </button>
          <button
            onClick={() => setTab("games")}
            className={`px-4 py-2 rounded text-sm font-semibold ${tab === "games" ? "bg-yellow-500 text-black" : "bg-black/40 text-gray-400 hover:text-white"}`}
          >
            Game Results
          </button>
        </div>

        {tab === "transactions" && (
          <div className="space-y-2">
            {transactions.length === 0 && <div className="text-gray-500 text-sm">No transactions yet.</div>}
            {transactions.map((t) => (
              <div key={t.id} className="bg-black/40 border border-gray-700/40 rounded-lg px-4 py-3 flex items-center justify-between">
                <div>
                  <div className="text-sm text-white">{TX_LABELS[t.type] ?? t.type}</div>
                  {t.note && <div className="text-xs text-gray-500">{t.note}</div>}
                  <div className="text-xs text-gray-600">{new Date(t.createdAt).toLocaleString()}</div>
                </div>
                <div className={`font-semibold text-sm ${
                  ["BET_WIN", "BET_PUSH", "ADMIN_SEND", "CASH_GENERATION"].includes(t.type) ? "text-green-400" : "text-red-400"
                }`}>
                  {fmt(t.amount)}
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === "games" && (
          <div className="space-y-2">
            {games.length === 0 && <div className="text-gray-500 text-sm">No games played yet.</div>}
            {games.map((g) => (
              <div key={g.id} className="bg-black/40 border border-gray-700/40 rounded-lg px-4 py-3 flex items-center justify-between">
                <div>
                  <div className="text-sm text-white">{g.tableName} Table</div>
                  <div className="text-xs text-gray-500">Bet: {fmt(g.betAmount)}</div>
                  <div className="text-xs text-gray-600">{new Date(g.createdAt).toLocaleString()}</div>
                </div>
                <div className={`font-bold text-sm ${OUTCOME_COLORS[g.outcome] ?? "text-white"}`}>
                  {g.outcome}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
