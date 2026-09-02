import type { Institution, LibraryResource } from "./institutions";
import { buildAccessUrl } from "./institutions";

/**
 * Larry's research workflow engine.
 *
 * Hard rule: Larry never invents, narrows, broadens, or reinterprets the
 * student's research goal. Every value in a ResearchProfile is either
 * (a) taken verbatim from what the student typed / selected, or
 * (b) clearly labelled as Larry-generated SEARCH TERMINOLOGY, which is only
 *     vocabulary for querying a database — never a new research concept.
 */

export type ProfileField = {
  label: string;
  value: string;
  /** "student" = provided by the student, "pending" = still unknown */
  origin: "student" | "pending";
};

export type ResearchProfile = {
  discipline: ProfileField;
  goal: ProfileField;
  topic: ProfileField;
  population: ProfileField;
  concepts: string[];
  sourceTypes: string[];
  dateRange: ProfileField;
  sourceCount: ProfileField;
};

export type ClarificationQuestion = {
  id: string;
  question: string;
  /** Examples only — Larry never picks one for the student. */
  examples: string[];
  /** Student may answer in their own words. */
  helper: string;
};

/* ------------------------------------------------------------------ */
/* Vocabulary tables (general, not tied to any single request)          */
/* ------------------------------------------------------------------ */

/**
 * Umbrella concepts: terms that are so broad that a database search on them
 * alone would not represent a specific research goal. Each lists NARROWER
 * FACETS purely so Larry can (a) detect that the student already named one and
 * (b) offer neutral examples in a clarification question.
 */
const umbrellaConcepts: { term: string; aliases: string[]; facets: string[] }[] = [
  {
    term: "mental health",
    aliases: ["mental health", "psychological health", "mental wellbeing", "mental well-being"],
    facets: ["anxiety", "depression", "self-esteem", "self esteem", "stress", "loneliness", "body image", "sleep"],
    // "self esteem" is only an alternate spelling used for detection, not a second example.

  },
  {
    term: "wellbeing",
    aliases: ["wellbeing", "well-being", "quality of life"],
    facets: ["life satisfaction", "happiness", "stress", "burnout", "social support"],
  },
  {
    term: "performance",
    aliases: ["performance", "outcomes"],
    facets: ["academic achievement", "test scores", "graduation rates", "productivity", "retention"],
  },
  {
    term: "technology use",
    aliases: ["technology", "digital media", "screen time", "devices"],
    facets: ["social media", "smartphones", "video games", "streaming", "online learning"],
  },
  {
    term: "education",
    aliases: ["education", "learning"],
    facets: ["curriculum", "teaching methods", "assessment", "literacy", "school climate"],
  },
  {
    term: "health",
    aliases: ["health", "public health"],
    facets: ["nutrition", "physical activity", "chronic disease", "access to care", "sleep"],
  },
  {
    term: "environment",
    aliases: ["environment", "environmental impact", "sustainability"],
    facets: ["pollution", "climate change", "biodiversity loss", "habitat degradation", "waste"],
  },
  {
    term: "inequality",
    aliases: ["inequality", "disparities", "equity"],
    facets: ["income inequality", "racial disparities", "gender gap", "access to housing"],
  },
  {
    term: "policy",
    aliases: ["policy", "regulation"],
    facets: ["legislation", "enforcement", "funding", "implementation"],
  },
];

const populationTerms: { label: string; words: string[]; synonyms: string[] }[] = [
  { label: "adolescents / teenagers", words: ["teen", "teenager", "adolescen", "high school"], synonyms: ["adolescent", "teenager", "youth"] },
  { label: "children", words: ["child", "children", "elementary"], synonyms: ["child", "children", "pediatric"] },
  { label: "college students", words: ["college student", "undergraduate", "university student"], synonyms: ["college students", "undergraduates"] },
  { label: "adults", words: ["adult"], synonyms: ["adults"] },
  { label: "older adults", words: ["older adult", "elderly", "senior"], synonyms: ["older adults", "elderly"] },
  { label: "women", words: ["women", "female"], synonyms: ["women", "female"] },
  { label: "men", words: ["men ", "male"], synonyms: ["men", "male"] },
  { label: "educators / teachers", words: ["teacher", "educator", "faculty"], synonyms: ["teachers", "educators"] },
  { label: "patients", words: ["patient"], synonyms: ["patients"] },
];

