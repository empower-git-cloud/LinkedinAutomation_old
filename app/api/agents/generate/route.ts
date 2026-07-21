import { llmComplete, llmConfigured } from "../../../../lib/llm";
import { NextResponse } from "next/server";
import { BuildPeriod, Idea, Post, Theme, WorkspaceData } from "../../../data";
import { loadWorkspace, logEvent, saveWorkspace } from "../../../../lib/workspace";
import { runQaChecks } from "../../../../lib/qa";
import { formatGuidance, linkedinSystemPrompt, playbookContext, sourceContext } from "../../../../lib/linkedin-playbook";
import { analyzePerformance, performanceHint } from "../../../../lib/linkedin-intel";
import { enrichLinkedInProfile, fetchLinkedInTrends, profileProviderConfigured } from "../../../../lib/providers";

export const dynamic = "force-dynamic";

const IDENTITIES = ["Founder", "Company"];
const FORMATS = ["Text", "Image", "Document", "Multi-image"];
const THEME_COLORS = ["#3559e0", "#db6b3f", "#5f8c70", "#9a68b5", "#ad8c34"];

type Mode = "ideas" | "revise" | "analyzeProfile" | "themes" | "buildPlan";

export async function POST(request: Request) {
  const input = await request.json() as { mode?: Mode; themeId?: string; postId?: string; note?: string; days?: number };
  const data = await loadWorkspace();

  if (input.mode === "revise") return reviseDraft(data, input);
  if (input.mode === "analyzeProfile") return analyzeProfile(data);
  if (input.mode === "themes") return suggestThemes(data);
  if (input.mode === "buildPlan") return buildPlan(data, input);

  const selectedThemes = data.themes.filter(theme => theme.selected);
  const requestedTheme = selectedThemes.find(theme => theme.id === input.themeId) ?? selectedThemes[0];
  const themeName = requestedTheme?.name ?? "Customer insight";

  let generated: Idea[];
  let provider: "OpenAI" | "Built-in fallback" = "Built-in fallback";
  if (llmConfigured()) {
    try { generated = await generateIdeasWithOpenAI(data, themeName); provider = "OpenAI"; }
    catch { generated = fallbackIdeas(data, themeName); }
  } else {
    generated = fallbackIdeas(data, themeName);
  }
  data.ideas = [...generated, ...data.ideas];
  await saveWorkspace(data);
  return NextResponse.json({ data, generated, provider });
}

// ---- Individual: analyse the profile into role + experience across companies ----

async function analyzeProfile(data: WorkspaceData) {
  if (data.workspace.accountType !== "Individual") {
    return NextResponse.json({ error: "Profile analysis is only for individual workspaces." }, { status: 409 });
  }
  const profile = data.individual;
  if (!profile.linkedInUrl.trim() && !profile.rawProfile.trim()) {
    return NextResponse.json({ error: "Add your LinkedIn URL, or paste your profile / resume text, first." }, { status: 400 });
  }

  // 1) A configured compliant provider is the only way to enrich straight from a URL.
  const enriched = await enrichLinkedInProfile(profile.linkedInUrl);
  if (enriched) {
    data.individual = { ...profile, fullName: enriched.fullName ?? profile.fullName, headline: enriched.headline ?? profile.headline, role: enriched.role ?? profile.role, experienceSummary: enriched.experienceSummary ?? profile.experienceSummary, companies: enriched.companies?.length ? enriched.companies : profile.companies, analyzedAt: new Date().toISOString(), analyzedVia: "provider" };
    logEvent(data, "system", "Enriched LinkedIn profile via configured data provider.");
    await saveWorkspace(data);
    return NextResponse.json({ data, provider: "Data provider" });
  }

  // 2) Otherwise extract from the pasted profile/resume text with the LLM.
  let analyzedVia: "ai" | "manual" = "manual";
  let analysis = fallbackProfileAnalysis(profile);
  if (llmConfigured() && (profile.rawProfile.trim() || profile.manualInput.trim() || profile.headline.trim())) {
    try { analysis = await analyzeProfileWithOpenAI(profile); analyzedVia = "ai"; }
    catch { analysis = fallbackProfileAnalysis(profile); }
  }
  data.individual = { ...profile, ...analysis, analyzedAt: new Date().toISOString(), analyzedVia };
  if (!data.workspace.name.trim() && analysis.fullName) data.workspace.name = analysis.fullName;
  logEvent(data, "system", `Analysed profile (${analyzedVia === "ai" ? "AI from your pasted profile" : "manual"}). Role: ${analysis.role}.`);
  await saveWorkspace(data);
  return NextResponse.json({ data, provider: analyzedVia === "ai" ? "OpenAI" : "Manual", providerConfigured: profileProviderConfigured() });
}

