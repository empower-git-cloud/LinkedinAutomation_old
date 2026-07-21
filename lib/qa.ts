import { Post, WorkspaceData } from "../app/data";
import { LINKEDIN_LIMITS } from "./linkedin-playbook";

export type QaResult = { qa: NonNullable<Post["qa"]>; notes: string[] };

const wordSet = (text: string) => new Set(text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(word => word.length > 3));

function similarity(a: string, b: string) {
  const setA = wordSet(a);
  const setB = wordSet(b);
  if (setA.size === 0 || setB.size === 0) return 0;
  let shared = 0;
  for (const word of setA) if (setB.has(word)) shared += 1;
  return shared / Math.min(setA.size, setB.size);
}

const ENGAGEMENT_BAIT = [/comment\s+["“]?yes/i, /tag\s+\d*\s*(friends|people|someone)/i, /like\s+if\s+you/i, /follow\s+for\s+more/i, /drop\s+a\s+["“]?\+?1/i];

/**
 * Brand, claims AND LinkedIn-native structural checks. A failed check never blocks
 * the user — it produces an honest flag plus a plain-language, actionable note.
 * `format` is the LinkedIn-mechanics check (hook, length, links-in-body, hashtags, bait).
 */
export async function runQaChecks(candidate: { id?: string; title: string; body: string; hashtags?: string[] }, data: WorkspaceData): Promise<QaResult> {
  const notes: string[] = [];
  const body = candidate.body;
  const text = `${candidate.title}\n${body}`;

  // Claims: scan against the workspace's blocked vocabulary.
  const hits = data.brief.banned.filter(term => term && new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(text));
  const claims = hits.length === 0;
  if (!claims) notes.push(`Claims: blocked language found — ${hits.map(hit => `“${hit}”`).join(", ")}.`);

  // Duplication: compare against the user's other posts.
  let duplication = true;
  for (const post of data.posts) {
    if (post.id === candidate.id || post.status === "Rejected") continue;
    if (similarity(body, post.body) > 0.6) {
      duplication = false;
      notes.push(`Duplication: very similar to “${post.title}”. Use a different angle.`);
      break;
    }
  }

  // Links: check reachability AND enforce the LinkedIn rule (links belong in the first comment).
  let links = true;
  const urls = [...new Set(body.match(/https?:\/\/[^\s)"'<>]+/g) ?? [])];
  if (urls.length > 0) {
    links = false;
    notes.push("Links: LinkedIn suppresses reach when a link is in the post body — move it to the first comment and write 'link in comments'.");
  }
  for (const url of urls.slice(0, 4)) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);
      const response = await fetch(url, { method: "HEAD", redirect: "follow", signal: controller.signal });
      clearTimeout(timer);
      if (!response.ok && response.status !== 405) notes.push(`Links: ${url} may be broken (${response.status}).`);
    } catch {
      notes.push(`Links: ${url} could not be reached.`);
    }
  }

  // Voice: length within a publishable range (labelled basic check).
  const voice = body.length >= 40 && body.length <= LINKEDIN_LIMITS.hardMaxChars;
  if (!voice) notes.push(body.length < 40 ? "Voice: the draft is very short for a LinkedIn post." : `Voice: the draft exceeds LinkedIn's ${LINKEDIN_LIMITS.hardMaxChars}-character limit.`);

  // Format: the real LinkedIn-mechanics checks.
  let format = true;
  const firstLine = body.split(/\n/).find(line => line.trim().length > 0) ?? "";
  if (firstLine.length > LINKEDIN_LIMITS.seeMoreFold) { format = false; notes.push(`Format: your hook is ${firstLine.length} chars — keep the first line under ${LINKEDIN_LIMITS.seeMoreFold} so it lands before the “…see more” fold.`); }
  if (body.length > LINKEDIN_LIMITS.sweetSpotMax + 600) { format = false; notes.push(`Format: at ${body.length} chars this is long for LinkedIn; the sweet spot is ${LINKEDIN_LIMITS.sweetSpotMin}–${LINKEDIN_LIMITS.sweetSpotMax}.`); }
  const tags = candidate.hashtags ?? [];
  if (tags.length > LINKEDIN_LIMITS.maxHashtags) { format = false; notes.push(`Format: ${tags.length} hashtags — use ${LINKEDIN_LIMITS.minHashtags}–${LINKEDIN_LIMITS.maxHashtags} specific ones.`); }
  if (ENGAGEMENT_BAIT.some(pattern => pattern.test(text))) { format = false; notes.push("Format: engagement bait (e.g. 'comment YES', 'tag 3 people') is penalised — ask a genuine question instead."); }

  return { qa: { voice, claims, duplication, links, format }, notes };
}
