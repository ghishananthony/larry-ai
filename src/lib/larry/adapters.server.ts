import type { ResearchProfile, SourceRecord } from "./types";

/**
 * Provider-specific search adapters. Each adapter is keyed by the EXACT
 * resource name in the institution's resource directory; an adapter only runs
 * when the institution's own configuration lists that resource as active/trial.
 * Add new vendor integrations here (EBSCO, ProQuest, JSTOR...) as access is obtained.
 */
export type SearchAdapter = {
  resource: string;
  /** Described to the query planner so syntax matches the provider. */
  capabilities: string;
  search: (query: string, profile: ResearchProfile, limit: number) => Promise<SourceRecord[]>;
};

const UA = { "User-Agent": "Larry-Library-Assistant/1.0" };

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: UA });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as T;
}

const yearOf = (s: unknown) => {
  const m = String(s ?? "").match(/\b(1[5-9]|20)\d{2}\b/);
  return m ? Number(m[0]) : null;
};

const pubmed: SearchAdapter = {
  resource: "PubMed",
  capabilities:
    'NCBI PubMed (biomedicine, health, psychology, behavioral science). Boolean AND/OR/NOT, quoted phrases, field tags like [tiab] and MeSH terms like "Adolescent"[MeSH]. Date limits are applied automatically.',
  async search(query, profile, limit) {
    const params = new URLSearchParams({ db: "pubmed", term: query, retmode: "json", retmax: String(limit), sort: "relevance" });
    if (profile.yearFrom || profile.yearTo) {
      params.set("datetype", "pdat");
      params.set("mindate", String(profile.yearFrom ?? 1800));
      params.set("maxdate", String(profile.yearTo ?? new Date().getUTCFullYear()));
    }
    const s = await getJson<{ esearchresult: { idlist: string[] } }>(
      `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?${params}`,
    );
    const ids = s.esearchresult.idlist;
    if (!ids.length) return [];
    const sum = await getJson<{ result: Record<string, any> }>(
      `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&retmode=json&id=${ids.join(",")}`,
    );
    return ids
      .map((id) => sum.result[id])
      .filter(Boolean)
      .map((r): SourceRecord => {
        const doi = (r.articleids ?? []).find((a: any) => a.idtype === "doi")?.value ?? null;
        return {
          id: `pubmed:${r.uid}`,
          title: String(r.title ?? "").replace(/<[^>]+>/g, ""),
          authors: (r.authors ?? []).map((a: any) => a.name).slice(0, 8),
          container: r.fulljournalname || r.source || null,
          year: yearOf(r.pubdate),
          sourceType: (r.pubtype ?? []).join(", ") || "Journal article",
          peerReviewed: null, // PubMed does not certify peer review per record
          doi,
          url: `https://pubmed.ncbi.nlm.nih.gov/${r.uid}/`,
          foundIn: "PubMed",
        };
      });
  },
};

const eric: SearchAdapter = {
  resource: "ERIC",
  capabilities:
    'ERIC (education research). Solr syntax: AND/OR/NOT, quoted phrases, field searches like title:"x" or subject:"Adolescents". Peer-review and year filters are applied automatically.',
  async search(query, profile, limit) {
    let q = `(${query})`;
    if (profile.peerReviewed) q += " AND peerreviewed:T";
    if (profile.yearFrom || profile.yearTo) {
      q += ` AND publicationdateyear:[${profile.yearFrom ?? 1900} TO ${profile.yearTo ?? new Date().getUTCFullYear()}]`;
    }
    const params = new URLSearchParams({
      search: q,
      format: "json",
      rows: String(limit),
      fields: "id,title,author,source,publicationdateyear,peerreviewed,publicationtype,url",
    });
    const d = await getJson<{ response: { docs: any[] } }>(`https://api.ies.ed.gov/eric/?${params}`);
    return d.response.docs.map((r): SourceRecord => ({
      id: `eric:${r.id}`,
      title: r.title,
      authors: (r.author ?? []).slice(0, 8),
      container: r.source ?? null,
      year: r.publicationdateyear ?? null,
      sourceType: (r.publicationtype ?? []).join(", ") || null,
      peerReviewed: r.peerreviewed === "T" ? true : null,
      doi: null,
      url: `https://eric.ed.gov/?id=${r.id}`,
      foundIn: "ERIC",
    }));
  },
};