async function analyzeProfileWithOpenAI(profile: WorkspaceData["individual"]) {
  const text = await llmComplete(
    "You extract a structured professional summary from a person's own pasted LinkedIn profile or resume. Use ONLY what is given — never invent employers, titles, dates, or achievements. Return only valid JSON.",
    `Return JSON {role, experienceSummary (2-3 sentences on their career across companies), companies (array of employer names found)}. Headline: ${profile.headline}. Pasted profile/resume: ${profile.rawProfile || "(none)"}. Extra notes: ${profile.manualInput || "(none)"}.`,
  );
  const parsed = JSON.parse(text.replace(/^```json\s*/i, "").replace(/```$/i, "").trim()) as Record<string, unknown>;
  return {
    role: typeof parsed.role === "string" ? parsed.role.slice(0, 200) : profile.role,
    experienceSummary: typeof parsed.experienceSummary === "string" ? parsed.experienceSummary.slice(0, 800) : profile.experienceSummary,
    companies: Array.isArray(parsed.companies) ? parsed.companies.filter((c): c is string => typeof c === "string").slice(0, 12) : profile.companies,
    fullName: profile.fullName,
    headline: profile.headline,
  };
}

function fallbackProfileAnalysis(profile: WorkspaceData["individual"]) {
  // Pull likely company names out of pasted text: 1–2 capitalised words after "at"/"@",
  // stopping at lowercase conjunctions, punctuation or digits.
  const companies = [...new Set([...profile.rawProfile.matchAll(/(?:\bat|@)\s+([A-Z][A-Za-z0-9&.\-]+(?:\s[A-Z][A-Za-z0-9&.\-]+)?)/g)].map(m => m[1].replace(/\.\s.*$/, "").replace(/[.,]$/, "").trim()))].slice(0, 12);
  return {
    role: profile.role || profile.headline || "Professional sharing lessons from their field",
    experienceSummary: profile.experienceSummary || (profile.rawProfile ? profile.rawProfile.slice(0, 600) : "Add your profile text or connect a data provider to enrich this."),
    companies: companies.length ? companies : profile.companies,
    fullName: profile.fullName,
    headline: profile.headline,
  };
}

// ---- Theme suggestion: source + real first-party data + optional live trends ----

async function suggestThemes(data: WorkspaceData) {
  const individual = data.workspace.accountType === "Individual";
  const insight = analyzePerformance(data);
  const trends = await fetchLinkedInTrends(individual ? data.individual.role : data.workspace.industry);
  let provider: "OpenAI" | "Built-in fallback" = "Built-in fallback";
  let themes = fallbackThemes(data, individual, insight, trends);
  if (llmConfigured()) {
    try { themes = await suggestThemesWithOpenAI(data, individual, insight, trends); provider = "OpenAI"; }
    catch { themes = fallbackThemes(data, individual, insight, trends); }
  }
  data.themes = themes;
  data.workspace.strategyApproved = false;
  const trendNote = trends ? " + live trend data" : "";
  logEvent(data, "system", `Suggested ${themes.length} themes from ${individual ? "your profile" : "your business"}${insight.hasEnoughData ? " + your own performance" : ""}${trendNote} (${provider}).`);
  await saveWorkspace(data);
  return NextResponse.json({ data, provider, usedFirstParty: insight.hasEnoughData, usedTrends: Boolean(trends) });
}

