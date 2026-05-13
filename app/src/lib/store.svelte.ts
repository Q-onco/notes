import type {
  Note, JournalEntry, Task, AudioRecord,
  ChatSession, CalendarEvent, AppSettings, AiFeatureSettings, PaperResult,
  ReadingListItem, SavedSearch, SearchHistoryEntry, PipelineRun, Protocol,
  SavedJob, ResearcherProfile, Hypothesis,
  CvProfile, CoverLetter, JobContact, JobEmailTemplate, SalaryEntry, JobDeadline,
  Presentation, FileRecord, FileVersion,
  Grant, ConferenceAbstract, PeerReview, Manuscript,
  MailContact, MailSent, MailDraft, MailComposeDraft,
  ReviewArticle, PaperCollection, LaunchpadCustomResource,
  BiblioReference, BiblioCollection
} from './types';
import { loadEncFile, saveEncFile, PATHS, validateToken } from './github';
import { WORKER_URL } from './groq';
import { idbGet, idbSet, idbNuke } from './idb';

type View = 'dashboard' | 'notes' | 'journal' | 'tasks' | 'calendar' | 'research' | 'audio' | 'settings' | 'enzo' | 'pipeline' | 'jobs' | 'presentations' | 'files' | 'grants' | 'manuscript' | 'review' | 'mail' | 'launchpad' | 'biblio';

const DEFAULT_PROFILE: ResearcherProfile = {
  currentRole: 'Postdoctoral Researcher',
  institution: 'Heidelberg University',
  department: 'Dept. of Experimental and Translational Gynaecological Oncology',
  specializations: ['ovarian cancer', 'HGSOC', 'scRNA-seq', 'spatial transcriptomics', 'PARP inhibitors', 'tumour microenvironment', 'bioinformatics'],
  targetRoles: ['Senior Scientist', 'Translational Scientist', 'R&D Scientist', 'Principal Scientist'],
  targetLocations: ['Germany', 'UK', 'Switzerland', 'India', 'Remote'],
  cvHighlights: [],
  publications: [],
  notes: '',
};

class Store {
  // Auth
  tok = $state<string | null>(null);
  userLogin = $state('');

  // Data
  notes = $state<Note[]>([]);
  notesSha = $state<string | null>(null);

  journal = $state<JournalEntry[]>([]);
  journalSha = $state<string | null>(null);

  tasks = $state<Task[]>([]);
  tasksSha = $state<string | null>(null);

  chatSessions = $state<ChatSession[]>([]);
  chatSha = $state<string | null>(null);

  audioRecords = $state<AudioRecord[]>([]);
  audioSha = $state<string | null>(null);

  pinnedPapers = $state<PaperResult[]>([]);
  pinnedPapersSha = $state<string | null>(null);

  readingList = $state<ReadingListItem[]>([]);
  savedSearches = $state<SavedSearch[]>([]);
  paperCollections = $state<PaperCollection[]>([]);
  searchHistory = $state<SearchHistoryEntry[]>([]);
  researchSha = $state<string | null>(null);

  pipelineRuns = $state<PipelineRun[]>([]);
  protocols = $state<Protocol[]>([]);
  hypotheses = $state<Hypothesis[]>([]);
  pipelinesSha = $state<string | null>(null);

  calEvents = $state<CalendarEvent[]>([]);

  savedJobs = $state<SavedJob[]>([]);
  jobsSha = $state<string | null>(null);

  jobContacts = $state<JobContact[]>([]);
  emailTemplates = $state<JobEmailTemplate[]>([]);
  salaryEntries = $state<SalaryEntry[]>([]);
  jobDeadlines = $state<JobDeadline[]>([]);
  jobExtSha = $state<string | null>(null);

