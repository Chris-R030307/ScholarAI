"use client";

import { AlertTriangle } from "lucide-react";
import { useEffect } from "react";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center gap-6 px-4 py-16">
      <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50/90 p-4 text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
        <AlertTriangle className="mt-0.5 size-5 shrink-0" aria-hidden />
        <div className="min-w-0 space-y-2 text-sm">
          <p className="font-medium">Something went wrong</p>
          <p className="text-amber-900/90 dark:text-amber-100/85">
            This page hit an unexpected error. You can try again or reload the
            app.
          </p>
          <button
            type="button"
            onClick={() => reset()}
            className="mt-2 rounded-lg bg-amber-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-900 dark:bg-amber-700 dark:hover:bg-amber-600"
          >
            Try again
          </button>
        </div>
      </div>
    </main>
  );
}