async function suggestThemesWithOpenAI(data: WorkspaceData, individual: boolean, insight: ReturnType<typeof analyzePerformance>, trends: string[] | null): Promise<Theme[]> {
  const text = await llmComplete(
    linkedinSystemPrompt("You propose content themes, each justified by what actually performs on LinkedIn. Return only valid JSON."),
    `Suggest exactly 5 themes as a JSON array. Each: name, description (one line), whatsWorking (one line naming the LinkedIn pattern/format that performs for this theme), score (60-99). ${sourceContext(data, individual)} ${insight.hasEnoughData ? `The account's own data: ${insight.summary} ${performanceHint(insight)}` : "No first-party performance yet — justify from proven LinkedIn patterns."} ${trends ? `Current trend signals: ${trends.join("; ")}.` : ""}`,
  );
  const parsed = JSON.parse(text.replace(/^```json\s*/i, "").replace(/```$/i, "").trim()) as Record<string, unknown>[];
  const valid = (Array.isArray(parsed) ? parsed : []).filter(item => typeof item.name === "string" && typeof item.description === "string");
  if (valid.length === 0) throw new Error("No valid themes returned");
  return valid.slice(0, 5).map((item, index) => ({
    id: crypto.randomUUID(),
    name: (item.name as string).slice(0, 120),
    description: (item.description as string).slice(0, 300),
    whatsWorking: typeof item.whatsWorking === "string" ? item.whatsWorking.slice(0, 300) : whatsWorkingFor(index, insight, trends),
    score: typeof item.score === "number" ? Math.max(60, Math.min(99, Math.round(item.score))) : 90 - index * 3,
    selected: false,
    evidence: individual ? "Grounded in your role and experience" : "Grounded in your website and knowledge base",
    fit: individual ? "Founder" : (index % 2 === 0 ? "Both" : "Company"),
    color: THEME_COLORS[index % THEME_COLORS.length],
  }));
}

function whatsWorkingFor(index: number, insight: ReturnType<typeof analyzePerformance>, trends: string[] | null) {
  if (trends && trends[index]) return `Trending now: ${trends[index]}.`;
  if (insight.hasEnoughData && insight.bestFormat) return `${insight.bestFormat} posts are performing best for you right now.`;
  const patterns = ["Point-of-view posts with a clear opinion earn the most comments.", "Lesson/mistake hooks earn the highest save and comment rates.", "Frameworks and checklists get saved and reshared.", "Short, specific stories beat long essays.", "Contrarian-but-defensible takes drive comments, which drive reach."];
  return patterns[index % patterns.length];
}

function fallbackThemes(data: WorkspaceData, individual: boolean, insight: ReturnType<typeof analyzePerformance>, trends: string[] | null): Theme[] {
  const seeds = individual
    ? [
        { name: "Lessons from the field", description: `Hard-earned lessons from ${data.individual.role || "your career"}.` },
        { name: "How I actually work", description: "Behind-the-scenes of your process and decisions." },
        { name: "Contrarian takes", description: "Defensible opinions that challenge the default in your field." },
        { name: "Career turning points", description: "Moments across your companies that changed how you operate." },
        { name: "Frameworks I rely on", description: "Repeatable checklists and mental models you use." },
      ]
    : [
        { name: "Customer problems we solve", description: "The real problems your product removes, in the customer's words." },
        { name: "Proof and outcomes", description: "Results and evidence that build credibility." },
        { name: "Category education", description: "Teach the market how to think about your space." },
        { name: "Build in public", description: "Product decisions, launches and the reasoning behind them." },
        { name: "Founder point of view", description: "The leadership perspective behind the company." },
      ];
  return seeds.map((seed, index) => ({
    id: crypto.randomUUID(),
    name: seed.name,
    description: seed.description,
    whatsWorking: whatsWorkingFor(index, insight, trends),
    score: 92 - index * 4,
    selected: false,
    evidence: individual ? "Grounded in your role and experience" : "Grounded in your website and knowledge base",
    fit: individual ? "Founder" : (index % 2 === 0 ? "Both" : "Company"),
    color: THEME_COLORS[index % THEME_COLORS.length],
  }));
}

// ---- Build a 1 / 3 / 7-day plan around a selected theme ----

