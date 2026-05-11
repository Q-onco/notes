export interface Note {
  id: string;
  title: string;
  body: string;
  tags: string[];
  createdAt: number;
  updatedAt: number;
  pinned: boolean;
  archived: boolean;
  audioIds: string[];
  color?: 'ac' | 'gn' | 'rd' | 'yw' | 'pu' | 'enzo';
  wordTarget?: number;
}

export interface JournalEntry {
  id: string;
  body: string;
  mood: string;
  contextTag: string;
  createdAt: number;
  updatedAt: number;
  audioIds: string[];
}

export interface SubTask {
  id: string;
  text: string;
  done: boolean;
}

export interface Task {
  id: string;
  text: string;
  done: boolean;
  noteId: string | null;
  createdAt: number;
  dueAt: number | null;
  priority: 'high' | 'medium' | 'low';
  repeat?: 'daily' | 'weekly' | 'monthly';
  tags?: string[];
  subtasks?: SubTask[];
}

export interface AudioRecord {
  id: string;
  createdAt: number;
  durationSec: number;
  transcript: string;
  noteId: string | null;
  journalId: string | null;
  sizeBytes: number;
  r2Key?: string;       // R2 object key for audio blob (enables replay)
  mimeType?: string;    // e.g. audio/webm
  sessionId?: string;   // CF D1 audio session ID (enables word-level playback sync)
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  model: string;
  tokens: number;
}

export interface ChatSession {
  id: string;
  date: string;
  messages: ChatMessage[];
  noteContext: string | null;
}

export interface CalendarEvent {
  uid: string;
  summary: string;
  start: number;
  end: number;
  location: string;
  description: string;
  source: 'apple';
}

export interface AlarmItem {
  id: string;
  time: string; // 'HH:MM' 24-hr
  label: string;
  enabled: boolean;
}

export interface AppSettings {
  userName: string;
  workerUrl: string;
  themeOverride: 'auto' | 'light' | 'dark';
  alarms?: AlarmItem[];
  groqKey?: string;   // deprecated — kept for backward compat with saved data
  groqModel?: string; // deprecated — models are now hard-coded per function
}

export interface EncryptedBlob {
  v: number;
  s: string;
  i: string;
  d: string;
}

export interface GithubFile {
  sha: string;
  content: string;
}

export interface WeatherData {
  city: string;
  tempC: number;
  desc: string;
  humidity: number;
  windKph: number;
  icon: string;
}

export interface PaperResult {
  id: string;
  title: string;
  authors: string[];
  abstract: string;
  journal: string;
  year: number;
  doi: string;
  url: string;
  source: 'pubmed' | 'biorxiv' | 'medrxiv' | 'nature' | 'cell' | 'openalex' | 'europepmc';
  pdfUrl?: string;
  collectionIds?: string[];
}

export interface PaperCollection {
  id: string;
  label: string;
  color: 'ac' | 'gn' | 'rd' | 'yw' | 'pu' | 'enzo';
}

export interface SavedSearch {
  id: string;
  label: string;
  query: string;
  sources: string[];
  color: 'ac' | 'gn' | 'pu' | 'yw' | 'enzo' | 'rd';
  createdAt: number;
  lastRunAt: number | null;
  runCount: number;
}

export interface ReadingListItem {
  id: string;
  paper: PaperResult;
  addedAt: number;
  note: string;
  read: boolean;
  readAt?: number;
  priority: 'high' | 'medium' | 'low';
  readStatus?: 'unread' | 'in-progress' | 'done';
}

export interface PipelineStep {
  id: string;
  name: string;
  tool: string;
  version: string;
  params: string;      // free-text key:value lines
  status: 'pending' | 'running' | 'done' | 'failed' | 'skipped';
  notes: string;
  completedAt: number | null;
}

export interface QCMetric {
  key: string;
  value: string;
  flag: 'pass' | 'warn' | 'fail' | '';
}

export interface PipelineRun {
  id: string;
  title: string;
  sampleId: string;
  sampleDescription: string;
  organism: string;
  tissue: string;
  condition: string;
  pipelineType: 'scrna-seq' | 'spatial' | 'bulk-rna' | 'wes' | 'custom';
  protocolId: string | null;
  status: 'planned' | 'running' | 'qc-review' | 'completed' | 'failed' | 'archived';
  steps: PipelineStep[];
  qcMetrics: QCMetric[];
  noteId: string | null;
  journalIds: string[];
  audioIds: string[];
  paperDois: string[];
  tags: string[];
  notes: string;
  createdAt: number;
  updatedAt: number;
  completedAt: number | null;
}

