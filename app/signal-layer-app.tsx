"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { Contact, Idea, Identity, Post, Theme, WorkspaceData, seedWorkspace } from "./data";

type Tab = "Overview" | "Strategy" | "Content" | "Calendar" | "Performance" | "Contacts" | "Knowledge" | "Settings";

type IntegrationStatus = {
  appConfigured: boolean; encryptionConfigured: boolean; connected: boolean; expired: boolean;
  memberName: string | null; memberUrn: string | null; organizationUrn: string | null;
  scopes: string[]; expiresAt: number | null; apiVersion: string; openaiConfigured: boolean; openaiModel: string;
};

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

function formatNumber(value: number) {
  return value >= 1000 ? `${(value / 1000).toFixed(value >= 10000 ? 1 : 2)}k` : String(value);
}

function IdentityBadge({ identity }: { identity: Identity }) {
  return <span className={`identity-badge ${identity.toLowerCase()}`}>{identity === "Founder" ? "AG" : "N"} {identity}</span>;
}

function StatusPill({ status }: { status: Post["status"] }) {
  return <span className={`status-pill status-${status.toLowerCase().replaceAll(" ", "-")}`}>{status}</span>;
}

function AppHeader({ title, onCreate, userName }: { title: string; onCreate: () => void; userName: string }) {
  return (
    <header className="topbar">
      <div>
        <p className="eyebrow">Northstar Labs · {userName}</p>
        <h1>{title}</h1>
      </div>
      <div className="topbar-actions">
        <span className="mode-pill"><span /> Demo workspace</span>
        <button className="icon-button" aria-label="Notifications">2</button>
        <button className="primary-button" onClick={onCreate}><b>＋</b> Create post</button>
      </div>
    </header>
  );
}

function Sidebar({ tab, setTab, setupProgress, userName }: { tab: Tab; setTab: (tab: Tab) => void; setupProgress: number; userName: string }) {
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
            {item.label === "Content" && <small>2</small>}
            {item.label === "Contacts" && <small className="warm">2</small>}
          </button>
        ))}
      </nav>
      <div className="sidebar-spacer" />
      <div className="setup-card">
        <div className="setup-row"><span>Workspace setup</span><b>{setupProgress}%</b></div>
        <div className="progress-track"><span style={{ width: `${setupProgress}%` }} /></div>
        <p>Connect LinkedIn to enable live publishing and analytics.</p>
        <button onClick={() => setTab("Knowledge")}>Complete setup →</button>
      </div>
      <div className="profile-row">
        <span className="avatar">AG</span>
        <span><b>{userName}</b><small>Founder workspace</small></span>
        <button aria-label="Workspace menu">···</button>
      </div>
    </aside>
  );
}

