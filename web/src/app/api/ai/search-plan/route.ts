import { NextResponse } from "next/server";
import {
  searchPlanSystemPrompt,
  searchPlanUserPrompt,
} from "@/lib/ai/build-search-plan-prompt";
import { AI_TIMEOUT_MS } from "@/lib/ai/constants";
import { normalizeSearchPlanBody } from "@/lib/ai/normalize-search-plan-request";
import { parseSearchPlanJson } from "@/lib/ai/parse-search-plan";
import { callPrimaryLlmJson } from "@/lib/ai/providers";
import {
  recordClientOk,
  shouldThrottleClient,
} from "@/lib/ai/rate-limit";
import type { AiSearchPlanResponse } from "@/lib/ai/types";

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
  durationMs: number;
  outcome: "ok" | "client_error" | "llm_error" | "parse_error" | "throttle";
  provider?: string;
}) {
  console.info(
    JSON.stringify({
      op: "ai_search_plan",
      durationMs: params.durationMs,
      outcome: params.outcome,
      provider: params.provider,
    }),
  );
}

function errBody(
  code: string,
  message: string,
  status: number,
): NextResponse {
  const body: AiSearchPlanResponse = {
    queries: [],
    filtersPatch: {},
    error: { code, message },
  };
  return NextResponse.json(body, { status });
}

export async function POST(req: Request) {
  const t0 = Date.now();
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    logOutcome({
      durationMs: Date.now() - t0,
      outcome: "client_error",
    });
    return errBody("BAD_REQUEST", "Invalid JSON body.", 400);
  }

  const norm = normalizeSearchPlanBody(body);
  if (!norm.ok) {
    logOutcome({
      durationMs: Date.now() - t0,
      outcome: "client_error",
    });
    return errBody(norm.code, norm.message, 400);
  }

  const deepseekKey = process.env.DEEPSEEK_API_KEY?.trim() || undefined;
  const geminiKey = process.env.GEMINI_API_KEY?.trim() || undefined;

  if (!deepseekKey && !geminiKey) {
    logOutcome({
      durationMs: Date.now() - t0,
      outcome: "client_error",
    });
    return errBody(
      "NO_PROVIDER",
      "No LLM key configured. Add DEEPSEEK_API_KEY or GEMINI_API_KEY to web/.env.local.",
      503,
    );
  }

  const key = clientKey(req);
  if (shouldThrottleClient(key, "searchPlan")) {
    logOutcome({ durationMs: Date.now() - t0, outcome: "throttle" });
    return errBody(
      "RATE_LIMIT",
      "Please wait a few seconds before another AI search request.",
      429,
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);

  try {
    const system = searchPlanSystemPrompt();
    const user = searchPlanUserPrompt(norm.intent);
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
      logOutcome({
        durationMs: Date.now() - t0,
        outcome: "llm_error",
        provider: deepseekKey ? "deepseek" : geminiKey ? "gemini" : undefined,
      });
      return errBody("LLM_ERROR", llm.error, status);
    }

    const parsed = parseSearchPlanJson(llm.raw);
    if (!parsed.ok) {
      logOutcome({
        durationMs: Date.now() - t0,
        outcome: "parse_error",
        provider: llm.provider,
      });
      return errBody("PARSE_ERROR", parsed.message, 502);
    }

    recordClientOk(key, "searchPlan");
    const bodyJson: AiSearchPlanResponse = {
      queries: parsed.value.queries,
      filtersPatch: parsed.value.filtersPatch,
      rationale: parsed.value.rationale,
      provider: llm.provider,
    };
    logOutcome({
      durationMs: Date.now() - t0,
      outcome: "ok",
      provider: llm.provider,
    });
    return NextResponse.json(bodyJson);
  } catch (e) {
    const aborted = e instanceof Error && e.name === "AbortError";
    logOutcome({ durationMs: Date.now() - t0, outcome: "llm_error" });
    return errBody(
      aborted ? "TIMEOUT" : "LLM_ERROR",
      aborted
        ? "The model took too long. Try a shorter description."
        : "Unexpected error calling the model.",
      aborted ? 504 : 502,
    );
  } finally {
    clearTimeout(timeout);
  }
}
