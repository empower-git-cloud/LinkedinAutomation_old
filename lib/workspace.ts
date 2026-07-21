import { env } from "cloudflare:workers";
import { seedWorkspace, WorkspaceData } from "../app/data";
import { getChatGPTUser } from "../app/chatgpt-auth";

export async function getCurrentWorkspaceId() {
  const user = await getChatGPTUser();
  return user?.email.toLowerCase() ?? "demo-workspace";
}

export async function ensureWorkspaceTables() {
  const db = env.DB;
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS workspace_state (
      id TEXT PRIMARY KEY,
      payload TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS uploaded_assets (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      object_key TEXT NOT NULL,
      filename TEXT NOT NULL,
      content_type TEXT NOT NULL,
      size INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    )`),
    db.prepare("CREATE INDEX IF NOT EXISTS uploaded_assets_workspace_idx ON uploaded_assets(workspace_id)"),
    db.prepare(`CREATE TABLE IF NOT EXISTS linkedin_connections (
      workspace_id TEXT PRIMARY KEY,
      access_token_encrypted TEXT NOT NULL,
      refresh_token_encrypted TEXT,
      member_urn TEXT NOT NULL,
      member_name TEXT,
      organization_urn TEXT,
      scopes TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS oauth_states (
      state TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      expires_at INTEGER NOT NULL
    )`),
    db.prepare("CREATE INDEX IF NOT EXISTS oauth_states_expires_idx ON oauth_states(expires_at)"),
  ]);
}

export async function loadWorkspace(requestedWorkspaceId?: string): Promise<WorkspaceData> {
  await ensureWorkspaceTables();
  const workspaceId = requestedWorkspaceId ?? await getCurrentWorkspaceId();
  const row = await env.DB.prepare("SELECT payload FROM workspace_state WHERE id = ?")
    .bind(workspaceId)
    .first<{ payload: string }>();
  if (row?.payload) return normalizeWorkspace(JSON.parse(row.payload) as Partial<WorkspaceData>);
  await saveWorkspace(structuredClone(seedWorkspace), workspaceId);
  return seedWorkspace;
}

function normalizeWorkspace(input: Partial<WorkspaceData>): WorkspaceData {
  const data: WorkspaceData = {
    workspace: { ...seedWorkspace.workspace, ...(input.workspace ?? {}) },
    individual: { ...seedWorkspace.individual, ...(input.individual ?? {}) },
    brief: { ...seedWorkspace.brief, ...(input.brief ?? {}) },
    themes: input.themes ?? structuredClone(seedWorkspace.themes),
    ideas: input.ideas ?? structuredClone(seedWorkspace.ideas),
    posts: input.posts ?? structuredClone(seedWorkspace.posts),
    contacts: input.contacts ?? structuredClone(seedWorkspace.contacts),
    sources: input.sources ?? structuredClone(seedWorkspace.sources),
    events: input.events ?? [],
  };
  // Migrate legacy display-string dates ("Mon · 9:10 AM") to the ISO-or-null contract.
  for (const post of data.posts) {
    if (post.scheduledFor !== null && !Number.isFinite(Date.parse(post.scheduledFor))) post.scheduledFor = null;
  }
  // Rejected posts are kept for 30 days, then cleaned up.
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  data.posts = data.posts.filter(post => post.status !== "Rejected" || !post.rejectedAt || Date.parse(post.rejectedAt) > cutoff);
  return data;
}

export function logEvent(data: WorkspaceData, kind: WorkspaceData["events"][number]["kind"], message: string, postId?: string) {
  data.events.unshift({ id: crypto.randomUUID(), at: new Date().toISOString(), kind, message, postId, read: false });
  if (data.events.length > 100) data.events.length = 100;
}

export async function saveWorkspace(data: WorkspaceData, requestedWorkspaceId?: string) {
  await ensureWorkspaceTables();
  const workspaceId = requestedWorkspaceId ?? await getCurrentWorkspaceId();
  await env.DB.prepare(`INSERT INTO workspace_state (id, payload, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at`)
    .bind(workspaceId, JSON.stringify(data), Date.now())
    .run();
}

export async function recordUpload(input: { id: string; objectKey: string; filename: string; contentType: string; size: number }, requestedWorkspaceId?: string) {
  await ensureWorkspaceTables();
  const workspaceId = requestedWorkspaceId ?? await getCurrentWorkspaceId();
  await env.DB.prepare(`INSERT INTO uploaded_assets (id, workspace_id, object_key, filename, content_type, size, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .bind(input.id, workspaceId, input.objectKey, input.filename, input.contentType, input.size, Date.now())
    .run();
}
