import { NextResponse } from "next/server";
import { getLinkedInConnection, publishLinkedInPost } from "../../../../../lib/linkedin";
import { getCurrentWorkspaceId, loadWorkspace, logEvent, saveWorkspace } from "../../../../../lib/workspace";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const { postId } = await request.json() as { postId?: string };
  const workspaceId = await getCurrentWorkspaceId();
  const [data, connection] = await Promise.all([loadWorkspace(workspaceId), getLinkedInConnection(workspaceId)]);
  if (!connection) return NextResponse.json({ error: "Connect LinkedIn before publishing." }, { status: 409 });
  const post = data.posts.find(item => item.id === postId);
  if (!post) return NextResponse.json({ error: "Post not found." }, { status: 404 });
  if (post.status !== "Scheduled") return NextResponse.json({ error: "Only approved and scheduled posts can publish." }, { status: 409 });
  try {
    const urn = await publishLinkedInPost(connection, post);
    post.status = "Published";
    post.linkedinPostUrn = urn;
    post.publishedAt = new Date().toISOString();
    delete post.holdReason;
    logEvent(data, "publish", `Published now: ${post.title}`, post.id);
    await saveWorkspace(data, workspaceId);
    return NextResponse.json({ data, urn });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Publishing failed";
    logEvent(data, "publish-failed", `Publishing failed for “${post.title}”: ${message}`, post.id);
    await saveWorkspace(data, workspaceId);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
