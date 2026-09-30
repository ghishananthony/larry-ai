import { createFileRoute, Link } from "@tanstack/react-router";
import adminPreview from "@/assets/admin-dashboard-preview.jpg";
import { SiteFooter, SiteNav } from "@/components/SiteNav";
import heroBg from "@/assets/larry-hero-background.jpg.asset.json";
import { useInstitutionAccess } from "@/hooks/useInstitutionAccess";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Larry — Find resources faster, with Larry" },
      {
        name: "description",
        content:
          "Larry is an AI research assistant for college libraries. Students state their research goal; Larry points them to the databases their institution actually licenses.",
      },
      { property: "og:title", content: "Larry — Find resources faster, with Larry" },
      {
        property: "og:description",
        content:
          "An institution-configured research assistant that connects students to their library's licensed databases and catalog.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  const access = useInstitutionAccess();
  return (
    <div className="min-h-screen bg-background font-sans text-foreground">
      <div
        className="relative overflow-hidden bg-background bg-cover bg-top bg-no-repeat lg:min-h-[66.6vw]"
        style={{ backgroundImage: `url(${heroBg.url})` }}
      >
        <SiteNav />
      <header className="relative z-10 max-w-[1320px] mx-auto px-8 lg:px-[8.8vw] xl:px-8 pt-24 lg:pt-[10vw] pb-24 xl:pr-[152px] grid lg:grid-cols-[1fr_513px] gap-12 items-start">
        <div>
          <span className="inline-block px-2.5 py-1 rounded bg-accent/10 text-accent text-xs font-semibold tracking-[0.14em] uppercase mb-6">
            For Academic Institutions
          </span>
          <h1 className="font-serif text-5xl md:text-[64px] leading-[1.08] tracking-tight mb-7">
            Find resources faster,<br /><span className="text-accent italic">with Larry.</span>
          </h1>
          <p className="text-xl text-muted-foreground leading-relaxed mb-8 max-w-lg">
            The AI research assistant that connects students to your library's licensed databases.
            You choose what to research. Larry finds where to look.
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <Link
              to="/widget"
              className="bg-primary text-primary-foreground px-10 py-4 rounded-md font-semibold text-lg hover:shadow-lg transition-shadow text-center"
            >
              Try the student widget
            </Link>
            {access.data?.isAdmin && (
              <Link
                to="/admin"
                className="border border-input px-8 py-4 rounded-lg font-semibold hover:bg-card transition-colors text-center"
              >
                See the admin console
              </Link>
            )}
          </div>
        </div>

        <div className="relative">
          <div className="bg-card rounded-2xl shadow-panel border border-border overflow-hidden">
            <div className="bg-primary p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="size-6 bg-accent rounded-full" />
                <span className="text-primary-foreground font-medium text-sm">
                  Larry @ Menlo College
                </span>
              </div>
              <div className="size-2 bg-success rounded-full animate-pulse" />
            </div>
            <div className="p-6 space-y-6">
              <div className="space-y-2">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">
                  Student Research Goal
                </p>
                <div className="p-4 bg-background rounded-lg border border-border italic text-sm">
                  "I'm researching the impact of micro-plastics on deep-sea biodiversity in the
                  Pacific, specifically for a 300-level marine biology thesis."
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="size-6 rounded-full bg-primary shrink-0 mt-1" />
                  <div className="bg-accent/5 p-4 rounded-lg border border-accent/20">
                    <p className="text-sm leading-relaxed">
                      Two licensed places to look: <strong>ScienceDirect Journals</strong> and{" "}
                      <strong>ProQuest Dissertations &amp; Theses</strong>. Both are included in
                      your university's subscriptions.
                    </p>
                    <div className="mt-4 flex gap-2">
                      <span className="px-2 py-1 bg-card border border-input rounded text-[10px] font-bold uppercase">
                        Open ScienceDirect
                      </span>
                      <span className="px-2 py-1 bg-card border border-input rounded text-[10px] font-bold uppercase">
                        Library Catalog
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>
      </div>

      <section className="bg-card py-24">
        <div className="max-w-7xl mx-auto px-8">
          <div className="grid md:grid-cols-3 gap-12">
            <div className="space-y-4">
              <div className="size-12 bg-background rounded-lg grid place-items-center border border-border italic font-serif text-xl text-accent">
                01
              </div>
              <h3 className="text-xl font-bold">Deep Catalog Integration</h3>
              <p className="text-muted-foreground leading-relaxed">
                Connects securely to your EBSCO, ProQuest, and JSTOR subscriptions through standard
                institutional authentication.
              </p>
            </div>
            <div className="space-y-4">
              <div className="size-12 bg-background rounded-lg grid place-items-center border border-border italic font-serif text-xl text-accent">
                02
              </div>
              <h3 className="text-xl font-bold">Institutional Guardrails</h3>
              <p className="text-muted-foreground leading-relaxed">
                Larry identifies where to look but never writes the student's paper, ensuring
                academic integrity is maintained at every step.
              </p>
            </div>
            <div className="space-y-4">
              <div className="size-12 bg-background rounded-lg grid place-items-center border border-border italic font-serif text-xl text-accent">
                03
              </div>
              <h3 className="text-xl font-bold">Admin Dashboard</h3>
              <p className="text-muted-foreground leading-relaxed">
                Track usage patterns, identify resource gaps, and configure your library's specific
                database links in minutes.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section id="integrity" className="max-w-7xl mx-auto px-8 py-24">
        <div className="grid md:grid-cols-3 gap-12">
          <div>
            <span className="inline-block px-3 py-1 bg-accent/10 text-accent text-xs font-bold tracking-widest uppercase mb-6">
              Integrity Policy
            </span>
            <h2 className="font-serif text-3xl leading-tight">What Larry will not do</h2>
          </div>
          <ul className="md:col-span-2 grid sm:grid-cols-2 gap-x-12 gap-y-6 text-muted-foreground">
            <li className="flex gap-3">
              <span className="text-accent font-serif italic">01.</span> Never writes or drafts any
              part of a student's paper.
            </li>
            <li className="flex gap-3">
              <span className="text-accent font-serif italic">02.</span> Never creates research
              questions, goals, or directions.
            </li>
            <li className="flex gap-3">
              <span className="text-accent font-serif italic">03.</span> Never summarizes, explains,
              or evaluates source content.
            </li>
            <li className="flex gap-3">
              <span className="text-accent font-serif italic">04.</span> Never surfaces resources
              the institution does not license.
            </li>
          </ul>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-8 pb-24">
        <div className="bg-primary rounded-3xl overflow-hidden shadow-panel flex flex-col md:flex-row">
          <div className="p-12 md:w-1/3 flex flex-col justify-center text-primary-foreground border-b md:border-b-0 md:border-r border-sidebar-border">
            <h2 className="font-serif text-3xl mb-4">Institutional Control</h2>
            <p className="text-primary-foreground/60 mb-8">
              Every university gets a bespoke instance. Control exactly which databases Larry can
              recommend and monitor engagement metrics in real time.
            </p>
            <ul className="space-y-4 text-sm">
              <li className="flex items-center gap-3">
                <span className="size-1.5 bg-accent rounded-full" /> Custom Proxy Configuration
              </li>
              <li className="flex items-center gap-3">
                <span className="size-1.5 bg-accent rounded-full" /> Resource Visibility Toggles
              </li>
              <li className="flex items-center gap-3">
                <span className="size-1.5 bg-accent rounded-full" /> SSO &amp; Shibboleth Auth
              </li>
            </ul>
          </div>
          <div className="p-8 md:w-2/3 bg-sidebar-accent">
            <img
              src={adminPreview}
              alt="Larry admin console showing library resource usage charts and active database connections"
              width={1536}
              height={1024}
              loading="lazy"
              className="w-full rounded-xl border border-sidebar-border"
            />
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
