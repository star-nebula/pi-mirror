import type { ClaimVerdict, FetchedPage, ReferenceInput, ReferenceView, SearchResult, TrendItem } from "./types.js";

export interface ResearchService {
  search(query: string, limit?: number): Promise<SearchResult[]>;
  fetch(url: string): Promise<FetchedPage>;
  verify(claim: string): Promise<ClaimVerdict>;
  trends(options?: { query?: string; limit?: number }): Promise<TrendItem[]>;
}

export interface ReferenceService {
  list(limit?: number): ReferenceView[];
  search(query: string, options?: { platform?: string; limit?: number }): ReferenceView[];
  get(id: string): ReferenceView | null;
  import(input: ReferenceInput & { body: string }): ReferenceView;
}
