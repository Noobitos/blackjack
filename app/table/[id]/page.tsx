import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import TableClient from "./TableClient";
import Navbar from "@/components/Navbar";

export default async function TablePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) redirect("/login");

  const { id } = await params;
  const tableId = parseInt(id, 10);

  const [user, table] = await Promise.all([
    prisma.user.findUnique({ where: { id: session.user.id } }),
    prisma.table.findUnique({ where: { id: tableId } }),
  ]);

  if (!user) redirect("/login");
  if (!table) redirect("/lobby");
  if (!table.isOpen) redirect("/lobby");

  return (
    <div className="min-h-screen bg-felt-dark">
      <Navbar username={user.username} role={user.role} pocket={Number(user.pocket)} />
      <TableClient
        tableId={tableId}
        tableName={table.name}
        minBet={Number(table.minBet)}
        maxBet={Number(table.maxBet)}
        initialPocket={Number(user.pocket)}
      />
    </div>
  );
}
