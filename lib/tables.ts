export interface TableConfig {
  id: number;
  name: string;
  minBet: number;
  maxBet: number;
  color: string;
  badge: string;
}

export const TABLE_CONFIGS: TableConfig[] = [
  { id: 1, name: "Bronze", minBet: 50_000,     maxBet: 500_000,    color: "from-amber-700 to-amber-900",   badge: "bg-amber-700" },
  { id: 2, name: "Silver", minBet: 100_000,    maxBet: 1_000_000,  color: "from-gray-400 to-gray-600",     badge: "bg-gray-500" },
  { id: 3, name: "Gold",   minBet: 500_000,    maxBet: 5_000_000,  color: "from-yellow-500 to-yellow-700", badge: "bg-yellow-500" },
  { id: 4, name: "Platinum",minBet: 1_000_000, maxBet: 10_000_000, color: "from-cyan-600 to-cyan-800",     badge: "bg-cyan-600" },
  { id: 5, name: "Diamond", minBet: 2_000_000, maxBet: 20_000_000, color: "from-blue-400 to-blue-700",     badge: "bg-blue-500" },
];

export const STARTING_TABLE_BALANCE = 50_000_000;
export const ADMIN_CASH_GENERATION = 20_000_000;
