"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import PlayingCard from "@/components/PlayingCard";
import { Card, handValue } from "@/lib/blackjack";

interface Props {
  tableId: number;
  tableName: string;
  minBet: number;
  maxBet: number;
  initialPocket: number;
}

type GameStatus = "BETTING" | "IN_PROGRESS" | "COMPLETED";
type Outcome = "WIN" | "LOSS" | "PUSH" | "BLACKJACK" | null;

function fmt(n: number) {
  if (n >= 1_000_000) return "$" + (n / 1_000_000).toFixed(2) + "M";
  if (n >= 1_000) return "$" + (n / 1_000).toFixed(0) + "K";
  return "$" + n.toLocaleString();
}

export default function TableClient({ tableId, tableName, minBet, maxBet, initialPocket }: Props) {
  const router = useRouter();
  const [pocket, setPocket] = useState(initialPocket);
  const [betInput, setBetInput] = useState(String(minBet));
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [playerHand, setPlayerHand] = useState<Card[]>([]);
  const [dealerHand, setDealerHand] = useState<(Card | null)[]>([]);
  const [status, setStatus] = useState<GameStatus>("BETTING");
  const [outcome, setOutcome] = useState<Outcome>(null);
  const [payout, setPayout] = useState(0);
  const [bet, setBet] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function apiCall(path: string, body: object) {
    const res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Request failed");
    return data;
  }

  async function startGame() {
    setError("");
    const betAmt = Number(betInput);
    if (isNaN(betAmt) || betAmt < minBet || betAmt > maxBet) {
      setError(`Bet must be between ${fmt(minBet)} and ${fmt(maxBet)}`);
      return;
    }
    if (betAmt > pocket) {
      setError("Insufficient pocket balance");
      return;
    }
    setLoading(true);
    try {
      const data = await apiCall("/api/game/start", { tableId, betAmount: betAmt });
      setBet(data.status === "COMPLETED" ? betAmt : betAmt);
      setSessionId(data.sessionId);
      setPlayerHand(data.playerHand);
      setDealerHand(data.dealerHand);
      setPocket(data.pocket);
      if (data.status === "COMPLETED") {
        setOutcome(data.outcome);
        setPayout(data.payout ?? 0);
        setStatus("COMPLETED");
      } else {
        setStatus("IN_PROGRESS");
      }
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function hit() {
    if (!sessionId) return;
    setLoading(true);
    try {
      const data = await apiCall("/api/game/hit", { sessionId });
      setPlayerHand(data.playerHand);
      if (data.status === "COMPLETED") {
        setDealerHand(data.dealerHand);
        setOutcome(data.outcome);
        setPayout(data.payout ?? 0);
        setPocket(data.pocket);
        setStatus("COMPLETED");
      }
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function stand() {
    if (!sessionId) return;
    setLoading(true);
    try {
      const data = await apiCall("/api/game/stand", { sessionId });
      setPlayerHand(data.playerHand);
      setDealerHand(data.dealerHand);
      setOutcome(data.outcome);
      setPayout(data.payout ?? 0);
      setPocket(data.pocket);
      setStatus("COMPLETED");
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function doDouble() {
    if (!sessionId) return;
    setLoading(true);
    try {
      const data = await apiCall("/api/game/double", { sessionId });
      setPlayerHand(data.playerHand);
      setDealerHand(data.dealerHand);
      setOutcome(data.outcome);
      setPayout(data.payout ?? 0);
      setPocket(data.pocket);
      setBet(data.totalBet);
      setStatus("COMPLETED");
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  function playAgain() {
    setStatus("BETTING");
    setOutcome(null);
    setPayout(0);
    setSessionId(null);
    setPlayerHand([]);
    setDealerHand([]);
    setError("");
  }

  const outcomeColors: Record<string, string> = {
    WIN: "text-green-400",
    BLACKJACK: "text-yellow-400",
    LOSS: "text-red-400",
    PUSH: "text-blue-400",
  };

  const outcomeMessages: Record<string, string> = {
    WIN: "You Win!",
    BLACKJACK: "Blackjack!",
    LOSS: "You Lose",
    PUSH: "Push — Bet Returned",
  };

  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">{tableName} Table</h1>
          <p className="text-gray-400 text-sm">Min {fmt(minBet)} · Max {fmt(maxBet)}</p>
        </div>
        <div className="text-right">
          <div className="text-xs text-gray-400">Your Pocket</div>
          <div className="text-xl font-bold text-green-400">{fmt(pocket)}</div>
        </div>
      </div>

      {/* Dealer hand */}
      <div className="bg-felt-green/60 rounded-xl p-6 mb-4 min-h-[140px]">
        <div className="text-xs text-gray-300 mb-3 uppercase tracking-wider">
          Dealer{" "}
          {status === "COMPLETED" && dealerHand.every(Boolean) && (
            <span className="text-yellow-300">— {handValue(dealerHand as Card[])}</span>
          )}
        </div>
        <div className="flex gap-2 flex-wrap">
          {dealerHand.length === 0 && <div className="text-gray-500 text-sm italic">Waiting...</div>}
          {dealerHand.map((card, i) => (
            <PlayingCard key={i} card={card} faceDown={card === null} />
          ))}
        </div>
      </div>

      {/* Player hand */}
      <div className="bg-felt-green/60 rounded-xl p-6 mb-6 min-h-[140px]">
        <div className="text-xs text-gray-300 mb-3 uppercase tracking-wider">
          You{" "}
          {playerHand.length > 0 && (
            <span className="text-yellow-300">— {handValue(playerHand)}</span>
          )}
        </div>
        <div className="flex gap-2 flex-wrap">
          {playerHand.length === 0 && <div className="text-gray-500 text-sm italic">Waiting...</div>}
          {playerHand.map((card, i) => (
            <PlayingCard key={i} card={card} />
          ))}
        </div>
      </div>

      {/* Outcome banner */}
      {status === "COMPLETED" && outcome && (
        <div className={`text-center py-4 mb-6 rounded-xl bg-black/50 border ${
          outcome === "LOSS" ? "border-red-500/40" : "border-yellow-500/40"
        }`}>
          <div className={`text-3xl font-bold ${outcomeColors[outcome]}`}>
            {outcomeMessages[outcome]}
          </div>
          {payout > 0 && (
            <div className="text-green-300 text-sm mt-1">+{fmt(payout)} profit</div>
          )}
          {outcome === "LOSS" && (
            <div className="text-red-300 text-sm mt-1">-{fmt(bet)} lost</div>
          )}
        </div>
      )}

      {error && (
        <div className="bg-red-900/40 border border-red-500/40 text-red-300 text-sm p-3 rounded mb-4">
          {error}
        </div>
      )}

      {/* Controls */}
      {status === "BETTING" && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Bet Amount</label>
            <div className="flex gap-2">
              <input
                type="number"
                value={betInput}
                onChange={(e) => setBetInput(e.target.value)}
                min={minBet}
                max={Math.min(maxBet, pocket)}
                step={minBet}
                className="flex-1 bg-gray-900 border border-gray-700 text-white px-4 py-2 rounded focus:outline-none focus:border-yellow-500"
              />
            </div>
            <div className="flex gap-2 mt-2">
              {[minBet, minBet * 2, minBet * 5, maxBet].filter((v, i, a) => a.indexOf(v) === i).map((v) => (
                <button
                  key={v}
                  onClick={() => setBetInput(String(Math.min(v, pocket)))}
                  className="text-xs px-2 py-1 rounded bg-gray-800 hover:bg-gray-700 text-gray-300"
                >
                  {fmt(v)}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={startGame}
              disabled={loading}
              className="flex-1 bg-yellow-500 hover:bg-yellow-400 text-black font-bold py-3 rounded-lg disabled:opacity-50"
            >
              {loading ? "Dealing..." : "Deal"}
            </button>
            <button
              onClick={() => router.push("/lobby")}
              className="px-6 py-3 border border-gray-600 text-gray-300 hover:text-white rounded-lg"
            >
              Leave
            </button>
          </div>
        </div>
      )}

      {status === "IN_PROGRESS" && (
        <div className="flex gap-3">
          <button
            onClick={hit}
            disabled={loading}
            className="flex-1 bg-green-600 hover:bg-green-500 text-white font-bold py-3 rounded-lg disabled:opacity-50"
          >
            Hit
          </button>
          <button
            onClick={stand}
            disabled={loading}
            className="flex-1 bg-red-700 hover:bg-red-600 text-white font-bold py-3 rounded-lg disabled:opacity-50"
          >
            Stand
          </button>
          {playerHand.length === 2 && pocket >= bet && (
            <button
              onClick={doDouble}
              disabled={loading}
              className="flex-1 bg-purple-700 hover:bg-purple-600 text-white font-bold py-3 rounded-lg disabled:opacity-50"
            >
              Double
            </button>
          )}
        </div>
      )}

      {status === "COMPLETED" && (
        <div className="flex gap-3">
          <button
            onClick={playAgain}
            className="flex-1 bg-yellow-500 hover:bg-yellow-400 text-black font-bold py-3 rounded-lg"
          >
            Play Again
          </button>
          <button
            onClick={() => router.push("/lobby")}
            className="px-6 py-3 border border-gray-600 text-gray-300 hover:text-white rounded-lg"
          >
            Leave Table
          </button>
        </div>
      )}
    </div>
  );
}
