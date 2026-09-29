# Fix Larry's source ranking (strongest N, not first N)

## What changes for students
When more sources qualify than the student asked for, Larry will show the ones that fit their confirmed requirements most closely, instead of whichever came first in database order. Everything else stays the same: the same databases are searched, with the same requirements, date rules and number of sources.

## Files that change
- `src/lib/larry/orchestrate.server.ts` — only the rating step and the final sort.

Nothing else changes: the search connections, search planning, safety, confirmation, profile, test-provider switch and screens all stay as they are. No database or schema changes, no migrations, and the 72 Menlo resources are not touched.

## How ranking will work
1. **Unchanged:** searches, duplicate removal (DOI, then title + year + first author), and the date filter.
2. **One rating call, as now.** It still labels each record strong, partial or weak (same rules, same "never broaden" wording). It now also gives each strong or partial record a **fit score from 0 to 100** for how closely its metadata matches the confirmed requirements:
   - every core concept is present (not a broader or different one)
   - the stated population is matched exactly
   - the stated relationship between concepts is reflected
   - the source type matches what was requested
   - the year is within the requested range (already guaranteed by the filter; this only matters when no range was given)
   - verified peer review (see below)
3. **Weak records are still dropped.** A score can never promote a weak record.
4. **Final sort:** strong before partial, then higher fit score first, then the tie rule below. Then take the requested N, exactly as now.
5. The "fewer than requested" message is unchanged.

## What the rating step receives
One entry per record, using only metadata the database returned:
- `ref`: a neutral label (r1, r2, …) in place of the current id. Current ids reveal the database (`pubmed:…`, `eric:…`).
- `title`, `venue` (journal), `year`, `type` (the database's own label)
- `peerReview`: `"verified"` when the database flags it (e.g. ERIC's peer-reviewed flag); otherwise `"not reported"`

It does not receive the database name, the publisher's platform, the link, the access note or any other source of database identity.

Records are sent in a neutral order: sorted by a hash of the normalized title. That removes any first-in-list advantage and keeps the order the same on every run.

## Peer review rules (added to the rating instructions)
- "verified" may raise the fit score slightly.
- "not reported" means **unknown**. It must not be treated as "not peer-reviewed" and must not lower the score.
- Peer review can never outweigh a concept, population or relationship mismatch.

## Ties
If two sources have the same rating and the same fit score:
1. Prefer verified peer review, but only when the student asked for peer-reviewed sources (they did ask for it; a "not reported" source simply loses the tie).
2. If still tied, order by the same title hash. This is provider-neutral, and the same results always come out in the same order.

If the rating step leaves out a score, the record gets a middle score of 50. It is never dropped for that reason and never ranked above records that were scored.

## Keeping ranking database-neutral
- The rating step never sees the database name or database-revealing ids.
- Input order is based on the title hash, not database order.
- The code gives no bonus or penalty for any database.
- Duplicate removal still keeps the first copy of a duplicate. Because all copies have the same title and DOI, this doesn't change which paper is chosen, only which database it is labelled as found in.

## Verification after building
- Re-run the social media / self-esteem / teenagers test (live, and outside the app with every rating printed).
- Confirm the 5 shown are the top 5 by rating and fit score, and that the OpenAlex strong matches compete on equal terms.
- Confirm the count of 5, the date filter, duplicate removal and the "fewer than requested" message all still work (re-run the narrow figure-skater request).
- Confirm the confirmation bypass is still refused.
- Typecheck and build.

## Technical details
- Change the `RANK_SYSTEM` output shape to `{"ratings":[{"id":"r1","match":"…","score":0-100,"note":"…"}]}`.
- Map `r<n>` back to the pool records server-side.
- Sort key: tier, then `score` desc, then (verified peer review, only if `profile.peerReviewed`), then `hash(norm(title))`.
- Clamp the score to 0–100 and treat a non-number as 50.
- Estimated size: about 30–40 changed lines in one file. Same number of AI calls; slightly longer rating output.
