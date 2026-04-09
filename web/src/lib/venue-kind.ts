/**
 * Heuristic venue classification for filters — see docs/data-model.md § Venue kind.
 */
export type VenueKind = "journal" | "conference" | "unknown";

export function classifyVenueKind(venue: string | null): VenueKind {
  if (!venue?.trim()) return "unknown";
  const v = venue.toLowerCase();

  if (
    /\b(conference|proceedings|symposium|workshop|conf\.)\b/.test(v) ||
    /\b(icml|neurips|\bnips\b|iclr|cvpr|iccv|eccv|emnlp|\bacl\b|naacl|coling|\bchi\b|siggraph|aaai|ijcai|\bkdd\b|www\b|wsdm|recsys|interspeech|uist|cscw)\b/.test(
      v,
    )
  ) {
    return "conference";
  }

  if (
    /\bjournal\b/.test(v) ||
    /\btransactions\b/.test(v) ||
    /\bletters\b/.test(v) ||
    /\bannals\b/.test(v) ||
    /\b(nature|science|cell|lancet|nejm|jama)\b/.test(v)
  ) {
    return "journal";
  }

  return "unknown";
}
