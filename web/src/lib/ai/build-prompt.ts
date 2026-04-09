import type { AiPaperInput } from "@/lib/ai/types";

const SYSTEM = `You are a careful research assistant. You receive a research goal and a list of academic papers (id, title, abstract). You must respond with ONLY valid JSON (no markdown fences, no commentary) matching this shape:
{"rankings":[{"paperId":"string","score":number,"note":"optional short reason"}],"synthesis":"string"}
Rules:
- rankings: one entry per paper id listed below; score is 0-100 relevance to the research goal; higher is more relevant.
- Only use paperId values exactly as given; do not invent papers or ids.
- synthesis: markdown briefing that connects themes across the roughly 10 most relevant papers. Every substantive claim must cite a paper by title or by id in parentheses, e.g. (paperId: abc123). Do not cite papers that are not in the list.
- Keep notes and synthesis concise.`;

export function buildUserPrompt(
  researchGoal: string,
  papers: AiPaperInput[],
): string {
  const lines = papers.map((p, i) => {
    const abs =
      p.abstract == null || p.abstract === ""
        ? "(no abstract)"
        : p.abstract;
    return `${i + 1}. id=${p.id}\ntitle: ${p.title}\nabstract: ${abs}`;
  });
  return `Research goal:\n${researchGoal.trim()}\n\nPapers:\n${lines.join("\n\n")}`;
}

export function aiSystemPrompt(): string {
  return SYSTEM;
}
