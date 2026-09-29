/**
 * Shared, client-safe types for Larry's LLM research workflow.
 * Server logic lives in *.server.ts files next to this one.
 */

export type ChatMessage = { role: "user" | "assistant"; content: string };

/** Keys of profile fields that may be marked as student-provided. */
export type ProfileKey =
  | "discipline"
  | "topic"
  | "focus"
  | "population"
  | "relationship"
  | "sourceTypes"
  | "peerReviewed"
  | "dateRequirement"
  | "sourceCount"
  | "otherConstraints";

export type ResearchProfile = {
  discipline: string | null;
  topic: string | null;
  focus: string | null;
  population: string | null;
  /** How the student relates their concepts, e.g. "effect of X on Y". */
  relationship: string | null;
  sourceTypes: string[];
  peerReviewed: boolean | null;
  dateRequirement: string | null;
  yearFrom: number | null;
  yearTo: number | null;
  sourceCount: number | null;
  otherConstraints: string[];
  /** Concepts the student named. */
  concepts: string[];
  /** AI-organized search vocabulary (synonyms/related terms). Never a new research direction. */
  searchVocabulary: string[];
  /** Which fields the student explicitly stated. Everything else is AI-organized. */
  studentProvided: ProfileKey[];
};

export type TurnResult =
  | { kind: "blocked"; reply: string }
  | { kind: "clarify"; reply: string; profile: ResearchProfile | null }
  | { kind: "confirm"; reply: string; profile: ResearchProfile; confirmationToken: string }
  | { kind: "error"; reply: string };

export type SourceRecord = {
  id: string;
  title: string;
  authors: string[];
  container: string | null; // journal / publication
  publisher?: string | null;
  year: number | null;
  sourceType: string | null;
  /** true = provider flags it peer-reviewed; null = not verified. */
  peerReviewed: boolean | null;
  doi: string | null;
  url: string;
  foundIn: string; // institution resource name
  /** Where the record metadata came from, e.g. "NCBI E-utilities", "Crossref". */
  via?: string;
  /** Access info reported by the provider, never guessed. */
  access?: string | null;
  match?: "strong" | "partial";
  matchNote?: string;
};

export type ProviderRun = {
  resource: string;
  query: string;
  status: "ok" | "error" | "no_results";
  count: number;
  message?: string;
};

export type SearchResult =
  | { kind: "blocked"; reply: string }
  | { kind: "error"; reply: string }
  | {
      kind: "results";
      sources: SourceRecord[];
      runs: ProviderRun[];
      /** Relevant institution resources Larry cannot search yet (no integration). */
      notYetSearchable: string[];
      requested: number | null;
      /** Factual note when fewer matches than requested were found. Never suggests changes. */
      narrowNotice: string | null;
    };
