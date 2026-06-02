import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Navbar from "@/components/Navbar";
import NpcPokerClient from "./NpcPokerClient";
import { parseGameState, parseHand } from "@/lib/poker";

export default async function NpcPokerPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const session = await auth();
  if (!session) redirect("/login");

  const { sessionId } = await params;
  const [user, ps] = await Promise.all([
    prisma.user.findUnique({ where: { id: session.user.id } }),
    prisma.pokerSession.findUnique({ where: { id: sessionId }, include: { players: true, table: { include: { npc: true } } } }),
  ]);

  if (!user) redirect("/login");
  if (!ps) redirect("/poker");

  const humanPlayer = ps.players.find((p) => p.userId === session.user.id);
  if (!humanPlayer) redirect("/poker");

  const npcPlayer = ps.players.find((p) => p.isNpc)!;
  const gs = ps.gameState ? parseGameState(ps.gameState) : null;

  return (
    <div className="min-h-screen bg-felt-dark">
      <Navbar username={user.username} role={user.role} pocket={Number(user.pocket)} />
      <NpcPokerClient
        sessionId={sessionId}
        initialState={{
          phase: ps.phase ?? "WAITING",
          status: ps.status,
          pot: gs?.pot ?? 0,
          communityCards: gs?.communityCards ?? [],
          currentBet: gs?.currentBet ?? 0,
          activeSeat: gs?.activeSeat ?? 0,
          yourChips: Number(humanPlayer.chips),
          npcChips: Number(npcPlayer.chips),
          yourHand: humanPlayer.hand ? parseHand(humanPlayer.hand) : null,
          yourSeat: humanPlayer.seat,
          dealerSeat: ps.dealerSeat,
          handNumber: ps.handNumber,
          yourRoundBet: gs?.roundBets?.[humanPlayer.seat] ?? 0,
          npcBudget: Number(ps.table.npc?.budget ?? 0),
          npcIsActive: ps.table.npc?.isActive ?? false,
        }}
        smallBlind={Number(ps.table.smallBlind)}
        bigBlind={Number(ps.table.bigBlind)}
        pocket={Number(user.pocket)}
      />
    </div>
  );
}
