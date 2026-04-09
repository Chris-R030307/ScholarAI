"use client";

import { Loader2, MessageCircle } from "lucide-react";
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
  /** `null` = user has not submitted a corpus yet (Phase 5). */
  corpusPapers: Paper[] | null;
  corpusSignature: string;
  disabled?: boolean;
};

export function ResearchChat({
  corpusPapers,
  corpusSignature,
  disabled,
}: Props) {
  const awaitingCorpus = corpusPapers === null;
  const papers = useMemo(() => corpusPapers ?? [], [corpusPapers]);
  const [messages, setMessages] = useState<LocalMsg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<{ message: string; code?: string } | null>(
    null,
  );
  const [lastProvider, setLastProvider] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const prevSig = useRef<string | null>(null);

  useEffect(() => {
    if (prevSig.current !== null && prevSig.current !== corpusSignature) {
      setMessages([]);
      setErr(null);
      setLastProvider(null);
    }
    prevSig.current = corpusSignature;
  }, [corpusSignature]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
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
      awaitingCorpus ||
      papers.length === 0
    )
      return;
    setErr(null);
    setInput("");
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
    disabled,
    input,
    loading,
    messages,
    papers.length,
    payloadPapers,
  ]);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void send();
  }

  return (
    <section
      className="rounded-xl border border-sky-200/90 bg-sky-50/50 p-4 dark:border-sky-900/50 dark:bg-sky-950/20"
      aria-label="Research chat"
    >
      <h2 className="mb-2 flex items-center gap-2 text-sm font-medium text-sky-950 dark:text-sky-100">
        <MessageCircle className="size-4 shrink-0" aria-hidden />
        Research chat
        {lastProvider && (
          <span className="text-xs font-normal text-sky-800/80 dark:text-sky-200/80">
            via {lastProvider}
          </span>
        )}
      </h2>
      <p className="mb-3 text-xs text-sky-900/85 dark:text-sky-200/80">
        {awaitingCorpus
          ? "Submit a paper selection from the list to scope this chat. Answers use only those papers; unrelated questions get a scoped refusal."
          : "Answers use only the papers you submitted for chat. Unrelated questions get a scoped refusal."}
      </p>
      <div className="mb-3 max-h-64 space-y-3 overflow-y-auto rounded-lg border border-sky-200/60 bg-white/80 px-3 py-2 dark:border-sky-900/40 dark:bg-zinc-950/40">
        {awaitingCorpus && messages.length === 0 && !loading && (
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Check one or more papers in the results list, then click{" "}
            <strong className="font-medium text-zinc-700 dark:text-zinc-300">
              Submit selection for chat
            </strong>
            .
          </p>
        )}
        {!awaitingCorpus && messages.length === 0 && !loading && (
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Ask about methods, themes, or comparisons across your selected
            papers.
          </p>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={
              m.role === "user"
                ? "rounded-md bg-sky-100/90 px-2 py-1.5 text-sm text-sky-950 dark:bg-sky-950/50 dark:text-sky-50"
                : "text-sm text-zinc-800 dark:text-zinc-200"
            }
          >
            <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
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
              <p className="whitespace-pre-wrap">{m.content}</p>
            )}
          </div>
        ))}
        {loading && (
          <p className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-300">
            <Loader2 className="size-3.5 animate-spin" aria-hidden />
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
            disabled || loading || awaitingCorpus || papers.length === 0
          }
          placeholder="e.g. Which papers use qualitative methods?"
          className="resize-y rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none ring-sky-600/20 placeholder:text-zinc-400 focus:border-sky-600/40 focus:ring-2 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
        />
        <button
          type="submit"
          disabled={
            disabled ||
            loading ||
            awaitingCorpus ||
            papers.length === 0 ||
            !input.trim()
          }
          className="self-start rounded-lg bg-sky-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-800 disabled:opacity-60 dark:bg-sky-600 dark:hover:bg-sky-500"
        >
          Send
        </button>
      </form>
    </section>
  );
}
