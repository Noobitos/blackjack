"use client";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { POKER_TABLE_CONFIGS } from "@/lib/pokerTables";

function fmt(n: number) {
  if (n >= 1_000_000) return "$" + (n / 1_000_000).toFixed(0) + "M";
  if (n >= 1_000) return "$" + (n / 1_000).toFixed(0) + "K";
  return "$" + n.toLocaleString();
}

function JoinForm() {
  const router = useRouter();
  const params = useSearchParams();
  const tableId = Number(params.get("tableId") ?? "102");
  const cfg = POKER_TABLE_CONFIGS.find((t) => t.id === tableId) ?? POKER_TABLE_CONFIGS.find((t) => t.tableType === "MULTIPLAYER")!;

  const [buyIn, setBuyIn] = useState(String(cfg.minBuyIn));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/poker/multiplayer/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tableId: cfg.id, buyIn: Number(buyIn) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      router.push(`/poker/multiplayer/${data.sessionId}`);
    } catch (e: unknown) {
      setError((e as Error).message);
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-felt-dark flex items-center justify-center">
      <div className="w-full max-w-md">
        <h1 className="text-3xl font-bold text-white text-center mb-2">♠ {cfg.name}</h1>
        <p className="text-gray-400 text-center mb-8">Blinds {fmt(cfg.smallBlind)}/{fmt(cfg.bigBlind)} · Up to {cfg.maxPlayers} players</p>

        <form onSubmit={handleJoin} className="bg-black/50 border border-yellow-600/30 rounded-xl p-8 space-y-5">
          <h2 className="text-lg font-semibold text-white">Choose Your Buy-In</h2>

          {error && <div className="bg-red-900/40 border border-red-500/40 text-red-300 text-sm p-3 rounded">{error}</div>}

          <div>
            <label className="block text-sm text-gray-400 mb-2">Buy-in Amount</label>
            <input type="number" value={buyIn} onChange={(e) => setBuyIn(e.target.value)}
              min={cfg.minBuyIn} max={cfg.maxBuyIn} step={cfg.minBuyIn}
              className="w-full bg-gray-900 border border-gray-700 text-white px-4 py-2 rounded focus:outline-none focus:border-yellow-500" />
            <div className="flex gap-2 mt-2">
              {[cfg.minBuyIn, cfg.minBuyIn * 2, cfg.maxBuyIn].filter((v, i, a) => a.indexOf(v) === i).map((v) => (
                <button key={v} type="button" onClick={() => setBuyIn(String(v))}
                  className={`text-xs px-2 py-1 rounded ${Number(buyIn) === v ? "bg-yellow-500 text-black" : "bg-gray-800 text-gray-400 hover:bg-gray-700"}`}>
                  {fmt(v)}
                </button>
              ))}
            </div>
          </div>

          <button type="submit" disabled={loading}
            className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-bold py-3 rounded-lg disabled:opacity-50">
            {loading ? "Joining..." : "Join Table"}
          </button>
          <button type="button" onClick={() => router.push("/poker")}
            className="w-full py-2 text-gray-400 hover:text-white text-sm">← Back</button>
        </form>
      </div>
    </div>
  );
}

export default function JoinPage() {
  return <Suspense><JoinForm /></Suspense>;
}
