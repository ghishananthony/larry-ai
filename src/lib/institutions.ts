export type AuthMethod = "Shibboleth SSO" | "IP Range" | "EZproxy" | "OpenAthens";

export type ResourceStatus = "active" | "trial" | "not_subscribed" | "auth_error";

export type LibraryResource = {
  id: string;
  name: string;
  provider: string;
  kind: "database" | "catalog" | "repository";
  disciplines: string[];
  sourceTypes: string[];
  description: string;
  status: ResourceStatus;
  auth: AuthMethod;
  monthlyQueries: number;
  url: string;
};

export type Institution = {
  slug: string;
  name: string;
  shortName: string;
  catalogName: string;
  proxyPrefix: string;
  resources: LibraryResource[];
};

export const institutions: Institution[] = [
  {
    slug: "st-jude",
    name: "University of St. Jude",
    shortName: "St. Jude",
    catalogName: "St. Jude Main Library Catalog",
    proxyPrefix: "https://ezproxy.stjude.edu/login?url=",
    resources: [
      {
        id: "jstor",
        name: "JSTOR — Arts & Sciences Collections",
        provider: "ITHAKA",
        kind: "database",
        disciplines: ["psychology", "sociology", "history", "media"],
        sourceTypes: ["Peer-reviewed articles", "Book chapters"],
        description:
          "Multidisciplinary archive of scholarly journals, including behavioral and social science titles.",
        status: "active",
        auth: "Shibboleth SSO",
        monthlyQueries: 14208,
        url: "https://www.jstor.org/action/doBasicSearch?Query=",
      },
      {
        id: "psycinfo",
        name: "PsycINFO via EBSCOhost",
        provider: "EBSCO",
        kind: "database",
        disciplines: ["psychology", "education", "health"],
        sourceTypes: ["Peer-reviewed articles", "Dissertations"],
        description:
          "Indexes psychological literature, including adolescent development and self-concept measures.",
        status: "active",
        auth: "IP Range",
        monthlyQueries: 8992,
        url: "https://search.ebscohost.com/login.aspx?direct=true&db=psyh&bquery=",
      },
      {
        id: "proquest-diss",
        name: "ProQuest Dissertations & Theses",
        provider: "ProQuest",
        kind: "repository",
        disciplines: ["psychology", "marine biology", "sociology"],
        sourceTypes: ["Dissertations", "Primary sources"],
        description: "Doctoral and master's research across disciplines.",
        status: "active",
        auth: "EZproxy",
        monthlyQueries: 3120,
        url: "https://www.proquest.com/results?q=",
      },
      {
        id: "sciencedirect",
        name: "ScienceDirect Journals",
        provider: "Elsevier",
        kind: "database",
        disciplines: ["marine biology", "chemistry", "health"],
        sourceTypes: ["Peer-reviewed articles"],
        description: "Full-text science and technology journals.",
        status: "trial",
        auth: "EZproxy",
        monthlyQueries: 1043,
        url: "https://www.sciencedirect.com/search?qs=",
      },
      {
        id: "catalog",
        name: "St. Jude Main Library Catalog",
        provider: "Ex Libris Alma",
        kind: "catalog",
        disciplines: ["psychology", "history", "marine biology", "sociology", "media"],
        sourceTypes: ["Books & e-books", "Monographs"],
        description: "Books, e-books, and physical holdings across all campus libraries.",
        status: "active",
        auth: "Shibboleth SSO",
        monthlyQueries: 20144,
        url: "https://catalog.stjude.edu/discovery/search?query=any,contains,",
      },
      {
        id: "westlaw",
        name: "Westlaw Campus Research",
        provider: "Thomson Reuters",
        kind: "database",
        disciplines: ["law", "policy"],
        sourceTypes: ["Primary sources"],
        description: "Not currently licensed by this institution.",
        status: "not_subscribed",
        auth: "IP Range",
        monthlyQueries: 0,
        url: "",
      },
    ],
  },
  {
    slug: "hudson-river",
    name: "Hudson River University",
    shortName: "Hudson River",
    catalogName: "Hudson River Libraries Catalog",
    proxyPrefix: "https://proxy.hru.edu/login?url=",
    resources: [
      {
        id: "jstor",
        name: "JSTOR — Essential Collection",
        provider: "ITHAKA",
        kind: "database",
        disciplines: ["history", "sociology", "media"],
        sourceTypes: ["Peer-reviewed articles"],
        description: "Core humanities and social science journal archive.",
        status: "active",
        auth: "OpenAthens",
        monthlyQueries: 5211,
        url: "https://www.jstor.org/action/doBasicSearch?Query=",
      },
      {
        id: "eric",
        name: "ERIC (Education Resources)",
        provider: "U.S. Dept. of Education",
        kind: "database",
        disciplines: ["education", "psychology"],
        sourceTypes: ["Peer-reviewed articles", "Reports"],
        description: "Education research literature and reports.",
        status: "active",
        auth: "IP Range",
        monthlyQueries: 2870,
        url: "https://eric.ed.gov/?q=",
      },
      {
        id: "catalog",
        name: "Hudson River Libraries Catalog",
        provider: "FOLIO",
        kind: "catalog",
        disciplines: ["history", "education", "psychology", "media", "sociology"],
        sourceTypes: ["Books & e-books", "Monographs"],
        description: "Print and electronic holdings across three campus libraries.",
        status: "active",
        auth: "OpenAthens",
        monthlyQueries: 9004,
        url: "https://catalog.hru.edu/search?q=",
      },
      {
        id: "oup",
        name: "Oxford University Press Journals",
        provider: "OUP",
        kind: "database",
        disciplines: ["history", "sociology"],
        sourceTypes: ["Peer-reviewed articles"],
        description: "Authentication handshake is currently failing.",
        status: "auth_error",
        auth: "Shibboleth SSO",
        monthlyQueries: 0,
        url: "https://academic.oup.com/journals/search-results?q=",
      },
      {
        id: "psycinfo",
        name: "PsycINFO via EBSCOhost",
        provider: "EBSCO",
        kind: "database",
        disciplines: ["psychology"],
        sourceTypes: ["Peer-reviewed articles"],
        description: "Not currently licensed by this institution.",
        status: "not_subscribed",
        auth: "IP Range",
        monthlyQueries: 0,
        url: "",
      },
    ],
  },
];

