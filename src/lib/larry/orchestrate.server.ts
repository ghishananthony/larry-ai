import type { ProviderRun, ResearchProfile, SearchResult, SourceRecord } from "./types";
import { ADAPTERS, adapterFor, type SearchAdapter } from "./adapters.server";
import { callLlm, parseJson } from "./llm.server";
import type { TenantResource } from "./tenant.server";

const PLAN_SYSTEM = `You plan library database searches for a student's CONFIRMED research profile.
You receive: the profile, the searchable resources (with their query syntax), and the institution's other licensed resources that cannot be searched automatically yet.
- Choose EVERY searchable resource that plausibly fits the profile's discipline, concepts, population and source requirements (0-8). Search all of them — never stop at one. Do not default to any single database. Skip resources whose content type cannot meet an explicit source requirement (e.g. public-domain books when peer-reviewed articles are required).
- Write one query per chosen resource in THAT provider's syntax, built from the student's own concepts, population and relationship plus the provided search vocabulary. Do NOT add concepts the student did not name. Do not include date/peer-review filters (applied automatically). Do not paste the student's sentence.
- From the non-searchable list, pick up to 6 that fit the profile and return their exact "name" values.
JSON only: {"searches":[{"resource":"exact name","query":"..."}],"alsoRelevant":["exact name"]}`;

const RANK_SYSTEM = `You check how well real search records match a student's CONFIRMED research requirements.
Judge ONLY from the given metadata (title, venue, year, type). Do not invent details, do not summarize or explain content, do not say what a source proves.
"strong" = matches ALL of the student's core concepts, focus and population.
"partial" = still matches EVERY core concept and the stated population, but a secondary detail (e.g. exact wording, method, setting) cannot be confirmed from the metadata.
"weak" = missing or replacing ANY core concept, the focus, or the stated population (e.g. a broader population, a broader or different concept). Never rate a broader record as partial — that would change the student's scope.
For each record return match "strong", "partial" or "weak" and a note of at most 15 words naming which stated requirements it matches (e.g. "Matches social media, self-esteem and adolescent population").
JSON only: {"ratings":[{"id":"...","match":"strong|partial|weak","note":"..."}]}`;

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export async function runSearch(
  profile: ResearchProfile,
  resources: TenantResource[],
  devAdapters: SearchAdapter[] = [],
): Promise<SearchResult> {
  const subscribed = new Set(resources.map((r) => r.name));
  // Dev/test providers are a separate list; they never touch the tenant rule below.
  const dev = new Map(devAdapters.filter((a) => !adapterFor(a.resource)).map((a) => [a.resource, a]));
  const searchable = [...ADAPTERS.filter((a) => subscribed.has(a.resource)), ...dev.values()];
  const other = resources.filter((r) => !adapterFor(r.name)).map((r) => ({ name: r.name, subjects: r.disciplines.join(", ") }));

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
    .filter((s) => ((subscribed.has(s.resource) && adapterFor(s.resource)) || dev.has(s.resource)) && s.query?.trim())
    .filter((s, i, a) => a.findIndex((x) => x.resource === s.resource) === i)
    .slice(0, 9);
  const notYetSearchable = (plan.alsoRelevant ?? [])
    .filter((n) => subscribed.has(n) && !adapterFor(n))
    .slice(0, 6);

  const runs: ProviderRun[] = [];
  const batches = await Promise.all(
    searches.map(async (s) => {
      try {
        const adapter = subscribed.has(s.resource) && adapterFor(s.resource) ? adapterFor(s.resource)! : dev.get(s.resource)!;
        const recs = await adapter.search(s.query, profile, 20);
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
    // DOI first; otherwise conservative title + year + first-author surname (never title alone).
    const surname = norm(r.authors[0] ?? "").split(" ").pop() ?? "";
    const keys = [r.doi ? `doi:${r.doi.toLowerCase()}` : null, `t:${norm(r.title)}|${r.year ?? "?"}|${surname}`].filter(Boolean) as string[];
    if (keys.some((k) => seen.has(k))) continue;
    if (profile.peerReviewed && /public-domain book/i.test(r.sourceType ?? "")) continue;
    if (r.year && profile.yearFrom && r.year < profile.yearFrom) continue;
    if (r.year && profile.yearTo && r.year > profile.yearTo) continue;
    keys.forEach((k) => seen.add(k));
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

  // The student's requested count is carried from the confirmed profile to here unchanged.
  const requested = profile.sourceCount;
  sources = sources.slice(0, requested ?? 10);

  let narrowNotice: string | null = null;
  const searched = runs.filter((r) => r.status !== "error").map((r) => r.resource);
  if (searches.length === 0) {
    narrowNotice =
      "None of the resources Larry can search automatically fit your confirmed profile, so no sources were retrieved. The library resources listed below may be relevant; you can search them directly.";
  } else if ((requested && sources.length < requested) || sources.length === 0) {
    narrowNotice = `Larry found ${sources.length} matching source${sources.length === 1 ? "" : "s"}${requested ? ` of the ${requested} you asked for` : ""} after searching ${searched.join(", ") || "no reachable providers"}. No sources were invented to fill the gap, and your requirements were not changed. The library resources listed below could not be searched automatically. Any change to your requirements is your decision.`;
  }

  return { kind: "results", sources, runs, notYetSearchable, requested, narrowNotice };
}
