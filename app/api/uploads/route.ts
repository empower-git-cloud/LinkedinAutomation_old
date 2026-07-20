import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";
import { KnowledgeSource } from "../../data";
import { getCurrentWorkspaceId, loadWorkspace, recordUpload, saveWorkspace } from "../../../lib/workspace";

export const dynamic = "force-dynamic";

const READABLE_TYPES = [".txt", ".md", ".markdown", ".csv"];

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
  const buffer = await file.arrayBuffer();
  await files.put(objectKey, buffer, {
    httpMetadata: { contentType: file.type || "application/octet-stream" },
    customMetadata: { originalName: file.name, workspaceId },
  });
  await recordUpload({ id, objectKey, filename: file.name, contentType: file.type || "application/octet-stream", size: file.size }, workspaceId);

  // Only extract text from formats we can genuinely read. Everything else is
  // labelled honestly instead of pretending to be "Indexed".
  const lowerName = file.name.toLowerCase();
  const readable = file.type.startsWith("text/") || READABLE_TYPES.some(extension => lowerName.endsWith(extension));
  const source: KnowledgeSource = {
    id,
    name: file.name,
    type: file.type.includes("pdf") ? "PDF" : lowerName.endsWith(".md") || lowerName.endsWith(".markdown") ? "Markdown" : file.type.startsWith("text/") || readable ? "Text" : "Document",
    status: readable ? "Indexed" : "Stored — AI cannot read this file type yet",
    readable,
  };
  if (readable) {
    const text = new TextDecoder("utf-8", { fatal: false }).decode(buffer).replace(/\s+/g, " ").trim();
    source.textPreview = text.slice(0, 1500);
  }

  const data = await loadWorkspace(workspaceId);
  data.sources = [source, ...data.sources];
  await saveWorkspace(data, workspaceId);
  return NextResponse.json(data);
}
