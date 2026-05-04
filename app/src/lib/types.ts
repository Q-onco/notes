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

export interface Task {
  id: string;
  text: string;
  done: boolean;
  noteId: string | null;
  createdAt: number;
  dueAt: number | null;
  priority: 'high' | 'medium' | 'low';
}

export interface AudioRecord {
  id: string;
  createdAt: number;
  durationSec: number;
  transcript: string;
  noteId: string | null;
  journalId: string | null;
  sizeBytes: number;
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
  priority: 'high' | 'medium' | 'low';
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

// ── Settings extension ────────────────────────────────────────────────────────

export interface AppSettings {
  userName: string;
  workerUrl: string;
  themeOverride: 'auto' | 'light' | 'dark';
  accentColor?: 'blue' | 'green' | 'purple' | 'teal' | 'rose';
  institution?: string;
  department?: string;
  orcid?: string;
  alarms?: AlarmItem[];
  groqKey?: string;
  groqModel?: string;
}