async function buildPlan(data: WorkspaceData, input: { themeId?: string; days?: number }) {
  const days = ([1, 3, 7] as BuildPeriod[]).includes(input.days as BuildPeriod) ? input.days as BuildPeriod : 3;
  const theme = data.themes.find(t => t.id === input.themeId && t.selected) ?? data.themes.find(t => t.selected);
  if (!theme) return NextResponse.json({ error: "Select a theme before building content." }, { status: 409 });

  const individual = data.workspace.accountType === "Individual";
  const insight = analyzePerformance(data);
  let ideas: PlannedPost[] = [];
  let provider: "OpenAI" | "Built-in fallback" = "Built-in fallback";
  if (llmConfigured()) {
    try { ideas = await planWithOpenAI(data, theme, days, individual, insight); provider = "OpenAI"; }
    catch { ideas = fallbackPlan(theme, days, individual); }
  } else {
    ideas = fallbackPlan(theme, days, individual);
  }

  const created: Post[] = [];
  for (let index = 0; index < ideas.length; index += 1) {
    const post = postFromPlanned(ideas[index], index, theme, individual);
    const result = await runQaChecks(post, data);
    post.qa = result.qa;
    post.qaNotes = result.notes;
    created.push(post);
  }
  data.posts = [...created, ...data.posts];
  logEvent(data, "system", `Built a ${days}-day plan (${created.length} posts) for “${theme.name}” (${provider}).`);
  await saveWorkspace(data);
  return NextResponse.json({ data, created: created.length, days, provider });
}

type PlannedPost = { identity: Idea["identity"]; format: Post["format"]; body: string; hashtags: string[]; cta: string; hook: string };

async function planWithOpenAI(data: WorkspaceData, theme: Theme, days: number, individual: boolean, insight: ReturnType<typeof analyzePerformance>): Promise<PlannedPost[]> {
  const count = days === 1 ? 1 : days === 3 ? 3 : 5;
  const text = await llmComplete(
    linkedinSystemPrompt("You write finished, ready-to-post LinkedIn posts. Return only valid JSON."),
    `Write exactly ${count} distinct LinkedIn posts on ONE theme as a JSON array. Each object: identity (${individual ? "always Founder" : "Founder or Company"}), format (Text, Image, Document, or Multi-image), hook (the first line, under 210 chars), body (the full post, formatted with short lines and white space, hook as the first line, ending in one genuine question), hashtags (array of 3-5 specific tags, no # needed), cta. Theme: ${theme.name} — ${theme.description}. What's working: ${theme.whatsWorking}. ${formatGuidance("Text")} ${playbookContext()} ${sourceContext(data, individual)} ${performanceHint(insight)}`,
  );
  const parsed = JSON.parse(text.replace(/^```json\s*/i, "").replace(/```$/i, "").trim()) as Record<string, unknown>[];
  const valid = (Array.isArray(parsed) ? parsed : []).filter(item => typeof item.body === "string" && (item.body as string).length > 30);
  if (valid.length === 0) throw new Error("No valid plan returned");
  return valid.slice(0, count).map(item => ({
    identity: individual ? "Founder" : (IDENTITIES.includes(item.identity as string) ? item.identity as Idea["identity"] : "Founder"),
    format: FORMATS.includes(item.format as string) ? item.format as Post["format"] : "Text",
    hook: typeof item.hook === "string" ? item.hook.slice(0, 210) : (item.body as string).split("\n")[0].slice(0, 210),
    body: (item.body as string).slice(0, 3000),
    hashtags: Array.isArray(item.hashtags) ? item.hashtags.filter((t): t is string => typeof t === "string").slice(0, 5).map(t => t.startsWith("#") ? t : `#${t.replace(/\s+/g, "")}`) : [],
    cta: typeof item.cta === "string" ? item.cta.slice(0, 200) : "What's your take?",
  }));
}

