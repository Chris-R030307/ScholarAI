import type { Author, Paper } from "@/lib/paper";

const STORAGE_KEY = "scholarai_corpus_cart";

function isAuthor(x: unknown): x is Author {
  if (typeof x !== "object" || x === null) return false;
  const o = x as Record<string, unknown>;
  return typeof o.name === "string" && ("id" in o ? o.id === null || typeof o.id === "string" : true);
}

function isPaper(x: unknown): x is Paper {
  if (typeof x !== "object" || x === null) return false;
  const o = x as Record<string, unknown>;
  if (typeof o.id !== "string" || typeof o.title !== "string") return false;
  if (o.abstract != null && typeof o.abstract !== "string") return false;
  if (o.url != null && typeof o.url !== "string") return false;
  if (o.year != null && typeof o.year !== "number") return false;
  if (typeof o.citationCount !== "number") return false;
  if (typeof o.isOpenAccess !== "boolean") return false;
  if (!Array.isArray(o.authors) || !o.authors.every(isAuthor)) return false;
  if (o.venue != null && typeof o.venue !== "string") return false;
  return true;
}

/** Parse JSON payload from sessionStorage (exported for unit tests). */
export function parseCorpusCartPayload(parsed: unknown): Paper[] {
  if (!Array.isArray(parsed)) return [];
  return parsed.filter(isPaper);
}

export function loadCorpusCartFromSession(): Paper[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw == null) return [];
    return parseCorpusCartPayload(JSON.parse(raw));
  } catch {
    return [];
  }
}

export function saveCorpusCartToSession(papers: Paper[]): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(papers));
  } catch {
    /* quota / private mode */
  }
}

export function corpusCartStorageKey(): string {
  return STORAGE_KEY;
}
