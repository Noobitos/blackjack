export interface BlackjackTableConfig {
  id: number;
  tableType: "BLACKJACK";
  name: string;
  minBet: number;
  maxBet: number;
  color: string;
  badge: string;
}

export interface RouletteTableConfig {
  id: number;
  tableType: "ROULETTE";
  name: string;
  minBetNumber: number;    // straight-up (35:1)
  minBetOutside: number;   // red/black/odd/even/dozen/column
  maxBet: number;
  color: string;
  badge: string;
}

export type TableConfig = BlackjackTableConfig | RouletteTableConfig;

export const BLACKJACK_TABLE_CONFIGS: BlackjackTableConfig[] = [
  { id: 1, tableType: "BLACKJACK", name: "Bronze",   minBet: 50_000,     maxBet: 500_000,    color: "from-amber-700 to-amber-900",   badge: "bg-amber-700" },
  { id: 2, tableType: "BLACKJACK", name: "Silver",   minBet: 100_000,    maxBet: 1_000_000,  color: "from-gray-400 to-gray-600",     badge: "bg-gray-500" },
  { id: 3, tableType: "BLACKJACK", name: "Gold",     minBet: 500_000,    maxBet: 5_000_000,  color: "from-yellow-500 to-yellow-700", badge: "bg-yellow-500" },
  { id: 4, tableType: "BLACKJACK", name: "Platinum", minBet: 1_000_000,  maxBet: 10_000_000, color: "from-cyan-600 to-cyan-800",     badge: "bg-cyan-600" },
  { id: 5, tableType: "BLACKJACK", name: "Diamond",  minBet: 2_000_000,  maxBet: 20_000_000, color: "from-blue-400 to-blue-700",     badge: "bg-blue-500" },
];

export const ROULETTE_TABLE_CONFIGS: RouletteTableConfig[] = [
  { id: 6, tableType: "ROULETTE", name: "Roulette I",  minBetNumber: 25_000,  minBetOutside: 10_000,  maxBet: 500_000,    color: "from-red-700 to-red-900",     badge: "bg-red-700" },
  { id: 7, tableType: "ROULETTE", name: "Roulette II", minBetNumber: 100_000, minBetOutside: 50_000,  maxBet: 2_000_000,  color: "from-rose-500 to-rose-700",   badge: "bg-rose-600" },
];

export const ALL_TABLE_CONFIGS: TableConfig[] = [
  ...BLACKJACK_TABLE_CONFIGS,
  ...ROULETTE_TABLE_CONFIGS,
];

export const STARTING_TABLE_BALANCE = 50_000_000;
export const ADMIN_CASH_GENERATION  = 20_000_000;
