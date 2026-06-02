export type BetType =
  | "straight"   // single number 0-36, pays 35:1
  | "red"        // pays 1:1
  | "black"      // pays 1:1
  | "odd"        // pays 1:1
  | "even"       // pays 1:1
  | "low"        // 1-18, pays 1:1
  | "high"       // 19-36, pays 1:1
  | "dozen1"     // 1-12, pays 2:1
  | "dozen2"     // 13-24, pays 2:1
  | "dozen3"     // 25-36, pays 2:1
  | "col1"       // 1,4,7...34, pays 2:1
  | "col2"       // 2,5,8...35, pays 2:1
  | "col3";      // 3,6,9...36, pays 2:1

export interface RouletteBet {
  type: BetType;
  target?: number; // only for "straight"
  amount: number;
}

export const RED_NUMBERS = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
export const BLACK_NUMBERS = new Set([2,4,6,8,10,11,13,15,17,20,22,24,26,28,29,31,33,35]);

export function spinWheel(): number {
  return Math.floor(Math.random() * 37); // 0–36
}

export function getNumberColor(n: number): "red" | "black" | "green" {
  if (n === 0) return "green";
  return RED_NUMBERS.has(n) ? "red" : "black";
}

export function betPayout(bet: RouletteBet, result: number): number {
  const { type, target, amount } = bet;

  switch (type) {
    case "straight":
      return target === result ? amount * 35 : 0;

    case "red":
      return RED_NUMBERS.has(result) ? amount : 0;

    case "black":
      return BLACK_NUMBERS.has(result) ? amount : 0;

    case "odd":
      return result !== 0 && result % 2 !== 0 ? amount : 0;

    case "even":
      return result !== 0 && result % 2 === 0 ? amount : 0;

    case "low":
      return result >= 1 && result <= 18 ? amount : 0;

    case "high":
      return result >= 19 && result <= 36 ? amount : 0;

    case "dozen1":
      return result >= 1 && result <= 12 ? amount * 2 : 0;

    case "dozen2":
      return result >= 13 && result <= 24 ? amount * 2 : 0;

    case "dozen3":
      return result >= 25 && result <= 36 ? amount * 2 : 0;

    case "col1":
      return result !== 0 && result % 3 === 1 ? amount * 2 : 0;

    case "col2":
      return result !== 0 && result % 3 === 2 ? amount * 2 : 0;

    case "col3":
      return result !== 0 && result % 3 === 0 ? amount * 2 : 0;

    default:
      return 0;
  }
}

export function isNumberBet(type: BetType): boolean {
  return type === "straight";
}

export function resolveBets(bets: RouletteBet[], result: number): {
  totalBet: number;
  totalPayout: number;
  winnings: number; // net gain/loss for table (positive = table gains)
} {
  const totalBet = bets.reduce((s, b) => s + b.amount, 0);
  const totalPayout = bets.reduce((s, b) => s + betPayout(b, result), 0);
  // Total paid out by table = original bets returned + profit
  // Net table change = bets collected - payouts returned
  const winnings = totalBet - totalPayout;
  return { totalBet, totalPayout, winnings };
}

export const BET_LABELS: Record<BetType, string> = {
  straight: "Number",
  red: "Red",
  black: "Black",
  odd: "Odd",
  even: "Even",
  low: "Low (1–18)",
  high: "High (19–36)",
  dozen1: "1st Dozen (1–12)",
  dozen2: "2nd Dozen (13–24)",
  dozen3: "3rd Dozen (25–36)",
  col1: "Column 1",
  col2: "Column 2",
  col3: "Column 3",
};
