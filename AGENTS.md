<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Larry research flow lives in src/lib/larry/ (safety → understand → orchestrate → provider adapters) behind src/lib/larry.functions.ts; the old keyword engine was removed. Why: one workflow, LLM + real provider searches server-side.
- Search adapters are keyed by exact resource name and only run when the caller's institution (resolved server-side, never from the client) lists that resource as active/trial. Why: the institution's configuration is authoritative for access.
- Larry search requires a server-signed confirmation token (src/lib/larry/confirm.server.ts) issued only when a profile is presented for confirmation. Why: direct API calls cannot skip confirmation or search a tampered profile.
- Publisher platforms without a public search API are searched via Crossref metadata filtered to that publisher's member id. Why: real registered records, no scraping.
- Dev/test-only search providers (e.g. OpenAlex) live in src/lib/larry/dev-providers.server.ts, enabled only by server secret LARRY_DEV_PROVIDERS on preview/localhost hosts and never as institution resources. Why: test real searches without touching licensed-resource authorization.
