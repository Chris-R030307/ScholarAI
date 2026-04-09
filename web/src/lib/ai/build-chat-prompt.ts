import type { Chunk } from "@/lib/ai/chunk-papers";
import type { ChatTurn } from "@/lib/ai/normalize-chat-request";

export function chatSystemPrompt(): string {
  return [
    "You are ScholarAI research chat. You answer ONLY using the EXCERPTS provided for this turn.",
    "Each excerpt begins with a line like [paperId:...].",
    "Respond with a single JSON object (no markdown fences) having keys:",
    '  "reply": string (markdown for the user),',
    '  "citations": string[] (paper ids you relied on; subset of ids present in excerpts),',
    '  "outOfCorpus": boolean (true if the question cannot be answered from these excerpts).',
    "If outOfCorpus is true, reply must briefly say the information is not in the current search results, and citations must be [].",
    "Do not invent studies, methods, or claims not supported by the excerpts. Do not use outside knowledge for factual claims about these papers.",
  ].join("\n");
}

function formatExcerpts(chunks: Chunk[]): string {
  return chunks
    .map(
      (c, i) =>
        `--- Excerpt ${i + 1} (chunk ${c.chunkIndex} of paper ${c.paperId}) ---\n${c.text}`,
    )
    .join("\n\n");
}

export function buildChatUserPayload(params: {
  messages: ChatTurn[];
  retrievedChunks: Chunk[];
}): string {
  const { messages, retrievedChunks } = params;
  const history = messages
    .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
    .join("\n\n");
  const excerpts =
    retrievedChunks.length > 0
      ? formatExcerpts(retrievedChunks)
      : "(No excerpts retrieved — refuse factual answers about papers and set outOfCorpus true.)";
  return [
    "Conversation so far:",
    history,
    "",
    "Excerpts from the current result set (your only factual source):",
    excerpts,
  ].join("\n");
}
