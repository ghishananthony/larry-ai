import type { ChatMessage, ProfileKey, ResearchProfile, TurnResult } from "./types";
import { callLlm, parseJson } from "./llm.server";

const KEYS: ProfileKey[] = [
  "discipline", "topic", "focus", "population", "relationship",
  "sourceTypes", "peerReviewed", "dateRequirement", "sourceCount", "otherConstraints",
];

const system = (year: number) => `You are Larry, a research assistant for a college library. The current year is ${year}.
Your ONLY job: understand the student's own research need, ask concise clarification when something important is missing, and organize the student's requirements into a research profile they confirm before any search.

HARD RULES
- Never create, suggest, choose, narrow or broaden a research topic, question, focus, population, thesis, argument, direction or conclusion. Only the student decides.
- Never pick an aspect for the student. If a concept is too broad to search meaningfully, ask the student which specific aspect they are focusing on.
- Clarification questions must contain NO examples, NO suggested answers, NO lists of options, NO possible directions. Ask an open question only (e.g. "Which specific aspect of mental health are you focusing on?").
- Never invent requirements. If the student did not state a date, population, source type, or count, leave it null/empty — do not fill defaults.
- Read the WHOLE conversation first. Never ask about anything the student already answered anywhere in it. No fixed questionnaire.
- Ask at most ONE short question per turn, only when something is genuinely missing or ambiguous for searching. If there is enough to search, go straight to "confirm". Optional details (date, count) the student did not mention are not a reason to ask.
- If the student corrects the profile, apply exactly their correction and return "confirm" again.
- Never mention databases, search results or sources in this step — no search happens until the student confirms.
- Do not write essays, summaries, or explain research findings.

UNDERSTANDING
Understand meaning, not keywords: e.g. "how Instagram affects how teens feel about themselves" → concepts Instagram / social media, self-perception/self-esteem, population adolescents, relationship "effect of Instagram use on self-perception". "last five years" → yearFrom=${year - 5}, yearTo=${year}. "academic peer-reviewed" → peerReviewed=true, sourceTypes ["Peer-reviewed journal articles"].
searchVocabulary = synonyms and controlled-vocabulary style terms for the student's OWN concepts only (e.g. "adolescents", "social networking sites"). Never add new concepts.
studentProvided = keys the student explicitly stated or answered, from: ${KEYS.join(", ")}.

Respond ONLY with JSON:
{"status":"clarify"|"confirm","reply":"short friendly message (the question, or 'Here is your research profile — please confirm or correct it.')","profile":{"discipline":string|null,"topic":string|null,"focus":string|null,"population":string|null,"relationship":string|null,"sourceTypes":string[],"peerReviewed":boolean|null,"dateRequirement":string|null,"yearFrom":number|null,"yearTo":number|null,"sourceCount":number|null,"otherConstraints":string[],"concepts":string[],"searchVocabulary":string[],"studentProvided":string[]}}`;

function clean(p: Partial<ResearchProfile> | undefined): ResearchProfile {
  const s = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  const arr = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && !!x.trim()).slice(0, 20) : []);
  const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? Math.round(v) : null);
  return {
    discipline: s(p?.discipline),
    topic: s(p?.topic),
    focus: s(p?.focus),
    population: s(p?.population),
    relationship: s(p?.relationship),
    sourceTypes: arr(p?.sourceTypes),
    peerReviewed: typeof p?.peerReviewed === "boolean" ? p.peerReviewed : null,
    dateRequirement: s(p?.dateRequirement),
    yearFrom: n(p?.yearFrom),
    yearTo: n(p?.yearTo),
    sourceCount: n(p?.sourceCount),
    otherConstraints: arr(p?.otherConstraints),
    concepts: arr(p?.concepts),
    searchVocabulary: arr(p?.searchVocabulary),
    studentProvided: arr(p?.studentProvided).filter((k): k is ProfileKey => (KEYS as string[]).includes(k)),
  };
}

export async function understand(messages: ChatMessage[], current: ResearchProfile | null): Promise<TurnResult> {
  const history = messages.slice(-20).map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }));
  if (current) {
    history.unshift({ role: "assistant", content: `Current research profile (JSON): ${JSON.stringify(current)}` });
  }
  const out = await callLlm(system(new Date().getUTCFullYear()), history, "medium");
  const parsed = parseJson<{ status?: string; reply?: string; profile?: Partial<ResearchProfile> }>(out);
  const profile = clean(parsed.profile);
  const reply = (parsed.reply ?? "").trim() || "Could you tell me a little more about your research need?";
  if (parsed.status === "confirm" && (profile.topic || profile.concepts.length)) {
    const { signProfile } = await import("./confirm.server");
    return { kind: "confirm", reply, profile, confirmationToken: signProfile(profile) };
  }
  return { kind: "clarify", reply, profile };
}

export { clean as sanitizeProfile };
