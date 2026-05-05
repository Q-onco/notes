import type {
  Note, JournalEntry, Task, AudioRecord,
  ChatSession, CalendarEvent, AppSettings, AiFeatureSettings, PaperResult,
  ReadingListItem, SavedSearch, PipelineRun, Protocol,
  SavedJob, ResearcherProfile, Hypothesis,
  CvProfile, CoverLetter, JobContact, JobEmailTemplate, SalaryEntry, JobDeadline,
  Presentation, FileRecord,
  Grant, ConferenceAbstract, PeerReview, Manuscript
} from './types';
import { loadEncFile, saveEncFile, PATHS, validateToken } from './github';

type View = 'dashboard' | 'notes' | 'journal' | 'tasks' | 'calendar' | 'research' | 'audio' | 'settings' | 'enzo' | 'pipeline' | 'jobs' | 'presentations' | 'files' | 'grants' | 'manuscript';

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

  profile = $state<ResearcherProfile>({ ...DEFAULT_PROFILE });
  profileSha = $state<string | null>(null);

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

  logout(): void {
    this.tok = null;
    sessionStorage.removeItem('_qt');
    localStorage.removeItem('qonco_device');
    localStorage.setItem('_lo', '1');
    this.notes = [];
    this.journal = [];
    this.tasks = [];
    this.chatSessions = [];
    this.audioRecords = [];
    this.calEvents = [];
    this.pinnedPapers = [];
    this.savedJobs = [];
    this.profile = { ...DEFAULT_PROFILE };
  }

  async loadAll(): Promise<void> {
    if (!this.tok) return;
    this.loadingMsg = 'Decrypting your research...';

    const [n, j, t, c, a, pp, s, res, pip, jb, jbx, cv, cl, prf, pres, fi, gr, conf, pr, ms] = await Promise.all([
      loadEncFile<Note[]>(this.tok, PATHS.notes, []),
      loadEncFile<JournalEntry[]>(this.tok, PATHS.journal, []),
      loadEncFile<Task[]>(this.tok, PATHS.tasks, []),
      loadEncFile<ChatSession[]>(this.tok, PATHS.chat, []),
      loadEncFile<AudioRecord[]>(this.tok, PATHS.audio, []),
      loadEncFile<PaperResult[]>(this.tok, PATHS.pinned, []),
      loadEncFile<AppSettings>(this.tok, PATHS.settings, this.settings),
      loadEncFile<{readingList: ReadingListItem[], savedSearches: SavedSearch[]}>(this.tok, PATHS.research, { readingList: [], savedSearches: [] }),
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
    this.files = fi.data; this.filesSha = fi.sha;
    this.grants = gr.data; this.grantsSha = gr.sha;
    this.conferences = conf.data; this.conferencesSha = conf.sha;
    this.peerReviews = pr.data; this.peerReviewsSha = pr.sha;
    this.manuscripts = ms.data; this.manuscriptsSha = ms.sha;
  }

  async saveResearch(): Promise<void> {
    if (!this.tok) return;
    const sha = await saveEncFile(
      this.tok, PATHS.research,
      { readingList: this.readingList, savedSearches: this.savedSearches },
      this.researchSha,
      'research: update'
    );
    this.researchSha = sha;
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
}

export const store = new Store();