const oapen: SearchAdapter = {
  resource: "OAPEN Library",
  capabilities: "OAPEN open-access academic books (humanities, social sciences). Simple keyword/phrase search; keep queries short (2-5 words).",
  async search(query, profile, limit) {
    const d = await getJson<any[]>(
      `https://library.oapen.org/rest/search?query=${encodeURIComponent(query)}&expand=metadata&limit=${limit}`,
    );
    return d
      .map((item): SourceRecord => {
        const md = (k: string) => (item.metadata ?? []).filter((m: any) => m.key === k).map((m: any) => m.value as string);
        return {
          id: `oapen:${item.handle}`,
          title: md("dc.title")[0] ?? item.name,
          authors: [...md("dc.contributor.author"), ...md("dc.contributor.editor")].slice(0, 8),
          container: md("publisher.name")[0] ?? null,
          year: yearOf(md("dc.date.issued")[0]),
          sourceType: "Academic book (open access)",
          peerReviewed: null,
          doi: md("oapen.identifier.doi")[0] ?? null,
          url: md("dc.identifier.uri")[0] ?? `https://library.oapen.org/handle/${item.handle}`,
          foundIn: "OAPEN Library",
        };
      })
      .filter((r) => !profile.yearFrom || !r.year || r.year >= profile.yearFrom);
  },
};

const gutenberg: SearchAdapter = {
  resource: "Project Gutenberg",
  capabilities: "Project Gutenberg public-domain books (classic literature, historical primary texts). Search by title/author words only; 1-4 words.",
  async search(query, _profile, limit) {
    const d = await getJson<{ results: any[] }>(`https://gutendex.com/books/?search=${encodeURIComponent(query)}`);
    return d.results.slice(0, limit).map((b): SourceRecord => ({
      id: `gutenberg:${b.id}`,
      title: b.title,
      authors: (b.authors ?? []).map((a: any) => a.name),
      container: "Project Gutenberg",
      year: null,
      sourceType: "Public-domain book",
      peerReviewed: null,
      doi: null,
      url: `https://www.gutenberg.org/ebooks/${b.id}`,
      foundIn: "Project Gutenberg",
    }));
  },
};

/**
 * Publisher platforms searched through Crossref's official public metadata API,
 * restricted to that publisher's Crossref member id. Records are real DOIs
 * registered by the publisher; full text still depends on the library's license.
 */
function crossrefPublisher(resource: string, member: number, desc: string): SearchAdapter {
  return {
    resource,
    capabilities: `${desc} Searched via Crossref bibliographic metadata: plain keywords/phrases only (no Boolean operators, no field tags), 3-8 words.`,
    async search(query, profile, limit) {
      const filters = [`member:${member}`, "type:journal-article"];
      if (profile.yearFrom) filters.push(`from-pub-date:${profile.yearFrom}`);
      if (profile.yearTo) filters.push(`until-pub-date:${profile.yearTo}`);
      const params = new URLSearchParams({
        "query.bibliographic": query.replace(/\b(AND|OR|NOT)\b|[()"]/g, " ").replace(/\s+/g, " ").trim(),
        filter: filters.join(","),
        rows: String(limit),
        select: "DOI,title,author,container-title,publisher,issued,type,URL",
        mailto: "larry-library-assistant@example.org",
      });
      const d = await getJson<{ message: { items: any[] } }>(`https://api.crossref.org/works?${params}`);
      return d.message.items.map((r): SourceRecord => ({
        id: `doi:${String(r.DOI).toLowerCase()}`,
        title: (r.title ?? [])[0] ?? "",
        authors: (r.author ?? []).map((a: any) => [a.given, a.family].filter(Boolean).join(" ")).filter(Boolean).slice(0, 8),
        container: (r["container-title"] ?? [])[0] ?? null,
        publisher: r.publisher ?? null,
        year: r.issued?.["date-parts"]?.[0]?.[0] ?? null,
        sourceType: "Journal article",
        peerReviewed: null, // Crossref does not certify peer review
        doi: r.DOI ?? null,
        url: r.DOI ? `https://doi.org/${r.DOI}` : r.URL,
        foundIn: resource,
        via: "Crossref metadata",
        access: "Full text through your library's subscription",
      }));
    },
  };
}

const tandf = crossrefPublisher("Taylor & Francis Online", 301, "Taylor & Francis journals (social sciences, humanities, psychology, education, business, science).");
const mitPress = crossrefPublisher("MIT Press Journals", 281, "MIT Press journals (economics, cognitive science, arts, computing, international affairs).");
const scienceDirect = crossrefPublisher("ScienceDirect", 78, "Elsevier/ScienceDirect journals (sciences, health, psychology, social sciences, business).");
const annualPsych: SearchAdapter = {
  ...crossrefPublisher("Annual Review of Psychology", 22, "Annual Reviews (review articles; psychology)."),
};

export const ADAPTERS: SearchAdapter[] = [pubmed, eric, oapen, gutenberg, tandf, mitPress, scienceDirect, annualPsych];
export const adapterFor = (resourceName: string) => ADAPTERS.find((a) => a.resource === resourceName);
