import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";
import { ensureWorkspaceTables, getCurrentWorkspaceId } from "../../../../../lib/workspace";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!env.LINKEDIN_CLIENT_ID || !env.LINKEDIN_CLIENT_SECRET || !env.LINKEDIN_REDIRECT_URI || !env.TOKEN_ENCRYPTION_KEY) {
    return NextResponse.redirect(new URL("/?integration=linkedin-unconfigured", request.url));
  }
  await ensureWorkspaceTables();
  const workspaceId = await getCurrentWorkspaceId();
  const state = crypto.randomUUID();
  await env.DB.prepare("DELETE FROM oauth_states WHERE expires_at < ?").bind(Date.now()).run();
  await env.DB.prepare("INSERT INTO oauth_states (state, workspace_id, expires_at) VALUES (?, ?, ?)")
    .bind(state, workspaceId, Date.now() + 10 * 60 * 1000).run();
  const authorize = new URL("https://www.linkedin.com/oauth/v2/authorization");
  authorize.searchParams.set("response_type", "code");
  authorize.searchParams.set("client_id", env.LINKEDIN_CLIENT_ID);
  authorize.searchParams.set("redirect_uri", env.LINKEDIN_REDIRECT_URI);
  authorize.searchParams.set("state", state);
  authorize.searchParams.set("scope", env.LINKEDIN_SCOPES ?? "openid profile email w_member_social");
  return NextResponse.redirect(authorize);
}
