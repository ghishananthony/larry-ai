/**
 * Larry's research-profile engine.
 *
 * Everything here is deterministic and rule-based. Larry NEVER invents a
 * research goal, question, direction, argument or conclusion. It only:
 *  1. detects when a student's request is too ambiguous to search,
 *  2. asks the student to choose the missing detail themselves,
 *  3. structures what the STUDENT said into a Research Profile,
 *  4. generates search-term variations for the student's own concepts,
 *  5. converts the CONFIRMED profile into a database query.
 */

export type SourceType =
  | "Peer-reviewed articles"
  | "Books & e-books"
  | "Dissertations"
  | "Primary sources"
  | "Reports";

export type Clarification = {
  id: string;
  /** The ambiguous phrase exactly as the student wrote it. */
  term: string;
  question: string;
  /** Options are aspects of the student's own words — Larry never picks one. */
  options: string[];
  allowOther: true;
};

export type ProfileConcept = {
  /** The student's own concept wording. */
  studentTerm: string;
  /** Larry-generated variations used only to widen database matching. */
  variations: string[];
};

export type ResearchRequestInput = {
  goal: string;
  discipline: string;
  population: string;
  sourceTypes: string[];
  sourceCount: number;
  publishedAfter: string;
};

export type ResearchProfile = {
  /** Student-provided */
  discipline: string;
  goal: string;
  mainTopic: string;
  population: string;
  concepts: ProfileConcept[];
  sourceTypes: string[];
  sourceCount: number;
  publishedAfter: string;
  clarifiedAspects: { term: string; answer: string }[];
  /** Larry-generated */
  searchTerminology: string[];
  booleanQuery: string;
};

/**
 * Umbrella terms that cover several distinct research directions. Larry must
 * not choose between them on the student's behalf.
 */
const AMBIGUOUS_TERMS: { term: string; match: string[]; options: string[] }[] = [
  {
    term: "mental health",
    match: ["mental health", "mental wellbeing", "mental well-being"],
    options: ["Depression", "Anxiety", "Self-esteem", "Stress", "Sleep quality", "Loneliness"],
  },
  {
    term: "wellbeing",
    match: ["wellbeing", "well-being"],
    options: ["Life satisfaction", "Emotional wellbeing", "Physical wellbeing", "Social wellbeing"],
  },
  {
    term: "performance",
    match: ["performance"],
    options: ["Academic achievement", "Test scores", "Workplace productivity", "Athletic performance"],
  },
  {
    term: "impact",
    match: ["impact of technology", "impact of ai", "the impact"],
    options: ["Behavioural effects", "Economic effects", "Social effects", "Health effects"],
  },
  {
    term: "success",
    match: ["success"],
    options: ["Academic success", "Career success", "Financial outcomes", "Retention / persistence"],
  },
  {
    term: "development",
    match: ["development"],
    options: ["Cognitive development", "Social development", "Emotional development", "Economic development"],
  },
];

const POPULATIONS = [
  "teenagers",
  "teens",
  "adolescents",
  "children",
  "college students",
  "undergraduates",
  "graduate students",
  "young adults",
  "adults",
  "older adults",
  "women",
  "men",
  "employees",
  "athletes",
];

const DISCIPLINES = [
  "psychology",
  "sociology",
  "history",
  "education",
  "media",
  "marine biology",
  "biology",
  "health",
  "business",
  "economics",
  "law",
  "policy",
  "chemistry",
];

/** Search-term variations. These NEVER introduce a new concept. */
const VARIATIONS: Record<string, string[]> = {
  "social media": ["social networking", "social network sites", "online platforms"],
  "self-esteem": ["self worth", "self-concept", "self-regard"],
  "self esteem": ["self worth", "self-concept"],
  depression: ["depressive symptoms", "depressive disorder"],
  anxiety: ["anxiety symptoms", "anxiousness"],
  stress: ["psychological stress", "perceived stress"],
  loneliness: ["social isolation"],
  "sleep quality": ["sleep disturbance", "insomnia"],
  teenagers: ["adolescents", "teens", "youth"],
  teens: ["adolescents", "teenagers"],
  adolescents: ["teenagers", "youth"],
  "college students": ["undergraduates", "university students"],
  "academic achievement": ["academic performance", "grades"],
  "screen time": ["device use", "media use"],
  "climate change": ["global warming"],
  "artificial intelligence": ["AI", "machine learning"],
  misinformation: ["disinformation", "fake news"],
  "body image": ["body dissatisfaction"],
  "plastic pollution": ["marine debris", "microplastics"],
};

