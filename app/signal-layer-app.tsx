"use client";

import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import { ActivityEvent, Contact, Idea, Identity, Post, Theme, WorkspaceData, emptyWorkspace, formatDateTime, formatTime, sameLocalDay } from "./data";

type Tab = "Overview" | "Strategy" | "Content" | "Calendar" | "Performance" | "Contacts" | "Knowledge" | "Settings";
type ContentView = "Ideas" | "Drafts" | "Rejected";

type IntegrationStatus = {
  appConfigured: boolean; encryptionConfigured: boolean; connected: boolean; expired: boolean;
  memberName: string | null; memberUrn: string | null; organizationUrn: string | null;
  scopes: string[]; expiresAt: number | null; apiVersion: string; openaiConfigured: boolean; openaiModel: string;
};

type Toast = { message: string; undo?: () => void };
type Banner = { tone: "success" | "error" | "info"; message: string };

const navItems: { label: Tab; mark: string }[] = [
  { label: "Overview", mark: "⌂" },
  { label: "Strategy", mark: "◇" },
  { label: "Content", mark: "▤" },
  { label: "Calendar", mark: "□" },
  { label: "Performance", mark: "↗" },
  { label: "Contacts", mark: "◎" },
  { label: "Knowledge", mark: "≡" },
  { label: "Settings", mark: "⚙" },
];

const INTEGRATION_MESSAGES: Record<string, Banner> = {
  "linkedin-connected": { tone: "success", message: "Your LinkedIn account is now connected." },
  "linkedin-denied": { tone: "error", message: "You cancelled the LinkedIn sign-in. Open Settings and click Connect LinkedIn to try again." },
  "linkedin-expired": { tone: "error", message: "Your sign-in link expired. Please try connecting again." },
  "linkedin-invalid": { tone: "error", message: "The sign-in response was incomplete. Please try connecting again." },
  "linkedin-token-failed": { tone: "error", message: "LinkedIn did not accept the sign-in. Please try again in a moment." },
  "linkedin-profile-failed": { tone: "error", message: "Connected, but your LinkedIn profile could not be read. Please try again." },
  "linkedin-unconfigured": { tone: "error", message: "LinkedIn is not set up on this server yet. An administrator needs to add the LinkedIn app keys." },
};

function formatNumber(value: number) {
  return value >= 1000 ? `${(value / 1000).toFixed(value >= 10000 ? 1 : 2)}k` : String(value);
}

