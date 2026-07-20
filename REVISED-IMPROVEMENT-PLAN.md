# SignalLayer — Revised Improvement Plan (Code + Architecture Review)

**Date:** 20 July 2026
**Based on:** a full read of every source file in this repository, plus a detailed review of `SignalLayerImprovementPlan.docx` (the 22-change UX plan), `LINKEDIN-AUTOMATION-PLAN.md` (the product/MVP plan) and `PRODUCT-BRIEF.md`.
**Written in plain language on purpose.** Every technical decision is explained in terms of what it means for users and for the business.

---

## 1. The one-paragraph summary

The app today is a **beautiful, working demo** — but it is built like a demo, not like a product. The existing 22-change plan is good and almost all of it should be kept, but it deliberately says "no changes to the technology" — and that is the one place it is wrong. Four foundation problems (how data is stored, who a "workspace" belongs to, how scheduled publishing runs, and the fact that the server blindly trusts whatever the browser sends) will break the product the moment it has more than a handful of real users. The revised plan keeps the UX fixes, but adds a **Foundations track** that must run first or alongside them, because several of the 22 fixes become easier — or unnecessary — once the foundations are right.

Also important: **the 22-change plan was written against a newer version of the app than the code in this repository.** About a third of its items reference screens that do not exist here (a sign-in gate, a profile window, a "Suggest themes" button, a Create page with AI generation, browser pop-up alerts). Before executing anything, confirm which codebase is the real one going forward. This document reviews the code that is actually in this repo.

---

## 2. What the code actually is today (a guided tour)

The whole product is about **1,850 lines of code**. That is not a criticism — it is a well-chosen skeleton — but it helps to be honest about what each part really does:

| Part | File(s) | What it really does today |
|---|---|---|
| The whole UI | `app/signal-layer-app.tsx` (394 lines) | All 8 screens (Overview, Strategy, Content, Calendar, Performance, Contacts, Knowledge, Settings) in one file, written as very dense one-line components. |
| Demo data | `app/data.ts` | A fictional company ("Northstar Labs") with fake posts, fake metrics, fake contacts. **Every new workspace starts as a copy of this fake company.** |
| Storage | `lib/workspace.ts` | The entire workspace — brief, themes, ideas, posts, contacts, sources — is saved as **one big JSON text blob in a single database row**. Every change rewrites the whole blob. |
| Who owns the data | `lib/workspace.ts` | The workspace ID is simply the user's email from the hosting platform's sign-in header. Anyone **not** signed in shares one global workspace called `demo-workspace`. |
| The API | `app/api/workspace/route.ts` | One endpoint with a switch over ~17 action names. It applies whatever the browser sends **without checking it**. There is even a `replace` action that lets the browser overwrite the entire workspace with arbitrary data. |
| AI generation | `app/api/agents/generate/route.ts` | One OpenAI call that generates 4 ideas from the brief, with a canned fallback when there is no API key. The AI's JSON answer is parsed and trusted without validation. |
| Knowledge uploads | `app/api/uploads/route.ts` | Files are stored in R2 and listed as "Indexed" — but **nothing ever reads them again. The AI never sees them.** The "knowledge" feature is currently storage-only. |
| LinkedIn connect | `app/api/integrations/linkedin/*` | A genuinely solid OAuth flow: state parameter, encrypted tokens (AES-GCM), scoped config checks. The best-engineered part of the codebase. |
| Publishing | `lib/linkedin.ts`, `.../publish/route.ts` | Real text-only publishing via the official Posts API. Image/document posts are rejected at the last step. |
| Scheduled publishing | `app/api/jobs/publish/route.ts` | A cron-triggered job that loops over **every workspace in the database, one by one**, and publishes due posts. Dates are stored as display text ("Mon · 9:10 AM"), which `Date.parse` cannot read — so **nothing is ever due, and auto-publishing has never worked**. |
| Analytics sync | `.../sync/route.ts` | Real company-post statistics + comment ingestion with a keyword-based intent classifier. Sequential calls, no rate-limit budget, no pagination. |
| Tests | `tests/rendered-html.test.mjs` | One test that checks the built HTML contains certain strings. No logic is tested. |

