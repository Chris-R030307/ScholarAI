import type { AiPaperInput } from "@/lib/ai/types";

/** RAG unit — `docs/data-model.md` §5. */
export type Chunk = {
  paperId: string;
  text: string;
  chunkIndex: number;
};

const CHUNK_MAX_CHARS = 720;
const CHUNK_OVERLAP = 72;

function chunkAbstractBody(
  paperId: string,
  headerBlock: string,
  abstractBody: string,
): Chunk[] {
  const contPrefix = `[paperId:${paperId}]\n(continued)\n`;
  const out: Chunk[] = [];
  let start = 0;
  let chunkIndex = 0;
  while (start < abstractBody.length) {
    const isFirst = chunkIndex === 0;
    const prefix = isFirst ? headerBlock : contPrefix;
    const maxBody = Math.max(0, CHUNK_MAX_CHARS - prefix.length);
    if (maxBody === 0) break;
    const end = Math.min(abstractBody.length, start + maxBody);
    const slice = abstractBody.slice(start, end);
    out.push({ paperId, text: `${prefix}${slice}`, chunkIndex });
    if (end >= abstractBody.length) break;
    const next = end - CHUNK_OVERLAP;
    start = next > start ? next : end;
    chunkIndex += 1;
  }
  return out;
}

/**
 * Split title + abstract into overlapping chunks tagged with `paperId`.
 * Title is always included in the first chunk; further chunks continue the abstract only.
 */
export function chunkPaper(paper: AiPaperInput): Chunk[] {
  const title = paper.title.trim();
  const abs = paper.abstract?.trim() ?? "";
  const headerBlock = `[paperId:${paper.id}]\nTitle: ${title}\n\nAbstract: `;
  if (!abs) {
    return [
      {
        paperId: paper.id,
        text: `[paperId:${paper.id}]\nTitle: ${title}`,
        chunkIndex: 0,
      },
    ];
  }
  const full = `${headerBlock}${abs}`;
  if (full.length <= CHUNK_MAX_CHARS) {
    return [{ paperId: paper.id, text: full, chunkIndex: 0 }];
  }
  return chunkAbstractBody(paper.id, headerBlock, abs);
}

export function chunkPapers(papers: AiPaperInput[]): Chunk[] {
  return papers.flatMap((p) => chunkPaper(p));
}
