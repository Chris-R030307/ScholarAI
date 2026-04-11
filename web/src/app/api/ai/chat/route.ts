import { NextResponse } from "next/server";
import { buildChatUserPayload, chatSystemPrompt } from "@/lib/ai/build-chat-prompt";
import { chunkPapers } from "@/lib/ai/chunk-papers";
import { AI_CHAT_TOP_CHUNKS, AI_TIMEOUT_MS } from "@/lib/ai/constants";
import { normalizeChatBody } from "@/lib/ai/normalize-chat-request";
import { parseChatJson } from "@/lib/ai/parse-chat-json";
import { callPrimaryLlmJson } from "@/lib/ai/providers";
import {
  recordClientOk,
  shouldThrottleClient,
} from "@/lib/ai/rate-limit";
import { retrieveTopChunks } from "@/lib/ai/retrieve-chunks";
import type { AiChatResponse } from "@/lib/ai/types";
import { isLlmAdminDisabled } from "@/lib/llm-admin";

export const runtime = "nodejs";

function clientKey(req: Request): string {
  const h = req.headers;
  const fwd = h.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]?.trim() || "unknown";
  const real = h.get("x-real-ip");
  if (real) return real.trim();
  return "unknown";
}

function logOutcome(params: {
  op: string;
  durationMs: number;
  outcome: "ok" | "client_error" | "llm_error" | "parse_error" | "throttle";
  provider?: string;
}) {
  console.info(
    JSON.stringify({
      op: params.op,
      durationMs: params.durationMs,
      outcome: params.outcome,
      provider: params.provider,
    }),
  );
}

