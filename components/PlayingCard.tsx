import { Card } from "@/lib/blackjack";

interface PlayingCardProps {
  card: Card | null;
  faceDown?: boolean;
}

const RED_SUITS = ["♥", "♦"];

export default function PlayingCard({ card, faceDown }: PlayingCardProps) {
  if (faceDown || !card) {
    return (
      <div className="w-16 h-24 rounded-lg border-2 border-gray-600 bg-blue-900 flex items-center justify-center shadow-lg">
        <div className="text-blue-600 text-2xl">⬡</div>
      </div>
    );
  }

  const isRed = RED_SUITS.includes(card.suit);
  const color = isRed ? "text-red-500" : "text-gray-900";

  return (
    <div className="w-16 h-24 rounded-lg border-2 border-gray-300 bg-white flex flex-col items-center justify-between px-1 py-1 shadow-lg select-none">
      <div className={`text-sm font-bold leading-none ${color}`}>{card.rank}</div>
      <div className={`text-2xl leading-none ${color}`}>{card.suit}</div>
      <div className={`text-sm font-bold leading-none rotate-180 ${color}`}>{card.rank}</div>
    </div>
  );
}
