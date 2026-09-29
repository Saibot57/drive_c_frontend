/**
 * Typer för terminsplaneraren: en termins veckor och vilket veckoschema som
 * gäller varje vecka.
 */

/** En vecka i terminen. Kalenderveckan räknas fram ur terminens start. */
export interface TermWeek {
  /** Fritext, t.ex. "Tema Hav". Tomt när veckan inte hör till något tema. */
  theme: string;
  /** Lovvecka — räknas aldrig i statistiken, oavsett schema. */
  holiday: boolean;
  /** Id på ett PlannerArchive. Pekaren läses om varje gång, ingen kopia. */
  archiveId: string | null;
}

export interface Term {
  id: string;
  name: string;
  /** Kalendervecka för terminens första vecka. */
  startWeek: number;
  /** ISO-veckoår för startveckan. Terminen får korsa ett årsskifte. */
  startYear: number;
  weeks: TermWeek[];
}

export interface TermSummary {
  id: string;
  name: string;
  startWeek: number;
  startYear: number;
  weekCount: number;
  updatedAt: string | null;
}
