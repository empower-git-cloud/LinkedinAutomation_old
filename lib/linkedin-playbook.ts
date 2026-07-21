import { WorkspaceData } from "../app/data";

/**
 * A concrete, opinionated LinkedIn content-strategy engine. These are the real
 * mechanics that decide reach on LinkedIn — encoded once and injected into every
 * generation prompt and every QA check, so content is written for the platform
 * rather than as generic "AI slop".
 */

export const LINKEDIN_LIMITS = {
  hardMaxChars: 3000,
  // The post is truncated with "…see more" around here; the hook must land before it.
  seeMoreFold: 210,
  sweetSpotMin: 900,
  sweetSpotMax: 1800,
  minHashtags: 3,
  maxHashtags: 5,
};

/** The algorithm mechanics that actually move reach in 2026. */
export const ALGORITHM_RULES = [
  "The first 1–2 lines (before the '…see more' fold, ~210 chars) decide whether anyone stops scrolling. Lead with the strongest, most specific line — never a warm-up.",
  "External links in the post body suppress reach; put the link in the first comment and say 'link in comments'.",
  "Comments and reshares are weighted far above reactions, and dwell time matters — write to earn a comment and to be read slowly.",
  "The first 60–90 minutes of engagement set the ceiling; end with one clear, easy-to-answer question.",
  "No engagement bait ('comment YES', 'tag 3 people') — it is penalised. Ask a genuine question instead.",
  "3–5 specific hashtags (a mix of broad and niche) outperform 10+; hashtags are discovery, not decoration.",
  "Short paragraphs and white space (1–2 sentences per line) beat dense blocks on mobile.",
  "Consistency and a clear point of view compound; one sharp idea per post beats a list of five shallow ones.",
];

/** Proven hook patterns, with the shape each one takes. */
export const HOOK_PATTERNS = [
  { name: "Contrarian", shape: "State a widely-held belief, then reject it in the next line." },
  { name: "Result/receipt", shape: "Open with a concrete outcome or number, then explain how." },
  { name: "Mistake/lesson", shape: "Admit a specific mistake, then the lesson that changed things." },
  { name: "List promise", shape: "Promise N specific, usable takeaways and deliver them tightly." },
  { name: "Sharp question", shape: "Ask the exact question your reader is quietly stuck on." },
];

/** Per-format guidance — when to use it and how to structure it on LinkedIn. */
export const FORMAT_PLAYBOOK: Record<string, { whenToUse: string; structure: string }> = {
  Text: { whenToUse: "Opinions, lessons, stories — the highest-reach native format.", structure: "Hook line → 1-line setup → short body in 2-sentence paragraphs → single question CTA." },
  Document: { whenToUse: "Frameworks, checklists, teardowns — LinkedIn's carousel; strong for saves.", structure: "Cover promises the payoff → one idea per page, ≤12 words of heading + a line of support → final page CTA." },
  Image: { whenToUse: "A single strong point of view or a proof/result card.", structure: "Hook in the copy, image reinforces one idea; keep text on the image minimal." },
  "Multi-image": { whenToUse: "Before/after or a short sequence without a full document.", structure: "2–4 images that tell one sequence; caption carries the narrative." },
};

export const CTA_LADDER = "reach → save/share → profile visit → follow → DM/booking. Match the ask to the stage: educational posts earn saves; point-of-view posts earn comments; only offer posts ask for the click.";

/** The system prompt every LinkedIn generation call should carry. */
export function linkedinSystemPrompt(extra = "") {
  return [
    "You are a senior LinkedIn ghostwriter and content strategist. You write for the LinkedIn algorithm and for how people actually read on mobile.",
    "Rules you always follow:",
    ...ALGORITHM_RULES.map(rule => `- ${rule}`),
    `- Keep posts within ${LINKEDIN_LIMITS.sweetSpotMin}–${LINKEDIN_LIMITS.sweetSpotMax} characters unless the format needs less; never exceed ${LINKEDIN_LIMITS.hardMaxChars}.`,
    "- Never invent facts, metrics, quotes, or personal experiences that were not supplied. Never use banned language.",
    extra,
  ].filter(Boolean).join("\n");
}

/** A compact playbook context to append to user prompts. */
export function playbookContext() {
  return [
    `Hook patterns to choose from: ${HOOK_PATTERNS.map(hook => `${hook.name} (${hook.shape})`).join("; ")}.`,
    `CTA ladder: ${CTA_LADDER}`,
    `Formatting: hook before the ${LINKEDIN_LIMITS.seeMoreFold}-char fold, short lines, ${LINKEDIN_LIMITS.minHashtags}–${LINKEDIN_LIMITS.maxHashtags} specific hashtags, any link goes in the first comment.`,
  ].join("\n");
}

export function formatGuidance(format: string) {
  const guide = FORMAT_PLAYBOOK[format] ?? FORMAT_PLAYBOOK.Text;
  return `Format ${format}: ${guide.whenToUse} Structure: ${guide.structure}`;
}

/** Source grounding differs by audience — profile for individuals, business assets for companies. */
export function sourceContext(data: WorkspaceData, individual: boolean) {
  if (individual) {
    const profile = data.individual;
    return `Write as this person (first-person). Role: ${profile.role || profile.headline}. Experience: ${profile.experienceSummary}. Companies: ${profile.companies.join(", ") || "(unknown)"}. Topics they want: ${profile.manualInput || "(open)"}. Voice: ${data.brief.founderVoice || "direct, specific, experience-led"}.`;
  }
  return `Write for this business. Positioning: ${data.brief.positioning}. Audience: ${data.brief.audience}. Founder voice: ${data.brief.founderVoice}. Company voice: ${data.brief.companyVoice}. Approved proof (only these facts): ${data.brief.proof.join("; ") || "(none provided)"}.`;
}
