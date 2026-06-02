"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import PlayingCard from "@/components/PlayingCard";
import type { Card } from "@/lib/blackjack";

interface GameState {
  phase: string;
  status: string;
  pot: number;
  communityCards: Card[];
  currentBet: number;
  activeSeat: number;
  yourChips: number;
  npcChips: number;
  yourHand: Card[] | null;
  yourSeat: number;
  dealerSeat: number;
  handNumber: number;
  yourRoundBet: number;
  npcBudget: number;
  npcIsActive: boolean;
}

interface HandResult {
  winners: Record<number, number>;
  handLabels: Record<number, string>;
  showdown: boolean;
  npcHand: string | null;
  yourHand: Card[] | null;
}

function fmt(n: number) {
  if (n >= 1_000_000) return "$" + (n / 1_000_000).toFixed(2) + "M";
  if (n >= 1_000) return "$" + (n / 1_000).toFixed(0) + "K";
  return "$" + n.toLocaleString();
}

export default function NpcPokerClient({ sessionId, initialState, smallBlind, bigBlind, pocket: initPocket }: {
  sessionId: string;
  initialState: GameState;
  smallBlind: number;
  bigBlind: number;
  pocket: number;
}) {
  const router = useRouter();
  const [state, setState] = useState(initialState);
  const [pocket, setPocket] = useState(initPocket);
  const [raiseAmount, setRaiseAmount] = useState(String(bigBlind * 2));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [handResult, setHandResult] = useState<HandResult | null>(null);
  const [npcRevealedHand, setNpcRevealedHand] = useState<Card[] | null>(null);

  const isYourTurn = state.activeSeat === state.yourSeat && state.status === "ACTIVE" && state.phase !== "SHOWDOWN";
  const toCall = Math.max(0, state.currentBet - state.yourRoundBet);
  const canCheck = toCall === 0;

  async function sendAction(action: string, amount?: number) {
    setError("");
    setLoading(true);
    setHandResult(null);
    setNpcRevealedHand(null);
    try {
      const res = await fetch("/api/poker/npc/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, action, amount }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setState((prev) => ({
        ...prev,
        phase: data.phase,
        status: data.status,
        pot: data.pot,
        communityCards: data.communityCards,
        currentBet: data.currentBet,
        activeSeat: data.activeSeat,
        yourChips: data.yourChips,
        npcChips: data.npcChips,
        yourHand: data.yourHand ?? prev.yourHand,
        yourRoundBet: data.yourRoundBet,
      }));

      if (data.handResult) {
        setHandResult(data.handResult);
        if (data.handResult.showdown && data.handResult.npcHand) {
          setNpcRevealedHand(JSON.parse(data.handResult.npcHand));
        }
      }
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function dealNextHand() {
    setError("");
    setLoading(true);
    setHandResult(null);
    setNpcRevealedHand(null);
    try {
      const res = await fetch("/api/poker/npc/deal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.status === "COMPLETED") { router.push("/lobby"); return; }
        throw new Error(data.error);
      }
      setState((prev) => ({
        ...prev,
        phase: data.phase,
        status: "ACTIVE",
        pot: data.pot,
        communityCards: [],
        currentBet: data.currentBet,
        activeSeat: data.activeSeat,
        yourChips: data.yourChips,
        npcChips: data.npcChips,
        yourHand: data.yourHand,
        dealerSeat: data.dealerSeat,
        handNumber: data.handNumber,
        yourRoundBet: data.yourRoundBet,
      }));
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function cashOut() {
    setLoading(true);
    try {
      const res = await fetch("/api/poker/npc/cashout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setPocket(data.pocket);
      router.push("/lobby");
    } catch (e: unknown) {
      setError((e as Error).message);
      setLoading(false);
    }
  }

  const yourWon = handResult?.winners[state.yourSeat] ?? 0;
  const npcWon = handResult?.winners[state.yourSeat === 0 ? 1 : 0] ?? 0;
  const isHandOver = state.status === "BETWEEN_HANDS" || state.status === "COMPLETED";

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <div>
          <div className="text-white font-bold">NPC Poker — Hand #{state.handNumber}</div>
          <div className="text-xs text-gray-400">Blinds {fmt(smallBlind)}/{fmt(bigBlind)} · {state.dealerSeat === state.yourSeat ? "You deal" : "NPC deals"}</div>
        </div>
        <div className="text-right">
          <div className="text-xs text-gray-400">Pocket</div>
          <div className="text-green-400 font-bold">{fmt(pocket)}</div>
        </div>
      </div>

      {/* NPC side */}
      <div className="bg-gray-900/60 border border-gray-700/40 rounded-xl p-4 mb-3">
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm text-gray-300 font-semibold">🤖 NPC</div>
          <div className="text-sm text-yellow-400 font-bold">{fmt(state.npcChips)}</div>
        </div>
        <div className="flex gap-2">
          {npcRevealedHand
            ? npcRevealedHand.map((c, i) => <PlayingCard key={i} card={c} />)
            : state.phase !== "WAITING" && [0, 1].map((i) => <PlayingCard key={i} card={null} faceDown />)}
        </div>
      </div>

      {/* Community cards */}
      <div className="bg-felt-green/50 border border-green-800/40 rounded-xl p-4 mb-3 min-h-[100px]">
        <div className="text-xs text-gray-400 mb-2 uppercase tracking-wider">
          {state.phase || "Waiting"} · Pot: <span className="text-yellow-300">{fmt(state.pot)}</span>
        </div>
        <div className="flex gap-2 flex-wrap">
          {state.communityCards.length === 0 && <div className="text-gray-600 text-sm italic">No community cards yet</div>}
          {state.communityCards.map((c, i) => <PlayingCard key={i} card={c} />)}
        </div>
      </div>

      {/* Player side */}
      <div className="bg-gray-900/60 border border-yellow-600/30 rounded-xl p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm text-yellow-300 font-semibold">You</div>
          <div className="text-sm text-yellow-400 font-bold">{fmt(state.yourChips)}</div>
        </div>
        <div className="flex gap-2">
          {state.yourHand
            ? state.yourHand.map((c, i) => <PlayingCard key={i} card={c} />)
            : state.phase !== "WAITING" && [0, 1].map((i) => <PlayingCard key={i} card={null} faceDown />)}
        </div>
      </div>

      {/* Hand result banner */}
      {handResult && (
        <div className={`rounded-xl p-4 mb-4 text-center border ${yourWon > 0 ? "bg-green-900/30 border-green-500/40" : "bg-red-900/30 border-red-500/40"}`}>
          {yourWon > 0 && <div className="text-green-400 font-bold text-xl">You Win! +{fmt(yourWon)}</div>}
          {npcWon > 0 && <div className="text-red-400 font-bold text-xl">NPC Wins! -{fmt(state.currentBet > 0 ? state.currentBet : state.pot)}</div>}
          {yourWon === 0 && npcWon === 0 && <div className="text-blue-400 font-bold text-xl">Split Pot</div>}
          {handResult.handLabels[state.yourSeat] && (
            <div className="text-sm text-gray-400 mt-1">Your hand: {handResult.handLabels[state.yourSeat]}</div>
          )}
          {handResult.handLabels[state.yourSeat === 0 ? 1 : 0] && (
            <div className="text-sm text-gray-400">NPC hand: {handResult.handLabels[state.yourSeat === 0 ? 1 : 0]}</div>
          )}
        </div>
      )}

      {error && <div className="bg-red-900/40 border border-red-500/40 text-red-300 text-sm p-3 rounded mb-4">{error}</div>}

      {/* Action buttons */}
      {isYourTurn && !isHandOver && (
        <div className="space-y-3">
          <div className="flex gap-2">
            <button onClick={() => sendAction("FOLD")} disabled={loading}
              className="flex-1 bg-red-700 hover:bg-red-600 text-white font-bold py-3 rounded-lg disabled:opacity-50">Fold</button>
            {canCheck
              ? <button onClick={() => sendAction("CHECK")} disabled={loading}
                  className="flex-1 bg-blue-700 hover:bg-blue-600 text-white font-bold py-3 rounded-lg disabled:opacity-50">Check</button>
              : <button onClick={() => sendAction("CALL", toCall)} disabled={loading}
                  className="flex-1 bg-blue-700 hover:bg-blue-600 text-white font-bold py-3 rounded-lg disabled:opacity-50">Call {fmt(toCall)}</button>}
          </div>
          <div className="flex gap-2">
            <input type="number" value={raiseAmount} onChange={(e) => setRaiseAmount(e.target.value)}
              min={state.currentBet * 2 || bigBlind * 2} max={state.yourChips} step={bigBlind}
              className="flex-1 bg-gray-900 border border-gray-700 text-white px-3 py-2 rounded focus:outline-none focus:border-yellow-500" />
            <button onClick={() => sendAction("RAISE", Number(raiseAmount))} disabled={loading || Number(raiseAmount) < bigBlind}
              className="px-4 py-2 bg-yellow-600 hover:bg-yellow-500 text-black font-bold rounded-lg disabled:opacity-50">Raise</button>
            <button onClick={() => sendAction("ALL_IN", state.yourChips)} disabled={loading}
              className="px-4 py-2 bg-purple-700 hover:bg-purple-600 text-white font-bold rounded-lg disabled:opacity-50">All In</button>
          </div>
        </div>
      )}

      {!isYourTurn && !isHandOver && state.status === "ACTIVE" && (
        <div className="text-center py-4 text-gray-400 animate-pulse">
          {state.activeSeat !== state.yourSeat ? "NPC is thinking..." : "Waiting..."}
        </div>
      )}

      {isHandOver && (
        <div className="flex gap-3">
          <button onClick={dealNextHand} disabled={loading}
            className="flex-1 bg-green-600 hover:bg-green-500 text-white font-bold py-3 rounded-lg disabled:opacity-50">
            {loading ? "Dealing..." : "Next Hand ♠"}
          </button>
          <button onClick={cashOut} disabled={loading || state.status === "ACTIVE"}
            className="px-4 py-3 border border-gray-600 text-gray-300 hover:text-white rounded-lg disabled:opacity-50">
            Cash Out {fmt(state.yourChips)}
          </button>
        </div>
      )}
    </div>
  );
}
