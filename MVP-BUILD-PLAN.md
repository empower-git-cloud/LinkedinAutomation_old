# MVP Build Plan — Content Automation Platform

**Status:** v1 for founder review · 2026-07-10
**Supersedes scope of:** PRODUCT-BRIEF.md (strategy layer, learning loop, video → post-MVP)
**Product shape:** B2C subscription, mobile-first web platform, configurable-not-customizable, multi-tenant. One codebase, zero per-client work.

---

## 1. Plain-language summary

We are building a platform where a business owner signs up on their phone, connects their Instagram, and within ~15 minutes the system has: scanned their website/Instagram/brand docs, asked them a handful of multiple-choice questions, proposed content themes, researched what's trending in those themes on Instagram, and generated their first ready-to-post carousel — which they approve and it publishes automatically. From then on, the platform keeps generating posts on their chosen schedule, they approve each one (with up to 3 edit rounds), it posts via the official Instagram API, notifies them as likes/comments roll in, and quietly turns interested commenters into a leads list.

**In MVP:** images + carousels, own-photo posts with text overlays, flexible scheduler, engagement dashboard + milestone notifications, comment-to-lead capture, frequency-based subscription pricing.
**Not in MVP:** video, brand strategy engine, learning loop, multi-platform.

---

## 2. Scope lock

| # | Capability | In MVP |
|---|---|---|
| 1 | Business scan: website scrape + user's own IG history + PDF/doc brand guidelines | ✅ |
| 2 | Dynamic multiple-choice onboarding questions (generated from the scan; audience, best-sellers, content purpose: awareness/sales/retention) | ✅ |
| 3 | Theme proposal (10–15) → user selects 3–5 | ✅ |
| 4 | Per-theme hashtag research (10–15 hashtags/theme), trending detection, user can edit the hashtag set | ✅ |
| 5 | Trend mining: top ~20 posts per hashtag, engagement-scored, feeds idea generation | ✅ |
| 6 | Idea generation (~15 topic/script ideas) → user selects ~5 favourites; editable later | ✅ |
| 7 | Content production: AI image gen from generated prompts, carousels, captions + hashtags | ✅ |
| 8 | Own-image content: user uploads their photo(s); we composite dialogue boxes / text overlays / multi-image posts around it | ✅ |
| 9 | Approval flow: sample post at signup; every post approved before publishing; max 3 edit rounds per post | ✅ |
| 10 | Flexible scheduler: frequency presets + per-day, per-time overrides (not one fixed daily slot) | ✅ |
| 11 | Auto-publish via Instagram Graph API (no manual posting) | ✅ |
| 12 | Engagement milestone notifications (50/100/150 likes, views, comments) | ✅ |
| 13 | Dashboard: per-post engagement; edit themes/ideas/hashtags/preferences in-app | ✅ |
| 14 | Comment → lead pipeline: classify every comment; interested/neutral = lead, negative = detractor (ignored/flagged) | ✅ |
| 15 | Mobile-first UI, desktop compatible | ✅ |
| 16 | Subscription billing priced by posting frequency | ✅ |
| — | Video/reels, strategy engine, learning loop, multi-platform, comment auto-replies | ❌ post-MVP |

---

## 3. User journey (screen-level)

**Onboarding (one guided flow, ~10–15 min):**
1. Sign up (phone/email/Google) → business name.
2. **Connect & scan:** enter website URL + IG handle, connect Instagram (Meta OAuth — requires IG Business/Creator account linked to a Facebook Page; we detect personal accounts and walk them through converting, this is a known drop-off point so it gets a polished helper flow). Optional: upload brand PDF/docs, pick brand colors (pre-filled from website scan).
3. Scan runs (~60–90s with progress UI) → produces the **Business Context** (what you sell, item list, audience signals, tone, visual identity). Shown as a short editable summary card — user confirms.
4. **Smart questions:** 5–8 multiple-choice questions *generated from the scan* (e.g. food business → "We found these 8 menu items — which are your best-sellers to promote?" · "Primary goal: awareness / sales / retention?" · "Audience: locals / young professionals / families…"). Fixed answers + multi-select; free text only as an "other" escape hatch.
5. **Themes:** 10–15 proposed content themes with one-line descriptions → select 3–5.
6. **Hashtags:** per selected theme, we show the researched hashtag set (10–15) with trending indicators → user removes/adds.
7. **Ideas:** ~15 generated content ideas (title + 2-line script + format: single/carousel) ranked by trend-engagement signals → user picks ~5.
8. **Sample post (activation moment):** we produce one full post from their top idea — images + caption + hashtags — right there. Approve / request changes (up to 3 rounds) → **publishes to their Instagram during signup.** This is the magic moment; everything is optimized to get here fast.
9. **Schedule & plan:** pick frequency (maps to pricing tier), set per-day/time grid → start subscription (trial: the sample post + first 3 scheduled posts free, card required — final call is a pricing decision below).

