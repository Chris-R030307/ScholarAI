"use client";

import { Download, Loader2, MessageCircle } from "lucide-react";
import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AiSynthesis } from "@/components/ai-synthesis";
import type { ChatTurn } from "@/lib/ai/normalize-chat-request";
import type { AiChatResponse } from "@/lib/ai/types";
import type { LlmProviderId } from "@/lib/llm-provider-preference";
import type { Paper } from "@/lib/paper";

type LocalUser = { role: "user"; content: string };
type LocalAssistant = {
  role: "assistant";
  content: string;
  citations: string[];
};
type LocalMsg = LocalUser | LocalAssistant;

function toApiMessages(msgs: LocalMsg[]): ChatTurn[] {
  return msgs.map((m) => ({ role: m.role, content: m.content }));
}

type Props = {
  /** Papers in the corpus cart (Phase 6); chat is disabled when empty. */
  corpusPapers: Paper[];
  corpusSignature: string;
  /** Shared with AI search plan — server-only keys; this only selects routing. */
  llmProvider: LlmProviderId;
  /** Server env `SCHOLARAI_LLM_DISABLED` — administrator turned off all LLM APIs. */
  adminLlmOff?: boolean;
  disabled?: boolean;
};

function buildExportMarkdown(params: {
  messages: LocalMsg[];
  papers: Paper[];
}): string {
  const exportedAt = new Date().toISOString();
  const lines: string[] = [
    "# ScholarAI — research chat export",
    "",
    `_Exported: ${exportedAt}_`,
    "",
    "## Corpus",
    "",
  ];
  for (const p of params.papers) {
    lines.push(`- \`${p.id}\`: ${p.title}`);
  }
  lines.push("", "---", "", "## Conversation", "");
  let turn = 0;
  for (const m of params.messages) {
    turn += 1;
    if (m.role === "user") {
      lines.push(`### ${turn} — You`, "", m.content, "");
    } else {
      lines.push(`### ${turn} — Assistant`, "", m.content, "");
      if (m.citations.length > 0) {
        lines.push(
          "",
          "**Citation paper ids:** " + m.citations.map((id) => `\`${id}\``).join(", "),
          "",
        );
      }
    }
  }
  return lines.join("\n");
}