function fallbackPlan(theme: Theme, days: number, individual: boolean): PlannedPost[] {
  const count = days === 1 ? 1 : days === 3 ? 3 : 5;
  const templates = [
    { format: "Text" as const, hook: `Most people get ${theme.name.toLowerCase()} exactly backwards.`, angle: "Here's the version that actually holds up in practice — and the one mistake that makes it fall apart." },
    { format: "Document" as const, hook: `${theme.name}, as a checklist you can actually use.`, angle: "One decision per page. If you can't answer it, that's the gap." },
    { format: "Text" as const, hook: `A lesson about ${theme.name.toLowerCase()} I learned the hard way.`, angle: "One specific moment, what it cost, and what I'd do differently now." },
    { format: "Image" as const, hook: `A simple test for ${theme.name.toLowerCase()}.`, angle: "If you can't explain the failure case, you don't have a plan yet." },
    { format: "Text" as const, hook: `What changed how I think about ${theme.name.toLowerCase()}.`, angle: "A contrarian-but-defensible take, and why the default advice misleads people." },
  ];
  return templates.slice(0, count).map((template) => ({
    identity: individual ? "Founder" : (template.format === "Document" ? "Company" : "Founder"),
    format: template.format,
    hook: template.hook,
    body: `${template.hook}\n\n${template.angle}\n\nThe short version: start where the evidence is clearest, not where it's loudest.\n\nWhat's the one thing you'd add here?`,
    hashtags: hashtagsFor(theme.name),
    cta: "What would you add?",
  }));
}

function hashtagsFor(theme: string) {
  const stop = new Set(["from", "the", "and", "for", "with", "your", "into", "that", "this", "how", "why", "what"]);
  const base = theme.toLowerCase().replace(/[^a-z0-9 ]/g, "").split(/\s+/).filter(word => word.length > 3 && !stop.has(word)).slice(0, 2).map(word => `#${word}`);
  return [...new Set([...base, "#LinkedIn", "#Leadership", "#Growth"])].slice(0, 4);
}

function postFromPlanned(planned: PlannedPost, dayOffset: number, theme: Theme, individual: boolean): Post {
  const slot = new Date();
  slot.setUTCDate(slot.getUTCDate() + dayOffset + 1);
  slot.setUTCHours(9, 0, 0, 0);
  return {
    id: crypto.randomUUID(),
    identity: individual ? "Founder" : planned.identity,
    format: planned.format,
    theme: theme.name,
    title: planned.hook,
    hook: planned.hook,
    body: planned.body,
    cta: planned.cta,
    status: "Needs approval",
    scheduledFor: slot.toISOString(),
    why: `Part of your ${theme.name} plan. What's working: ${theme.whatsWorking ?? "proven LinkedIn patterns"}.`,
    hashtags: planned.hashtags,
    altText: `${planned.format} post about ${theme.name}.`,
    creativeSlides: planned.format !== "Text" ? [
      { heading: planned.hook.slice(0, 60), copy: theme.description },
      { heading: "01", copy: "Set up the real problem" },
      { heading: "02", copy: "Show the shift" },
      { heading: "Next step", copy: planned.cta },
    ].slice(0, planned.format === "Image" ? 1 : planned.format === "Multi-image" ? 3 : 4) : undefined,
  };
}

// ---- Idea generation (playbook-driven) + revision ----

async function generateIdeasWithOpenAI(data: WorkspaceData, theme: string): Promise<Idea[]> {
  const individual = data.workspace.accountType === "Individual";
  const insight = analyzePerformance(data);
  const text = await llmComplete(
    linkedinSystemPrompt("You propose distinct content ideas. Return only valid JSON."),
    `Create exactly 4 content ideas as a JSON array. Each: identity (${individual ? "always Founder" : "Founder or Company"}), format (Text, Image, Document, or Multi-image), hook (first line, <210 chars), angle, evidence, cta. Theme: ${theme}. ${playbookContext()} ${sourceContext(data, individual)} ${performanceHint(insight)} Blocked language: ${data.brief.banned.join("; ")}.`,
  );
  const parsed = JSON.parse(text.replace(/^```json\s*/i, "").replace(/```$/i, "").trim()) as Record<string, unknown>[];
  const valid = (Array.isArray(parsed) ? parsed : []).filter(item =>
    FORMATS.includes(item.format as string) && typeof item.hook === "string" && typeof item.angle === "string" && typeof item.evidence === "string" && typeof item.cta === "string");
  if (valid.length === 0) throw new Error("Model returned no valid ideas");
  return valid.slice(0, 4).map(item => ({
    id: crypto.randomUUID(),
    identity: individual ? "Founder" : (IDENTITIES.includes(item.identity as string) ? item.identity as Idea["identity"] : "Founder"),
    format: item.format as Idea["format"],
    hook: (item.hook as string).slice(0, 300),
    angle: (item.angle as string).slice(0, 600),
    evidence: (item.evidence as string).slice(0, 400),
    cta: (item.cta as string).slice(0, 300),
    theme,
    status: "Proposed" as const,
  }));
}

