import { NextResponse } from "next/server";
import { aiSystemPrompt, buildUserPrompt } from "@/lib/ai/build-prompt";
import { AI_TIMEOUT_MS } from "@/lib/ai/constants";
import { normalizeAnalyzeBody } from "@/lib/ai/normalize-request";
import { parseAnalysisJson } from "@/lib/ai/parse-analysis";
import { callPrimaryLlmJson } from "@/lib/ai/providers";
import {
  recordClientOk,
  shouldThrottleClient,
} from "@/lib/ai/rate-limit";
import type { AiAnalyzeResponse } from "@/lib/ai/types";
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
    const bodyJson: AiAnalyzeResponse = {
      rankings: [],
      synthesis: "",
      error: {
        code: "LLM_DISABLED",
        message:
          "AI analyze is turned off on this server. The site owner can enable it in the host environment.",
      },
    };
    logOutcome({
      op: "ai_analyze",
      durationMs: Date.now() - t0,
      outcome: "client_error",
    });
    return NextResponse.json(bodyJson, { status: 503 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    const bodyJson: AiAnalyzeResponse = {
      rankings: [],
      synthesis: "",
      error: { code: "BAD_REQUEST", message: "Invalid JSON body." },
    };
    logOutcome({
      op: "ai_analyze",
      durationMs: Date.now() - t0,
      outcome: "client_error",
    });
    return NextResponse.json(bodyJson, { status: 400 });
  }

  const norm = normalizeAnalyzeBody(body);
  if (!norm.ok) {
    const bodyJson: AiAnalyzeResponse = {
      rankings: [],
      synthesis: "",
      error: { code: norm.code, message: norm.message },
    };
    logOutcome({
      op: "ai_analyze",
      durationMs: Date.now() - t0,
      outcome: "client_error",
    });
    return NextResponse.json(bodyJson, { status: 400 });
  }

  const deepseekKey = process.env.DEEPSEEK_API_KEY?.trim() || undefined;
  const geminiKey = process.env.GEMINI_API_KEY?.trim() || undefined;

  if (!deepseekKey && !geminiKey) {
    const bodyJson: AiAnalyzeResponse = {
      rankings: [],
      synthesis: "",
      error: {
        code: "NO_PROVIDER",
        message:
          "No LLM key configured. Add DEEPSEEK_API_KEY or GEMINI_API_KEY to web/.env.local.",
      },
    };
    logOutcome({
      op: "ai_analyze",
      durationMs: Date.now() - t0,
      outcome: "client_error",
    });
    return NextResponse.json(bodyJson, { status: 503 });
  }

  const key = clientKey(req);
  if (shouldThrottleClient(key)) {
    const bodyJson: AiAnalyzeResponse = {
      rankings: [],
      synthesis: "",
      error: {
        code: "RATE_LIMIT",
        message: "Please wait a few seconds before running AI analysis again.",
      },
    };
    logOutcome({
      op: "ai_analyze",
      durationMs: Date.now() - t0,
      outcome: "throttle",
    });
    return NextResponse.json(bodyJson, { status: 429 });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);

  try {
    const system = aiSystemPrompt();
    const user = buildUserPrompt(norm.researchGoal, norm.papers);
    const idOrder = norm.papers.map((p) => p.id);
    const validIds = new Set(idOrder);

    const llm = await callPrimaryLlmJson({
      deepseekKey,
      geminiKey,
      system,
      user,
      signal: controller.signal,
    });

    if (!llm.ok) {
      const status =
        llm.status === 429
          ? 429
          : llm.status && llm.status >= 400 && llm.status < 500
            ? 502
            : 502;
      const bodyJson: AiAnalyzeResponse = {
        rankings: [],
        synthesis: "",
        error: {
          code: "LLM_ERROR",
          message: llm.error,
        },
      };
      logOutcome({
        op: "ai_analyze",
        durationMs: Date.now() - t0,
        outcome: "llm_error",
        provider: deepseekKey ? "deepseek" : geminiKey ? "gemini" : undefined,
      });
      return NextResponse.json(bodyJson, { status });
    }

    const parsed = parseAnalysisJson(llm.raw, validIds, idOrder);
    if (!parsed.ok) {
      const bodyJson: AiAnalyzeResponse = {
        rankings: [],
        synthesis: "",
        error: { code: "PARSE_ERROR", message: parsed.message },
      };
      logOutcome({
        op: "ai_analyze",
        durationMs: Date.now() - t0,
        outcome: "parse_error",
        provider: llm.provider,
      });
      return NextResponse.json(bodyJson, { status: 502 });
    }

    recordClientOk(key);
    const bodyJson: AiAnalyzeResponse = {
      rankings: parsed.rankings,
      synthesis: parsed.synthesis,
      provider: llm.provider,
    };
    logOutcome({
      op: "ai_analyze",
      durationMs: Date.now() - t0,
      outcome: "ok",
      provider: llm.provider,
    });
    return NextResponse.json(bodyJson);
  } catch (e) {
    const aborted = e instanceof Error && e.name === "AbortError";
    const bodyJson: AiAnalyzeResponse = {
      rankings: [],
      synthesis: "",
      error: {
        code: aborted ? "TIMEOUT" : "LLM_ERROR",
        message: aborted
          ? "The model took too long. Try again with fewer papers or later."
          : "Unexpected error calling the model.",
      },
    };
    logOutcome({
      op: "ai_analyze",
      durationMs: Date.now() - t0,
      outcome: "llm_error",
    });
    return NextResponse.json(bodyJson, { status: aborted ? 504 : 502 });
  } finally {
    clearTimeout(timeout);
  }
}
