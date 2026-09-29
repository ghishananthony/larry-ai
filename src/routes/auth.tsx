import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { SiteFooter, SiteNav } from "@/components/SiteNav";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Student Sign In — Larry for Libraries" },
      {
        name: "description",
        content:
          "Create a Larry student account or sign in with your college email to reach your library's licensed resources.",
      },
      { property: "og:title", content: "Student Sign In — Larry for Libraries" },
      {
        property: "og:description",
        content: "Secure student accounts for Larry, the library research assistant.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

const INSTITUTIONS = [{ slug: "menlo-college", name: "Menlo College" }];

type Mode = "signin" | "signup" | "forgot";

function AuthPage() {
  const navigate = useNavigate();
  const { session, loading } = useAuth();

  const [mode, setMode] = useState<Mode>("signin");
  const [fullName, setFullName] = useState("");
  const [institutionSlug, setInstitutionSlug] = useState(INSTITUTIONS[0]!.slug);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && session) navigate({ to: "/profile", replace: true });
  }, [loading, session, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);

    try {
      if (mode === "signup") {
        const { error: err } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/profile`,
            // Role and institution are never accepted from the client. The
            // backend assigns the Student role and Menlo College automatically.
            data: { full_name: fullName.trim() },
          },
        });
        if (err) throw err;
        setNotice(
          "Account created. Check your college email for a verification link before signing in.",
        );
      } else if (mode === "signin") {
        const { error: err } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (err) throw err;
      } else {
        const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (err) throw err;
        setNotice("If that email has an account, a password reset link is on its way.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const field =
    "w-full bg-card border border-input rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40";
  const label =
    "block text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-2 mt-5 first:mt-0";

  return (
    <div className="min-h-screen bg-background font-sans text-foreground">
      <SiteNav />

      <main className="max-w-md mx-auto px-8 py-16">
        <span className="inline-block px-3 py-1 bg-accent/10 text-accent text-xs font-bold tracking-widest uppercase mb-4">
          Student Accounts
        </span>
        <h1 className="font-serif text-4xl leading-tight mb-2">
          {mode === "signup"
            ? "Create your student account"
            : mode === "signin"
              ? "Sign in to Larry"
              : "Reset your password"}
        </h1>
        <p className="text-sm text-muted-foreground mb-8">
          Accounts are for students. Library staff roles are assigned by your institution.
        </p>

        <form
          onSubmit={submit}
          className="bg-card rounded-2xl shadow-panel border border-border p-8"
        >
          {mode === "signup" && (
            <>
              <label className={label} htmlFor="name">
                Full name
              </label>
              <input
                id="name"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className={field}
                placeholder="Jordan Rivera"
              />

              <label className={label} htmlFor="institution">
                College / university
              </label>
              <select
                id="institution"
                value={institutionSlug}
                onChange={(e) => setInstitutionSlug(e.target.value)}
                className={field}
              >
                {INSTITUTIONS.map((i) => (
                  <option key={i.slug} value={i.slug}>
                    {i.name}
                  </option>
                ))}
              </select>
            </>
          )}

          <label className={label} htmlFor="email">
            College email
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={field}
            placeholder="you@menlo.edu"
          />

          {mode !== "forgot" && (
            <>
              <label className={label} htmlFor="password">
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                minLength={8}
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={field}
              />
            </>
          )}

          {error && <p className="mt-5 text-sm text-destructive">{error}</p>}
          {notice && <p className="mt-5 text-sm text-accent">{notice}</p>}

          <button
            type="submit"
            disabled={busy}
            className="mt-8 w-full bg-primary text-primary-foreground py-3 rounded-lg font-semibold hover:shadow-lg transition-shadow disabled:opacity-60"
          >
            {busy
              ? "Working…"
              : mode === "signup"
                ? "Create account"
                : mode === "signin"
                  ? "Sign in"
                  : "Send reset link"}
          </button>

          <div className="mt-6 flex flex-wrap gap-4 text-xs font-medium text-muted-foreground">
            {mode !== "signin" && (
              <button type="button" onClick={() => setMode("signin")} className="underline">
                Sign in
              </button>
            )}
            {mode !== "signup" && (
              <button type="button" onClick={() => setMode("signup")} className="underline">
                Create an account
              </button>
            )}
            {mode !== "forgot" && (
              <button type="button" onClick={() => setMode("forgot")} className="underline">
                Forgot password?
              </button>
            )}
          </div>
        </form>

        <p className="mt-6 text-xs text-muted-foreground">
          Prefer to look around first? Open the{" "}
          <Link to="/widget" className="underline">
            student widget
          </Link>
          .
        </p>
      </main>

      <SiteFooter />
    </div>
  );
}
