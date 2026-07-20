import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";
import { Contact, Idea, Post } from "../../data";
import { getCurrentWorkspaceId, loadWorkspace, logEvent, saveWorkspace } from "../../../lib/workspace";
import { runQaChecks } from "../../../lib/qa";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await loadWorkspace());
}

const IDENTITIES = ["Founder", "Company"] as const;
const FORMATS = ["Text", "Image", "Document", "Multi-image"] as const;
const STAGES = ["New", "Reviewing", "Qualified", "Not a lead"] as const;

function asText(value: unknown, fallback = "") {
  return typeof value === "string" ? value.slice(0, 20000) : fallback;
}

function asIso(value: unknown): string | null {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) return null;
  return new Date(Date.parse(value)).toISOString();
}

/** Default publish slot when the user approves without picking one: tomorrow at this hour. */
function defaultSlot() {
  const date = new Date(Date.now() + 24 * 60 * 60 * 1000);
  date.setUTCMinutes(0, 0, 0);
  return date.toISOString();
}

export async function POST(request: Request) {
  const input = await request.json() as { action?: string; payload?: Record<string, unknown> };
  const data = await loadWorkspace();
  const payload = input.payload ?? {};
  const post = data.posts.find(item => item.id === payload.id);

  switch (input.action) {
    case "approvePost": {
      if (!post || post.status !== "Needs approval") return NextResponse.json({ error: "Only drafts waiting for approval can be approved." }, { status: 409 });
      post.status = "Scheduled";
      post.scheduledFor = asIso(payload.scheduledAt) ?? post.scheduledFor ?? defaultSlot();
      delete post.holdReason;
      logEvent(data, "approval", `Approved and scheduled: ${post.title}`, post.id);
      break;
    }
    case "schedulePost": {
      const slot = asIso(payload.scheduledAt);
      if (!post || !slot) return NextResponse.json({ error: "A post and a valid date are required." }, { status: 400 });
      post.scheduledFor = slot;
      delete post.holdReason;
      break;
    }
    case "rejectPost": {
      if (!post) return NextResponse.json({ error: "Post not found." }, { status: 404 });
      post.status = "Rejected";
      post.rejectedAt = new Date().toISOString();
      break;
    }
    case "restorePost": {
      if (!post || post.status !== "Rejected") return NextResponse.json({ error: "Only rejected posts can be restored." }, { status: 409 });
      post.status = "Needs approval";
      delete post.rejectedAt;
      break;
    }
    case "requestRevision": {
      if (!post) return NextResponse.json({ error: "Post not found." }, { status: 404 });
      post.status = "Revision requested";
      post.revisionNote = asText(payload.note).slice(0, 500);
      break;
    }
    case "backToReview": {
      if (!post || post.status !== "Revision requested") return NextResponse.json({ error: "Only revision-requested posts can move back to review." }, { status: 409 });
      post.status = "Needs approval";
      break;
    }
    case "updatePost": {
      if (!post) return NextResponse.json({ error: "Post not found." }, { status: 404 });
      const changes = (payload.changes ?? {}) as Record<string, unknown>;
      const previous = { id: crypto.randomUUID(), body: post.body, note: asText(payload.note, "Manual edit").slice(0, 200), createdAt: new Date().toISOString() };
      post.title = asText(changes.title, post.title).slice(0, 300);
      post.body = asText(changes.body, post.body);
      post.cta = asText(changes.cta, post.cta ?? "");
      if (Array.isArray(changes.hashtags)) post.hashtags = changes.hashtags.filter((tag): tag is string => typeof tag === "string").slice(0, 10);
      post.versions = [previous, ...(post.versions ?? [])].slice(0, 20);
      const result = await runQaChecks(post, data);
      post.qa = result.qa;
      post.qaNotes = result.notes;
      break;
    }
    case "approveStrategy": {
      if (!data.themes.some(theme => theme.selected)) return NextResponse.json({ error: "Select at least one theme before approving the strategy." }, { status: 409 });
      data.workspace.strategyApproved = true;
      data.workspace.strategyVersion += 1;
      break;
    }
    case "approveIdea": {
      const idea = data.ideas.find(item => item.id === payload.id);
      if (!idea || idea.status === "Produced") return NextResponse.json({ error: "Idea not found or already produced." }, { status: 409 });
      idea.status = "Produced";
      const produced = postFromIdea(idea);
      const result = await runQaChecks(produced, data);
      produced.qa = result.qa;
      produced.qaNotes = result.notes;
      data.posts = [produced, ...data.posts];
      break;
    }
    case "rejectIdea":
      data.ideas = data.ideas.map(idea => idea.id === payload.id ? { ...idea, status: "Rejected" as Idea["status"] } : idea);
      break;
    case "toggleTheme":
      data.themes = data.themes.map(theme => theme.id === payload.id ? { ...theme, selected: !theme.selected } : theme);
      data.workspace.strategyApproved = false;
      break;
    case "saveBrief": {
      const brief = payload as Record<string, unknown>;
      data.brief = {
        ...data.brief,
        positioning: asText(brief.positioning, data.brief.positioning),
        audience: asText(brief.audience, data.brief.audience),
        founderVoice: asText(brief.founderVoice, data.brief.founderVoice),
        companyVoice: asText(brief.companyVoice, data.brief.companyVoice),
        preferredLanguage: asText(brief.preferredLanguage, data.brief.preferredLanguage),
        version: data.brief.version + 1,
        approvedAt: null,
      };
      data.workspace.briefApproved = false;
      break;
    }
    case "approveBrief":
      data.workspace.briefApproved = true;
      data.brief.approvedAt = new Date().toISOString();
      break;
    case "completeOnboarding": {
      const form = payload as Record<string, unknown>;
      data.workspace = {
        ...data.workspace,
        name: asText(form.name, data.workspace.name).slice(0, 120),
        website: asText(form.website, data.workspace.website).slice(0, 300),
        industry: asText(form.industry, data.workspace.industry).slice(0, 120),
        primaryMarket: asText(form.primaryMarket, data.workspace.primaryMarket).slice(0, 200),
        timezone: asText(form.timezone, data.workspace.timezone).slice(0, 60),
        founderLinkedInUrl: asText(form.founderLinkedInUrl, data.workspace.founderLinkedInUrl).slice(0, 300),
        companyLinkedInUrl: asText(form.companyLinkedInUrl, data.workspace.companyLinkedInUrl).slice(0, 300),
        onboardingComplete: true,
        setupProgress: 88,
        briefApproved: false,
      };
      data.brief = { ...data.brief, positioning: asText(form.positioning, data.brief.positioning), audience: asText(form.audience, data.brief.audience), approvedAt: null, version: data.brief.version + 1 };
      break;
    }
    case "updateContact": {
      const stage = payload.stage;
      if (!STAGES.includes(stage as Contact["stage"])) return NextResponse.json({ error: "Unknown contact stage." }, { status: 400 });
      data.contacts = data.contacts.map(contact => contact.id === payload.id ? { ...contact, stage: stage as Contact["stage"] } : contact);
      break;
    }
    case "createPost": {
      const identity = IDENTITIES.includes(payload.identity as Post["identity"]) ? payload.identity as Post["identity"] : "Founder";
      const format = FORMATS.includes(payload.format as Post["format"]) ? payload.format as Post["format"] : "Text";
      const created: Post = {
        id: crypto.randomUUID(),
        identity,
        format,
        theme: asText(payload.theme, data.themes.find(theme => theme.selected)?.name ?? "General").slice(0, 120),
        title: asText(payload.title, "A new point of view").slice(0, 300),
        body: asText(payload.body, "Draft this idea using the approved voice and business brief."),
        status: "Needs approval",
        scheduledFor: asIso(payload.scheduledAt),
        why: "Created from your approved brief and current theme mix. Add source context before approval.",
        hashtags: [],
        versions: [{ id: crypto.randomUUID(), body: asText(payload.body, "New draft"), note: "Manual brief", createdAt: new Date().toISOString() }],
      };
      const result = await runQaChecks(created, data);
      created.qa = result.qa;
      created.qaNotes = result.notes;
      data.posts = [created, ...data.posts];
      break;
    }
    case "deleteSource": {
      const source = data.sources.find(item => item.id === payload.id);
      if (!source) return NextResponse.json({ error: "Source not found." }, { status: 404 });
      const workspaceId = await getCurrentWorkspaceId();
      const row = await env.DB.prepare("SELECT object_key FROM uploaded_assets WHERE id = ? AND workspace_id = ?").bind(source.id, workspaceId).first<{ object_key: string }>();
      if (row) {
        await (env as unknown as { FILES: R2Bucket }).FILES.delete(row.object_key);
        await env.DB.prepare("DELETE FROM uploaded_assets WHERE id = ? AND workspace_id = ?").bind(source.id, workspaceId).run();
      }
      data.sources = data.sources.filter(item => item.id !== source.id);
      break;
    }
    case "markEventsRead":
      data.events = data.events.map(event => ({ ...event, read: true }));
      break;
    default:
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  await saveWorkspace(data);
  return NextResponse.json(data);
}

function postFromIdea(idea: Idea): Post {
  const founderBody = `${idea.hook}\n\nThe useful lesson is not to collect more information. It is to preserve the context around the moment a customer problem appears.\n\nThat changes what a team can confidently act on.\n\n${idea.cta}`;
  const companyBody = `${idea.hook}\n\n${idea.angle}\n\nThis framework is grounded in the approved business brief and customer evidence.\n\n${idea.cta}`;
  return {
    id: crypto.randomUUID(),
    identity: idea.identity,
    format: idea.format,
    theme: idea.theme,
    title: idea.hook,
    hook: idea.hook,
    body: idea.identity === "Founder" ? founderBody : companyBody,
    cta: idea.cta,
    status: "Needs approval",
    scheduledFor: null,
    why: `${idea.evidence}. This draft was produced only after idea approval.`,
    hashtags: [],
    altText: `${idea.format} post about ${idea.theme}.`,
    versions: [{ id: crypto.randomUUID(), body: "Produced from approved idea", note: "Producer agent", createdAt: new Date().toISOString() }],
    creativeSlides: idea.format !== "Text" ? [
      { heading: idea.hook, copy: idea.angle },
      { heading: "01", copy: "Find where the signal first appears" },
      { heading: "02", copy: "Preserve the customer context" },
      { heading: "03", copy: "Connect evidence to a decision" },
      { heading: "Next step", copy: idea.cta },
    ].slice(0, idea.format === "Image" ? 1 : idea.format === "Multi-image" ? 3 : 5) : undefined,
  };
}
