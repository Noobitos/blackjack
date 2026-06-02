"use client";
import { useState, useEffect } from "react";
import Navbar from "@/components/Navbar";
import Link from "next/link";

function fmt(n: number) {
  if (n >= 1_000_000) return "$" + (n / 1_000_000).toFixed(2) + "M";
  if (n >= 1_000) return "$" + (n / 1_000).toFixed(0) + "K";
  return "$" + n.toLocaleString();
}

interface UserData {
  id: string;
  username: string;
  role: string;
  pocket: number;
  bank: number;
  createdAt: string;
}

export default function AdminUsersPage() {
  const [wallet, setWallet] = useState({ pocket: 0, username: "", role: "" });
  const [users, setUsers] = useState<UserData[]>([]);

  useEffect(() => {
    fetch("/api/wallet").then((r) => r.json()).then(setWallet);
    fetch("/api/admin/users").then((r) => r.json()).then(setUsers);
  }, []);

  return (
    <div className="min-h-screen bg-felt-dark">
      <Navbar username={wallet.username} role={wallet.role} pocket={wallet.pocket} />

      <main className="max-w-4xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-white">All Users</h1>
          <Link href="/admin" className="text-sm text-yellow-400 hover:underline">
            ← Admin Panel
          </Link>
        </div>

        <div className="bg-black/40 border border-yellow-600/30 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700/50">
                <th className="text-left text-gray-400 font-normal px-4 py-3">Username</th>
                <th className="text-left text-gray-400 font-normal px-4 py-3">Role</th>
                <th className="text-right text-gray-400 font-normal px-4 py-3">Pocket</th>
                <th className="text-right text-gray-400 font-normal px-4 py-3">Bank</th>
                <th className="text-left text-gray-400 font-normal px-4 py-3">Joined</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-gray-800/40 hover:bg-white/5">
                  <td className="px-4 py-3 text-white font-medium">{u.username}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded ${
                      u.role === "ADMIN" ? "bg-red-900/60 text-red-400" : "bg-gray-800 text-gray-400"
                    }`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-green-400">{fmt(u.pocket)}</td>
                  <td className="px-4 py-3 text-right text-blue-400">{fmt(u.bank)}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{new Date(u.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-gray-500">No users found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
