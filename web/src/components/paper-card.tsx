"use client";

import {
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Plus,
  Check,
} from "lucide-react";
import { useId, useState } from "react";
import type { Paper } from "@/lib/paper";

const ABSTRACT_PREVIEW_CHARS = 320;

function authorSnippet(authors: Paper["authors"], max = 3): string {
  if (!authors.length) return "Authors unknown";
  const names = authors.slice(0, max).map((a) => a.name);
  const extra = authors.length > max ? `, +${authors.length - max} more` : "";
  return names.join(", ") + extra;
}

export function PaperCard({
  paper,
  corpus,
}: {
  paper: Paper;
  /** Add-to-corpus control (Phase 6 cart). */
  corpus?: {
    inCorpus: boolean;
    onAdd: () => void;
    disabled?: boolean;
  };
}) {
  const [expanded, setExpanded] = useState(false);
  const abs = paper.abstract;
  const needTruncate =
    abs != null && abs.length > ABSTRACT_PREVIEW_CHARS;
  const shown =
    abs == null
      ? null
      : !needTruncate || expanded
        ? abs
        : `${abs.slice(0, ABSTRACT_PREVIEW_CHARS).trim()}…`;

  const toggleId = useId();

  return (
    <article className="rounded-xl border border-zinc-200/90 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/40">
      <div className="flex flex-wrap items-start justify-between gap-2 gap-y-1">
        {corpus && (
          <button
            type="button"
            onClick={corpus.onAdd}
            disabled={corpus.disabled || corpus.inCorpus}
            className="inline-flex shrink-0 items-center gap-1 rounded-md border border-zinc-200 bg-zinc-50 px-2 py-1 text-xs font-medium text-zinc-700 shadow-sm hover:bg-zinc-100 disabled:pointer-events-none disabled:opacity-60 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            {corpus.inCorpus ? (
              <>
                <Check className="size-3.5 text-emerald-600 dark:text-emerald-400" aria-hidden />
                In corpus
              </>
            ) : (
              <>
                <Plus className="size-3.5" aria-hidden />
                Add to corpus
              </>
            )}
          </button>
        )}
        <h2 className="min-w-0 flex-1 text-base font-semibold leading-snug text-zinc-900 dark:text-zinc-50">
          {paper.title}
        </h2>
        {paper.url ? (
          <a
            href={paper.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex shrink-0 items-center gap-1 rounded-md text-sm font-medium text-emerald-700 underline-offset-2 hover:underline dark:text-emerald-400"
          >
            Open
            <ExternalLink className="size-3.5" aria-hidden />
          </a>
        ) : (
          <span className="shrink-0 text-xs text-zinc-400 dark:text-zinc-500">
            No link
          </span>
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400">
        {paper.year != null && <span>{paper.year}</span>}
        <span>{paper.citationCount} citations</span>
        {paper.isOpenAccess && (
          <span className="rounded bg-emerald-100 px-1.5 py-0.5 font-medium text-emerald-900 dark:bg-emerald-950/80 dark:text-emerald-200">
            Open access
          </span>
        )}
        {paper.venue && (
          <span className="max-w-full truncate" title={paper.venue}>
            {paper.venue}
          </span>
        )}
      </div>

      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
        {authorSnippet(paper.authors)}
      </p>

      {shown != null && (
        <div className="mt-3">
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
            {shown}
          </p>
          {needTruncate && (
            <button
              type="button"
              id={toggleId}
              onClick={() => setExpanded((e) => !e)}
              className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-emerald-700 hover:underline dark:text-emerald-400"
              aria-expanded={expanded}
            >
              {expanded ? (
                <>
                  Show less <ChevronUp className="size-4" aria-hidden />
                </>
              ) : (
                <>
                  Show more <ChevronDown className="size-4" aria-hidden />
                </>
              )}
            </button>
          )}
        </div>
      )}
    </article>
  );
}
