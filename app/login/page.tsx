"use client";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const [form, setForm] = useState({ username: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await signIn("credentials", {
      username: form.username,
      password: form.password,
      redirect: false,
    });
    setLoading(false);
    if (res?.error) {
      setError("Invalid username or password");
    } else {
      router.push("/lobby");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-felt-dark">
      <div className="w-full max-w-sm">
        <h1 className="text-4xl font-bold text-yellow-400 text-center mb-2">♠ BlackJack</h1>
        <p className="text-gray-400 text-center mb-8">High Stakes Casino</p>

        <form onSubmit={handleSubmit} className="bg-black/50 border border-yellow-600/30 rounded-xl p-8 space-y-5">
          <h2 className="text-xl font-semibold text-white text-center">Sign In</h2>

          {error && (
            <div className="bg-red-900/40 border border-red-500/50 text-red-300 text-sm p-3 rounded">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm text-gray-400 mb-1">Username</label>
            <input
              type="text"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              required
              className="w-full bg-gray-900 border border-gray-700 text-white px-4 py-2 rounded focus:outline-none focus:border-yellow-500"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Password</label>
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
              className="w-full bg-gray-900 border border-gray-700 text-white px-4 py-2 rounded focus:outline-none focus:border-yellow-500"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-bold py-2 rounded disabled:opacity-50"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>

          <p className="text-center text-sm text-gray-400">
            No account?{" "}
            <Link href="/register" className="text-yellow-400 hover:underline">
              Register
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
