import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";
import { encryptToken } from "../../../../../lib/token-crypto";
import { ensureWorkspaceTables } from "../../../../../lib/workspace";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  if (url.searchParams.get("error")) return NextResponse.redirect(new URL("/?integration=linkedin-denied", request.url));
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state || !env.LINKEDIN_CLIENT_ID || !env.LINKEDIN_CLIENT_SECRET || !env.LINKEDIN_REDIRECT_URI) {
    return NextResponse.redirect(new URL("/?integration=linkedin-invalid", request.url));
  }
  await ensureWorkspaceTables();
  const saved = await env.DB.prepare("SELECT workspace_id, expires_at FROM oauth_states WHERE state = ?").bind(state).first<{ workspace_id: string; expires_at: number }>();
  await env.DB.prepare("DELETE FROM oauth_states WHERE state = ?").bind(state).run();
  if (!saved || saved.expires_at < Date.now()) return NextResponse.redirect(new URL("/?integration=linkedin-expired", request.url));

  const tokenResponse = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "authorization_code", code, client_id: env.LINKEDIN_CLIENT_ID, client_secret: env.LINKEDIN_CLIENT_SECRET, redirect_uri: env.LINKEDIN_REDIRECT_URI }),
  });
  if (!tokenResponse.ok) return NextResponse.redirect(new URL("/?integration=linkedin-token-failed", request.url));
  const token = await tokenResponse.json() as { access_token: string; expires_in: number; refresh_token?: string; scope?: string };
  const profileResponse = await fetch("https://api.linkedin.com/v2/userinfo", { headers: { authorization: `Bearer ${token.access_token}` } });
  if (!profileResponse.ok) return NextResponse.redirect(new URL("/?integration=linkedin-profile-failed", request.url));
  const profile = await profileResponse.json() as { sub: string; name?: string };
  await env.DB.prepare(`INSERT INTO linkedin_connections
    (workspace_id, access_token_encrypted, refresh_token_encrypted, member_urn, member_name, organization_urn, scopes, expires_at, updated_at)
    VALUES (?, ?, ?, ?, ?, NULL, ?, ?, ?)
    ON CONFLICT(workspace_id) DO UPDATE SET access_token_encrypted = excluded.access_token_encrypted,
      refresh_token_encrypted = excluded.refresh_token_encrypted, member_urn = excluded.member_urn,
      member_name = excluded.member_name, scopes = excluded.scopes, expires_at = excluded.expires_at, updated_at = excluded.updated_at`)
    .bind(saved.workspace_id, await encryptToken(token.access_token), token.refresh_token ? await encryptToken(token.refresh_token) : null,
      `urn:li:person:${profile.sub}`, profile.name ?? null, token.scope ?? env.LINKEDIN_SCOPES ?? "", Date.now() + token.expires_in * 1000, Date.now()).run();
  return NextResponse.redirect(new URL("/?integration=linkedin-connected", request.url));
}
