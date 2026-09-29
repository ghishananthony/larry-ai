import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { SiteFooter, SiteNav } from "@/components/SiteNav";
import { useAuth } from "@/hooks/useAuth";
import { useInstitutionAccess } from "@/hooks/useInstitutionAccess";
import {
  useDeleteResearchChat,
  useResearchChats,
  useSaveResearchChat,
  type ResearchChatRow,
} from "@/hooks/useResearchChats";
import { larrySearch, larryTurn } from "@/lib/larry.functions";
import type { ChatMessage, ProfileKey, ResearchProfile, SearchResult } from "@/lib/larry/types";

export const Route = createFileRoute("/widget")({
  head: () => ({
    meta: [
      { title: "Student Widget — Larry for Libraries" },
      {
        name: "description",
        content:
          "Describe your research need in your own words. Larry clarifies, builds a profile you confirm, then searches your library's resources for specific sources.",
      },
      { property: "og:title", content: "Student Widget — Larry for Libraries" },
      {
        property: "og:description",
        content: "Larry searches your library's licensed and open resources for specific sources that match your confirmed requirements.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: WidgetPage,
});

type Stage = "chat" | "confirm" | "searching" | "results" | "blocked";

type Saved = { transcript?: string };

const WELCOME: ChatMessage = {
  role: "assistant",
  content:
    "Hi, I'm Larry. Tell me what you're researching and what your assignment requires — in your own words. I'll ask about anything unclear, confirm your requirements with you, then search the library for specific sources.",
};

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="block text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-2">
      {children}
    </span>
  );
}

const PROFILE_ROWS: { key: ProfileKey; label: string; value: (p: ResearchProfile) => string | null }[] = [
  { key: "topic", label: "Topic", value: (p) => p.topic },
  { key: "focus", label: "Focus", value: (p) => p.focus },
  { key: "population", label: "Population", value: (p) => p.population },
  { key: "discipline", label: "Discipline", value: (p) => p.discipline },
  { key: "relationship", label: "Relationship", value: (p) => p.relationship },
  {
    key: "sourceTypes",
    label: "Source requirement",
    value: (p) =>
      [p.sourceTypes.join(", "), p.peerReviewed ? "peer-reviewed" : ""].filter(Boolean).join(" · ") || null,
  },
  { key: "dateRequirement", label: "Date", value: (p) => p.dateRequirement },
  { key: "sourceCount", label: "Sources requested", value: (p) => (p.sourceCount ? String(p.sourceCount) : null) },
  { key: "otherConstraints", label: "Other requirements", value: (p) => p.otherConstraints.join("; ") || null },
];

function WidgetPage() {
  const { session } = useAuth();
  const access = useInstitutionAccess();
  const turnFn = useServerFn(larryTurn);
  const searchFn = useServerFn(larrySearch);

  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState<Stage>("chat");
  const [profile, setProfile] = useState<ResearchProfile | null>(null);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [token, setToken] = useState<string | null>(null);

  const [chatId, setChatId] = useState<string | null>(null);
  const [guestPromptDismissed, setGuestPromptDismissed] = useState(false);
  const chats = useResearchChats();
  const saveChat = useSaveResearchChat();
  const deleteChat = useDeleteResearchChat();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages, stage, busy]);

  const institutionName = session ? (access.data?.name ?? "your institution") : "Menlo College";

  /** Chats are only ever persisted for a signed-in student. Guests are never saved. */
  const persist = (next: { stage: Stage; msgs: ChatMessage[]; profile: ResearchProfile | null; result: SearchResult | null }) => {
    if (!session) return;
    const firstUser = next.msgs.find((m) => m.role === "user")?.content ?? "";
    saveChat.mutate(
      {
        id: chatId,
        title: firstUser.trim().slice(0, 120) || "New research chat",
        goal: firstUser,
        sourceTypes: next.profile?.sourceTypes ?? [],
        stage: next.stage,
        answers: { transcript: JSON.stringify(next.msgs) },
        profile: next.profile,
        terms: next.result,
      },
      { onSuccess: (id) => id && setChatId(id) },
    );
  };

  const send = async () => {
    const text = input.trim();
    if (!text || busy || stage === "blocked" || stage === "searching") return;
    const msgs: ChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages(msgs);
    setInput("");
    setBusy(true);
    try {
      const res = await turnFn({ data: { messages: msgs.filter((m) => m !== WELCOME), profile } });
      const withReply: ChatMessage[] = [...msgs, { role: "assistant", content: res.reply }];
      setMessages(withReply);
      if (res.kind === "blocked") {
        setStage("blocked");
        setProfile(null);
        setResult(null);
        return; // never persisted, never searched
      }
      if (res.kind === "error") return;
      const nextProfile = res.profile ?? profile;
      const nextStage: Stage = res.kind === "confirm" ? "confirm" : "chat";
      setToken(res.kind === "confirm" ? res.confirmationToken : null);
      setProfile(nextProfile);
      setStage(nextStage);
      setResult(null);
      persist({ stage: nextStage, msgs: withReply, profile: nextProfile, result: null });
    } catch {
      setMessages([...msgs, { role: "assistant", content: "Something went wrong. Please try again." }]);
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  };

  const confirmAndSearch = async () => {
    if (!profile || !token || stage !== "confirm") return;
    setStage("searching");
    try {
      const res = await searchFn({ data: { profile, confirmationToken: token } });
      if (res.kind === "blocked") {
        setMessages((m) => [...m, { role: "assistant", content: res.reply }]);
        setStage("blocked");
        setProfile(null);
        setToken(null);
        return;
      }
      if (res.kind === "error") {
        setMessages((m) => [...m, { role: "assistant", content: res.reply }]);
        setStage("confirm");
        return;
      }
      setResult(res);
      setStage("results");
      persist({ stage: "results", msgs: messages, profile, result: res });
    } catch {
      setMessages((m) => [...m, { role: "assistant", content: "The search failed. Please try again." }]);
      setStage("confirm");
    }
  };

  const newChat = () => {
    setChatId(null);
    setMessages([WELCOME]);
    setInput("");
    setStage("chat");
    setProfile(null);
    setResult(null);
    setToken(null);
    inputRef.current?.focus();
  };

  const openChat = (row: ResearchChatRow) => {
    setChatId(row.id);
    let msgs: ChatMessage[] = [WELCOME];
    try {
      const t = (row.answers as Saved)?.transcript;
      if (t) msgs = [WELCOME, ...(JSON.parse(t) as ChatMessage[]).filter((m) => m.content !== WELCOME.content)];
    } catch {
      /* legacy chat format */
      if (row.goal) msgs = [WELCOME, { role: "user", content: row.goal }];
    }
    setMessages(msgs);
    const p = (row.profile as ResearchProfile | null) ?? null;
    const r = (row.terms as SearchResult | null) ?? null;
    const validProfile = p && Array.isArray((p as ResearchProfile).studentProvided) ? p : null;
    const validResult = r && (r as SearchResult).kind === "results" ? r : null;
    // Saved chats never carry a confirmation token: a reopened profile must be re-confirmed through Larry.
    setToken(null);
    setProfile(validProfile);
    setResult(validResult);
    setStage(validResult ? "results" : "chat");
  };

  return (
    <div className="min-h-screen bg-background font-sans text-foreground">
      <SiteNav />

      <main className="max-w-7xl mx-auto px-8 py-16">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
          <div>
            <span className="inline-block px-3 py-1 bg-accent/10 text-accent text-xs font-bold tracking-widest uppercase mb-4">
              Student Interface
            </span>
            <h1 className="font-serif text-4xl leading-tight">
              You choose what to research. Larry finds where to look.
            </h1>
          </div>
          <div className="text-sm">
            <Label>Your institution</Label>
            <p className="px-3 py-2 text-sm">{institutionName}</p>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-6 items-start">
          {session && (
            <aside className="w-full lg:w-64 shrink-0 bg-card rounded-2xl border border-border shadow-panel p-5">
              <p className="text-[10px] uppercase tracking-wider font-bold mb-3">Previous chats</p>
              <button
                type="button"
                onClick={newChat}
                className="w-full bg-primary text-primary-foreground py-2 rounded-lg text-xs font-bold uppercase tracking-wider mb-4"
              >
                New research chat
              </button>
              {chats.isLoading && <p className="text-xs text-muted-foreground">Loading…</p>}
              {!chats.isLoading && (chats.data?.length ?? 0) === 0 && (
                <p className="text-xs text-muted-foreground">Your saved research chats will appear here.</p>
              )}
              <ul className="space-y-1">
                {(chats.data ?? []).map((row) => (
                  <li key={row.id} className="group flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => openChat(row)}
                      className={`flex-1 text-left px-3 py-2 rounded-lg text-xs truncate hover:bg-secondary ${
                        chatId === row.id ? "bg-secondary font-semibold" : "text-muted-foreground"
                      }`}
                      title={row.title}
                    >
                      {row.title}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        deleteChat.mutate(row.id);
                        if (chatId === row.id) newChat();
                      }}
                      aria-label={`Delete ${row.title}`}
                      className="opacity-0 group-hover:opacity-100 px-2 text-xs text-muted-foreground hover:text-foreground"
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            </aside>
          )}

          <div className="flex-1 min-w-0 bg-card rounded-2xl shadow-panel border border-border overflow-hidden">
            <div className="flex items-center justify-between px-8 py-4 border-b border-border">
              <h2 className="font-serif text-2xl italic text-accent">Larry · research assistant</h2>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">
                Your scope, your choices
              </span>
            </div>

            <div className="px-8 py-6 space-y-4 max-h-[60vh] overflow-y-auto">
              {messages.map((m, i) => (
                <div key={i} className={m.role === "user" ? "flex justify-end" : "flex"}>
                  <div
                    className={
                      m.role === "user"
                        ? "max-w-[80%] bg-primary text-primary-foreground rounded-2xl rounded-br-sm px-4 py-2.5 text-sm whitespace-pre-wrap"
                        : "max-w-[85%] text-sm whitespace-pre-wrap leading-relaxed"
                    }
                  >
                    {m.content}
                  </div>
                </div>
              ))}
              {busy && <p className="text-sm text-muted-foreground italic">Larry is reading your request…</p>}

              {profile && !result && (stage === "confirm" || stage === "searching") && (
                <ProfileCard profile={profile} searching={stage === "searching"} onConfirm={confirmAndSearch} />
              )}

              {stage === "searching" && (
                <p className="text-sm text-muted-foreground italic">
                  Searching {institutionName}'s resources and checking results against your requirements…
                </p>
              )}

              {stage === "results" && result?.kind === "results" && <Results result={result} />}

              <div ref={endRef} />
            </div>

            <div className="border-t border-border p-4 bg-background">
              {stage === "blocked" ? (
                <button
                  type="button"
                  onClick={newChat}
                  className="w-full bg-primary text-primary-foreground py-3 rounded-lg text-sm font-semibold"
                >
                  Start a new request
                </button>
              ) : (
                <div className="flex gap-2 items-end">
                  <textarea
                    ref={inputRef}
                    autoFocus
                    rows={2}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        void send();
                      }
                    }}
                    placeholder={
                      stage === "confirm"
                        ? "Confirm above, or type a correction…"
                        : stage === "results"
                          ? "Want to change a requirement? Tell Larry…"
                          : "Describe your research need in your own words…"
                    }
                    className="flex-1 bg-card border border-input rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40 resize-none"
                  />
                  <button
                    type="button"
                    onClick={() => void send()}
                    disabled={!input.trim() || busy || stage === "searching"}
                    className="bg-primary text-primary-foreground px-5 py-3 rounded-lg text-sm font-semibold disabled:opacity-40"
                  >
                    Send
                  </button>
                </div>
              )}
              <p className="mt-2 text-[11px] text-muted-foreground">
                Larry does not write papers, suggest topics, or summarize sources. Larry will not change
                your scope unless you choose to.
              </p>
            </div>
          </div>
        </div>
      </main>

      {!session && !guestPromptDismissed && (
        <div className="fixed bottom-6 right-6 z-40 w-[min(22rem,calc(100vw-3rem))] bg-card border border-border rounded-2xl shadow-panel p-5">
          <div className="flex items-start justify-between gap-2">
            <p className="text-[10px] uppercase tracking-wider font-bold mb-2">Save your research</p>
            <button
              type="button"
              onClick={() => setGuestPromptDismissed(true)}
              aria-label="Dismiss"
              className="-mt-1 -mr-1 p-1 rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-sm text-muted-foreground">
            Create a free student account to save your research chats. Larry works the same either way —
            guest sessions simply aren't saved.
          </p>
          <div className="flex gap-2 mt-4">
            <Link
              to="/auth"
              className="flex-1 text-center bg-primary text-primary-foreground px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wider"
            >
              Create an account
            </Link>
            <button
              type="button"
              onClick={() => setGuestPromptDismissed(true)}
              className="flex-1 border border-input px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wider text-muted-foreground hover:bg-secondary"
            >
              Continue as guest
            </button>
          </div>
        </div>
      )}

      <SiteFooter />
    </div>
  );
}