  cvProfile = $state<CvProfile>({
    fullName: 'Dr. Amritha Sathyanarayanan',
    pronouns: 'she/her',
    email: 'quant.onco@gmail.com',
    phone: '',
    location: 'Heidelberg, Germany',
    orcid: '0000-0003-3477-3768',
    linkedin: '',
    website: '',
    summary: 'Postdoctoral researcher specialising in ovarian cancer tumour microenvironment, single-cell RNA-seq, spatial transcriptomics, and PARP inhibitor resistance mechanisms at Heidelberg University.',
    experience: [],
    education: [],
    publications: [],
    skillGroups: [],
    conferences: [],
    awards: [],
    languages: ['English', 'Tamil', 'German (basic)'],
    updatedAt: Date.now(),
  });
  cvSha = $state<string | null>(null);

  coverLetters = $state<CoverLetter[]>([]);
  coverLettersSha = $state<string | null>(null);

  presentations = $state<Presentation[]>([]);
  presentationsSha = $state<string | null>(null);

  files = $state<FileRecord[]>([]);
  filesSha = $state<string | null>(null);

  grants = $state<Grant[]>([]);
  grantsSha = $state<string | null>(null);

  conferences = $state<ConferenceAbstract[]>([]);
  conferencesSha = $state<string | null>(null);

  peerReviews = $state<PeerReview[]>([]);
  peerReviewsSha = $state<string | null>(null);

  manuscripts = $state<Manuscript[]>([]);
  manuscriptsSha = $state<string | null>(null);

  reviewArticles = $state<ReviewArticle[]>([]);
  reviewArticlesSha = $state<string | null>(null);

  launchpadBookmarks = $state<string[]>([]);
  launchpadCustom = $state<LaunchpadCustomResource[]>([]);
  launchpadSha = $state<string | null>(null);

  biblioRefs = $state<BiblioReference[]>([]);
  biblioCollections = $state<BiblioCollection[]>([]);
  biblioSha = $state<string | null>(null);

  profile = $state<ResearcherProfile>({ ...DEFAULT_PROFILE });
  profileSha = $state<string | null>(null);

  // Mail (D1-backed via worker)
  mailContacts = $state<MailContact[]>([]);
  mailSent = $state<MailSent[]>([]);
  mailDrafts = $state<MailDraft[]>([]);
  mailLoaded = $state(false);

  // Global compose sheet
  mailComposeOpen = $state(false);
  mailComposeDraft = $state<MailComposeDraft>({ to: '', toName: '', subject: '', body: '' });

  // Cross-section navigation state
  selectedJournalId = $state<string | null>(null);
  selectedAudioId = $state<string | null>(null);

  settings = $state<AppSettings>({
    userName: 'Amritha',
    workerUrl: 'https://enzo.quant-onco.workers.dev',
    themeOverride: 'auto',
  });
  settingsSha = $state<string | null>(null);

  // UI
  view = $state<View>('dashboard');
  currentNoteId = $state<string | null>(null);
  openTabs = $state<string[]>([]);
  sidebarOpen = $state(true);
  enzoOpen = $state(true);
  loading = $state(false);
  loadingMsg = $state('Loading...');
  error = $state<string | null>(null);
  enzoSearchQuery = $state('');
  aiPending = $state(0);

  // Derived
  get authenticated(): boolean { return this.tok !== null; }

