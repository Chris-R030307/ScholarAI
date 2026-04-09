import {
  AI_MAX_ABSTRACT_CHARS,
  AI_MAX_INPUT_CHARS,
  AI_MAX_PAPERS,
} from "@/lib/ai/constants";
import type { AiPaperInput } from "@/lib/ai/types";

const MAX_GOAL_LEN = 4000;

function trimAbstract(a: string | null): string | null {
  if (a == null || a === "") return null;
  if (a.length <= AI_MAX_ABSTRACT_CHARS) return a;
  return `${a.slice(0, AI_MAX_ABSTRACT_CHARS)}…`;
}

export type NormalizeResult =
  | { ok: true; researchGoal: string; papers: AiPaperInput[] }
  | { ok: false; code: string; message: string };

export function normalizeAnalyzeBody(body: unknown): NormalizeResult {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { ok: false, code: "BAD_REQUEST", message: "Invalid JSON body." };
  }
  const o = body as Record<string, unknown>;
  const goal = o.researchGoal;
  if (typeof goal !== "string" || goal.trim() === "") {
    return {
      ok: false,
      code: "BAD_REQUEST",
      message: "researchGoal must be a non-empty string.",
    };
  }
  const researchGoal = goal.trim().slice(0, MAX_GOAL_LEN);
  const papersRaw = o.papers;
  if (!Array.isArray(papersRaw) || papersRaw.length === 0) {
    return {
      ok: false,
      code: "BAD_REQUEST",
      message: "papers must be a non-empty array.",
    };
  }
  if (papersRaw.length > AI_MAX_PAPERS) {
    return {
      ok: false,
      code: "BAD_REQUEST",
      message: `At most ${AI_MAX_PAPERS} papers per request.`,
    };
  }
  const papers: AiPaperInput[] = [];
  const seen = new Set<string>();
  for (const row of papersRaw) {
    if (typeof row !== "object" || row === null || Array.isArray(row)) {
      return {
        ok: false,
        code: "BAD_REQUEST",
        message: "Each paper must be an object with id and title.",
      };
    }
    const p = row as Record<string, unknown>;
    const id = p.id;
    const title = p.title;
    if (typeof id !== "string" || id.trim() === "") {
      return { ok: false, code: "BAD_REQUEST", message: "Invalid paper id." };
    }
    if (typeof title !== "string" || title.trim() === "") {
      return {
        ok: false,
        code: "BAD_REQUEST",
        message: "Each paper needs a non-empty title.",
      };
    }
    if (seen.has(id)) {
      return {
        ok: false,
        code: "BAD_REQUEST",
        message: "Duplicate paper ids in request.",
      };
    }
    seen.add(id);
    const abstract =
      p.abstract === null || p.abstract === undefined
        ? null
        : typeof p.abstract === "string"
          ? trimAbstract(p.abstract)
          : null;
    papers.push({
      id,
      title: title.trim().slice(0, 2000),
      abstract,
    });
  }
  let inputChars = researchGoal.length;
  for (const p of papers) {
    inputChars += p.id.length + p.title.length + (p.abstract?.length ?? 0);
  }
  if (inputChars > AI_MAX_INPUT_CHARS) {
    return {
      ok: false,
      code: "BAD_REQUEST",
      message: "Request payload too large; reduce abstracts or fewer papers.",
    };
  }
  return { ok: true, researchGoal, papers };
}
