"use client";

import { BookMarked, Trash2, X } from "lucide-react";
import type { Paper } from "@/lib/paper";

type Props = {
  papers: Paper[];
  onRemove: (id: string) => void;
  onClear: () => void;
  disabled?: boolean;
};

export function CorpusCartPanel({
  papers,
  onRemove,
  onClear,
  disabled,
}: Props) {
  return (
    <div
      className="mb-3 rounded-lg border border-sky-200/70 bg-white/90 px-3 py-2 dark:border-sky-900/45 dark:bg-zinc-950/50"
      aria-label="Research corpus"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-sky-950 dark:text-sky-100">
          <BookMarked className="size-3.5 shrink-0" aria-hidden />
          Corpus ({papers.length})
        </h3>
        {papers.length > 0 && (
          <button
            type="button"
            onClick={onClear}
            disabled={disabled}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-50 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
          >
            <Trash2 className="size-3" aria-hidden />
            Clear all
          </button>
        )}
      </div>
      {papers.length === 0 ? (
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Add papers from results with{" "}
          <span className="font-medium text-zinc-700 dark:text-zinc-300">
            Add to corpus
          </span>
          . Your list stays when you run a new search.
        </p>
      ) : (
        <ul className="max-h-40 space-y-1.5 overflow-y-auto pr-0.5">
          {papers.map((p) => (
            <li
              key={p.id}
              className="flex items-start gap-2 rounded-md border border-zinc-100 bg-zinc-50/80 px-2 py-1.5 text-xs dark:border-zinc-800 dark:bg-zinc-900/40"
            >
              <span className="min-w-0 flex-1 leading-snug text-zinc-800 dark:text-zinc-200">
                <span className="line-clamp-2 font-medium">{p.title}</span>
                {p.year != null && (
                  <span className="ml-1.5 text-zinc-500 dark:text-zinc-400">
                    ({p.year})
                  </span>
                )}
              </span>
              <button
                type="button"
                onClick={() => onRemove(p.id)}
                disabled={disabled}
                className="shrink-0 rounded p-0.5 text-zinc-500 hover:bg-zinc-200 hover:text-zinc-900 disabled:opacity-50 dark:hover:bg-zinc-700 dark:hover:text-zinc-100"
                aria-label={`Remove ${p.title.slice(0, 80)} from corpus`}
              >
                <X className="size-3.5" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
