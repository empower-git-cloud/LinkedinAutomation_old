export type Identity = "Founder" | "Company";
export type PostStatus = "Needs approval" | "Scheduled" | "Published" | "Revision requested" | "Rejected";

export type Idea = {
  id: string;
  identity: Identity;
  theme: string;
  format: Post["format"];
  hook: string;
  angle: string;
  evidence: string;
  cta: string;
  status: "Proposed" | "Approved" | "Rejected" | "Produced";
};

export type Theme = {
  id: string;
  name: string;
  description: string;
  score: number;
  selected: boolean;
  evidence: string;
  /** What is currently performing on LinkedIn that justifies this theme (Trend & Relevance signal). */
  whatsWorking?: string;
  fit: Identity | "Both";
  color: string;
};

export type Post = {
  id: string;
  identity: Identity;
  format: "Text" | "Image" | "Document" | "Multi-image";
  theme: string;
  title: string;
  body: string;
  status: PostStatus;
  /** ISO UTC timestamp, or null when unscheduled. Display strings are derived at render time. */
  scheduledFor: string | null;
  publishedAt?: string;
  rejectedAt?: string;
  revisionNote?: string;
  /** Set when automatic publishing failed; the post is held until the user re-approves. */
  holdReason?: string;
  why: string;
  hashtags: string[];
  hook?: string;
  cta?: string;
  altText?: string;
  qa?: { voice: boolean; claims: boolean; duplication: boolean; links: boolean };
  qaNotes?: string[];
  versions?: { id: string; body: string; note: string; createdAt: string }[];
  creativeSlides?: { heading: string; copy: string }[];
  linkedinPostUrn?: string;
  metrics?: { impressions: number; reactions: number; comments: number; saves: number };
};

export type Contact = {
  id: string;
  name: string;
  role: string;
  company: string;
  comment: string;
  intent: "High" | "Medium" | "Low";
  sentiment: "Interested" | "Question" | "Supportive" | "Neutral";
  stage: "New" | "Reviewing" | "Qualified" | "Not a lead";
  source: string;
  initials: string;
  notes?: string;
};

export type ActivityEvent = {
  id: string;
  at: string;
  kind: "publish" | "publish-failed" | "hold" | "sync" | "approval" | "system";
  message: string;
  postId?: string;
  read?: boolean;
};

export type KnowledgeSource = {
  id: string;
  name: string;
  type: string;
  status: string;
  /** True when text could be extracted and is available to the AI. */
  readable?: boolean;
  textPreview?: string;
};

export type AccountType = "Business" | "Individual";
export type BuildPeriod = 1 | 3 | 7;

/** Individual (personal-brand) profile derived from a LinkedIn profile + optional manual notes. */
export type IndividualProfile = {
  linkedInUrl: string;
  fullName: string;
  headline: string;
  role: string;
  experienceSummary: string;
  companies: string[];
  manualInput: string;
  analyzedAt: string | null;
};

export type WorkspaceData = {
  workspace: {
    name: string;
    /** Which onboarding + strategy journey this workspace follows. */
    accountType: AccountType;
    website: string;
    industry: string;
    timezone: string;
    setupProgress: number;
    briefApproved: boolean;
    linkedinMode: "Demo" | "Live";
    onboardingComplete: boolean;
    primaryMarket: string;
    founderLinkedInUrl: string;
    companyLinkedInUrl: string;
    strategyVersion: number;
    strategyApproved: boolean;
  };
  /** Populated only for Individual workspaces. */
  individual: IndividualProfile;
  brief: {
    positioning: string;
    audience: string;
    founderVoice: string;
    companyVoice: string;
    proof: string[];
    banned: string[];
    preferredLanguage: string;
    requiredVocabulary: string[];
    founderExamples: string[];
    version: number;
    approvedAt: string | null;
  };
  themes: Theme[];
  ideas: Idea[];
  posts: Post[];
  contacts: Contact[];
  sources: KnowledgeSource[];
  events: ActivityEvent[];
};

/** ISO timestamp `days` from now at the given UTC hour/minute — keeps demo data alive relative to today. */
function at(days: number, hour: number, minute = 0) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  date.setUTCHours(hour, minute, 0, 0);
  return date.toISOString();
}

