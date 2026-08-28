import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { SiteFooter, SiteNav } from "@/components/SiteNav";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "Your Student Profile — Larry for Libraries" },
      {
        name: "description",
        content: "View and update your Larry student profile, institution, and account settings.",
      },
      { property: "og:title", content: "Your Student Profile — Larry for Libraries" },
      {
        property: "og:description",
        content: "Manage your Larry student account details.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProfilePage,
});

const ROLE_LABELS: Record<string, string> = {
  student: "Student",
  college_admin: "College Admin",
  super_admin: "Super Admin",
};

function ProfilePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [fullName, setFullName] = useState("");
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const profileQuery = useQuery({
    queryKey: ["profile", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const [{ data: profile, error }, { data: roles, error: roleError }] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, full_name, email, institutions(name)")
          .eq("id", user!.id)
          .maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", user!.id),
      ]);
      if (error) throw error;
      if (roleError) throw roleError;
      return { profile, roles: roles ?? [] };
    },
  });

  useEffect(() => {
    if (profileQuery.data?.profile?.full_name) setFullName(profileQuery.data.profile.full_name);
  }, [profileQuery.data]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setStatus(null);
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: fullName.trim() })
      .eq("id", user!.id);
    setSaving(false);
    setStatus(error ? error.message : "Profile saved.");
    if (!error) queryClient.invalidateQueries({ queryKey: ["profile", user?.id] });
  };

  const signOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  const institutionName =
    (profileQuery.data?.profile?.institutions as { name?: string } | null)?.name ?? "—";
  const emailVerified = Boolean(user?.email_confirmed_at);

  const field =
    "w-full bg-card border border-input rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40";
  const label = "block text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-2";

  return (
    <div className="min-h-screen bg-background font-sans text-foreground">
      <SiteNav />
      <main className="max-w-3xl mx-auto px-8 py-16">
        <span className="inline-block px-3 py-1 bg-accent/10 text-accent text-xs font-bold tracking-widest uppercase mb-4">
          Student Profile
        </span>
        <h1 className="font-serif text-4xl leading-tight mb-8">Your account</h1>

        <div className="bg-card rounded-2xl shadow-panel border border-border p-8">
          {profileQuery.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
          {profileQuery.isError && (
            <p className="text-sm text-destructive">Couldn't load your profile.</p>
          )}

          {profileQuery.data && (
            <form onSubmit={save}>
              <label className={label} htmlFor="fullName">
                Full name
              </label>
              <input
                id="fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className={field}
              />

              <div className="grid sm:grid-cols-2 gap-6 mt-6">
                <div>
                  <span className={label}>College email</span>
                  <p className="text-sm">{user?.email}</p>
                  <p
                    className={`mt-1 text-xs font-bold uppercase tracking-wider ${
                      emailVerified ? "text-accent" : "text-muted-foreground"
                    }`}
                  >
                    {emailVerified ? "Email verified" : "Email not verified yet"}
                  </p>
                </div>
                <div>
                  <span className={label}>Institution</span>
                  <p className="text-sm">{institutionName}</p>
                </div>
                <div>
                  <span className={label}>Role</span>
                  <div className="flex flex-wrap gap-2">
                    {profileQuery.data.roles.map((r) => (
                      <span
                        key={r.role}
                        className="text-[10px] uppercase font-bold tracking-wider px-2 py-1 rounded-full bg-accent/10 text-accent"
                      >
                        {ROLE_LABELS[r.role] ?? r.role}
                      </span>
                    ))}
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Roles are assigned by Larry, not chosen by students.
                  </p>
                </div>
              </div>

              {status && <p className="mt-6 text-sm text-accent">{status}</p>}

              <div className="mt-8 flex flex-wrap gap-3">
                <button
                  type="submit"
                  disabled={saving}
                  className="bg-primary text-primary-foreground px-5 py-2.5 rounded-lg font-semibold hover:shadow-lg transition-shadow disabled:opacity-60"
                >
                  {saving ? "Saving…" : "Save changes"}
                </button>
                <button
                  type="button"
                  onClick={signOut}
                  className="border border-input px-5 py-2.5 rounded-lg font-semibold hover:bg-secondary transition-colors"
                >
                  Sign out
                </button>
              </div>
            </form>
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