### What is genuinely good and should be protected

- The **product thinking encoded in the UI** — approval gates, "why this post" cards, idea-before-production, evidence-first framing. This is the moat described in the product brief and it is already visible in the app.
- The **OAuth + token encryption** work.
- The **compliance posture** (official API only, no scraping, human approval mandatory) is consistently respected in code, not just in copy.
- The honest "Built-in fallback" mode when no OpenAI key exists.

---

## 3. Review of the existing 22-change plan

### Verdict in one line

The plan is **right about the symptoms, right about the priorities (broken → honesty → dead ends → polish), but wrong to freeze the architecture**, and it targets a different snapshot of the code.

### 3.1 Confirmed against this code (keep as-is)

| Plan item | Confirmed in this repo? | Note |
|---|---|---|
| 1. Scheduling never publishes (date format) | **Yes — confirmed and worse.** `scheduledFor` holds strings like "Mon · 9:10 AM"; `isDue()` parses them to NaN; nothing ever publishes automatically. The same field is also overwritten with an ISO date after publishing, so one field holds two different formats. | Keep, but fix as part of Foundation F1 (real data model), not as a patch on the blob. |
| 2. Sign-in failure codes never shown | **Half-confirmed.** The API routes really do redirect with 6 different `?integration=` codes — and the UI never reads any of them. (The sign-in *gate* the plan describes doesn't exist in this repo.) | Keep. Small and high-value. |
| 5. Dead buttons | **Confirmed.** In this repo: notification bell (hardcoded "2"), sidebar badges (hardcoded "2"), "···" menu, "＋ Add idea" calendar slots, "Use recommendation", "Last 30 days" — all dead. | Keep. |
| 7. Fake numbers everywhere | **Confirmed.** Growth arrows (↑ 24.8%), the entire impressions chart, "2.1× more saves", publishing rhythm "2 / 3", calendar dates hardcoded "16 JUL"/"18 JUL", the weekly review "win", the default user name "Aditi Gupta". | Keep — and extend (see 3.3): the *seed data itself* is the root cause. |
| 8. QA checklist is fake | **Confirmed.** `qa: { voice: true, claims: true, duplication: true, links: true }` is hardcoded at creation in three different places. No check ever runs. | Keep. |
| 9. "Revision requested" is a dead end | **Confirmed.** The status is set and nothing can ever leave it. | Keep. |
| 10. Image/document posts can't publish | **Confirmed.** `publishLinkedInPost` throws for any non-Text format — after the user has done all the work. | Keep, including the "mark as coming soon first" quick win. |
| 11. Reject deletes instantly | **Confirmed.** `rejectPost` filters the post out of existence, client and server. | Keep. |
| 12. Version history saved but never shown | **Confirmed.** Versions are carefully written on every edit and no screen reads them. | Keep. |
| 13. Knowledge files can't be deleted | **Confirmed.** Upload only; no delete route exists. | Keep. |
| 14. Organization URN typed by hand | **Confirmed.** Settings has a raw text box expecting `urn:li:organization:123456`. | Keep. |
| 15. Wrong sub-tab after creating a post | **Confirmed.** `createPost` jumps to Content, which defaults to the "Ideas" sub-tab; the new draft is under "Drafts". | Keep. |
| 16. No progress while AI works | **Partially.** "Generate ideas" has a working state; "Approve & produce" and other actions have none. | Keep. |
| 18. No activity log / notifications | **Confirmed.** Only a 2.6-second toast. The background job's results (published/held/failed counts) are returned to the cron caller and shown to no human. | Keep — and it becomes the seed of the "decision ledger" the product brief promises. |
| 19. Status doesn't refresh after connect | **Confirmed.** Nothing re-fetches integration status after the OAuth redirect returns. | Keep. |
| 20. Calendar: weekdays only, hardcoded | **Confirmed and worse.** The calendar shows a hardcoded week "MON 14 – FRI 18" and just places the first five scheduled posts into the five slots **by list position, not by date**. | Keep. |
| 22. Strategy approvable with zero themes | **Confirmed.** No guard anywhere. | Keep. |

### 3.2 Items that don't match this repo (re-verify before doing)

These reference screens/features that exist only in the newer snapshot the plan was written from:

- **3 (demo-mode entry / sign-in wall)** — there is no sign-in wall in this repo; the app loads straight into the demo workspace.
- **4 (trapped onboarding wizard)** — the trap condition (`open={onboarding || !onboardingComplete}` where closing doesn't stick) exists in code, but the seed data ships with `onboardingComplete: true`, so in practice a fresh demo user is never trapped *in this repo*.
- **6 (garbage text from PDF/Word)** — in this repo the situation is *different but worse*: uploaded files are never read at all. There is nothing to extract garbage *from* — the AI simply never sees any uploaded knowledge.
- **7 g–k (profile window, "Amazon" text, fallback AWS post)** — those screens don't exist here.
- **17 (browser pop-up alerts)** — there are no `alert()` calls in this repo.
- **21 ("Suggest themes" destroys selections)** — no such button exists here.

**Action:** reconcile the two codebases first (this repo is even named `LinkedinAutomation_old`). Executing a 5-week plan against the wrong snapshot would waste most of it.

### 3.3 What the plan misses entirely (the reason for this revision)

The plan's closing section says: *"The technology used (the framework, the database, the hosting). No rewrites."* Keeping the framework and hosting is right. But four things it calls "technology" are actually **product problems wearing a technical costume**:

1. **Everything is one JSON blob.** Two consequences users will feel: (a) *lost work* — if the same workspace is open in two tabs (or a teammate opens it, or the background job runs while you edit), the last writer silently erases the other's changes, because every action rewrites the entire workspace; (b) *it cannot grow* — with hundreds of posts and contacts, every click re-uploads the whole history, and questions like "show me last month's posts" require loading everything.
2. **The server trusts the browser.** Any user can send `{"action":"replace", ...}` and write literally anything into their workspace — including posts pre-marked "Published" with invented metrics, or QA checks pre-marked as passed. In a product whose entire pitch is *trustworthy evidence*, the data layer must be the thing that guarantees the evidence is real.
3. **Tenancy is an accident.** A workspace is "whatever email the hosting header says", and every anonymous visitor shares one global `demo-workspace` — strangers literally editing each other's demo. There is no concept of accounts, teams, or a workspace existing independently of one email string.
4. **The scheduler cannot scale and can double-post.** One cron request loops through *every workspace on the platform* sequentially — fine for 5 tenants, dead at 500 (the request will exceed time limits). Worse: results are saved only after a workspace's whole loop finishes, so a crash mid-loop republishes already-published posts on the next run. Double-posting on a founder's personal LinkedIn is the kind of failure that loses a customer permanently.

And three more gaps, smaller but real:

5. **New workspaces are born fake.** Every fresh workspace is a copy of "Northstar Labs" with fake published posts and fake contacts. Change 7 removes fake *rendering*; this removes fake *data at the source*. A new user must start empty, with a guided setup — and demo mode must be an explicitly labeled sandbox.
6. **Tokens expire with no way back.** LinkedIn access tokens last ~60 days. The refresh token is stored (encrypted, nicely) and **never used**. There is no refresh flow, no expiry warning, no "reconnect" prompt — every customer will silently break within two months.
7. **AI output is trusted blindly and never accounted for.** The model's JSON is parsed and inserted without checking its shape (a malformed answer becomes corrupt workspace data), and there is no record of which model/prompt produced what at what cost — which the product brief's "decision ledger" and unit-economics guardrail both require.

---

## 4. The revised plan

Two tracks. **Track F (Foundations)** makes the product able to scale; **Track U (User experience)** is the original 22-change plan, trimmed and re-sequenced. They interleave — foundations are not "infrastructure someone does later", they are what makes half the UX fixes stick.

### Track F — Foundations (new)

**F1. Real data model instead of one blob.** *(Large — the single most important change)*
Split the workspace blob into proper tables: `workspaces`, `posts`, `ideas`, `themes`, `contacts`, `knowledge_sources`, `brief_versions`, `activity_events`. Drizzle is already installed and configured — it is simply unused. Each user action updates only its own row.
*What users feel:* edits stop overwriting each other; the app stays fast at 1,000 posts; history and filtering become possible.
*Includes plan-Change 1:* dates become real UTC timestamps (`scheduled_at`), display text is generated at render time in the workspace's timezone, and the calendar matches posts to days by date instead of list position. A one-time migration converts existing blobs.

**F2. The server decides, the browser asks.** *(Medium)*
Replace "browser sends the new state, server saves it" with "browser sends an intent, server computes the result": validate every request body against a schema (zod), delete the `replace` and raw `createPost`/`addIdea` passthroughs, and make status transitions server-owned (a post can only become "Published" by the publish code path; QA flags can only be set by the QA code path).
*What users feel:* nothing — which is the point. What the *business* gets: numbers on screen that can actually be trusted, and no route for corrupt or forged data.

**F3. Real tenancy and an honest demo.** *(Medium)*
Give workspaces their own IDs with a membership table (`users` ↔ `workspaces`), keyed to the authenticated identity rather than a raw email string. Kill the shared anonymous `demo-workspace`: anonymous visitors get an ephemeral, clearly-labeled sandbox each. New signed-in users get an **empty** workspace and a guided first-run (this absorbs plan-Changes 3 and 4: demo mode becomes a real entrance, and onboarding becomes skippable because an empty workspace has honest empty states instead of fake data).

**F4. A scheduler that scales and never double-posts.** *(Medium)*
Replace "one cron loops over everyone" with per-workspace fan-out (Cloudflare Queues, or Durable Object alarms per workspace — both native to the current hosting): the cron tick only *enqueues* work; a consumer processes one workspace per message. Save each post's new status **immediately** after its publish succeeds, and add an idempotency guard (a `publishing` state + publish attempt record) so a retry can never post twice. Every attempt writes an `activity_events` row — which is exactly what plan-Change 18's activity log reads.

**F5. Token lifecycle.** *(Small–Medium)*
Use the stored refresh token before expiry; surface "connection expires in N days" in Settings; on failure, write an activity event and mark affected scheduled posts "Held — reconnect LinkedIn" instead of failing silently. (Extends plan-Change 19.)

**F6. Make knowledge real.** *(Large — this repo's version of plan-Change 6)*
Uploads must actually feed the AI: extract text at upload time (PDF/DOCX; honest "we can't read this yet" for others), store extracted text chunks per source, show the preview so users see exactly what the AI will read, and include relevant chunks in the generation prompt with source attribution. Add delete (plan-Change 13). Until extraction ships, label sources honestly ("stored, not yet readable by the AI") instead of "Indexed".

**F7. Treat AI calls as first-class records.** *(Medium)*
Validate model output against a schema before it touches the database; retry once on malformed output, then fall back honestly. Log every run (model, prompt version, tokens, cost, outcome) in an `agent_runs` table. This is the seed of the decision ledger and the per-tenant cost metering the product plan demands — and it also gives plan-Change 16 something truthful to show while generating.

**F8. A minimal safety net.** *(Small, ongoing)*
Unit tests for the things that can hurt users: date/scheduling logic, publish idempotency, QA checks, API validation (rejecting bad payloads), token refresh. Run lint + tests in CI on every push. The current single HTML-string test stays but stops being the only line of defense.

### Track U — the original 22, re-scoped

| Original | Status in revised plan |
|---|---|
| 1 (dates) | **Absorbed into F1.** |
| 2 (sign-in error messages) | **Keep as-is.** Small, do early. |
| 3, 4 (demo entry, skippable onboarding) | **Absorbed into F3** (real demo mode + empty-workspace onboarding). |
| 5 (dead buttons) | **Keep.** Bell becomes the activity-log door (F4/18). |
| 6 (read PDFs) | **Replaced by F6** (bigger scope: extraction *and* retrieval, since in this repo files are never read at all). |
| 7 (fake numbers) | **Keep, plus root cause:** new workspaces start empty (F3), so most fake data never exists to begin with; remaining derived numbers (trends, insights) computed from real data or honest "not enough data yet". |
| 8 (real QA checks) | **Keep.** Runs server-side as part of F2 (server-owned QA flags). |
| 9 (revision dead end) | **Keep** (note + "Revise with AI" + "back to review"). |
| 10 (image publishing) | **Keep** both halves: "coming soon" labels immediately; real image upload via LinkedIn's media API after F4 (so scheduled image posts work too). |
| 11 (reject undo) | **Keep.** Becomes a status change, trivial once F1 exists. |
| 12 (version history UI) | **Keep.** |
| 13 (delete knowledge files) | **Absorbed into F6.** |
| 14 (company page picker) | **Keep.** Fetch administered pages after OAuth; URN box becomes the hidden fallback. |
| 15, 16, 19, 20, 22 (sub-tab, progress, auto-refresh, calendar, theme guard) | **Keep all.** 20's real fix (date-based day matching) comes free with F1. |
| 17, 21 (alerts, suggest-themes warning) | **Dropped for this repo** — the code they fix doesn't exist here. Re-add if the newer snapshot becomes the base. |
| 18 (activity log) | **Keep, upgraded:** backed by the `activity_events` table F4 writes to, so it reports background publishing truthfully from day one. |

### Suggested sequence (one developer, ~6–7 weeks)

| Week | Focus |
|---|---|
| 0 (before anything) | **Decide which codebase is canonical** (this repo vs. the newer snapshot the docx describes). Everything below assumes this one. |
| 1–2 | **F1 + F2** (tables, validation, server-owned transitions, real dates) with the one-time migration. This is the scary week; everything after gets easier. |
| 2 | U2 (error banners), U22, U15 — small honest wins alongside. |
| 3 | **F3** (tenancy, empty workspaces, honest demo) + U7 (remove remaining fake numbers — now mostly deletion). |
| 4 | **F4 + F5** (queue scheduler, idempotency, token refresh) + U18 (activity log + real bell) + U5 (dead buttons). |
| 5 | **F6** (knowledge extraction + retrieval + delete) + U8 (real QA checks). |
| 6 | U9, U11, U12 (revision flow, undo, history), U14 (page picker), U16, U19. |
| 7 | U10 (image publishing), U20 (calendar), F8 hardening, and the full click-through walk-through from the original plan's test: zero dead clicks, zero invented numbers, zero dead ends, one post that publishes *by itself* at its scheduled time — now with the added checks: two tabs can't erase each other, a re-run cron can't double-post, and a brand-new user starts with an empty, honest workspace. |

---

## 5. Why this order (the reasoning, briefly)

- **Foundations before polish** for the same reason the original plan put "broken" before "smoother": a UX fix written against the blob (e.g. undo-reject, version history, activity log) has to be *rewritten* once the blob is split. Doing F1/F2 first means every later change is built once.
- **Honesty is architectural, not cosmetic.** The original plan treats fake data as a display problem (Change 7). Half of it is actually a *seed data* problem (F3) and a *trust boundary* problem (F2). Fixing the display while the server still accepts forged "Published" posts leaves the product exactly as untrustworthy as before — just harder to notice.
- **The scheduler is the product.** "Approve it and it publishes itself, safely" is the promise of the entire category. It deserves real infrastructure (F4), not a patched loop.
- **Everything here stays within the current stack.** No framework change, no hosting change, no rewrite: D1 + Drizzle are already installed, Queues/Durable Objects are native to Cloudflare Workers, zod is one dependency. The original plan's "no rewrites" spirit is preserved — this is finishing the architecture the stack was chosen for, not replacing it.

## 6. Out of scope (unchanged from the original plan, still right)

Visual design and layout (good as-is) · document/PDF-carousel publishing (after images) · automated comments/DMs/scraping (never) · multi-platform · autopilot publishing (post-MVP, per the product plan's approval-first principle).
