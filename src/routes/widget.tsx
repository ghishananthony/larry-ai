import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
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
import { getInstitution, institutions } from "@/lib/institutions";
import {
  analyzeRequest,
  buildClarifications,
  buildProfile,
  executeSearch,
  generateSearchTerms,
  selectResources,
  type ClarificationQuestion,
  type ResearchProfile,
  type ResourceChoice,
  type SearchExecution,
  type SearchTerms,
} from "@/lib/research-workflow";

export const Route = createFileRoute("/widget")({
  head: () => ({
    meta: [
      { title: "Student Widget — Larry for Libraries" },
      {
        name: "description",
        content:
          "Enter your own research goal. Larry clarifies, builds a research profile you confirm, then generates structured search terms for the databases your institution licenses.",
      },
      { property: "og:title", content: "Student Widget — Larry for Libraries" },
      {
        property: "og:description",
        content:
          "Larry matches a student's confirmed research requirements to their library's licensed databases and catalog.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: WidgetPage,
});

const SOURCE_TYPES = [
  "Peer-reviewed articles",
  "Books & e-books",
  "Dissertations",
  "Primary sources",
];

type Stage = "request" | "clarify" | "profile" | "search";

const STAGES: { id: Stage; label: string }[] = [
  { id: "request", label: "1. Your request" },
  { id: "clarify", label: "2. Clarification" },
  { id: "profile", label: "3. Confirm profile" },
  { id: "search", label: "4. Search" },
];

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="block text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-2">
      {children}
    </span>
  );
}

function WidgetPage() {
  const { session } = useAuth();
  const access = useInstitutionAccess();
  const [slug, setSlug] = useState(institutions[0]!.slug);
  const [goal, setGoal] = useState("");
  const [types, setTypes] = useState<string[]>(["Peer-reviewed articles"]);

  const [stage, setStage] = useState<Stage>("request");
  const [questions, setQuestions] = useState<ClarificationQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [profile, setProfile] = useState<ResearchProfile | null>(null);
  const [terms, setTerms] = useState<SearchTerms | null>(null);
  const [choices, setChoices] = useState<ResourceChoice[]>([]);
  const [execution, setExecution] = useState<SearchExecution | null>(null);
  const [broadenAcknowledged, setBroadenAcknowledged] = useState(false);

  const [chatId, setChatId] = useState<string | null>(null);
  const [guestPromptDismissed, setGuestPromptDismissed] = useState(false);
  const chats = useResearchChats();
  const saveChat = useSaveResearchChat();
  const deleteChat = useDeleteResearchChat();

  /** Chats are only ever persisted for a signed-in student. Guests are never saved. */
  const persist = (next: {
    stage: Stage;
    profile: ResearchProfile | null;
    terms: SearchTerms | null;
    answers: Record<string, string>;
  }) => {
    if (!session) return;
    saveChat.mutate(
      {
        id: chatId,
        title: goal.trim().slice(0, 120) || "New research chat",
        goal,
        sourceTypes: types,
        stage: next.stage,
        answers: next.answers,
        profile: next.profile,
        terms: next.terms,
      },
      { onSuccess: (id) => id && setChatId(id) },
    );
  };


  // A signed-in student is always pinned to the institution recorded on their
  // profile in the database; the selector is only a demo affordance for visitors.
  const enrolledSlug = access.data?.slug ?? null;
  const activeSlug = session ? (enrolledSlug ?? institutions[0]!.slug) : slug;
  const institution = getInstitution(activeSlug);

  const reset = () => {
    setStage("request");
    setQuestions([]);
    setAnswers({});
    setProfile(null);
    setTerms(null);
    setChoices([]);
    setExecution(null);
    setBroadenAcknowledged(false);
  };

  const toggleType = (t: string) =>
    setTypes((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));

  const analysis = useMemo(() => (goal.trim() ? analyzeRequest(goal) : null), [goal]);

  /** Stage 2 → 3: analyze, ask only if needed. */
  const analyze = () => {
    if (!goal.trim()) return;
    const pending = buildClarifications(analyzeRequest(goal)).filter(
      (q) => !(q.id === "sourceTypes" && types.length > 0),
    );
    if (pending.length > 0) {
      setQuestions(pending);
      setStage("clarify");
      return;
    }
    makeProfile({});
  };

  /** Stage 5: build the profile from student-provided information only. */
  const makeProfile = (currentAnswers: Record<string, string>) => {
    const p = buildProfile({ goal, selectedSourceTypes: types, answers: currentAnswers });
    setProfile(p);
    setStage("profile");
    persist({ stage: "profile", profile: p, terms: null, answers: currentAnswers });
  };

  const submitAnswers = () => {
    const unanswered = questions.filter((q) => !answers[q.id]?.trim());
    if (unanswered.length > 0) return;
    makeProfile(answers);
  };

  /** Stages 6→9: only runs after explicit confirmation. */
  const confirmAndSearch = () => {
    if (!profile) return;
    const t = generateSearchTerms(profile);
    const c = selectResources(institution, profile);
    setTerms(t);
    setChoices(c);
    setExecution(c[0] ? executeSearch(institution, c[0], t) : null);
    setStage("search");
    persist({ stage: "search", profile, terms: t, answers });
  };

  /** Start a brand-new research chat (signed-in students get a new saved record). */
  const newChat = () => {
    setChatId(null);
    setGoal("");
    setTypes(["Peer-reviewed articles"]);
    reset();
  };

  /** Restore a previously saved chat. No workflow step is skipped or auto-run. */
  const openChat = (row: ResearchChatRow) => {
    setChatId(row.id);
    setGoal(row.goal);
    setTypes(row.source_types ?? []);
    setAnswers(row.answers ?? {});
    setQuestions([]);
    setChoices([]);
    setExecution(null);
    setBroadenAcknowledged(false);

    const savedProfile = (row.profile as ResearchProfile | null) ?? null;
    const savedTerms = (row.terms as SearchTerms | null) ?? null;
    setProfile(savedProfile);
    setTerms(savedTerms);

    if (row.stage === "search" && savedProfile && savedTerms) {
      const c = selectResources(getInstitution(activeSlug), savedProfile);
      setChoices(c);
      setExecution(c[0] ? executeSearch(getInstitution(activeSlug), c[0], savedTerms) : null);
      setStage("search");
    } else if (savedProfile) {
      setStage("profile");
    } else {
      setStage("request");
    }
  };

  const runWith = (choice: ResourceChoice) => {
    if (!terms) return;
    setExecution(executeSearch(institution, choice, terms));
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
            {session ? (
              <p className="px-3 py-2 text-sm">{institution.name}</p>
            ) : (
              <select
                value={slug}
                onChange={(e) => {
                  setSlug(e.target.value);
                  reset();
                }}
                className="bg-card border border-input rounded-lg px-3 py-2 text-sm"
              >
                {institutions.map((i) => (
                  <option key={i.slug} value={i.slug}>
                    {i.name}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        <ol className="flex flex-wrap gap-2 mb-6">
          {STAGES.map((s) => {
            const active = s.id === stage;
            const done = STAGES.findIndex((x) => x.id === stage) > STAGES.findIndex((x) => x.id === s.id);
            return (
              <li
                key={s.id}
                className={`px-3 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wider border ${
                  active
                    ? "bg-primary text-primary-foreground border-primary"
                    : done
                      ? "border-accent text-accent"
                      : "border-input text-muted-foreground"
                }`}
              >
                {s.label}
              </li>
            );
          })}
        </ol>

        <div className="flex flex-col lg:flex-row gap-6 items-start">
        {session && (
          <aside className="w-full lg:w-64 shrink-0 bg-card rounded-2xl border border-border shadow-panel p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] uppercase tracking-wider font-bold">Previous chats</p>
            </div>
            <button
              type="button"
              onClick={newChat}
              className="w-full bg-primary text-primary-foreground py-2 rounded-lg text-xs font-bold uppercase tracking-wider mb-4"
            >
              New research chat
            </button>
            {chats.isLoading && <p className="text-xs text-muted-foreground">Loading…</p>}
            {!chats.isLoading && (chats.data?.length ?? 0) === 0 && (
              <p className="text-xs text-muted-foreground">
                Your saved research chats will appear here.
              </p>
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

        <div className="flex-1 min-w-0 bg-card rounded-2xl shadow-panel border border-border overflow-hidden grid lg:grid-cols-12">
          {/* ---------------- Left: student input ---------------- */}
          <div className="lg:col-span-5 p-8 bg-background border-b lg:border-b-0 lg:border-r border-border">
            <Label>Your research goal, in your own words</Label>
            <textarea
              rows={5}
              value={goal}
              onChange={(e) => {
                setGoal(e.target.value);
                if (stage !== "request") reset();
              }}
              placeholder="e.g. I'm writing a psychology paper examining whether social media use is associated with lower self-esteem among teenagers."
              className="w-full bg-card border border-input rounded-lg p-4 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40 resize-none"
            />
            <p className="mt-2 text-xs text-muted-foreground">
              Larry does not write, refine, or suggest research goals. Your wording is used only to
              build a profile you confirm.
            </p>

            <div className="mt-8">
              <Label>Required source types</Label>
              <div className="flex flex-wrap gap-2">
                {SOURCE_TYPES.map((t) => {
                  const on = types.includes(t);
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => {
                        toggleType(t);
                        if (stage !== "request") reset();
                      }}
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
              onClick={analyze}
              disabled={!goal.trim() || stage !== "request"}
              className="mt-8 w-full bg-primary text-primary-foreground py-3 rounded-lg font-semibold hover:shadow-lg transition-shadow disabled:opacity-40"
            >
              Analyze my request
            </button>

            {stage !== "request" && (
              <button
                type="button"
                onClick={reset}
                className="mt-3 w-full border border-input py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider text-muted-foreground hover:bg-secondary"
              >
                Start over
              </button>
            )}

            {analysis && stage === "request" && analysis.ambiguousTerms.length > 0 && (
              <p className="mt-4 text-xs text-accent">
                Larry has spotted a broad term in your request and will ask you to specify it — it
                will not choose a focus for you.
              </p>
            )}
          </div>

          {/* ---------------- Right: workflow ---------------- */}
          <div className="lg:col-span-7 p-8">
            <div className="flex items-center justify-between pb-4 border-b border-border mb-6">
              <h2 className="font-serif text-2xl italic text-accent">
                Where to look at {institution.shortName}
              </h2>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">
                Licensed resources only
              </span>
            </div>

            {stage === "request" && (
              <p className="text-sm text-muted-foreground">
                Enter your goal and requirements. Larry will analyze the request, ask about anything
                ambiguous, and build a research profile for you to confirm before any database is
                searched.
              </p>
            )}

            {/* Stage 3 — clarification */}
            {stage === "clarify" && (
              <div className="space-y-6">
                <p className="text-sm text-muted-foreground">
                  Larry needs you to specify a few things before building your research profile.
                  Larry will not choose any of these for you.
                </p>
                {questions.map((q) => (
                  <div key={q.id} className="border border-border rounded-xl p-5 bg-background">
                    <p className="text-sm font-semibold mb-2">{q.question}</p>
                    <p className="text-xs text-muted-foreground mb-3">
                      Examples only: {q.examples.join(" · ")}
                    </p>
                    <input
                      value={answers[q.id] ?? ""}
                      onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
                      placeholder="Your answer, in your own words"
                      className="w-full bg-card border border-input rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
                    />
                    <p className="mt-2 text-[11px] text-muted-foreground">{q.helper}</p>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={submitAnswers}
                  disabled={questions.some((q) => !answers[q.id]?.trim())}
                  className="bg-primary text-primary-foreground px-5 py-2.5 rounded-lg text-sm font-semibold disabled:opacity-40"
                >
                  Build my research profile
                </button>
              </div>
            )}

            {/* Stage 5/6 — profile + confirmation */}
            {stage === "profile" && profile && (
              <div className="space-y-6">
                <div className="border border-border rounded-xl overflow-hidden">
                  <div className="px-5 py-3 bg-secondary/50 border-b border-border">
                    <p className="text-[10px] uppercase tracking-wider font-bold">
                      Research profile — student-provided information
                    </p>
                  </div>
                  <dl className="divide-y divide-border text-sm">
                    {[
                      profile.discipline,
                      profile.goal,
                      profile.topic,
                      profile.population,
                      profile.dateRange,
                      profile.sourceCount,
                    ].map((f) => (
                      <div key={f.label} className="px-5 py-3 grid sm:grid-cols-3 gap-2">
                        <dt className="text-xs text-muted-foreground uppercase tracking-wider font-bold">
                          {f.label}
                        </dt>
                        <dd
                          className={`sm:col-span-2 ${
                            f.origin === "pending" ? "text-muted-foreground italic" : ""
                          }`}
                        >
                          {f.value}
                        </dd>
                      </div>
                    ))}
                    <div className="px-5 py-3 grid sm:grid-cols-3 gap-2">
                      <dt className="text-xs text-muted-foreground uppercase tracking-wider font-bold">
                        Concepts / variables
                      </dt>
                      <dd className="sm:col-span-2">
                        {profile.concepts.length ? profile.concepts.join(", ") : "—"}
                      </dd>
                    </div>
                    <div className="px-5 py-3 grid sm:grid-cols-3 gap-2">
                      <dt className="text-xs text-muted-foreground uppercase tracking-wider font-bold">
                        Source types
                      </dt>
                      <dd className="sm:col-span-2">{profile.sourceTypes.join(", ") || "—"}</dd>
                    </div>
                  </dl>
                </div>

                <p className="text-xs text-muted-foreground">
                  Everything above came from you. Larry has not added research concepts, and will
                  not search any database until you confirm this profile.
                </p>

                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={confirmAndSearch}
                    className="bg-primary text-primary-foreground px-5 py-2.5 rounded-lg text-sm font-semibold"
                  >
                    This is correct — continue
                  </button>
                  <button
                    type="button"
                    onClick={() => setStage(questions.length ? "clarify" : "request")}
                    className="border border-input px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-secondary"
                  >
                    Correct my profile
                  </button>
                </div>
              </div>
            )}

            {/* Stages 7-10 — terms, resource, search */}
            {stage === "search" && terms && (
              <div className="space-y-6">
                <div className="border border-border rounded-xl p-5 bg-background">
                  <p className="text-[10px] uppercase tracking-wider font-bold mb-3">
                    Larry-generated search terminology
                  </p>
                  <code className="block text-xs leading-relaxed bg-secondary/50 rounded-lg p-4 break-words">
                    {terms.query || "—"}
                  </code>
                  <ul className="mt-3 text-xs text-muted-foreground space-y-1">
                    {terms.groups.map((g) => (
                      <li key={g.concept}>
                        <span className="text-accent">—</span> {g.concept}: {g.terms.join(" OR ")}
                      </li>
                    ))}
                  </ul>
                  {terms.filters.length > 0 && (
                    <p className="mt-3 text-xs text-muted-foreground">
                      Filters applied: {terms.filters.join(" · ")}
                    </p>
                  )}
                  <p className="mt-3 text-[11px] text-muted-foreground">
                    This is database vocabulary for your confirmed concepts only. Your original
                    message is never sent to the database.
                  </p>
                </div>

                {terms.narrow && !broadenAcknowledged && (
                  <div className="border border-accent/40 rounded-xl p-5">
                    <p className="text-sm">
                      These criteria are quite narrow and may return few results. Would you like to
                      broaden the search? Larry will not change your scope unless you choose to.
                    </p>
                    <div className="flex gap-3 mt-3">
                      <button
                        type="button"
                        onClick={() => setBroadenAcknowledged(true)}
                        className="border border-input px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-secondary"
                      >
                        Keep my scope
                      </button>
                      <button
                        type="button"
                        onClick={() => setStage("profile")}
                        className="border border-input px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-secondary"
                      >
                        Let me edit the profile
                      </button>
                    </div>
                  </div>
                )}

                {choices.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    No licensed resource at {institution.name} matched this profile. Contact a
                    reference librarian about interlibrary loan.
                  </p>
                )}

                {choices.map((choice, i) => {
                  const selected = execution?.resource.id === choice.resource.id;
                  return (
                    <div
                      key={choice.resource.id}
                      className={`border rounded-xl p-5 bg-background ${
                        selected ? "border-accent" : "border-border"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4 mb-1">
                        <h3 className="font-semibold">{choice.resource.name}</h3>
                        <span className="shrink-0 text-[10px] uppercase font-bold tracking-wider px-2 py-1 rounded-full bg-accent/10 text-accent">
                          {i === 0 ? "Best match" : choice.resource.kind}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mb-3">
                        {choice.resource.provider} · Access via {choice.resource.auth}
                      </p>
                      <ul className="text-sm text-muted-foreground space-y-1 mb-4">
                        {choice.reasons.map((r) => (
                          <li key={r} className="flex gap-2">
                            <span className="text-accent">—</span> {r}
                          </li>
                        ))}
                      </ul>
                      {selected ? (
                        <a
                          href={execution!.accessUrl || "#"}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex text-xs font-bold uppercase tracking-wider underline decoration-accent underline-offset-4"
                        >
                          Run this query via {institution.shortName} login ↗
                        </a>
                      ) : (
                        <button
                          type="button"
                          onClick={() => runWith(choice)}
                          className="text-xs font-bold uppercase tracking-wider text-muted-foreground underline underline-offset-4"
                        >
                          Search here instead
                        </button>
                      )}
                    </div>
                  );
                })}

                {execution && (
                  <div className="border border-border rounded-xl p-5">
                    <p className="text-[10px] uppercase tracking-wider font-bold mb-2">
                      Search handoff
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Larry submits the structured query above to{" "}
                      <span className="text-foreground">{execution.resource.name}</span> through your
                      institution's authenticated access. Result records (title, author, journal,
                      date, DOI, availability) come from the provider — Larry does not summarize,
                      explain, or evaluate them.
                    </p>
                  </div>
                )}

                <p className="text-xs text-muted-foreground border-t border-border pt-4">
                  Larry does not read, summarize, or evaluate sources. Reading, judging, and
                  selecting them is your work.
                </p>
              </div>
            )}
          </div>
        </div>
        </div>
      </main>

      {!session && !guestPromptDismissed && (
        <div className="fixed bottom-6 right-6 z-40 w-[min(22rem,calc(100vw-3rem))] bg-card border border-border rounded-2xl shadow-panel p-5">
          <p className="text-[10px] uppercase tracking-wider font-bold mb-2">Save your research</p>
          <p className="text-sm text-muted-foreground">
            Create a free student account to save your research chats. Larry works the same either
            way — guest sessions simply aren't saved.
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
