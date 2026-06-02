import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import RouletteClient from "./RouletteClient";
import Navbar from "@/components/Navbar";

export default async function RoulettePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) redirect("/login");

  const { id } = await params;
  const tableId = parseInt(id, 10);

  const [user, table] = await Promise.all([
    prisma.user.findUnique({ where: { id: session.user.id } }),
    prisma.table.findUnique({ where: { id: tableId } }),
  ]);

  if (!user) redirect("/login");
  if (!table || table.tableType !== "ROULETTE") redirect("/lobby");
  if (!table.isOpen) redirect("/lobby");

  return (
    <div className="min-h-screen bg-felt-dark">
      <Navbar username={user.username} role={user.role} pocket={Number(user.pocket)} />
      <RouletteClient
        tableId={tableId}
        tableName={table.name}
        minBetNumber={Number(table.minBet)}
        minBetOutside={Number(table.minBetOutside ?? table.minBet)}
        maxBet={Number(table.maxBet)}
        tableBalance={Number(table.balance)}
        initialPocket={Number(user.pocket)}
      />
    </div>
  );
}
