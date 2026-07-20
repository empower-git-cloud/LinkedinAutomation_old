import { NextResponse } from "next/server";
import { Contact, Idea, Post, WorkspaceData } from "../../data";
import { loadWorkspace, saveWorkspace } from "../../../lib/workspace";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await loadWorkspace());
}

export async function POST(request: Request) {
  const input = await request.json() as { action?: string; payload?: Record<string, unknown> };
  const data = await loadWorkspace();
  const payload = input.payload ?? {};

  switch (input.action) {
    case "approvePost":
      data.posts = data.posts.map(post => post.id === payload.id ? { ...post, status: "Scheduled" } : post);
      break;
    case "rejectPost":
      data.posts = data.posts.filter(post => post.id !== payload.id);
      break;
    case "updatePost":
      data.posts = data.posts.map(post => {
        if (post.id !== payload.id) return post;
        const previous = { id: crypto.randomUUID(), body: post.body, note: String(payload.note ?? "Manual edit"), createdAt: new Date().toISOString() };
        return { ...post, ...(payload.changes as Partial<Post>), versions: [previous, ...(post.versions ?? [])] };
      });
      break;
    case "schedulePost":
      data.posts = data.posts.map(post => post.id === payload.id ? { ...post, scheduledFor: String(payload.scheduledFor), status: "Scheduled" } : post);
      break;
    case "requestRevision":
      data.posts = data.posts.map(post => post.id === payload.id ? { ...post, status: "Revision requested" } : post);
      break;
    case "approveStrategy":
      data.workspace.strategyApproved = true;
      data.workspace.strategyVersion += 1;
      break;
    case "approveRecommendations":
      data.workspace.strategyApproved = true;
      data.workspace.strategyVersion += 1;
      data.themes = data.themes.map(theme => theme.name === "Revenue intelligence" ? { ...theme, score: Math.min(99, theme.score + 3) } : theme);
      break;
    case "approveIdea": {
      const idea = data.ideas.find(item => item.id === payload.id);
      if (idea) {
        idea.status = "Produced";
        data.posts = [postFromIdea(idea), ...data.posts];
      }
      break;
    }
    case "rejectIdea":
      data.ideas = data.ideas.map(idea => idea.id === payload.id ? { ...idea, status: "Rejected" } : idea);
      break;
    case "addIdea":
      data.ideas = [payload as unknown as Idea, ...data.ideas];
      break;
    case "toggleTheme":
      data.themes = data.themes.map(theme => theme.id === payload.id ? { ...theme, selected: !theme.selected } : theme);
      break;
    case "saveBrief":
      data.brief = { ...data.brief, ...(payload as Partial<WorkspaceData["brief"]>), version: data.brief.version + 1, approvedAt: null };
      data.workspace.briefApproved = false;
      break;
    case "approveBrief":
      data.workspace.briefApproved = true;
      data.brief.approvedAt = new Date().toISOString();
      break;
    case "completeOnboarding":
      data.workspace = { ...data.workspace, ...(payload as Partial<WorkspaceData["workspace"]>), onboardingComplete: true, setupProgress: 88 };
      data.workspace.briefApproved = false;
      data.brief = { ...data.brief, positioning: String(payload.positioning ?? data.brief.positioning), audience: String(payload.audience ?? data.brief.audience), approvedAt: null, version: data.brief.version + 1 };
      break;
    case "updateContact":
      data.contacts = data.contacts.map(contact => contact.id === payload.id ? { ...contact, stage: payload.stage as Contact["stage"] } : contact);
      break;
    case "createPost":
      data.posts = [payload as unknown as Post, ...data.posts];
      break;
    case "replace":
      Object.assign(data, payload as unknown as WorkspaceData);
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
    scheduledFor: "Unscheduled",
    why: `${idea.evidence}. This draft was produced only after idea approval.`,
    hashtags: [],
    altText: `${idea.format} post about ${idea.theme}.`,
    qa: { voice: true, claims: true, duplication: true, links: true },
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
