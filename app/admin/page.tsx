"use client";
import { useState, useEffect, useCallback } from "react";
import Navbar from "@/components/Navbar";
import Link from "next/link";

function fmt(n: number) {
  if (n >= 1_000_000) return "$" + (n / 1_000_000).toFixed(2) + "M";
  if (n >= 1_000) return "$" + (n / 1_000).toFixed(0) + "K";
  return "$" + n.toLocaleString();
}

interface TableData {
  id: number;
  name: string;
  minBet: number;
  maxBet: number;
  balance: number;
  isOpen: boolean;
}

export default function AdminPage() {
  const [wallet, setWallet] = useState({ pocket: 0, bank: 0, username: "", role: "" });
  const [tables, setTables] = useState<TableData[]>([]);
  const [sendForm, setSendForm] = useState({ targetUsername: "", amount: "", destination: "pocket" });
  const [fundForm, setFundForm] = useState<{ tableId: number | null; amount: string }>({ tableId: null, amount: "" });
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const loadData = useCallback(async () => {
    const [w, t] = await Promise.all([
      fetch("/api/wallet").then((r) => r.json()),
      fetch("/api/tables").then((r) => r.json()),
    ]);
    setWallet(w);
    setTables(t);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  async function generateCash() {
    setMsg(""); setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/wallet/generate", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setWallet((w) => ({ ...w, pocket: data.pocket }));
      setMsg(`Generated $20M! New pocket: ${fmt(data.pocket)}`);
    } catch (e: unknown) { setError((e as Error).message); }
    finally { setLoading(false); }
  }

  async function sendMoney(e: React.FormEvent) {
    e.preventDefault();
    setMsg(""); setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/admin/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...sendForm, amount: Number(sendForm.amount) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setWallet((w) => ({ ...w, pocket: data.adminPocket }));
      setMsg(`Sent ${fmt(Number(sendForm.amount))} to ${sendForm.targetUsername}`);
      setSendForm({ targetUsername: "", amount: "", destination: "pocket" });
    } catch (e: unknown) { setError((e as Error).message); }
    finally { setLoading(false); }
  }

  async function fundTable(e: React.FormEvent) {
    e.preventDefault();
    if (!fundForm.tableId) return;
    setMsg(""); setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/admin/table/fund", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tableId: fundForm.tableId, amount: Number(fundForm.amount) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setTables((prev) =>
        prev.map((t) => t.id === fundForm.tableId ? { ...t, balance: data.table.balance, isOpen: data.table.isOpen } : t)
      );
      setWallet((w) => ({ ...w, pocket: w.pocket - Number(fundForm.amount) }));
      setMsg(`Table ${fundForm.tableId} funded and reopened`);
      setFundForm({ tableId: null, amount: "" });
    } catch (e: unknown) { setError((e as Error).message); }
    finally { setLoading(false); }
  }

  return (
    <div className="min-h-screen bg-felt-dark">
      <Navbar username={wallet.username} role={wallet.role} pocket={wallet.pocket} />

      <main className="max-w-3xl mx-auto px-6 py-10 space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-white">Admin Panel</h1>
          <Link href="/admin/users" className="text-sm text-yellow-400 hover:underline">
            View All Users →
          </Link>
        </div>

        {msg && <div className="bg-green-900/40 border border-green-500/40 text-green-300 text-sm p-3 rounded">{msg}</div>}
        {error && <div className="bg-red-900/40 border border-red-500/40 text-red-300 text-sm p-3 rounded">{error}</div>}

        {/* Wallet overview */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-black/40 border border-green-600/30 rounded-xl p-5 text-center">
            <div className="text-gray-400 text-sm mb-1">Pocket</div>
            <div className="text-2xl font-bold text-green-400">{fmt(wallet.pocket)}</div>
          </div>
          <div className="bg-black/40 border border-blue-600/30 rounded-xl p-5 text-center">
            <div className="text-gray-400 text-sm mb-1">Bank</div>
            <div className="text-2xl font-bold text-blue-400">{fmt(wallet.bank)}</div>
          </div>
        </div>

        {/* Generate cash */}
        <div className="bg-black/40 border border-yellow-600/30 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-3">Generate Cash</h2>
          <p className="text-gray-400 text-sm mb-4">Add $20,000,000 to your pocket.</p>
          <button
            onClick={generateCash}
            disabled={loading}
            className="bg-yellow-500 hover:bg-yellow-400 text-black font-bold px-6 py-2 rounded disabled:opacity-50"
          >
            Generate $20M
          </button>
        </div>

        {/* Send money to user */}
        <form onSubmit={sendMoney} className="bg-black/40 border border-yellow-600/30 rounded-xl p-6 space-y-4">
          <h2 className="text-lg font-semibold text-white">Send Money to User</h2>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Username</label>
            <input
              type="text"
              value={sendForm.targetUsername}
              onChange={(e) => setSendForm({ ...sendForm, targetUsername: e.target.value })}
              required
              className="w-full bg-gray-900 border border-gray-700 text-white px-4 py-2 rounded focus:outline-none focus:border-yellow-500"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Amount (USD)</label>
              <input
                type="number"
                value={sendForm.amount}
                onChange={(e) => setSendForm({ ...sendForm, amount: e.target.value })}
                required
                min={1}
                className="w-full bg-gray-900 border border-gray-700 text-white px-4 py-2 rounded focus:outline-none focus:border-yellow-500"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Destination</label>
              <select
                value={sendForm.destination}
                onChange={(e) => setSendForm({ ...sendForm, destination: e.target.value })}
                className="w-full bg-gray-900 border border-gray-700 text-white px-4 py-2 rounded focus:outline-none focus:border-yellow-500"
              >
                <option value="pocket">Pocket</option>
                <option value="bank">Bank</option>
              </select>
            </div>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="bg-yellow-500 hover:bg-yellow-400 text-black font-bold px-6 py-2 rounded disabled:opacity-50"
          >
            Send Money
          </button>
        </form>

        {/* Table management */}
        <div className="bg-black/40 border border-yellow-600/30 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Table Management</h2>

          <div className="space-y-3 mb-6">
            {tables.map((t) => (
              <div key={t.id} className="flex items-center justify-between bg-black/40 rounded-lg px-4 py-3">
                <div>
                  <div className="text-white font-medium text-sm">{t.name} Table</div>
                  <div className="text-xs text-gray-500">Balance: <span className={t.balance < t.minBet * 10 ? "text-red-400" : "text-green-400"}>{fmt(t.balance)}</span></div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded ${t.isOpen ? "bg-green-900/60 text-green-400" : "bg-red-900/60 text-red-400"}`}>
                    {t.isOpen ? "OPEN" : "CLOSED"}
                  </span>
                  <button
                    onClick={() => setFundForm({ tableId: t.id, amount: "" })}
                    className="text-xs text-yellow-400 hover:text-yellow-300 border border-yellow-600/40 px-2 py-1 rounded"
                  >
                    Fund
                  </button>
                </div>
              </div>
            ))}
          </div>

          {fundForm.tableId && (
            <form onSubmit={fundTable} className="border border-yellow-600/30 rounded-lg p-4 space-y-3">
              <h3 className="text-sm font-semibold text-white">
                Fund Table {fundForm.tableId} — {tables.find((t) => t.id === fundForm.tableId)?.name}
              </h3>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Amount (from your pocket)</label>
                <input
                  type="number"
                  value={fundForm.amount}
                  onChange={(e) => setFundForm({ ...fundForm, amount: e.target.value })}
                  required
                  min={1}
                  className="w-full bg-gray-900 border border-gray-700 text-white px-4 py-2 rounded text-sm focus:outline-none focus:border-yellow-500"
                />
              </div>
              <div className="flex gap-2">
                <button type="submit" disabled={loading} className="bg-yellow-500 hover:bg-yellow-400 text-black text-sm font-bold px-4 py-1.5 rounded disabled:opacity-50">
                  Fund & Reopen
                </button>
                <button type="button" onClick={() => setFundForm({ tableId: null, amount: "" })} className="text-gray-400 hover:text-white text-sm px-4 py-1.5">
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}
