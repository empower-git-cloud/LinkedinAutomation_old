# Product Brief — Instagram Growth Engine (working name: "Northwind")

**Author:** Product strategy session, 2026-07-10
**Status:** Draft v1 for founder review
**One-liner:** An AI-native system that understands a business, builds an explainable Instagram strategy, produces on-brand content, and gets measurably better every week from real engagement data — with a human approving everything that ships.

---

## 1. Plain-language summary

Every tool on the market today helps a business *make posts faster*. Almost none of them help a business *grow on Instagram*. That difference is the entire product.

The current tools (Predis.ai, Ocoya, Flick, Blaze.ai, FeedHive and ~30 lookalikes) all share the same shape: you type a topic, they generate a caption and a graphic, you schedule it. Three things are structurally missing across all of them:

1. **Strategy is missing.** They start at "what should this post say?" — never at "what should this *business* be saying on Instagram, to whom, in what mix, and why?" The strategic thinking is still outsourced to the small-business owner who never had it in the first place. That's the actual job they're hiring a tool to do.
2. **The loop is open.** They show analytics dashboards, but nothing systematically learns: post performance never flows back into a revised strategy. FeedHive predicts engagement *before* posting; nobody revises the plan *after*.
3. **Trust is missing.** Output is generic "AI slop" (the #1 documented churn driver — 52% of consumers reduce engagement when they suspect content is AI-generated), and the tools can't explain why they suggested anything, so users can't calibrate whether to trust them.

**Our product is a growth engine, not a content tool.** It runs a continuous cycle:

> **Understand the business → propose a strategy (with the reasoning shown) → generate content (on-brand, human-approved) → publish → measure real engagement → revise the strategy (with evidence shown) → repeat.**

The human stays in the loop at exactly four gates — approving the business brief, the strategy, each piece of content, and each weekly strategy revision — and at every gate they can see *why* the system is proposing what it's proposing. That transparency is not a UI nicety; it's the trust mechanism that makes the automation acceptable, and every human edit/rejection is training signal that makes the next cycle better.

It ships the same way to a solo yoga instructor and a 50-location restaurant chain: **configured, never customized.** Industry playbooks, brand kits, voice profiles, and approval policies are all configuration. There is no per-client code, ever.

---

## 2. The business problem

- Instagram has become the default awareness, branding, and distribution channel for local businesses, D2C brands, creators, coaches, and service professionals. For many of them it *is* the marketing department.
- The job requires a rare stack of skills: brand strategy + copywriting + design + video + platform mechanics + analytics. A small business has none of these in-house; an agency costs $1,500–5,000/month; a freelancer is inconsistent.
- The result: businesses either post sporadically and randomly (no compounding), or buy an AI tool that floods their feed with generic content that actively hurts them (algorithms now reward authenticity; audiences punish detectable AI content).
- **The unmet job-to-be-done:** *"Run my Instagram like a competent, accountable marketing hire would — show me your thinking, let me approve the work, and get better over time."*

## 3. Market landscape (research findings)

### What exists

| Product | What it is | Strategy layer | Learning loop | Explainability | HITL |
|---|---|---|---|---|---|
| **Predis.ai** ($19+/mo) | One-click post generation (caption + creative), most IG formats | None | None | None | Manual scheduling |
| **Ocoya** ($19–199/mo) | All-in-one workspace (write + schedule + track), multi-platform | None | None | None | Standard drafts |
| **Flick** (~$30/mo) | IG-specialist: hashtag research + Iris AI assistant + scheduler | Prompts only | None | None | Standard drafts |
| **Blaze.ai** | Brand Kit ingestion (docs/web), weekly generate→review→auto-post rhythm | Shallow | None | None | Weekly review window |
| **FeedHive** | Predictive pre-post engagement scoring, cross-posting | None | Predictive only (pre-post, not closed-loop) | None | Standard drafts |
| **NoimosAI / agent tools** | "Autonomous" agents; account/competitor analysis for content mix | Some | Claimed, shallow | None | Varies |

Most "agent" tools operate at autonomy level 1–2 (AI-assisted or guardrailed); the market literature itself notes the gap between marketing claims and actual autonomy.

### What the research says about why users churn

- Generic output that "sounds like the same corporate bot" — users report paying for multiple AI subscriptions and still being unable to post without heavy edits.
- Teams that skip brand-voice setup and approval workflows produce off-brand content at real cost (documented $80–150K waste cases at the SMB/mid-market level).
- Audiences and the algorithm both penalize detectable AI content; engagement measurably declines.

### The whitespace (our thesis)

1. **Strategy-first, not content-first.** Derive the plan from the business, not the post from a prompt.
2. **Closed learning loop.** Performance data revises the strategy weekly, per account, with statistical guards.
3. **Explainability as a first-class data model.** Every artifact carries its "why" — provenance from business fact → strategy hypothesis → content → performance → revision.
4. **Anti-slop by architecture,** not by disclaimer: brand-locked templates, real business assets prioritized over synthetic, voice learned from the owner's own approved edits.

No shipping product combines all four. That combination is defensible because it compounds: every week of tenant data makes that tenant's engine better and harder to leave.

---

## 4. Product objective

**Primary objective:** Measurably grow a business's Instagram presence (reach, engagement, profile actions, follows) with ≤30 minutes/week of the owner's time, while the owner retains full editorial control and can always see the reasoning behind every decision.

**North-star metric:** *Engagement-rate uplift vs. the tenant's own pre-product baseline, at week 12.* (Not "posts generated" — that's the vanity metric every competitor optimizes and it produces slop.)

