"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { RED_NUMBERS, BLACK_NUMBERS, type BetType, type RouletteBet, BET_LABELS } from "@/lib/roulette";

interface Props {
  tableId: number;
  tableName: string;
  minBetNumber: number;
  minBetOutside: number;
  maxBet: number;
  tableBalance: number;
  initialPocket: number;
}

function fmt(n: number) {
  if (n >= 1_000_000) return "$" + (n / 1_000_000).toFixed(2) + "M";
  if (n >= 1_000) return "$" + (n / 1_000).toFixed(0) + "K";
  return "$" + n.toLocaleString();
}

function numColor(n: number) {
  if (n === 0) return "bg-green-600 text-white";
  if (RED_NUMBERS.has(n)) return "bg-red-600 text-white";
  return "bg-gray-900 text-white";
}

export default function RouletteClient({ tableId, tableName, minBetNumber, minBetOutside, maxBet, tableBalance, initialPocket }: Props) {
  const router = useRouter();
  const [pocket, setPocket] = useState(initialPocket);
  const [tblBalance, setTblBalance] = useState(tableBalance);
  const [bets, setBets] = useState<RouletteBet[]>([]);
  const [betAmount, setBetAmount] = useState(String(minBetOutside));
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<number | null>(null);
  const [profit, setProfit] = useState<number | null>(null);
  const [totalPayout, setTotalPayout] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [spinResult, setSpinResult] = useState<{ result: number; profit: number; totalPayout: number; totalBet: number } | null>(null);

  function addBet(type: BetType, target?: number) {
    const amt = Number(betAmount);
    const isNumber = type === "straight";
    const min = isNumber ? minBetNumber : minBetOutside;
    if (isNaN(amt) || amt < min) { setError(`Min bet for this: ${fmt(min)}`); return; }
    if (amt > maxBet) { setError(`Max bet: ${fmt(maxBet)}`); return; }
    setError("");
    setBets((prev) => {
      const existing = prev.find((b) => b.type === type && b.target === target);
      if (existing) {
        return prev.map((b) => b.type === type && b.target === target ? { ...b, amount: b.amount + amt } : b);
      }
      return [...prev, { type, target, amount: amt }];
    });
  }

  function removeBet(type: BetType, target?: number) {
    setBets((prev) => prev.filter((b) => !(b.type === type && b.target === target)));
  }

  function clearBets() { setBets([]); setSpinResult(null); setError(""); }

  const totalBetAmt = bets.reduce((s, b) => s + b.amount, 0);

  async function spin() {
    setError("");
    if (bets.length === 0) { setError("Place at least one bet"); return; }
    if (totalBetAmt > pocket) { setError("Insufficient pocket balance"); return; }
    setSpinning(true);
    setSpinResult(null);
    try {
      const res = await fetch("/api/roulette/spin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tableId, bets }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Spin failed");
      setPocket(data.pocket);
      setTblBalance(data.tableBalance);
      setResult(data.result);
      setProfit(data.profit);
      setTotalPayout(data.totalPayout);
      setSpinResult(data);
      if (!data.tableIsOpen) {
        setTimeout(() => router.push("/lobby"), 3000);
      }
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setSpinning(false);
    }
  }

  const OUTSIDE_BETS: { type: BetType; label: string }[] = [
    { type: "red", label: "🔴 Red" },
    { type: "black", label: "⚫ Black" },
    { type: "odd", label: "Odd" },
    { type: "even", label: "Even" },
    { type: "low", label: "Low 1–18" },
    { type: "high", label: "High 19–36" },
    { type: "dozen1", label: "1st Dozen" },
    { type: "dozen2", label: "2nd Dozen" },
    { type: "dozen3", label: "3rd Dozen" },
    { type: "col1", label: "Column 1" },
    { type: "col2", label: "Column 2" },
    { type: "col3", label: "Column 3" },
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">{tableName}</h1>
          <p className="text-gray-400 text-sm">
            Numbers: min {fmt(minBetNumber)} · Outside: min {fmt(minBetOutside)} · Max {fmt(maxBet)}
          </p>
        </div>
        <div className="text-right">
          <div className="text-xs text-gray-400">Pocket</div>
          <div className="text-xl font-bold text-green-400">{fmt(pocket)}</div>
          <div className="text-xs text-gray-500">House: {fmt(tblBalance)}</div>
        </div>
      </div>

      {/* Spin result banner */}
      {spinResult !== null && (
        <div className={`rounded-xl p-4 mb-6 text-center border ${spinResult.profit >= 0 ? "bg-green-900/30 border-green-500/40" : "bg-red-900/30 border-red-500/40"}`}>
          <div className="text-lg text-gray-300 mb-1">
            Ball landed on <span className={`font-bold text-2xl ${spinResult.result === 0 ? "text-green-400" : RED_NUMBERS.has(spinResult.result) ? "text-red-400" : "text-white"}`}>{spinResult.result}</span>
          </div>
          {spinResult.profit > 0 && <div className="text-green-400 font-bold text-xl">+{fmt(spinResult.profit)} profit!</div>}
          {spinResult.profit < 0 && <div className="text-red-400 font-bold text-xl">{fmt(spinResult.profit)} lost</div>}
          {spinResult.profit === 0 && <div className="text-blue-400 font-bold text-xl">Break even</div>}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Betting board */}
        <div className="lg:col-span-2 space-y-4">
          {/* Bet amount input */}
          <div className="bg-black/40 border border-gray-700/40 rounded-xl p-4">
            <label className="block text-sm text-gray-400 mb-2">Chip Value</label>
            <div className="flex gap-2 flex-wrap">
              {[minBetOutside, minBetOutside * 2, minBetNumber, minBetNumber * 2, maxBet].filter((v, i, a) => a.indexOf(v) === i && v <= pocket).map((v) => (
                <button key={v} onClick={() => setBetAmount(String(v))}
                  className={`text-xs px-3 py-1.5 rounded font-semibold ${Number(betAmount) === v ? "bg-yellow-500 text-black" : "bg-gray-800 hover:bg-gray-700 text-gray-300"}`}>
                  {fmt(v)}
                </button>
              ))}
              <input type="number" value={betAmount} onChange={(e) => setBetAmount(e.target.value)}
                className="w-32 bg-gray-900 border border-gray-700 text-white px-3 py-1.5 rounded text-sm focus:outline-none focus:border-yellow-500" />
            </div>
          </div>

          {/* Number grid */}
          <div className="bg-black/40 border border-gray-700/40 rounded-xl p-4">
            <div className="text-xs text-gray-400 mb-3">Straight Up — min {fmt(minBetNumber)} per number · pays 35:1</div>
            <div className="grid grid-cols-13 gap-1" style={{ gridTemplateColumns: "repeat(13, 1fr)" }}>
              {/* Zero */}
              <button onClick={() => addBet("straight", 0)}
                className="col-span-1 row-span-1 bg-green-600 hover:bg-green-500 text-white text-xs font-bold py-3 rounded flex items-center justify-center border-2 border-transparent hover:border-yellow-400 transition-colors relative">
                0
                {bets.find((b) => b.type === "straight" && b.target === 0) && (
                  <span className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-400 rounded-full" />
                )}
              </button>
              {Array.from({ length: 36 }, (_, i) => i + 1).map((n) => (
                <button key={n} onClick={() => addBet("straight", n)}
                  className={`${numColor(n)} text-xs font-bold py-3 rounded flex items-center justify-center border-2 border-transparent hover:border-yellow-400 transition-colors relative`}>
                  {n}
                  {bets.find((b) => b.type === "straight" && b.target === n) && (
                    <span className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-400 rounded-full" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Outside bets */}
          <div className="bg-black/40 border border-gray-700/40 rounded-xl p-4">
            <div className="text-xs text-gray-400 mb-3">Outside Bets — min {fmt(minBetOutside)}</div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {OUTSIDE_BETS.map(({ type, label }) => {
                const hasBet = bets.find((b) => b.type === type);
                const paysLabel = ["dozen1","dozen2","dozen3","col1","col2","col3"].includes(type) ? "2:1" : "1:1";
                return (
                  <button key={type} onClick={() => addBet(type)}
                    className={`py-2 px-3 rounded text-sm font-semibold border transition-colors ${hasBet ? "bg-yellow-500/20 border-yellow-500 text-yellow-300" : "bg-gray-800/60 border-gray-700 text-gray-300 hover:border-gray-500"}`}>
                    {label}
                    <span className="block text-xs font-normal text-gray-500">{paysLabel}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right: Bet slip + controls */}
        <div className="space-y-4">
          <div className="bg-black/40 border border-yellow-600/30 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-white">Bet Slip</h3>
              {bets.length > 0 && (
                <button onClick={clearBets} className="text-xs text-gray-400 hover:text-red-400">Clear all</button>
              )}
            </div>

            {bets.length === 0 && (
              <div className="text-gray-500 text-xs text-center py-4">No bets placed yet</div>
            )}

            <div className="space-y-1.5 max-h-64 overflow-y-auto">
              {bets.map((b) => (
                <div key={`${b.type}-${b.target}`} className="flex items-center justify-between bg-gray-900/60 rounded px-2 py-1.5">
                  <div className="text-xs text-gray-300">
                    {b.type === "straight" ? `#${b.target}` : BET_LABELS[b.type]}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-yellow-400 font-semibold">{fmt(b.amount)}</span>
                    <button onClick={() => removeBet(b.type, b.target)} className="text-gray-600 hover:text-red-400 text-xs">✕</button>
                  </div>
                </div>
              ))}
            </div>

            {bets.length > 0 && (
              <div className="mt-3 pt-3 border-t border-gray-700 flex justify-between text-sm">
                <span className="text-gray-400">Total</span>
                <span className={`font-bold ${totalBetAmt > pocket ? "text-red-400" : "text-white"}`}>{fmt(totalBetAmt)}</span>
              </div>
            )}
          </div>

          {error && (
            <div className="bg-red-900/40 border border-red-500/40 text-red-300 text-sm p-3 rounded">{error}</div>
          )}

          <button onClick={spin} disabled={spinning || bets.length === 0 || totalBetAmt > pocket}
            className="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-4 rounded-xl text-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
            {spinning ? (
              <span className="animate-pulse">Spinning...</span>
            ) : (
              "🎰 Spin"
            )}
          </button>

          <button onClick={() => router.push("/lobby")}
            className="w-full py-2 border border-gray-600 text-gray-400 hover:text-white rounded-lg text-sm">
            Leave Table
          </button>
        </div>
      </div>
    </div>
  );
}