export function getInstitution(slug: string): Institution {
  return institutions.find((i) => i.slug === slug) ?? institutions[0];
}

const disciplineKeywords: Record<string, string[]> = {
  psychology: ["psycholog", "self-esteem", "self esteem", "adolescen", "teen", "mental", "behavior"],
  sociology: ["sociolog", "social media", "society", "community", "inequality", "culture"],
  history: ["history", "historical", "archive", "war", "century"],
  "marine biology": ["marine", "ocean", "biodiversity", "plastic", "coral", "species"],
  education: ["education", "classroom", "student learning", "pedagog", "school"],
  media: ["media", "platform", "instagram", "tiktok", "algorithm", "screen time"],
  health: ["health", "clinical", "wellbeing", "well-being", "nutrition"],
  chemistry: ["chemistry", "chemical", "compound"],
  law: ["law", "legal", "statute", "court"],
  policy: ["policy", "regulation", "governance"],
};

export type MatchedResource = {
  resource: LibraryResource;
  score: number;
  reasons: string[];
};

/**
 * Deterministic requirement matching. Larry only ranks WHERE to look —
 * it never interprets, summarizes, or extends the student's research goal.
 */
export function matchResources(
  institution: Institution,
  goal: string,
  sourceTypes: string[],
): MatchedResource[] {
  const text = goal.toLowerCase();

  const matchedDisciplines = Object.entries(disciplineKeywords)
    .filter(([, words]) => words.some((w) => text.includes(w)))
    .map(([discipline]) => discipline);

  return institution.resources
    .filter((r) => r.status === "active" || r.status === "trial")
    .map((resource) => {
      const reasons: string[] = [];
      let score = 0;

      const overlap = resource.disciplines.filter((d) => matchedDisciplines.includes(d));
      if (overlap.length > 0) {
        score += overlap.length * 30;
        reasons.push(`Subject coverage: ${overlap.join(", ")}`);
      }

      const typeOverlap = resource.sourceTypes.filter((t) => sourceTypes.includes(t));
      if (typeOverlap.length > 0) {
        score += typeOverlap.length * 20;
        reasons.push(`Holds requested formats: ${typeOverlap.join(", ")}`);
      }

      if (resource.kind === "catalog") {
        score += 10;
        reasons.push("Institution catalog — checked for every request");
      }

      if (resource.status === "trial") {
        reasons.push("Trial access — availability may end");
      }

      return { resource, score, reasons };
    })
    .filter((m) => m.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}

export function buildAccessUrl(institution: Institution, resource: LibraryResource, query: string) {
  if (!resource.url) return "";
  const target = `${resource.url}${encodeURIComponent(query)}`;
  return resource.auth === "EZproxy" ? `${institution.proxyPrefix}${encodeURIComponent(target)}` : target;
}