Supporting metrics:
- **Activation:** first approved post published within 48h of signup.
- **Trust velocity:** % of content approved without edits, trending up per tenant over time (proxy for "the engine has learned this brand").
- **Loop engagement:** % of weekly strategy reviews opened and acted on (retention leading indicator).
- **Time-to-value:** owner minutes/week (target ≤30).

## 5. Product principles

1. **Explainable by construction.** Every recommendation ships with its "Why" card. If the system can't explain it, it doesn't ship it.
2. **Human approves everything that goes public — by default.** Autonomy is *earned and granted*, per content type, by the user, never assumed.
3. **The loop is the product.** A post is not an output; it's an experiment attached to a hypothesis. The weekly revision ritual is the core retention surface.
4. **Configurable, not customizable.** One codebase, one product. Verticals, brands, voices, policies, and guardrails are configuration. Any feature that requires per-client work is rejected.
5. **Authenticity beats volume.** Prefer the owner's real photos over synthetic, real customer language over invented copy, fewer better posts over feed-flooding. This is both ethics and engagement math.
6. **Platform-compliant, always.** Official Graph API only. No gray-area automation (fake engagement, DM spam, scraping). We protect the client's account like it's our own.

---

## 6. The end-to-end journey (deep dive)

The product is one continuous cycle with four human gates.

```
ONBOARD ──► [Gate 1: Business Brief] ──► STRATEGIZE ──► [Gate 2: Strategy]
                                                              │
   ┌──────────────────────────────────────────────────────────┘
   ▼
PLAN ──► CREATE ──► [Gate 3: Content Approval] ──► PUBLISH ──► MEASURE
                                                                  │
   ┌──────────────────────────────────────────────────────────────┘
   ▼
LEARN ──► [Gate 4: Weekly Strategy Review] ──► (back to PLAN, strategy v+1)
```

### Stage 1 — Understand: the Business Brief (Gate 1)

**Inputs (10–15 minutes, self-serve):**
- Website URL, Instagram handle (we ingest existing posts + their historical performance), Google Business Profile, product catalog / menu / service list, any brand docs (PDF upload), 2–3 competitor or admired-account handles.
- A short conversational interview filling the gaps: who's your best customer, what do people compliment you on, what offer makes you money, what topics are off-limits.
- Photo/asset library connection (camera roll upload, Google Drive/Dropbox) — this is the anti-slop reservoir.