  get aiSettings(): AiFeatureSettings {
    return {
      coverLetter:   false,
      writerBullets: false,
      weeklyDigest:  false,
      deepRead:      false,
      readingNote:   false,
      ...this.settings.ai,
    };
  }
  get currentNote(): Note | null {
    return this.notes.find(n => n.id === this.currentNoteId) ?? null;
  }
  get activeTasks(): Task[] {
    return this.tasks.filter(t => !t.done).sort((a, b) => {
      const p = { high: 0, medium: 1, low: 2 };
      return p[a.priority] - p[b.priority];
    });
  }
  get pinnedNotes(): Note[] {
    return this.notes.filter(n => n.pinned && !n.archived);
  }
  get recentNotes(): Note[] {
    return [...this.notes]
      .filter(n => !n.archived)
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, 10);
  }

  async login(token: string): Promise<void> {
    this.loading = true;
    this.loadingMsg = 'Validating token...';
    try {
      sessionStorage.setItem('_qt', token);
      const { login } = await validateToken(token);
      this.tok = token;
      this.userLogin = login;
      await this.loadAll();
    } catch (e) {
      sessionStorage.removeItem('_qt');
      throw e;
    } finally {
      this.loading = false;
    }
  }

  async logout(): Promise<void> {
    // ── 1. Zero every in-memory data field ───────────────────────────────
    this.tok = null;
    this.userLogin = '';
    this.notes = []; this.notesSha = null;
    this.journal = []; this.journalSha = null;
    this.tasks = []; this.tasksSha = null;
    this.chatSessions = []; this.chatSha = null;
    this.audioRecords = []; this.audioSha = null;
    this.pinnedPapers = []; this.pinnedPapersSha = null;
    this.readingList = []; this.savedSearches = []; this.paperCollections = [];
    this.searchHistory = []; this.researchSha = null;
    this.pipelineRuns = []; this.protocols = []; this.hypotheses = [];
    this.pipelinesSha = null;
    this.calEvents = [];
    this.savedJobs = []; this.jobsSha = null;
    this.jobContacts = []; this.emailTemplates = []; this.salaryEntries = [];
    this.jobDeadlines = []; this.jobExtSha = null;
    this.coverLetters = []; this.coverLettersSha = null;
    this.presentations = []; this.presentationsSha = null;
    this.files = []; this.filesSha = null;
    this.grants = []; this.grantsSha = null;
    this.conferences = []; this.conferencesSha = null;
    this.peerReviews = []; this.peerReviewsSha = null;
    this.manuscripts = []; this.manuscriptsSha = null;
    this.reviewArticles = []; this.reviewArticlesSha = null;
    this.launchpadBookmarks = []; this.launchpadCustom = []; this.launchpadSha = null;
    this.biblioRefs = []; this.biblioCollections = []; this.biblioSha = null;
    this.profile = { ...DEFAULT_PROFILE }; this.profileSha = null;
    this.mailContacts = []; this.mailSent = []; this.mailDrafts = []; this.mailLoaded = false;

    // ── 2. Clear all Web Storage (origin-scoped — safe to nuke entirely) ─
    try { sessionStorage.clear(); } catch { /* ignore */ }
    try { localStorage.clear(); } catch { /* ignore */ }
    // Restore logout flag so Login won't auto-fill the trusted-device token
    try { localStorage.setItem('_lo', '1'); } catch { /* ignore */ }

    // ── 3. Delete IndexedDB cache database ──────────────────────────────
    await idbNuke();

    // ── 4. Delete all Cache API entries ─────────────────────────────────
    try {
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map(k => caches.delete(k)));
      }
    } catch { /* ignore */ }

    // ── 5. Unregister service workers ───────────────────────────────────
    try {
      if (navigator.serviceWorker) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map(r => r.unregister()));
      }
    } catch { /* ignore */ }

    // ── 6. Hard reload — clears JS heap, component state, and HTTP cache ─
    window.location.reload();
  }

  async loadAll(): Promise<void> {
    if (!this.tok) return;
    this.loadingMsg = 'Decrypting your research...';
    // F2: show previously cached files immediately while GitHub fetches run
    if (this.filesSha) {
      const cached = await idbGet<FileRecord[]>(`files:${this.filesSha}`);
      if (cached) this.files = cached;
    }

    const [n, j, t, c, a, pp, s, res, pip, jb, jbx, cv, cl, prf, pres, fi, gr, conf, pr, ms, rv, lp, bl] = await Promise.all([
      loadEncFile<Note[]>(this.tok, PATHS.notes, []),
      loadEncFile<JournalEntry[]>(this.tok, PATHS.journal, []),
      loadEncFile<Task[]>(this.tok, PATHS.tasks, []),
      loadEncFile<ChatSession[]>(this.tok, PATHS.chat, []),
      loadEncFile<AudioRecord[]>(this.tok, PATHS.audio, []),
      loadEncFile<PaperResult[]>(this.tok, PATHS.pinned, []),
      loadEncFile<AppSettings>(this.tok, PATHS.settings, this.settings),
      loadEncFile<{readingList: ReadingListItem[], savedSearches: SavedSearch[], paperCollections?: PaperCollection[], searchHistory?: SearchHistoryEntry[]}>(this.tok, PATHS.research, { readingList: [], savedSearches: [], paperCollections: [], searchHistory: [] }),
      loadEncFile<{runs: PipelineRun[], protocols: Protocol[], hypotheses: Hypothesis[]}>(this.tok, PATHS.pipelines, { runs: [], protocols: [], hypotheses: [] }),
      loadEncFile<SavedJob[]>(this.tok, PATHS.jobs, []),
      loadEncFile<{contacts: JobContact[], templates: JobEmailTemplate[], salaries: SalaryEntry[], deadlines: JobDeadline[]}>(this.tok, PATHS.jobExt, { contacts: [], templates: [], salaries: [], deadlines: [] }),
      loadEncFile<CvProfile>(this.tok, PATHS.cv, this.cvProfile),
      loadEncFile<CoverLetter[]>(this.tok, PATHS.coverLetters, []),
      loadEncFile<ResearcherProfile>(this.tok, PATHS.profile, DEFAULT_PROFILE),
      loadEncFile<Presentation[]>(this.tok, PATHS.presentations, []),
      loadEncFile<FileRecord[]>(this.tok, PATHS.files, []),
      loadEncFile<Grant[]>(this.tok, PATHS.grants, []),
      loadEncFile<ConferenceAbstract[]>(this.tok, PATHS.conferences, []),
      loadEncFile<PeerReview[]>(this.tok, PATHS.peerReviews, []),
      loadEncFile<Manuscript[]>(this.tok, PATHS.manuscripts, []),
      loadEncFile<ReviewArticle[]>(this.tok, PATHS.reviews, []),
      loadEncFile<{bookmarks?: string[], custom?: LaunchpadCustomResource[]}>(this.tok, PATHS.launchpad, { bookmarks: [], custom: [] }),
      loadEncFile<{refs?: BiblioReference[], collections?: BiblioCollection[]}>(this.tok, PATHS.biblio, { refs: [], collections: [] }),
    ]);

    this.notes = n.data; this.notesSha = n.sha;
    this.journal = j.data; this.journalSha = j.sha;
    this.tasks = t.data; this.tasksSha = t.sha;
    this.chatSessions = c.data; this.chatSha = c.sha;
    this.audioRecords = a.data; this.audioSha = a.sha;
    this.pinnedPapers = pp.data; this.pinnedPapersSha = pp.sha;
    const loaded = s.data as Partial<AppSettings>;
    this.settings = {
      ...this.settings,
      ...loaded,
      workerUrl: loaded.workerUrl || this.settings.workerUrl,
    };
    this.settingsSha = s.sha;
    this.readingList = res.data.readingList ?? [];
    this.savedSearches = res.data.savedSearches ?? [];
    this.paperCollections = res.data.paperCollections ?? [];
    this.searchHistory = res.data.searchHistory ?? [];
    this.researchSha = res.sha;
    this.pipelineRuns = pip.data.runs ?? [];
    this.protocols = pip.data.protocols ?? [];
    this.hypotheses = pip.data.hypotheses ?? [];
    this.pipelinesSha = pip.sha;
    this.savedJobs = jb.data; this.jobsSha = jb.sha;
    this.jobContacts = jbx.data.contacts ?? [];
    this.emailTemplates = jbx.data.templates ?? [];
    this.salaryEntries = jbx.data.salaries ?? [];
    this.jobDeadlines = jbx.data.deadlines ?? [];
    this.jobExtSha = jbx.sha;
    this.cvProfile = { ...this.cvProfile, ...cv.data }; this.cvSha = cv.sha;
    this.coverLetters = cl.data; this.coverLettersSha = cl.sha;
    this.profile = { ...DEFAULT_PROFILE, ...prf.data }; this.profileSha = prf.sha;
    this.presentations = pres.data; this.presentationsSha = pres.sha;
    // F1: strip legacy base64 blobs — r2Key is source of truth
    this.files = (fi.data as FileRecord[]).map(f =>
      f.r2Key ? (({ data: _, ...rest }) => rest as FileRecord)(f) : f
    );
    this.filesSha = fi.sha;
    // F2: persist to IDB for instant display on next session
    if (fi.sha) idbSet(`files:${fi.sha}`, this.files).catch(() => {});
    this.grants = gr.data; this.grantsSha = gr.sha;
    this.conferences = conf.data; this.conferencesSha = conf.sha;
    this.peerReviews = pr.data; this.peerReviewsSha = pr.sha;
    this.manuscripts = ms.data; this.manuscriptsSha = ms.sha;
    this.reviewArticles = rv.data; this.reviewArticlesSha = rv.sha;
    this.launchpadBookmarks = lp.data?.bookmarks ?? [];
    this.launchpadCustom = lp.data?.custom ?? [];
    this.launchpadSha = lp.sha;
    this.biblioRefs = bl.data?.refs ?? [];
    this.biblioCollections = bl.data?.collections ?? [];
    this.biblioSha = bl.sha;
  }

  async saveResearch(): Promise<void> {
    if (!this.tok) return;
    const sha = await saveEncFile(
      this.tok, PATHS.research,
      { readingList: this.readingList, savedSearches: this.savedSearches, paperCollections: this.paperCollections, searchHistory: this.searchHistory },
      this.researchSha,
      'research: update'
    );
    this.researchSha = sha;
  }

  async saveLaunchpad(): Promise<void> {
    if (!this.tok) return;
    const sha = await saveEncFile(
      this.tok, PATHS.launchpad,
      { bookmarks: this.launchpadBookmarks, custom: this.launchpadCustom },
      this.launchpadSha,
      'launchpad: update'
    );
    this.launchpadSha = sha;
  }

  async saveBiblio(): Promise<void> {
    if (!this.tok) return;
    const sha = await saveEncFile(
      this.tok, PATHS.biblio,
      { refs: this.biblioRefs, collections: this.biblioCollections },
      this.biblioSha,
      'biblio: update'
    );
    this.biblioSha = sha;
  }

  async savePipelines(): Promise<void> {
    if (!this.tok) return;
    const sha = await saveEncFile(
      this.tok, PATHS.pipelines,
      { runs: this.pipelineRuns, protocols: this.protocols, hypotheses: this.hypotheses },
      this.pipelinesSha,
      'pipelines: update'
    );
    this.pipelinesSha = sha;
  }

  async saveNotes(): Promise<void> {
    if (!this.tok) return;
    const sha = await saveEncFile(this.tok, PATHS.notes, this.notes, this.notesSha, 'notes: update');
    this.notesSha = sha;
  }

  async saveJournal(): Promise<void> {
    if (!this.tok) return;
    const sha = await saveEncFile(this.tok, PATHS.journal, this.journal, this.journalSha, 'journal: update');
    this.journalSha = sha;
  }

  async saveTasks(): Promise<void> {
    if (!this.tok) return;
    const sha = await saveEncFile(this.tok, PATHS.tasks, this.tasks, this.tasksSha, 'tasks: update');
    this.tasksSha = sha;
  }

  async saveChat(): Promise<void> {
    if (!this.tok) return;
    const sha = await saveEncFile(this.tok, PATHS.chat, this.chatSessions, this.chatSha, 'enzo: chat update');
    this.chatSha = sha;
  }

  async saveAudio(): Promise<void> {
    if (!this.tok) return;
    const sha = await saveEncFile(this.tok, PATHS.audio, this.audioRecords, this.audioSha, 'audio: update');
    this.audioSha = sha;
  }

  async savePinnedPapers(): Promise<void> {
    if (!this.tok) return;
    const sha = await saveEncFile(this.tok, PATHS.pinned, this.pinnedPapers, this.pinnedPapersSha, 'research: pinned update');
    this.pinnedPapersSha = sha;
  }

  async saveJobs(): Promise<void> {
    if (!this.tok) return;
    const sha = await saveEncFile(this.tok, PATHS.jobs, this.savedJobs, this.jobsSha, 'jobs: update');
    this.jobsSha = sha;
  }

  async saveJobExt(): Promise<void> {
    if (!this.tok) return;
    const sha = await saveEncFile(this.tok, PATHS.jobExt, {
      contacts: this.jobContacts,
      templates: this.emailTemplates,
      salaries: this.salaryEntries,
      deadlines: this.jobDeadlines,
    }, this.jobExtSha, 'jobs: extended data update');
    this.jobExtSha = sha;
  }

  async saveCv(): Promise<void> {
    if (!this.tok) return;
    this.cvProfile.updatedAt = Date.now();
    const sha = await saveEncFile(this.tok, PATHS.cv, this.cvProfile, this.cvSha, 'cv: update');
    this.cvSha = sha;
  }

  async saveCoverLetters(): Promise<void> {
    if (!this.tok) return;
    const sha = await saveEncFile(this.tok, PATHS.coverLetters, this.coverLetters, this.coverLettersSha, 'cv: cover letter update');
    this.coverLettersSha = sha;
  }

  async saveProfile(): Promise<void> {
    if (!this.tok) return;
    const sha = await saveEncFile(this.tok, PATHS.profile, this.profile, this.profileSha, 'profile: update');
    this.profileSha = sha;
  }

  async savePresentations(): Promise<void> {
    if (!this.tok) return;
    const sha = await saveEncFile(this.tok, PATHS.presentations, this.presentations, this.presentationsSha, 'presentations: update');
    this.presentationsSha = sha;
  }

  async saveFiles(): Promise<void> {
    if (!this.tok) return;
    const sha = await saveEncFile(this.tok, PATHS.files, this.files, this.filesSha, 'files: update');
    this.filesSha = sha;
  }

  async saveGrants(): Promise<void> {
    if (!this.tok) return;
    const sha = await saveEncFile(this.tok, PATHS.grants, this.grants, this.grantsSha, 'grants: update');
    this.grantsSha = sha;
  }

  async saveConferences(): Promise<void> {
    if (!this.tok) return;
    const sha = await saveEncFile(this.tok, PATHS.conferences, this.conferences, this.conferencesSha, 'conferences: update');
    this.conferencesSha = sha;
  }

  async savePeerReviews(): Promise<void> {
    if (!this.tok) return;
    const sha = await saveEncFile(this.tok, PATHS.peerReviews, this.peerReviews, this.peerReviewsSha, 'peer-reviews: update');
    this.peerReviewsSha = sha;
  }

  async saveManuscripts(): Promise<void> {
    if (!this.tok) return;
    const sha = await saveEncFile(this.tok, PATHS.manuscripts, this.manuscripts, this.manuscriptsSha, 'manuscripts: update');
    this.manuscriptsSha = sha;
  }

  async saveReviewArticles(): Promise<void> {
    if (!this.tok) return;
    const sha = await saveEncFile(this.tok, PATHS.reviews, this.reviewArticles, this.reviewArticlesSha, 'reviews: update');
    this.reviewArticlesSha = sha;
  }

  isPinned(id: string): boolean {
    return this.pinnedPapers.some(p => p.id === id);
  }

  async pinPaper(paper: PaperResult): Promise<void> {
    if (this.isPinned(paper.id)) return;
    this.pinnedPapers = [paper, ...this.pinnedPapers];
    await this.savePinnedPapers();
  }

  async unpinPaper(id: string): Promise<void> {
    this.pinnedPapers = this.pinnedPapers.filter(p => p.id !== id);
    await this.savePinnedPapers();
  }

  async saveSettings(): Promise<void> {
    if (!this.tok) return;
    const sha = await saveEncFile(this.tok, PATHS.settings, this.settings, this.settingsSha, 'settings: update');
    this.settingsSha = sha;
  }

  // ── Mail (D1 via worker) ────────────────────────────────────────────────────

  get workerBase(): string { return this.settings.workerUrl || WORKER_URL; }

  async loadMail(): Promise<void> {
    if (this.mailLoaded) return;
    try {
      const [c, s, d] = await Promise.all([
        fetch(`${this.workerBase}/mail/contacts`).then(r => r.ok ? r.json() : []),
        fetch(`${this.workerBase}/mail/sent?limit=100`).then(r => r.ok ? r.json() : []),
        fetch(`${this.workerBase}/mail/drafts`).then(r => r.ok ? r.json() : []),
      ]);
      this.mailContacts = c as MailContact[];
      this.mailSent = s as MailSent[];
      this.mailDrafts = d as MailDraft[];
      this.mailLoaded = true;
    } catch { /* worker not yet configured */ }
  }

  async saveMailContact(contact: MailContact): Promise<void> {
    await fetch(`${this.workerBase}/mail/contact`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(contact) });
    const idx = this.mailContacts.findIndex(c => c.id === contact.id);
    if (idx >= 0) this.mailContacts[idx] = contact; else this.mailContacts = [contact, ...this.mailContacts];
  }

  async deleteMailContact(id: string): Promise<void> {
    await fetch(`${this.workerBase}/mail/contact/${id}`, { method: 'DELETE' });
    this.mailContacts = this.mailContacts.filter(c => c.id !== id);
  }

  async sendMail(to: string, toName: string, subject: string, body: string): Promise<void> {
    const prefix = this.settings.emailSubjectPrefix ? `${this.settings.emailSubjectPrefix} ` : '';
    const res = await fetch(`${this.workerBase}/send-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to, toName, subject: `${prefix}${subject}`, html: body.replace(/\n/g, '<br>'), text: body }),
    });
    if (!res.ok) throw new Error(`Send failed: ${res.status}`);
    const sent: MailSent = { id: crypto.randomUUID(), toEmail: to, toName, subject: `${prefix}${subject}`, body, sentAt: Date.now() };
    await fetch(`${this.workerBase}/mail/sent`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(sent) });
    this.mailSent = [sent, ...this.mailSent];
  }

  async saveDraft(draft: MailDraft): Promise<void> {
    await fetch(`${this.workerBase}/mail/draft`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(draft) });
    const idx = this.mailDrafts.findIndex(d => d.id === draft.id);
    if (idx >= 0) this.mailDrafts[idx] = draft; else this.mailDrafts = [draft, ...this.mailDrafts];
  }

  async deleteDraft(id: string): Promise<void> {
    await fetch(`${this.workerBase}/mail/draft/${id}`, { method: 'DELETE' });
    this.mailDrafts = this.mailDrafts.filter(d => d.id !== id);
  }

  openCompose(opts: Partial<MailComposeDraft> = {}): void {
    this.mailComposeDraft = {
      to: opts.to ?? this.settings.supervisorEmail ?? '',
      toName: opts.toName ?? '',
      subject: opts.subject ?? '',
      body: opts.body ?? '',
    };
    this.mailComposeOpen = true;
  }

  applyFontSize(): void {
    const size = this.settings.fontSize;
    document.documentElement.style.fontSize =
      size === 'compact' ? '13px' : size === 'large' ? '17px' : '15px';
  }
}

export const store = new Store();
