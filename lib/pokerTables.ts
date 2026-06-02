export interface PokerTableConfig {
  id: number;
  name: string;
  tableType: "NPC" | "MULTIPLAYER";
  smallBlind: number;
  bigBlind: number;
  minBuyIn: number;
  maxBuyIn: number;
  maxPlayers: number;
}

export const POKER_TABLE_CONFIGS: PokerTableConfig[] = [
  { id: 101, name: "NPC Table",      tableType: "NPC",         smallBlind: 50_000,  bigBlind: 100_000, minBuyIn: 500_000,   maxBuyIn: 5_000_000,  maxPlayers: 2 },
  { id: 102, name: "Cash Table I",   tableType: "MULTIPLAYER", smallBlind: 25_000,  bigBlind: 50_000,  minBuyIn: 500_000,   maxBuyIn: 5_000_000,  maxPlayers: 6 },
  { id: 103, name: "Cash Table II",  tableType: "MULTIPLAYER", smallBlind: 100_000, bigBlind: 200_000, minBuyIn: 2_000_000, maxBuyIn: 20_000_000, maxPlayers: 6 },
];

export const NPC_STARTING_BUDGET = 10_000_000;
