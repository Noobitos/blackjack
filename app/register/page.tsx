"use client";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ username: "", password: "", confirm: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (form.password !== form.confirm) {
      setError("Passwords do not match");
      return;
    }
    setLoading(true);
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: form.username, password: form.password }),
    });
    const data = await res.json();
    if (!res.ok) {
      setLoading(false);
      setError(data.error ?? "Registration failed");
      return;
    }
    await signIn("credentials", {
      username: form.username,
      password: form.password,
      redirect: false,
    });
    router.push("/lobby");
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-felt-dark">
      <div className="w-full max-w-sm">
        <h1 className="text-4xl font-bold text-yellow-400 text-center mb-2">♠ BlackJack</h1>
        <p className="text-gray-400 text-center mb-8">High Stakes Casino</p>

        <form onSubmit={handleSubmit} className="bg-black/50 border border-yellow-600/30 rounded-xl p-8 space-y-5">
          <h2 className="text-xl font-semibold text-white text-center">Create Account</h2>

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
              minLength={3}
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
              minLength={6}
              className="w-full bg-gray-900 border border-gray-700 text-white px-4 py-2 rounded focus:outline-none focus:border-yellow-500"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Confirm Password</label>
            <input
              type="password"
              value={form.confirm}
              onChange={(e) => setForm({ ...form, confirm: e.target.value })}
              required
              className="w-full bg-gray-900 border border-gray-700 text-white px-4 py-2 rounded focus:outline-none focus:border-yellow-500"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-bold py-2 rounded disabled:opacity-50"
          >
            {loading ? "Creating account..." : "Register"}
          </button>

          <p className="text-center text-sm text-gray-400">
            Have an account?{" "}
            <Link href="/login" className="text-yellow-400 hover:underline">
              Sign in
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