export function ResearchChat({
  corpusPapers,
  corpusSignature,
  llmProvider,
  adminLlmOff,
  disabled,
}: Props) {
  const papers = corpusPapers;
  const awaitingCorpus = papers.length === 0;
  const chatLocked = Boolean(adminLlmOff);
  const [messages, setMessages] = useState<LocalMsg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<{ message: string; code?: string } | null>(
    null,
  );
  const [lastProvider, setLastProvider] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const prevSig = useRef<string | null>(null);
  const prefersReducedMotion = useRef(false);

  useEffect(() => {
    prefersReducedMotion.current =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  useEffect(() => {
    if (prevSig.current !== null && prevSig.current !== corpusSignature) {
      setMessages([]);
      setErr(null);
      setLastProvider(null);
    }
    prevSig.current = corpusSignature;
  }, [corpusSignature]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({
      behavior: prefersReducedMotion.current ? "auto" : "smooth",
    });
  }, [messages, loading]);

  const titleById = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of papers) m.set(p.id, p.title);
    return m;
  }, [papers]);

  const payloadPapers = useMemo(
    () =>
      papers.map((p) => ({
        id: p.id,
        title: p.title,
        abstract: p.abstract,
      })),
    [papers],
  );

  const send = useCallback(async () => {
    const text = input.trim();
    if (
      !text ||
      loading ||
      disabled ||
      chatLocked ||
      awaitingCorpus ||
      papers.length === 0
    )
      return;
    setErr(null);
    const userTurn: LocalUser = { role: "user", content: text };
    const prior = messages;
    const nextHistory: LocalMsg[] = [...prior, userTurn];
    setMessages(nextHistory);
    setLoading(true);
    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: toApiMessages(nextHistory),
          papers: payloadPapers,
          providerPreference: llmProvider,
        }),
      });
      const data = (await res.json()) as AiChatResponse;
      if (data.error) {
        setMessages(prior);
        setErr({
          message: data.error.message,
          code: data.error.code,
        });
        return;
      }
      setInput("");
      setLastProvider(data.provider ?? null);
      const assistantTurn: LocalAssistant = {
        role: "assistant",
        content: data.reply,
        citations: data.citations,
      };
      setMessages([...nextHistory, assistantTurn]);
    } catch (e) {
      setMessages(prior);
      setErr({
        message:
          e instanceof Error
            ? e.message
            : "Could not send message. Try again.",
      });
    } finally {
      setLoading(false);
    }
  }, [
    awaitingCorpus,
    chatLocked,
    disabled,
    input,
    loading,
    messages,
    papers.length,
    payloadPapers,
    llmProvider,
  ]);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void send();
  }

  const retryable =
    err &&
    (err.code === "LLM_ERROR" ||
      err.code === "PARSE_ERROR" ||
      err.code === "TIMEOUT");

  return (
    <section
      className="rounded-xl border border-sky-200/90 bg-sky-50/50 p-4 transition-colors duration-150 motion-reduce:transition-none dark:border-sky-900/50 dark:bg-sky-950/20"
      aria-label="Research chat"
    >
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-medium text-sky-950 dark:text-sky-100">
          <MessageCircle className="size-4 shrink-0" aria-hidden />
          Research chat
          {lastProvider && (
            <span className="text-xs font-normal text-sky-800/80 dark:text-sky-200/80">
              via {lastProvider}
            </span>
          )}
        </h2>
        {messages.length > 0 && (
          <button
            type="button"
            onClick={() => {
              const md = buildExportMarkdown({ messages, papers });
              const blob = new Blob([md], {
                type: "text/markdown;charset=utf-8",
              });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              const day = new Date().toISOString().slice(0, 10);
              a.href = url;
              a.download = `scholarai-chat-${day}.md`;
              a.click();
              URL.revokeObjectURL(url);
            }}
            className="inline-flex items-center gap-1 rounded-md border border-sky-300/80 bg-white/90 px-2 py-1 text-xs font-medium text-sky-900 shadow-sm transition-colors duration-150 hover:bg-sky-50 motion-reduce:transition-none dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-100 dark:hover:bg-sky-900/50"
          >
            <Download className="size-3.5 shrink-0" aria-hidden />
            Download
          </button>
        )}
      </div>
      <p className="mb-3 text-xs text-sky-900/85 dark:text-sky-200/80">
        {chatLocked
          ? "Research chat is turned off on this server by the administrator."
          : awaitingCorpus
            ? "Add papers to your corpus from results. Chat answers use only those papers; unrelated questions get a scoped refusal."
            : "Answers use only papers in your corpus. Unrelated questions get a scoped refusal."}
      </p>
      <div className="mb-3 flex max-h-80 min-h-[8rem] flex-col gap-3 overflow-y-auto rounded-lg border border-sky-200/60 bg-white/80 px-3 py-3 dark:border-sky-900/40 dark:bg-zinc-950/40">
        {awaitingCorpus && messages.length === 0 && !loading && (
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Use{" "}
            <span className="font-medium text-zinc-700 dark:text-zinc-300">
              Add to corpus
            </span>{" "}
            on result cards. Your list is saved for this session even if you
            search again.
          </p>
        )}
        {!awaitingCorpus && messages.length === 0 && !loading && (
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Ask about methods, themes, or comparisons across your corpus
            papers.
          </p>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={
              m.role === "user"
                ? "ml-auto max-w-[min(100%,28rem)] rounded-2xl rounded-br-md bg-sky-600 px-3 py-2 text-sm text-white shadow-sm dark:bg-sky-700"
                : "mr-auto max-w-[min(100%,32rem)] rounded-2xl rounded-bl-md border border-zinc-200/90 bg-white px-3 py-2 text-sm text-zinc-800 shadow-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            }
          >
            <span
              className={
                m.role === "user"
                  ? "mb-1 block text-[10px] font-semibold uppercase tracking-wide text-sky-100/95"
                  : "mb-1 block text-[10px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400"
              }
            >
              {m.role === "user" ? "You" : "Assistant"}
            </span>
            {m.role === "assistant" ? (
              <>
                <AiSynthesis markdown={m.content} />
                {m.citations.length > 0 && (
                  <ul className="mt-2 flex flex-wrap gap-1 text-xs">
                    {m.citations.map((id) => (
                      <li key={id}>
                        <span className="rounded bg-emerald-100/90 px-1.5 py-0.5 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-100">
                          {titleById.get(id) ?? id}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            ) : (
              <p className="whitespace-pre-wrap text-white">{m.content}</p>
            )}
          </div>
        ))}
        {loading && (
          <p className="mr-auto flex max-w-[min(100%,20rem)] items-center gap-2 rounded-2xl border border-zinc-200/80 bg-zinc-50 px-3 py-2 text-xs text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
            <Loader2
              className="size-3.5 motion-safe:animate-spin"
              aria-hidden
            />
            Thinking…
          </p>
        )}
        <div ref={bottomRef} />
      </div>
      {err && (
        <div
          role="alert"
          className="mb-2 rounded-md border border-red-200 bg-red-50/90 px-2 py-1.5 text-xs text-red-900 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-100"
        >
          <p>{err.message}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setErr(null)}
              className="rounded border border-red-200/80 bg-white px-2 py-0.5 text-[11px] font-medium hover:bg-red-50 dark:border-red-800 dark:bg-red-950/20 dark:hover:bg-red-950/40"
            >
              Dismiss
            </button>
            {retryable && input.trim() !== "" && (
              <button
                type="button"
                onClick={() => void send()}
                disabled={loading || disabled}
                className="rounded border border-red-200/80 bg-white px-2 py-0.5 text-[11px] font-medium hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:bg-red-950/20 dark:hover:bg-red-950/40"
              >
                Retry send
              </button>
            )}
          </div>
          {err.code === "PROVIDER_UNAVAILABLE" && (
            <p className="mt-2 border-t border-red-200/80 pt-2 text-red-800/95 dark:border-red-800/50 dark:text-red-100/90">
              Switch the{" "}
              <span className="font-medium">LLM provider</span> control above
              the search box to a model you have configured, or add the missing
              key to{" "}
              <code className="rounded bg-red-100/80 px-1 py-0.5 text-[10px] dark:bg-red-900/50">
                web/.env.local
              </code>
              .
            </p>
          )}
          {err.code === "NO_PROVIDER" && (
            <p className="mt-2 border-t border-red-200/80 pt-2 text-red-800/95 dark:border-red-800/50 dark:text-red-100/90">
              Add{" "}
              <code className="rounded bg-red-100/80 px-1 py-0.5 text-[10px] dark:bg-red-900/50">
                DEEPSEEK_API_KEY
              </code>{" "}
              or{" "}
              <code className="rounded bg-red-100/80 px-1 py-0.5 text-[10px] dark:bg-red-900/50">
                GEMINI_API_KEY
              </code>{" "}
              to{" "}
              <code className="rounded bg-red-100/80 px-1 py-0.5 text-[10px] dark:bg-red-900/50">
                web/.env.local
              </code>{" "}
              and restart the dev server.
            </p>
          )}
          {err.code === "RATE_LIMIT" && (
            <p className="mt-2 border-t border-red-200/80 pt-2 text-red-800/95 dark:border-red-800/50 dark:text-red-100/90">
              The server limits how often you can send chat messages. Wait a few
              seconds, then try again.
            </p>
          )}
        </div>
      )}
      <form onSubmit={onSubmit} className="flex flex-col gap-2">
        <label htmlFor="research-chat-input" className="sr-only">
          Chat message
        </label>
        <textarea
          id="research-chat-input"
          rows={2}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={
            disabled ||
            loading ||
            chatLocked ||
            awaitingCorpus ||
            papers.length === 0
          }
          placeholder="e.g. Which papers use qualitative methods?"
          className="resize-y rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none ring-sky-600/20 placeholder:text-zinc-400 focus:border-sky-600/40 focus:ring-2 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
        />
        <button
          type="submit"
          disabled={
            disabled ||
            loading ||
            chatLocked ||
            awaitingCorpus ||
            papers.length === 0 ||
            !input.trim()
          }
          className="self-start rounded-lg bg-sky-700 px-3 py-1.5 text-sm font-medium text-white transition-colors duration-150 hover:bg-sky-800 disabled:opacity-60 motion-reduce:transition-none dark:bg-sky-600 dark:hover:bg-sky-500"
        >
          {loading ? (
            <span className="inline-flex items-center gap-1.5">
              <Loader2
                className="size-3.5 motion-safe:animate-spin"
                aria-hidden
              />
              Send
            </span>
          ) : (
            "Send"
          )}
        </button>
      </form>
    </section>
  );
}
