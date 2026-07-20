import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";
import { Idea } from "../../../data";
import { loadWorkspace, saveWorkspace } from "../../../../lib/workspace";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const input = await request.json() as { mode?: "ideas" | "post"; themeId?: string };
  const data = await loadWorkspace();
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

async function generateWithOpenAI(data: Awaited<ReturnType<typeof loadWorkspace>>, theme: string): Promise<Idea[]> {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { "authorization": `Bearer ${env.OPENAI_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({
      model: env.OPENAI_MODEL ?? "gpt-5.4-mini",
      input: [
        { role: "system", content: "You are a B2B LinkedIn content strategist. Return only valid JSON. Never invent customer facts, founder experiences, quotes, metrics, or trends. Use only the supplied brief. Create distinct founder and company angles." },
        { role: "user", content: `Create exactly 4 content ideas as a JSON array. Each object needs identity (Founder or Company), format (Text, Image, Document, or Multi-image), hook, angle, evidence, and cta. Theme: ${theme}. Positioning: ${data.brief.positioning}. Audience: ${data.brief.audience}. Founder voice: ${data.brief.founderVoice}. Company voice: ${data.brief.companyVoice}. Approved proof: ${data.brief.proof.join("; ")}. Blocked language: ${data.brief.banned.join("; ")}.` },
      ],
      max_output_tokens: 1800,
    }),
  });
  if (!response.ok) throw new Error(`OpenAI request failed: ${response.status}`);
  const result = await response.json() as { output?: { content?: { type?: string; text?: string }[] }[] };
  const text = result.output?.flatMap(item => item.content ?? []).find(content => content.type === "output_text")?.text;
  if (!text) throw new Error("No generated content returned");
  const cleaned = text.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
  const parsed = JSON.parse(cleaned) as Omit<Idea, "id" | "theme" | "status">[];
  return parsed.slice(0, 4).map(item => ({ ...item, id: crypto.randomUUID(), theme, status: "Proposed" }));
}

function fallbackIdeas(data: Awaited<ReturnType<typeof loadWorkspace>>, theme: string): Idea[] {
  const proof = data.brief.proof[0] ?? "approved customer evidence";
  return [
    { id: crypto.randomUUID(), identity: "Founder", theme, format: "Text", hook: `The uncomfortable lesson behind ${theme.toLowerCase()}`, angle: "Tell one specific operating lesson, the mistaken assumption, and what changed.", evidence: "Approved founder voice and business brief", cta: "Ask peers what assumption they changed recently.", status: "Proposed" },
    { id: crypto.randomUUID(), identity: "Company", theme, format: "Document", hook: `${theme}: a practical five-step field guide`, angle: "Turn the theme into a diagnostic sequence with one action per page.", evidence: `Business brief plus ${proof}`, cta: "Invite readers to save the guide and score their current process.", status: "Proposed" },
    { id: crypto.randomUUID(), identity: "Founder", theme, format: "Image", hook: `One question that changes how teams think about ${theme.toLowerCase()}`, angle: "Pair a concise founder point of view with a simple branded proof card.", evidence: "Selected theme and approved founder vocabulary", cta: "Ask readers to answer the question in comments.", status: "Proposed" },
    { id: crypto.randomUUID(), identity: "Company", theme, format: "Multi-image", hook: `From scattered evidence to one decision`, angle: "Show a before/process/after sequence without repeating the founder narrative.", evidence: "Approved positioning and customer proof", cta: "Offer a closer look at the workflow.", status: "Proposed" },
  ];
}
