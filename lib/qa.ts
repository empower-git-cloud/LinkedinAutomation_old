import { Post, WorkspaceData } from "../app/data";

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

/**
 * Runs the Brand & claims checks the UI reports. A failed check never blocks the
 * user — it produces an honest flag plus a plain-language note.
 */
export async function runQaChecks(candidate: { id?: string; title: string; body: string }, data: WorkspaceData): Promise<QaResult> {
  const notes: string[] = [];
  const text = `${candidate.title}\n${candidate.body}`;

  // Claims: scan against the workspace's blocked vocabulary.
  const hits = data.brief.banned.filter(term => term && new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(text));
  const claims = hits.length === 0;
  if (!claims) notes.push(`Blocked language found: ${hits.map(hit => `“${hit}”`).join(", ")}.`);

  // Duplication: compare against the user's other posts.
  let duplication = true;
  for (const post of data.posts) {
    if (post.id === candidate.id || post.status === "Rejected") continue;
    if (similarity(candidate.body, post.body) > 0.6) {
      duplication = false;
      notes.push(`Very similar to “${post.title}”. Consider a different angle.`);
      break;
    }
  }

  // Links: actually try each web link in the draft (first 4, 5s budget each).
  let links = true;
  const urls = [...new Set(text.match(/https?:\/\/[^\s)"'<>]+/g) ?? [])].slice(0, 4);
  for (const url of urls) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);
      const response = await fetch(url, { method: "HEAD", redirect: "follow", signal: controller.signal });
      clearTimeout(timer);
      if (!response.ok && response.status !== 405) {
        links = false;
        notes.push(`Link may be broken (${response.status}): ${url}`);
      }
    } catch {
      links = false;
      notes.push(`Link could not be reached: ${url}`);
    }
  }

  // Voice: a labelled basic check — length within a publishable LinkedIn range.
  const voice = candidate.body.length >= 40 && candidate.body.length <= 3000;
  if (!voice) notes.push(candidate.body.length < 40 ? "Basic check: the draft is very short for a LinkedIn post." : "Basic check: the draft exceeds LinkedIn's 3,000-character limit.");

  return { qa: { voice, claims, duplication, links }, notes };
}
