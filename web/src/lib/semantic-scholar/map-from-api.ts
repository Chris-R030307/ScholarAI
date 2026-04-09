import type { Author, Paper } from "@/lib/paper";
import type { S2Paper, S2Venue } from "@/lib/semantic-scholar/api-paper";

function venueToString(venue: S2Venue): string | null {
  if (venue == null) return null;
  if (typeof venue === "string") {
    const t = venue.trim();
    return t.length > 0 ? t : null;
  }
  const n = venue.name?.trim();
  return n && n.length > 0 ? n : null;
}

function stableIdFallback(p: S2Paper): string {
  const basis = `${p.title ?? ""}|${p.year ?? ""}|${p.abstract?.slice(0, 80) ?? ""}`;
  let h = 0;
  for (let i = 0; i < basis.length; i++) {
    h = (Math.imul(31, h) + basis.charCodeAt(i)) | 0;
  }
  return `s2-fallback-${Math.abs(h).toString(36)}`;
}

function resolveUrl(p: S2Paper): string | null {
  const direct = p.url?.trim();
  if (direct) return direct;
  const oa = p.openAccessPdf?.url?.trim();
  if (oa) return oa;
  return null;
}

function mapAuthors(raw: S2Paper["authors"]): Author[] {
  if (!raw?.length) return [];
  return raw.map((a) => ({
    name: (a.name ?? "Unknown").trim() || "Unknown",
    id: a.authorId?.trim() ? a.authorId!.trim() : null,
  }));
}

/**
 * Maps one Semantic Scholar search hit to the internal {@link Paper} DTO.
 */
export function mapSemanticScholarPaper(p: S2Paper): Paper {
  const title = (p.title ?? "").trim() || "Untitled";
  const abstractRaw = p.abstract?.trim();
  const id =
    p.paperId?.trim() && p.paperId.trim().length > 0
      ? p.paperId.trim()
      : stableIdFallback({ ...p, title });

  return {
    id,
    title,
    abstract: abstractRaw && abstractRaw.length > 0 ? abstractRaw : null,
    url: resolveUrl(p),
    year: typeof p.year === "number" && Number.isFinite(p.year) ? p.year : null,
    citationCount:
      typeof p.citationCount === "number" && Number.isFinite(p.citationCount)
        ? Math.max(0, Math.floor(p.citationCount))
        : 0,
    isOpenAccess: Boolean(p.isOpenAccess),
    authors: mapAuthors(p.authors),
    venue: venueToString(p.venue),
  };
}
