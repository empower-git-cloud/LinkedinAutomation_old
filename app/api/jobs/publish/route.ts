import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";
import { getLinkedInConnection, publishLinkedInPost } from "../../../../lib/linkedin";
import { ensureWorkspaceTables, loadWorkspace, logEvent, saveWorkspace } from "../../../../lib/workspace";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!env.CRON_SECRET || request.headers.get("authorization") !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await ensureWorkspaceTables();
  const rows = await env.DB.prepare("SELECT id FROM workspace_state").all<{ id: string }>();
  const result = { published: 0, held: 0, failed: 0 };
  for (const row of rows.results) {
    const [data, connection] = await Promise.all([loadWorkspace(row.id), getLinkedInConnection(row.id)]);
    if (!connection) continue;
    // A failed post gets a holdReason and is skipped until the user re-approves,
    // so one broken post cannot retry forever or block the rest of the queue.
    const due = data.posts.filter(post => post.status === "Scheduled" && !post.holdReason && isDue(post.scheduledFor));
    for (const post of due) {
      try {
        const urn = await publishLinkedInPost(connection, post);
        post.status = "Published";
        post.linkedinPostUrn = urn;
        post.publishedAt = new Date().toISOString();
        logEvent(data, "publish", `Published automatically: ${post.title}`, post.id);
        result.published += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Publishing failed";
        post.holdReason = message;
        if (message.includes("media asset") || message.includes("coming soon")) {
          logEvent(data, "hold", `Held (${post.format} publishing is not available yet): ${post.title}`, post.id);
          result.held += 1;
        } else {
          logEvent(data, "publish-failed", `Publishing failed for “${post.title}”: ${message}`, post.id);
          result.failed += 1;
        }
      }
      // Save after every post so a crash mid-run can never publish the same post twice.
      await saveWorkspace(data, row.id);
    }
  }
  return NextResponse.json(result);
}

function isDue(value: string | null) {
  if (!value) return false;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && timestamp <= Date.now();
}
