import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";
import { BuildPeriod, Idea, Post, Theme, WorkspaceData } from "../../../data";
import { loadWorkspace, logEvent, saveWorkspace } from "../../../../lib/workspace";
import { runQaChecks } from "../../../../lib/qa";

export const dynamic = "force-dynamic";

const IDENTITIES = ["Founder", "Company"];
const FORMATS = ["Text", "Image", "Document", "Multi-image"];
const THEME_COLORS = ["#3559e0", "#db6b3f", "#5f8c70", "#9a68b5", "#ad8c34"];

// Proven, LinkedIn-native angle patterns. This is our compliant "what's working"
// signal — editorial patterns plus the user's own first-party performance —
// never scraped feeds or an unofficial trending API.
const WORKING_ANGLES = [
  "First-person point-of-view posts (a clear opinion + a lesson) consistently outperform announcements on LinkedIn.",
  "\"Lesson learned\" and \"mistake I made\" hooks earn the highest save and comment rates for personal brands.",
  "Practical frameworks and numbered checklists get saved and reshared far more than generic advice.",
  "Short, specific stories with one concrete takeaway beat long thought-leadership essays.",
  "Contrarian-but-defensible takes drive comments, which drive reach.",
];

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

  let generated: Idea[];
  let provider: "OpenAI" | "Built-in fallback" = "Built-in fallback";
  if (env.OPENAI_API_KEY) {
    try {
      generated = await generateWithOpenAI(data, requestedTheme?.name ?? "Customer insight");
      provider = "OpenAI";
    } catch {
      generated = fallbackIdeas(data, requestedTheme?.name ?? "Customer insight");
    }
  } else {
    generated = fallbackIdeas(data, requestedTheme?.name ?? "Customer insight");
  }

  data.ideas = [...generated, ...data.ideas];
  await saveWorkspace(data);
  return NextResponse.json({ data, generated, provider });
}

// ---- Individual: analyse the connected LinkedIn profile into role + experience ----

async function analyzeProfile(data: WorkspaceData) {
  if (data.workspace.accountType !== "Individual") {
    return NextResponse.json({ error: "Profile analysis is only for individual workspaces." }, { status: 409 });
  }
  const profile = data.individual;
  if (!profile.linkedInUrl.trim()) {
    return NextResponse.json({ error: "Add your LinkedIn profile URL first." }, { status: 400 });
  }
  let provider: "OpenAI" | "Built-in fallback" = "Built-in fallback";
  let analysis = fallbackProfileAnalysis(profile);
  if (env.OPENAI_API_KEY && (profile.manualInput.trim() || profile.headline.trim())) {
    try {
      analysis = await analyzeProfileWithOpenAI(profile);
      provider = "OpenAI";
    } catch {
      analysis = fallbackProfileAnalysis(profile);
    }
  }
  data.individual = { ...profile, ...analysis, analyzedAt: new Date().toISOString() };
  if (!data.workspace.name.trim() && analysis.fullName) data.workspace.name = analysis.fullName;
  logEvent(data, "system", `Analysed LinkedIn profile (${provider}). Role: ${analysis.role}.`);
  await saveWorkspace(data);
  return NextResponse.json({ data, provider });
}

