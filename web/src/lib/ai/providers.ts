import { AI_LLM_MAX_OUTPUT_TOKENS } from "@/lib/ai/constants";

type LlmOk = { raw: string };
type LlmErr = { error: string; status?: number };

async function readErrorMessage(res: Response): Promise<string> {
  try {
    const text = await res.text();
    if (text) {
      try {
        const j = JSON.parse(text) as {
          error?: { message?: string };
          message?: string;
        };
        const m = j?.error?.message ?? j?.message;
        if (typeof m === "string" && m) return m;
      } catch {
        const t = text.slice(0, 280).trim();
        if (t) return t;
      }
    }
  } catch {
    /* ignore */
  }
  return `HTTP ${res.status}`;
}

export async function callDeepSeekJson(params: {
  apiKey: string;
  system: string;
  user: string;
  signal: AbortSignal;
}): Promise<LlmOk | LlmErr> {
  let res: Response;
  try {
    res = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      signal: params.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${params.apiKey}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: params.system },
          { role: "user", content: params.user },
        ],
        response_format: { type: "json_object" },
        max_tokens: AI_LLM_MAX_OUTPUT_TOKENS,
      }),
    });
  } catch (e) {
    const msg =
      e instanceof Error ? e.message : "Network error calling DeepSeek.";
    return { error: `DeepSeek request failed: ${msg}` };
  }
  if (!res.ok) {
    return { error: await readErrorMessage(res), status: res.status };
  }
  let data: { choices?: Array<{ message?: { content?: string } }> };
  try {
    data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
  } catch {
    return { error: "Invalid JSON from DeepSeek." };
  }
  const raw = data.choices?.[0]?.message?.content;
  if (typeof raw !== "string" || raw.trim() === "") {
    return { error: "Empty DeepSeek response." };
  }
  return { raw };
}

const GEMINI_MODEL = "gemini-2.0-flash";

export async function callGeminiJson(params: {
  apiKey: string;
  system: string;
  user: string;
  signal: AbortSignal;
}): Promise<LlmOk | LlmErr> {
  const url = new URL(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
  );
  url.searchParams.set("key", params.apiKey);

  let res: Response;
  try {
    res = await fetch(url.toString(), {
      method: "POST",
      signal: params.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: params.system }] },
        contents: [{ role: "user", parts: [{ text: params.user }] }],
        generationConfig: {
          responseMimeType: "application/json",
          maxOutputTokens: AI_LLM_MAX_OUTPUT_TOKENS,
        },
      }),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Network error";
    return { error: `Gemini request failed (${msg}).` };
  }
  if (!res.ok) {
    return { error: await readErrorMessage(res), status: res.status };
  }
  let data: {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
    }>;
  };
  try {
    data = (await res.json()) as {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
      }>;
    };
  } catch {
    return { error: "Gemini returned invalid JSON." };
  }
  const parts = data.candidates?.[0]?.content?.parts;
  const raw = parts?.map((p) => p.text ?? "").join("") ?? "";
  if (raw.trim() === "") {
    return { error: "Empty Gemini response." };
  }
  return { raw };
}

/** When set, only that provider is called (no cross-provider fallback). */
export type PrimaryLlmPreference = "deepseek" | "gemini" | undefined;

export async function callPrimaryLlmJson(params: {
  deepseekKey: string | undefined;
  geminiKey: string | undefined;
  system: string;
  user: string;
  signal: AbortSignal;
  preference?: PrimaryLlmPreference;
}): Promise<
  | { ok: true; raw: string; provider: "deepseek" | "gemini" }
  | { ok: false; error: string; status?: number }
> {
  const pref = params.preference;

  if (pref === "deepseek") {
    if (!params.deepseekKey) {
      return {
        ok: false,
        error:
          "DeepSeek is selected but DEEPSEEK_API_KEY is not set in web/.env.local.",
      };
    }
    const r = await callDeepSeekJson({
      apiKey: params.deepseekKey,
      system: params.system,
      user: params.user,
      signal: params.signal,
    });
    if ("raw" in r) {
      return { ok: true, raw: r.raw, provider: "deepseek" };
    }
    return { ok: false, error: r.error, status: r.status };
  }

  if (pref === "gemini") {
    if (!params.geminiKey) {
      return {
        ok: false,
        error:
          "Gemini is selected but GEMINI_API_KEY is not set in web/.env.local.",
      };
    }
    const g = await callGeminiJson({
      apiKey: params.geminiKey,
      system: params.system,
      user: params.user,
      signal: params.signal,
    });
    if ("raw" in g) {
      return { ok: true, raw: g.raw, provider: "gemini" };
    }
    return { ok: false, error: g.error, status: g.status };
  }

  if (params.deepseekKey) {
    const r = await callDeepSeekJson({
      apiKey: params.deepseekKey,
      system: params.system,
      user: params.user,
      signal: params.signal,
    });
    if ("raw" in r) {
      return { ok: true, raw: r.raw, provider: "deepseek" };
    }
    if (params.geminiKey) {
      const g = await callGeminiJson({
        apiKey: params.geminiKey,
        system: params.system,
        user: params.user,
        signal: params.signal,
      });
      if ("raw" in g) {
        return { ok: true, raw: g.raw, provider: "gemini" };
      }
      return { ok: false, error: g.error, status: g.status };
    }
    return { ok: false, error: r.error, status: r.status };
  }
  if (params.geminiKey) {
    const g = await callGeminiJson({
      apiKey: params.geminiKey,
      system: params.system,
      user: params.user,
      signal: params.signal,
    });
    if ("raw" in g) {
      return { ok: true, raw: g.raw, provider: "gemini" };
    }
    return { ok: false, error: g.error, status: g.status };
  }
  return {
    ok: false,
    error:
      "No LLM API key configured. Set DEEPSEEK_API_KEY or GEMINI_API_KEY in web/.env.local.",
  };
}
