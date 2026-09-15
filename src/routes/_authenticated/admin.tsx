import { createFileRoute, redirect } from "@tanstack/react-router";
import { SiteFooter, SiteNav } from "@/components/SiteNav";
import { supabase } from "@/integrations/supabase/client";
import { useInstitutionAccess } from "@/hooks/useInstitutionAccess";
import { getInstitution, type ResourceStatus } from "@/lib/institutions";

export const Route = createFileRoute("/_authenticated/admin")({
  beforeLoad: async () => {
    // Authorization is enforced in the database (RLS); this only avoids
    // rendering an empty console to someone who has no admin grant.
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) throw redirect({ to: "/auth" });
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id);
    const allowed = (roles ?? []).some(
      (r) => r.role === "college_admin" || r.role === "super_admin",
    );
    if (!allowed) throw redirect({ to: "/profile" });
  },
  head: () => ({
    meta: [
      { title: "Admin Console — Larry for Libraries" },
      {
        name: "description",
        content:
          "Configure each institution's licensed databases, catalog, proxy and SSO authentication, and monitor Larry usage across the library.",
      },
      { property: "og:title", content: "Admin Console — Larry for Libraries" },
      {
        property: "og:description",
        content:
          "Per-institution configuration of licensed databases, catalog links, authentication methods, and usage analytics.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AdminPage,
});

const statusLabel: Record<ResourceStatus, string> = {
  active: "Active",
  trial: "Trial",
  not_subscribed: "Not subscribed",
  auth_error: "Auth failure",
};

const statusDot: Record<ResourceStatus, string> = {
  active: "bg-success",
  trial: "bg-accent",
  not_subscribed: "bg-input",
  auth_error: "bg-destructive",
};

function AdminPage() {
  const [slug, setSlug] = useState(institutions[0]!.slug);
  const institution = getInstitution(slug);
  const licensed = institution.resources.filter((r) => r.status === "active" || r.status === "trial");
  const queries = institution.resources.reduce((n, r) => n + r.monthlyQueries, 0);
  const issues = institution.resources.filter((r) => r.status === "auth_error").length;

  return (
    <div className="min-h-screen bg-background font-sans text-foreground">
      <SiteNav />

      <main className="max-w-7xl mx-auto px-8 py-16">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
          <div>
            <span className="inline-block px-3 py-1 bg-accent/10 text-accent text-xs font-bold tracking-widest uppercase mb-4">
              Institutional Console
            </span>
            <h1 className="font-serif text-4xl leading-tight">{institution.name}</h1>
            <p className="text-sm text-muted-foreground mt-2">
              Proxy prefix <code className="text-xs">{institution.proxyPrefix}</code>
            </p>
          </div>
          <label className="text-sm">
            <span className="block text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-2">
              Switch instance
            </span>
            <select
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
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

        <div className="grid sm:grid-cols-3 gap-6 mb-10">
          {[
            { label: "Licensed resources", value: licensed.length },
            { label: "Monthly queries routed", value: queries.toLocaleString() },
            { label: "Configuration issues", value: issues },
          ].map((s) => (
            <div key={s.label} className="bg-card border border-border rounded-2xl p-6">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-2">
                {s.label}
              </p>
              <p className="font-serif text-4xl">{s.value}</p>
            </div>
          ))}
        </div>

        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-border">
            <h2 className="font-serif text-2xl">Resource directory</h2>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">
              Only active and trial resources are visible to students
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-secondary border-b border-border">
                  {["Resource", "Type", "Status", "Auth method", "Monthly queries"].map((h) => (
                    <th
                      key={h}
                      className="py-4 px-6 text-[11px] font-bold uppercase tracking-wider text-muted-foreground"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="text-sm divide-y divide-border">
                {institution.resources.map((r) => (
                  <tr key={r.id} className="hover:bg-secondary/60">
                    <td className="py-4 px-6">
                      <div className="font-medium">{r.name}</div>
                      <div className="text-xs text-muted-foreground">{r.provider}</div>
                    </td>
                    <td className="py-4 px-6 text-muted-foreground capitalize">{r.kind}</td>
                    <td className="py-4 px-6">
                      <span className="flex items-center gap-2 text-xs font-medium">
                        <span className={`size-1.5 rounded-full ${statusDot[r.status]}`} />
                        {statusLabel[r.status]}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-muted-foreground">{r.auth}</td>
                    <td className="py-4 px-6 tabular-nums">{r.monthlyQueries.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-10 bg-primary text-primary-foreground rounded-2xl p-8">
          <h2 className="font-serif text-2xl mb-3">Embed Larry on your library site</h2>
          <p className="text-primary-foreground/60 text-sm mb-4">
            Drop this snippet into your library template. The instance key scopes Larry to this
            institution's configured resources only.
          </p>
          <pre className="bg-sidebar-accent border border-sidebar-border rounded-lg p-4 text-xs overflow-x-auto">
            {`<script src="https://cdn.larry.ai/widget.js" data-instance="${institution.slug}" defer></script>`}
          </pre>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
