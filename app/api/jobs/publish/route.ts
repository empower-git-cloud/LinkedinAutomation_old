import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";
import { getLinkedInConnection, publishLinkedInPost } from "../../../../lib/linkedin";
import { ensureWorkspaceTables, loadWorkspace, saveWorkspace } from "../../../../lib/workspace";

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
    for (const post of data.posts.filter(item => item.status === "Scheduled" && isDue(item.scheduledFor))) {
      try {
        const urn = await publishLinkedInPost(connection, post);
        post.status = "Published";
        post.linkedinPostUrn = urn;
        post.scheduledFor = new Date().toISOString();
        result.published += 1;
      } catch (error) {
        if (error instanceof Error && error.message.includes("approved media asset")) result.held += 1;
        else result.failed += 1;
      }
    }
    await saveWorkspace(data, row.id);
  }
  return NextResponse.json(result);
}

function isDue(value: string) {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && timestamp <= Date.now();
}