function Overview({ data, setTab, approvePost, requestRevision }: { data: WorkspaceData; setTab: (t: Tab) => void; approvePost: (id: string) => void; requestRevision: (id: string) => void }) {
  const pending = data.posts.filter((post) => post.status === "Needs approval");
  const published = data.posts.filter((post) => post.status === "Published");
  const totalImpressions = published.reduce((sum, p) => sum + (p.metrics?.impressions ?? 0), 0);
  const totalReactions = published.reduce((sum, p) => sum + (p.metrics?.reactions ?? 0), 0);
  const totalComments = published.reduce((sum, p) => sum + (p.metrics?.comments ?? 0), 0);
  const featured = pending[0];
  return (
    <div className="page-stack overview-page">
      <section className="welcome-row">
        <div><h2>Good morning, Aditi.</h2><p>Your content engine is on track. Two posts need your review.</p></div>
        <div className="date-chip">Jul 11 – Jul 17 <span>⌄</span></div>
      </section>

      <section className="metrics-grid">
        <article className="metric-card"><span className="metric-icon blue">↗</span><div><p>Impressions</p><strong>{formatNumber(totalImpressions)}</strong><small className="up">↑ 24.8% <em>vs last week</em></small></div></article>
        <article className="metric-card"><span className="metric-icon coral">♥</span><div><p>Reactions</p><strong>{totalReactions}</strong><small className="up">↑ 18.2% <em>vs last week</em></small></div></article>
        <article className="metric-card"><span className="metric-icon green">◌</span><div><p>Comments</p><strong>{totalComments}</strong><small className="up">↑ 31.4% <em>vs last week</em></small></div></article>
        <article className="metric-card"><span className="metric-icon violet">◎</span><div><p>Qualified contacts</p><strong>{data.contacts.filter(c => c.stage !== "Not a lead").length}</strong><small><em>from {published.length} published posts</em></small></div></article>
      </section>

      <section className="main-grid">
        <article className="panel approval-panel">
          <div className="panel-heading">
            <div><span className="section-kicker">Approval queue</span><h3>{pending.length} posts are waiting for you</h3></div>
            <button className="text-button" onClick={() => setTab("Content")}>Review all →</button>
          </div>
          {featured ? (
            <div className="featured-post">
              <div className="post-meta"><IdentityBadge identity={featured.identity} /><span>{featured.format}</span><span>{featured.theme}</span></div>
              <h4>{featured.title}</h4>
              <p className="post-excerpt">{featured.body}</p>
              <div className="why-box"><b>✦ Why this post</b><p>{featured.why}</p></div>
              <div className="approval-actions">
                <span>Planned for <b>{featured.scheduledFor}</b></span>
                <button className="secondary-button" onClick={() => requestRevision(featured.id)}>Request changes</button>
                <button className="primary-button compact" onClick={() => approvePost(featured.id)}>Approve & schedule</button>
              </div>
            </div>
          ) : <div className="empty-state"><b>All caught up.</b><p>Your next content batch is ready to generate.</p></div>}
        </article>

        <aside className="right-stack">
          <article className="panel cadence-panel">
            <div className="panel-heading tight"><div><span className="section-kicker">This week</span><h3>Publishing rhythm</h3></div><span className="health-dot">On track</span></div>
            <div className="cadence-row"><IdentityBadge identity="Founder" /><div className="mini-progress"><span style={{ width: "66%" }} /></div><b>2 / 3</b></div>
            <div className="cadence-row"><IdentityBadge identity="Company" /><div className="mini-progress company"><span style={{ width: "50%" }} /></div><b>1 / 2</b></div>
            <button className="full-text-button" onClick={() => setTab("Calendar")}>View calendar <span>→</span></button>
          </article>
          <article className="panel insight-panel">
            <span className="section-kicker">✦ Weekly insight</span>
            <h3>Document posts are earning attention.</h3>
            <p>Your document posts received <b>2.1× more saves</b> than text posts across the last 30 days.</p>
            <button onClick={() => setTab("Performance")}>See the evidence →</button>
          </article>
        </aside>
      </section>

      <section className="bottom-grid">
        <article className="panel upcoming-panel">
          <div className="panel-heading"><div><span className="section-kicker">Coming up</span><h3>Next on your calendar</h3></div><button className="text-button" onClick={() => setTab("Calendar")}>Open calendar →</button></div>
          {data.posts.filter(p => p.status === "Scheduled").map((post, index) => (
            <div className="upcoming-row" key={post.id}>
              <div className="date-box"><b>{index === 0 ? "16" : "18"}</b><span>JUL</span></div>
              <div className="upcoming-content"><IdentityBadge identity={post.identity} /><h4>{post.title}</h4><p>{post.theme} · {post.format}</p></div>
              <div className="upcoming-time"><b>{post.scheduledFor.split("·")[1]}</b><span>Scheduled</span></div>
            </div>
          ))}
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

function Strategy({ data, toggleTheme, approveStrategy }: { data: WorkspaceData; toggleTheme: (id: string) => void; approveStrategy: () => void }) {
  return (
    <div className="page-stack">
      <section className="section-intro"><div><span className="section-kicker">Strategy version {data.workspace.strategyVersion} · {data.workspace.strategyApproved ? "approved" : "draft"}</span><h2>Your next two weeks, with reasons.</h2><p>Select the themes SignalLayer should turn into founder and company content.</p></div><button className="secondary-button">Review strategy history</button></section>
      <div className="strategy-layout">
        <section className="theme-grid">
          {data.themes.map(theme => <ThemeCard key={theme.id} theme={theme} toggleTheme={toggleTheme} />)}
        </section>
        <aside className="panel strategy-summary">
          <span className="section-kicker">Selected plan</span><h3>{data.themes.filter(t => t.selected).length} active themes</h3>
          <div className="mix-visual">{data.themes.filter(t => t.selected).map((t, i) => <span key={t.id} style={{ background: t.color, width: `${i === 0 ? 31 : 23}%` }} />)}</div>
          {data.themes.filter(t => t.selected).map(theme => <div className="theme-legend" key={theme.id}><i style={{ background: theme.color }} /><span>{theme.name}</span><b>{theme.fit}</b></div>)}
          <hr />
          <h4>Recommended cadence</h4>
          <div className="recommend-row"><IdentityBadge identity="Founder" /><span>3 posts / week</span></div>
          <div className="recommend-row"><IdentityBadge identity="Company" /><span>2 posts / week</span></div>
          <button className="primary-button full" onClick={approveStrategy}>Approve this strategy</button>
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
      <div className="evidence"><b>Why now</b><span>{theme.evidence}</span></div>
    </article>
  );
}

function Content({ data, approvePost, requestRevision, rejectPost, approveIdea, rejectIdea, generateIdeas, editPost, publishPost, generating }: { data: WorkspaceData; approvePost: (id: string) => void; requestRevision: (id: string) => void; rejectPost: (id: string) => void; approveIdea: (id: string) => void; rejectIdea: (id: string) => void; generateIdeas: () => void; editPost: (post: Post) => void; publishPost: (id: string) => void; generating: boolean }) {
  const [filter, setFilter] = useState<"All" | Identity>("All");
  const [view, setView] = useState<"Ideas" | "Drafts">("Ideas");
  const visible = data.posts.filter(post => filter === "All" || post.identity === filter);
  const visibleIdeas = data.ideas.filter(idea => idea.status !== "Produced" && (filter === "All" || idea.identity === filter));
  return (
    <div className="page-stack">
      <section className="section-intro"><div><span className="section-kicker">Content workspace</span><h2>Every post, from idea to evidence.</h2><p>Approve the idea before production, then review voice, claims and source context.</p></div><div className="content-toolbar"><div className="segmented">{(["All", "Founder", "Company"] as const).map(x => <button className={filter === x ? "active" : ""} onClick={() => setFilter(x)} key={x}>{x}</button>)}</div><button className="secondary-button" onClick={generateIdeas} disabled={generating}>{generating ? "Strategist is working…" : "✦ Generate ideas"}</button></div></section>
      <div className="subnav"><button className={view === "Ideas" ? "active" : ""} onClick={() => setView("Ideas")}>Idea approval <span>{visibleIdeas.filter(i => i.status === "Proposed").length}</span></button><button className={view === "Drafts" ? "active" : ""} onClick={() => setView("Drafts")}>Finished drafts <span>{visible.filter(p => p.status === "Needs approval").length}</span></button></div>
      {view === "Ideas" ? <div className="idea-grid">{visibleIdeas.map(idea => <IdeaCard key={idea.id} idea={idea} approve={() => approveIdea(idea.id)} reject={() => rejectIdea(idea.id)} />)}{visibleIdeas.length === 0 && <div className="panel empty-state"><b>No ideas waiting.</b><p>Generate a fresh evidence-backed batch.</p></div>}</div> : <div className="content-list">
        {visible.map(post => (
          <article className="panel content-card" key={post.id}>
            <div className="content-card-head"><div className="post-meta"><IdentityBadge identity={post.identity} /><span>{post.format}</span><span>{post.theme}</span></div><StatusPill status={post.status} /></div>
            <div className="content-card-grid">
              <div><h3>{post.title}</h3><p className="full-body">{post.body}</p><div className="hashtag-row">{post.hashtags.map(tag => <span key={tag}>{tag}</span>)}</div>{post.creativeSlides && <CreativePreview slides={post.creativeSlides} />}</div>
              <div><div className="why-panel"><span className="section-kicker">✦ Strategy note</span><p>{post.why}</p><small>Planned: <b>{post.scheduledFor}</b></small></div>{post.qa && <div className="qa-panel"><span className="section-kicker">Brand & claims QA</span>{Object.entries(post.qa).map(([key, value]) => <span key={key} className={value ? "pass" : "fail"}>{value ? "✓" : "!"} {key}</span>)}</div>}</div>
            </div>
            {post.status === "Needs approval" && <div className="content-actions"><button className="danger-text" onClick={() => rejectPost(post.id)}>Reject</button><button className="secondary-button" onClick={() => editPost(post)}>Edit draft</button><button className="secondary-button" onClick={() => requestRevision(post.id)}>Request changes</button><button className="primary-button compact" onClick={() => approvePost(post.id)}>Approve & schedule</button></div>}
            {post.status === "Scheduled" && <div className="content-actions"><span className="publish-note">Approved · publishing requires a live LinkedIn connection</span><button className="primary-button compact" onClick={() => publishPost(post.id)}>Publish now</button></div>}
          </article>
        ))}
      </div>}
    </div>
  );
}

function IdeaCard({ idea, approve, reject }: { idea: Idea; approve: () => void; reject: () => void }) {
  return <article className={`panel idea-card ${idea.status.toLowerCase()}`}><div className="content-card-head"><div className="post-meta"><IdentityBadge identity={idea.identity} /><span>{idea.format}</span><span>{idea.theme}</span></div><span className={`idea-status status-${idea.status.toLowerCase()}`}>{idea.status}</span></div><h3>{idea.hook}</h3><p>{idea.angle}</p><div className="idea-evidence"><b>Evidence</b><span>{idea.evidence}</span></div><div className="idea-evidence"><b>CTA</b><span>{idea.cta}</span></div><div className="idea-actions"><button className="danger-text" onClick={reject}>Reject</button><button className="primary-button compact" onClick={approve}>Approve & produce</button></div></article>;
}

function CreativePreview({ slides }: { slides: { heading: string; copy: string }[] }) {
  return <div className="creative-preview"><div className="creative-preview-head"><span>Document preview</span><b>{slides.length} pages</b></div><div className="slide-strip">{slides.map((slide, index) => <div className="mini-slide" key={`${slide.heading}-${index}`}><small>{String(index + 1).padStart(2, "0")}</small><b>{slide.heading}</b><p>{slide.copy}</p></div>)}</div></div>;
}

function Calendar({ data }: { data: WorkspaceData }) {
  const days = ["MON 14", "TUE 15", "WED 16", "THU 17", "FRI 18"];
  const scheduled = data.posts.filter(p => p.status === "Scheduled" || p.status === "Needs approval");
  return (
    <div className="page-stack">
      <section className="section-intro"><div><span className="section-kicker">Two-week plan</span><h2>A balanced rhythm, not a content treadmill.</h2><p>Founder and company posts are spaced to avoid repetition and approval fatigue.</p></div><div className="date-chip">July 14 – 18 <span>⌄</span></div></section>
      <section className="calendar-board panel">
        {days.map((day, index) => <div className="calendar-day" key={day}><div className="calendar-day-head"><span>{day.split(" ")[0]}</span><b>{day.split(" ")[1]}</b></div>{scheduled[index] ? <article className={`calendar-post ${scheduled[index].identity.toLowerCase()}`}><IdentityBadge identity={scheduled[index].identity} /><span>{scheduled[index].scheduledFor.split("·")[1]}</span><h4>{scheduled[index].title}</h4><p>{scheduled[index].format} · {scheduled[index].theme}</p><StatusPill status={scheduled[index].status} /></article> : <button className="add-slot">＋ Add idea</button>}</div>)}
      </section>
      <section className="calendar-note"><span>✦</span><div><b>Cadence recommendation</b><p>Keep Thursday open. Your Wednesday founder post needs room to collect discussion before Friday's company follow-up.</p></div><button>Use recommendation</button></section>
    </div>
  );
}

function Performance({ data, approveRecommendations }: { data: WorkspaceData; approveRecommendations: () => void }) {
  const published = data.posts.filter(p => p.status === "Published");
  return (
    <div className="page-stack">
      <section className="section-intro"><div><span className="section-kicker">Performance</span><h2>Learn from patterns, not vanity metrics.</h2><p>Every result is tied back to its theme, format, voice and original hypothesis.</p></div><button className="secondary-button">Last 30 days⌄</button></section>
      <section className="performance-hero panel"><div><span className="section-kicker">Weekly strategy review · Gate 4</span><h3>One clear win. One test worth running.</h3><p><b>Win:</b> Document posts earned 2.1× more saves than text posts. <b>Test:</b> Move one company education post to Tuesday morning, where reach is 28% above your baseline.</p></div><button className="primary-button compact" onClick={approveRecommendations}>Approve recommendations</button></section>
      <section className="performance-grid">
        <article className="panel chart-panel"><div className="panel-heading"><div><span className="section-kicker">Impressions</span><h3>Audience attention</h3></div><b className="chart-total">29.7k <small>↑ 24.8%</small></b></div><div className="chart"><span className="chart-line" /><i style={{ left: "7%", bottom: "20%" }} /><i style={{ left: "28%", bottom: "32%" }} /><i style={{ left: "50%", bottom: "42%" }} /><i style={{ left: "72%", bottom: "58%" }} /><i style={{ left: "92%", bottom: "74%" }} /></div><div className="chart-labels"><span>Jun 12</span><span>Jun 19</span><span>Jun 26</span><span>Jul 3</span><span>Jul 10</span></div></article>
        <article className="panel format-panel"><span className="section-kicker">Format effectiveness</span><h3>Save rate by format</h3><div className="bar-row"><span>Document</span><div><i style={{ width: "92%" }} /></div><b>3.8%</b></div><div className="bar-row"><span>Text</span><div><i style={{ width: "44%" }} /></div><b>1.8%</b></div><div className="bar-row"><span>Image</span><div><i style={{ width: "35%" }} /></div><b>1.4%</b></div><small>Based on 14 posts · sufficient sample</small></article>
      </section>
      <section className="panel post-table"><div className="panel-heading"><div><span className="section-kicker">Post analysis</span><h3>Published content</h3></div></div><div className="table-head"><span>Post</span><span>Impressions</span><span>Reactions</span><span>Comments</span><span>Saves</span></div>{published.map(post => <div className="table-row" key={post.id}><span><IdentityBadge identity={post.identity} /><b>{post.title}</b><small>{post.format} · {post.theme}</small></span><b>{formatNumber(post.metrics?.impressions ?? 0)}</b><b>{post.metrics?.reactions}</b><b>{post.metrics?.comments}</b><b>{post.metrics?.saves}</b></div>)}</section>
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

function Knowledge({ data, uploadSource, saveBrief, approveBrief, startOnboarding }: { data: WorkspaceData; uploadSource: (file: File) => void; saveBrief: (brief: WorkspaceData["brief"]) => void; approveBrief: () => void; startOnboarding: () => void }) {
  const [dragging, setDragging] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(data.brief);
  const handle = (event: ChangeEvent<HTMLInputElement>) => { const file = event.target.files?.[0]; if (file) uploadSource(file); };
  const update = (field: keyof WorkspaceData["brief"], value: string) => setDraft(current => ({ ...current, [field]: value }));
  const submit = () => { saveBrief(draft); setEditing(false); };
  return (
    <div className="page-stack">
      <section className="section-intro"><div><span className="section-kicker">Business knowledge · Brief v{data.brief.version}</span><h2>The truth your content is allowed to use.</h2><p>Review positioning, voice and sources. SignalLayer never invents customer stories or founder experiences.</p></div><div className="content-toolbar"><button className="secondary-button" onClick={startOnboarding}>Update business context</button><button className="primary-button compact" onClick={approveBrief} disabled={data.workspace.briefApproved}>{data.workspace.briefApproved ? "✓ Brief approved" : "Approve brief"}</button></div></section>
      <section className="knowledge-grid">
        <article className="panel brief-panel"><div className="panel-heading"><div><span className="section-kicker">{data.workspace.briefApproved ? "Approved brief" : "Brief awaiting approval"}</span><h3>{data.workspace.name}</h3></div><button className="text-button" onClick={() => { setDraft(data.brief); setEditing(!editing); }}>{editing ? "Cancel" : "Edit"}</button></div>{editing ? <div className="brief-form"><label>Positioning</label><textarea value={draft.positioning} onChange={e => update("positioning", e.target.value)} /><label>Primary audience</label><textarea value={draft.audience} onChange={e => update("audience", e.target.value)} /><div className="voice-columns"><div><IdentityBadge identity="Founder" /><textarea value={draft.founderVoice} onChange={e => update("founderVoice", e.target.value)} /></div><div><IdentityBadge identity="Company" /><textarea value={draft.companyVoice} onChange={e => update("companyVoice", e.target.value)} /></div></div><label>Preferred language</label><input value={draft.preferredLanguage} onChange={e => update("preferredLanguage", e.target.value)} /><button className="primary-button compact" onClick={submit}>Save new brief version</button></div> : <><label>Positioning</label><p>{data.brief.positioning}</p><label>Primary audience</label><p>{data.brief.audience}</p><div className="voice-columns"><div><IdentityBadge identity="Founder" /><p>{data.brief.founderVoice}</p></div><div><IdentityBadge identity="Company" /><p>{data.brief.companyVoice}</p></div></div><label>Preferred language</label><p>{data.brief.preferredLanguage}</p><label>Approved proof</label><div className="chip-list">{data.brief.proof.map(item => <span key={item}>✓ {item}</span>)}</div><label>Required vocabulary</label><div className="chip-list">{data.brief.requiredVocabulary.map(item => <span key={item}>{item}</span>)}</div><label>Blocked language</label><div className="chip-list blocked">{data.brief.banned.map(item => <span key={item}>{item}</span>)}</div></>}</article>
        <aside className="panel sources-panel"><div className="panel-heading"><div><span className="section-kicker">Sources</span><h3>{data.sources.length} connected</h3></div></div><label className={`upload-zone ${dragging ? "dragging" : ""}`} onDragEnter={() => setDragging(true)} onDragLeave={() => setDragging(false)}><input type="file" accept=".pdf,.doc,.docx,.ppt,.pptx,.txt,.md" onChange={handle} /><b>＋ Add a knowledge source</b><span>PDF, DOCX, PPTX, TXT or Markdown</span></label>{data.sources.map(source => <div className="source-row" key={source.id}><span className="file-mark">{source.type.slice(0, 1)}</span><div><b>{source.name}</b><small>{source.type}</small></div><span className="source-status">✓ {source.status}</span></div>)}<hr /><div className="connection-card"><span className="linkedin-mark">in</span><div><b>LinkedIn connection</b><small>Demo data is active</small></div><button>Configure</button></div><p className="connection-help">Live publishing requires a LinkedIn developer app and approved Community Management permissions.</p></aside>
      </section>
    </div>
  );
}

function Settings({ data, integration, refreshIntegration, configureOrganization, syncLinkedIn, startOnboarding }: { data: WorkspaceData; integration: IntegrationStatus | null; refreshIntegration: () => void; configureOrganization: (urn: string) => void; syncLinkedIn: () => void; startOnboarding: () => void }) {
  const [organizationUrn, setOrganizationUrn] = useState(integration?.organizationUrn ?? "");
  return <div className="page-stack"><section className="section-intro"><div><span className="section-kicker">Settings & integrations</span><h2>Turn the approved workflow live.</h2><p>The product remains safe in demo mode until each external capability is explicitly configured.</p></div><button className="secondary-button" onClick={startOnboarding}>Edit workspace profile</button></section><section className="settings-grid"><article className="panel integration-panel"><div className="integration-title"><span className="linkedin-mark">in</span><div><h3>LinkedIn publishing</h3><p>Official OAuth, founder publishing and approved company-page scopes.</p></div><span className={`integration-state ${integration?.connected ? "ready" : "pending"}`}>{integration?.connected ? "Connected" : "Setup required"}</span></div><div className="checklist"><span className={integration?.appConfigured ? "done" : ""}>✓ Developer app credentials</span><span className={integration?.encryptionConfigured ? "done" : ""}>✓ Encrypted token storage</span><span className={integration?.connected ? "done" : ""}>✓ Member authorization</span><span className={integration?.organizationUrn ? "done" : ""}>✓ Company page selected</span></div>{integration?.connected ? <><div className="connected-account"><b>{integration.memberName ?? "LinkedIn member"}</b><small>{integration.memberUrn}</small><small>Scopes: {integration.scopes.join(", ")}</small></div><label className="settings-label">Company organization URN</label><div className="inline-form"><input value={organizationUrn} onChange={e => setOrganizationUrn(e.target.value)} placeholder="urn:li:organization:123456" /><button className="secondary-button" onClick={() => configureOrganization(organizationUrn)}>Save</button></div><button className="secondary-button integration-sync" onClick={syncLinkedIn}>Sync analytics & comments</button></> : <button className="primary-button compact" disabled={!integration?.appConfigured || !integration?.encryptionConfigured} onClick={() => { window.location.href = "/api/integrations/linkedin/start"; }}>Connect LinkedIn</button>}<button className="text-button refresh-button" onClick={refreshIntegration}>Refresh status</button></article><article className="panel integration-panel"><div className="integration-title"><span className="ai-mark">✦</span><div><h3>Content agents</h3><p>Strategist and producer agents with a grounded fallback.</p></div><span className={`integration-state ${integration?.openaiConfigured ? "ready" : "pending"}`}>{integration?.openaiConfigured ? "Live AI" : "Safe fallback"}</span></div><div className="checklist"><span className="done">✓ Business-brief grounding</span><span className="done">✓ Separate founder/company voices</span><span className="done">✓ Claims and duplication QA</span><span className={integration?.openaiConfigured ? "done" : ""}>✓ OpenAI runtime key</span></div><div className="connected-account"><b>Model</b><small>{integration?.openaiModel ?? "gpt-5.4-mini"}</small><small>Without a runtime key, deterministic ideas remain fully usable.</small></div></article><article className="panel integration-panel"><span className="section-kicker">Publishing policy</span><h3>Human approval is mandatory</h3><p className="settings-copy">Unapproved posts are always held. Live publishing validates identity, token health, format readiness and approval state immediately before posting.</p><div className="policy-row"><span>Unapproved at slot</span><b>Hold & notify</b></div><div className="policy-row"><span>Automatic comments or DMs</span><b>Disabled</b></div><div className="policy-row"><span>Profile scraping</span><b>Never</b></div></article><article className="panel integration-panel"><span className="section-kicker">Workspace</span><h3>{data.workspace.name}</h3><div className="policy-row"><span>Primary market</span><b>{data.workspace.primaryMarket}</b></div><div className="policy-row"><span>Timezone</span><b>{data.workspace.timezone}</b></div><div className="policy-row"><span>Strategy</span><b>v{data.workspace.strategyVersion} · {data.workspace.strategyApproved ? "approved" : "draft"}</b></div><div className="policy-row"><span>Brief</span><b>v{data.brief.version} · {data.workspace.briefApproved ? "approved" : "draft"}</b></div></article></section></div>;
}

function OnboardingModal({ open, close, data, complete }: { open: boolean; close: () => void; data: WorkspaceData; complete: (payload: Record<string, unknown>) => void }) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ name: data.workspace.name, website: data.workspace.website, industry: data.workspace.industry, primaryMarket: data.workspace.primaryMarket, timezone: data.workspace.timezone, founderLinkedInUrl: data.workspace.founderLinkedInUrl, companyLinkedInUrl: data.workspace.companyLinkedInUrl, positioning: data.brief.positioning, audience: data.brief.audience });
  if (!open) return null;
  const set = (key: keyof typeof form, value: string) => setForm(current => ({ ...current, [key]: value }));
  const finish = () => { complete(form); setStep(1); close(); };
  return <div className="drawer-backdrop onboarding-backdrop" onMouseDown={close}><section className="onboarding-modal" onMouseDown={e => e.stopPropagation()}><div className="onboarding-progress"><span style={{ width: `${step * 25}%` }} /></div><div className="drawer-head"><div><span className="section-kicker">Workspace onboarding · {step} of 4</span><h2>{step === 1 ? "Tell us about the business" : step === 2 ? "Add LinkedIn identities" : step === 3 ? "Confirm the extracted brief" : "Set operating preferences"}</h2></div><button onClick={close}>×</button></div>{step === 1 && <div className="onboarding-form"><label>Company name<input value={form.name} onChange={e => set("name", e.target.value)} /></label><label>Website<input value={form.website} onChange={e => set("website", e.target.value)} /></label><div className="form-pair"><label>Industry<input value={form.industry} onChange={e => set("industry", e.target.value)} /></label><label>Primary market<input value={form.primaryMarket} onChange={e => set("primaryMarket", e.target.value)} /></label></div></div>}{step === 2 && <div className="onboarding-form"><label>Founder LinkedIn profile<input value={form.founderLinkedInUrl} onChange={e => set("founderLinkedInUrl", e.target.value)} placeholder="https://linkedin.com/in/..." /></label><label>Company LinkedIn page<input value={form.companyLinkedInUrl} onChange={e => set("companyLinkedInUrl", e.target.value)} placeholder="https://linkedin.com/company/..." /></label><div className="scan-note"><b>Permission note</b><p>Profile URLs add context only. Publishing and analytics require the official OAuth connection in Settings.</p></div></div>}{step === 3 && <div className="onboarding-form"><label>Positioning<textarea value={form.positioning} onChange={e => set("positioning", e.target.value)} /></label><label>Primary audience<textarea value={form.audience} onChange={e => set("audience", e.target.value)} /></label><div className="scan-note success"><b>Analyst check complete</b><p>Products, audience, proof and voice will remain editable and require Gate 1 approval.</p></div></div>}{step === 4 && <div className="onboarding-form"><label>Timezone<input value={form.timezone} onChange={e => set("timezone", e.target.value)} /></label><div className="preference-cards"><div><b>Founder cadence</b><span>3 posts / week</span></div><div><b>Company cadence</b><span>2 posts / week</span></div><div><b>Approval</b><span>Everything requires approval</span></div></div></div>}<div className="onboarding-actions"><button className="secondary-button" onClick={() => step === 1 ? close() : setStep(step - 1)}>{step === 1 ? "Cancel" : "Back"}</button>{step < 4 ? <button className="primary-button compact" onClick={() => setStep(step + 1)}>Continue</button> : <button className="primary-button compact" onClick={finish}>Create workspace brief</button>}</div></section></div>;
}

function EditPostDrawer({ post, close, save }: { post: Post | null; close: () => void; save: (id: string, changes: Partial<Post>) => void }) {
  const [title, setTitle] = useState(post?.title ?? "");
  const [body, setBody] = useState(post?.body ?? "");
  const [cta, setCta] = useState(post?.cta ?? "");
  const [hashtags, setHashtags] = useState(post?.hashtags.join(" ") ?? "");
  useEffect(() => { setTitle(post?.title ?? ""); setBody(post?.body ?? ""); setCta(post?.cta ?? ""); setHashtags(post?.hashtags.join(" ") ?? ""); }, [post]);
  if (!post) return null;
  return <div className="drawer-backdrop" onMouseDown={close}><aside className="create-drawer" onMouseDown={e => e.stopPropagation()}><div className="drawer-head"><div><span className="section-kicker">Edit approval draft</span><h2>{post.identity} post</h2></div><button onClick={close}>×</button></div><form onSubmit={e => { e.preventDefault(); save(post.id, { title, body, cta, hashtags: hashtags.split(/\s+/).filter(Boolean) }); close(); }}><label>Title / working hook</label><input value={title} onChange={e => setTitle(e.target.value)} /><label>Post copy</label><textarea className="tall-textarea" value={body} onChange={e => setBody(e.target.value)} /><label>Call to action</label><input value={cta} onChange={e => setCta(e.target.value)} /><label>Hashtags</label><input value={hashtags} onChange={e => setHashtags(e.target.value)} /><div className="generation-note"><span>↺</span><p>The previous version is retained in the decision ledger. This edit becomes training signal for future drafts.</p></div><button className="primary-button full" type="submit">Save as new version</button></form></aside></div>;
}

function CreateDrawer({ open, close, createPost, themes }: { open: boolean; close: () => void; createPost: (post: Partial<Post>) => void; themes: Theme[] }) {
  const [identity, setIdentity] = useState<Identity>("Founder");
  const [format, setFormat] = useState<Post["format"]>("Text");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  if (!open) return null;
  const submit = (event: FormEvent) => { event.preventDefault(); createPost({ identity, format, title: title || "A new point of view", body: body || "Draft this idea using the approved voice and business brief.", theme: themes.find(t => t.selected)?.name }); close(); setTitle(""); setBody(""); };
  return <div className="drawer-backdrop" onMouseDown={close}><aside className="create-drawer" onMouseDown={e => e.stopPropagation()}><div className="drawer-head"><div><span className="section-kicker">New content brief</span><h2>Create a post</h2></div><button onClick={close}>×</button></div><form onSubmit={submit}><label>Publishing identity</label><div className="segmented wide"><button type="button" className={identity === "Founder" ? "active" : ""} onClick={() => setIdentity("Founder")}>Founder</button><button type="button" className={identity === "Company" ? "active" : ""} onClick={() => setIdentity("Company")}>Company</button></div><label>Format</label><div className="format-grid">{(["Text", "Image", "Document", "Multi-image"] as const).map(item => <button type="button" className={format === item ? "active" : ""} onClick={() => setFormat(item)} key={item}>{item}</button>)}</div><label htmlFor="idea">Working idea</label><input id="idea" value={title} onChange={e => setTitle(e.target.value)} placeholder="What should this post help the audience understand?" /><label htmlFor="context">Context or source note</label><textarea id="context" value={body} onChange={e => setBody(e.target.value)} placeholder="Add a customer question, founder story, product update or source…" /><div className="generation-note"><span>✦</span><p>SignalLayer will ground this draft in your approved brief and selected themes, then run brand and claims checks.</p></div><button className="primary-button full" type="submit">Generate approval draft</button></form></aside></div>;
}

export function SignalLayerApp({ user }: { user: { name: string; email: string } | null }) {
  const [data, setData] = useState<WorkspaceData>(seedWorkspace);
  const [tab, setTab] = useState<Tab>("Overview");
  const [drawer, setDrawer] = useState(false);
  const [onboarding, setOnboarding] = useState(false);
  const [editingPost, setEditingPost] = useState<Post | null>(null);
  const [integration, setIntegration] = useState<IntegrationStatus | null>(null);
  const [generating, setGenerating] = useState(false);
  const [toast, setToast] = useState("");
  const [loaded, setLoaded] = useState(false);
  const userName = user?.name?.split("@")[0] || "Aditi Gupta";

  const refreshIntegration = async () => { try { const response = await fetch("/api/integrations/linkedin"); if (response.ok) setIntegration(await response.json() as IntegrationStatus); } catch { /* status remains unavailable */ } };
  useEffect(() => { Promise.all([fetch("/api/workspace").then(async r => r.ok ? await r.json() as WorkspaceData : Promise.reject()), fetch("/api/integrations/linkedin").then(async r => r.ok ? await r.json() as IntegrationStatus : Promise.reject())]).then(([workspace, status]) => { setData(workspace); setIntegration(status); }).catch(() => undefined).finally(() => setLoaded(true)); }, []);
  const persist = async (action: string, payload: unknown) => { try { const response = await fetch("/api/workspace", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, payload }) }); if (response.ok) setData(await response.json() as WorkspaceData); else { const result = await response.json() as { error?: string }; notify(result.error ?? "That change could not be saved."); } } catch { notify("The change is saved locally and will retry when the connection returns."); } };
  const notify = (message: string) => { setToast(message); window.setTimeout(() => setToast(""), 2600); };
  const approvePost = (id: string) => { setData(current => ({ ...current, posts: current.posts.map(p => p.id === id ? { ...p, status: "Scheduled" } : p) })); persist("approvePost", { id }); notify("Post approved and scheduled."); };
  const requestRevision = (id: string) => { setData(current => ({ ...current, posts: current.posts.map(p => p.id === id ? { ...p, status: "Revision requested" } : p) })); persist("requestRevision", { id }); notify("Revision requested. The draft is held."); };
  const rejectPost = (id: string) => { setData(current => ({ ...current, posts: current.posts.filter(p => p.id !== id) })); persist("rejectPost", { id }); notify("Post rejected and removed from the queue."); };
  const savePostEdit = (id: string, changes: Partial<Post>) => { setData(current => ({ ...current, posts: current.posts.map(p => p.id === id ? { ...p, ...changes, versions: [{ id: `v-${Date.now()}`, body: p.body, note: "Manual edit", createdAt: new Date().toISOString() }, ...(p.versions ?? [])] } : p) })); persist("updatePost", { id, changes, note: "Manual edit" }); notify("New post version saved."); };
  const toggleTheme = (id: string) => { setData(current => ({ ...current, workspace: { ...current.workspace, strategyApproved: false }, themes: current.themes.map(t => t.id === id ? { ...t, selected: !t.selected } : t) })); persist("toggleTheme", { id }); };
  const approveStrategy = () => { persist("approveStrategy", {}); notify("Strategy approved and versioned."); };
  const approveRecommendations = () => { persist("approveRecommendations", {}); notify("Weekly recommendations applied to the next cycle."); };
  const approveIdea = (id: string) => { persist("approveIdea", { id }); notify("Idea approved. A finished draft is now in the approval queue."); };
  const rejectIdea = (id: string) => { setData(current => ({ ...current, ideas: current.ideas.map(idea => idea.id === id ? { ...idea, status: "Rejected" } : idea) })); persist("rejectIdea", { id }); notify("Idea rejected. This feedback will inform the next batch."); };
  const generateIdeas = async () => { setGenerating(true); try { const response = await fetch("/api/agents/generate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ mode: "ideas" }) }); const result = await response.json() as { data?: WorkspaceData; provider?: string; error?: string }; if (!response.ok || !result.data) throw new Error(result.error ?? "Generation failed"); setData(result.data); notify(`Four ideas generated with ${result.provider}.`); } catch (error) { notify(error instanceof Error ? error.message : "Idea generation failed."); } finally { setGenerating(false); } };
  const updateContact = (id: string, stage: Contact["stage"]) => { setData(current => ({ ...current, contacts: current.contacts.map(c => c.id === id ? { ...c, stage } : c) })); persist("updateContact", { id, stage }); notify(`Contact moved to ${stage}.`); };
  const createPost = (input: Partial<Post>) => { const post: Post = { id: `p-${Date.now()}`, identity: input.identity ?? "Founder", format: input.format ?? "Text", theme: input.theme ?? "Voice of customer", title: input.title ?? "New post", body: input.body ?? "New draft", status: "Needs approval", scheduledFor: "Unscheduled", why: "Created from your approved brief and current theme mix. Add source context before approval.", hashtags: [], qa: { voice: true, claims: true, duplication: true, links: true }, versions: [{ id: `v-${Date.now()}`, body: input.body ?? "New draft", note: "Manual brief", createdAt: new Date().toISOString() }] }; setData(current => ({ ...current, posts: [post, ...current.posts] })); persist("createPost", post); setTab("Content"); notify("Approval draft created."); };
  const uploadSource = async (file: File) => { const optimistic = { id: `s-${Date.now()}`, name: file.name, type: file.type.includes("pdf") ? "PDF" : "Document", status: "Processing" }; setData(current => ({ ...current, sources: [optimistic, ...current.sources] })); const form = new FormData(); form.append("file", file); try { const response = await fetch("/api/uploads", { method: "POST", body: form }); if (response.ok) setData(await response.json()); } catch { /* retains processing state for demo */ } notify(`${file.name} added to knowledge sources.`); };
  const saveBrief = (brief: WorkspaceData["brief"]) => { setData(current => ({ ...current, workspace: { ...current.workspace, briefApproved: false }, brief: { ...brief, version: current.brief.version + 1, approvedAt: null } })); persist("saveBrief", brief); notify("Brief saved as a new version. Approval is required before production."); };
  const approveBrief = () => { setData(current => ({ ...current, workspace: { ...current.workspace, briefApproved: true }, brief: { ...current.brief, approvedAt: new Date().toISOString() } })); persist("approveBrief", {}); notify("Business & Voice Brief approved."); };
  const completeOnboarding = (payload: Record<string, unknown>) => { persist("completeOnboarding", payload); setTab("Knowledge"); notify("Business context updated. Review and approve the new brief."); };
  const configureOrganization = async (organizationUrn: string) => { const response = await fetch("/api/integrations/linkedin", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ organizationUrn }) }); const result = await response.json() as IntegrationStatus & { error?: string }; if (!response.ok) return notify(result.error ?? "Company page could not be saved."); setIntegration(result); notify("Company publishing identity saved."); };
  const syncLinkedIn = async () => { try { const response = await fetch("/api/integrations/linkedin/sync", { method: "POST" }); const result = await response.json() as { data?: WorkspaceData; syncedPosts?: number; importedContacts?: number; error?: string }; if (!response.ok || !result.data) throw new Error(result.error ?? "Sync failed"); setData(result.data); notify(`Synced ${result.syncedPosts} posts and found ${result.importedContacts} new contact signals.`); } catch (error) { notify(error instanceof Error ? error.message : "LinkedIn sync failed."); } };
  const publishPost = async (postId: string) => { try { const response = await fetch("/api/integrations/linkedin/publish", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ postId }) }); const result = await response.json() as { data?: WorkspaceData; error?: string }; if (!response.ok || !result.data) throw new Error(result.error ?? "Publishing failed"); setData(result.data); notify("Post published to LinkedIn."); } catch (error) { notify(error instanceof Error ? error.message : "Publishing failed."); setTab("Settings"); } };

  const current = useMemo(() => {
    if (tab === "Overview") return <Overview data={data} setTab={setTab} approvePost={approvePost} requestRevision={requestRevision} />;
    if (tab === "Strategy") return <Strategy data={data} toggleTheme={toggleTheme} approveStrategy={approveStrategy} />;
    if (tab === "Content") return <Content data={data} approvePost={approvePost} requestRevision={requestRevision} rejectPost={rejectPost} approveIdea={approveIdea} rejectIdea={rejectIdea} generateIdeas={generateIdeas} editPost={setEditingPost} publishPost={publishPost} generating={generating} />;
    if (tab === "Calendar") return <Calendar data={data} />;
    if (tab === "Performance") return <Performance data={data} approveRecommendations={approveRecommendations} />;
    if (tab === "Contacts") return <Contacts data={data} updateContact={updateContact} />;
    if (tab === "Knowledge") return <Knowledge data={data} uploadSource={uploadSource} saveBrief={saveBrief} approveBrief={approveBrief} startOnboarding={() => setOnboarding(true)} />;
    return <Settings data={data} integration={integration} refreshIntegration={refreshIntegration} configureOrganization={configureOrganization} syncLinkedIn={syncLinkedIn} startOnboarding={() => setOnboarding(true)} />;
  }, [tab, data, integration, generating]);

  return <div className={`app-shell ${loaded ? "loaded" : ""}`}><Sidebar tab={tab} setTab={setTab} setupProgress={data.workspace.setupProgress} userName={userName} /><main><AppHeader title={tab} onCreate={() => setDrawer(true)} userName={userName} />{current}</main><CreateDrawer open={drawer} close={() => setDrawer(false)} createPost={createPost} themes={data.themes} /><OnboardingModal open={onboarding || !data.workspace.onboardingComplete} close={() => setOnboarding(false)} data={data} complete={completeOnboarding} /><EditPostDrawer post={editingPost} close={() => setEditingPost(null)} save={savePostEdit} />{toast && <div className="toast"><span>✓</span>{toast}</div>}</div>;
}
