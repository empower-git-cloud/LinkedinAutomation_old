# LinkedIn Content & Engagement Platform — Product and MVP Plan

**Status:** Draft for founder review  
**Date:** 2026-07-11  
**Working principle:** Understand the business → develop an explainable strategy → create distinct founder and company content → approve → publish → measure → learn → capture qualified engagement.

---

## 1. Executive recommendation

Build a mobile-first, multi-tenant web platform for founder-led B2B content. A customer connects a founder profile and company page, adds their website and knowledge base, confirms an AI-drafted Business & Voice Brief, selects recommended themes, reviews a two-week content plan, approves finished posts and creative, and publishes through LinkedIn's official APIs. The system then measures post performance, classifies comments, and maintains a spreadsheet-like lead list.

The product should create **one coordinated strategy with two distinct voices**:

- **Founder profile:** opinions, lessons, expertise, personal stories, contrarian takes, and conversation-led posts.
- **Company page:** product education, customer proof, use cases, launches, employer brand, and institutional credibility.

The two profiles may share a theme, but they should not publish duplicated copy or creative. Each post has a purpose, hypothesis, target audience, format, CTA, and explanation of why it was recommended.

### Proposed MVP promise

> Turn your company knowledge into two weeks of founder and company LinkedIn content, approve it in one place, publish it safely, and see which conversations create business interest.

### Recommended MVP boundary

Include strategy, text/image/document content, approval, scheduling, publishing, analytics, comment sentiment, and a spreadsheet-like contacts list. Exclude automated commenting, DMs, connection requests, scraping, video generation, CRM sync, and fully autonomous publishing.

---

## 2. What carries over from the Instagram reference

The strongest ideas in `PRODUCT-BRIEF.md` and `MVP-BUILD-PLAN.md` should remain central:

1. **Strategy before content:** derive themes and post hypotheses from the business rather than starting with an empty prompt.
2. **Explainability:** every theme, post, cadence recommendation, and strategy revision has a visible “Why this?” card.
3. **Human approval:** nothing is published without explicit approval in the MVP.
4. **Anti-slop architecture:** use real facts, founder stories, approved claims, customer proof, and brand templates before synthetic material.
5. **Closed learning loop:** tag every published post with its theme, format, hook, CTA, target profile, and hypothesis so performance can improve future recommendations.
6. **Configuration, not client-specific code:** voice, brand, compliance, vertical playbooks, and approval policies are tenant configuration.
7. **Durable workflows:** scans, generation, approvals, scheduled publishing, analytics collection, and retries must survive deployments and failures.

LinkedIn needs a different content model: thoughtful text and document posts matter more; founder and company voices require separate rules; and qualified conversations are more important than raw engagement volume.

---

## 3. LinkedIn API reality and product implications

These constraints must be treated as scope gates.

| Requirement | Current feasible approach | Product implication |
|---|---|---|
| Publish on a founder profile | OAuth plus the open `w_member_social` permission | Founder publishing can be prototyped early. |
| Publish/manage a company page | LinkedIn Community Management API and organization permissions; the connected member must have an eligible page role | Apply for Development access immediately and design for Standard-tier approval. |
| Founder analytics | `r_member_postAnalytics` is part of the vetted Community Management API | Full founder analytics is gated by LinkedIn approval, even though founder publishing is more accessible. |
| Company post analytics | Organization share/page/follower statistics are available with approved permissions and eligible admin access | Company dashboard is viable after access approval. |
| Read and classify comments | Company comments are supported through Community Management APIs; member-level reading has stricter access constraints | Make company-page lead capture the guaranteed beta path. Enable founder-comment ingestion only when the granted scopes permit it. |
| Image and document publishing | Organic text, images, multi-image, video, documents, and articles are supported | MVP can support text, single/multi-image, link/article, and PDF document posts. |
| Organic carousel | Native organic carousel is not listed as supported | Produce a designed PDF/document post as the LinkedIn carousel equivalent. |
| Platform-wide hashtag trends | No documented official LinkedIn API provides general hashtag trend search or top posts by hashtag | Do not scrape or promise LinkedIn-wide hashtag trend detection. Use the compliant Trend & Relevance Engine in §7. |