export function formatDateTime(iso: string | null | undefined, timezone?: string) {
  if (!iso) return "Unscheduled";
  const stamp = Date.parse(iso);
  if (!Number.isFinite(stamp)) return "Unscheduled";
  try {
    return new Date(stamp).toLocaleString("en-US", { timeZone: timezone, weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  } catch {
    return new Date(stamp).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  }
}

export function formatTime(iso: string | null | undefined, timezone?: string) {
  if (!iso) return "—";
  const stamp = Date.parse(iso);
  if (!Number.isFinite(stamp)) return "—";
  try {
    return new Date(stamp).toLocaleTimeString("en-US", { timeZone: timezone, hour: "numeric", minute: "2-digit" });
  } catch {
    return new Date(stamp).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  }
}

export function sameLocalDay(iso: string | null | undefined, day: Date, timezone?: string) {
  if (!iso) return false;
  const stamp = Date.parse(iso);
  if (!Number.isFinite(stamp)) return false;
  const options: Intl.DateTimeFormatOptions = { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" };
  try {
    return new Date(stamp).toLocaleDateString("en-CA", options) === day.toLocaleDateString("en-CA", options);
  } catch {
    return new Date(stamp).toDateString() === day.toDateString();
  }
}

/** A brand-new signed-in user starts here: no demo content, onboarding not yet done. */
export function emptyWorkspace(): WorkspaceData {
  return {
    workspace: {
      name: "",
      accountType: "Business",
      website: "",
      industry: "",
      timezone: "UTC",
      setupProgress: 10,
      briefApproved: false,
      linkedinMode: "Demo",
      onboardingComplete: false,
      primaryMarket: "",
      founderLinkedInUrl: "",
      companyLinkedInUrl: "",
      strategyVersion: 1,
      strategyApproved: false,
    },
    individual: { linkedInUrl: "", fullName: "", headline: "", role: "", experienceSummary: "", companies: [], manualInput: "", analyzedAt: null },
    brief: { positioning: "", audience: "", founderVoice: "", companyVoice: "", proof: [], banned: [], preferredLanguage: "English", requiredVocabulary: [], founderExamples: [], version: 1, approvedAt: null },
    themes: [],
    ideas: [],
    posts: [],
    contacts: [],
    sources: [],
    events: [],
  };
}

export const seedWorkspace: WorkspaceData = {
  workspace: {
    name: "Northstar Labs",
    accountType: "Business",
    website: "northstarlabs.ai",
    industry: "B2B AI software",
    timezone: "Asia/Kolkata",
    setupProgress: 78,
    briefApproved: true,
    linkedinMode: "Demo",
    onboardingComplete: true,
    primaryMarket: "India and global English-speaking B2B markets",
    founderLinkedInUrl: "https://www.linkedin.com/in/aditi-gupta",
    companyLinkedInUrl: "https://www.linkedin.com/company/northstar-labs",
    strategyVersion: 3,
    strategyApproved: true,
  },
  individual: {
    linkedInUrl: "",
    fullName: "",
    headline: "",
    role: "",
    experienceSummary: "",
    companies: [],
    manualInput: "",
    analyzedAt: null,
  },
  brief: {
    positioning: "Northstar helps revenue teams turn scattered customer conversations into clear, actionable market intelligence.",
    audience: "Founders and revenue leaders at B2B software companies with 20–200 employees.",
    founderVoice: "Direct, thoughtful and experience-led. Short sentences. Specific lessons over sweeping claims.",
    companyVoice: "Clear, useful and evidence-first. Product detail supported by customer outcomes.",
    proof: ["34% faster insight-to-action cycle", "Used by 42 revenue teams", "SOC 2 Type II"],
    banned: ["revolutionary", "game-changing", "guaranteed growth"],
    preferredLanguage: "English — clear, direct and conversational",
    requiredVocabulary: ["customer signal", "evidence", "context"],
    founderExamples: [
      "Specific operating lessons with a clear tension and one practical conclusion.",
      "Short paragraphs, honest caveats, and no manufactured vulnerability.",
    ],
    version: 3,
    approvedAt: "2026-07-10T09:30:00.000Z",
  },
  themes: [
    {
      id: "t1",
      name: "Voice of customer",
      description: "Turn real customer language into better product and revenue decisions.",
      score: 94,
      selected: true,
      evidence: "18 support questions + your top-performing founder post",
      fit: "Both",
      color: "#3559e0",
    },
    {
      id: "t2",
      name: "Founder field notes",
      description: "Honest lessons from building an AI product with revenue teams.",
      score: 91,
      selected: true,
      evidence: "Strong founder authority + 1.7× median saves",
      fit: "Founder",
      color: "#db6b3f",
    },
    {
      id: "t3",
      name: "AI without the theatre",
      description: "Practical guidance for evaluating and deploying AI responsibly.",
      score: 88,
      selected: true,
      evidence: "Current buyer concern + new industry report",
      fit: "Both",
      color: "#5f8c70",
    },
    {
      id: "t4",
      name: "Revenue intelligence",
      description: "Frameworks for finding the signal hidden across calls, tickets and CRM notes.",
      score: 84,
      selected: true,
      evidence: "Core product relevance + sales objection frequency",
      fit: "Company",
      color: "#9a68b5",
    },
    {
      id: "t5",
      name: "Building trust in AI",
      description: "How teams can create adoption through transparency and control.",
      score: 76,
      selected: false,
      evidence: "Relevant but similar to an active theme",
      fit: "Founder",
      color: "#ad8c34",
    },
  ],
  ideas: [
    {
      id: "i1",
      identity: "Founder",
      theme: "Voice of customer",
      format: "Text",
      hook: "Most customer interviews fail before the first question.",
      angle: "Explain why interview context matters more than the perfect question list.",
      evidence: "18 support questions and an approved founder workshop transcript",
      cta: "Ask readers what they do before a customer call.",
      status: "Proposed",
    },
    {
      id: "i2",
      identity: "Company",
      theme: "Revenue intelligence",
      format: "Document",
      hook: "The five places customer signal disappears",
      angle: "A practical signal-loss map spanning calls, support, CRM, Slack and product usage.",
      evidence: "Product narrative plus three approved customer stories",
      cta: "Invite teams to score their own signal flow.",
      status: "Proposed",
    },
    {
      id: "i3",
      identity: "Founder",
      theme: "AI without the theatre",
      format: "Image",
      hook: "A reliable AI feature needs an answer for when it is wrong.",
      angle: "Share a three-part reliability test from direct implementation experience.",
      evidence: "Approved product principle and founder field note",
      cta: "Ask which failure mode teams test first.",
      status: "Approved",
    },
  ],
  posts: [
    {
      id: "p1",
      identity: "Founder",
      format: "Text",
      theme: "Founder field notes",
      title: "The customer interview mistake I repeated for two years",
      body: "For two years, I ended every customer interview with the same question: “What features should we build next?”\n\nIt felt customer-centric. It was actually outsourcing product strategy.\n\nThe useful signal came when we stopped asking for solutions and started replaying the moment the problem appeared...",
      status: "Needs approval",
      scheduledFor: at(1, 3, 40),
      why: "Your audience saves specific operating lessons. This uses a verified founder story and supports the Voice of Customer theme without mentioning the product too early.",
      hashtags: ["#VoiceOfCustomer", "#ProductStrategy"],
      hook: "The customer interview mistake I repeated for two years",
      cta: "What question did you stop asking customers?",
      altText: "Text-only founder post about improving customer interviews.",
      versions: [{ id: "v1", body: "Initial draft from the approved founder story.", note: "Agent draft", createdAt: at(-1, 3, 10) }],
    },
    {
      id: "p2",
      identity: "Company",
      format: "Document",
      theme: "Revenue intelligence",
      title: "7 signals your customer feedback system is broken",
      body: "A seven-page document post using the approved Signal Notes template. Each page pairs a common failure mode with a practical diagnostic.",
      status: "Needs approval",
      scheduledFor: at(2, 6, 0),
      why: "Diagnostic checklists give each signal room to be useful. The document format supports save-worthy depth.",
      hashtags: ["#RevenueOperations", "#CustomerIntelligence"],
      hook: "Seven signals your customer feedback system is broken",
      cta: "Save the checklist and score your current system.",
      altText: "Seven-page diagnostic document for customer feedback systems.",
      creativeSlides: [
        { heading: "7 signals", copy: "Your customer feedback system is broken" },
        { heading: "01", copy: "Insights live in five tools and belong to nobody" },
        { heading: "02", copy: "The loudest anecdote becomes the roadmap" },
        { heading: "03", copy: "Sales and product use different customer language" },
        { heading: "04", copy: "Patterns arrive after the decision" },
      ],
      versions: [{ id: "v1", body: "Initial seven-page document outline.", note: "Agent draft", createdAt: at(-1, 3, 14) }],
    },
    {
      id: "p3",
      identity: "Founder",
      format: "Image",
      theme: "AI without the theatre",
      title: "A simple test for an AI feature",
      body: "If you cannot explain what happens when the model is wrong, you do not have a feature yet. You have a demo.",
      status: "Scheduled",
      scheduledFor: at(3, 3, 40),
      why: "A concise, defensible point of view that matches your approved voice and opens a conversation around responsible deployment.",
      hashtags: ["#ResponsibleAI"],
    },
    {
      id: "p4",
      identity: "Company",
      format: "Multi-image",
      theme: "Voice of customer",
      title: "From 600 conversations to three decisions",
      body: "How one revenue team found repeated churn risk across calls, support tickets and CRM notes—without another dashboard.",
      status: "Scheduled",
      scheduledFor: at(5, 6, 50),
      why: "The customer outcome is approved proof. A process-led adaptation keeps it distinct from the founder's personal lesson post.",
      hashtags: ["#CustomerExperience", "#B2BSaaS"],
    },
    {
      id: "p5",
      identity: "Founder",
      format: "Text",
      theme: "Founder field notes",
      title: "Small sample, strong signal",
      body: "You do not need 1,000 customer calls to find a pattern. You need enough context to understand when the pattern matters.",
      status: "Published",
      scheduledFor: at(-12, 3, 35),
      publishedAt: at(-12, 3, 35),
      why: "Follow-up to a recurring sales question.",
      hashtags: ["#FounderLessons"],
      metrics: { impressions: 18420, reactions: 416, comments: 38, saves: 129 },
    },
    {
      id: "p6",
      identity: "Company",
      format: "Document",
      theme: "Revenue intelligence",
      title: "The revenue signal map",
      body: "A practical map of the five places customer intelligence gets lost.",
      status: "Published",
      scheduledFor: at(-15, 6, 2),
      publishedAt: at(-15, 6, 2),
      why: "Core educational asset.",
      hashtags: ["#RevOps"],
      metrics: { impressions: 11280, reactions: 244, comments: 19, saves: 206 },
    },
  ],
  contacts: [
    {
      id: "c1",
      name: "Rohan Mehta",
      role: "VP Revenue Operations",
      company: "Cloudframe",
      comment: "This is exactly the problem we're trying to solve across Gong and Zendesk. Is there a way to see the workflow?",
      intent: "High",
      sentiment: "Interested",
      stage: "New",
      source: "Small sample, strong signal",
      initials: "RM",
    },
    {
      id: "c2",
      name: "Maya Chen",
      role: "Head of Customer Success",
      company: "TandemHQ",
      comment: "How do you separate a loud anecdote from a pattern worth acting on?",
      intent: "Medium",
      sentiment: "Question",
      stage: "Reviewing",
      source: "The revenue signal map",
      initials: "MC",
    },
    {
      id: "c3",
      name: "Arjun Rao",
      role: "Co-founder",
      company: "Metricly",
      comment: "The distinction between more data and better context is spot on.",
      intent: "Low",
      sentiment: "Supportive",
      stage: "Not a lead",
      source: "Small sample, strong signal",
      initials: "AR",
    },
  ],
  sources: [
    { id: "s1", name: "northstarlabs.ai", type: "Website", status: "Synced", readable: true, textPreview: "Northstar helps revenue teams turn scattered customer conversations into clear, actionable market intelligence." },
    { id: "s2", name: "Product narrative.pdf", type: "PDF", status: "Stored — AI cannot read this file type yet", readable: false },
    { id: "s3", name: "Customer stories.docx", type: "Document", status: "Stored — AI cannot read this file type yet", readable: false },
    { id: "s4", name: "Brand system.pdf", type: "Brand guide", status: "Stored — AI cannot read this file type yet", readable: false },
  ],
  events: [],
};
