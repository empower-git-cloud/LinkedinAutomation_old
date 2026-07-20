import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";
import { getLinkedInConnection } from "../../../../../lib/linkedin";
import { decryptToken } from "../../../../../lib/token-crypto";
import { getCurrentWorkspaceId, loadWorkspace, saveWorkspace } from "../../../../../lib/workspace";

export const dynamic = "force-dynamic";

export async function POST() {
  const workspaceId = await getCurrentWorkspaceId();
  const [data, connection] = await Promise.all([loadWorkspace(workspaceId), getLinkedInConnection(workspaceId)]);
  if (!connection) return NextResponse.json({ error: "Connect LinkedIn before syncing." }, { status: 409 });
  const token = await decryptToken(connection.accessTokenEncrypted);
  let syncedPosts = 0;
  let importedContacts = 0;

  for (const post of data.posts.filter(item => item.status === "Published" && item.linkedinPostUrn)) {
    try {
      if (post.identity === "Company" && connection.organizationUrn) {
        const url = new URL("https://api.linkedin.com/rest/organizationalEntityShareStatistics");
        url.searchParams.set("q", "organizationalEntity");
        url.searchParams.set("organizationalEntity", connection.organizationUrn);
        url.searchParams.set("shares", `List(${post.linkedinPostUrn})`);
        const response = await linkedinFetch(url, token);
        if (response.ok) {
          const result = await response.json() as { elements?: { totalShareStatistics?: { impressionCount?: number; likeCount?: number; commentCount?: number; shareCount?: number } }[] };
          const metrics = result.elements?.[0]?.totalShareStatistics;
          if (metrics) post.metrics = { impressions: metrics.impressionCount ?? 0, reactions: metrics.likeCount ?? 0, comments: metrics.commentCount ?? 0, saves: post.metrics?.saves ?? 0 };
        }
      }

      const commentsUrl = `https://api.linkedin.com/rest/socialActions/${encodeURIComponent(post.linkedinPostUrn!)}/comments`;
      const commentsResponse = await linkedinFetch(commentsUrl, token);
      if (commentsResponse.ok) {
        const result = await commentsResponse.json() as { elements?: { id?: string; actor?: string; message?: { text?: string }; created?: { time?: number } }[] };
        for (const comment of result.elements ?? []) {
          const text = comment.message?.text?.trim() ?? "";
          const signal = classifyComment(text);
          if (!text || !signal || data.contacts.some(contact => contact.id === `li-${comment.id}`)) continue;
          const actor = comment.actor ?? "LinkedIn member";
          data.contacts.unshift({ id: `li-${comment.id ?? crypto.randomUUID()}`, name: actor.startsWith("urn:") ? "LinkedIn member" : actor, role: "From LinkedIn comment", company: "", comment: text, intent: signal.intent, sentiment: signal.sentiment, stage: "New", source: post.title, initials: "LI", notes: actor });
          importedContacts += 1;
        }
      }
      syncedPosts += 1;
    } catch {
      // One unavailable permission or post must not block other authorized data.
    }
  }

  await saveWorkspace(data, workspaceId);
  return NextResponse.json({ data, syncedPosts, importedContacts });
}

function linkedinFetch(input: string | URL, token: string) {
  return fetch(input, { headers: { authorization: `Bearer ${token}`, "Linkedin-Version": env.LINKEDIN_API_VERSION ?? "202606", "X-Restli-Protocol-Version": "2.0.0" } });
}

function classifyComment(text: string): { intent: "High" | "Medium"; sentiment: "Interested" | "Question" } | null {
  const normalized = text.toLowerCase();
  const high = ["demo", "pricing", "buy", "trial", "workflow", "can we talk", "interested", "how do i get"];
  if (high.some(term => normalized.includes(term))) return { intent: "High", sentiment: "Interested" };
  if (normalized.includes("?") || /\bhow\b|\bwhat\b|\bwhere\b|\bwhen\b/.test(normalized)) return { intent: "Medium", sentiment: "Question" };
  return null;
}
