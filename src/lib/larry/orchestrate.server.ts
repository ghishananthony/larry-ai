import type { ProviderRun, ResearchProfile, SearchResult, SourceRecord } from "./types";
import { ADAPTERS, adapterFor } from "./adapters.server";
import { callLlm, parseJson } from "./llm.server";
import type { TenantResource } from "./tenant.server";

const PLAN_SYSTEM = `You plan library database searches for a student's CONFIRMED research profile.
You receive: the profile, the searchable resources (with their query syntax), and the institution's other licensed resources that cannot be searched automatically yet.
- Choose only searchable resources that genuinely fit the profile's discipline and source requirements (0-4). Do not default to any single database.
- Write one query per chosen resource in THAT provider's syntax, built from the student's own concepts, population and relationship plus the provided search vocabulary. Do NOT add concepts the student did not name. Do not include date/peer-review filters (applied automatically). Do not paste the student's sentence.
- From the non-searchable list, pick up to 5 that fit the profile (exact names).
JSON only: {"searches":[{"resource":"exact name","query":"..."}],"alsoRelevant":["exact name"]}`;

const RANK_SYSTEM = `You check how well real search records match a student's CONFIRMED research requirements.
Judge ONLY from the given metadata (title, venue, year, type). Do not invent details, do not summarize or explain content, do not say what a source proves.
For each record return match "strong", "partial" or "weak" and a note of at most 15 words naming which stated requirements it matches (e.g. "Matches social media, self-esteem and adolescent population").
JSON only: {"ratings":[{"id":"...","match":"strong|partial|weak","note":"..."}]}`;

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export async function runSearch(profile: ResearchProfile, resources: TenantResource[]): Promise<SearchResult> {
  const subscribed = new Set(resources.map((r) => r.name));
  const searchable = ADAPTERS.filter((a) => subscribed.has(a.resource));
  const other = resources.filter((r) => !adapterFor(r.name)).map((r) => `${r.name} — ${r.disciplines.join(", ")}`);

  const planOut = await callLlm(PLAN_SYSTEM, [
    {
      role: "user",
      content: JSON.stringify({
        profile,
        searchable: searchable.map((a) => ({ resource: a.resource, syntax: a.capabilities })),
        notSearchable: other,
      }),
    },
  ]);
  const plan = parseJson<{ searches?: { resource: string; query: string }[]; alsoRelevant?: string[] }>(planOut);

  const searches = (plan.searches ?? [])
    .filter((s) => subscribed.has(s.resource) && adapterFor(s.resource) && s.query?.trim())
    .slice(0, 4);
  const notYetSearchable = (plan.alsoRelevant ?? [])
    .filter((n) => subscribed.has(n) && !adapterFor(n))
    .slice(0, 5);

  const runs: ProviderRun[] = [];
  const batches = await Promise.all(
    searches.map(async (s) => {
      try {
        const recs = await adapterFor(s.resource)!.search(s.query, profile, 15);
        runs.push({ resource: s.resource, query: s.query, status: recs.length ? "ok" : "no_results", count: recs.length });
        return recs;
      } catch (e) {
        runs.push({ resource: s.resource, query: s.query, status: "error", count: 0, message: (e as Error).message });
        return [];
      }
    }),
  );

  // Normalize + dedupe (DOI first, then title) + enforce the student's date requirement where the year is known.
  const seen = new Set<string>();
  const pool: SourceRecord[] = [];
  for (const r of batches.flat()) {
    if (!r.title) continue;
    const key = r.doi ? `doi:${r.doi.toLowerCase()}` : `t:${norm(r.title)}`;
    if (seen.has(key)) continue;
    if (r.year && profile.yearFrom && r.year < profile.yearFrom) continue;
    if (r.year && profile.yearTo && r.year > profile.yearTo) continue;
    seen.add(key);
    pool.push(r);
  }

  let sources: SourceRecord[] = [];
  if (pool.length) {
    const rankOut = await callLlm(RANK_SYSTEM, [
      {
        role: "user",
        content: JSON.stringify({
          requirements: profile,
          records: pool.map((r) => ({ id: r.id, title: r.title, venue: r.container, year: r.year, type: r.sourceType })),
        }),
      },
    ]);
    const ratings = parseJson<{ ratings?: { id: string; match: string; note: string }[] }>(rankOut).ratings ?? [];
    const byId = new Map(ratings.map((x) => [x.id, x]));
    sources = pool
      .map((r): SourceRecord | null => {
        const x = byId.get(r.id);
        if (!x || (x.match !== "strong" && x.match !== "partial")) return null;
        return { ...r, match: x.match as "strong" | "partial", matchNote: String(x.note ?? "").slice(0, 140) };
      })
      .filter((r): r is SourceRecord => r !== null)
      .sort((a, b) => (a.match === b.match ? 0 : a.match === "strong" ? -1 : 1));
  }

  const requested = profile.sourceCount;
  const limit = Math.max(requested ?? 10, 5) + 3;
  sources = sources.slice(0, limit);

  let narrowNotice: string | null = null;
  const strong = sources.filter((s) => s.match === "strong").length;
  if (searches.length === 0) {
    narrowNotice =
      "None of the resources Larry can search automatically fit this profile yet. The licensed resources listed below may help — Larry will not change your scope unless you choose to.";
  } else if ((requested && strong < requested) || sources.length === 0) {
    narrowNotice = `Your current requirements returned ${strong} strong match${strong === 1 ? "" : "es"}${requested ? ` (you asked for ${requested})` : ""}. They may be limiting results. Would you like to broaden a specific requirement — for example the date range, population, or source type? Larry will not change your scope unless you choose to.`;
  }

  return { kind: "results", sources, runs, notYetSearchable, requested, narrowNotice };
}
