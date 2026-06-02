import { createDeck, shuffleDeck, drawCard } from "./blackjack";
import type { Card } from "./blackjack";

export { createDeck, shuffleDeck, drawCard };
export type { Card };

// ── Card helpers ────────────────────────────────────────────────────────────

function rankToNum(rank: string): number {
  const map: Record<string, number> = {
    "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7,
    "8": 8, "9": 9, "10": 10, J: 11, Q: 12, K: 13, A: 14,
  };
  return map[rank] ?? 0;
}

function combinations<T>(arr: T[], k: number): T[][] {
  if (k === 0) return [[]];
  if (arr.length < k) return [];
  const [head, ...tail] = arr;
  return [
    ...combinations(tail, k - 1).map((c) => [head, ...c]),
    ...combinations(tail, k),
  ];
}

// ── Hand evaluation ─────────────────────────────────────────────────────────

export interface HandScore {
  category: number;      // 0=high card … 8=royal flush
  tiebreakers: number[]; // descending card values for tie-breaking
  label: string;
}

function evalFive(cards: Card[]): HandScore {
  const nums = cards.map((c) => rankToNum(c.rank)).sort((a, b) => b - a);
  const suits = cards.map((c) => c.suit);
  const flush = new Set(suits).size === 1;

  const uniq = [...new Set(nums)].sort((a, b) => b - a);
  let straight = false;
  let straightHigh = 0;
  if (uniq.length === 5) {
    if (uniq[0] - uniq[4] === 4) { straight = true; straightHigh = uniq[0]; }
    if (uniq[0] === 14 && uniq[1] === 5 && uniq[4] === 2) { straight = true; straightHigh = 5; }
  }

  const cnt: Record<number, number> = {};
  for (const n of nums) cnt[n] = (cnt[n] || 0) + 1;
  const groups = Object.entries(cnt)
    .map(([v, c]) => ({ v: Number(v), c }))
    .sort((a, b) => b.c - a.c || b.v - a.v);
  const gc = groups.map((g) => g.c);
  const gv = groups.map((g) => g.v);

  if (flush && straight) return { category: 8, tiebreakers: [straightHigh], label: straightHigh === 14 ? "Royal Flush" : "Straight Flush" };
  if (gc[0] === 4) return { category: 7, tiebreakers: gv, label: "Four of a Kind" };
  if (gc[0] === 3 && gc[1] === 2) return { category: 6, tiebreakers: gv, label: "Full House" };
  if (flush) return { category: 5, tiebreakers: nums, label: "Flush" };
  if (straight) return { category: 4, tiebreakers: [straightHigh], label: "Straight" };
  if (gc[0] === 3) return { category: 3, tiebreakers: gv, label: "Three of a Kind" };
  if (gc[0] === 2 && gc[1] === 2) return { category: 2, tiebreakers: gv, label: "Two Pair" };
  if (gc[0] === 2) return { category: 1, tiebreakers: gv, label: "One Pair" };
  return { category: 0, tiebreakers: nums, label: "High Card" };
}

export function bestHandScore(cards: Card[]): HandScore {
  if (cards.length < 5) return evalFive([...cards, ...Array(5 - cards.length).fill({ rank: "2", suit: "♠" })]);
  return combinations(cards, 5).reduce(
    (best, combo) => {
      const s = evalFive(combo);
      return compareScores(s, best) > 0 ? s : best;
    },
    evalFive(cards.slice(0, 5))
  );
}