export interface Protocol {
  id: string;
  title: string;
  type: 'scrna-seq' | 'spatial' | 'bulk-rna' | 'wes' | 'ifm' | 'flow' | 'ddpcr' | 'organoid' | 'custom';
  version: string;
  body: string;        // markdown
  tags: string[];
  source: string;      // DOI or URL
  isTemplate: boolean;
  createdAt: number;
  updatedAt: number;
}

// ── Phase 3: Job Arm ──────────────────────────────────────────────────────────

export type JobStatus = 'radar' | 'queued' | 'applied' | 'screening' | 'interviewing' | 'offer' | 'closed';
export type JobRegion = 'eu' | 'india' | 'uk' | 'remote' | 'us' | 'other';
export type JobType = 'industry' | 'academic' | 'fellowship' | 'startup' | 'contract';

export interface JobListing {
  id: string;
  title: string;
  company: string;
  location: string;
  region: JobRegion;
  type: JobType;
  description: string;
  url: string;
  source: string;
  postedAt: number | null;
  deadline: number | null;
  tags: string[];
  salary?: string;
}

export interface InterviewRecord {
  id: string;
  date: number;
  type: 'phone' | 'technical' | 'panel' | 'hr' | 'onsite' | 'other';
  notes: string;
  outcome: string;
}

export interface SavedJob {
  id: string;
  listing: JobListing;
  status: JobStatus;
  savedAt: number;
  appliedAt: number | null;
  notes: string;
  nextAction: string;
  nextActionAt: number | null;
  interviews: InterviewRecord[];
}

export interface ResearcherProfile {
  currentRole: string;
  institution: string;
  department: string;
  specializations: string[];
  targetRoles: string[];
  targetLocations: string[];
  cvHighlights: string[];
  publications: { title: string; doi: string; year: number }[];
  notes: string;
}

// ── CV Builder ────────────────────────────────────────────────────────────────

export interface CvExperience {
  id: string;
  role: string;
  organisation: string;
  location: string;
  startDate: string;   // 'YYYY-MM' or 'YYYY'
  endDate: string;     // '' = Present
  bullets: string[];
}

export interface CvEducation {
  id: string;
  degree: string;
  institution: string;
  location: string;
  year: string;
  gpa?: string;
  notes?: string;
}

export interface CvPublication {
  id: string;
  authors: string;
  title: string;
  journal: string;
  year: number;
  doi: string;
  highlight?: boolean;
}

export interface CvSkillGroup {
  id: string;
  category: string;
  skills: string[];
}

export interface CvConference {
  id: string;
  title: string;
  event: string;
  location: string;
  year: number;
  type: 'oral' | 'poster' | 'workshop' | 'invited';
}

export interface CvAward {
  id: string;
  title: string;
  issuer: string;
  year: number;
  description?: string;
}

export interface CvProfile {
  // Personal
  fullName: string;
  pronouns: string;
  email: string;
  phone: string;
  location: string;
  orcid: string;
  linkedin: string;
  website: string;
  summary: string;
  // Sections
  experience: CvExperience[];
  education: CvEducation[];
  publications: CvPublication[];
  skillGroups: CvSkillGroup[];
  conferences: CvConference[];
  awards: CvAward[];
  // Misc
  languages: string[];
  updatedAt: number;
}

export interface CoverLetter {
  id: string;
  jobId: string;            // SavedJob.id or '' for standalone
  company: string;
  role: string;
  content: string;          // markdown
  generatedAt: number;
  editedAt: number;
  note: string;
}

// ── Extended Job features ─────────────────────────────────────────────────────

export interface JobContact {
  id: string;
  name: string;
  role: string;
  company: string;
  email: string;
  linkedin: string;
  notes: string;
  metAt: string;
  lastContactAt: number | null;
}

export interface JobEmailTemplate {
  id: string;
  label: string;
  subject: string;
  body: string;
  category: 'cold-outreach' | 'follow-up' | 'thank-you' | 'networking' | 'referral' | 'custom';
  createdAt: number;
}

export interface SalaryEntry {
  id: string;
  company: string;
  role: string;
  region: string;
  salaryMin: number;
  salaryMax: number;
  currency: string;
  type: 'offer' | 'estimate' | 'glassdoor' | 'linkedin';
  notes: string;
  year: number;
}

