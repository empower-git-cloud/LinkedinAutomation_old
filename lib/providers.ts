import { env } from "cloudflare:workers";

/**
 * Pluggable external data providers. LinkedIn has no official API for a member's
 * work history or for trending content, so these are the compliant seams where a
 * paid provider (behind the tenant's own key) can supply real data. When no key
 * is configured they return null — and callers say so honestly rather than faking it.
 */

export type EnrichedProfile = {
  fullName?: string;
  headline?: string;
  role?: string;
  experienceSummary?: string;
  companies?: string[];
};

function providerEnv() {
  return env as { PROFILE_PROVIDER_URL?: string; PROFILE_PROVIDER_API_KEY?: string; TRENDS_PROVIDER_URL?: string; TRENDS_PROVIDER_API_KEY?: string };
}

export function profileProviderConfigured() {
  const e = providerEnv();
  return Boolean(e.PROFILE_PROVIDER_URL && e.PROFILE_PROVIDER_API_KEY);
}

export function trendsProviderConfigured() {
  const e = providerEnv();
  return Boolean(e.TRENDS_PROVIDER_URL && e.TRENDS_PROVIDER_API_KEY);
}

/**
 * Enrich a public LinkedIn profile URL via a configured compliant provider
 * (e.g. a Proxycurl-style endpoint). Returns null when no provider is set.
 */
export async function enrichLinkedInProfile(profileUrl: string): Promise<EnrichedProfile | null> {
  const e = providerEnv();
  if (!e.PROFILE_PROVIDER_URL || !e.PROFILE_PROVIDER_API_KEY || !profileUrl) return null;
  try {
    const url = new URL(e.PROFILE_PROVIDER_URL);
    url.searchParams.set("url", profileUrl);
    const response = await fetch(url, { headers: { authorization: `Bearer ${e.PROFILE_PROVIDER_API_KEY}` } });
    if (!response.ok) return null;
    const data = await response.json() as Record<string, unknown>;
    const experiences = Array.isArray(data.experiences) ? data.experiences as Record<string, unknown>[] : [];
    return {
      fullName: typeof data.full_name === "string" ? data.full_name : undefined,
      headline: typeof data.headline === "string" ? data.headline : undefined,
      role: typeof data.occupation === "string" ? data.occupation : undefined,
      experienceSummary: experiences.slice(0, 6).map(x => `${x.title ?? ""} at ${x.company ?? ""}`).filter(s => s.trim() !== " at ").join("; ") || undefined,
      companies: [...new Set(experiences.map(x => String(x.company ?? "")).filter(Boolean))].slice(0, 12),
    };
  } catch {
    return null;
  }
}

/**
 * Fetch real trend/relevance signals for a topic from a configured social-listening
 * provider. Returns null when no provider is set (callers fall back to first-party
 * data + the encoded playbook, and label it honestly).
 */
export async function fetchLinkedInTrends(topic: string): Promise<string[] | null> {
  const e = providerEnv();
  if (!e.TRENDS_PROVIDER_URL || !e.TRENDS_PROVIDER_API_KEY || !topic) return null;
  try {
    const url = new URL(e.TRENDS_PROVIDER_URL);
    url.searchParams.set("q", topic);
    const response = await fetch(url, { headers: { authorization: `Bearer ${e.TRENDS_PROVIDER_API_KEY}` } });
    if (!response.ok) return null;
    const data = await response.json() as { trends?: unknown };
    return Array.isArray(data.trends) ? (data.trends as unknown[]).map(String).slice(0, 8) : null;
  } catch {
    return null;
  }
}
