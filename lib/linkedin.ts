import { env } from "cloudflare:workers";
import { Post } from "../app/data";
import { decryptToken } from "./token-crypto";
import { ensureWorkspaceTables } from "./workspace";

export type LinkedInConnection = {
  workspaceId: string;
  accessTokenEncrypted: string;
  refreshTokenEncrypted: string | null;
  memberUrn: string;
  memberName: string | null;
  organizationUrn: string | null;
  scopes: string;
  expiresAt: number;
};

export async function getLinkedInConnection(workspaceId: string) {
  await ensureWorkspaceTables();
  const row = await env.DB.prepare(`SELECT workspace_id, access_token_encrypted, refresh_token_encrypted,
    member_urn, member_name, organization_urn, scopes, expires_at
    FROM linkedin_connections WHERE workspace_id = ?`).bind(workspaceId).first<{
      workspace_id: string; access_token_encrypted: string; refresh_token_encrypted: string | null;
      member_urn: string; member_name: string | null; organization_urn: string | null; scopes: string; expires_at: number;
    }>();
  if (!row) return null;
  return { workspaceId: row.workspace_id, accessTokenEncrypted: row.access_token_encrypted, refreshTokenEncrypted: row.refresh_token_encrypted, memberUrn: row.member_urn, memberName: row.member_name, organizationUrn: row.organization_urn, scopes: row.scopes, expiresAt: row.expires_at } satisfies LinkedInConnection;
}

export async function publishLinkedInPost(connection: LinkedInConnection, post: Post) {
  if (connection.expiresAt <= Date.now()) throw new Error("LinkedIn authorization has expired. Reconnect the account.");
  const author = post.identity === "Founder" ? connection.memberUrn : connection.organizationUrn;
  if (!author) throw new Error("Select an eligible LinkedIn company page before publishing company content.");
  if (post.format !== "Text") throw new Error(`${post.format} publishing is coming soon. Only text posts can publish to LinkedIn right now.`);
  const token = await decryptToken(connection.accessTokenEncrypted);
  const response = await fetch("https://api.linkedin.com/rest/posts", {
    method: "POST",
    headers: {
      "authorization": `Bearer ${token}`,
      "content-type": "application/json",
      "Linkedin-Version": env.LINKEDIN_API_VERSION ?? "202606",
      "X-Restli-Protocol-Version": "2.0.0",
    },
    body: JSON.stringify({
      author,
      commentary: [post.body, post.hashtags.join(" ")].filter(Boolean).join("\n\n"),
      visibility: "PUBLIC",
      distribution: { feedDistribution: "MAIN_FEED", targetEntities: [], thirdPartyDistributionChannels: [] },
      lifecycleState: "PUBLISHED",
      isReshareDisabledByAuthor: false,
    }),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`LinkedIn rejected the post (${response.status}): ${detail.slice(0, 300)}`);
  }
  return response.headers.get("x-restli-id") ?? "published-without-returned-urn";
}