async function analyzeProfileWithOpenAI(profile: WorkspaceData["individual"]) {
  const text = await callOpenAI(
    "You extract a professional summary from the details a person provides about their own LinkedIn profile. Never invent employers, titles, dates or achievements that are not given. Return only valid JSON.",
    `Return a JSON object with role (their current primary role), experienceSummary (2-3 sentences on their career across companies), and companies (array of company names you can identify). Profile URL: ${profile.linkedInUrl}. Headline: ${profile.headline}. What they told us: ${profile.manualInput || "(nothing extra provided)"}.`,
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
  const role = profile.role || profile.headline || "Professional sharing lessons from their field";
  return {
    role,
    experienceSummary: profile.experienceSummary || (profile.manualInput ? profile.manualInput.slice(0, 800) : `Experience captured from ${profile.linkedInUrl}. Add manual notes to enrich this summary.`),
    companies: profile.companies,
    fullName: profile.fullName,
    headline: profile.headline,
  };
}

// ---- Theme suggestion grounded in the right source + "what's working" ----

async function suggestThemes(data: WorkspaceData) {
  const individual = data.workspace.accountType === "Individual";
  let provider: "OpenAI" | "Built-in fallback" = "Built-in fallback";
  let themes = fallbackThemes(data, individual);
  if (env.OPENAI_API_KEY) {
    try {
      themes = await suggestThemesWithOpenAI(data, individual);
      provider = "OpenAI";
    } catch {
      themes = fallbackThemes(data, individual);
    }
  }
  data.themes = themes;
  data.workspace.strategyApproved = false;
  logEvent(data, "system", `Suggested ${themes.length} themes from ${individual ? "your profile" : "your website and knowledge base"} + what's working on LinkedIn (${provider}).`);
  await saveWorkspace(data);
  return NextResponse.json({ data, provider });
}

function sourceContext(data: WorkspaceData, individual: boolean) {
  if (individual) {
    const p = data.individual;
    return `This person's role: ${p.role}. Experience: ${p.experienceSummary}. Companies: ${p.companies.join(", ") || "(unknown)"}. What they want to post about: ${p.manualInput || "(open)"}.`;
  }
  return `Business positioning: ${data.brief.positioning}. Audience: ${data.brief.audience}. Website: ${data.workspace.website}. ${knowledgeContext(data)}`;
}

async function suggestThemesWithOpenAI(data: WorkspaceData, individual: boolean): Promise<Theme[]> {
  const text = await callOpenAI(
    "You are a LinkedIn content strategist. Suggest content themes grounded ONLY in the supplied source. For each theme also state what is currently working on LinkedIn that makes it a good bet, using well-known editorial patterns (point-of-view, lesson-learned, framework, teardown, contrarian take). Never invent facts. Return only valid JSON.",
    `Suggest exactly 5 themes as a JSON array. Each object: name, description (one line), whatsWorking (one line on the LinkedIn pattern that performs for this theme), score (60-99 relevance). ${sourceContext(data, individual)}`,
  );
  const parsed = JSON.parse(text.replace(/^```json\s*/i, "").replace(/```$/i, "").trim()) as Record<string, unknown>[];
  const valid = (Array.isArray(parsed) ? parsed : []).filter(item => typeof item.name === "string" && typeof item.description === "string");
  if (valid.length === 0) throw new Error("No valid themes returned");
  return valid.slice(0, 5).map((item, index) => ({
    id: crypto.randomUUID(),
    name: (item.name as string).slice(0, 120),
    description: (item.description as string).slice(0, 300),
    whatsWorking: typeof item.whatsWorking === "string" ? item.whatsWorking.slice(0, 300) : WORKING_ANGLES[index % WORKING_ANGLES.length],
    score: typeof item.score === "number" ? Math.max(60, Math.min(99, Math.round(item.score))) : 90 - index * 3,
    selected: false,
    evidence: individual ? "Grounded in your role and experience" : "Grounded in your website and knowledge base",
    fit: individual ? "Founder" : (index % 2 === 0 ? "Both" : "Company"),
    color: THEME_COLORS[index % THEME_COLORS.length],
  }));
}

function fallbackThemes(data: WorkspaceData, individual: boolean): Theme[] {
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
    whatsWorking: WORKING_ANGLES[index % WORKING_ANGLES.length],
    score: 92 - index * 4,
    selected: false,
    evidence: individual ? "Grounded in your role and experience" : "Grounded in your website and knowledge base",
    fit: individual ? "Founder" : (index % 2 === 0 ? "Both" : "Company"),
    color: THEME_COLORS[index % THEME_COLORS.length],
  }));
}

// ---- Build a 1 / 3 / 7-day content plan around a selected theme ----