export interface JobDeadline {
  id: string;
  jobId: string;
  label: string;
  dueAt: number;
  done: boolean;
}

// ── Presentations ─────────────────────────────────────────────────────────────

export interface Slide {
  id: string;
  content: string;   // HTML from RichEditor
  notes: string;     // speaker notes, plain text
}

export type PresTheme = 'white' | 'dark' | 'moon' | 'serif' | 'minimal';

export interface PresAiContext {
  brief: string;
  outline: string;
  concepts: string;
  slideTitles: string[];
  generatedAt: number;
}

export interface Presentation {
  id: string;
  title: string;
  slides: Slide[];
  theme: PresTheme;
  createdAt: number;
  updatedAt: number;
  aiContext?: PresAiContext;
}

// ── Files ─────────────────────────────────────────────────────────────────────

export interface FileRecord {
  id: string;
  name: string;
  mimeType: string;
  size: number;            // bytes (original)
  data?: string;           // base64 (legacy — pre-R2 uploads only)
  r2Key?: string;          // R2 object key (new uploads)
  url?: string;            // external link alternative
  tags: string[];
  folder?: string;
  linkedNoteIds: string[];
  linkedRunIds: string[];
  description: string;
  createdAt: number;
  updatedAt: number;
}

// ── Grants ────────────────────────────────────────────────────────────────────

export type GrantStatus = 'idea' | 'drafting' | 'submitted' | 'under-review' | 'awarded' | 'rejected' | 'withdrawn';

export interface Grant {
  id: string;
  title: string;
  agency: string;
  programme: string;
  amount: number;
  currency: string;
  deadline: number | null;
  submittedAt: number | null;
  status: GrantStatus;
  piName: string;
  collaborators: string[];
  description: string;
  notes: string;
  tags: string[];
  createdAt: number;
  updatedAt: number;
}

// ── Conference abstract tracker ───────────────────────────────────────────────

export type AbstractStatus = 'drafting' | 'submitted' | 'accepted-oral' | 'accepted-poster' | 'rejected' | 'withdrawn';

export interface ConferenceAbstract {
  id: string;
  conference: string;
  location: string;
  dates: string;
  abstractTitle: string;
  body: string;
  wordLimit: number;
  submissionDeadline: number | null;
  notificationDate: number | null;
  status: AbstractStatus;
  presentationId: string | null;
  notes: string;
  tags: string[];
  createdAt: number;
  updatedAt: number;
}

// ── Peer review log ───────────────────────────────────────────────────────────

export type PeerReviewStatus = 'invited' | 'accepted' | 'declined' | 'in-progress' | 'submitted' | 'done';

export interface PeerReview {
  id: string;
  journal: string;
  manuscriptTitle: string;
  editorName: string;
  invitedAt: number;
  dueAt: number | null;
  submittedAt: number | null;
  status: PeerReviewStatus;
  recommendation: string;
  notes: string;
  createdAt: number;
  updatedAt: number;
}

// ── Manuscript ────────────────────────────────────────────────────────────────

export type ManuscriptStatus = 'drafting' | 'internal-review' | 'submitted' | 'revisions' | 'accepted' | 'published';

export interface ManuscriptSection {
  id: string;
  type: 'abstract' | 'introduction' | 'methods' | 'results' | 'discussion' | 'conclusion' | 'supplementary' | 'custom';
  label: string;
  content: string;   // HTML from RichEditor
  wordTarget: number;
  notes: string;
}

export interface Manuscript {
  id: string;
  title: string;
  targetJournal: string;
  status: ManuscriptStatus;
  sections: ManuscriptSection[];
  authors: string[];
  keywords: string[];
  linkedNoteIds: string[];
  submittedAt: number | null;
  acceptedAt: number | null;
  publishedAt: number | null;
  doi: string;
  notes: string;
  createdAt: number;
  updatedAt: number;
  reviewerComments?: ReviewerComment[];
  creditAuthors?: CreditAuthor[];
}

// ── AI feature toggles ────────────────────────────────────────────────────────

export interface AiFeatureSettings {
  coverLetter:    boolean;  // default false
  writerBullets:  boolean;  // default false
  weeklyDigest:   boolean;  // default false
  deepRead:       boolean;  // default false
  readingNote:    boolean;  // default false
  critique?:      boolean;  // paper critique
  devilsAdvocate?: boolean; // hypothesis devil's advocate
  interviewPrep?: boolean;  // interview prep
  manuscriptEnzo?: boolean; // manuscript Enzo assist
}