**Steady state (the weekly rhythm):**
- Posts are generated ahead of schedule and land in the **Approval queue** (push notification: "Tomorrow 6pm post is ready"). User approves / edits (3 rounds) / rejects (a replacement idea is queued).
- Approved posts publish automatically at their slot. **Unapproved posts never publish** — if the slot arrives without approval, we hold, notify, and offer one-tap reschedule.
- **Notifications:** milestone alerts (50/100/150+ likes, comment counts), publish confirmations, "leads waiting" alerts.
- **Dashboard tabs:** *Queue* (approve/edit) · *Calendar* (scheduler grid) · *Performance* (per-post reach/likes/comments/saves, simple trends) · *Leads* (classified commenters) · *Settings* (themes, ideas pool, hashtags, brand kit, own-photo library, plan).

---

## 4. Architecture

### 4.1 Stack (decisive picks, swap only with reason)

| Layer | Choice | Why |
|---|---|---|
| App | **Next.js 15 (TypeScript) responsive PWA** — installable, web push | One codebase, mobile-first + desktop free, no app-store review latency for MVP. Native (Expo) wrapper is a Phase-2 option if push/App-Store presence demands it |
| API | Next.js route handlers + **tRPC** (or REST) | Speed; types shared end-to-end |
| Workers | Separate Node worker service, **BullMQ + Redis** | Everything async lives here: scans, trend research, generation, publishing, polling. Publishing must survive deploys — jobs are durable and idempotent |
| DB | **Postgres** (managed: Neon/Supabase/RDS) + Drizzle/Prisma | Multi-tenant via `tenant_id` on every row + RLS |
| Storage | S3-compatible (Cloudflare R2) | Generated + uploaded assets; public CDN URLs (IG publish API pulls media by URL) |
| Auth | Clerk (or Auth.js) | Phone + Google auth out of the box, mobile-friendly |
| Billing | Stripe (+ Razorpay if India-first — decision below) | Subscription tiers + metering |
| Text intelligence | **Claude API** — `claude-sonnet-5` for pipeline work (scan extraction, question gen, themes, ideas, prompts, captions), `claude-haiku-4-5` for high-volume cheap classification (comment sentiment) | Quality where it matters, cost control where volume is |
| Image generation | **fal.ai or Replicate (FLUX family)** behind our own `ImageProvider` interface; Gemini/Imagen as alternate | Cost (~$0.02–0.04/image) + speed; provider-swappable by config |
| Text-on-image | **Rendered programmatically** (satori/resvg or node-canvas + Sharp), *never* asked of the image model | See §6 — this is a critical quality decision |
| Notifications | Web Push + email (Resend); WhatsApp (Meta Cloud API) Phase 2 | Push is the retention loop |
| Observability | Sentry + structured job logs; per-tenant cost metering from day 1 | Pricing depends on knowing COGS per tenant |

A note on "MCP connections": MCP is how tools plug into AI dev/agent environments — the right pattern for the *production* backend is direct API integrations (Claude API, image APIs, Instagram Graph API) called from our workers. Same capability, but versioned, metered, retried, and billed per tenant. We use MCP during development, not in the serving path.

### 4.2 The pipeline (services, all config-driven)

```
[1 Scanner] website + IG history + docs ──► BusinessContext (JSON, versioned)
      │
[2 Question Gen] MCQ set from context ──► answers merged into BusinessContext
      │
[3 Theme Gen] 10–15 themes ──► user selects 3–5
      │
[4 Trend Engine] themes → hashtags → top posts → engagement scores
      │           (platform-wide shared trend store — see §5)
[5 Idea Gen] trend signals + BusinessContext ──► ~15 ideas ──► user picks ~5
      │
[6 Producer] idea → image prompt(s) → image gen / own-photo compositing
      │        → caption + hashtags → draft post
[7 Approval] queue, 3 edit rounds, approve/reject
      │
[8 Publisher] Graph API, scheduled slots, retries, JPEG conversion
      │
[9 Engagement Monitor] insights polling → milestones → notifications, dashboard
      │
[10 Lead Engine] comment webhooks → classify → leads/detractors
```

