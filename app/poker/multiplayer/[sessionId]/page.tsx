import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Navbar from "@/components/Navbar";
import MultiPokerClient from "./MultiPokerClient";
import { parseGameState, parseHand } from "@/lib/poker";

export default async function MultiPokerPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const session = await auth();
  if (!session) redirect("/login");

  const { sessionId } = await params;
  const [user, ps] = await Promise.all([
    prisma.user.findUnique({ where: { id: session.user.id } }),
    prisma.pokerSession.findUnique({
      where: { id: sessionId },
      include: { players: { include: { user: { select: { username: true } } } }, table: true },
    }),
  ]);

  if (!user) redirect("/login");
  if (!ps) redirect("/poker");

  const me = ps.players.find((p) => p.userId === session.user.id);
  if (!me) redirect("/poker");

  const gs = ps.gameState ? parseGameState(ps.gameState) : null;

  const players = ps.players.map((p) => ({
    seat: p.seat,
    username: p.user?.username ?? "?",
    chips: Number(p.chips),
    status: p.status,
    isAllIn: p.isAllIn,
    isYou: p.userId === session.user.id,
    roundBet: gs?.roundBets?.[p.seat] ?? 0,
    hand: p.userId === session.user.id && p.hand ? parseHand(p.hand) : null,
  }));

  return (
    <div className="min-h-screen bg-felt-dark">
      <Navbar username={user.username} role={user.role} pocket={Number(user.pocket)} />
      <MultiPokerClient
        sessionId={sessionId}
        tableName={ps.table.name}
        smallBlind={Number(ps.table.smallBlind)}
        bigBlind={Number(ps.table.bigBlind)}
        myUserId={session.user.id}
        initialState={{
          status: ps.status,
          phase: ps.phase,
          handNumber: ps.handNumber,
          dealerSeat: ps.dealerSeat,
          pot: gs?.pot ?? 0,
          communityCards: gs?.communityCards ?? [],
          currentBet: gs?.currentBet ?? 0,
          activeSeat: gs?.activeSeat ?? null,
          players,
          mySeat: me.seat,
          myChips: Number(me.chips),
          myRoundBet: gs?.roundBets?.[me.seat] ?? 0,
          isMyTurn: gs?.activeSeat === me.seat && ps.status === "ACTIVE",
          myHand: me.hand ? parseHand(me.hand) : null,
          pocket: Number(user.pocket),
        }}
      />
    </div>
  );
}