**Output — the Business Brief**, a structured, human-readable document:
- What the business sells, to whom, and the one-line differentiation
- Customer personas (2–3, grounded in evidence from reviews/site copy, not invented)
- Proof assets (reviews, results, credentials, before/afters)
- Offer economics (what's high-margin, what's seasonal, what's the CTA that matters)
- Brand voice profile (tone sliders + banned/required vocabulary, extracted then confirmed)
- Visual identity (colors, fonts, logo — auto-extracted from website/IG, editable)
- Constraints (compliance needs, topics to avoid, languages, locales)

**Gate 1:** the owner reads, edits, and approves the Brief. Every downstream artifact cites it. When the business changes (new offer, rebrand), the owner edits the Brief and the engine re-plans — the Brief is the single root document.

### Stage 2 — Strategize: the explainable 90-day strategy (Gate 2)

The Strategy Engine combines the Business Brief + the vertical playbook (industry priors) + platform mechanics + the account's own historical performance (if any) into a **90-day strategy expressed as testable hypotheses:**

- **Content pillars** (3–5) with target mix, e.g. for a fitness studio: Client transformations 30% / Educational form-tips 25% / Behind-the-scenes & trainer personality 20% / Community & UGC 15% / Offers 10%
- **Format mix** (reels / carousels / single image / stories) with rationale per pillar
- **Cadence** (posts/week, story rhythm) — set to what the owner can sustain in approval time, not a fantasy number
- **Hook & CTA ladder** — how content moves people from reach → save/share → profile visit → follow → click/DM
- **Hashtag & Instagram-SEO approach** (keywords in captions/alt text; hashtags as discovery, not decoration)
- **Success criteria per pillar** — the metric each pillar is supposed to move

**Every element carries a "Why" card**, e.g.:
> *"Transformation posts at 30%: your Brief says word-of-mouth from results is your #1 acquisition source; your 3 best historical posts (saved 4–9× your average) were all client results; accounts in your vertical see saves/shares concentrate in proof content. Hypothesis: proof content drives saves → reach. We'll verify at 3 weeks."*

**Gate 2:** the owner reviews the strategy. They can veto pillars, adjust mixes, cap formats ("I will never appear on camera") — the engine re-plans around constraints instead of breaking. Strategy is **versioned** (v1, v2…) and every future change is a diff with evidence.

### Stage 3 — Plan & Create: from calendar to finished assets

- **Rolling 2-week calendar** generated from the strategy: each slot is an **Idea Card** — hook, format, pillar tag, asset needs, and its Why ("this is a transformation post because pillar mix says you're 2 behind this week; the hook pattern is the one that outperformed for you in June").
- **Two-stage creation keeps approval cheap:** owner approves/swaps Idea Cards in seconds (tinder-style queue), then only approved ideas get produced into finished assets. No wasted generation, no wall of AI drafts.
- **Production per format:**
  - *Carousels & single images:* brand-locked template rendering (owner's colors/fonts/logo) + owner's real photos where available + generated imagery only as fallback. Template-rendered design with AI copy is cheaper, faster, and dramatically more brand-consistent than pure image generation — this is a deliberate architectural choice, not a limitation.
  - *Reels:* script + shot list + trending-audio suggestion in MVP ("film these 4 clips on your phone, 8 seconds each"); optional auto-edit of owner-uploaded clips (captions, cuts, music) next; fully generated video only when quality clears the authenticity bar.
  - *Captions:* voice-profile-constrained, with keyword/SEO placement, alt text, and first-comment hashtags.
- **Brand QA agent** checks every asset against the Brief before it ever reaches the owner: voice match, banned topics, compliance footers, visual identity, claim substantiation. Assets that fail are regenerated, not shown.

### Stage 4 — Approve & Publish (Gate 3)

- **Approval Inbox** on web and mobile (plus email/WhatsApp approve-reply for owners who live in their phone): Approve / Edit / Request changes / Reject — *with reason*. Reasons and edits are captured as structured training signal for the voice profile and idea ranking.
- **Approval policy is configuration:** default is "everything requires approval." Over time the owner can grant per-pillar autopilot ("educational carousels can post without me; offers always need me"). Autonomy is earned, granular, and revocable.
- **Publishing:** official Instagram Graph API (Business/Creator accounts), scheduled at learned best-times, within platform caps (25 API-published posts/24h; 200 calls/hr budget managed per tenant). Feed, reels, carousels, stories supported.

### Stage 5 — Measure & Learn: the closed loop (Gate 4)

- **Ingestion:** per-post Insights (reach, impressions, saves, shares, comments, profile visits, follows attributed, link taps) captured at 24h / 72h / 7d marks; account-level trends weekly.
- **Attribution:** every post is tagged with its lineage — pillar, hypothesis, hook pattern, format, time slot, CTA — so performance updates *beliefs*, not just dashboards.
- **Statistical guards:** minimum sample sizes before any conclusion (no "carousels are dead" off 3 posts); novelty vs. fatigue detection; seasonality awareness; outliers (one viral fluke) capped in influence.
- **The Weekly Strategy Review (Gate 4)** — a 5-minute digest, plain language first:
  > *"Wins: form-tip carousels earn 2.3× your average saves — proposing +5% mix. Underperformer: static offer posts get reach but no action across 6 posts — proposing we test offers as story-first with countdown instead. One experiment: your audience is unexpectedly active Sunday 8pm; testing 2 slots there. Approve all / pick / keep as is."*
  Owner approves → strategy increments to v+1 → next cycle plans against it. Every change is diffable and reversible, with the evidence attached.

This ritual is the retention engine: it's where the owner *sees* the product getting smarter, and it's the compounding moat — 12 weeks of learned brand voice, ranked hook patterns, and audience timing is switching cost no competitor's blank prompt box can match.

---

## 7. Configurable, not customizable — the model

One codebase. Tenant differences live entirely in configuration and learned memory:

| Layer | What it holds | Set by |
|---|---|---|
| **Vertical playbook** | Industry priors: pillar templates, benchmark metrics, format tendencies, compliance presets (~10–15 playbooks at launch: restaurant, fitness, salon/beauty, real-estate, D2C, coach/consultant, clinic, home services, boutique retail, creator, local events…) | Us (product) |
| **Business Brief** | Everything from Stage 1 | Engine drafts, owner approves |
| **Brand kit** | Colors, fonts, logo, template family, image style rules | Auto-extracted, owner edits |
| **Voice profile** | Tone parameters, vocabulary rules, example bank | Learned from approved edits |
| **Approval policy** | What needs human sign-off, per content type/pillar | Owner |
| **Guardrails** | Banned topics/words, compliance footers, claim rules, locale/language | Owner + vertical preset |
| **Tenant memory** | Ranked hook patterns, timing, pillar performance beliefs, edit history | Learned |

New vertical = new playbook config. New client = onboarding flow. **Zero per-client engineering** — this is the scalability contract, and any roadmap item violating it gets cut.

## 8. System architecture (concept level)

Multi-tenant SaaS. An agent pipeline over shared per-tenant state, orchestrated as durable workflows (every step resumable, auditable):

- **Analyst agent** — ingests website/IG/docs/reviews → drafts and maintains the Business Brief
- **Strategist agent** — Brief + playbook + performance memory → versioned strategy with Why cards
- **Planner agent** — strategy → rolling calendar of Idea Cards
- **Producer agents** — copy, template-rendered design, reel scripting (image/video generation behind a quality gate)
- **Brand-QA agent** — pre-approval compliance/voice/visual check; failing assets regenerate silently
- **Publisher** — Graph API scheduling within rate budgets, retries, failure alerts
- **Performance agent** — Insights ingestion, attribution, weekly review drafting

**The Decision Ledger** is the distinctive piece of data architecture: an append-only provenance graph linking Brief facts → strategy hypotheses → ideas → assets → published posts → metrics → revisions. It's what powers every "Why" card, the weekly review's evidence, and the audit trail (which enterprise/agency buyers will demand). Competitors would have to rebuild their data model to copy this.

**Unit economics guardrail:** template-rendered creative + LLM copy keeps marginal cost per post at cents; pure image-gen ~10× that; video-gen ~100× that. MVP economics work at $49–99/mo with template-first production. Video generation enters only when cost × quality clears the bar.

## 9. MVP and roadmap

**Phase 1 — MVP (ship to first 10–20 design partners, one or two verticals):**
Onboarding → Business Brief → 90-day strategy with Why cards → Idea Cards → carousel/single-image production + captions/hashtags + reel scripts (owner films) → approval inbox → Graph API publishing → Insights ingestion → weekly review (engine-drafted, owner-approved).
*Deliberately out:* video generation, multi-platform, agency multi-brand, comment/DM handling, autopilot.

**Phase 2 — Trust & depth:** per-pillar autopilot, auto-edited reels from owner clips, mobile approvals via WhatsApp/email, story sequences, UGC prompts, 8–15 vertical playbooks.

**Phase 3 — Scale surfaces:** agency workspace (multi-brand, client-approval routing, white-label reports), comment-reply drafting (HITL), Facebook/TikTok/LinkedIn as additional publish targets on the same strategy brain, team seats.

**Pricing posture (sketch):** Solo $49–79/mo · Growth $149–249/mo (more formats, autopilot, priority generation) · Agency per-brand seat pricing. Anchor against the $1,500+/mo agency and the $30 tool that makes slop: we price on outcome ("a marketing hire for 3% of the cost"), not on post volume.

## 10. Risks & mitigations

| Risk | Mitigation |
|---|---|
| **Meta API changes / caps** (25 posts/day API cap, 200 calls/hr, token churn, policy shifts) | Official API only; per-tenant rate budgeting; publishing abstraction layer so other channels can be added; monitor deprecations (e.g. 2026 messaging-tag enforcement) |
| **AI-content fatigue / algorithm penalties** | The whole anti-slop architecture: real assets first, brand-locked templates, learned voice, quality-over-volume cadence |
| **Crowded market noise** | Position on strategy + loop + explainability, never on "generate posts fast"; north-star metric keeps us honest |
| **Single-channel concentration** | Instagram-first for focus, but Brief/strategy/loop are channel-agnostic by design; publisher is a plugin |
| **Trust cold-start (weeks 1–2 output is least-informed)** | Heavy onboarding ingestion, vertical priors, existing-post history mining, and expectation-setting: the weekly review shows improvement explicitly |
| **Owner approval fatigue** | Idea-card pre-approval (cheap), batch weekly rhythms, earned autopilot |
| **Compliance verticals (health, finance)** | Guardrail presets per playbook; claim-checking in Brand-QA; these verticals gated until presets exist |

## 11. Decisions needed from you

1. **Wedge vertical(s) for MVP.** Recommendation: pick 1–2 where proof is visual and buying pain is high — fitness/wellness studios or salons/beauty. (Restaurants are high-volume but low willingness-to-pay; D2C is crowded with Predis-style tools.)
2. **Design-partner motion vs. pure self-serve at launch.** Recommendation: 10–20 hand-held design partners for 8 weeks to tune playbooks and the weekly review, *then* open self-serve. The product's promise is "it gets smarter" — we need real loop data before scale.
3. **Reels video generation in or out of MVP.** Recommendation: out. Scripts + shot lists in; auto-editing of owner footage is the Phase 2 sweet spot. Full generation waits for the quality bar.
4. **Pricing posture.** Recommendation: start Growth-tier-first ($149) with design partners, introduce Solo tier at self-serve launch. Cheap-tool anchoring ($19) is the trap that forces volume economics and slop.
5. **Name.** "Northwind" is a placeholder.

---

## Appendix — research sources

- [7 Best AI Agents for Social Media Management in 2026 (NoimosAI)](https://noimosai.com/en/blog/the-best-ai-agents-for-social-media-management-in-2026) · [7 Best Autonomous AI Agents ranked](https://noimosai.com/en/blog/7-best-autonomous-ai-agents-for-social-media-management-2026-ranked-reviewed)
- [AI agents for social media: a no-hype guide for 2026 (Admove)](https://www.admove.ai/blog/ai-agents-for-social-media-guide) · [Autoadify: AI Agents for Social Media 2026](https://autoadify.com/blog/ai-agents-social-media-2026)
- [Best AI Social Media Tools 2026: 21 tools compared (Apaya)](https://apaya.com/blog/best-ai-social-media-tools) · [Best AI Instagram Post Generators (CreatorFlow)](https://creatorflow.so/blog/ai-instagram-post-generator/) · [35 Best AI Tools for Instagram (PostEverywhere)](https://posteverywhere.ai/blog/35-best-ai-tools-for-instagram)
- [Blaze AI Review 2026 (WMApp)](https://wmappdigital.com/blaze-ai-review/) · [Blaze AI review & alternatives (quso.ai)](https://quso.ai/blog/blaze-ai-review-alternatives) · [FeedHive vs Blaze (Capterra)](https://www.capterra.com/compare/240356-10013921/FeedHive-vs-Blaze)
- [Why AI-generated social posts get low engagement (MydropAI)](https://mydropai.com/post/why-your-ai-generated-social-media-posts-get-low-engagement/) · [Anti-AI backlash (Mojo)](https://mojo.biz/anti-ai-backlash-real-heres-how-smart-brands-are-using-ai-without-looking-they-are) · [Small businesses drowning in AI slop (Forbes)](https://www.forbes.com/sites/terdawn-deboe/2026/03/31/small-businesses-are-drowning-in-ai-slop-one-document-stops-it/) · [Common AI social tool complaints (Sozee)](https://sozee.ai/resources/common-complaints-ai-social-tools/)
- [Instagram API 2026 rules (Storrito)](https://storrito.com/resources/Instagram-API-2026/) · [IG Graph API rate limits (InstantDM)](https://instantdm.com/blog/instagram-api-rate-limits-explained-2026-developer-guide) · [IG Graph API developer guide (WPSocialNinja)](https://wpsocialninja.com/instagram-graph-api/) · [Post to Instagram via API (Postproxy)](https://postproxy.dev/blog/post-to-instagram-via-api/)