const CONCEPT_SEEDS = Object.keys(VARIATIONS);

const STOPWORDS = new Set([
  "i","im","i'm","a","an","the","about","and","or","of","on","for","to","in","its","it","is","are",
  "my","me","need","want","writing","write","paper","essay","research","sources","source","that",
  "effect","effects","affect","study","looking","look","find","help","with","how","does","do","5",
  "five","academic","peer","reviewed","peer-reviewed","assignment","class","course","topic",
]);

function lower(s: string) {
  return s.toLowerCase();
}

/** Detects ambiguous umbrella terms the STUDENT used. */
export function detectClarifications(goal: string): Clarification[] {
  const text = lower(goal);
  return AMBIGUOUS_TERMS.filter((a) => a.match.some((m) => text.includes(m))).map((a) => ({
    id: a.term,
    term: a.term,
    question: `You mentioned "${a.term}". That covers several distinct research directions, and Larry will not choose one for you. Which specific aspect are you researching?`,
    options: a.options,
    allowOther: true as const,
  }));
}

export function detectPopulation(goal: string): string {
  const text = lower(goal);
  return POPULATIONS.find((p) => text.includes(p)) ?? "";
}

export function detectDiscipline(goal: string): string {
  const text = lower(goal);
  const hit = DISCIPLINES.find((d) => text.includes(d));
  if (hit) return hit;
  if (text.includes("social media") || text.includes("instagram") || text.includes("tiktok")) return "media";
  if (text.includes("self-esteem") || text.includes("mental")) return "psychology";
  return "";
}

/** Extracts concepts from the student's own wording only. */
export function detectConcepts(goal: string, clarified: { answer: string }[]): string[] {
  const text = lower(goal);
  const found = CONCEPT_SEEDS.filter((c) => text.includes(c));
  for (const c of clarified) {
    const a = c.answer.trim();
    if (a && !found.some((f) => lower(f) === lower(a))) found.push(a);
  }
  if (found.length === 0) {
    // Fall back to the student's own salient words — never invented ones.
    const words = text
      .replace(/[^a-z0-9\s-]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 3 && !STOPWORDS.has(w));
    found.push(...Array.from(new Set(words)).slice(0, 3));
  }
  return found;
}

export function variationsFor(term: string): string[] {
  return VARIATIONS[lower(term)] ?? [];
}

function quote(t: string) {
  return t.includes(" ") ? `"${t}"` : t;
}

export function buildBooleanQuery(concepts: ProfileConcept[], population: string): string {
  const groups = concepts.map((c) =>
    `(${[c.studentTerm, ...c.variations].map(quote).join(" OR ")})`,
  );
  if (population) {
    const pop = [population, ...variationsFor(population)];
    groups.push(`(${pop.map(quote).join(" OR ")})`);
  }
  return groups.join(" AND ");
}

export function buildProfile(
  input: ResearchRequestInput,
  clarified: { term: string; answer: string }[],
): ResearchProfile {
  const conceptTerms = detectConcepts(input.goal, clarified);
  const concepts: ProfileConcept[] = conceptTerms.map((t) => ({
    studentTerm: t,
    variations: variationsFor(t),
  }));
  const population = input.population || detectPopulation(input.goal);
  const discipline = input.discipline || detectDiscipline(input.goal);
  const booleanQuery = buildBooleanQuery(concepts, population);

  return {
    discipline,
    goal: input.goal.trim(),
    mainTopic: conceptTerms.slice(0, 2).join(" and "),
    population,
    concepts,
    sourceTypes: input.sourceTypes,
    sourceCount: input.sourceCount,
    publishedAfter: input.publishedAfter,
    clarifiedAspects: clarified,
    searchTerminology: Array.from(
      new Set(concepts.flatMap((c) => c.variations).concat(variationsFor(population))),
    ),
    booleanQuery,
  };
}

/**
 * Larry may WARN that criteria look narrow, but never broadens automatically.
 */
export function narrownessWarning(profile: ResearchProfile, matchCount: number): string | null {
  const year = Number(profile.publishedAfter);
  const recent = Number.isFinite(year) && year >= new Date().getFullYear() - 3;
  if (matchCount <= 1 || (recent && profile.concepts.length >= 3)) {
    return "Your current search criteria may return a limited number of results. Would you like to broaden your publication date range or add more of your own search terminology? Larry will not broaden it for you.";
  }
  return null;
}
