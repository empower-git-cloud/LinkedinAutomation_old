import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";
import { getCurrentWorkspaceId, loadWorkspace, recordUpload, saveWorkspace } from "../../../lib/workspace";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "A file is required" }, { status: 400 });
  }
  if (file.size > 20 * 1024 * 1024) {
    return NextResponse.json({ error: "Files must be smaller than 20 MB" }, { status: 413 });
  }

  const id = crypto.randomUUID();
  const workspaceId = await getCurrentWorkspaceId();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
  const objectKey = `${encodeURIComponent(workspaceId)}/knowledge/${id}-${safeName}`;
  const files = (env as unknown as { FILES: R2Bucket }).FILES;
  await files.put(objectKey, await file.arrayBuffer(), {
    httpMetadata: { contentType: file.type || "application/octet-stream" },
    customMetadata: { originalName: file.name, workspaceId },
  });
  await recordUpload({ id, objectKey, filename: file.name, contentType: file.type || "application/octet-stream", size: file.size }, workspaceId);

  const data = await loadWorkspace(workspaceId);
  data.sources = [{ id, name: file.name, type: file.type.includes("pdf") ? "PDF" : "Document", status: "Indexed" }, ...data.sources];
  await saveWorkspace(data, workspaceId);
  return NextResponse.json(data);
}
