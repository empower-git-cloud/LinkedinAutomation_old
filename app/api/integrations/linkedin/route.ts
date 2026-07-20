import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";
import { getLinkedInConnection } from "../../../../lib/linkedin";
import { getCurrentWorkspaceId, ensureWorkspaceTables } from "../../../../lib/workspace";

export const dynamic = "force-dynamic";

export async function GET() {
  const workspaceId = await getCurrentWorkspaceId();
  const connection = await getLinkedInConnection(workspaceId);
  return NextResponse.json({
    appConfigured: Boolean(env.LINKEDIN_CLIENT_ID && env.LINKEDIN_CLIENT_SECRET && env.LINKEDIN_REDIRECT_URI),
    encryptionConfigured: Boolean(env.TOKEN_ENCRYPTION_KEY && env.TOKEN_ENCRYPTION_KEY.length >= 24),
    connected: Boolean(connection && connection.expiresAt > Date.now()),
    expired: Boolean(connection && connection.expiresAt <= Date.now()),
    memberName: connection?.memberName ?? null,
    memberUrn: connection?.memberUrn ?? null,
    organizationUrn: connection?.organizationUrn ?? null,
    scopes: connection?.scopes.split(" ").filter(Boolean) ?? [],
    expiresAt: connection?.expiresAt ?? null,
    apiVersion: env.LINKEDIN_API_VERSION ?? "202606",
    openaiConfigured: Boolean(env.OPENAI_API_KEY),
    openaiModel: env.OPENAI_MODEL ?? "gpt-5.4-mini",
  });
}

export async function POST(request: Request) {
  const workspaceId = await getCurrentWorkspaceId();
  const input = await request.json() as { organizationUrn?: string; disconnect?: boolean };
  await ensureWorkspaceTables();
  if (input.disconnect) {
    await env.DB.prepare("DELETE FROM linkedin_connections WHERE workspace_id = ?").bind(workspaceId).run();
    return NextResponse.json({ connected: false });
  }
  const organizationUrn = input.organizationUrn?.trim() ?? "";
  if (organizationUrn && !/^urn:li:(organization|organizationBrand):\d+$/.test(organizationUrn)) {
    return NextResponse.json({ error: "Use a valid organization URN, for example urn:li:organization:123456" }, { status: 400 });
  }
  const result = await env.DB.prepare("UPDATE linkedin_connections SET organization_urn = ?, updated_at = ? WHERE workspace_id = ?")
    .bind(organizationUrn || null, Date.now(), workspaceId).run();
  if (!result.meta.changes) return NextResponse.json({ error: "Connect LinkedIn before selecting a company page." }, { status: 409 });
  return GET();
}
