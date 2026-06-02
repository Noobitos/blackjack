export type Suit = "♠" | "♥" | "♦" | "♣";
export type Rank = "A" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10" | "J" | "Q" | "K";

export interface Card {
  suit: Suit;
  rank: Rank;
}

const SUITS: Suit[] = ["♠", "♥", "♦", "♣"];
const RANKS: Rank[] = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

export function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ suit, rank });
    }
  }
  return deck;
}

export function shuffleDeck(deck: Card[]): Card[] {
  const d = [...deck];
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [d[i], d[j]] = [d[j], d[i]];
  }
  return d;
}

export function drawCard(deck: Card[]): { card: Card; remaining: Card[] } {
  const [card, ...remaining] = deck;
  return { card, remaining };
}

function cardValue(rank: Rank): number {
  if (rank === "A") return 11;
  if (["J", "Q", "K"].includes(rank)) return 10;
  return parseInt(rank, 10);
}

export function handValue(hand: Card[]): number {
  let total = hand.reduce((sum, c) => sum + cardValue(c.rank), 0);
  let aces = hand.filter((c) => c.rank === "A").length;
  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }
  return total;
}

export function isBlackjack(hand: Card[]): boolean {
  return hand.length === 2 && handValue(hand) === 21;
}

export function isBust(hand: Card[]): boolean {
  return handValue(hand) > 21;
}

export function dealerShouldHit(hand: Card[]): boolean {
  return handValue(hand) < 17;
}

export type GameOutcome = "WIN" | "LOSS" | "PUSH" | "BLACKJACK";

export function resolveOutcome(playerHand: Card[], dealerHand: Card[]): GameOutcome {
  const playerVal = handValue(playerHand);
  const dealerVal = handValue(dealerHand);

  if (isBlackjack(playerHand) && !isBlackjack(dealerHand)) return "BLACKJACK";
  if (isBust(playerHand)) return "LOSS";
  if (isBust(dealerHand)) return "WIN";
  if (playerVal > dealerVal) return "WIN";
  if (playerVal < dealerVal) return "LOSS";
  return "PUSH";
}

export function calcPayout(outcome: GameOutcome, bet: number): number {
  if (outcome === "BLACKJACK") return Math.floor(bet * 1.5);
  if (outcome === "WIN") return bet;
  if (outcome === "PUSH") return 0;
  return 0;
}

export function serializeHand(hand: Card[]): string {
  return JSON.stringify(hand);
}

export function deserializeHand(json: string): Card[] {
  return JSON.parse(json) as Card[];
}