Official references: [Share on LinkedIn](https://learn.microsoft.com/en-us/linkedin/consumer/integrations/self-serve/share-on-linkedin), [Posts API](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api), [Community Management overview](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/community-management-overview), [Member post analytics](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/members/post-statistics), [Organization share statistics](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/organizations/share-statistics), and [Comments API](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/comments-api).

### Compliance rule

Use only official LinkedIn APIs and user-provided/imported material. Do not automate profile visits, connection requests, DMs, reactions, or comments; do not scrape feeds, profiles, competitors, or hashtags. Keep approval, consent, data deletion, token revocation, and audit trails visible.

---

## 4. Target customer and jobs to be done

### Recommended initial customer

Founder-led B2B companies with 5–100 employees where the founder's expertise and the company page both influence pipeline: SaaS, professional services, agencies, consulting, recruiting, and business education.

### Core jobs

- “Understand my business without making me write a long content brief.”
- “Tell me what the founder should say versus what the company should say.”
- “Give me credible ideas tied to current customer and industry conversations.”
- “Create posts that sound like me and remain factually safe.”
- “Let me approve a batch quickly, then publish it reliably.”
- “Show what is working and who appears commercially interested.”

### North-star metric

**Qualified conversations generated per 10 published posts**, supported by:

- posts approved without substantial edits;
- impressions and unique reach;
- engagement rate;
- comments and reposts;
- saves/sends/clicks where available;
- profile views and followers attributable to founder content where available;
- company page clicks and follower growth;
- interested commenters captured;
- user time spent per approved post.

---

## 5. MVP scope lock

| Capability | MVP | Notes |
|---|---:|---|
| User authentication and multi-tenant workspace | Yes | Founder or marketer owns the workspace. |
| Website ingestion | Yes | Crawl permitted public pages from the submitted domain. |
| Knowledge-base ingestion | Yes | PDF, DOCX, PPTX, TXT/Markdown, pasted text, FAQs, case studies, and approved links. |
| Founder and company profile setup | Yes | OAuth connection plus profile/page selection; pasted URLs are context, not permission. |
| Business & Voice Brief | Yes | AI draft, user edits, then Gate 1 approval. |
| Separate founder/company voice profiles | Yes | Include example posts, banned phrases, preferred language, claims, and CTA rules. |
| Theme recommendation and selection | Yes | 8–12 candidates, user selects 3–5 per two-week cycle. |
| Trend & relevance evidence | Yes | Compliant sources and first-party performance; no LinkedIn scraping. |
| Cadence recommendation | Yes | Separate recommendation for founder and company, adjustable by user. |
| Two-week rolling calendar | Yes | Idea approval before full production. |
| Text and link/article posts | Yes | Founder and company. |
| Single-image and multi-image posts | Yes | Brand-template based. |
| PDF/document posts | Yes | The MVP “carousel” format. |
| AI-generated visual concepts | Yes | Optional background/illustration generation; real brand assets preferred. |
| Brand guidelines and template upload | Yes | Logo, colors, fonts, examples, editable template family. |
| Post approval and editing | Yes | Approve, edit, request changes, reject; version history retained. |
| Scheduled publishing | Yes | Only approved posts publish. |
| Founder analytics | Conditional | Enabled when Community Management/member analytics access is granted. |
| Company analytics | Yes after API approval | Per-post plus page/follower summaries. |
| Comment sentiment and intent | Yes where API access permits | `interested`, `question`, `supportive`, `neutral`, `negative`, `spam`. |
| Spreadsheet-like contacts list | Yes | In-app table plus CSV/XLSX export; CRM integrations later. |
| Weekly learning review | Yes | Evidence-backed recommendations; user approves changes. |
| Auto-replies, DMs, connection requests | No | Post-MVP and only if LinkedIn policy permits. |
| Native mobile apps | No | Responsive PWA for MVP. |
| Generated video | No | Scripts/storyboards can be Phase 2. |

---

## 6. User journey and human approval gates

### A. Onboarding and understanding — Gate 1

1. Sign up and create a workspace.
2. Add website, company name, industry, primary market, and timezone.
3. Upload knowledge sources: product deck, service catalog, case studies, brand guidelines, content templates, testimonials, and compliance rules.
4. Connect LinkedIn with OAuth and select the founder profile and eligible company page.
5. The Analyst Agent extracts products/services, audience, differentiators, proof, offers, vocabulary, claims, and gaps.
6. The user answers 5–8 targeted questions only for missing or ambiguous information.
7. The platform presents an editable **Business & Voice Brief** with separate founder and company voice cards.
8. User approves the Brief. No content is produced from unapproved business facts.

### B. Strategy and theme selection — Gate 2

1. Strategist Agent proposes 8–12 themes, each with audience, business goal, profile fit, supporting evidence, sample angles, and risk notes.
2. Trend & Relevance Engine attaches evidence and a confidence score.
3. User selects 3–5 themes for the next 7–14 days and may set required/excluded topics.
4. The system recommends separate cadence and format mixes, initially:
   - founder: 3 posts/week;
   - company: 2 posts/week;
   - adjust downward when the available evidence or approval capacity is weak.
5. User approves the two-week strategy.

### C. Plan and create — Gate 3A and 3B

1. Planner Agent creates Idea Cards: working hook, format, profile, theme, evidence, CTA, asset need, and “why now.”
2. User batch-approves, swaps, or rejects ideas before full production (**Gate 3A**).
3. Producer creates the finished copy and, where selected, image/multi-image/PDF assets.
4. Brand & Claims QA checks voice, factual support, duplicated founder/company content, formatting, visual rules, links, and prohibited claims.
5. User approves, edits, requests a revision, or rejects each finished post (**Gate 3B**).

### D. Schedule and publish

1. Approved posts enter a timezone-aware calendar.
2. The user selects or accepts recommended publishing slots.
3. At publish time, a durable worker validates token health, asset readiness, approval state, and idempotency before calling LinkedIn.
4. Failed publishing retries safely and alerts the user. Unapproved content is held, never published.

### E. Measure, learn, and capture contacts — Gate 4

1. Analytics snapshots are collected at practical intervals such as 24 hours, 72 hours, 7 days, and 30 days.
2. Performance Agent compares like-for-like groups while avoiding conclusions from tiny samples.
3. Comments are classified for sentiment and commercial intent; detected people appear in Contacts with the source post and comment.
4. A weekly review proposes changes to themes, formats, hooks, cadence, CTAs, and profile allocation.
5. User accepts or rejects each change; the strategy is versioned and reversible.

---

## 7. Trend & Relevance Engine

Do not make hashtags the strategy. Hashtags can be suggested as optional post metadata, but the product should rank themes using multiple evidence classes.

### MVP evidence inputs

1. **Business evidence:** product releases, customer problems, FAQs, sales objections, case studies, events, and the founder's experience.
2. **First-party performance:** the user's connected post analytics and historical content that approved APIs make available; users can also import their own export.
3. **Current external signals:** reputable news/RSS, industry publications, official reports, customer-provided source lists, search/news trend providers, and company announcements.
4. **Editorial patterns:** proven LinkedIn-native angle types such as point of view, lesson learned, teardown, myth versus reality, customer story, framework, checklist, benchmark, and build-in-public update.
5. **User feedback:** theme selections, rejections, edits, approvals, and explicit “more/less like this” signals.

### Theme score

Each candidate receives a transparent score:

`Theme score = business relevance + audience pain + evidence freshness + founder authority + content potential + first-party performance − repetition − claim risk`

The user sees the score as plain-language evidence, not a mysterious number. Example:

> Recommended now because this problem appears in 18 support questions, a new industry regulation takes effect this month, and the founder has direct implementation experience. Similar educational posts earned 1.7× the account's median saves.

### Hashtags

Recommend 0–5 specific, relevant hashtags when useful. Do not label a hashtag “trending on LinkedIn” unless LinkedIn provides an approved, measurable source for that claim. Hashtag counts and platform-wide top-post mining are outside MVP.

---

## 8. Content strategy and production

### Profile allocation rules

| Content purpose | Founder profile | Company page |
|---|---:|---:|
| Personal insight, hard-earned lesson, opinion | Primary | Rare |
| Framework or educational expertise | Primary | Supporting adaptation |
| Customer result/case study | Human story and lesson | Formal proof and product detail |
| Product launch/feature | Founder rationale and vision | Primary announcement/demo |
| Hiring and culture | Leadership perspective | Employer brand |
| Event/webinar/report | Personal invitation/commentary | Official promotion |
| Offer or demo CTA | Soft/conversational | Direct/trackable |

### Supported MVP post recipes

- Text-only insight or story.
- Link/article commentary.
- Single branded image with caption.
- Multi-image sequence.
- PDF/document post with 5–10 designed pages.
- Customer proof card or mini case study.
- Founder framework/checklist.
- Company product education or launch post.

### Creative pipeline

1. The Producer creates structured content: hook, body, proof, CTA, optional hashtags, alt text, and creative specification.
2. The system chooses a user asset, brand-template design, chart/diagram, or generated illustration. Real customer/product/founder assets take priority.
3. All typography, logo placement, charts, and PDF pages are rendered programmatically from approved templates; image generation is not trusted to render text.
4. Document posts are exported as accessible, brand-consistent PDFs.
5. QA validates source attribution, unsupported claims, brand rules, prohibited topics, duplicated language, and broken URLs.

### Founder voice safeguards

- Ask for 5–10 examples of the founder's writing, recordings, or transcripts.
- Show which source facts or stories support a post.
- Never invent personal experiences, customer quotes, revenue numbers, or opinions.
- Learn from approved edits, but keep a visible voice-profile change history.

---

## 9. Engagement dashboard and contacts spreadsheet

### Dashboard views

1. **Overview:** posts published, impressions/reach, reactions, comments, reposts, engagement rate, followers/profile actions where available, and qualified contacts.
2. **Per-post analysis:** 24h/72h/7d/30d performance, profile, theme, format, hook, CTA, and comparison with the account median.
3. **Founder vs company:** performance and business outcomes by publishing identity.
4. **Theme and format:** enough-sample comparisons with confidence warnings.
5. **Comments:** sentiment, intent, questions, and response status; no automatic replies in MVP.
6. **Weekly review:** wins, losses, proposed changes, evidence, and approve/reject controls.

### Contacts table

Store only data returned under approved permissions and needed for the user-authorized purpose:

| Field | MVP behavior |
|---|---|
| LinkedIn actor/member identifier | Store permitted URN/ID; do not enrich by scraping. |
| Display name | Store only when returned by the approved API. |
| LinkedIn URL | Construct/show only when permitted and reliably available. |
| Source post | Profile, post URN/URL, theme, and publication date. |
| Source comment | Text, date, sentiment, intent, and confidence. |
| Lead status | New, reviewing, qualified, not a lead, contacted, converted. |
| Owner notes | Editable. |
| Export | CSV and XLSX. |

**Lead rule:** only `interested` or high-confidence buying/question signals should become suggested contacts automatically. Neutral/supportive comments remain searchable in the Comments view but should not pollute the lead list. A human confirms qualification.

---

## 10. Agent and workflow architecture

### Agents

- **Analyst Agent:** ingests allowed sources and drafts the Business & Voice Brief with provenance.
- **Strategist Agent:** proposes themes, profile allocation, cadence, hypotheses, and success measures.
- **Research Agent:** gathers current permitted external evidence and scores relevance.
- **Planner Agent:** builds a balanced two-week calendar and prevents repetition.
- **Copy Producer:** creates founder/company drafts under their separate voice constraints.
- **Creative Producer:** creates structured image, multi-image, and PDF/document specifications.
- **Brand & Claims QA:** validates voice, facts, claims, links, brand rules, and profile fit.
- **Publisher:** schedules and publishes approved posts with token, version, and retry controls.
- **Performance Agent:** ingests analytics, attributes results, and drafts weekly strategy changes.
- **Comment Intelligence Agent:** classifies sentiment and intent, deduplicates people, and suggests contacts.

### Workflow states

`context_draft → context_approved → strategy_draft → strategy_approved → idea_proposed → idea_approved → producing → qa_failed/qa_passed → pending_approval → approved → scheduled → publishing → published/failed/held → measured → reviewed`

All agent outputs are structured records, not free-floating chat. Every decision keeps its source, model/version, prompt/config version, timestamp, confidence, user action, and linked downstream artifacts.

---

## 11. Conceptual technical architecture

### Recommended stack

| Layer | Recommendation |
|---|---|
| Product | Next.js/TypeScript responsive PWA |
| API | Typed REST or tRPC service boundary |
| Database | Managed PostgreSQL with tenant isolation and row-level security |
| Background work | Durable workflow engine or queue-based workers; Redis where required |
| File storage | S3-compatible private storage with short-lived signed access |
| Authentication | Product auth plus separate LinkedIn OAuth connection |
| AI | Provider abstraction for text/reasoning, embeddings, moderation, and optional image generation |
| Retrieval | Tenant-isolated hybrid search over approved knowledge chunks with citations |
| Document/image rendering | Deterministic HTML/SVG/PDF and raster rendering from brand templates |
| Notifications | Email and web push; Slack/Teams later |
| Observability | Structured logs, job traces, API-version monitoring, publishing audit log, and per-tenant AI cost metering |

### Core data entities

`tenants`, `users`, `linkedin_connections`, `publishing_identities`, `company_pages`, `knowledge_sources`, `knowledge_chunks`, `business_brief_versions`, `voice_profiles`, `brand_kits`, `themes`, `theme_evidence`, `strategies`, `strategy_revisions`, `ideas`, `content_drafts`, `creative_assets`, `approval_events`, `schedule_slots`, `published_posts`, `analytics_snapshots`, `comments`, `contact_candidates`, `contacts`, `exports`, `agent_runs`, `decision_ledger`, `notifications`, `audit_events`, `subscriptions`, `usage_events`.

### Security and privacy

- Encrypt OAuth tokens and sensitive tenant data; never expose tokens to the browser.
- Request minimum scopes and show what each permission enables.
- Separate tenant retrieval indexes and storage prefixes.
- Scan uploads, validate MIME types, and prevent documents from overriding agent instructions.
- Support disconnect, revocation, export, retention rules, and deletion.
- Maintain provenance for generated claims and an immutable publishing audit trail.
- Pin and regularly upgrade LinkedIn's versioned APIs; monitor sunsets.

---

## 12. Delivery plan — approximately 10–12 weeks to controlled beta

LinkedIn access approval runs in parallel and can affect the beta sequence.

| Phase | Timing | Deliverable | Exit criteria |
|---|---:|---|---|
| 0. Validation and API access | Week 1 | Confirm exact approved use case; register legal developer app; privacy policy/data deletion flow; apply for Community Management Development tier; create test profiles/page | LinkedIn submission complete; open founder-share flow proven; test page/admin ready |
| 1. Foundation | Weeks 1–2 | Multi-tenant PWA, auth, tenant isolation, storage, workflow/jobs, audit logging, base navigation | Deployed skeleton passes tenant-isolation and job-retry tests |
| 2. Business understanding | Weeks 2–3 | Website/doc ingestion, retrieval, smart questions, Business & Voice Brief, brand kit | Five varied businesses produce accurate, editable briefs with cited sources |
| 3. Strategy and research | Weeks 3–4 | Theme generation, compliant evidence gathering, founder/company allocation, cadence, Gate 2 | Users can approve a defensible two-week strategy without LinkedIn scraping |
| 4. Content production | Weeks 4–6 | Idea Cards, founder/company copy, images/multi-image, PDF document templates, QA, revisions | 80% of design-partner drafts judged publishable after at most one revision |
| 5. Approval, calendar, publishing | Weeks 6–8 | Batch approval, schedule, LinkedIn OAuth, media upload, idempotent publisher, retries/alerts | 50 test posts publish at the correct identity/time with no duplicates |
| 6. Analytics and learning | Weeks 8–9 | Company analytics; founder analytics where granted; snapshots, comparisons, weekly review | Metrics reconcile with LinkedIn UI within documented differences; revisions cite evidence |
| 7. Comments and contacts | Weeks 9–10 | Comment ingestion where permitted, sentiment/intent, confirmation workflow, in-app table, CSV/XLSX export | Seeded and real comments meet agreed precision; no unauthorized enrichment |
| 8. Hardening and beta | Weeks 10–12 | Billing/trial, permissions UX, deletion/export, monitoring, support tools, Standard-tier evidence/demo | 10–15 design partners complete the full approved loop safely |

### Parallel critical path

LinkedIn Community Management access is a product dependency, not a late integration task. Prepare the end-to-end demo, permission explanations, legal organization information, website, privacy policy, terms, data deletion instructions, and screen recording needed for Standard-tier review while building with approved test access.

---

## 13. MVP acceptance criteria

The controlled beta is ready when:

1. A new user can create and approve a grounded Business & Voice Brief in under 20 minutes.
2. Founder and company drafts are clearly distinct and traceable to approved source material.
3. A user can select themes and approve a two-week plan in under 10 minutes.
4. Text, image/multi-image, and PDF/document posts render correctly and publish to the selected identity without duplication.
5. Nothing publishes without a recorded approval.
6. Publishing failures are retried safely and visible to the user.
7. Available metrics reconcile with LinkedIn's UI within documented API differences.
8. Comment classification reaches an agreed precision target on real B2B comments; recommend starting at ≥85% precision for `interested` before automatic contact suggestions are enabled.
9. Contacts can be reviewed, deduplicated, updated, and exported to CSV/XLSX.
10. Every recommendation and strategy revision shows its evidence and can be rejected or reversed.
11. All LinkedIn data collection is covered by granted scopes, consent, retention, and deletion controls.

---

## 14. Post-MVP roadmap

### Phase 2 — quality and collaboration

- Team roles, approval routing, and founder ghostwriter workflow.
- Import recorded calls/transcripts as founder-story inputs.
- More PDF/document templates and data-driven charts.
- Slack/Teams approval notifications.
- Content repurposing from webinars, reports, podcasts, and newsletters.
- Better experiment design and best-time recommendations.
- CRM integrations after contact quality is proven.

### Phase 3 — expanded outcomes

- Multi-founder and multi-company workspaces.
- Employee advocacy drafts with explicit employee approval.
- Campaign-level attribution through trackable links and CRM outcomes.
- Safe comment-reply drafting for human approval, only within approved LinkedIn policy and scopes.
- Additional publishing channels using the same Business Brief and decision ledger.

Explicitly avoid turning the product into a connection-request, DM, engagement-pod, or scraping tool.

---

## 15. Principal risks and mitigations

| Risk | Mitigation |
|---|---|
| Community Management access is delayed or limited | Apply in week 1; build founder sharing and internal planning first; make company management the controlled-beta approval target; use feature flags by granted scope. |
| Hashtag trend promise cannot be delivered compliantly | Rename it Trend & Relevance; rely on first-party performance and permitted current sources; communicate evidence honestly. |
| Founder analytics/comments are unavailable under granted access | Keep founder publishing useful without analytics; allow user-owned exports where permitted; do not claim full founder lead capture until approved. |
| Generic AI voice damages trust | Ground posts in cited facts/stories, maintain separate voices, prefer templates/real assets, learn from explicit edits, require approval. |
| Hallucinated claims or customer stories | Source-level provenance, claims registry, blocked unsupported numbers/quotes, Brand & Claims QA, and human sign-off. |
| Founder/company feeds duplicate one another | Cross-profile similarity check, different angles and CTAs, spacing rules, and shared calendar visibility. |
| Analytics overreact to small samples | Minimum sample sizes, median baselines, outlier caps, and confidence warnings. |
| Comment sentiment creates noisy leads | High-precision threshold, human confirmation, deduplication, negative/spam filters, and no external enrichment. |
| Scheduled post failure or duplicate publishing | Durable idempotent jobs, token checks, API-version tests, retries, publish receipts, and alerts. |
| Sensitive knowledge leaks between customers | Tenant-isolated storage/retrieval, encryption, access control, redaction, and automated isolation tests. |

---

## 16. Decisions requested before implementation

1. **Initial buyer:** founder-led B2B SaaS/professional services is recommended. Confirm or name the first vertical.
2. **Publishing priority:** recommend supporting both identities in the design, but treating founder publishing + company-page controlled beta as separate API milestones.
3. **Trend promise:** approve the compliant “Trend & Relevance” model instead of LinkedIn hashtag-wide trend mining.
4. **Carousel definition:** approve PDF/document posts as the organic LinkedIn carousel format.
5. **Lead threshold:** recommend adding only `interested` and high-confidence commercial questions to Contacts; keep neutral/supportive comments outside the lead list.
6. **Approval policy:** recommend hold-and-notify for unapproved posts, with no MVP autopilot.
7. **Market:** India-first with English/Hinglish support, or global English first. This affects voice testing, templates, billing, and design partners.
8. **Commercial model:** recommend a paid design-partner beta before self-serve pricing; determine whether billing is per connected brand, per publishing identity, or by monthly post volume after observing usage.

Once these decisions are approved, the next artifact should be a PRD with screen specifications, API access checklist, data contracts, and sprint-level engineering backlog.
