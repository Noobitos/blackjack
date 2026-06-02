"use client";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { usePathname } from "next/navigation";

interface NavbarProps {
  username: string;
  role: string;
  pocket: number;
}

function fmt(n: number) {
  return "$" + n.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

export default function Navbar({ username, role, pocket }: NavbarProps) {
  const path = usePathname();

  return (
    <nav className="bg-black/40 backdrop-blur border-b border-yellow-600/30 px-6 py-3 flex items-center justify-between">
      <div className="flex items-center gap-6">
        <Link href="/lobby" className="text-yellow-400 font-bold text-xl tracking-wider">
          ♠ BLACKJACK
        </Link>
        <Link
          href="/lobby"
          className={`text-sm ${path === "/lobby" ? "text-yellow-400" : "text-gray-300 hover:text-white"}`}
        >
          Tables
        </Link>
        <Link
          href="/poker"
          className={`text-sm ${path.startsWith("/poker") ? "text-yellow-400" : "text-gray-300 hover:text-white"}`}
        >
          Poker
        </Link>
        <Link
          href="/dashboard"
          className={`text-sm ${path === "/dashboard" ? "text-yellow-400" : "text-gray-300 hover:text-white"}`}
        >
          Wallet
        </Link>
        <Link
          href="/history"
          className={`text-sm ${path === "/history" ? "text-yellow-400" : "text-gray-300 hover:text-white"}`}
        >
          History
        </Link>
        {role === "ADMIN" && (
          <Link
            href="/admin"
            className={`text-sm ${path.startsWith("/admin") ? "text-yellow-400" : "text-red-400 hover:text-red-300"}`}
          >
            Admin
          </Link>
        )}
      </div>
      <div className="flex items-center gap-4">
        <div className="text-right">
          <div className="text-xs text-gray-400">{username}</div>
          <div className="text-sm font-semibold text-green-400">{fmt(pocket)}</div>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="text-xs text-gray-400 hover:text-white border border-gray-600 px-3 py-1 rounded"
        >
          Sign out
        </button>
      </div>
    </nav>
  );
}
