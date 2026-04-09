export type ParsedChatReply = {
  reply: string;
  citations: string[];
  outOfCorpus: boolean;
};

export type ParseChatResult =
  | { ok: true; value: ParsedChatReply }
  | { ok: false; message: string };

export function parseChatJson(
  raw: string,
  validPaperIds: Set<string>,
): ParseChatResult {
  let data: unknown;
  try {
    data = JSON.parse(raw) as unknown;
  } catch {
    return { ok: false, message: "Model returned invalid JSON." };
  }
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    return { ok: false, message: "Model JSON must be an object." };
  }
  const o = data as Record<string, unknown>;
  const reply = o.reply;
  const citationsRaw = o.citations;
  const outOfCorpus = o.outOfCorpus;
  if (typeof reply !== "string" || reply.trim() === "") {
    return { ok: false, message: 'Model JSON must include non-empty "reply".' };
  }
  if (!Array.isArray(citationsRaw)) {
    return { ok: false, message: 'Model JSON must include "citations" array.' };
  }
  const citations: string[] = [];
  for (const c of citationsRaw) {
    if (typeof c !== "string" || c.trim() === "") continue;
    const id = c.trim();
    if (validPaperIds.has(id)) citations.push(id);
  }
  const ooc = outOfCorpus === true;
  if (ooc && citations.length > 0) {
    return {
      ok: false,
      message: "outOfCorpus cannot be true when citations are non-empty.",
    };
  }
  return {
    ok: true,
    value: {
      reply: reply.trim(),
      citations: ooc ? [] : [...new Set(citations)],
      outOfCorpus: ooc,
    },
  };
}