const disciplineTerms: Record<string, string[]> = {
  psychology: ["psycholog", "psych paper", "psych ", "self-esteem", "anxiety", "depression", "behavior"],
  sociology: ["sociolog", "society", "community", "inequality", "culture"],
  history: ["history", "historical", "century", "archival"],
  "marine biology": ["marine", "ocean", "coral", "biodiversity", "species"],
  education: ["education", "classroom", "pedagog", "school", "curriculum"],
  media: ["media studies", "communication", "journalism", "platform"],
  health: ["public health", "clinical", "nursing", "nutrition", "epidemiolog"],
  chemistry: ["chemistry", "chemical", "compound"],
  law: ["law", "legal", "statute", "court"],
  policy: ["policy", "governance", "regulation"],
};

/** Concept synonym expansion used ONLY to phrase database queries. */
const conceptSynonyms: Record<string, string[]> = {
  "social media": ["social media", "social networking", "social network sites"],
  "self-esteem": ["self-esteem", "self esteem", "self-worth"],
  anxiety: ["anxiety", "anxious symptoms"],
  depression: ["depression", "depressive symptoms"],
  stress: ["stress", "psychological stress"],
  loneliness: ["loneliness", "social isolation"],
  "body image": ["body image", "body dissatisfaction"],
  sleep: ["sleep", "sleep quality"],
  "screen time": ["screen time", "media use"],
  smartphones: ["smartphone", "mobile phone"],
  "academic achievement": ["academic achievement", "academic performance"],
  "climate change": ["climate change", "global warming"],
  pollution: ["pollution", "contamination"],
  "plastic pollution": ["plastic pollution", "microplastics"],
  burnout: ["burnout", "occupational stress"],
  literacy: ["literacy", "reading proficiency"],
};

const KNOWN_CONCEPTS = [
  ...Object.keys(conceptSynonyms),
  ...umbrellaConcepts.flatMap((u) => u.facets),
];

const DEFAULT_SOURCE_TYPE_HINTS: { label: string; words: string[] }[] = [
  { label: "Peer-reviewed articles", words: ["peer review", "peer-reviewed", "scholarly article", "journal article", "academic source"] },
  { label: "Books & e-books", words: ["book", "e-book", "monograph"] },
  { label: "Dissertations", words: ["dissertation", "thesis"] },
  { label: "Primary sources", words: ["primary source", "archival"] },
];

/* ------------------------------------------------------------------ */
/* Stage 2 — analyze                                                    */
/* ------------------------------------------------------------------ */

export type RequestAnalysis = {
  discipline?: string | undefined;
  population?: string | undefined;
  concepts: string[];
  /** Umbrella terms the student used without naming a narrower facet. */
  ambiguousTerms: string[];
  sourceTypes: string[];
  dateRange?: string | undefined;
  sourceCount?: string | undefined;
};

export function analyzeRequest(goal: string): RequestAnalysis {
  const text = goal.toLowerCase();

  const discipline = Object.entries(disciplineTerms).find(([, words]) =>
    words.some((w) => text.includes(w)),
  )?.[0];

  const population = populationTerms.find((p) => p.words.some((w) => text.includes(w)))?.label;

  const concepts = Array.from(
    new Set(KNOWN_CONCEPTS.filter((c) => text.includes(c.toLowerCase()))),
  );

  const matchedUmbrellas = umbrellaConcepts
    .map((u) => ({ u, hit: u.aliases.find((a) => text.includes(a)) }))
    .filter((m): m is { u: (typeof umbrellaConcepts)[number]; hit: string } => Boolean(m.hit))
    .filter((m) => !m.u.facets.some((f) => text.includes(f)));

  // Keep only the most specific umbrella when one matched phrase contains another
  // (e.g. "mental health" wins over "health").
  const ambiguousTerms = matchedUmbrellas
    .filter((m) => !matchedUmbrellas.some((o) => o !== m && o.hit.includes(m.hit)))
    .map((m) => m.u.term);


  const sourceTypes = DEFAULT_SOURCE_TYPE_HINTS.filter((s) =>
    s.words.some((w) => text.includes(w)),
  ).map((s) => s.label);

  const years = goal.match(/\b(19|20)\d{2}\b/g) ?? [];
  let dateRange: string | undefined;
  if (years.length >= 2) dateRange = `${years[0]}–${years[years.length - 1]}`;
  else if (years.length === 1) dateRange = years[0]!;
  else if (/last (\d+) years?/i.test(goal)) dateRange = goal.match(/last \d+ years?/i)![0];

  const countMatch =
    goal.match(/\b(\d{1,2})\s+(?:peer[- ]reviewed\s+)?(?:academic\s+)?(?:scholarly\s+)?sources?\b/i) ??
    goal.match(/\bneed\s+(\d{1,2})\b/i);
  const sourceCount = countMatch?.[1];

  return { discipline, population, concepts, ambiguousTerms, sourceTypes, dateRange, sourceCount };
}