function toLocalInput(iso: string | null) {
  if (!iso) return "";
  const date = new Date(iso);
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function IdentityBadge({ identity }: { identity: Identity }) {
  return <span className={`identity-badge ${identity.toLowerCase()}`}>{identity === "Founder" ? "F" : "C"} {identity}</span>;
}

function StatusPill({ status }: { status: Post["status"] }) {
  return <span className={`status-pill status-${status.toLowerCase().replaceAll(" ", "-")}`}>{status}</span>;
}

function AppHeader({ title, onCreate, workspaceName, live, unread, openActivity }: { title: string; onCreate: () => void; workspaceName: string; live: boolean; unread: number; openActivity: () => void }) {
  return (
    <header className="topbar">
      <div>
        <p className="eyebrow">{workspaceName}</p>
        <h1>{title}</h1>
      </div>
      <div className="topbar-actions">
        <span className="mode-pill"><span />{live ? "Live publishing" : "Demo workspace"}</span>
        <button className="icon-button" aria-label="Activity log" onClick={openActivity}>{unread > 0 ? unread : "◔"}</button>
        <button className="primary-button" onClick={onCreate}><b>＋</b> Create post</button>
      </div>
    </header>
  );
}

function Sidebar({ tab, setTab, setupProgress, userName, pendingPosts, newContacts, onLogout }: { tab: Tab; setTab: (tab: Tab) => void; setupProgress: number; userName: string; pendingPosts: number; newContacts: number; onLogout: () => void }) {
  return (
    <aside className="sidebar">
      <button className="brand" onClick={() => setTab("Overview")} aria-label="Go to overview">
        <span className="brand-mark"><i /><i /><i /></span>
        <span>SignalLayer</span>
      </button>
      <nav aria-label="Main navigation">
        {navItems.map((item) => (
          <button key={item.label} className={tab === item.label ? "active" : ""} onClick={() => setTab(item.label)}>
            <span className="nav-mark">{item.mark}</span>{item.label}
            {item.label === "Content" && pendingPosts > 0 && <small>{pendingPosts}</small>}
            {item.label === "Contacts" && newContacts > 0 && <small className="warm">{newContacts}</small>}
          </button>
        ))}
      </nav>
      <div className="sidebar-spacer" />
      <div className="setup-card">
        <div className="setup-row"><span>Workspace setup</span><b>{setupProgress}%</b></div>
        <div className="progress-track"><span style={{ width: `${setupProgress}%` }} /></div>
        <p>Connect LinkedIn to enable live publishing and analytics.</p>
        <button onClick={() => setTab("Settings")}>Complete setup →</button>
      </div>
      <div className="profile-row">
        <span className="avatar">{userName.slice(0, 2).toUpperCase()}</span>
        <span><b>{userName}</b><small>Signed in</small></span>
        <button className="signout-button" onClick={onLogout} aria-label="Sign out">⎋</button>
      </div>
    </aside>
  );
}

function Overview({ data, setTab, approvePost, startOnboarding, timezone }: { data: WorkspaceData; setTab: (t: Tab) => void; approvePost: (id: string) => void; startOnboarding: () => void; timezone: string }) {
  const pending = data.posts.filter((post) => post.status === "Needs approval");
  const published = data.posts.filter((post) => post.status === "Published");
  const totalImpressions = published.reduce((sum, p) => sum + (p.metrics?.impressions ?? 0), 0);
  const totalReactions = published.reduce((sum, p) => sum + (p.metrics?.reactions ?? 0), 0);
  const totalComments = published.reduce((sum, p) => sum + (p.metrics?.comments ?? 0), 0);
  const featured = pending[0];
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const sourceNote = published.length > 0 ? `from ${published.length} published posts` : "No published posts yet";
  const weekStart = new Date(); weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7)); weekStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(weekStart.getTime() + 7 * 864e5);
  const inThisWeek = (post: Post) => post.scheduledFor !== null && Date.parse(post.scheduledFor) >= weekStart.getTime() && Date.parse(post.scheduledFor) < weekEnd.getTime();
  const founderWeek = data.posts.filter(p => p.identity === "Founder" && inThisWeek(p) && (p.status === "Scheduled" || p.status === "Published")).length;
  const companyWeek = data.posts.filter(p => p.identity === "Company" && inThisWeek(p) && (p.status === "Scheduled" || p.status === "Published")).length;
  const documentPosts = published.filter(p => p.format === "Document" && p.metrics);
  const textPosts = published.filter(p => p.format === "Text" && p.metrics);
  const saveRate = (posts: Post[]) => posts.reduce((sum, p) => sum + (p.metrics?.saves ?? 0), 0) / Math.max(1, posts.reduce((sum, p) => sum + (p.metrics?.impressions ?? 0), 0));
  const insightRatio = documentPosts.length >= 2 && textPosts.length >= 2 && saveRate(textPosts) > 0 ? saveRate(documentPosts) / saveRate(textPosts) : null;
  const upcoming = data.posts.filter(p => p.status === "Scheduled" && p.scheduledFor).sort((a, b) => Date.parse(a.scheduledFor!) - Date.parse(b.scheduledFor!)).slice(0, 3);
  return (
    <div className="page-stack overview-page">
      <section className="welcome-row">
        <div><h2>{greeting}.</h2><p>{pending.length > 0 ? `${pending.length} post${pending.length === 1 ? "" : "s"} need${pending.length === 1 ? "s" : ""} your review.` : "Nothing is waiting for your review."}</p></div>
        <div className="date-chip">{weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – {new Date(weekEnd.getTime() - 864e5).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</div>
      </section>

      {!data.workspace.onboardingComplete && (
        <section className="panel reminder-card"><div><b>Finish setting up your workspace</b><p>Two minutes of setup helps every draft sound like your business.</p></div><button className="primary-button compact" onClick={startOnboarding}>Continue setup</button></section>
      )}

      <section className="metrics-grid">
        <article className="metric-card"><span className="metric-icon blue">↗</span><div><p>Impressions</p><strong>{formatNumber(totalImpressions)}</strong><small><em>{sourceNote}</em></small></div></article>
        <article className="metric-card"><span className="metric-icon coral">♥</span><div><p>Reactions</p><strong>{totalReactions}</strong><small><em>{sourceNote}</em></small></div></article>
        <article className="metric-card"><span className="metric-icon green">◌</span><div><p>Comments</p><strong>{totalComments}</strong><small><em>{sourceNote}</em></small></div></article>
        <article className="metric-card"><span className="metric-icon violet">◎</span><div><p>Qualified contacts</p><strong>{data.contacts.filter(c => c.stage !== "Not a lead").length}</strong><small><em>{sourceNote}</em></small></div></article>
      </section>

      <section className="main-grid">
        <article className="panel approval-panel">
          <div className="panel-heading">
            <div><span className="section-kicker">Approval queue</span><h3>{pending.length} post{pending.length === 1 ? " is" : "s are"} waiting for you</h3></div>
            <button className="text-button" onClick={() => setTab("Content")}>Review all →</button>
          </div>
          {featured ? (
            <div className="featured-post">
              <div className="post-meta"><IdentityBadge identity={featured.identity} /><span>{featured.format}</span><span>{featured.theme}</span></div>
              <h4>{featured.title}</h4>
              <p className="post-excerpt">{featured.body}</p>
              <div className="why-box"><b>✦ Why this post</b><p>{featured.why}</p></div>
              <div className="approval-actions">
                <span>Planned for <b>{formatDateTime(featured.scheduledFor, timezone)}</b></span>
                <button className="secondary-button" onClick={() => setTab("Content")}>Open in review</button>
                <button className="primary-button compact" onClick={() => approvePost(featured.id)}>Approve & schedule</button>
              </div>
            </div>
          ) : <div className="empty-state"><b>All caught up.</b><p>Your next content batch is ready to generate.</p></div>}
        </article>

        <aside className="right-stack">
          <article className="panel cadence-panel">
            <div className="panel-heading tight"><div><span className="section-kicker">This week</span><h3>Publishing rhythm</h3></div><span className="health-dot">{founderWeek + companyWeek > 0 ? "On track" : "Quiet week"}</span></div>
            <div className="cadence-row"><IdentityBadge identity="Founder" /><div className="mini-progress"><span style={{ width: `${Math.min(100, (founderWeek / 3) * 100)}%` }} /></div><b>{founderWeek} / 3</b></div>
            <div className="cadence-row"><IdentityBadge identity="Company" /><div className="mini-progress company"><span style={{ width: `${Math.min(100, (companyWeek / 2) * 100)}%` }} /></div><b>{companyWeek} / 2</b></div>
            <button className="full-text-button" onClick={() => setTab("Calendar")}>View calendar <span>→</span></button>
          </article>
          <article className="panel insight-panel">
            <span className="section-kicker">✦ Weekly insight</span>
            {insightRatio ? (
              <><h3>Document posts are earning attention.</h3><p>Your document posts received <b>{insightRatio.toFixed(1)}× more saves</b> per impression than text posts.</p></>
            ) : (
              <><h3>Not enough data yet.</h3><p>Publish a few posts in different formats and real comparisons will appear here — never invented ones.</p></>
            )}
            <button onClick={() => setTab("Performance")}>See the evidence →</button>
          </article>
        </aside>
      </section>

      <section className="bottom-grid">
        <article className="panel upcoming-panel">
          <div className="panel-heading"><div><span className="section-kicker">Coming up</span><h3>Next on your calendar</h3></div><button className="text-button" onClick={() => setTab("Calendar")}>Open calendar →</button></div>
          {upcoming.length === 0 && <div className="empty-state"><b>Nothing scheduled.</b><p>Approve a draft to put it on the calendar.</p></div>}
          {upcoming.map(post => {
            const date = new Date(post.scheduledFor!);
            return (
              <div className="upcoming-row" key={post.id}>
                <div className="date-box"><b>{date.getDate()}</b><span>{date.toLocaleDateString("en-US", { month: "short" }).toUpperCase()}</span></div>
                <div className="upcoming-content"><IdentityBadge identity={post.identity} /><h4>{post.title}</h4><p>{post.theme} · {post.format}</p></div>
                <div className="upcoming-time"><b>{formatTime(post.scheduledFor, timezone)}</b><span>Scheduled</span></div>
              </div>
            );
          })}
        </article>
        <article className="panel contacts-preview">
          <div className="panel-heading"><div><span className="section-kicker">Conversation signals</span><h3>People worth reviewing</h3></div><button className="text-button" onClick={() => setTab("Contacts")}>View all →</button></div>
          {data.contacts.slice(0, 2).map(contact => (
            <div className="mini-contact" key={contact.id}><span className="avatar alt">{contact.initials}</span><div><b>{contact.name}</b><p>{contact.comment}</p></div><span className={`intent intent-${contact.intent.toLowerCase()}`}>{contact.intent}</span></div>
          ))}
        </article>
      </section>
    </div>
  );
}

function Strategy({ data, toggleTheme, approveStrategy, suggestThemes, buildPlan, suggestingThemes, building }: { data: WorkspaceData; toggleTheme: (id: string) => void; approveStrategy: () => void; suggestThemes: () => void; buildPlan: (days: 1 | 3 | 7) => void; suggestingThemes: boolean; building: boolean }) {
  const [days, setDays] = useState<1 | 3 | 7>(3);
  const selected = data.themes.filter(t => t.selected);
  const individual = data.workspace.accountType === "Individual";
  const source = individual ? "your role and experience" : "your website and knowledge base";
  return (
    <div className="page-stack">
      <section className="section-intro"><div><span className="section-kicker">Strategy version {data.workspace.strategyVersion} · {data.workspace.strategyApproved ? "approved" : "draft"} · {data.workspace.accountType}</span><h2>Themes built from {source}.</h2><p>SignalLayer analyses {source} and what is currently working on LinkedIn, then suggests themes. Pick one and build a plan.</p></div><button className="secondary-button" onClick={suggestThemes} disabled={suggestingThemes}>{suggestingThemes ? "Analysing…" : "✦ Suggest themes"}</button></section>
      <div className="strategy-layout">
        <section className="theme-grid">
          {data.themes.map(theme => <ThemeCard key={theme.id} theme={theme} toggleTheme={toggleTheme} />)}
          {data.themes.length === 0 && <div className="panel empty-state"><b>No themes yet.</b><p>Click “Suggest themes” to analyse {source} and what’s working on LinkedIn.</p></div>}
        </section>
        <aside className="panel strategy-summary">
          <span className="section-kicker">Selected plan</span><h3>{selected.length} active theme{selected.length === 1 ? "" : "s"}</h3>
          <div className="mix-visual">{selected.map((t, i) => <span key={t.id} style={{ background: t.color, width: `${i === 0 ? 31 : 23}%` }} />)}</div>
          {selected.map(theme => <div className="theme-legend" key={theme.id}><i style={{ background: theme.color }} /><span>{theme.name}</span><b>{theme.fit}</b></div>)}
          <hr />
          <h4>Build a content plan</h4>
          <p className="build-help">Choose how many days to build for the selected theme.</p>
          <div className="period-grid">{([1, 3, 7] as const).map(option => <button key={option} className={days === option ? "active" : ""} onClick={() => setDays(option)}>{option} day{option > 1 ? "s" : ""}</button>)}</div>
          {selected.length === 0 && <p className="strategy-hint">Select a theme to build content.</p>}
          <button className="primary-button full" onClick={() => buildPlan(days)} disabled={selected.length === 0 || building}>{building ? "Building your plan…" : `Build ${days}-day plan`}</button>
          <hr />
          {!data.workspace.strategyApproved && selected.length > 0 && <p className="strategy-hint">Theme changes reset approval. Re-approve to version your strategy.</p>}
          <button className="secondary-button full" onClick={approveStrategy} disabled={selected.length === 0}>Approve this strategy</button>
        </aside>
      </div>
    </div>
  );
}

function ThemeCard({ theme, toggleTheme }: { theme: Theme; toggleTheme: (id: string) => void }) {
  return (
    <article className={`theme-card ${theme.selected ? "selected" : ""}`}>
      <button className="theme-toggle" onClick={() => toggleTheme(theme.id)} aria-label={`${theme.selected ? "Remove" : "Select"} ${theme.name}`}>{theme.selected ? "✓" : "+"}</button>
      <div className="theme-score" style={{ color: theme.color }}><span>{theme.score}</span><small>relevance</small></div>
      <IdentityBadge identity={theme.fit === "Company" ? "Company" : "Founder"} />
      {theme.fit === "Both" && <span className="both-label">+ company</span>}
      <h3>{theme.name}</h3><p>{theme.description}</p>
      {theme.whatsWorking && <div className="working-note"><b>↗ Working on LinkedIn</b><span>{theme.whatsWorking}</span></div>}
      <div className="evidence"><b>Grounded in</b><span>{theme.evidence}</span></div>
    </article>
  );
}

function Content({ data, view, setView, approvePost, requestRevision, reviseWithAi, backToReview, rejectPost, restorePost, approveIdea, rejectIdea, generateIdeas, editPost, publishPost, schedulePost, generating, busyIdeas, revising, timezone }: {
  data: WorkspaceData; view: ContentView; setView: (view: ContentView) => void; approvePost: (id: string) => void; requestRevision: (id: string, note: string) => void; reviseWithAi: (id: string) => void; backToReview: (id: string) => void; rejectPost: (id: string) => void; restorePost: (id: string) => void; approveIdea: (id: string) => void; rejectIdea: (id: string) => void; generateIdeas: () => void; editPost: (post: Post) => void; publishPost: (id: string) => void; schedulePost: (id: string, iso: string) => void; generating: boolean; busyIdeas: Set<string>; revising: Set<string>; timezone: string;
}) {
  const [filter, setFilter] = useState<"All" | Identity>("All");
  const [noteFor, setNoteFor] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const active = data.posts.filter(post => post.status !== "Rejected" && (filter === "All" || post.identity === filter));
  const rejected = data.posts.filter(post => post.status === "Rejected" && (filter === "All" || post.identity === filter));
  const visibleIdeas = data.ideas.filter(idea => idea.status !== "Produced" && (filter === "All" || idea.identity === filter));
  const visible = view === "Rejected" ? rejected : active;
  return (
    <div className="page-stack">
      <section className="section-intro"><div><span className="section-kicker">Content workspace</span><h2>Every post, from idea to evidence.</h2><p>Approve the idea before production, then review voice, claims and source context.</p></div><div className="content-toolbar"><div className="segmented">{(["All", "Founder", "Company"] as const).map(x => <button className={filter === x ? "active" : ""} onClick={() => setFilter(x)} key={x}>{x}</button>)}</div><button className="secondary-button" onClick={generateIdeas} disabled={generating}>{generating ? "Strategist is working…" : "✦ Generate ideas"}</button></div></section>
      <div className="subnav">
        <button className={view === "Ideas" ? "active" : ""} onClick={() => setView("Ideas")}>Idea approval <span>{visibleIdeas.filter(i => i.status === "Proposed").length}</span></button>
        <button className={view === "Drafts" ? "active" : ""} onClick={() => setView("Drafts")}>Finished drafts <span>{active.filter(p => p.status === "Needs approval").length}</span></button>
        {rejected.length > 0 && <button className={view === "Rejected" ? "active" : ""} onClick={() => setView("Rejected")}>Rejected <span>{rejected.length}</span></button>}
      </div>
      {view === "Ideas" ? <div className="idea-grid">{visibleIdeas.map(idea => <IdeaCard key={idea.id} idea={idea} busy={busyIdeas.has(idea.id)} approve={() => approveIdea(idea.id)} reject={() => rejectIdea(idea.id)} />)}{visibleIdeas.length === 0 && <div className="panel empty-state"><b>No ideas waiting.</b><p>Generate a fresh evidence-backed batch.</p></div>}</div> : <div className="content-list">
        {visible.length === 0 && <div className="panel empty-state"><b>Nothing here yet.</b><p>{view === "Rejected" ? "Rejected drafts are kept for 30 days." : "Approve an idea or create a post to see drafts."}</p></div>}
        {visible.map(post => (
          <article className="panel content-card" key={post.id}>
            <div className="content-card-head"><div className="post-meta"><IdentityBadge identity={post.identity} /><span>{post.format}</span><span>{post.theme}</span></div><StatusPill status={post.status} /></div>
            <div className="content-card-grid">
              <div><h3>{post.title}</h3><p className="full-body">{post.body}</p><div className="hashtag-row">{post.hashtags.map(tag => <span key={tag}>{tag}</span>)}</div>{post.creativeSlides && <CreativePreview slides={post.creativeSlides} />}</div>
              <div>
                <div className="why-panel"><span className="section-kicker">✦ Strategy note</span><p>{post.why}</p><small>Planned: <b>{formatDateTime(post.scheduledFor, timezone)}</b></small></div>
                {post.qa && <div className="qa-panel"><span className="section-kicker">Brand & claims QA</span>{Object.entries(post.qa).map(([key, value]) => <span key={key} className={value ? "pass" : "fail"}>{value ? "✓" : "!"} {key}</span>)}{(post.qaNotes ?? []).map((entry, index) => <small className="qa-note" key={index}>{entry}</small>)}</div>}
                {post.holdReason && <div className="hold-note"><b>Held:</b> {post.holdReason}</div>}
                {post.status === "Revision requested" && post.revisionNote && <div className="hold-note"><b>Requested change:</b> {post.revisionNote}</div>}
              </div>
            </div>
            {post.status === "Needs approval" && noteFor !== post.id && <div className="content-actions"><button className="danger-text" onClick={() => rejectPost(post.id)}>Reject</button><button className="secondary-button" onClick={() => editPost(post)}>Edit draft</button><button className="secondary-button" onClick={() => { setNoteFor(post.id); setNote(""); }}>Request changes</button><button className="primary-button compact" onClick={() => approvePost(post.id)}>Approve & schedule</button></div>}
            {post.status === "Needs approval" && noteFor === post.id && <div className="content-actions note-form"><input autoFocus value={note} onChange={e => setNote(e.target.value)} placeholder="What should be different?" /><button className="secondary-button" onClick={() => setNoteFor(null)}>Cancel</button><button className="primary-button compact" onClick={() => { requestRevision(post.id, note); setNoteFor(null); }}>Send request</button></div>}
            {post.status === "Revision requested" && <div className="content-actions"><button className="secondary-button" onClick={() => backToReview(post.id)}>Move back to review</button><button className="primary-button compact" onClick={() => reviseWithAi(post.id)} disabled={revising.has(post.id)}>{revising.has(post.id) ? "Revising…" : "✦ Revise with AI"}</button></div>}
            {post.status === "Scheduled" && <div className="content-actions">
              <label className="schedule-control">Publish at <input type="datetime-local" value={toLocalInput(post.scheduledFor)} onChange={e => e.target.value && schedulePost(post.id, new Date(e.target.value).toISOString())} /></label>
              {post.format === "Text" ? <button className="primary-button compact" onClick={() => publishPost(post.id)}>Publish now</button> : <span className="publish-note">{post.format} publishing is coming soon — only text posts can go live today</span>}
            </div>}
            {post.status === "Rejected" && <div className="content-actions"><span className="publish-note">Rejected {post.rejectedAt ? formatDateTime(post.rejectedAt, timezone) : ""} · kept for 30 days</span><button className="secondary-button" onClick={() => restorePost(post.id)}>Restore to queue</button></div>}
          </article>
        ))}
      </div>}
    </div>
  );
}

function IdeaCard({ idea, busy, approve, reject }: { idea: Idea; busy: boolean; approve: () => void; reject: () => void }) {
  return <article className={`panel idea-card ${idea.status.toLowerCase()}`}><div className="content-card-head"><div className="post-meta"><IdentityBadge identity={idea.identity} /><span>{idea.format}</span><span>{idea.theme}</span></div><span className={`idea-status status-${idea.status.toLowerCase()}`}>{busy ? "Producing…" : idea.status}</span></div><h3>{idea.hook}</h3><p>{idea.angle}</p><div className="idea-evidence"><b>Evidence</b><span>{idea.evidence}</span></div><div className="idea-evidence"><b>CTA</b><span>{idea.cta}</span></div><div className="idea-actions"><button className="danger-text" onClick={reject} disabled={busy}>Reject</button><button className="primary-button compact" onClick={approve} disabled={busy}>{busy ? "Writing your draft…" : "Approve & produce"}</button></div></article>;
}

function CreativePreview({ slides }: { slides: { heading: string; copy: string }[] }) {
  return <div className="creative-preview"><div className="creative-preview-head"><span>Document preview</span><b>{slides.length} pages</b></div><div className="slide-strip">{slides.map((slide, index) => <div className="mini-slide" key={`${slide.heading}-${index}`}><small>{String(index + 1).padStart(2, "0")}</small><b>{slide.heading}</b><p>{slide.copy}</p></div>)}</div></div>;
}

function Calendar({ data, approvePost, schedulePost, addSlot, timezone }: { data: WorkspaceData; approvePost: (id: string) => void; schedulePost: (id: string, iso: string) => void; addSlot: (day: Date) => void; timezone: string }) {
  const monday = new Date();
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  monday.setHours(0, 0, 0, 0);
  const days = Array.from({ length: 7 }, (_, index) => new Date(monday.getTime() + index * 864e5));
  const visible = data.posts.filter(p => p.status === "Scheduled" || p.status === "Needs approval");
  return (
    <div className="page-stack">
      <section className="section-intro"><div><span className="section-kicker">This week</span><h2>A balanced rhythm, not a content treadmill.</h2><p>Founder and company posts are spaced to avoid repetition and approval fatigue. Move a post by changing its time right on the card.</p></div><div className="date-chip">{days[0].toLocaleDateString("en-US", { month: "short", day: "numeric" })} – {days[6].toLocaleDateString("en-US", { month: "short", day: "numeric" })}</div></section>
      <section className="calendar-board panel seven">
        {days.map(day => {
          const posts = visible.filter(post => sameLocalDay(post.scheduledFor, day, timezone));
          return (
            <div className="calendar-day" key={day.toISOString()}>
              <div className="calendar-day-head"><span>{day.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase()}</span><b>{day.getDate()}</b></div>
              {posts.map(post => (
                <article className={`calendar-post ${post.identity.toLowerCase()} ${post.status === "Needs approval" ? "pending" : ""}`} key={post.id}>
                  <IdentityBadge identity={post.identity} />
                  <span>{formatTime(post.scheduledFor, timezone)}</span>
                  <h4>{post.title}</h4>
                  <p>{post.format} · {post.theme}</p>
                  <StatusPill status={post.status} />
                  {post.status === "Needs approval" ? <button className="calendar-approve" onClick={() => approvePost(post.id)}>Approve</button> : <input type="datetime-local" className="calendar-move" value={toLocalInput(post.scheduledFor)} onChange={e => e.target.value && schedulePost(post.id, new Date(e.target.value).toISOString())} />}
                </article>
              ))}
              <button className="add-slot" onClick={() => addSlot(day)}>＋ Add slot</button>
            </div>
          );
        })}
      </section>
    </div>
  );
}

function Performance({ data, timezone }: { data: WorkspaceData; timezone: string }) {
  const published = data.posts.filter(p => p.status === "Published");
  const withMetrics = published.filter(p => p.metrics).sort((a, b) => Date.parse(a.publishedAt ?? a.scheduledFor ?? "0") - Date.parse(b.publishedAt ?? b.scheduledFor ?? "0"));
  const maxImpressions = Math.max(1, ...withMetrics.map(p => p.metrics!.impressions));
  const formatStats = (["Document", "Text", "Image", "Multi-image"] as const).map(format => {
    const posts = withMetrics.filter(p => p.format === format);
    const impressions = posts.reduce((sum, p) => sum + p.metrics!.impressions, 0);
    const saves = posts.reduce((sum, p) => sum + p.metrics!.saves, 0);
    return { format, count: posts.length, rate: impressions > 0 ? (saves / impressions) * 100 : 0 };
  }).filter(stat => stat.count >= 2);
  const maxRate = Math.max(0.001, ...formatStats.map(stat => stat.rate));
  const enoughForInsight = withMetrics.length >= 5 && formatStats.length >= 2;
  return (
    <div className="page-stack">
      <section className="section-intro"><div><span className="section-kicker">Performance</span><h2>Learn from patterns, not vanity metrics.</h2><p>Every result is tied back to its theme, format, voice and original hypothesis.</p></div></section>
      <section className="performance-hero panel"><div><span className="section-kicker">Weekly strategy review · Gate 4</span>
        {enoughForInsight ? (
          <><h3>{formatStats[0].format} posts lead on saves.</h3><p><b>Observed:</b> {formatStats[0].format.toLowerCase()} posts earn a {formatStats[0].rate.toFixed(1)}% save rate across {formatStats[0].count} posts — your strongest format so far. Based only on your real synced metrics.</p></>
        ) : (
          <><h3>Not enough data for a review yet.</h3><p>The weekly review appears after at least five published posts with synced metrics — so every recommendation is backed by your real numbers, never invented ones.</p></>
        )}
      </div></section>
      <section className="performance-grid">
        <article className="panel chart-panel"><div className="panel-heading"><div><span className="section-kicker">Impressions</span><h3>Audience attention</h3></div>{withMetrics.length > 0 && <b className="chart-total">{formatNumber(withMetrics.reduce((sum, p) => sum + p.metrics!.impressions, 0))}</b>}</div>
          {withMetrics.length === 0 ? <div className="empty-state"><b>No metrics yet.</b><p>Publish your first post to start seeing results here.</p></div> : (
            <><div className="chart-bars">{withMetrics.slice(-8).map(post => <div className="chart-bar" key={post.id} title={`${post.title}: ${formatNumber(post.metrics!.impressions)} impressions`}><i style={{ height: `${Math.max(4, (post.metrics!.impressions / maxImpressions) * 100)}%` }} /><span>{new Date(post.publishedAt ?? post.scheduledFor ?? 0).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span></div>)}</div></>
          )}
        </article>
        <article className="panel format-panel"><span className="section-kicker">Format effectiveness</span><h3>Save rate by format</h3>
          {formatStats.length === 0 ? <div className="empty-state"><b>Not enough posts.</b><p>Publish at least two posts per format for a fair comparison.</p></div> : (
            <>{formatStats.map(stat => <div className="bar-row" key={stat.format}><span>{stat.format}</span><div><i style={{ width: `${(stat.rate / maxRate) * 100}%` }} /></div><b>{stat.rate.toFixed(1)}%</b></div>)}<small>Based on {withMetrics.length} published posts with real metrics</small></>
          )}
        </article>
      </section>
      <section className="panel post-table"><div className="panel-heading"><div><span className="section-kicker">Post analysis</span><h3>Published content</h3></div></div>
        {published.length === 0 ? <div className="empty-state"><b>Nothing published yet.</b><p>Approved posts publish at their scheduled time, or immediately with Publish now.</p></div> : (
          <><div className="table-head"><span>Post</span><span>Impressions</span><span>Reactions</span><span>Comments</span><span>Saves</span></div>{published.map(post => <div className="table-row" key={post.id}><span><IdentityBadge identity={post.identity} /><b>{post.title}</b><small>{post.format} · {post.theme} · {formatDateTime(post.publishedAt ?? post.scheduledFor, timezone)}</small></span><b>{formatNumber(post.metrics?.impressions ?? 0)}</b><b>{post.metrics?.reactions ?? "—"}</b><b>{post.metrics?.comments ?? "—"}</b><b>{post.metrics?.saves ?? "—"}</b></div>)}</>
        )}
      </section>
    </div>
  );
}

function Contacts({ data, updateContact }: { data: WorkspaceData; updateContact: (id: string, stage: Contact["stage"]) => void }) {
  return (
    <div className="page-stack">
      <section className="section-intro"><div><span className="section-kicker">Conversation signals</span><h2>Comments that may become conversations.</h2><p>SignalLayer suggests commercial intent. You decide who belongs in your contacts.</p></div><div className="content-toolbar"><button className="secondary-button" onClick={() => exportContacts(data.contacts)}>Export CSV</button><button className="secondary-button" onClick={() => exportContactsXlsx(data.contacts)}>Export XLSX</button></div></section>
      <section className="panel contacts-table">
        <div className="contacts-head"><span>Person</span><span>Signal</span><span>Source</span><span>Stage</span></div>
        {data.contacts.map(contact => <div className="contact-row" key={contact.id}><div className="person-cell"><span className="avatar alt">{contact.initials}</span><span><b>{contact.name}</b><small>{contact.role} · {contact.company}</small></span></div><div className="signal-cell"><div><span className={`intent intent-${contact.intent.toLowerCase()}`}>{contact.intent} intent</span><span className="sentiment">{contact.sentiment}</span></div><p>“{contact.comment}”</p></div><div className="source-cell"><small>COMMENTED ON</small><b>{contact.source}</b></div><select value={contact.stage} onChange={e => updateContact(contact.id, e.target.value as Contact["stage"])}><option>New</option><option>Reviewing</option><option>Qualified</option><option>Not a lead</option></select></div>)}
      </section>
      <p className="privacy-note">SignalLayer stores only information returned through approved LinkedIn permissions. No profile scraping or external enrichment.</p>
    </div>
  );
}

function exportContacts(contacts: Contact[]) {
  const rows = [["Name", "Role", "Company", "Intent", "Sentiment", "Stage", "Source", "Comment"], ...contacts.map(c => [c.name, c.role, c.company, c.intent, c.sentiment, c.stage, c.source, c.comment])];
  const csv = rows.map(row => row.map(cell => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  const link = document.createElement("a"); link.href = url; link.download = "signallayer-contacts.csv"; link.click(); URL.revokeObjectURL(url);
}

async function exportContactsXlsx(contacts: Contact[]) {
  const XLSX = await import("xlsx");
  const rows = contacts.map(contact => ({ Name: contact.name, Role: contact.role, Company: contact.company, Intent: contact.intent, Sentiment: contact.sentiment, Stage: contact.stage, Source: contact.source, Comment: contact.comment, Notes: contact.notes ?? "" }));
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.json_to_sheet(rows);
  sheet["!cols"] = [{ wch: 22 }, { wch: 28 }, { wch: 20 }, { wch: 10 }, { wch: 14 }, { wch: 14 }, { wch: 34 }, { wch: 70 }, { wch: 34 }];
  XLSX.utils.book_append_sheet(workbook, sheet, "Qualified contacts");
  XLSX.writeFile(workbook, "signallayer-contacts.xlsx");
}

function Knowledge({ data, uploadSource, deleteSource, saveBrief, approveBrief, startOnboarding, setTab }: { data: WorkspaceData; uploadSource: (file: File) => void; deleteSource: (id: string) => void; saveBrief: (brief: WorkspaceData["brief"]) => void; approveBrief: () => void; startOnboarding: () => void; setTab: (tab: Tab) => void }) {
  const [dragging, setDragging] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(data.brief);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const handle = (event: ChangeEvent<HTMLInputElement>) => { const file = event.target.files?.[0]; if (file) uploadSource(file); };
  const update = (field: keyof WorkspaceData["brief"], value: string) => setDraft(current => ({ ...current, [field]: value }));
  const submit = () => { saveBrief(draft); setEditing(false); };
  return (
    <div className="page-stack">
      <section className="section-intro"><div><span className="section-kicker">Business knowledge · Brief v{data.brief.version}</span><h2>The truth your content is allowed to use.</h2><p>Review positioning, voice and sources. SignalLayer never invents customer stories or founder experiences.</p></div><div className="content-toolbar"><button className="secondary-button" onClick={startOnboarding}>Update business context</button><button className="primary-button compact" onClick={approveBrief} disabled={data.workspace.briefApproved}>{data.workspace.briefApproved ? "✓ Brief approved" : "Approve brief"}</button></div></section>
      <section className="knowledge-grid">
        <article className="panel brief-panel"><div className="panel-heading"><div><span className="section-kicker">{data.workspace.briefApproved ? "Approved brief" : "Brief awaiting approval"}</span><h3>{data.workspace.name}</h3></div><button className="text-button" onClick={() => { setDraft(data.brief); setEditing(!editing); }}>{editing ? "Cancel" : "Edit"}</button></div>{editing ? <div className="brief-form"><label>Positioning</label><textarea value={draft.positioning} onChange={e => update("positioning", e.target.value)} /><label>Primary audience</label><textarea value={draft.audience} onChange={e => update("audience", e.target.value)} /><div className="voice-columns"><div><IdentityBadge identity="Founder" /><textarea value={draft.founderVoice} onChange={e => update("founderVoice", e.target.value)} /></div><div><IdentityBadge identity="Company" /><textarea value={draft.companyVoice} onChange={e => update("companyVoice", e.target.value)} /></div></div><label>Preferred language</label><input value={draft.preferredLanguage} onChange={e => update("preferredLanguage", e.target.value)} /><button className="primary-button compact" onClick={submit}>Save new brief version</button></div> : <><label>Positioning</label><p>{data.brief.positioning}</p><label>Primary audience</label><p>{data.brief.audience}</p><div className="voice-columns"><div><IdentityBadge identity="Founder" /><p>{data.brief.founderVoice}</p></div><div><IdentityBadge identity="Company" /><p>{data.brief.companyVoice}</p></div></div><label>Preferred language</label><p>{data.brief.preferredLanguage}</p><label>Approved proof</label><div className="chip-list">{data.brief.proof.map(item => <span key={item}>✓ {item}</span>)}</div><label>Required vocabulary</label><div className="chip-list">{data.brief.requiredVocabulary.map(item => <span key={item}>{item}</span>)}</div><label>Blocked language</label><div className="chip-list blocked">{data.brief.banned.map(item => <span key={item}>{item}</span>)}</div></>}</article>
        <aside className="panel sources-panel"><div className="panel-heading"><div><span className="section-kicker">Sources</span><h3>{data.sources.length} connected</h3></div></div><label className={`upload-zone ${dragging ? "dragging" : ""}`} onDragEnter={() => setDragging(true)} onDragLeave={() => setDragging(false)}><input type="file" accept=".pdf,.doc,.docx,.ppt,.pptx,.txt,.md,.csv" onChange={handle} /><b>＋ Add a knowledge source</b><span>Text, Markdown and CSV are read by the AI today. PDF, DOCX and PPTX are stored for later.</span></label>{data.sources.map(source => <div className="source-row" key={source.id}><span className="file-mark">{source.type.slice(0, 1)}</span><div><b>{source.name}</b><small>{source.type}</small>{source.readable && source.textPreview && <details className="source-preview"><summary>What the AI reads</summary><p>{source.textPreview}</p></details>}</div><span className={`source-status ${source.readable === false ? "muted" : ""}`}>{source.readable === false ? "◦" : "✓"} {source.status}</span>{confirmDelete === source.id ? <button className="danger-text" onClick={() => { deleteSource(source.id); setConfirmDelete(null); }}>Confirm?</button> : <button className="source-delete" aria-label={`Remove ${source.name}`} onClick={() => setConfirmDelete(source.id)}>✕</button>}</div>)}<hr /><div className="connection-card"><span className="linkedin-mark">in</span><div><b>LinkedIn connection</b><small>Manage publishing in Settings</small></div><button onClick={() => setTab("Settings")}>Configure</button></div><p className="connection-help">Live publishing requires a LinkedIn developer app and approved Community Management permissions.</p></aside>
      </section>
    </div>
  );
}

function Settings({ data, integration, refreshIntegration, configureOrganization, syncLinkedIn, startOnboarding }: { data: WorkspaceData; integration: IntegrationStatus | null; refreshIntegration: () => void; configureOrganization: (urn: string) => void; syncLinkedIn: () => void; startOnboarding: () => void }) {
  const [organizationUrn, setOrganizationUrn] = useState(integration?.organizationUrn ?? "");
  return <div className="page-stack"><section className="section-intro"><div><span className="section-kicker">Settings & integrations</span><h2>Turn the approved workflow live.</h2><p>The product remains safe in demo mode until each external capability is explicitly configured.</p></div><button className="secondary-button" onClick={startOnboarding}>Edit workspace profile</button></section><section className="settings-grid"><article className="panel integration-panel"><div className="integration-title"><span className="linkedin-mark">in</span><div><h3>LinkedIn publishing</h3><p>Official OAuth, founder publishing and approved company-page scopes.</p></div><span className={`integration-state ${integration?.connected ? "ready" : "pending"}`}>{integration?.connected ? "Connected" : "Setup required"}</span></div><div className="checklist"><span className={integration?.appConfigured ? "done" : ""}>✓ Developer app credentials</span><span className={integration?.encryptionConfigured ? "done" : ""}>✓ Encrypted token storage</span><span className={integration?.connected ? "done" : ""}>✓ Member authorization</span><span className={integration?.organizationUrn ? "done" : ""}>✓ Company page selected</span></div>{integration?.connected ? <><div className="connected-account"><b>{integration.memberName ?? "LinkedIn member"}</b><small>{integration.memberUrn}</small><small>Scopes: {integration.scopes.join(", ")}</small></div><label className="settings-label">Company organization URN</label><div className="inline-form"><input value={organizationUrn} onChange={e => setOrganizationUrn(e.target.value)} placeholder="urn:li:organization:123456" /><button className="secondary-button" onClick={() => configureOrganization(organizationUrn)}>Save</button></div><button className="secondary-button integration-sync" onClick={syncLinkedIn}>Sync analytics & comments</button></> : <button className="primary-button compact" disabled={!integration?.appConfigured || !integration?.encryptionConfigured} onClick={() => { window.location.href = "/api/integrations/linkedin/start"; }}>Connect LinkedIn</button>}{!integration?.appConfigured && <p className="settings-copy">Connecting is disabled because the server has no LinkedIn app keys yet.</p>}<button className="text-button refresh-button" onClick={refreshIntegration}>Refresh status</button></article><article className="panel integration-panel"><div className="integration-title"><span className="ai-mark">✦</span><div><h3>Content agents</h3><p>Strategist and producer agents with a grounded fallback.</p></div><span className={`integration-state ${integration?.openaiConfigured ? "ready" : "pending"}`}>{integration?.openaiConfigured ? "Live AI" : "Safe fallback"}</span></div><div className="checklist"><span className="done">✓ Business-brief grounding</span><span className="done">✓ Separate founder/company voices</span><span className="done">✓ Claims and duplication QA</span><span className={integration?.openaiConfigured ? "done" : ""}>✓ OpenAI runtime key</span></div><div className="connected-account"><b>Model</b><small>{integration?.openaiModel ?? "not configured"}</small><small>Without a runtime key, deterministic ideas remain fully usable.</small></div></article><article className="panel integration-panel"><span className="section-kicker">Publishing policy</span><h3>Human approval is mandatory</h3><p className="settings-copy">Unapproved posts are always held. Live publishing validates identity, token health, format readiness and approval state immediately before posting.</p><div className="policy-row"><span>Unapproved at slot</span><b>Hold & notify</b></div><div className="policy-row"><span>Automatic comments or DMs</span><b>Disabled</b></div><div className="policy-row"><span>Profile scraping</span><b>Never</b></div></article><article className="panel integration-panel"><span className="section-kicker">Workspace</span><h3>{data.workspace.name}</h3><div className="policy-row"><span>Primary market</span><b>{data.workspace.primaryMarket}</b></div><div className="policy-row"><span>Timezone</span><b>{data.workspace.timezone}</b></div><div className="policy-row"><span>Strategy</span><b>v{data.workspace.strategyVersion} · {data.workspace.strategyApproved ? "approved" : "draft"}</b></div><div className="policy-row"><span>Brief</span><b>v{data.brief.version} · {data.workspace.briefApproved ? "approved" : "draft"}</b></div></article></section></div>;
}

function ActivityDrawer({ open, close, events }: { open: boolean; close: () => void; events: ActivityEvent[] }) {
  if (!open) return null;
  const marks: Record<ActivityEvent["kind"], string> = { publish: "✓", "publish-failed": "!", hold: "◦", sync: "↺", approval: "✓", system: "✦" };
  return <div className="drawer-backdrop" onMouseDown={close}><aside className="create-drawer" onMouseDown={e => e.stopPropagation()}><div className="drawer-head"><div><span className="section-kicker">Activity log</span><h2>What happened while you were away</h2></div><button onClick={close}>×</button></div>
    {events.length === 0 ? <div className="empty-state"><b>No activity yet.</b><p>Publishing results, sync runs and failures will appear here.</p></div> : (
      <div className="event-list">{events.map(event => <div className={`event-row kind-${event.kind}`} key={event.id}><span className="event-mark">{marks[event.kind]}</span><div><p>{event.message}</p><small>{formatDateTime(event.at)}</small></div></div>)}</div>
    )}
  </aside></div>;
}

function OnboardingModal({ open, close, data, complete }: { open: boolean; close: () => void; data: WorkspaceData; complete: (payload: Record<string, unknown>) => void }) {
  const [step, setStep] = useState(1);
  const [accountType, setAccountType] = useState<"Business" | "Individual">(data.workspace.accountType);
  const [form, setForm] = useState({
    name: data.workspace.name, website: data.workspace.website, industry: data.workspace.industry,
    primaryMarket: data.workspace.primaryMarket, timezone: data.workspace.timezone,
    founderLinkedInUrl: data.workspace.founderLinkedInUrl, companyLinkedInUrl: data.workspace.companyLinkedInUrl,
    positioning: data.brief.positioning, audience: data.brief.audience,
    linkedInUrl: data.individual.linkedInUrl, fullName: data.individual.fullName, headline: data.individual.headline,
    role: data.individual.role, manualInput: data.individual.manualInput,
  });
  if (!open) return null;
  const individual = accountType === "Individual";
  const set = (key: keyof typeof form, value: string) => setForm(current => ({ ...current, [key]: value }));
  const finish = () => { complete({ ...form, accountType }); setStep(1); close(); };
  // Conditional required fields — Business needs a website, Individual needs a LinkedIn profile.
  const canContinue = step !== 2 || (individual ? form.linkedInUrl.trim().length > 3 : form.website.trim().length > 2);
  const titles = individual
    ? ["Who is this for?", "Your LinkedIn profile", "Your role & experience", "Set operating preferences"]
    : ["Who is this for?", "About the business", "Confirm the brief", "Set operating preferences"];
  return <div className="drawer-backdrop onboarding-backdrop" onMouseDown={close}><section className="onboarding-modal" onMouseDown={e => e.stopPropagation()}><div className="onboarding-progress"><span style={{ width: `${step * 25}%` }} /></div><div className="drawer-head"><div><span className="section-kicker">Workspace onboarding · {step} of 4</span><h2>{titles[step - 1]}</h2></div><button onClick={close} aria-label="Close onboarding">×</button></div>

    {step === 1 && <div className="onboarding-form"><p className="onboarding-lead">Who will be posting? This decides what we need from you.</p><div className="account-tabs"><button type="button" className={!individual ? "active" : ""} onClick={() => setAccountType("Business")}><b>Business</b><span>A company page. We need your website; LinkedIn and knowledge base are optional.</span></button><button type="button" className={individual ? "active" : ""} onClick={() => setAccountType("Individual")}><b>Individual</b><span>A personal brand. We need your LinkedIn profile; a website is not required.</span></button></div></div>}

    {step === 2 && !individual && <div className="onboarding-form"><label>Company name<input value={form.name} onChange={e => set("name", e.target.value)} /></label><label>Website <em className="req">required</em><input value={form.website} onChange={e => set("website", e.target.value)} placeholder="https://yourcompany.com" /></label><div className="form-pair"><label>Industry<input value={form.industry} onChange={e => set("industry", e.target.value)} /></label><label>Primary market<input value={form.primaryMarket} onChange={e => set("primaryMarket", e.target.value)} /></label></div><label>Company LinkedIn page <em className="opt">optional</em><input value={form.companyLinkedInUrl} onChange={e => set("companyLinkedInUrl", e.target.value)} placeholder="https://linkedin.com/company/..." /></label><div className="scan-note"><b>Knowledge base is optional</b><p>Add product docs, case studies and brand guidelines on the Knowledge page any time to sharpen your themes.</p></div></div>}

    {step === 2 && individual && <div className="onboarding-form"><label>LinkedIn profile <em className="req">required</em><input value={form.linkedInUrl} onChange={e => set("linkedInUrl", e.target.value)} placeholder="https://linkedin.com/in/your-name" /></label><label>Full name<input value={form.fullName} onChange={e => set("fullName", e.target.value)} /></label><label>Current headline / role<input value={form.headline} onChange={e => set("headline", e.target.value)} placeholder="e.g. Head of Product at Acme" /></label><label>Website <em className="opt">optional</em><input value={form.website} onChange={e => set("website", e.target.value)} placeholder="Not required for individuals" /></label><div className="scan-note"><b>We’ll read your role & experience</b><p>After you connect, SignalLayer analyses your profile to pick up your role and experience across companies. Nothing is scraped — connect LinkedIn in Settings to enrich it.</p></div></div>}

    {step === 3 && !individual && <div className="onboarding-form"><label>Positioning<textarea value={form.positioning} onChange={e => set("positioning", e.target.value)} /></label><label>Primary audience<textarea value={form.audience} onChange={e => set("audience", e.target.value)} /></label><div className="scan-note success"><b>Themes come next</b><p>We research trending themes from your website and knowledge base, then suggest 4–5 on the Strategy page.</p></div></div>}

    {step === 3 && individual && <div className="onboarding-form"><label>Your role<input value={form.role} onChange={e => set("role", e.target.value)} placeholder="e.g. Product leader, 10 years in fintech" /></label><label>Anything specific you want to post about? <em className="opt">optional</em><textarea value={form.manualInput} onChange={e => set("manualInput", e.target.value)} placeholder="Optional. Topics, a recent win, a lesson, an opinion you want to share…" /></label><div className="scan-note success"><b>Themes come next</b><p>We analyse your role, experience and what’s working on LinkedIn, then suggest 4–5 themes on the Strategy page.</p></div></div>}

    {step === 4 && <div className="onboarding-form"><label>Timezone<input value={form.timezone} onChange={e => set("timezone", e.target.value)} /></label><div className="preference-cards"><div><b>Audience</b><span>{accountType}</span></div><div><b>Build periods</b><span>1 / 3 / 7 days</span></div><div><b>Approval</b><span>Everything requires approval</span></div></div></div>}

    <div className="onboarding-actions"><button className="secondary-button" onClick={() => step === 1 ? close() : setStep(step - 1)}>{step === 1 ? "Skip for now" : "Back"}</button>{step < 4 ? <button className="primary-button compact" disabled={!canContinue} onClick={() => setStep(step + 1)}>Continue</button> : <button className="primary-button compact" onClick={finish}>Create workspace</button>}</div>
    {step === 2 && !canContinue && <p className="onboarding-required">{individual ? "A LinkedIn profile is required to continue." : "A website is required to continue."}</p>}
  </section></div>;
}

function EditPostDrawer({ post, close, save, timezone }: { post: Post | null; close: () => void; save: (id: string, changes: Partial<Post>, note?: string) => void; timezone: string }) {
  const [title, setTitle] = useState(post?.title ?? "");
  const [body, setBody] = useState(post?.body ?? "");
  const [cta, setCta] = useState(post?.cta ?? "");
  const [hashtags, setHashtags] = useState(post?.hashtags.join(" ") ?? "");
  const [viewingVersion, setViewingVersion] = useState<string | null>(null);
  if (!post) return null;
  const versions = post.versions ?? [];
  return <div className="drawer-backdrop" onMouseDown={close}><aside className="create-drawer" onMouseDown={e => e.stopPropagation()}><div className="drawer-head"><div><span className="section-kicker">Edit approval draft</span><h2>{post.identity} post</h2></div><button onClick={close}>×</button></div><form onSubmit={e => { e.preventDefault(); save(post.id, { title, body, cta, hashtags: hashtags.split(/\s+/).filter(Boolean) }, "Manual edit"); close(); }}><label>Title / working hook</label><input value={title} onChange={e => setTitle(e.target.value)} /><label>Post copy</label><textarea className="tall-textarea" value={body} onChange={e => setBody(e.target.value)} /><label>Call to action</label><input value={cta} onChange={e => setCta(e.target.value)} /><label>Hashtags</label><input value={hashtags} onChange={e => setHashtags(e.target.value)} /><div className="generation-note"><span>↺</span><p>The previous version is retained in the history below. This edit becomes training signal for future drafts.</p></div><button className="primary-button full" type="submit">Save as new version</button></form>
    {versions.length > 0 && <div className="history-section"><span className="section-kicker">History · {versions.length} saved version{versions.length === 1 ? "" : "s"}</span>
      {versions.map(version => <div className="history-item" key={version.id}>
        <button type="button" className="history-toggle" onClick={() => setViewingVersion(viewingVersion === version.id ? null : version.id)}><b>{version.note}</b><small>{formatDateTime(version.createdAt, timezone)}</small></button>
        {viewingVersion === version.id && <div className="history-body"><p>{version.body}</p><button type="button" className="secondary-button" onClick={() => { save(post.id, { body: version.body }, "Restored earlier version"); close(); }}>Restore this version</button></div>}
      </div>)}
    </div>}
  </aside></div>;
}

function CreateDrawer({ open, close, createPost, themes, prefillDate }: { open: boolean; close: () => void; createPost: (post: { identity: Identity; format: Post["format"]; title: string; body: string; theme?: string; scheduledAt?: string }) => void; themes: Theme[]; prefillDate: string | null }) {
  const [identity, setIdentity] = useState<Identity>("Founder");
  const [format, setFormat] = useState<Post["format"]>("Text");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [when, setWhen] = useState(prefillDate ?? "");
  if (!open) return null;
  const submit = (event: FormEvent) => { event.preventDefault(); createPost({ identity, format, title: title || "A new point of view", body: body || "Draft this idea using the approved voice and business brief.", theme: themes.find(t => t.selected)?.name, scheduledAt: when ? new Date(when).toISOString() : undefined }); close(); setTitle(""); setBody(""); };
  return <div className="drawer-backdrop" onMouseDown={close}><aside className="create-drawer" onMouseDown={e => e.stopPropagation()}><div className="drawer-head"><div><span className="section-kicker">New content brief</span><h2>Create a post</h2></div><button onClick={close}>×</button></div><form onSubmit={submit}><label>Publishing identity</label><div className="segmented wide"><button type="button" className={identity === "Founder" ? "active" : ""} onClick={() => setIdentity("Founder")}>Founder</button><button type="button" className={identity === "Company" ? "active" : ""} onClick={() => setIdentity("Company")}>Company</button></div><label>Format</label><div className="format-grid">{(["Text", "Image", "Document", "Multi-image"] as const).map(item => <button type="button" className={format === item ? "active" : ""} disabled={item !== "Text"} onClick={() => setFormat(item)} key={item}>{item}{item !== "Text" && <small className="soon-tag">coming soon</small>}</button>)}</div><label htmlFor="idea">Working idea</label><input id="idea" value={title} onChange={e => setTitle(e.target.value)} placeholder="What should this post help the audience understand?" /><label htmlFor="context">Context or source note</label><textarea id="context" value={body} onChange={e => setBody(e.target.value)} placeholder="Add a customer question, founder story, product update or source…" /><label htmlFor="when">Preferred publish time (optional)</label><input id="when" type="datetime-local" value={when} onChange={e => setWhen(e.target.value)} /><div className="generation-note"><span>✦</span><p>SignalLayer will ground this draft in your approved brief and selected themes, then run brand and claims checks.</p></div><button className="primary-button full" type="submit">Generate approval draft</button></form></aside></div>;
}

export function SignalLayerApp({ user }: { user: { name: string; email: string } | null }) {
  const [data, setData] = useState<WorkspaceData>(emptyWorkspace);
  const [tab, setTab] = useState<Tab>("Overview");
  const [contentView, setContentView] = useState<ContentView>("Ideas");
  const [drawer, setDrawer] = useState(false);
  const [prefillDate, setPrefillDate] = useState<string | null>(null);
  const [onboarding, setOnboarding] = useState(false);
  const [onboardingDismissed, setOnboardingDismissed] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<Post | null>(null);
  const [integration, setIntegration] = useState<IntegrationStatus | null>(null);
  const [generating, setGenerating] = useState(false);
  const [busyIdeas, setBusyIdeas] = useState<Set<string>>(new Set());
  const [revising, setRevising] = useState<Set<string>>(new Set());
  const [suggestingThemes, setSuggestingThemes] = useState(false);
  const [building, setBuilding] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  // The LinkedIn sign-in outcome arrives as a ?integration= code in the address bar.
  const [banner, setBanner] = useState<Banner | null>(() => {
    if (typeof window === "undefined") return null;
    const code = new URLSearchParams(window.location.search).get("integration");
    return code ? INTEGRATION_MESSAGES[code] ?? null : null;
  });
  const [loaded, setLoaded] = useState(false);
  const userName = user?.name || "Demo user";
  const timezone = data.workspace.timezone;

  const refreshIntegration = async () => { try { const response = await fetch("/api/integrations/linkedin"); if (response.ok) setIntegration(await response.json() as IntegrationStatus); } catch { /* status remains unavailable */ } };
  useEffect(() => {
    // Clean the sign-in code from the address bar so a refresh does not repeat the message.
    const params = new URLSearchParams(window.location.search);
    if (params.get("integration")) {
      params.delete("integration");
      window.history.replaceState(null, "", `${window.location.pathname}${params.size ? `?${params}` : ""}`);
    }
    Promise.all([fetch("/api/workspace").then(async r => r.ok ? await r.json() as WorkspaceData : Promise.reject()), fetch("/api/integrations/linkedin").then(async r => r.ok ? await r.json() as IntegrationStatus : Promise.reject())]).then(([workspace, status]) => { setData(workspace); setIntegration(status); }).catch(() => undefined).finally(() => setLoaded(true));
  }, []);
  const persist = async (action: string, payload: unknown) => { try { const response = await fetch("/api/workspace", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, payload }) }); if (response.ok) setData(await response.json() as WorkspaceData); else { const result = await response.json() as { error?: string }; notify(result.error ?? "That change could not be saved."); } } catch { notify("Could not reach the server. Please check your connection and try again."); } };
  const notify = (message: string, undo?: () => void) => { setToast({ message, undo }); window.setTimeout(() => setToast(current => current?.message === message ? null : current), undo ? 6000 : 4000); };
  const approvePost = (id: string) => { setData(current => ({ ...current, posts: current.posts.map(p => p.id === id ? { ...p, status: "Scheduled" as const } : p) })); persist("approvePost", { id }); notify("Post approved and scheduled."); };
  const schedulePost = (id: string, scheduledAt: string) => { setData(current => ({ ...current, posts: current.posts.map(p => p.id === id ? { ...p, scheduledFor: scheduledAt } : p) })); persist("schedulePost", { id, scheduledAt }); notify(`Publish time updated to ${formatDateTime(scheduledAt, timezone)}.`); };
  const requestRevision = (id: string, note: string) => { setData(current => ({ ...current, posts: current.posts.map(p => p.id === id ? { ...p, status: "Revision requested" as const, revisionNote: note } : p) })); persist("requestRevision", { id, note }); notify("Revision requested. Use “Revise with AI” or move it back to review any time."); };
  const backToReview = (id: string) => { persist("backToReview", { id }); notify("Draft moved back to the review queue."); };
  const reviseWithAi = async (id: string) => { setRevising(current => new Set(current).add(id)); try { const response = await fetch("/api/agents/generate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ mode: "revise", postId: id }) }); const result = await response.json() as { data?: WorkspaceData; provider?: string; error?: string }; if (!response.ok || !result.data) throw new Error(result.error ?? "Revision failed"); setData(result.data); setContentView("Drafts"); notify(`Revised draft ready (${result.provider}). The original is saved in History.`); } catch (error) { notify(error instanceof Error ? error.message : "Revision failed."); } finally { setRevising(current => { const next = new Set(current); next.delete(id); return next; }); } };
  const rejectPost = (id: string) => { persist("rejectPost", { id }); notify("Post rejected. It is kept for 30 days.", () => { persist("restorePost", { id }); notify("Post restored to the queue."); }); };
  const restorePost = (id: string) => { persist("restorePost", { id }); notify("Post restored to the queue."); };
  const savePostEdit = (id: string, changes: Partial<Post>, note = "Manual edit") => { persist("updatePost", { id, changes, note }); notify("New post version saved."); };
  const toggleTheme = (id: string) => { setData(current => ({ ...current, workspace: { ...current.workspace, strategyApproved: false }, themes: current.themes.map(t => t.id === id ? { ...t, selected: !t.selected } : t) })); persist("toggleTheme", { id }); };
  const approveStrategy = () => { persist("approveStrategy", {}); notify("Strategy approved and versioned."); };
  const suggestThemes = async () => { setSuggestingThemes(true); try {
    // For individuals, analyse the profile first so themes are grounded in role + experience.
    if (data.workspace.accountType === "Individual" && !data.individual.analyzedAt) {
      await fetch("/api/agents/generate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ mode: "analyzeProfile" }) });
    }
    const response = await fetch("/api/agents/generate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ mode: "themes" }) });
    const result = await response.json() as { data?: WorkspaceData; provider?: string; error?: string }; if (!response.ok || !result.data) throw new Error(result.error ?? "Theme suggestion failed"); setData(result.data); notify(`Themes suggested from your ${data.workspace.accountType === "Individual" ? "profile" : "business"} and what's working on LinkedIn (${result.provider}).`);
  } catch (error) { notify(error instanceof Error ? error.message : "Theme suggestion failed."); } finally { setSuggestingThemes(false); } };
  const buildPlan = async (days: 1 | 3 | 7) => { const theme = data.themes.find(t => t.selected); if (!theme) return notify("Select a theme first."); setBuilding(true); try { const response = await fetch("/api/agents/generate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ mode: "buildPlan", themeId: theme.id, days }) }); const result = await response.json() as { data?: WorkspaceData; created?: number; provider?: string; error?: string }; if (!response.ok || !result.data) throw new Error(result.error ?? "Build failed"); setData(result.data); setContentView("Drafts"); setTab("Content"); notify(`Built ${result.created} posts for “${theme.name}” (${result.provider}). Review them under Finished drafts.`); } catch (error) { notify(error instanceof Error ? error.message : "Build failed."); } finally { setBuilding(false); } };
  const approveIdea = async (id: string) => { setBusyIdeas(current => new Set(current).add(id)); await persist("approveIdea", { id }); setBusyIdeas(current => { const next = new Set(current); next.delete(id); return next; }); setContentView("Drafts"); setTab("Content"); notify("Idea approved. The finished draft is under Finished drafts."); };
  const rejectIdea = (id: string) => { setData(current => ({ ...current, ideas: current.ideas.map(idea => idea.id === id ? { ...idea, status: "Rejected" as const } : idea) })); persist("rejectIdea", { id }); notify("Idea rejected. This feedback will inform the next batch."); };
  const generateIdeas = async () => { setGenerating(true); try { const response = await fetch("/api/agents/generate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ mode: "ideas" }) }); const result = await response.json() as { data?: WorkspaceData; provider?: string; error?: string }; if (!response.ok || !result.data) throw new Error(result.error ?? "Generation failed"); setData(result.data); setContentView("Ideas"); notify(`Four ideas generated with ${result.provider}.`); } catch (error) { notify(error instanceof Error ? error.message : "Idea generation failed."); } finally { setGenerating(false); } };
  const updateContact = (id: string, stage: Contact["stage"]) => { setData(current => ({ ...current, contacts: current.contacts.map(c => c.id === id ? { ...c, stage } : c) })); persist("updateContact", { id, stage }); notify(`Contact moved to ${stage}.`); };
  const createPost = async (input: { identity: Identity; format: Post["format"]; title: string; body: string; theme?: string; scheduledAt?: string }) => { await persist("createPost", input); setTab("Content"); setContentView("Drafts"); notify("Approval draft created — it is highlighted under Finished drafts."); };
  const uploadSource = async (file: File) => { const optimistic = { id: `s-${Date.now()}`, name: file.name, type: "Upload", status: "Processing…" }; setData(current => ({ ...current, sources: [optimistic, ...current.sources] })); const form = new FormData(); form.append("file", file); try { const response = await fetch("/api/uploads", { method: "POST", body: form }); if (response.ok) { setData(await response.json()); notify(`${file.name} added to knowledge sources.`); } else { const result = await response.json() as { error?: string }; setData(current => ({ ...current, sources: current.sources.filter(s => s.id !== optimistic.id) })); notify(result.error ?? "Upload failed."); } } catch { setData(current => ({ ...current, sources: current.sources.filter(s => s.id !== optimistic.id) })); notify("Upload failed. Please try again."); } };
  const deleteSource = (id: string) => { persist("deleteSource", { id }); notify("Source removed. The AI stops using it immediately."); };
  const saveBrief = (brief: WorkspaceData["brief"]) => { persist("saveBrief", brief); notify("Brief saved as a new version. Approval is required before production."); };
  const approveBrief = () => { persist("approveBrief", {}); notify("Business & Voice Brief approved."); };
  const completeOnboarding = (payload: Record<string, unknown>) => { persist("completeOnboarding", payload); setTab("Strategy"); notify(payload.accountType === "Individual" ? "Profile saved. Suggest themes to get started." : "Business saved. Suggest themes to get started."); };
  const configureOrganization = async (organizationUrn: string) => { const response = await fetch("/api/integrations/linkedin", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ organizationUrn }) }); const result = await response.json() as IntegrationStatus & { error?: string }; if (!response.ok) return notify(result.error ?? "Company page could not be saved."); setIntegration(result); notify("Company publishing identity saved."); };
  const syncLinkedIn = async () => { try { const response = await fetch("/api/integrations/linkedin/sync", { method: "POST" }); const result = await response.json() as { data?: WorkspaceData; syncedPosts?: number; importedContacts?: number; error?: string }; if (!response.ok || !result.data) throw new Error(result.error ?? "Sync failed"); setData(result.data); await refreshIntegration(); notify(`Synced ${result.syncedPosts} posts and found ${result.importedContacts} new contact signals.`); } catch (error) { notify(error instanceof Error ? error.message : "LinkedIn sync failed."); } };
  const publishPost = async (postId: string) => { try { const response = await fetch("/api/integrations/linkedin/publish", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ postId }) }); const result = await response.json() as { data?: WorkspaceData; error?: string }; if (!response.ok || !result.data) throw new Error(result.error ?? "Publishing failed"); setData(result.data); notify("Post published to LinkedIn."); } catch (error) { notify(error instanceof Error ? error.message : "Publishing failed."); setTab("Settings"); } };
  const openActivity = () => { setActivityOpen(true); if (data.events.some(event => !event.read)) persist("markEventsRead", {}); };
  const logout = async () => { try { await fetch("/api/auth/logout", { method: "POST" }); } finally { window.location.href = "/"; } };
  const addSlot = (day: Date) => { const slot = new Date(day); slot.setHours(9, 0, 0, 0); const pad = (part: number) => String(part).padStart(2, "0"); setPrefillDate(`${slot.getFullYear()}-${pad(slot.getMonth() + 1)}-${pad(slot.getDate())}T09:00`); setDrawer(true); };

  const pendingPosts = data.posts.filter(post => post.status === "Needs approval").length;
  const newContacts = data.contacts.filter(contact => contact.stage === "New").length;
  const unreadEvents = data.events.filter(event => !event.read).length;

  const current = (() => {
    if (tab === "Overview") return <Overview data={data} setTab={setTab} approvePost={approvePost} startOnboarding={() => setOnboarding(true)} timezone={timezone} />;
    if (tab === "Strategy") return <Strategy data={data} toggleTheme={toggleTheme} approveStrategy={approveStrategy} suggestThemes={suggestThemes} buildPlan={buildPlan} suggestingThemes={suggestingThemes} building={building} />;
    if (tab === "Content") return <Content data={data} view={contentView} setView={setContentView} approvePost={approvePost} requestRevision={requestRevision} reviseWithAi={reviseWithAi} backToReview={backToReview} rejectPost={rejectPost} restorePost={restorePost} approveIdea={approveIdea} rejectIdea={rejectIdea} generateIdeas={generateIdeas} editPost={setEditingPost} publishPost={publishPost} schedulePost={schedulePost} generating={generating} busyIdeas={busyIdeas} revising={revising} timezone={timezone} />;
    if (tab === "Calendar") return <Calendar data={data} approvePost={approvePost} schedulePost={schedulePost} addSlot={addSlot} timezone={timezone} />;
    if (tab === "Performance") return <Performance data={data} timezone={timezone} />;
    if (tab === "Contacts") return <Contacts data={data} updateContact={updateContact} />;
    if (tab === "Knowledge") return <Knowledge data={data} uploadSource={uploadSource} deleteSource={deleteSource} saveBrief={saveBrief} approveBrief={approveBrief} startOnboarding={() => setOnboarding(true)} setTab={setTab} />;
    return <Settings data={data} integration={integration} refreshIntegration={refreshIntegration} configureOrganization={configureOrganization} syncLinkedIn={syncLinkedIn} startOnboarding={() => setOnboarding(true)} />;
  })();

  return <div className={`app-shell ${loaded ? "loaded" : ""}`}>
    <Sidebar tab={tab} setTab={setTab} setupProgress={data.workspace.setupProgress} userName={userName} pendingPosts={pendingPosts} newContacts={newContacts} onLogout={logout} />
    <main>
      <AppHeader title={tab} onCreate={() => { setPrefillDate(null); setDrawer(true); }} workspaceName={data.workspace.name} live={Boolean(integration?.connected)} unread={unreadEvents} openActivity={openActivity} />
      {loaded && banner && <div className={`banner banner-${banner.tone}`}><p>{banner.message}</p><button onClick={() => setBanner(null)} aria-label="Dismiss">×</button></div>}
      {current}
    </main>
    <CreateDrawer key={`create-${prefillDate ?? "blank"}`} open={drawer} close={() => setDrawer(false)} createPost={createPost} themes={data.themes} prefillDate={prefillDate} />
    <OnboardingModal open={onboarding || (loaded && !data.workspace.onboardingComplete && !onboardingDismissed)} close={() => { setOnboarding(false); setOnboardingDismissed(true); }} data={data} complete={completeOnboarding} />
    <EditPostDrawer key={editingPost?.id ?? "no-edit"} post={editingPost} close={() => setEditingPost(null)} save={savePostEdit} timezone={timezone} />
    <ActivityDrawer open={activityOpen} close={() => setActivityOpen(false)} events={data.events} />
    {toast && <div className="toast"><span>✓</span>{toast.message}{toast.undo && <button className="toast-undo" onClick={() => { toast.undo?.(); setToast(null); }}>Undo</button>}</div>}
  </div>;
}
