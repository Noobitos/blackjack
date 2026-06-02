"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import PlayingCard from "@/components/PlayingCard";
import type { Card } from "@/lib/blackjack";

interface PlayerInfo {
  seat: number;
  username: string;
  chips: number;
  status: string;
  isAllIn: boolean;
  isYou: boolean;
  roundBet: number;
  hand: Card[] | null;
}

interface GameState {
  status: string;
  phase: string | null;
  handNumber: number;
  dealerSeat: number;
  pot: number;
  communityCards: Card[];
  currentBet: number;
  activeSeat: number | null;
  players: PlayerInfo[];
  mySeat: number;
  myChips: number;
  myRoundBet: number;
  isMyTurn: boolean;
  myHand: Card[] | null;
  pocket: number;
}

function fmt(n: number) {
  if (n >= 1_000_000) return "$" + (n / 1_000_000).toFixed(2) + "M";
  if (n >= 1_000) return "$" + (n / 1_000).toFixed(0) + "K";
  return "$" + n.toLocaleString();
}

export default function MultiPokerClient({ sessionId, tableName, smallBlind, bigBlind, myUserId, initialState }: {
  sessionId: string;
  tableName: string;
  smallBlind: number;
  bigBlind: number;
  myUserId: string;
  initialState: GameState;
}) {
  const router = useRouter();
  const [state, setState] = useState(initialState);
  const [raiseAmount, setRaiseAmount] = useState(String(bigBlind * 2));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [handResult, setHandResult] = useState<{ winners: Record<number, number>; handLabels: Record<number, string>; allHands: { seat: number; hand: Card[] | null }[] | null } | null>(null);
  const [lastUpdated, setLastUpdated] = useState("");

  const toCall = Math.max(0, state.currentBet - state.myRoundBet);
  const canCheck = toCall === 0;

  const poll = useCallback(async () => {
    try {
      const res = await fetch(`/api/poker/multiplayer/state/${sessionId}`);
      const data = await res.json();
      if (!res.ok) return;
      if (data.updatedAt === lastUpdated) return;
      setLastUpdated(data.updatedAt);

      setState((prev) => ({
        ...prev,
        status: data.status,
        phase: data.phase,
        handNumber: data.handNumber,
        dealerSeat: data.dealerSeat,
        pot: data.pot,
        communityCards: data.communityCards,
        currentBet: data.currentBet,
        activeSeat: data.activeSeat,
        players: data.players,
        mySeat: data.players.find((p: PlayerInfo) => p.isYou)?.seat ?? prev.mySeat,
        myChips: data.players.find((p: PlayerInfo) => p.isYou)?.chips ?? prev.myChips,
        myRoundBet: data.yourRoundBet,
        isMyTurn: data.isYourTurn,
        myHand: data.players.find((p: PlayerInfo) => p.isYou)?.hand ?? prev.myHand,
        pocket: data.pocket,
      }));
    } catch { /* ignore */ }
  }, [sessionId, lastUpdated]);

  useEffect(() => {
    if (state.status === "COMPLETED") return;
    const interval = setInterval(poll, 3000);
    return () => clearInterval(interval);
  }, [poll, state.status]);

  async function sendAction(action: string, amount?: number) {
    setError("");
    setLoading(true);
    setHandResult(null);
    try {
      const res = await fetch("/api/poker/multiplayer/action", {
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
        isMyTurn: data.isYourTurn,
        myHand: data.yourHand ?? prev.myHand,
        myRoundBet: data.yourRoundBet,
        players: data.players ? prev.players.map((p) => {
          const updated = data.players.find((dp: PlayerInfo) => dp.seat === p.seat);
          return updated ? { ...p, chips: updated.chips, status: updated.status } : p;
        }) : prev.players,
      }));

      if (data.handResult) setHandResult(data.handResult);
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function startGame() {
    setLoading(true);
    try {
      const res = await fetch("/api/poker/multiplayer/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      await poll();
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function dealNext() {
    setLoading(true);
    setHandResult(null);
    try {
      const res = await fetch("/api/poker/multiplayer/deal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      await poll();
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function cashOut() {
    setLoading(true);
    try {
      const res = await fetch("/api/poker/multiplayer/cashout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      router.push("/lobby");
    } catch (e: unknown) {
      setError((e as Error).message);
      setLoading(false);
    }
  }

  const isHandOver = state.status === "BETWEEN_HANDS" || state.status === "COMPLETED";
  const myInfo = state.players.find((p) => p.isYou);

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <div className="flex justify-between items-center mb-4">
        <div>
          <div className="text-white font-bold">{tableName} — Hand #{state.handNumber}</div>
          <div className="text-xs text-gray-400">Blinds {fmt(smallBlind)}/{fmt(bigBlind)} · {state.players.length} player(s)</div>
        </div>
        <div className="text-right">
          <div className="text-xs text-gray-400">Pocket</div>
          <div className="text-green-400 font-bold">{fmt(state.pocket)}</div>
        </div>
      </div>

      {/* Players */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        {state.players.map((p) => (
          <div key={p.seat} className={`bg-black/40 rounded-xl p-3 border ${p.isYou ? "border-yellow-500/50" : "border-gray-700/40"} ${state.activeSeat === p.seat && state.status === "ACTIVE" ? "ring-2 ring-blue-500/60" : ""}`}>
            <div className="flex justify-between items-center mb-2">
              <div className="text-sm font-semibold text-white">{p.username} {p.isYou && "(You)"}</div>
              <div className="text-xs text-yellow-400">{fmt(p.chips)}</div>
            </div>
            <div className="flex gap-1 mb-1">
              {p.hand
                ? p.hand.map((c: Card, i: number) => <PlayingCard key={i} card={c} />)
                : state.phase && state.status === "ACTIVE" && p.status === "ACTIVE"
                ? [0, 1].map((i) => <PlayingCard key={i} card={null} faceDown />)
                : null}
            </div>
            <div className="flex gap-2 text-xs">
              {p.status === "FOLDED" && <span className="text-red-400">FOLDED</span>}
              {p.isAllIn && <span className="text-purple-400">ALL IN</span>}
              {p.roundBet > 0 && <span className="text-gray-400">Bet: {fmt(p.roundBet)}</span>}
              {p.seat === state.dealerSeat && <span className="text-yellow-500">D</span>}
            </div>
          </div>
        ))}
      </div>

      {/* Community cards + pot */}
      <div className="bg-felt-green/50 border border-green-800/40 rounded-xl p-4 mb-4 min-h-[100px]">
        <div className="text-xs text-gray-400 mb-2 uppercase tracking-wider">
          {state.phase ?? "Waiting"} · Pot: <span className="text-yellow-300">{fmt(state.pot)}</span>
          {state.currentBet > 0 && <> · Current bet: <span className="text-white">{fmt(state.currentBet)}</span></>}
        </div>
        <div className="flex gap-2 flex-wrap">
          {state.communityCards.length === 0
            ? <div className="text-gray-600 text-sm italic">No community cards yet</div>
            : state.communityCards.map((c, i) => <PlayingCard key={i} card={c} />)}
        </div>
      </div>

      {/* My hand */}
      {state.myHand && (
        <div className="bg-black/40 border border-yellow-600/30 rounded-xl p-3 mb-4">
          <div className="text-xs text-gray-400 mb-2">Your hand</div>
          <div className="flex gap-2">{state.myHand.map((c, i) => <PlayingCard key={i} card={c} />)}</div>
        </div>
      )}

      {/* Hand result */}
      {handResult && (
        <div className="bg-black/40 border border-yellow-500/40 rounded-xl p-4 mb-4 text-center">
          {Object.entries(handResult.winners).map(([seat, won]) => {
            const p = state.players.find((pl) => pl.seat === Number(seat));
            return <div key={seat} className={`text-lg font-bold ${p?.isYou ? "text-green-400" : "text-white"}`}>{p?.username} wins {fmt(won)}!</div>;
          })}
          {handResult.allHands && handResult.allHands.map(({ seat, hand }) => {
            const p = state.players.find((pl) => pl.seat === seat);
            return hand ? (
              <div key={seat} className="text-sm text-gray-400">{p?.username}: {handResult.handLabels[seat]}</div>
            ) : null;
          })}
        </div>
      )}

      {error && <div className="bg-red-900/40 border border-red-500/40 text-red-300 text-sm p-3 rounded mb-4">{error}</div>}

      {/* Controls */}
      {state.status === "WAITING" && (
        <div className="space-y-2">
          <div className="text-center text-gray-400 text-sm">Waiting for players… ({state.players.length} seated)</div>
          {state.players.length >= 2 && (
            <button onClick={startGame} disabled={loading} className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-bold py-3 rounded-lg disabled:opacity-50">
              {loading ? "Starting..." : "Start Game"}
            </button>
          )}
        </div>
      )}

      {state.isMyTurn && !isHandOver && (
        <div className="space-y-3">
          <div className="flex gap-2">
            <button onClick={() => sendAction("FOLD")} disabled={loading} className="flex-1 bg-red-700 hover:bg-red-600 text-white font-bold py-3 rounded-lg disabled:opacity-50">Fold</button>
            {canCheck
              ? <button onClick={() => sendAction("CHECK")} disabled={loading} className="flex-1 bg-blue-700 hover:bg-blue-600 text-white font-bold py-3 rounded-lg disabled:opacity-50">Check</button>
              : <button onClick={() => sendAction("CALL", toCall)} disabled={loading} className="flex-1 bg-blue-700 hover:bg-blue-600 text-white font-bold py-3 rounded-lg disabled:opacity-50">Call {fmt(toCall)}</button>}
          </div>
          <div className="flex gap-2">
            <input type="number" value={raiseAmount} onChange={(e) => setRaiseAmount(e.target.value)}
              min={state.currentBet * 2 || bigBlind * 2} max={myInfo?.chips ?? 0} step={bigBlind}
              className="flex-1 bg-gray-900 border border-gray-700 text-white px-3 py-2 rounded focus:outline-none focus:border-yellow-500" />
            <button onClick={() => sendAction("RAISE", Number(raiseAmount))} disabled={loading} className="px-4 py-2 bg-yellow-600 hover:bg-yellow-500 text-black font-bold rounded-lg disabled:opacity-50">Raise</button>
            <button onClick={() => sendAction("ALL_IN", myInfo?.chips ?? 0)} disabled={loading} className="px-4 py-2 bg-purple-700 hover:bg-purple-600 text-white font-bold rounded-lg disabled:opacity-50">All In</button>
          </div>
        </div>
      )}

      {!state.isMyTurn && state.status === "ACTIVE" && (
        <div className="text-center py-4 text-gray-400 animate-pulse">
          Waiting for {state.players.find((p) => p.seat === state.activeSeat)?.username ?? "player"}…
        </div>
      )}

      {isHandOver && (
        <div className="flex gap-3">
          <button onClick={dealNext} disabled={loading} className="flex-1 bg-yellow-500 hover:bg-yellow-400 text-black font-bold py-3 rounded-lg disabled:opacity-50">Next Hand</button>
          <button onClick={cashOut} disabled={loading || state.status === "ACTIVE"} className="px-4 py-3 border border-gray-600 text-gray-300 hover:text-white rounded-lg disabled:opacity-50">
            Cash Out {myInfo ? fmt(myInfo.chips) : ""}
          </button>
        </div>
      )}

      <button onClick={() => router.push("/poker")} className="w-full mt-3 py-2 text-xs text-gray-500 hover:text-gray-400">← Poker Lobby</button>
    </div>
  );
}
