import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";
import { Idea, Post, WorkspaceData } from "../../../data";
import { loadWorkspace, logEvent, saveWorkspace } from "../../../../lib/workspace";
import { runQaChecks } from "../../../../lib/qa";

export const dynamic = "force-dynamic";

const IDENTITIES = ["Founder", "Company"];
const FORMATS = ["Text", "Image", "Document", "Multi-image"];

export async function POST(request: Request) {
  const input = await request.json() as { mode?: "ideas" | "revise"; themeId?: string; postId?: string; note?: string };
  const data = await loadWorkspace();

  if (input.mode === "revise") return reviseDraft(data, input);

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
  const text = await callOpenAI(
    "You are a B2B LinkedIn content strategist. Return only valid JSON. Never invent customer facts, founder experiences, quotes, metrics, or trends. Use only the supplied brief. Create distinct founder and company angles.",
    `Create exactly 4 content ideas as a JSON array. Each object needs identity (Founder or Company), format (Text, Image, Document, or Multi-image), hook, angle, evidence, and cta. Theme: ${theme}. Positioning: ${data.brief.positioning}. Audience: ${data.brief.audience}. Founder voice: ${data.brief.founderVoice}. Company voice: ${data.brief.companyVoice}. Approved proof: ${data.brief.proof.join("; ")}. Blocked language: ${data.brief.banned.join("; ")}. ${knowledgeContext(data)}`,
  );
  const cleaned = text.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
  const parsed = JSON.parse(cleaned) as Record<string, unknown>[];
  // Never trust model output blind: keep only well-formed ideas, and require at least one.
  const valid = (Array.isArray(parsed) ? parsed : []).filter(item =>
    IDENTITIES.includes(item.identity as string) && FORMATS.includes(item.format as string) &&
    typeof item.hook === "string" && typeof item.angle === "string" && typeof item.evidence === "string" && typeof item.cta === "string");
  if (valid.length === 0) throw new Error("Model returned no valid ideas");
  return valid.slice(0, 4).map(item => ({
    id: crypto.randomUUID(),
    identity: item.identity as Idea["identity"],
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
  const proof = data.brief.proof[0] ?? "approved customer evidence";
  return [
    { id: crypto.randomUUID(), identity: "Founder", theme, format: "Text", hook: `The uncomfortable lesson behind ${theme.toLowerCase()}`, angle: "Tell one specific operating lesson, the mistaken assumption, and what changed.", evidence: "Approved founder voice and business brief", cta: "Ask peers what assumption they changed recently.", status: "Proposed" },
    { id: crypto.randomUUID(), identity: "Company", theme, format: "Document", hook: `${theme}: a practical five-step field guide`, angle: "Turn the theme into a diagnostic sequence with one action per page.", evidence: `Business brief plus ${proof}`, cta: "Invite readers to save the guide and score their current process.", status: "Proposed" },
    { id: crypto.randomUUID(), identity: "Founder", theme, format: "Image", hook: `One question that changes how teams think about ${theme.toLowerCase()}`, angle: "Pair a concise founder point of view with a simple branded proof card.", evidence: "Selected theme and approved founder vocabulary", cta: "Ask readers to answer the question in comments.", status: "Proposed" },
    { id: crypto.randomUUID(), identity: "Company", theme, format: "Multi-image", hook: `From scattered evidence to one decision`, angle: "Show a before/process/after sequence without repeating the founder narrative.", evidence: "Approved positioning and customer proof", cta: "Offer a closer look at the workflow.", status: "Proposed" },
  ];
}
