import type { SearchAdapter } from "./adapters.server";
import type { SourceRecord } from "./types";

/**
 * DEVELOPMENT / TEST-ONLY search providers.
 *
 * These are NOT institution-licensed resources and never appear in any
 * institution's resource directory. They are eligible only when BOTH:
 *   1. the server-side secret LARRY_DEV_PROVIDERS lists the provider id, and
 *   2. the request is served from a development/preview host.
 * Any other case (published site, missing flag, missing key) fails closed.
 */

export const OPENALEX_TEST_NAME = "OpenAlex (test provider)";

const openalex: SearchAdapter = {
  resource: OPENALEX_TEST_NAME,
  capabilities:
    "OpenAlex (development test provider; cross-disciplinary scholarly works index). Plain keywords; supports AND/OR/NOT and quoted phrases. Date and article-type filters are applied automatically.",
  async search(query, profile, limit) {
    const key = process.env.OPENALEX_API_KEY;
    if (!key) throw new Error("OpenAlex test provider is not configured");
    const filters: string[] = [];
    if (profile.yearFrom) filters.push(`from_publication_date:${profile.yearFrom}-01-01`);
    if (profile.yearTo) filters.push(`to_publication_date:${profile.yearTo}-12-31`);
    if (profile.peerReviewed) filters.push("type:article");
    const params = new URLSearchParams({ search: query, per_page: String(limit), api_key: key });
    if (filters.length) params.set("filter", filters.join(","));
    const res = await fetch(`https://api.openalex.org/works?${params}`, {
      headers: { "User-Agent": "Larry-Library-Assistant/1.0" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const d = (await res.json()) as { results: any[] };
    return (d.results ?? [])
      .filter((r) => r.display_name)
      .map((r): SourceRecord => {
        const doi = r.doi ? String(r.doi).replace(/^https?:\/\/doi\.org\//i, "") : null;
        return {
          id: doi ? `doi:${doi.toLowerCase()}` : `openalex:${String(r.id).split("/").pop()}`,
          title: String(r.display_name),
          authors: (r.authorships ?? []).map((a: any) => a.author?.display_name).filter(Boolean).slice(0, 8),
          container: r.primary_location?.source?.display_name ?? null,
          publisher: r.primary_location?.source?.host_organization_name ?? null,
          year: r.publication_year ?? null,
          sourceType: r.type ?? null,
          peerReviewed: null, // OpenAlex does not certify peer review
          doi,
          url: doi ? `https://doi.org/${doi}` : r.primary_location?.landing_page_url || r.id,
          foundIn: OPENALEX_TEST_NAME,
          via: "OpenAlex API",
          access: r.open_access?.is_oa ? "Open access copy reported by OpenAlex" : null,
        };
      });
  },
};

const DEV_ADAPTERS: Record<string, SearchAdapter> = { openalex };

function isDevHost(host: string | null | undefined): boolean {
  if (!host) return false;
  const h = host.toLowerCase().split(":")[0];
  return h === "localhost" || h === "127.0.0.1" || h.startsWith("id-preview--") || h.endsWith("-dev.lovable.app");
}

/** Returns the dev adapters enabled for this request; empty (fail closed) otherwise. */
export function enabledDevAdapters(host: string | null | undefined): SearchAdapter[] {
  if (!isDevHost(host)) return [];
  const flag = process.env.LARRY_DEV_PROVIDERS ?? "";
  return flag
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((id) => DEV_ADAPTERS[id])
    .map((id) => DEV_ADAPTERS[id])
    .filter((a) => a !== openalex || !!process.env.OPENALEX_API_KEY);
}
