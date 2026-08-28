import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { SiteFooter, SiteNav } from "@/components/SiteNav";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Set a New Password — Larry for Libraries" },
      {
        name: "description",
        content: "Choose a new password for your Larry student account.",
      },
      { property: "og:title", content: "Set a New Password — Larry for Libraries" },
      {
        property: "og:description",
        content: "Complete your Larry student account password reset.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("Those passwords don't match.");
      return;
    }
    setBusy(true);
    const { error: err } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    setDone(true);
    setTimeout(() => navigate({ to: "/profile", replace: true }), 1200);
  };

  const field =
    "w-full bg-card border border-input rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40";
  const label =
    "block text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-2 mt-5 first:mt-0";

  return (
    <div className="min-h-screen bg-background font-sans text-foreground">
      <SiteNav />
      <main className="max-w-md mx-auto px-8 py-16">
        <h1 className="font-serif text-4xl leading-tight mb-8">Set a new password</h1>
        <form
          onSubmit={submit}
          className="bg-card rounded-2xl shadow-panel border border-border p-8"
        >
          <label className={label} htmlFor="pw">
            New password
          </label>
          <input
            id="pw"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={field}
          />
          <label className={label} htmlFor="pw2">
            Confirm password
          </label>
          <input
            id="pw2"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className={field}
          />
          {error && <p className="mt-5 text-sm text-destructive">{error}</p>}
          {done && <p className="mt-5 text-sm text-accent">Password updated. Redirecting…</p>}
          <button
            type="submit"
            disabled={busy}
            className="mt-8 w-full bg-primary text-primary-foreground py-3 rounded-lg font-semibold hover:shadow-lg transition-shadow disabled:opacity-60"
          >
            {busy ? "Saving…" : "Update password"}
          </button>
          <p className="mt-4 text-xs text-muted-foreground">
            Open this page from the reset link in your email so the change can be applied.
          </p>
        </form>
      </main>
      <SiteFooter />
    </div>
  );
}
