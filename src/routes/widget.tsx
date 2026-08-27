import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { SiteFooter, SiteNav } from "@/components/SiteNav";
import {
  buildAccessUrl,
  getInstitution,
  institutions,
  matchResources,
  type MatchedResource,
} from "@/lib/institutions";

export const Route = createFileRoute("/widget")({
  head: () => ({
    meta: [
      { title: "Student Widget — Larry for Libraries" },
      {
        name: "description",
        content:
          "Enter your own research goal and requirements. Larry points you to the databases and catalog records your institution licenses — nothing more.",
      },
      { property: "og:title", content: "Student Widget — Larry for Libraries" },
      {
        property: "og:description",
        content:
          "Larry matches a student's stated research requirements to their library's licensed databases and catalog.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: WidgetPage;
});

const SOURCE_TYPES = [
  "Peer-reviewed articles",
  "Books & e-books",
  "Dissertations",
  "Primary sources",
];

function WidgetPage() {
  const [slug, setSlug] = useState(institutions[0].slug);
  const [goal, setGoal] = useState("");
  const [types, setTypes] = useState<string[]>(["Peer-reviewed articles"]);
  const [results, setResults] = useState<MatchedResource[] | null>(null);

  const institution = getInstitution(slug);

  const toggleType = (t: string) =>
    setTypes((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));

  const run = () => {
    if (!goal.trim()) return;
    setResults(matchResources(institution, goal, types));
  };

  return (
    <div className="min-h-screen bg-background font-sans text-foreground">
      <SiteNav />

      <main className="max-w-7xl mx-auto px-8 py-16">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
          <div>
            <span className="inline-block px-3 py-1 bg-accent/10 text-accent text-xs font-bold tracking-widest uppercase mb-4">
              Student Interface
            </span>
            <h1 className="font-serif text-4xl leading-tight">
              You choose what to research. Larry finds where to look.
            </h1>
          </div>
          <label className="text-sm">
            <span className="block text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-2">
              Your institution
            </span>
            <select
              value={slug}
              onChange={(e) => {
                setSlug(e.target.value);
                setResults(null);
              }}
              className="bg-card border border-input rounded-lg px-3 py-2 text-sm"
            >
              {institutions.map((i) => (
                <option key={i.slug} value={i.slug}>
                  {i.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="bg-card rounded-2xl shadow-panel border border-border overflow-hidden grid lg:grid-cols-12">
          <div className="lg:col-span-5 p-8 bg-background border-b lg:border-b-0 lg:border-r border-border">
            <label className="block text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-2">
              Your research goal, in your own words
            </label>
            <textarea
              rows={5}
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="e.g. I'm writing a psychology paper on social media use and teenage self-esteem."
              className="w-full bg-card border border-input rounded-lg p-4 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40 resize-none"
            />
            <p className="mt-2 text-xs text-muted-foreground">
              Larry does not write, refine, or suggest research goals. Your wording is used only to
              match licensed resources.
            </p>

            <div className="mt-8">
              <span className="block text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-3">
                Required source types
              </span>
              <div className="flex flex-wrap gap-2">
                {SOURCE_TYPES.map((t) => {
                  const on = types.includes(t);
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => toggleType(t)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                        on
                          ? "bg-primary text-primary-foreground border-primary"
                          : "border-input text-muted-foreground hover:bg-secondary"
                      }`}
                    >
                      {t}
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              type="button"
              onClick={run}
              className="mt-8 w-full bg-primary text-primary-foreground py-3 rounded-lg font-semibold hover:shadow-lg transition-shadow"
            >
              Locate resources
            </button>
          </div>

          <div className="lg:col-span-7 p-8">
            <div className="flex items-center justify-between pb-4 border-b border-border mb-6">
              <h2 className="font-serif text-2xl italic text-accent">
                Where to look at {institution.shortName}
              </h2>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">
                Licensed resources only
              </span>
            </div>

            {results === null && (
              <p className="text-sm text-muted-foreground">
                Enter your goal and requirements to see the databases and catalog entries your
                library subscribes to.
              </p>
            )}

            {results?.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No licensed resource at {institution.name} matched those requirements. Contact a
                reference librarian for interlibrary loan options.
              </p>
            )}

            <div className="space-y-6">
              {results?.map(({ resource, reasons }) => (
                <div key={resource.id} className="border border-border rounded-xl p-5 bg-background">
                  <div className="flex items-start justify-between gap-4 mb-1">
                    <h3 className="font-semibold">{resource.name}</h3>
                    <span className="shrink-0 text-[10px] uppercase font-bold tracking-wider px-2 py-1 rounded-full bg-accent/10 text-accent">
                      {resource.kind}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mb-3">
                    {resource.provider} · Access via {resource.auth}
                  </p>
                  <ul className="text-sm text-muted-foreground space-y-1 mb-4">
                    {reasons.map((r) => (
                      <li key={r} className="flex gap-2">
                        <span className="text-accent">—</span> {r}
                      </li>
                    ))}
                  </ul>
                  <a
                    href={buildAccessUrl(institution, resource, goal) || "#"}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex text-xs font-bold uppercase tracking-wider underline decoration-accent underline-offset-4"
                  >
                    Open via {institution.shortName} login ↗
                  </a>
                </div>
              ))}
            </div>

            {results && results.length > 0 && (
              <p className="mt-6 text-xs text-muted-foreground border-t border-border pt-4">
                Larry does not read, summarize, or evaluate these sources. Reading, judging, and
                selecting them is your work.
              </p>
            )}
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
