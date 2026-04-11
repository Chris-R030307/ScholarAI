import {
  AI_CHAT_MAX_INPUT_CHARS,
  AI_CHAT_MAX_MESSAGE_CHARS,
  AI_CHAT_MAX_MESSAGES,
  AI_CHAT_MAX_PAPERS,
  AI_MAX_ABSTRACT_CHARS,
} from "@/lib/ai/constants";
import type { AiPaperInput } from "@/lib/ai/types";

export type ChatTurn = { role: "user" | "assistant"; content: string };

export type NormalizeChatResult =
  | {
      ok: true;
      messages: ChatTurn[];
      papers: AiPaperInput[];
      providerPreference?: "deepseek" | "gemini";
    }
  | { ok: false; code: string; message: string };

function trimAbstract(a: string | null): string | null {
  if (a == null || a === "") return null;
  if (a.length <= AI_MAX_ABSTRACT_CHARS) return a;
  return `${a.slice(0, AI_MAX_ABSTRACT_CHARS)}…`;
}

export function normalizeChatBody(body: unknown): NormalizeChatResult {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { ok: false, code: "BAD_REQUEST", message: "Invalid JSON body." };
  }
  const o = body as Record<string, unknown>;
  const papersRaw = o.papers;
  if (!Array.isArray(papersRaw) || papersRaw.length === 0) {
    return {
      ok: false,
      code: "BAD_REQUEST",
      message: "papers must be a non-empty array.",
    };
  }
  if (papersRaw.length > AI_CHAT_MAX_PAPERS) {
    return {
      ok: false,
      code: "BAD_REQUEST",
      message: `At most ${AI_CHAT_MAX_PAPERS} papers per chat request.`,
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

  const messagesRaw = o.messages;
  if (!Array.isArray(messagesRaw) || messagesRaw.length === 0) {
    return {
      ok: false,
      code: "BAD_REQUEST",
      message: "messages must be a non-empty array.",
    };
  }
  if (messagesRaw.length > AI_CHAT_MAX_MESSAGES) {
    return {
      ok: false,
      code: "BAD_REQUEST",
      message: `At most ${AI_CHAT_MAX_MESSAGES} chat turns per request.`,
    };
  }
  const messages: ChatTurn[] = [];
  for (const row of messagesRaw) {
    if (typeof row !== "object" || row === null || Array.isArray(row)) {
      return {
        ok: false,
        code: "BAD_REQUEST",
        message: "Each message must be an object with role and content.",
      };
    }
    const m = row as Record<string, unknown>;
    const role = m.role;
    const content = m.content;
    if (role !== "user" && role !== "assistant") {
      return {
        ok: false,
        code: "BAD_REQUEST",
        message: "Message role must be user or assistant.",
      };
    }
    if (typeof content !== "string" || content.trim() === "") {
      return {
        ok: false,
        code: "BAD_REQUEST",
        message: "Message content must be a non-empty string.",
      };
    }
    messages.push({
      role,
      content: content.trim().slice(0, AI_CHAT_MAX_MESSAGE_CHARS),
    });
  }
  const last = messages[messages.length - 1];
  if (last.role !== "user") {
    return {
      ok: false,
      code: "BAD_REQUEST",
      message: "The last message must be from the user.",
    };
  }

  let inputChars = 0;
  for (const m of messages) inputChars += m.content.length;
  for (const p of papers) {
    inputChars += p.id.length + p.title.length + (p.abstract?.length ?? 0);
  }
  if (inputChars > AI_CHAT_MAX_INPUT_CHARS) {
    return {
      ok: false,
      code: "BAD_REQUEST",
      message: "Request payload too large; shorten the chat or use fewer papers.",
    };
  }

  const prefRaw = o.providerPreference;
  let providerPreference: "deepseek" | "gemini" | undefined;
  if (prefRaw !== undefined && prefRaw !== null) {
    if (prefRaw !== "deepseek" && prefRaw !== "gemini") {
      return {
        ok: false,
        code: "BAD_REQUEST",
        message:
          'Field providerPreference must be "deepseek" or "gemini" when provided.',
      };
    }
    providerPreference = prefRaw;
  }

  return providerPreference
    ? { ok: true, messages, papers, providerPreference }
    : { ok: true, messages, papers };
}
