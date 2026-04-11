"use client";

import { Loader2, Lock } from "lucide-react";
import { FormEvent, useState } from "react";

type Props = {
  redirectTo: string;
};

export function AccessGateForm({ redirectTo }: Props) {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = code.trim();
    if (!trimmed || loading) return;
    setErr(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/unlock", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ code: trimmed }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: { message?: string };
      };
      if (!res.ok || !data.ok) {
        setErr(data.error?.message ?? "Could not verify code.");
        return;
      }
      window.location.assign(redirectTo);
    } catch {
      setErr("Network error. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-md rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mb-4 flex items-center gap-2 text-zinc-900 dark:text-zinc-100">
        <Lock className="size-5 text-emerald-700 dark:text-emerald-400" aria-hidden />
        <h1 className="text-lg font-semibold">Enter access code</h1>
      </div>
      <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
        This ScholarAI instance is private. Ask the owner for the code, then you
        can use the site in this browser for a while.
      </p>
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <label htmlFor="access-code" className="sr-only">
          Access code
        </label>
        <input
          id="access-code"
          type="password"
          autoComplete="one-time-code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Access code"
          className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none ring-emerald-600/20 focus:border-emerald-600/40 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        />
        {err && (
          <p className="text-sm text-red-700 dark:text-red-300" role="alert">
            {err}
          </p>
        )}
        <button
          type="submit"
          disabled={loading || !code.trim()}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-800 disabled:opacity-50 dark:bg-emerald-600 dark:hover:bg-emerald-500"
        >
          {loading ? (
            <>
              <Loader2 className="size-4 motion-safe:animate-spin" aria-hidden />
              Checking…
            </>
          ) : (
            "Continue"
          )}
        </button>
      </form>
    </div>
  );
}