export function compareScores(a: HandScore, b: HandScore): number {
  if (a.category !== b.category) return a.category - b.category;
  for (let i = 0; i < Math.max(a.tiebreakers.length, b.tiebreakers.length); i++) {
    const d = (a.tiebreakers[i] ?? 0) - (b.tiebreakers[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

// ── Hand strength for AI (0–1) ───────────────────────────────────────────────

function preflopStrength(hole: Card[]): number {
  const v1 = rankToNum(hole[0].rank);
  const v2 = rankToNum(hole[1].rank);
  const hi = Math.max(v1, v2);
  const lo = Math.min(v1, v2);
  const isPair = v1 === v2;
  const suited = hole[0].suit === hole[1].suit;
  const connected = hi - lo <= 1;
  if (isPair) return 0.55 + ((hi - 2) / 12) * 0.45;
  const base = ((hi - 2) / 12) * 0.5 + ((lo - 2) / 12) * 0.25;
  return Math.min(0.85, base + (suited ? 0.08 : 0) + (connected ? 0.04 : 0));
}

export function handStrength(hole: Card[], community: Card[]): number {
  if (community.length === 0) return preflopStrength(hole);
  const score = bestHandScore([...hole, ...community]);
  return Math.min(1, score.category / 8 + (score.tiebreakers[0] ?? 0) / 14 * 0.08);
}

// ── NPC AI ───────────────────────────────────────────────────────────────────

export type NpcDecision =
  | { action: "FOLD" }
  | { action: "CHECK" }
  | { action: "CALL"; amount: number }
  | { action: "RAISE"; amount: number }
  | { action: "ALL_IN"; amount: number };

export function npcDecide(
  hole: Card[],
  community: Card[],
  pot: number,
  callAmount: number,
  npcChips: number,
  bigBlind: number
): NpcDecision {
  const s = handStrength(hole, community);
  const eff = Math.random() < 0.12 ? Math.min(1, s + 0.35) : s;
  const potOdds = callAmount > 0 ? callAmount / (pot + callAmount) : 0;

  if (callAmount === 0) {
    if (eff > 0.65) {
      const bet = Math.min(npcChips, Math.max(bigBlind * 2, Math.floor(pot * (0.4 + eff * 0.4))));
      return npcChips <= bet ? { action: "ALL_IN", amount: npcChips } : { action: "RAISE", amount: bet };
    }
    return { action: "CHECK" };
  }

  if (callAmount >= npcChips) {
    return eff > 0.45 ? { action: "ALL_IN", amount: npcChips } : { action: "FOLD" };
  }

  if (eff > 0.75) {
    const raise = Math.min(npcChips, Math.max(callAmount * 2, callAmount + Math.floor(pot * (0.5 + eff * 0.3))));
    return { action: "RAISE", amount: raise };
  }
  if (eff > potOdds + 0.1) return { action: "CALL", amount: callAmount };
  return { action: "FOLD" };
}

// ── Game state ───────────────────────────────────────────────────────────────

export interface PokerGameState {
  deck: Card[];
  communityCards: Card[];
  pot: number;
  currentBet: number;
  roundBets: Record<string, number>;
  hasActed: Record<string, boolean>;
  activeSeat: number;
}

export interface PlayerState {
  id: string;
  seat: number;
  chips: number;
  hand: Card[] | null;
  status: string;
  isAllIn: boolean;
  isNpc: boolean;
  userId: string | null;
}

export function serializeGameState(gs: PokerGameState): string {
  return JSON.stringify(gs);
}

export function parseGameState(s: string): PokerGameState {
  return JSON.parse(s) as PokerGameState;
}

export function serializeHand(cards: Card[]): string { return JSON.stringify(cards); }
export function parseHand(s: string): Card[] { return JSON.parse(s) as Card[]; }

// ── Hand initialization ──────────────────────────────────────────────────────

export function initHand(
  players: { seat: number; chips: number }[],
  dealerSeat: number,
  smallBlind: number,
  bigBlind: number
): { gameState: PokerGameState; dealtHands: Record<number, Card[]> } {
  let deck = shuffleDeck(createDeck());
  const n = players.length;

  // Seat order: indices in players array sorted by seat number
  const sorted = [...players].sort((a, b) => a.seat - b.seat);
  const dealerIdx = sorted.findIndex((p) => p.seat >= dealerSeat) % n;

  // HU: dealer = SB; 3+: dealer+1 = SB
  const sbIdx = n === 2 ? dealerIdx : (dealerIdx + 1) % n;
  const bbIdx = (sbIdx + 1) % n;
  const sbSeat = sorted[sbIdx].seat;
  const bbSeat = sorted[bbIdx].seat;

  // Deal 2 cards each
  const dealtHands: Record<number, Card[]> = {};
  for (const p of sorted) {
    const { card: c1, remaining: r1 } = drawCard(deck); deck = r1;
    const { card: c2, remaining: r2 } = drawCard(deck); deck = r2;
    dealtHands[p.seat] = [c1, c2];
  }

  // Post blinds
  const roundBets: Record<string, number> = {};
  const hasActed: Record<string, boolean> = {};
  for (const p of sorted) { roundBets[p.seat] = 0; hasActed[p.seat] = false; }

  const sbP = sorted[sbIdx];
  const bbP = sorted[bbIdx];
  roundBets[sbSeat] = Math.min(smallBlind, sbP.chips);
  roundBets[bbSeat] = Math.min(bigBlind, bbP.chips);
  const pot = roundBets[sbSeat] + roundBets[bbSeat];

  // Pre-flop first to act: HU=SB, 3+=UTG (after BB)
  const firstActIdx = n === 2 ? sbIdx : (bbIdx + 1) % n;
  const activeSeat = sorted[firstActIdx].seat;

  return {
    gameState: { deck, communityCards: [], pot, currentBet: bigBlind, roundBets, hasActed, activeSeat },
    dealtHands,
  };
}

// ── Betting round helpers ────────────────────────────────────────────────────

export function activePlayers(players: PlayerState[]): PlayerState[] {
  return players.filter((p) => p.status === "ACTIVE" && !p.isAllIn);
}

export function isRoundDone(gs: PokerGameState, players: PlayerState[]): boolean {
  const active = activePlayers(players);
  if (active.length <= 1) return true;
  return active.every((p) => {
    return (gs.hasActed[p.seat] ?? false) && (gs.roundBets[p.seat] ?? 0) >= gs.currentBet;
  });
}

export function nextSeat(currentSeat: number, players: PlayerState[]): number | null {
  const seats = activePlayers(players).map((p) => p.seat).sort((a, b) => a - b);
  if (seats.length === 0) return null;
  const next = seats.find((s) => s > currentSeat) ?? seats[0];
  return next === currentSeat ? null : next;
}

// ── Applying actions ─────────────────────────────────────────────────────────

export function applyAction(
  gs: PokerGameState,
  players: PlayerState[],
  seat: number,
  action: string,
  amount: number
): { gs: PokerGameState; players: PlayerState[] } {
  let p = players.map((x) => ({ ...x })); // shallow clone
  const player = p.find((x) => x.seat === seat)!;
  const rb = { ...gs.roundBets };
  const ha = { ...gs.hasActed };
  let { pot, currentBet } = gs;

  switch (action) {
    case "FOLD":
      player.status = "FOLDED";
      ha[seat] = true;
      break;

    case "CHECK":
      ha[seat] = true;
      break;

    case "CALL": {
      const toCall = Math.min(amount, player.chips);
      rb[seat] = (rb[seat] ?? 0) + toCall;
      pot += toCall;
      player.chips -= toCall;
      ha[seat] = true;
      if (player.chips === 0) { player.isAllIn = true; player.status = "ALL_IN"; }
      break;
    }

    case "RAISE": {
      const prev = rb[seat] ?? 0;
      const extra = Math.min(amount - prev, player.chips);
      rb[seat] = prev + extra;
      pot += extra;
      player.chips -= extra;
      currentBet = rb[seat];
      ha[seat] = true;
      // Reset hasActed for all others who are still active
      for (const op of p) {
        if (op.seat !== seat && op.status === "ACTIVE" && !op.isAllIn) {
          ha[op.seat] = false;
        }
      }
      if (player.chips === 0) { player.isAllIn = true; player.status = "ALL_IN"; }
      break;
    }

    case "ALL_IN": {
      const prev = rb[seat] ?? 0;
      const extra = player.chips;
      rb[seat] = prev + extra;
      pot += extra;
      player.chips = 0;
      player.isAllIn = true;
      player.status = "ALL_IN";
      ha[seat] = true;
      if (rb[seat] > currentBet) {
        currentBet = rb[seat];
        for (const op of p) {
          if (op.seat !== seat && op.status === "ACTIVE" && !op.isAllIn) ha[op.seat] = false;
        }
      }
      break;
    }
  }

  return {
    gs: { ...gs, pot, currentBet, roundBets: rb, hasActed: ha },
    players: p,
  };
}

// ── Phase advancement ────────────────────────────────────────────────────────

const PHASES = ["PREFLOP", "FLOP", "TURN", "RIVER", "SHOWDOWN"] as const;

export function advancePhase(
  gs: PokerGameState,
  currentPhase: string,
  players: PlayerState[],
  dealerSeat: number
): { gs: PokerGameState; phase: string } {
  const idx = PHASES.indexOf(currentPhase as typeof PHASES[number]);
  const nextPhase = PHASES[Math.min(idx + 1, PHASES.length - 1)];

  let deck = gs.deck;
  let communityCards = gs.communityCards;

  if (nextPhase === "FLOP") {
    for (let i = 0; i < 3; i++) {
      const { card, remaining } = drawCard(deck); deck = remaining; communityCards = [...communityCards, card];
    }
  } else if (nextPhase === "TURN" || nextPhase === "RIVER") {
    const { card, remaining } = drawCard(deck); deck = remaining; communityCards = [...communityCards, card];
  }

  // Reset round bets + hasActed
  const roundBets: Record<string, number> = {};
  const hasActed: Record<string, boolean> = {};
  for (const p of players) { if (p.status !== "FOLDED") { roundBets[p.seat] = 0; hasActed[p.seat] = false; } }

  // Post-flop: first to act is first active player left of dealer
  const sorted = players.filter((p) => p.status === "ACTIVE" || p.isAllIn).map((p) => p.seat).sort((a, b) => a - b);
  const afterDealer = sorted.find((s) => s > dealerSeat) ?? sorted[0];
  const activeSeat = nextPhase === "SHOWDOWN" ? gs.activeSeat : afterDealer;

  return {
    gs: { ...gs, deck, communityCards, pot: gs.pot, currentBet: 0, roundBets, hasActed, activeSeat },
    phase: nextPhase,
  };
}

// ── Showdown ─────────────────────────────────────────────────────────────────

export function resolveShowdown(gs: PokerGameState, players: PlayerState[]): {
  winners: Record<number, number>; // seat -> chips won
  handLabels: Record<number, string>;
} {
  const eligible = players.filter((p) => p.status === "ACTIVE" || p.isAllIn);

  const handLabels: Record<number, string> = {};
  if (eligible.length === 1) {
    return { winners: { [eligible[0].seat]: gs.pot }, handLabels };
  }

  const scored = eligible.map((p) => {
    const score = bestHandScore([...(p.hand ?? []), ...gs.communityCards]);
    handLabels[p.seat] = score.label;
    return { seat: p.seat, score, contribution: gs.roundBets[p.seat] ?? 0, isAllIn: p.isAllIn };
  });

  scored.sort((a, b) => compareScores(b.score, a.score));
  const topScore = scored[0].score;
  const winners = scored.filter((s) => compareScores(s.score, topScore) === 0);

  // Simplified: split pot equally among winners
  const perWinner = Math.floor(gs.pot / winners.length);
  const result: Record<number, number> = {};
  for (const w of winners) result[w.seat] = perWinner;

  return { winners: result, handLabels };
}

// ── One player left ──────────────────────────────────────────────────────────

export function onlyOneLeft(players: PlayerState[]): PlayerState | null {
  const notFolded = players.filter((p) => p.status !== "FOLDED" && p.status !== "SITTING_OUT");
  return notFolded.length === 1 ? notFolded[0] : null;
}
