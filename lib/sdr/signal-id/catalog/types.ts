import type { DisplayClass } from "../types";

/** One known emitter / protocol from the SigID-derived catalog. */
export type CatalogEntry = {
  id: string;
  name: string;
  description?: string;
  /** Canonical SigID wiki page. */
  url: string;
  location?: string;
  categories: string[];
  /** Free-form Mode string from the wiki (NFM, USB, …). */
  mode?: string;
  /** Free-form Modulation string from the wiki (FSK, PSK, …). */
  modulation?: string;
  /** Our DisplayClass values this entry is compatible with. */
  classes: DisplayClass[];
  /** Inclusive absolute frequency ranges where this signal appears. */
  frequencies: { lo: number; hi: number }[];
  /** Expected occupied bandwidth, when known. */
  bandwidthHz?: { lo: number; hi: number };
};

export type SignalCatalog = {
  version: number;
  source: string;
  fetchedAt: string;
  count: number;
  signals: CatalogEntry[];
};

/** A scored suggestion that a live detection is a known catalog entry. */
export type CatalogMatch = {
  id: string;
  name: string;
  url: string;
  score: number;
  description?: string;
  categories: string[];
  mode?: string;
  modulation?: string;
};
