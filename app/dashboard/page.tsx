"use client";
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import Navbar from "@/components/Navbar";

function fmt(n: number) {
  return "$" + n.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

export default function DashboardPage() {
  const { data: session } = useSession();
  const [wallet, setWallet] = useState({ pocket: 0, bank: 0, username: "", role: "" });
  const [direction, setDirection] = useState<"toBank" | "toPocket">("toBank");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/wallet")
      .then((r) => r.json())
      .then(setWallet);
  }, []);

  async function handleTransfer(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");
    setError("");
    const amt = Number(amount);
    if (isNaN(amt) || amt <= 0) {
      setError("Enter a valid amount");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/wallet/transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ direction, amount: amt }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setWallet((w) => ({ ...w, pocket: data.pocket, bank: data.bank }));
      setMsg("Transfer successful");
      setAmount("");
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-felt-dark">
      <Navbar username={wallet.username || session?.user?.name || ""} role={wallet.role} pocket={wallet.pocket} />

      <main className="max-w-xl mx-auto px-6 py-10">
        <h1 className="text-2xl font-bold text-white mb-8">My Wallet</h1>

        <div className="grid grid-cols-2 gap-4 mb-10">
          <div className="bg-black/40 border border-green-600/30 rounded-xl p-6 text-center">
            <div className="text-gray-400 text-sm mb-1">Pocket</div>
            <div className="text-2xl font-bold text-green-400">{fmt(wallet.pocket)}</div>
            <div className="text-xs text-gray-500 mt-1">Available to gamble</div>
          </div>
          <div className="bg-black/40 border border-blue-600/30 rounded-xl p-6 text-center">
            <div className="text-gray-400 text-sm mb-1">Bank</div>
            <div className="text-2xl font-bold text-blue-400">{fmt(wallet.bank)}</div>
            <div className="text-xs text-gray-500 mt-1">Safe storage</div>
          </div>
        </div>

        <form onSubmit={handleTransfer} className="bg-black/40 border border-yellow-600/30 rounded-xl p-6 space-y-5">
          <h2 className="text-lg font-semibold text-white">Transfer Funds</h2>

          {msg && <div className="bg-green-900/40 border border-green-500/40 text-green-300 text-sm p-3 rounded">{msg}</div>}
          {error && <div className="bg-red-900/40 border border-red-500/40 text-red-300 text-sm p-3 rounded">{error}</div>}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setDirection("toBank")}
              className={`flex-1 py-2 rounded font-semibold text-sm border ${
                direction === "toBank"
                  ? "bg-yellow-500 text-black border-yellow-500"
                  : "bg-transparent text-gray-400 border-gray-600 hover:border-gray-500"
              }`}
            >
              Pocket → Bank
            </button>
            <button
              type="button"
              onClick={() => setDirection("toPocket")}
              className={`flex-1 py-2 rounded font-semibold text-sm border ${
                direction === "toPocket"
                  ? "bg-yellow-500 text-black border-yellow-500"
                  : "bg-transparent text-gray-400 border-gray-600 hover:border-gray-500"
              }`}
            >
              Bank → Pocket
            </button>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Amount (USD)</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              min={1}
              step={1000}
              required
              placeholder="Enter amount"
              className="w-full bg-gray-900 border border-gray-700 text-white px-4 py-2 rounded focus:outline-none focus:border-yellow-500"
            />
            <div className="text-xs text-gray-500 mt-1">
              Available: {direction === "toBank" ? fmt(wallet.pocket) + " (pocket)" : fmt(wallet.bank) + " (bank)"}
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-bold py-2 rounded disabled:opacity-50"
          >
            {loading ? "Processing..." : "Transfer"}
          </button>
        </form>
      </main>
    </div>
  );
}