export async function POST(req: Request) {
  const t0 = Date.now();

  if (isLlmAdminDisabled()) {
    const bodyJson: AiChatResponse = {
      reply: "",
      citations: [],
      outOfCorpus: true,
      error: {
        code: "LLM_DISABLED",
        message:
          "AI chat is turned off on this server. The site owner can enable it in the host environment.",
      },
    };
    logOutcome({
      op: "ai_chat",
      durationMs: Date.now() - t0,
      outcome: "client_error",
    });
    return NextResponse.json(bodyJson, { status: 503 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    const bodyJson: AiChatResponse = {
      reply: "",
      citations: [],
      outOfCorpus: true,
      error: { code: "BAD_REQUEST", message: "Invalid JSON body." },
    };
    logOutcome({
      op: "ai_chat",
      durationMs: Date.now() - t0,
      outcome: "client_error",
    });
    return NextResponse.json(bodyJson, { status: 400 });
  }

  const norm = normalizeChatBody(body);
  if (!norm.ok) {
    const bodyJson: AiChatResponse = {
      reply: "",
      citations: [],
      outOfCorpus: true,
      error: { code: norm.code, message: norm.message },
    };
    logOutcome({
      op: "ai_chat",
      durationMs: Date.now() - t0,
      outcome: "client_error",
    });
    return NextResponse.json(bodyJson, { status: 400 });
  }

  const deepseekKey = process.env.DEEPSEEK_API_KEY?.trim() || undefined;
  const geminiKey = process.env.GEMINI_API_KEY?.trim() || undefined;
  const pref = norm.providerPreference;

  if (pref === "deepseek" && !deepseekKey) {
    const bodyJson: AiChatResponse = {
      reply: "",
      citations: [],
      outOfCorpus: true,
      error: {
        code: "PROVIDER_UNAVAILABLE",
        message:
          "DeepSeek is selected but DEEPSEEK_API_KEY is not set. Choose Gemini in the model picker or add the key to web/.env.local.",
      },
    };
    logOutcome({
      op: "ai_chat",
      durationMs: Date.now() - t0,
      outcome: "client_error",
    });
    return NextResponse.json(bodyJson, { status: 503 });
  }
  if (pref === "gemini" && !geminiKey) {
    const bodyJson: AiChatResponse = {
      reply: "",
      citations: [],
      outOfCorpus: true,
      error: {
        code: "PROVIDER_UNAVAILABLE",
        message:
          "Gemini is selected but GEMINI_API_KEY is not set. Choose DeepSeek in the model picker or add the key to web/.env.local.",
      },
    };
    logOutcome({
      op: "ai_chat",
      durationMs: Date.now() - t0,
      outcome: "client_error",
    });
    return NextResponse.json(bodyJson, { status: 503 });
  }

  if (!deepseekKey && !geminiKey) {
    const bodyJson: AiChatResponse = {
      reply: "",
      citations: [],
      outOfCorpus: true,
      error: {
        code: "NO_PROVIDER",
        message:
          "No LLM key configured. Add DEEPSEEK_API_KEY or GEMINI_API_KEY to web/.env.local.",
      },
    };
    logOutcome({
      op: "ai_chat",
      durationMs: Date.now() - t0,
      outcome: "client_error",
    });
    return NextResponse.json(bodyJson, { status: 503 });
  }

  const key = clientKey(req);
  if (shouldThrottleClient(key, "chat")) {
    const bodyJson: AiChatResponse = {
      reply: "",
      citations: [],
      outOfCorpus: true,
      error: {
        code: "RATE_LIMIT",
        message: "Please wait a moment before sending another chat message.",
      },
    };
    logOutcome({
      op: "ai_chat",
      durationMs: Date.now() - t0,
      outcome: "throttle",
    });
    return NextResponse.json(bodyJson, { status: 429 });
  }

  const validIds = new Set(norm.papers.map((p) => p.id));
  const lastUser = norm.messages[norm.messages.length - 1].content;
  const allChunks = chunkPapers(norm.papers);
  const retrieved =
    allChunks.length > 0
      ? retrieveTopChunks(lastUser, allChunks, AI_CHAT_TOP_CHUNKS)
      : [];

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);

  try {
    const system = chatSystemPrompt();
    const user = buildChatUserPayload({
      messages: norm.messages,
      retrievedChunks: retrieved,
    });

    const llm = await callPrimaryLlmJson({
      deepseekKey,
      geminiKey,
      system,
      user,
      signal: controller.signal,
      preference: pref,
    });

    if (!llm.ok) {
      const status =
        llm.status === 429
          ? 429
          : llm.status && llm.status >= 400 && llm.status < 500
            ? 502
            : 502;
      const bodyJson: AiChatResponse = {
        reply: "",
        citations: [],
        outOfCorpus: true,
        error: { code: "LLM_ERROR", message: llm.error },
      };
      logOutcome({
        op: "ai_chat",
        durationMs: Date.now() - t0,
        outcome: "llm_error",
        provider: pref ?? (deepseekKey ? "deepseek" : geminiKey ? "gemini" : undefined),
      });
      return NextResponse.json(bodyJson, { status });
    }

    const parsed = parseChatJson(llm.raw, validIds);
    if (!parsed.ok) {
      const bodyJson: AiChatResponse = {
        reply: "",
        citations: [],
        outOfCorpus: true,
        error: { code: "PARSE_ERROR", message: parsed.message },
      };
      logOutcome({
        op: "ai_chat",
        durationMs: Date.now() - t0,
        outcome: "parse_error",
        provider: llm.provider,
      });
      return NextResponse.json(bodyJson, { status: 502 });
    }

    recordClientOk(key, "chat");
    const bodyJson: AiChatResponse = {
      reply: parsed.value.reply,
      citations: parsed.value.citations,
      outOfCorpus: parsed.value.outOfCorpus,
      provider: llm.provider,
    };
    logOutcome({
      op: "ai_chat",
      durationMs: Date.now() - t0,
      outcome: "ok",
      provider: llm.provider,
    });
    return NextResponse.json(bodyJson);
  } catch (e) {
    const aborted = e instanceof Error && e.name === "AbortError";
    const bodyJson: AiChatResponse = {
      reply: "",
      citations: [],
      outOfCorpus: true,
      error: {
        code: aborted ? "TIMEOUT" : "LLM_ERROR",
        message: aborted
          ? "The model took too long. Try a shorter question."
          : "Unexpected error calling the model.",
      },
    };
    logOutcome({
      op: "ai_chat",
      durationMs: Date.now() - t0,
      outcome: "llm_error",
    });
    return NextResponse.json(bodyJson, { status: aborted ? 504 : 502 });
  } finally {
    clearTimeout(timeout);
  }
}
