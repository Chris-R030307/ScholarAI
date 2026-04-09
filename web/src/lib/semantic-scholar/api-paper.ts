/**
 * Subset of Semantic Scholar Graph API `paper/search` item shape.
 * @see https://api.semanticscholar.org/api-docs/
 */

export type S2Author = {
  authorId?: string;
  name?: string;
};

export type S2OpenAccessPdf = {
  url?: string;
};

export type S2Venue =
  | string
  | null
  | undefined
  | {
      name?: string;
    };

export type S2Paper = {
  paperId?: string;
  title?: string;
  abstract?: string;
  url?: string;
  year?: number;
  citationCount?: number;
  isOpenAccess?: boolean;
  authors?: S2Author[];
  venue?: S2Venue;
  openAccessPdf?: S2OpenAccessPdf;
};

export type S2SearchResponse = {
  total?: number;
  data?: S2Paper[];
  message?: string;
  code?: string;
};