function fallbackIdeas(data: WorkspaceData, theme: string): Idea[] {
  const individual = data.workspace.accountType === "Individual";
  const proof = data.brief.proof[0] ?? "your own experience";
  return [
    { id: crypto.randomUUID(), identity: "Founder", theme, format: "Text", hook: `The uncomfortable truth about ${theme.toLowerCase()}.`, angle: "One specific lesson, the assumption that was wrong, and what changed.", evidence: "Your approved voice and source", cta: "What assumption did you change recently?", status: "Proposed" },
    { id: crypto.randomUUID(), identity: individual ? "Founder" : "Company", theme, format: "Document", hook: `${theme}: the checklist I wish I'd had.`, angle: "A diagnostic sequence, one action per page.", evidence: `Your source plus ${proof}`, cta: "Save it and score your current process.", status: "Proposed" },
    { id: crypto.randomUUID(), identity: "Founder", theme, format: "Image", hook: `One question that reframes ${theme.toLowerCase()}.`, angle: "A concise point of view on a clean proof card.", evidence: "Selected theme and approved vocabulary", cta: "How would you answer it?", status: "Proposed" },
    { id: crypto.randomUUID(), identity: individual ? "Founder" : "Company", theme, format: "Multi-image", hook: `From scattered signal to one decision.`, angle: "A before/process/after sequence.", evidence: "Approved positioning and proof", cta: "Want the full workflow?", status: "Proposed" },
  ];
}

async function reviseDraft(data: WorkspaceData, input: { postId?: string; note?: string }) {
  const post = data.posts.find(item => item.id === input.postId);
  if (!post || post.status !== "Revision requested") {
    return NextResponse.json({ error: "Only revision-requested posts can be revised." }, { status: 409 });
  }
  const note = (input.note ?? post.revisionNote ?? "Improve the draft.").slice(0, 500);
  let body = post.body;
  let provider: "OpenAI" | "Built-in fallback" = "Built-in fallback";
  if (llmConfigured()) {
    try { body = await reviseWithOpenAI(data, post, note); provider = "OpenAI"; }
    catch { body = fallbackRevision(post.body, note); }
  } else {
    body = fallbackRevision(post.body, note);
  }
  post.versions = [{ id: crypto.randomUUID(), body: post.body, note: `Before revision: ${note}`, createdAt: new Date().toISOString() }, ...(post.versions ?? [])].slice(0, 20);
  post.body = body;
  post.status = "Needs approval";
  const result = await runQaChecks(post, data);
  post.qa = result.qa;
  post.qaNotes = result.notes;
  logEvent(data, "system", `Draft revised (${provider}): ${post.title}`, post.id);
  await saveWorkspace(data);
  return NextResponse.json({ data, provider });
}

async function reviseWithOpenAI(data: WorkspaceData, post: Post, note: string) {
  const text = await llmComplete(
    linkedinSystemPrompt(`Keep the ${post.identity === "Founder" ? data.brief.founderVoice || "founder" : data.brief.companyVoice || "company"} voice. Return only the revised post text, no preamble.`),
    `Revise this LinkedIn draft per the request. ${playbookContext()} Reviewer's request: "${note}".\n\nDraft:\n${post.body}`,
  );
  const cleaned = text.trim();
  if (cleaned.length < 20) throw new Error("Revision came back empty");
  return cleaned.slice(0, 3000);
}

function fallbackRevision(body: string, note: string) {
  if (/short|tight|brief|concise|trim/i.test(note)) {
    const paragraphs = body.split(/\n\n+/);
    return paragraphs.slice(0, Math.max(1, Math.ceil(paragraphs.length / 2))).join("\n\n");
  }
  return body;
}