Every stage reads/writes tenant state; no stage contains tenant-specific logic. Vertical differences (food vs salon vs coach) live in **playbook config** (question templates, theme seeds, prompt styles) — this is the configurable-not-customizable contract.

### 4.3 Data model (core tables)

`tenants` · `users` · `ig_connections` (tokens, page/ig-user ids, token refresh state) · `business_context` (versioned JSON + provenance) · `onboarding_answers` · `themes` (proposed/selected) · `hashtags` (per theme, user-edited) · **`trend_hashtags` + `trend_posts` (platform-global, no tenant_id — shared research cache)** · `ideas` (pool, status: proposed/liked/used/retired) · `posts` (status machine: `draft → generating → pending_approval → approved → scheduled → publishing → published / failed / held`) · `post_assets` (generated + uploaded, slide order) · `edit_rounds` (max 3, feedback text) · `schedule_slots` (per-weekday day/time grid + one-off overrides) · `engagement_snapshots` (per post, polled) · `milestones_fired` · `comments` · `leads` (classification, ig username, source post) · `plans` / `subscriptions` / `usage_events` (per-tenant COGS metering) · `notifications`.

---

## 5. Trend engine — design around Instagram's hard limits

This feature (per-theme trending hashtags + top-20 posts by engagement) is the most API-constrained part of the product. The constraints:

- **Hashtag Search API: 30 unique hashtags per IG user per rolling 7 days.** 5 themes × 15 hashtags = 75 — one user's token can't do their own research. This single limit dictates the architecture.
- Hashtag media endpoints return top/recent media with caption, media type, comment counts (like counts are sometimes withheld) — enough for engagement scoring with a comments-weighted fallback.
- 200 API calls/hour per token overall.

**Design: platform-level shared trend store.** Hashtag research is not per-tenant work — "#homebaker" trends identically for every bakery on the platform. So:

1. LLM proposes candidate hashtags per theme (from theme + BusinessContext + locale).
2. The trend store is checked first: if a hashtag was researched < 72h ago, reuse it (zero API cost).
3. Cache misses go to a **research pool** of platform-owned IG professional accounts (each contributes its 30/week budget), queued and rate-budgeted by the worker.
4. Scores: engagement score per hashtag = median(comments×w₁ + likes×w₂) of its top ~20 posts, recency-weighted; "trending" = score velocity vs the hashtag's own prior window.
5. Users see the researched set per theme and edit it; their edits affect only their tenant.

This makes trend research a **shared platform asset that gets cheaper per tenant as we grow** — exactly the scalability profile we want. Fallback/augmentation if API limits still bind: licensed third-party hashtag data (e.g. Apify/Bright Data or a hashtag-analytics API) behind the same `TrendProvider` interface — flagged as a compliance/cost decision, not wired in by default.

---

## 6. Content production — the quality-critical decisions

**Never let the image model render text.** Image models garble typography (worse in Hindi/Hinglish/mixed-script). Every word on an image — headlines, dialogue boxes, price tags, CTA footers — is rendered **programmatically** (satori/Sharp) on top of the visual. The image model produces *backgrounds and subjects only*. This one decision is most of the difference between "professional" and "AI slop."

**Pipeline per post:**
1. Idea + BusinessContext + brand kit → Claude writes a *structured creative spec*: slide count, per-slide visual prompt, per-slide overlay text, layout template id, palette.
2. Visuals per slide: **(a)** generated (FLUX, brand palette hints, no text in prompt), **(b)** user's uploaded photo (their face, product shots), or **(c)** solid/brand-patterned background for text-led slides. The spec chooses; the user's own-photo library is preferred when relevant (authenticity + zero gen cost).
3. Compositor renders overlay text, dialogue boxes, logo placement, safe margins onto each slide from a **shared template library** (10–15 layout templates at launch: quote card, tip list, before/after, menu highlight, testimonial, talking-head dialogue…). Templates are platform assets; brand kit (colors/fonts/logo) parameterizes them per tenant. New look = new template for everyone, never a one-off.
4. Output: 1080×1350 JPEGs (Graph API publishes **JPEG only**), carousel max 10 slides.
5. Caption + hashtag block generated against the theme's approved hashtag set + IG-SEO keywords.

