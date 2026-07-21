import { Post, WorkspaceData } from "../app/data";

export type FormatInsight = { format: string; posts: number; avgImpressions: number; saveRate: number; engagementRate: number };
export type PerformanceInsight = {
  hasEnoughData: boolean;
  postsAnalyzed: number;
  formats: FormatInsight[];
  bestFormat: string | null;
  bestHourUtc: number | null;
  topHashtags: { tag: string; avgImpressions: number; uses: number }[];
  summary: string;
};

const engagement = (post: Post) => {
  const metric = post.metrics;
  if (!metric || !metric.impressions) return 0;
  return (metric.reactions + metric.comments * 3 + metric.saves * 2) / metric.impressions;
};

/**
 * Real first-party intelligence: everything here is computed from the tenant's
 * own published-post metrics. No invented numbers, no external trend claims.
 * Comments and saves are weighted above reactions because that is what LinkedIn rewards.
 */
export function analyzePerformance(data: WorkspaceData): PerformanceInsight {
  const published = data.posts.filter(post => post.status === "Published" && post.metrics && post.metrics.impressions > 0);
  const postsAnalyzed = published.length;

  const formatMap = new Map<string, Post[]>();
  for (const post of published) formatMap.set(post.format, [...(formatMap.get(post.format) ?? []), post]);
  const formats: FormatInsight[] = [...formatMap.entries()].map(([format, posts]) => {
    const impressions = posts.reduce((sum, post) => sum + post.metrics!.impressions, 0);
    const saves = posts.reduce((sum, post) => sum + post.metrics!.saves, 0);
    return {
      format,
      posts: posts.length,
      avgImpressions: Math.round(impressions / posts.length),
      saveRate: impressions > 0 ? saves / impressions : 0,
      engagementRate: posts.reduce((sum, post) => sum + engagement(post), 0) / posts.length,
    };
  }).sort((a, b) => b.engagementRate - a.engagementRate);

  // Best posting hour, from when the winning posts were actually published.
  const hourScores = new Map<number, { total: number; count: number }>();
  for (const post of published) {
    const when = post.publishedAt ?? post.scheduledFor;
    if (!when) continue;
    const hour = new Date(when).getUTCHours();
    const entry = hourScores.get(hour) ?? { total: 0, count: 0 };
    entry.total += engagement(post);
    entry.count += 1;
    hourScores.set(hour, entry);
  }
  const bestHour = [...hourScores.entries()].map(([hour, s]) => ({ hour, avg: s.total / s.count })).sort((a, b) => b.avg - a.avg)[0];

  // Which hashtags actually correlate with reach on this account.
  const tagScores = new Map<string, { total: number; count: number }>();
  for (const post of published) {
    for (const tag of post.hashtags) {
      const entry = tagScores.get(tag) ?? { total: 0, count: 0 };
      entry.total += post.metrics!.impressions;
      entry.count += 1;
      tagScores.set(tag, entry);
    }
  }
  const topHashtags = [...tagScores.entries()]
    .map(([tag, s]) => ({ tag, avgImpressions: Math.round(s.total / s.count), uses: s.count }))
    .sort((a, b) => b.avgImpressions - a.avgImpressions)
    .slice(0, 5);

  const hasEnoughData = postsAnalyzed >= 5 && formats.length >= 2;
  const bestFormat = formats[0]?.format ?? null;
  const summary = hasEnoughData && bestFormat
    ? `${bestFormat} posts are your strongest format (${(formats[0].saveRate * 100).toFixed(1)}% save rate across ${formats[0].posts} posts).${bestHour ? ` Your best-performing posts went out around ${bestHour.hour}:00 UTC.` : ""}`
    : `Not enough published-post data yet (${postsAnalyzed} of 5 needed). Recommendations stay grounded in the LinkedIn playbook until your own numbers can lead.`;

  return { hasEnoughData, postsAnalyzed, formats, bestFormat, bestHourUtc: bestHour?.hour ?? null, topHashtags, summary };
}

/** A short line the generator can use to bias new content toward what already works for this account. */
export function performanceHint(insight: PerformanceInsight) {
  if (!insight.hasEnoughData) return "";
  const parts = [`This account's own data: ${insight.bestFormat} performs best`];
  if (insight.bestHourUtc !== null) parts.push(`best posting hour ~${insight.bestHourUtc}:00 UTC`);
  if (insight.topHashtags.length) parts.push(`hashtags that correlate with reach: ${insight.topHashtags.map(h => h.tag).join(", ")}`);
  return `${parts.join("; ")}. Lean into these.`;
}