function ProfileCard({
  profile,
  searching,
  onConfirm,
}: {
  profile: ResearchProfile;
  searching: boolean;
  onConfirm: () => void;
}) {
  const rows = PROFILE_ROWS.map((r) => ({ ...r, v: r.value(profile) })).filter((r) => r.v);
  return (
    <div className="border border-border rounded-xl overflow-hidden bg-background">
      <div className="px-5 py-3 bg-secondary/50 border-b border-border flex justify-between gap-3">
        <p className="text-[10px] uppercase tracking-wider font-bold">Your research profile</p>
        <p className="text-[10px] text-muted-foreground">
          <span className="font-bold text-foreground">You</span> = you said it ·{" "}
          <span className="font-bold text-accent">Organized</span> = Larry's reading of your words
        </p>
      </div>
      <dl className="divide-y divide-border text-sm">
        {rows.map((r) => {
          const mine = profile.studentProvided.includes(r.key);
          return (
            <div key={r.key} className="px-5 py-2.5 grid sm:grid-cols-4 gap-2 items-baseline">
              <dt className="text-xs text-muted-foreground uppercase tracking-wider font-bold">{r.label}</dt>
              <dd className="sm:col-span-3 flex justify-between gap-3">
                <span>{r.v}</span>
                <span className={`text-[10px] uppercase font-bold ${mine ? "text-foreground" : "text-accent"}`}>
                  {mine ? "You" : "Organized"}
                </span>
              </dd>
            </div>
          );
        })}
        {profile.searchVocabulary.length > 0 && (
          <div className="px-5 py-2.5 grid sm:grid-cols-4 gap-2">
            <dt className="text-xs text-muted-foreground uppercase tracking-wider font-bold">Search vocabulary</dt>
            <dd className="sm:col-span-3 text-xs text-muted-foreground">
              {profile.searchVocabulary.join(", ")} — related terms Larry will use to search your own concepts.
            </dd>
          </div>
        )}
      </dl>
      <div className="px-5 py-4 border-t border-border flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onConfirm}
          disabled={searching}
          className="bg-primary text-primary-foreground px-5 py-2.5 rounded-lg text-sm font-semibold disabled:opacity-40"
        >
          {searching ? "Searching…" : "Confirm & search"}
        </button>
        <span className="text-xs text-muted-foreground">Something wrong? Type a correction below.</span>
      </div>
    </div>
  );
}