**Own-image posts (the enhancement):** user uploads photo(s) → stored in their asset library with light auto-tagging → when creating a post they can pick "use my photo" (or the spec auto-selects) → same compositor adds dialogue boxes/text overlays → multi-image posts mix their photos + generated slides freely.

**Edit loop:** 3 rounds max, enforced. Feedback is structured (quick chips: "change image" / "change text" / "change style" + free text) so each regeneration is targeted (only re-run the changed stage — don't burn 5 image generations because a caption was wrong). Round count and per-round cost are metered per tenant.

---

## 7. Scheduler & publishing

- **Scheduler model:** frequency preset (from plan tier: e.g. every 3 days / daily / 2×day) generates default slots; user then edits a **per-weekday grid** (e.g. Mon 7pm, Wed off, Fri 12pm & 7pm) plus one-off date overrides. Slots are timezone-aware (tenant tz).
- **Generation runway:** producer keeps N=3 upcoming slots filled with drafts, cycling through the user's liked ideas (least-recently-used, so themes rotate); when the idea pool runs dry, we generate a fresh idea batch from the trend store and notify the user to pick.
- **Approval-before-slot:** drafts ready ≥24h before their slot; reminders at 24h/4h. Slot reached unapproved → **hold + notify + one-tap reschedule.** We never auto-publish unapproved content (trust is the product; "automatic" means the *publishing* is hands-free after approval, per your spec).
- **Publisher:** Graph API two-step (create media container(s) → publish), carousel container flow, retry with backoff, container status polling. Platform caps respected by design (25 API-published posts/24h per account — our max tier is 2/day, far under).
- **Failure UX:** publish failure → instant notification + auto-retry ×3 → held with reason.

## 8. Engagement, notifications, leads

- **Engagement Monitor:** per published post, poll insights + likes/comments at a decaying cadence (15min → hourly → daily over 7 days, within the 200 calls/hr token budget). Snapshots power the dashboard.
- **Milestones:** configurable thresholds (default 50/100/250/500/1000 likes; 10/25/50 comments; reach milestones) → push notification once each (`milestones_fired` dedupes). This is the dopamine loop that brings users back.
- **Lead engine:** comment webhooks (Meta webhooks on the app, comments field) with polling fallback → `claude-haiku-4-5` classifies each comment: `interested` (buying signals, questions, DMs-me vibes) / `neutral` (kept as lead per your spec) / `negative` (marked detractor, excluded from leads) / `spam` (dropped). Leads inbox shows IG username, comment, post, classification, with one-tap "open their profile." Auto-*replies* are post-MVP (separate Meta permission + risk surface).

## 9. Meta platform compliance — the true critical path

Building the features is predictable; **Meta App Review is not**, so it starts in week 1–2, not at the end:

1. Create Meta app + business verification **immediately** (verification alone can take days–weeks).
2. Permissions needed: `instagram_basic`, `instagram_content_publish`, `instagram_manage_insights`, `instagram_manage_comments`, `pages_show_list`, `pages_read_engagement` — each needs App Review with screencasts of the working product. Dev mode + test users lets us build everything before approval.
3. Webhooks require the reviewed app for live traffic.
4. Token lifecycle: long-lived tokens (~60 days) + refresh job + re-auth prompt flow when refresh fails.
5. ToS red lines we stay behind: API-only publishing, no engagement automation, no scraping of other users beyond sanctioned hashtag endpoints, clear user consent for comment processing (privacy policy + data deletion endpoint — both required by review anyway).

## 10. Pricing & unit economics

**COGS per post (estimated):** images 3–5 × ~$0.03 = $0.09–0.15 · Claude calls (spec/caption/prompts) ≈ $0.03–0.06 · edit rounds allowance ≈ +50% · amortized trend research + infra ≈ $0.03 → **≈ $0.20–0.35 per delivered post.** Onboarding scan ≈ $0.30–0.60 one-time. (Metered per tenant from day 1 in `usage_events` so these numbers become real within weeks.)

**Frequency-tiered plans (your model), sketched:**

| Tier | Frequency (~posts/mo) | Est. COGS/mo | Price (USD) | Margin |
|---|---|---|---|---|
| Starter | 1 per 3 days (~10) | ~$3 | **$19/mo** | ~84% |
| Growth | daily (~30) | ~$9 | **$39/mo** | ~77% |
| Pro | 2×/day (~60) | ~$18 | **$69/mo** | ~74% |

All tiers include: full onboarding intelligence, themes/hashtag research, 3 edit rounds/post, dashboard, leads. Levers if margins tighten: edit-round packs, extra idea batches, lead volume caps. India-market pricing (₹) is a decision below.

## 11. Build phases (~9 weeks to private beta)

| Phase | Weeks | Deliverable | Exit test |
|---|---|---|---|
| 0 — Foundation | 1 | Monorepo, auth, tenant model, PWA shell, CI/deploy, **Meta app + business verification submitted**, test IG accounts | Deployed skeleton; dev-mode IG connect works |
| 1 — Scan & questions | 1–2 | Website/IG/PDF scanners → BusinessContext; MCQ generation + flow | 5 real businesses scan into accurate, editable contexts |
| 2 — Themes & trends | 2–3 | Theme gen; trend store + research pool; hashtag review UI | Themes→hashtags→scored top posts for a food + a salon business |
| 3 — Content engine | 3–5 | Creative spec gen, image gen + compositor + template library (10), own-photo library, captions, edit loop, **sample-post signup flow** | Signup→published sample post < 15 min, output passes the "would I post this?" bar |
| 4 — Scheduler & publishing | 5–6 | Slot grid UI, runway generation, approval queue, Graph API publisher + retries | 2 weeks of scheduled posts publish reliably to test accounts |
| 5 — Engagement & dashboard | 6–7 | Insights polling, milestones, push notifications, performance dashboard | Milestones fire correctly on live posts |
| 6 — Leads | 7 | Comment webhooks, classification, leads inbox | Seeded comments classify correctly incl. Hinglish |
| 7 — Billing & beta | 8–9 | Stripe/Razorpay tiers, usage metering, paywall, polish, onboard 10–20 beta users | Paying user completes full loop unassisted |

Meta App Review runs in parallel from week 2; beta can run on dev-mode test users if review lags. Post-beta backlog (already spec'd, not built): video/reels, strategy layer, learning loop, comment auto-reply, native app wrapper, WhatsApp notifications.

## 12. Risks

| Risk | Mitigation |
|---|---|
| Meta App Review delays/rejections | Start week 1; screencasts prepared per permission; beta on test users meanwhile |
| Hashtag API 30/week ceiling | Shared trend store + research pool (§5); third-party data provider as fallback |
| Image quality below the "post this" bar | Text always programmatic; template library; own-photo preference; sample post as forcing function in week 5, not week 9 |
| IG personal-account drop-off at connect | Guided convert-to-professional flow; measure funnel from day 1 |
| Token expiry breaking scheduled posts | Refresh worker + pre-slot token health check + re-auth push notification |
| COGS drift (edit-round abuse, image retries) | Hard 3-round cap, per-tenant metering, targeted-stage regeneration |
| Approval fatigue → churn | Push-driven 30-second approve UX; runway warnings; (post-MVP: earned auto-approve) |

## 13. Decisions needed

1. **Market & currency:** India-first (Razorpay, ₹ pricing, Hinglish content emphasis) or global-USD from day 1? Affects billing stack and template/language priorities. *Recommendation: India-first, USD-ready.*
2. **PWA vs native app for MVP:** *Recommendation: PWA now* (one codebase, no store review), Expo wrapper in Phase 2 if push adoption on iOS disappoints.
3. **Trial design:** card-upfront with sample + 3 free scheduled posts, or no-card trial? *Recommendation: card-upfront* — the sample post is strong enough to convert, and it filters tire-kickers whose scans cost us money.
4. **Unapproved-at-slot policy confirmed?** Plan assumes **hold + notify, never auto-publish**. Confirm.
5. **Third-party hashtag data fallback:** pre-approve using a licensed provider if Graph API limits bind, or hard "official API only"? *Recommendation: official-only for beta; revisit with data.*
6. **Wedge vertical for the first 10–15 playbook configs & templates** (food was your running example — good pick: visual, local, high posting appetite). Confirm food + 1–2 more (salon/beauty? boutique retail?).