/** Clarification questions Larry must ask before building a profile. */
/** Collapse alternate spellings ("self-esteem" / "self esteem") in example lists. */
function dedupeExamples(list: string[]): string[] {
  const seen = new Set<string>();
  return list.filter((item) => {
    const key = item.toLowerCase().replace(/[^a-z]/g, "");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function buildClarifications(analysis: RequestAnalysis): ClarificationQuestion[] {

  const questions: ClarificationQuestion[] = [];

  for (const term of analysis.ambiguousTerms) {
    const entry = umbrellaConcepts.find((u) => u.term === term)!;
    questions.push({
      id: `ambiguity:${term}`,
      question: `You mentioned “${term}”, which covers a wide range of research. What specific aspect of ${term} are you focusing on?`,
      examples: dedupeExamples(entry.facets).slice(0, 5),
      helper:
        "These are examples only — Larry will not choose for you. Answer in your own words, using your own research focus.",
    });
  }

  if (!analysis.population) {
    questions.push({
      id: "population",
      question: "Is your research goal focused on a specific group or population?",
      examples: populationTerms.slice(0, 5).map((p) => p.label),
      helper: "If your goal is not limited to a particular group, write “no specific group”.",
    });
  }

  if (analysis.sourceTypes.length === 0) {
    questions.push({
      id: "sourceTypes",
      question: "What type of sources does your assignment require?",
      examples: DEFAULT_SOURCE_TYPE_HINTS.map((s) => s.label),
      helper: "Use the source-type selector, or state the requirement in your own words.",
    });
  }

  if (!analysis.dateRange) {
    questions.push({
      id: "dateRange",
      question: "Does your assignment set a publication date requirement?",
      examples: ["Published 2021–2026", "Last 5 years", "No date restriction"],
      helper: "Larry applies only the date requirement you state.",
    });
  }

  return questions;
}

/* ------------------------------------------------------------------ */
/* Stage 5 — research profile                                           */
/* ------------------------------------------------------------------ */

export type ProfileInput = {
  goal: string;
  selectedSourceTypes: string[];
  answers: Record<string, string>;
};

/** Normalize a phrase for comparison: lowercase, punctuation → space. */
function normalizeTerm(term: string): string {
  return term.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/**
 * Map a phrase to a canonical concept label so that alternate spellings
 * ("self esteem" / "self-esteem") never enter the query twice.
 */
function canonicalConcept(term: string): string {
  const norm = normalizeTerm(term);
  for (const key of Object.keys(conceptSynonyms)) {
    if (normalizeTerm(key) === norm) return key;
    if (conceptSynonyms[key]!.some((s) => normalizeTerm(s) === norm)) return key;
  }
  const known = KNOWN_CONCEPTS.find((c) => normalizeTerm(c) === norm);
  if (known) {
    // Prefer the spelling that has synonym expansion, if one exists.
    const withSyn = Object.keys(conceptSynonyms).find((k) => normalizeTerm(k) === norm);
    return withSyn ?? known;
  }
  const pop = populationTerms.find(
    (p) => normalizeTerm(p.label) === norm || p.synonyms.some((s) => normalizeTerm(s) === norm),
  );
  if (pop) return pop.label;
  return term.trim();
}

/** Conversational scaffolding that is never a research concept. */
const CONVERSATIONAL_PATTERNS: RegExp[] = [
  /^\s*(well|so|ok|okay|yeah|yes|hi|hello)\b[,:\s]*/i,
  /\b(i\s*(?:'|’)?\s*m|i\s+am|we\s+are|we\s*(?:'|’)?\s*re)\s+(focusing|focused|looking|interested|researching|studying|examining|exploring|investigating|writing|working)\s*(on|at|in|about|into)?\b/gi,
  /\b(i|we)\s+(want|would\s+like|plan|intend|need|hope)\s+to\s+(look|focus|research|study|examine|explore|investigate|write)\s*(at|on|about|into)?\b/gi,
  /\b(my|the)\s+(paper|topic|focus|research|study|assignment)\s+(is|will\s+be)\s*(on|about)?\b/gi,
  /\b(i|we)\s*(?:'|’)?\s*(m|re)?\s*(just\s+)?(going\s+to|gonna)\s+\w+\b/gi,
  /\b(specifically|particularly|mainly|mostly|basically|really|kind\s+of|sort\s+of|in\s+particular|for\s+now|i\s+think|i\s+guess)\b/gi,
  /\b(please|thanks|thank\s+you)\b/gi,
];

const CONCEPT_STOPWORDS = new Set([
  "the", "a", "an", "of", "on", "in", "at", "for", "to", "and", "or", "with",
  "about", "into", "how", "does", "do", "affects", "affect", "affecting",
  "effects", "effect", "its", "it", "is", "are", "their", "them", "that",
  "this", "these", "those", "my", "our", "topic", "paper", "research",
  "study", "focus", "aspect", "part", "specific", "among", "between",
  "impact", "influence", "relationship", "levels", "level",
]);

/**
 * Interpret a free-text clarification answer and return the research concepts
 * it names. The sentence itself is NEVER treated as a search term.
 */
export function extractConcepts(answer: string): string[] {
  let text = ` ${answer.toLowerCase()} `;
  for (const pattern of CONVERSATIONAL_PATTERNS) text = text.replace(pattern, " ");
  text = text.replace(/[^a-z0-9\-\s]/g, " ").replace(/\s+/g, " ").trim();
  if (!text) return [];

  const found: string[] = [];
  const consume = (phrase: string) => {
    const norm = normalizeTerm(phrase);
    if (!norm) return;
    const re = new RegExp(`\\b${norm.split(" ").join("[\\s-]+")}\\b`, "g");
    if (re.test(text)) {
      found.push(canonicalConcept(phrase));
      text = text.replace(re, " ");
    }
  };

  // Longest phrases first so "body image" beats "image".
  const vocabulary = [
    ...KNOWN_CONCEPTS,
    ...populationTerms.flatMap((p) => [p.label, ...p.synonyms, ...p.words]),
  ]
    .map((t) => t.trim())
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);

  for (const term of vocabulary) consume(term);

  if (found.length === 0) {
    // No known vocabulary matched: keep the remaining content words only,
    // so conversational scaffolding still never reaches the query.
    const words = text.split(" ").filter((w) => w && !CONCEPT_STOPWORDS.has(w));
    if (words.length > 0 && words.length <= 4) found.push(canonicalConcept(words.join(" ")));
  }

  return Array.from(new Set(found.map(canonicalConcept)));
}

function dedupeConcepts(list: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of list) {
    const concept = canonicalConcept(raw);
    const key = normalizeTerm(concept);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(concept);
  }
  return out;
}

export function buildProfile(input: ProfileInput): ResearchProfile {
  const combined = `${input.goal} ${Object.values(input.answers).join(" ")}`;
  const analysis = analyzeRequest(combined);

  const answerFor = (id: string) => input.answers[id]?.trim();

  const clarifiedConcepts = dedupeConcepts([
    ...analysis.concepts,
    ...Object.entries(input.answers)
      .filter(([id]) => id.startsWith("ambiguity:"))
      .flatMap(([, v]) => extractConcepts(v)),
  ]);


  const sourceTypes = Array.from(
    new Set([...input.selectedSourceTypes, ...analysis.sourceTypes]),
  );

  const field = (value: string | undefined, label: string): ProfileField =>
    value && value.length > 0
      ? { label, value, origin: "student" }
      : { label, value: "Not specified by student", origin: "pending" };

  return {
    discipline: field(analysis.discipline, "Academic discipline"),
    goal: field(input.goal.trim(), "Exact research goal (student's words)"),
    topic: field(clarifiedConcepts.slice(0, 2).join(" + ") || undefined, "Main topic"),
    population: field(answerFor("population") ?? analysis.population, "Population / group"),
    concepts: clarifiedConcepts,
    sourceTypes,
    dateRange: field(answerFor("dateRange") ?? analysis.dateRange, "Publication date requirement"),
    sourceCount: field(analysis.sourceCount, "Number of sources requested"),
  };
}

/* ------------------------------------------------------------------ */
/* Stage 7 — search terminology                                         */
/* ------------------------------------------------------------------ */

export type SearchTerms = {
  /** Boolean query string sent to the database. */
  query: string;
  /** Per-concept expansion, shown so the student can audit it. */
  groups: { concept: string; terms: string[] }[];
  /** Applied filters derived from the confirmed profile. */
  filters: string[];
  narrow: boolean;
};

function expand(concept: string): string[] {
  const key = concept.toLowerCase().trim();
  if (conceptSynonyms[key]) return conceptSynonyms[key]!;
  const pop = populationTerms.find((p) => p.label === concept || p.synonyms.includes(key));
  if (pop) return pop.synonyms;
  return [concept];
}

export function generateSearchTerms(profile: ResearchProfile): SearchTerms {
  const concepts = [...profile.concepts];
  if (profile.population.origin === "student" && !/no specific/i.test(profile.population.value)) {
    concepts.push(profile.population.value);
  }

  const groups = concepts
    .filter(Boolean)
    .map((concept) => ({ concept, terms: expand(concept) }));

  const query = groups
    .map((g) => `(${g.terms.map((t) => (t.includes(" ") ? `"${t}"` : t)).join(" OR ")})`)
    .join(" AND ");

  const filters: string[] = [];
  if (profile.sourceTypes.length) filters.push(`Source type: ${profile.sourceTypes.join(", ")}`);
  if (profile.dateRange.origin === "student" && !/no date/i.test(profile.dateRange.value)) {
    filters.push(`Published: ${profile.dateRange.value}`);
  }
  if (profile.sourceCount.origin === "student") {
    filters.push(`Results requested: ${profile.sourceCount.value}`);
  }

  return { query, groups, filters, narrow: groups.length >= 4 };
}

/* ------------------------------------------------------------------ */
/* Stage 8 — resource selection                                         */
/* ------------------------------------------------------------------ */

export type ResourceChoice = {
  resource: LibraryResource;
  score: number;
  reasons: string[];
};

export function selectResources(
  institution: Institution,
  profile: ResearchProfile,
): ResourceChoice[] {
  const discipline = profile.discipline.origin === "student" ? profile.discipline.value : undefined;

  return institution.resources
    .filter((r) => r.status === "active" || r.status === "trial")
    .map((resource) => {
      const reasons: string[] = [];
      let score = 0;

      if (discipline && resource.disciplines.includes(discipline)) {
        // Specialist beats generalist for the student's discipline.
        const specialist = resource.disciplines.length <= 3;
        score += specialist ? 60 : 35;
        reasons.push(
          specialist
            ? `${discipline}-focused resource at this institution`
            : `Covers ${discipline} as part of a multidisciplinary collection`,
        );
      }

      const typeOverlap = resource.sourceTypes.filter((t) => profile.sourceTypes.includes(t));
      if (typeOverlap.length) {
        score += typeOverlap.length * 25;
        reasons.push(`Holds requested formats: ${typeOverlap.join(", ")}`);
      }

      if (resource.kind === "catalog" && profile.sourceTypes.some((t) => t.includes("Book"))) {
        score += 20;
        reasons.push("Institution catalog holds books and e-books");
      }

      if (resource.status === "trial") {
        reasons.push("Trial access — availability may end");
        score -= 5;
      }

      return { resource, score, reasons };
    })
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}

/* ------------------------------------------------------------------ */
/* Stage 9 — execute                                                    */
/* ------------------------------------------------------------------ */

export type SearchExecution = {
  resource: LibraryResource;
  query: string;
  filters: string[];
  /** Access link built from Larry's STRUCTURED query, never the raw message. */
  accessUrl: string;
};

export function executeSearch(
  institution: Institution,
  choice: ResourceChoice,
  terms: SearchTerms,
): SearchExecution {
  return {
    resource: choice.resource,
    query: terms.query,
    filters: terms.filters,
    accessUrl: buildAccessUrl(institution, choice.resource, terms.query),
  };
}
