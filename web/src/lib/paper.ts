/**
 * Canonical app shapes — align with docs/data-model.md.
 */

export type Author = {
  name: string;
  id: string | null;
};

export type Paper = {
  id: string;
  title: string;
  abstract: string | null;
  url: string | null;
  year: number | null;
  citationCount: number;
  isOpenAccess: boolean;
  authors: Author[];
  venue: string | null;
};

export type SearchApiError = {
  code: string;
  message: string;
};

export type SearchApiResponse = {
  papers: Paper[];
  total?: number;
  error?: SearchApiError;
};