// ── Hypothesis tracker ────────────────────────────────────────────────────────

export interface Hypothesis {
  id: string;
  text: string;
  rationale: string;
  status: 'active' | 'supported' | 'refuted' | 'inconclusive';
  result: string;
  linkedNotes: string[];
  linkedRunIds?: string[];
  createdAt: number;
  updatedAt: number;
}

// ── Settings extension ────────────────────────────────────────────────────────

export interface AppSettings {
  userName: string;
  workerUrl: string;
  themeOverride: 'auto' | 'light' | 'dark';
  accentColor?: 'blue' | 'green' | 'purple' | 'teal' | 'rose';
  fontSize?: 'compact' | 'normal' | 'large';
  institution?: string;
  department?: string;
  orcid?: string;
  supervisorEmail?: string;
  emailSubjectPrefix?: string;
  alarms?: AlarmItem[];
  groqKey?: string;
  groqModel?: string;
  ai?: AiFeatureSettings;
  weeklyReadingGoal?: number;
  customTemplates?: { label: string; body: string }[];
}

// ── FileRecord extension ──────────────────────────────────────────────────────

// (FileRecord is defined earlier; r2Key added here for reference — actual
//  field lives on the interface above in the file)

// ── Mail (D1-backed, worker-proxied) ─────────────────────────────────────────

export interface MailContact {
  id: string;
  name: string;
  email: string;
  role: 'supervisor' | 'collaborator' | 'pi' | 'lab-manager' | 'other';
  createdAt: number;
}

export interface MailSent {
  id: string;
  toEmail: string;
  toName: string;
  subject: string;
  body: string;
  sentAt: number;
}

export interface MailDraft {
  id: string;
  toEmail: string;
  toName: string;
  subject: string;
  body: string;
  updatedAt: number;
}

export interface MailComposeDraft {
  to: string;
  toName: string;
  subject: string;
  body: string;
}

// ── Reviewer Response ──────────────────────────────────────────────────────────
export interface ReviewerComment {
  id: string;
  reviewer: number;   // reviewer number (1, 2, 3...)
  number: number;     // comment number within that reviewer
  text: string;       // original reviewer comment
  response: string;   // author's response
  addressed: boolean;
}

// ── CRediT authorship ──────────────────────────────────────────────────────────
export type CreditRoleId =
  'conceptualization' | 'data-curation' | 'formal-analysis' |
  'funding-acquisition' | 'investigation' | 'methodology' |
  'project-administration' | 'resources' | 'software' |
  'supervision' | 'validation' | 'visualization' |
  'writing-original' | 'writing-review';

export interface CreditAuthor {
  name: string;
  orcid: string;
  corresponding: boolean;
  roles: CreditRoleId[];
}

// ── Literature Radar ───────────────────────────────────────────────────────────
export interface RadarPaper {
  pmid: string;
  title: string;
  authors: string;
  journal: string;
  year: number;
  abstract: string;
  doi: string;
  added: boolean;   // true once added to research corpus
}

export interface RadarScan {
  scannedAt: number;
  terms: string[];
  papers: RadarPaper[];
  summary: string;   // Enzo's digest
}

// ── Review Article ─────────────────────────────────────────────────────────────

export type ReviewArticleStatus = 'planning' | 'outline' | 'drafting' | 'polishing' | 'submitted';
export type ReviewThemeStatus = 'outline' | 'draft' | 'polished';

export interface ReviewPaper {
  id: string;
  pmid?: string;
  title: string;
  authors: string;
  journal: string;
  year: number;
  abstract: string;
  doi: string;
  url: string;
  themeIds: string[];
  rating: 1 | 2 | 3;
  notes: string;
}

export interface ReviewTheme {
  id: string;
  title: string;
  outline: string;
  content: string;
  wordTarget: number;
  status: ReviewThemeStatus;
  order: number;
  paperIds: string[];
}

export interface ReviewArticle {
  id: string;
  title: string;
  targetJournal: string;
  scope: string;
  status: ReviewArticleStatus;
  wordTarget: number;
  corpus: ReviewPaper[];
  themes: ReviewTheme[];
  createdAt: number;
  updatedAt: number;
}
