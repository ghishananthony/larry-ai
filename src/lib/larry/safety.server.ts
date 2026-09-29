import { callLlm, parseJson } from "./llm.server";

const SYSTEM = `You are the safety gate for Larry, a university library research assistant.
Classify whether the student's request may enter an academic library research workflow.
Judge INTENT and CONTENT in context — never block merely because a topic is sensitive.

ALLOW legitimate academic research on sensitive subjects, e.g. racism, discrimination, hate speech as a phenomenon, extremism/radicalization as a phenomenon, terrorism studies, politics, elections, religion, gender, sexuality, drugs, violence, genocide, war, controversial history.

BLOCK when the apparent purpose is to:
- produce or promote hateful/dehumanizing content targeting protected groups, or advocate discrimination
- create extremist propaganda, recruit for or support extremist groups
- threaten people, or obtain instructions to harm people or commit serious wrongdoing (weapons, attacks, self-harm methods, crimes)
- anything else clearly disallowed.

Reply ONLY with JSON: {"allowed": true|false, "category": "none"|"hate"|"extremism"|"threat"|"harm"|"wrongdoing"|"other"}`;

/** Fails closed: any error or unreadable output means the request is not allowed. */
export async function checkSafety(text: string): Promise<{ allowed: boolean; category: string }> {
  try {
    const out = await callLlm(SYSTEM, [{ role: "user", content: text.slice(0, 6000) }], "low");
    const parsed = parseJson<{ allowed?: unknown; category?: unknown }>(out);
    return { allowed: parsed.allowed === true, category: String(parsed.category ?? "other") };
  } catch (e) {
    console.error("safety gate failed closed", e);
    throw e;
  }
}

export const REFUSAL =
  "I can't help with this request. Larry supports academic library research only. You're welcome to start a new request.";