function Results({ result }: { result: Extract<SearchResult, { kind: "results" }> }) {
  return (
    <div className="space-y-5">
      {result.narrowNotice && (
        <p className="text-sm border border-accent/40 bg-accent/5 rounded-xl p-4">{result.narrowNotice}</p>
      )}

      {result.sources.length > 0 && (
        <div>
          <Label>Sources found ({result.sources.length})</Label>
          <ol className="space-y-3">
            {result.sources.map((s, i) => (
              <li key={s.id} className="border border-border rounded-xl p-4 bg-background">
                <div className="flex justify-between gap-3">
                  <p className="font-semibold text-sm">
                    {i + 1}. {s.title}
                  </p>
                  <span
                    className={`shrink-0 text-[10px] uppercase font-bold ${s.match === "strong" ? "text-accent" : "text-muted-foreground"}`}
                  >
                    {s.match === "strong" ? "Strong match" : "Partial match"}
                  </span>
                </div>
                {s.authors.length > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">{s.authors.join(", ")}</p>
                )}
                <p className="text-xs mt-1">
                  {[s.container, s.year, s.sourceType].filter(Boolean).join(" · ")}
                </p>
                <p className="text-xs mt-1 text-muted-foreground">
                  Peer review: {s.peerReviewed ? "flagged peer-reviewed by provider" : "not verified"} · Found in{" "}
                  <span className="text-foreground">{s.foundIn}</span>
                  {s.via && <> (via {s.via})</>}
                  {s.publisher && <> · {s.publisher}</>}
                  {s.doi && <> · DOI {s.doi}</>}
                </p>
                {s.matchNote && <p className="text-xs mt-2 italic">Why it's listed: {s.matchNote}</p>}
                <a
                  href={s.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-block mt-3 text-xs font-bold uppercase tracking-wider text-accent hover:underline"
                >
                  Open source →
                </a>
              </li>
            ))}
          </ol>
        </div>
      )}

      {result.runs.length > 0 && (
        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer">Where Larry searched</summary>
          <ul className="mt-2 space-y-1">
            {result.runs.map((r) => (
              <li key={r.resource}>
                <span className="text-foreground">{r.resource}</span> — {r.status === "error" ? `unavailable (${r.message})` : `${r.count} records`} · query: <code>{r.query}</code>
              </li>
            ))}
          </ul>
        </details>
      )}

      {result.notYetSearchable.length > 0 && (
        <div className="text-xs text-muted-foreground border-t border-border pt-4">
          <Label>Also licensed by your library — Larry can't search these automatically yet</Label>
          <p>{result.notYetSearchable.join(" · ")}</p>
        </div>
      )}

      <p className="text-xs text-muted-foreground border-t border-border pt-4">
        Larry does not read, summarize, or evaluate sources. Reading, judging, and selecting them is your work.
      </p>
    </div>
  );
}