async function buildPlan(data: WorkspaceData, input: { themeId?: string; days?: number }) {
  const days = ([1, 3, 7] as BuildPeriod[]).includes(input.days as BuildPeriod) ? input.days as BuildPeriod : 3;
  const theme = data.themes.find(t => t.id === input.themeId && t.selected) ?? data.themes.find(t => t.selected);
  if (!theme) return NextResponse.json({ error: "Select a theme before building content." }, { status: 409 });

  const individual = data.workspace.accountType === "Individual";
  let ideas: Omit<Idea, "id" | "status">[] = [];
  let provider: "OpenAI" | "Built-in fallback" = "Built-in fallback";
  if (env.OPENAI_API_KEY) {
    try {
      ideas = await planWithOpenAI(data, theme, days, individual);
      provider = "OpenAI";
    } catch {
      ideas = fallbackPlan(theme, days, individual);
    }
  } else {
    ideas = fallbackPlan(theme, days, individual);
  }

  const created: Post[] = [];
  for (let index = 0; index < ideas.length; index += 1) {
    const idea = ideas[index];
    const post = postFromIdea(idea, index, individual);
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

async function planWithOpenAI(data: WorkspaceData, theme: Theme, days: number, individual: boolean): Promise<Omit<Idea, "id" | "status">[]> {
  const count = days === 1 ? 1 : days === 3 ? 3 : 5;
  const text = await callOpenAI(
    "You are a LinkedIn content planner. Produce a coherent multi-post plan on one theme, each post distinct. Never invent facts. Return only valid JSON.",
    `Return exactly ${count} posts as a JSON array. Each object: identity (${individual ? "always Founder" : "Founder or Company"}), format (Text, Image, Document, or Multi-image), hook, angle, evidence, cta. Theme: ${theme.name} — ${theme.description}. What's working: ${theme.whatsWorking}. ${sourceContext(data, individual)}`,
  );
  const parsed = JSON.parse(text.replace(/^```json\s*/i, "").replace(/```$/i, "").trim()) as Record<string, unknown>[];
  const valid = (Array.isArray(parsed) ? parsed : []).filter(item => typeof item.hook === "string" && typeof item.angle === "string");
  if (valid.length === 0) throw new Error("No valid plan returned");
  return valid.slice(0, count).map(item => ({
    identity: individual ? "Founder" : (IDENTITIES.includes(item.identity as string) ? item.identity as Idea["identity"] : "Founder"),
    format: FORMATS.includes(item.format as string) ? item.format as Idea["format"] : "Text",
    theme: theme.name,
    hook: (item.hook as string).slice(0, 300),
    angle: (item.angle as string).slice(0, 600),
    evidence: typeof item.evidence === "string" ? item.evidence.slice(0, 400) : theme.evidence,
    cta: typeof item.cta === "string" ? item.cta.slice(0, 300) : "Share your take in the comments.",
  }));
}

function fallbackPlan(theme: Theme, days: number, individual: boolean): Omit<Idea, "id" | "status">[] {
  const count = days === 1 ? 1 : days === 3 ? 3 : 5;
  const templates = [
    { format: "Text" as const, hook: `The one thing most people get wrong about ${theme.name.toLowerCase()}`, angle: "Open with a specific, defensible point of view and one takeaway." },
    { format: "Document" as const, hook: `${theme.name}: a practical checklist`, angle: "One diagnostic per page that the reader can act on." },
    { format: "Text" as const, hook: `A lesson I learned about ${theme.name.toLowerCase()}`, angle: "Tell one specific story with a clear before/after." },
    { format: "Image" as const, hook: `A simple test for ${theme.name.toLowerCase()}`, angle: "Pair a short point of view with a branded proof card." },
    { format: "Text" as const, hook: `What changed how I think about ${theme.name.toLowerCase()}`, angle: "A contrarian-but-defensible take that invites discussion." },
  ];
  return templates.slice(0, count).map((template, index) => ({
    identity: individual ? "Founder" : (index % 3 === 1 ? "Company" : "Founder"),
    format: template.format,
    theme: theme.name,
    hook: template.hook,
    angle: template.angle,
    evidence: theme.whatsWorking ?? theme.evidence,
    cta: "What is your experience? Share it in the comments.",
  }));
}

/** Turn a planned idea into a schedulable draft, one per day starting tomorrow at 09:00 UTC. */
function postFromIdea(idea: Omit<Idea, "id" | "status">, dayOffset: number, individual: boolean): Post {
  const slot = new Date();
  slot.setUTCDate(slot.getUTCDate() + dayOffset + 1);
  slot.setUTCHours(9, 0, 0, 0);
  const body = `${idea.hook}\n\n${idea.angle}\n\n${idea.evidence}.\n\n${idea.cta}`;
  return {
    id: crypto.randomUUID(),
    identity: individual ? "Founder" : idea.identity,
    format: idea.format,
    theme: idea.theme,
    title: idea.hook,
    hook: idea.hook,
    body,
    cta: idea.cta,
    status: "Needs approval",
    scheduledFor: slot.toISOString(),
    why: `Part of your content plan for “${idea.theme}”. ${idea.evidence}.`,
    hashtags: [],
    altText: `${idea.format} post about ${idea.theme}.`,
    creativeSlides: idea.format !== "Text" ? [
      { heading: idea.hook, copy: idea.angle },
      { heading: "01", copy: "Set up the problem" },
      { heading: "02", copy: "Show the shift" },
      { heading: "Next step", copy: idea.cta },
    ].slice(0, idea.format === "Image" ? 1 : idea.format === "Multi-image" ? 3 : 4) : undefined,
  };
}

// ---- Existing idea + revision flows (unchanged behaviour) ----

async function reviseDraft(data: WorkspaceData, input: { postId?: string; note?: string }) {
  const post = data.posts.find(item => item.id === input.postId);
  if (!post || post.status !== "Revision requested") {
    return NextResponse.json({ error: "Only revision-requested posts can be revised." }, { status: 409 });
  }
  const note = (input.note ?? post.revisionNote ?? "Improve the draft.").slice(0, 500);
  let body = post.body;
  let provider: "OpenAI" | "Built-in fallback" = "Built-in fallback";
  if (env.OPENAI_API_KEY) {
    try {
      body = await reviseWithOpenAI(data, post, note);
      provider = "OpenAI";
    } catch {
      body = fallbackRevision(post.body, note);
    }
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

function knowledgeContext(data: WorkspaceData) {
  const readable = data.sources.filter(source => source.readable && source.textPreview);
  if (readable.length === 0) return "";
  return `Knowledge sources (use only these facts, cite nothing else): ${readable.map(source => `[${source.name}] ${source.textPreview}`).join(" | ").slice(0, 2400)}.`;
}

async function callOpenAI(systemPrompt: string, userPrompt: string) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { "authorization": `Bearer ${env.OPENAI_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({
      model: env.OPENAI_MODEL ?? "gpt-5.4-mini",
      input: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_output_tokens: 1800,
    }),
  });
  if (!response.ok) throw new Error(`OpenAI request failed: ${response.status}`);
  const result = await response.json() as { output?: { content?: { type?: string; text?: string }[] }[] };
  const text = result.output?.flatMap(item => item.content ?? []).find(content => content.type === "output_text")?.text;
  if (!text) throw new Error("No generated content returned");
  return text;
}

async function generateWithOpenAI(data: WorkspaceData, theme: string): Promise<Idea[]> {
  const individual = data.workspace.accountType === "Individual";
  const text = await callOpenAI(
    "You are a LinkedIn content strategist. Return only valid JSON. Never invent customer facts, personal experiences, quotes, metrics, or trends. Use only the supplied source.",
    `Create exactly 4 content ideas as a JSON array. Each object needs identity (${individual ? "always Founder" : "Founder or Company"}), format (Text, Image, Document, or Multi-image), hook, angle, evidence, and cta. Theme: ${theme}. ${sourceContext(data, individual)} Blocked language: ${data.brief.banned.join("; ")}.`,
  );
  const cleaned = text.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
  const parsed = JSON.parse(cleaned) as Record<string, unknown>[];
  const valid = (Array.isArray(parsed) ? parsed : []).filter(item =>
    IDENTITIES.includes(item.identity as string) && FORMATS.includes(item.format as string) &&
    typeof item.hook === "string" && typeof item.angle === "string" && typeof item.evidence === "string" && typeof item.cta === "string");
  if (valid.length === 0) throw new Error("Model returned no valid ideas");
  return valid.slice(0, 4).map(item => ({
    id: crypto.randomUUID(),
    identity: individual ? "Founder" : item.identity as Idea["identity"],
    format: item.format as Idea["format"],
    hook: (item.hook as string).slice(0, 300),
    angle: (item.angle as string).slice(0, 600),
    evidence: (item.evidence as string).slice(0, 400),
    cta: (item.cta as string).slice(0, 300),
    theme,
    status: "Proposed" as const,
  }));
}

async function reviseWithOpenAI(data: WorkspaceData, post: Post, note: string) {
  const text = await callOpenAI(
    `You revise LinkedIn drafts. Keep the ${post.identity === "Founder" ? data.brief.founderVoice : data.brief.companyVoice} voice. Never invent facts. Blocked language: ${data.brief.banned.join("; ")}. Return only the revised post text, no preamble.`,
    `Revise this draft. Reviewer's request: "${note}".\n\nDraft:\n${post.body}`,
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

function fallbackIdeas(data: WorkspaceData, theme: string): Idea[] {
  const individual = data.workspace.accountType === "Individual";
  const proof = data.brief.proof[0] ?? "your approved evidence";
  return [
    { id: crypto.randomUUID(), identity: "Founder", theme, format: "Text", hook: `The uncomfortable lesson behind ${theme.toLowerCase()}`, angle: "Tell one specific operating lesson, the mistaken assumption, and what changed.", evidence: "Your approved voice and source", cta: "Ask peers what assumption they changed recently.", status: "Proposed" },
    { id: crypto.randomUUID(), identity: individual ? "Founder" : "Company", theme, format: "Document", hook: `${theme}: a practical five-step field guide`, angle: "Turn the theme into a diagnostic sequence with one action per page.", evidence: `Your source plus ${proof}`, cta: "Invite readers to save the guide and score their current process.", status: "Proposed" },
    { id: crypto.randomUUID(), identity: "Founder", theme, format: "Image", hook: `One question that changes how teams think about ${theme.toLowerCase()}`, angle: "Pair a concise point of view with a simple branded proof card.", evidence: "Selected theme and approved vocabulary", cta: "Ask readers to answer the question in comments.", status: "Proposed" },
    { id: crypto.randomUUID(), identity: individual ? "Founder" : "Company", theme, format: "Multi-image", hook: `From scattered evidence to one decision`, angle: "Show a before/process/after sequence.", evidence: "Approved positioning and proof", cta: "Offer a closer look at the workflow.", status: "Proposed" },
  ];
}
