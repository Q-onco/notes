<script lang="ts">
  import { store } from '../lib/store.svelte';
  import { generateCoverLetter, improveExpBullets, generateInterviewQuestions } from '../lib/groq';
  import { exportCvHtml, exportCvPdf, exportCoverLetterDocx, exportCoverLetterPdf } from '../lib/export';
  import { nanoid } from 'nanoid';
  import RichEditor from './RichEditor.svelte';
  import type {
    SavedJob, JobListing, JobStatus, JobRegion, JobType,
    InterviewRecord, CvExperience, CvEducation, CvPublication,
    CvSkillGroup, CvConference, CvAward, CoverLetter,
    JobContact, JobEmailTemplate, SalaryEntry, JobDeadline
  } from '../lib/types';
  import { fetchJobFeed, PIPELINE_STAGES, REGION_LABELS, TYPE_LABELS, EU_COMPANIES, INDIA_COMPANIES } from '../lib/jobs';

  let { showToast }: { showToast: (msg: string, type?: 'success' | 'error') => void } = $props();

  // ── Master toggle (session-persistent) ───────────────────────────────────────
  const SESSION_KEY = 'qonco_jobs_on';
  let enabled = $state(sessionStorage.getItem(SESSION_KEY) === '1');

  function enable() {
    enabled = true;
    sessionStorage.setItem(SESSION_KEY, '1');
    fetchFeed();
  }

  // ── Tab state ─────────────────────────────────────────────────────────────────
  let tab = $state<'feed' | 'tracker' | 'companies' | 'cv' | 'coverletter' | 'contacts' | 'salary' | 'analytics'>('feed');

  // ── Feed state ────────────────────────────────────────────────────────────────
  let feedJobs = $state<JobListing[]>([]);
  let feedLoading = $state(false);
  let feedError = $state('');
  let feedSearch = $state('');
  let regionFilter = $state<'all' | JobRegion>('all');
  let typeFilter = $state<'all' | JobType>('all');

  const EXAMPLE_FEED: JobListing[] = [
    { id: '_jf1', title: 'Senior Scientist — Oncology Biomarkers', company: 'Merck KGaA', location: 'Darmstadt, Germany', region: 'eu', type: 'industry', description: 'Lead translational biomarker strategy for immuno-oncology pipeline. Requires expertise in HGSOC, spatial transcriptomics, and TME profiling. Heidelberg-area preferred.', url: 'https://www.merckgroup.com/en/careers.html', source: 'Curated', postedAt: Date.now() - 259200000, deadline: null, tags: ['immuno-oncology', 'biomarkers', 'spatial'] },
    { id: '_jf2', title: 'Postdoctoral Researcher — Single-Cell Genomics', company: 'EMBL', location: 'Heidelberg, Germany', region: 'eu', type: 'academic', description: 'Join the Stegle/Huber group to develop computational methods for spatial single-cell data integration. Strong scRNA-seq and Python/R required.', url: 'https://www.embl.org/careers', source: 'Curated', postedAt: Date.now() - 432000000, deadline: Date.now() + 1296000000, tags: ['scRNA-seq', 'spatial', 'bioinformatics'] },
    { id: '_jf3', title: 'Translational Scientist — Ovarian Cancer', company: 'AstraZeneca', location: 'Cambridge, UK', region: 'uk', type: 'industry', description: 'Translational scientist for the ovarian cancer / PARP inhibitor franchise. Work on resistance mechanisms, patient stratification, and companion diagnostics alongside the SOLO trial team.', url: 'https://careers.astrazeneca.com', source: 'Curated', postedAt: Date.now() - 604800000, deadline: null, tags: ['ovarian cancer', 'PARP inhibitors', 'translational'] },
    { id: '_jf4', title: 'Scientist — Oncology Genomics', company: 'Biocon', location: 'Bengaluru, India', region: 'india', type: 'industry', description: 'Drive biomarker discovery for biosimilar trastuzumab and novel oncology biologics. Genomics, NGS, and bioinformatics expertise required.', url: 'https://biocon.com/careers', source: 'Curated', postedAt: Date.now() - 864000000, deadline: null, tags: ['genomics', 'bioinformatics', 'biologics'] },
    { id: '_jf5', title: 'Group Leader — Gynaecological Oncology', company: 'DKFZ', location: 'Heidelberg, Germany', region: 'eu', type: 'academic', description: 'Independent group leader position in translational gynaecological oncology research. Excellent infrastructure for scRNA-seq and spatial transcriptomics at DKFZ.', url: 'https://www.dkfz.de/en/stellenangebote/', source: 'Curated', postedAt: Date.now() - 1728000000, deadline: Date.now() + 2592000000, tags: ['ovarian cancer', 'scRNA-seq', 'spatial'] },
    { id: '_jf6', title: 'Head of Translational Science', company: 'Singlera Genomics', location: 'Frankfurt, Germany', region: 'eu', type: 'startup', description: 'Lead translational science at a Series B oncology liquid biopsy startup. Build the science team, design ctDNA biomarker studies, and partner with academic medical centres across Germany and Switzerland. Experience in cfDNA, NGS panel design, and ovarian/gynaecological cancer clinical research preferred.', url: 'https://singleragenomics.com', source: 'Curated', postedAt: Date.now() - 172800000, deadline: null, tags: ['liquid biopsy', 'cfDNA', 'biomarkers'] },
    { id: '_jf7', title: 'Computational Biology Lead', company: 'Omniscope Bio', location: 'London, UK (remote-first)', region: 'uk', type: 'startup', description: 'First computational hire at a spatial multiomics startup (seed-stage, ex-Sanger/Wellcome Sanger). Own the analysis platform for high-plex spatial proteomics + transcriptomics data. Python, Squidpy, napari, deep learning for spatial cell segmentation.', url: 'https://omniscopebio.com', source: 'Curated', postedAt: Date.now() - 86400000, deadline: null, tags: ['spatial', 'bioinformatics', 'multiomics'] },
    { id: '_jf8', title: 'Scientist — Tumour Immunology', company: 'Bicara Therapeutics', location: 'Remote (EU)', region: 'remote', type: 'startup', description: 'Early-stage oncology biotech (Series A) focused on bifunctional antibody-cytokine fusions for solid tumours. Design and execute ex vivo TME co-culture models, FACS, multiplex IF, and scRNA-seq experiments to support IND-enabling studies.', url: 'https://bicaratx.com', source: 'Curated', postedAt: Date.now() - 518400000, deadline: null, tags: ['immuno-oncology', 'TME', 'scRNA-seq'] },
    { id: '_jf9', title: 'Senior Research Scientist — Cancer Genomics', company: 'MedGenome', location: 'Bengaluru, India', region: 'india', type: 'startup', description: 'Clinical genomics startup expanding oncology division. Lead somatic variant interpretation, tumour mutational burden analysis, and HRD scoring for clinical reports. Experience with BRCA1/2, HRD, PARP inhibitor companion diagnostics highly valued.', url: 'https://medgenome.com/careers', source: 'Curated', postedAt: Date.now() - 691200000, deadline: null, tags: ['genomics', 'HRD', 'PARP inhibitors'] },
    { id: '_jf10', title: 'Postdoc — Spatial Transcriptomics & AI', company: 'NCT Heidelberg', location: 'Heidelberg, Germany', region: 'eu', type: 'fellowship', description: '3-year postdoctoral fellowship at NCT Heidelberg (National Centre for Tumour Diseases). Develop AI-driven spatial transcriptomics pipelines for HGSOC patient stratification. Access to FFPE tumour biobank (n>300), Xenium platform, and clinical trial cohorts.', url: 'https://www.nct-heidelberg.de/en/about-us/careers.html', source: 'Curated', postedAt: Date.now() - 345600000, deadline: Date.now() + 2592000000, tags: ['spatial', 'HGSOC', 'ovarian cancer', 'bioinformatics'] },
  ];

  async function fetchFeed() {
    feedLoading = true;
    feedError = '';
    try {
      feedJobs = await fetchJobFeed();
      if (feedJobs.length === 0) feedError = 'No jobs returned from feeds — examples shown below.';
    } catch (e) {
      feedError = 'Live feed unavailable — showing curated examples. Click Refresh to retry.';
      feedJobs = [];
    } finally {
      feedLoading = false;
    }
  }

  const displayFeed = $derived(
    (feedJobs.length > 0 ? feedJobs : EXAMPLE_FEED).filter(j => {
      if (regionFilter !== 'all' && j.region !== regionFilter) return false;
      if (typeFilter !== 'all' && j.type !== typeFilter) return false;
      if (feedSearch) {
        const s = feedSearch.toLowerCase();
        return j.title.toLowerCase().includes(s) || j.company.toLowerCase().includes(s) ||
          j.location.toLowerCase().includes(s) || j.tags.some(t => t.toLowerCase().includes(s)) ||
          j.description.toLowerCase().includes(s);
      }
      return true;
    })
  );

  function saveJobToTracker(listing: JobListing) {
    if (store.savedJobs.some(j => j.listing.url === listing.url)) {
      showToast('Already in tracker');
      return;
    }
    const job: SavedJob = {
      id: nanoid(),
      listing,
      status: 'radar',
      savedAt: Date.now(),
      appliedAt: null,
      notes: '',
      nextAction: '',
      nextActionAt: null,
      interviews: [],
    };
    store.savedJobs = [job, ...store.savedJobs];
    store.saveJobs();
    showToast('Added to tracker');
  }

  // ── Companies state ───────────────────────────────────────────────────────────
  let companyTagFilter = $state('');

  const allCompanyTags = $derived(
    [...new Set([...EU_COMPANIES, ...INDIA_COMPANIES].flatMap(co => co.focus))].sort()
  );

  function filterCompanies(cos: typeof EU_COMPANIES) {
    if (!companyTagFilter) return cos;
    return cos.filter(co => co.focus.some(f => f.toLowerCase() === companyTagFilter.toLowerCase()));
  }

  // ── Tracker state ─────────────────────────────────────────────────────────────
  let trackerFilter = $state<JobStatus | 'all'>('all');
  let expandedJobId = $state<string | null>(null);

  // ── Interview prep state ──────────────────────────────────────
  let prepJobId = $state<string | null>(null);
  let prepText = $state('');
  let prepStreaming = $state(false);
  let prepAbort: AbortController | null = null;

  async function runInterviewPrep(job: SavedJob) {
    if (prepJobId === job.id && prepStreaming) { prepAbort?.abort(); prepStreaming = false; return; }
    prepAbort?.abort();
    prepAbort = new AbortController();
    prepJobId = job.id;
    prepText = '';
    prepStreaming = true;
    const cvSummary = [
      store.researcherProfile.currentRole,
      store.researcherProfile.institution,
      'Specializations: ' + store.researcherProfile.specializations.join(', '),
      store.researcherProfile.cvHighlights.slice(0, 5).join('; '),
    ].filter(Boolean).join('\n');
    try {
      await generateInterviewQuestions(
        job.listing.title, job.listing.company,
        job.listing.description,
        cvSummary,
        (chunk) => { prepText += chunk; },
        prepAbort.signal
      );
    } catch { /* aborted */ }
    prepStreaming = false;
  }
  let editingNotesId = $state<string | null>(null);
  let editingNotesDraft = $state('');
  let addingInterviewId = $state<string | null>(null);
  let interviewDraft = $state<Partial<InterviewRecord>>({ type: 'phone', notes: '', outcome: '' });

  const TRACKER_EXAMPLE: SavedJob[] = [
    { id: '_tj1', listing: { id: '_l1', title: 'Senior Scientist — Translational Oncology', company: 'Roche', location: 'Basel, Switzerland', region: 'eu', type: 'industry', description: '', url: 'https://www.roche.com/careers', source: 'Example', postedAt: Date.now() - 1296000000, deadline: null, tags: ['translational', 'biomarkers'] }, status: 'interviewing', savedAt: Date.now() - 1296000000, appliedAt: Date.now() - 864000000, notes: 'Strong alignment with Diagnostics division. Panel interview scheduled.', nextAction: 'Prepare clinical data presentation', nextActionAt: Date.now() + 172800000, interviews: [{ id: '_i1', date: Date.now() - 259200000, type: 'hr', notes: 'Good rapport. Asked about BRCA experience.', outcome: 'Passed to technical round' }] },
    { id: '_tj2', listing: { id: '_l2', title: 'Postdoctoral Fellow — Tumour Immunology', company: 'NCT Heidelberg', location: 'Heidelberg, Germany', region: 'eu', type: 'academic', description: '', url: 'https://www.nct-heidelberg.de', source: 'Example', postedAt: Date.now() - 604800000, deadline: null, tags: ['immunology', 'ovarian cancer'] }, status: 'applied', savedAt: Date.now() - 604800000, appliedAt: Date.now() - 432000000, notes: 'Applied via web form. Supervisor: Prof. Dr. Mueller.', nextAction: 'Follow up if no response by 15 May', nextActionAt: Date.now() + 950400000, interviews: [] },
  ];

  const displayTracker = $derived(
    (store.savedJobs.length > 0 ? store.savedJobs : TRACKER_EXAMPLE).filter(j =>
      trackerFilter === 'all' || j.status === trackerFilter
    )
  );

  function isExampleJob(j: SavedJob) { return j.id.startsWith('_'); }

  async function updateStatus(id: string, status: JobStatus) {
    const job = store.savedJobs.find(j => j.id === id);
    if (!job) return;
    job.status = status;
    if (status === 'applied' && !job.appliedAt) job.appliedAt = Date.now();
    await store.saveJobs();
  }

  function openNotes(job: SavedJob) {
    editingNotesId = job.id;
    editingNotesDraft = job.notes;
  }

  async function saveNotes() {
    const job = store.savedJobs.find(j => j.id === editingNotesId);
    if (job) {
      job.notes = editingNotesDraft;
      await store.saveJobs();
    }
    editingNotesId = null;
  }

  async function addInterview(jobId: string) {
    const job = store.savedJobs.find(j => j.id === jobId);
    if (!job) return;
    const interview: InterviewRecord = {
      id: nanoid(),
      date: Date.now(),
      type: interviewDraft.type ?? 'phone',
      notes: interviewDraft.notes ?? '',
      outcome: interviewDraft.outcome ?? '',
    };
    job.interviews = [interview, ...(job.interviews ?? [])];
    await store.saveJobs();
    addingInterviewId = null;
    interviewDraft = { type: 'phone', notes: '', outcome: '' };
    showToast('Interview logged');
  }

  async function removeJob(id: string) {
    if (!confirm('Remove this job from tracker?')) return;
    store.savedJobs = store.savedJobs.filter(j => j.id !== id);
    await store.saveJobs();
    showToast('Removed');
  }

  // ── CV Builder ────────────────────────────────────────────────────────────────
  let cvTab = $state<'personal' | 'experience' | 'education' | 'publications' | 'skills' | 'conferences' | 'awards' | 'preview'>('personal');
  let cvSaving = $state(false);

  async function saveCv() {
    cvSaving = true;
    try { await store.saveCv(); showToast('CV saved'); }
    catch (e) { showToast((e as Error).message, 'error'); }
    finally { cvSaving = false; }
  }

  function addExperience() {
    store.cvProfile.experience = [{
      id: nanoid(), role: '', organisation: '', location: '',
      startDate: '', endDate: '', bullets: [''],
    }, ...store.cvProfile.experience];
  }

  function removeExperience(id: string) {
    store.cvProfile.experience = store.cvProfile.experience.filter(e => e.id !== id);
  }

  function addExpBullet(exp: CvExperience) {
    exp.bullets = [...exp.bullets, ''];
  }

  function addEducation() {
    store.cvProfile.education = [{
      id: nanoid(), degree: '', institution: '', location: '', year: '',
    }, ...store.cvProfile.education];
  }

  function removeEducation(id: string) {
    store.cvProfile.education = store.cvProfile.education.filter(e => e.id !== id);
  }

  function addPublication() {
    store.cvProfile.publications = [{
      id: nanoid(), authors: '', title: '', journal: '', year: new Date().getFullYear(), doi: '', highlight: false,
    }, ...store.cvProfile.publications];
  }

  function removePublication(id: string) {
    store.cvProfile.publications = store.cvProfile.publications.filter(p => p.id !== id);
  }

  function addSkillGroup() {
    store.cvProfile.skillGroups = [{
      id: nanoid(), category: '', skills: [],
    }, ...store.cvProfile.skillGroups];
  }

  function removeSkillGroup(id: string) {
    store.cvProfile.skillGroups = store.cvProfile.skillGroups.filter(g => g.id !== id);
  }

  function addConference() {
    store.cvProfile.conferences = [{
      id: nanoid(), title: '', event: '', location: '', year: new Date().getFullYear(), type: 'poster',
    }, ...store.cvProfile.conferences];
  }

  function removeConference(id: string) {
    store.cvProfile.conferences = store.cvProfile.conferences.filter(c => c.id !== id);
  }

  function addAward() {
    store.cvProfile.awards = [{
      id: nanoid(), title: '', issuer: '', year: new Date().getFullYear(), description: '',
    }, ...store.cvProfile.awards];
  }

  function removeAward(id: string) {
    store.cvProfile.awards = store.cvProfile.awards.filter(a => a.id !== id);
  }

  function buildCvMarkdown(): string {
    const cv = store.cvProfile;
    const lines: string[] = [];
    lines.push(`# ${cv.fullName}${cv.pronouns ? ` (${cv.pronouns})` : ''}`);
    lines.push(`${cv.location} · ${cv.email}${cv.phone ? ` · ${cv.phone}` : ''}${cv.orcid ? ` · ORCID: ${cv.orcid}` : ''}${cv.linkedin ? ` · LinkedIn: ${cv.linkedin}` : ''}`);
    if (cv.summary) { lines.push(''); lines.push('## Summary'); lines.push(cv.summary); }
    if (cv.experience.length) {
      lines.push(''); lines.push('## Experience');
      for (const e of cv.experience) {
        lines.push(`\n### ${e.role} — ${e.organisation}, ${e.location}`);
        lines.push(`*${e.startDate} – ${e.endDate || 'Present'}*`);
        for (const b of e.bullets) if (b.trim()) lines.push(`- ${b}`);
      }
    }
    if (cv.education.length) {
      lines.push(''); lines.push('## Education');
      for (const e of cv.education) lines.push(`- **${e.degree}** — ${e.institution}, ${e.location} (${e.year})${e.notes ? ` — ${e.notes}` : ''}`);
    }
    if (cv.publications.length) {
      lines.push(''); lines.push('## Publications');
      for (const p of cv.publications) lines.push(`- ${p.authors} (${p.year}). **${p.title}.** *${p.journal}*${p.doi ? `. https://doi.org/${p.doi}` : ''}`);
    }
    if (cv.skillGroups.length) {
      lines.push(''); lines.push('## Skills');
      for (const g of cv.skillGroups) lines.push(`- **${g.category}:** ${g.skills.join(', ')}`);
    }
    if (cv.conferences.length) {
      lines.push(''); lines.push('## Conferences & Presentations');
      for (const c of cv.conferences) lines.push(`- ${c.year} · **${c.title}** (${c.type}) — ${c.event}, ${c.location}`);
    }
    if (cv.awards.length) {
      lines.push(''); lines.push('## Awards & Fellowships');
      for (const a of cv.awards) lines.push(`- ${a.year} · **${a.title}** — ${a.issuer}${a.description ? ` — ${a.description}` : ''}`);
    }
    if (cv.languages.length) { lines.push(''); lines.push('## Languages'); lines.push(cv.languages.join(', ')); }
    return lines.join('\n');
  }

  function exportCvMarkdown() {
    const md = buildCvMarkdown();
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'cv-amritha.md'; a.click();
    URL.revokeObjectURL(url);
    showToast('CV exported as Markdown');
  }

  function exportCvWord() { exportCvHtml(buildCvMarkdown(), store.cvProfile.fullName || 'CV'); showToast('CV exported as Word document'); }
  function exportCvPDF() { exportCvPdf(buildCvMarkdown(), store.cvProfile.fullName || 'CV'); }

  // ── Cover Letter ──────────────────────────────────────────────────────────────
  let clSelectedJobId = $state('');
  let clJobTitle = $state('');
  let clCompany = $state('');
  let clJobDesc = $state('');
  let clContent = $state('');
  let clGenerating = $state(false);
  let clAbort: AbortController | null = null;
  let clSaving = $state(false);
  let clSelectedLetter = $state<CoverLetter | null>(null);
  let clView = $state<'list' | 'compose' | 'view'>('list');

  $effect(() => {
    if (clSelectedJobId) {
      const job = store.savedJobs.find(j => j.id === clSelectedJobId);
      if (job) {
        clJobTitle = job.listing.title;
        clCompany = job.listing.company;
        clJobDesc = job.listing.description;
      }
    }
  });

  function buildCvSummary(): string {
    const cv = store.cvProfile;
    const parts: string[] = [];
    if (cv.fullName) parts.push(`Name: ${cv.fullName}`);
    if (cv.location) parts.push(`Location: ${cv.location}`);
    if (cv.orcid) parts.push(`ORCID: ${cv.orcid}`);
    if (cv.summary) parts.push(`\nProfile:\n${cv.summary}`);
    if (cv.experience.length) {
      parts.push('\nExperience:\n' + cv.experience.map(e =>
        `- ${e.role} at ${e.organisation} (${e.startDate}–${e.endDate || 'present'})` +
        (e.bullets?.length ? '\n' + e.bullets.slice(0, 3).map((b: string) => `  · ${b}`).join('\n') : '')
      ).join('\n'));
    }
    if (cv.education.length) {
      parts.push('\nEducation:\n' + cv.education.map((e: { degree: string; institution: string; endDate: string }) =>
        `- ${e.degree}, ${e.institution} (${e.endDate})`
      ).join('\n'));
    }
    if (cv.publications.length) {
      parts.push('\nPublications:\n' + cv.publications.slice(0, 6).map((p: { title: string; journal: string; year: string | number; firstAuthor?: boolean }) =>
        `- ${p.title}. ${p.journal} (${p.year})${p.firstAuthor ? ' [first author]' : ''}`
      ).join('\n'));
    }
    if (cv.skillGroups.length) {
      parts.push('\nSkills:\n' + cv.skillGroups.map((g: { category: string; skills: string[] }) =>
        `- ${g.category}: ${g.skills.join(', ')}`
      ).join('\n'));
    }
    if (cv.awards.length) {
      parts.push('\nAwards:\n' + cv.awards.slice(0, 4).map((a: { title: string; year: string | number }) =>
        `- ${a.title} (${a.year})`
      ).join('\n'));
    }
    return parts.join('\n') || 'Postdoctoral researcher specialising in HGSOC, tumour microenvironment, scRNA-seq, spatial transcriptomics, and PARP inhibitor resistance.';
  }

  // ── WRITER — CV bullet improvement ───────────────────────────────────────────
  let writerExpId = $state<string | null>(null);
  let writerBullets = $state('');
  let writerImproving = $state(false);
  let writerAbort: AbortController | null = null;

  async function improveExpEntry(exp: CvExperience) {
    const existing = exp.bullets.filter(b => b.trim());
    if (!existing.length) { showToast('Add some bullet points first', 'error'); return; }
    writerExpId = exp.id;
    writerBullets = '';
    writerImproving = true;
    writerAbort = new AbortController();
    try {
      await improveExpBullets(exp.role, exp.organisation, existing, (chunk) => { writerBullets += chunk; }, writerAbort.signal);
    } catch (e) {
      if ((e as Error).name !== 'AbortError') showToast('WRITER failed: ' + (e as Error).message, 'error');
    } finally { writerImproving = false; writerAbort = null; }
  }

  function acceptWriterBullets(exp: CvExperience) {
    const lines = writerBullets
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.startsWith('·') || l.startsWith('-') || l.startsWith('•'))
      .map(l => l.replace(/^[·\-•]\s*/, '').trim())
      .filter(Boolean);
    if (lines.length) exp.bullets = lines;
    writerExpId = null;
    writerBullets = '';
    showToast('Bullets updated — save CV to keep');
  }

  async function generateLetter() {
    if (!clJobTitle || !clCompany) { showToast('Enter job title and company first', 'error'); return; }
    clGenerating = true;
    clContent = '';
    clAbort = new AbortController();
    const recentLetters = store.coverLetters.slice(0, 2).map(l => ({
      company: l.company, role: l.role, content: l.content
    }));
    try {
      await generateCoverLetter(
        clJobTitle, clCompany, clJobDesc, buildCvSummary(),
        (chunk) => { clContent += chunk; },
        clAbort.signal,
        recentLetters
      );
    } catch (e) {
      if ((e as Error).name !== 'AbortError') showToast('Generation failed: ' + (e as Error).message, 'error');
    } finally { clGenerating = false; clAbort = null; }
  }

  async function saveCoverLetter() {
    if (!clContent.trim()) return;
    clSaving = true;
    try {
      const letter: CoverLetter = {
        id: nanoid(),
        jobId: clSelectedJobId,
        company: clCompany,
        role: clJobTitle,
        content: clContent,
        generatedAt: Date.now(),
        editedAt: Date.now(),
        note: '',
      };
      store.coverLetters = [letter, ...store.coverLetters];
      await store.saveCoverLetters();
      showToast('Cover letter saved');
      clView = 'list';
    } catch (e) { showToast((e as Error).message, 'error'); }
    finally { clSaving = false; }
  }

  async function deleteLetter(id: string) {
    if (!confirm('Delete this cover letter?')) return;
    store.coverLetters = store.coverLetters.filter(l => l.id !== id);
    await store.saveCoverLetters();
    showToast('Deleted');
  }

  function exportLetter(letter: CoverLetter) {
    const blob = new Blob([letter.content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `cover-letter-${letter.company.replace(/\s+/g, '-').toLowerCase()}.md`; a.click();
    URL.revokeObjectURL(url);
  }

  // ── Contacts / Network ────────────────────────────────────────────────────────
  let contactDraft = $state<Partial<JobContact>>({});
  let editingContactId = $state<string | null>(null);
  let contactSearch = $state('');

  const displayContacts = $derived(
    store.jobContacts.filter(c => !contactSearch ||
      c.name.toLowerCase().includes(contactSearch.toLowerCase()) ||
      c.company.toLowerCase().includes(contactSearch.toLowerCase()) ||
      c.role.toLowerCase().includes(contactSearch.toLowerCase())
    )
  );

  function startNewContact() {
    contactDraft = { name: '', role: '', company: '', email: '', linkedin: '', notes: '', metAt: '', lastContactAt: null };
    editingContactId = 'new';
  }

  async function saveContact() {
    if (!contactDraft.name?.trim()) return;
    if (editingContactId === 'new') {
      const contact: JobContact = {
        id: nanoid(),
        name: contactDraft.name ?? '',
        role: contactDraft.role ?? '',
        company: contactDraft.company ?? '',
        email: contactDraft.email ?? '',
        linkedin: contactDraft.linkedin ?? '',
        notes: contactDraft.notes ?? '',
        metAt: contactDraft.metAt ?? '',
        lastContactAt: contactDraft.lastContactAt ?? null,
      };
      store.jobContacts = [contact, ...store.jobContacts];
    } else {
      const idx = store.jobContacts.findIndex(c => c.id === editingContactId);
      if (idx >= 0) store.jobContacts[idx] = { ...store.jobContacts[idx], ...contactDraft } as JobContact;
    }
    await store.saveJobExt();
    editingContactId = null;
    contactDraft = {};
    showToast('Contact saved');
  }

  async function deleteContact(id: string) {
    store.jobContacts = store.jobContacts.filter(c => c.id !== id);
    await store.saveJobExt();
    showToast('Deleted');
  }

  // ── Salary tracker ────────────────────────────────────────────────────────────
  let salaryDraft = $state<Partial<SalaryEntry>>({ currency: 'EUR', type: 'estimate', year: new Date().getFullYear() });
  let addingSalary = $state(false);

  const SALARY_EXAMPLE: SalaryEntry[] = [
    { id: '_s1', company: 'Merck KGaA', role: 'Senior Scientist Oncology', region: 'Germany', salaryMin: 65000, salaryMax: 85000, currency: 'EUR', type: 'estimate', notes: 'Based on Glassdoor + LinkedIn range for PhD+4yrs', year: 2026 },
    { id: '_s2', company: 'AstraZeneca', role: 'Translational Scientist', region: 'UK', salaryMin: 55000, salaryMax: 75000, currency: 'GBP', type: 'glassdoor', notes: 'Posted band for Cambridge site', year: 2026 },
    { id: '_s3', company: 'Biocon', role: 'Scientist II', region: 'Bengaluru', salaryMin: 1800000, salaryMax: 2800000, currency: 'INR', type: 'estimate', notes: 'Industry standard for genomics PhD + 3 yrs postdoc', year: 2026 },
  ];

  async function addSalary() {
    if (!salaryDraft.company || !salaryDraft.role) return;
    const entry: SalaryEntry = {
      id: nanoid(),
      company: salaryDraft.company ?? '',
      role: salaryDraft.role ?? '',
      region: salaryDraft.region ?? '',
      salaryMin: salaryDraft.salaryMin ?? 0,
      salaryMax: salaryDraft.salaryMax ?? 0,
      currency: salaryDraft.currency ?? 'EUR',
      type: salaryDraft.type ?? 'estimate',
      notes: salaryDraft.notes ?? '',
      year: salaryDraft.year ?? new Date().getFullYear(),
    };
    store.salaryEntries = [entry, ...store.salaryEntries];
    await store.saveJobExt();
    salaryDraft = { currency: 'EUR', type: 'estimate', year: new Date().getFullYear() };
    addingSalary = false;
    showToast('Entry added');
  }

  async function deleteSalary(id: string) {
    store.salaryEntries = store.salaryEntries.filter(e => e.id !== id);
    await store.saveJobExt();
  }

  const displaySalaries = $derived(store.salaryEntries.length > 0 ? store.salaryEntries : SALARY_EXAMPLE);

  // ── Analytics ─────────────────────────────────────────────────────────────────
  const analytics = $derived(() => {
    const jobs = store.savedJobs;
    const byStatus = PIPELINE_STAGES.reduce((acc, s) => {
      acc[s.id] = jobs.filter(j => j.status === s.id).length;
      return acc;
    }, {} as Record<string, number>);
    const applied = jobs.filter(j => j.appliedAt !== null).length;
    const withInterviews = jobs.filter(j => (j.interviews?.length ?? 0) > 0).length;
    const conversionRate = applied > 0 ? Math.round((withInterviews / applied) * 100) : 0;
    const byRegion = jobs.reduce((acc, j) => {
      const r = j.listing.region; acc[r] = (acc[r] || 0) + 1; return acc;
    }, {} as Record<string, number>);
    const byType = jobs.reduce((acc, j) => {
      const t = j.listing.type; acc[t] = (acc[t] || 0) + 1; return acc;
    }, {} as Record<string, number>);
    return { byStatus, applied, withInterviews, conversionRate, byRegion, byType, total: jobs.length };
  });

  // ── Helpers ───────────────────────────────────────────────────────────────────
  function relTime(ts: number): string {
    const d = Date.now() - ts;
    if (d < 86400000) return `${Math.floor(d / 3600000)}h ago`;
    if (d < 604800000) return `${Math.floor(d / 86400000)}d ago`;
    return new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  }

  function fmtDate(ts: number): string {
    return new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function stageColor(s: JobStatus): string {
    const map: Record<JobStatus, string> = { radar: 'mu', queued: 'pu', applied: 'ac', screening: 'yw', interviewing: 'oj', offer: 'gn', closed: 'mu' };
    return map[s] ?? 'mu';
  }
</script>

<!-- ── Landing page when disabled ───────────────────────────────────────────── -->
{#if !enabled}
  <div class="landing">
    <div class="landing-inner">
      <div class="landing-icon">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <rect x="2" y="7" width="20" height="14" rx="2"/>
          <path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"/>
          <line x1="12" y1="12" x2="12" y2="16"/>
          <line x1="10" y1="14" x2="14" y2="14"/>
        </svg>
      </div>
      <h2>Job Intelligence Portal</h2>
      <p class="landing-desc">
        Your complete job search command centre — curated feeds from EU &amp; India pharma, application tracker,
        AI-powered CV builder, cover letter generator, interview prep, salary benchmarking, and network manager.
      </p>
      <div class="landing-features">
        {#each ['Live job feed — Nature Careers, EMBL, EurAxess, Indeed', 'Kanban tracker — radar → offer pipeline', 'CV builder with export', 'AI cover letter generator (Enzo)', 'Salary benchmarking database', 'Network &amp; contacts log', 'Application analytics'] as f}
          <div class="landing-feature">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--gn)" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            {@html f}
          </div>
        {/each}
      </div>
      <button class="btn btn-primary btn-lg" onclick={enable}>
        Enable for this session
      </button>
      <p class="landing-note text-xs text-mu">Stays active until you close this tab. Data auto-saves to GitHub.</p>
    </div>
  </div>

<!-- ── Full portal ───────────────────────────────────────────────────────────── -->
{:else}
  <div class="jobs-view">
    <!-- Tab bar -->
    <div class="tab-bar">
      {#each [
        ['feed',        'Feed'],
        ['tracker',     'Tracker'],
        ['companies',   'Companies'],
        ['cv',          'CV Builder'],
        ['coverletter', 'Cover Letters'],
        ['contacts',    'Network'],
        ['salary',      'Salary'],
        ['analytics',   'Analytics'],
      ] as [id, label]}
        <button class="tab-btn" class:active={tab === id} onclick={() => tab = id as typeof tab}>
          {label}
          {#if id === 'tracker' && store.savedJobs.length > 0}
            <span class="tab-badge">{store.savedJobs.length}</span>
          {/if}
        </button>
      {/each}
    </div>

    <div class="tab-content">

      <!-- ── FEED ─────────────────────────────────────────────────────────────── -->
      {#if tab === 'feed'}
        <div class="feed-view">
          <div class="feed-controls">
            <input class="search-input" type="search" bind:value={feedSearch} placeholder="Search jobs…" />
            <select bind:value={regionFilter}>
              <option value="all">All regions</option>
              {#each Object.entries(REGION_LABELS) as [v, l]}<option value={v}>{l}</option>{/each}
            </select>
            <select bind:value={typeFilter}>
              <option value="all">All types</option>
              {#each Object.entries(TYPE_LABELS) as [v, l]}<option value={v}>{l}</option>{/each}
            </select>
            <button class="btn btn-primary btn-sm" onclick={fetchFeed} disabled={feedLoading}>
              {feedLoading ? 'Loading…' : 'Refresh'}
            </button>
          </div>

          {#if feedError}
            <div class="feed-notice text-xs text-mu">{feedError}</div>
          {/if}

          <div class="job-list">
            {#each displayFeed as job (job.id)}
              <div class="job-card" class:example-card={job.id.startsWith('_')}>
                {#if job.id.startsWith('_')}<span class="example-label">· example</span>{/if}
                <div class="job-head">
                  <div class="job-title-row">
                    <h3 class="job-title">{job.title}</h3>
                    <span class="tag type-tag type-{job.type}">{TYPE_LABELS[job.type] ?? job.type}</span>
                    <span class="tag region-tag">{REGION_LABELS[job.region] ?? job.region}</span>
                  </div>
                  <div class="job-meta">
                    <span class="company-name">{job.company}</span>
                    <span class="separator">·</span>
                    <span class="location text-mu">{job.location}</span>
                    {#if job.postedAt}<span class="separator">·</span><span class="text-mu text-xs">{relTime(job.postedAt)}</span>{/if}
                    {#if job.deadline}<span class="separator">·</span><span class="deadline-badge">Deadline: {fmtDate(job.deadline)}</span>{/if}
                    <span class="separator">·</span><span class="source-tag text-xs text-mu">{job.source}</span>
                  </div>
                </div>
                <p class="job-desc text-sm text-mu">{job.description.slice(0, 220)}{job.description.length > 220 ? '…' : ''}</p>
                {#if job.tags.length > 0}
                  <div class="tag-row">{#each job.tags as t}<span class="tag">{t}</span>{/each}</div>
                {/if}
                <div class="job-actions">
                  <a class="btn btn-ghost btn-sm" href={job.url} target="_blank" rel="noreferrer">View posting</a>
                  <button class="btn btn-primary btn-sm" onclick={() => saveJobToTracker(job)}
                    disabled={store.savedJobs.some(j => j.listing.url === job.url)}>
                    {store.savedJobs.some(j => j.listing.url === job.url) ? 'In tracker' : '+ Track'}
                  </button>
                </div>
              </div>
            {:else}
              <div class="empty-state">
                <p class="text-mu">No jobs match your filters.</p>
              </div>
            {/each}
          </div>
        </div>

      <!-- ── TRACKER ───────────────────────────────────────────────────────────── -->
      {:else if tab === 'tracker'}
        <div class="tracker-view">
          <div class="tracker-header">
            <div class="stage-pills">
              <button class="stage-pill" class:active={trackerFilter==='all'} onclick={() => trackerFilter='all'}>All</button>
              {#each PIPELINE_STAGES as s}
                <button class="stage-pill" class:active={trackerFilter===s.id} onclick={() => trackerFilter=s.id as JobStatus}>
                  {s.label}
                  <span class="stage-count">{store.savedJobs.filter(j => j.status === s.id).length}</span>
                </button>
              {/each}
            </div>
          </div>

          <div class="tracker-list">
            {#each displayTracker as job (job.id)}
              {@const isEx = isExampleJob(job)}
              <div class="tracker-card" class:example-card={isEx} class:expanded={expandedJobId === job.id}>
                {#if isEx}<span class="example-label">· example</span>{/if}
                <div class="tracker-row" role="button" tabindex="0"
                  onclick={() => expandedJobId = expandedJobId === job.id ? null : job.id}
                  onkeydown={(e) => e.key === 'Enter' && (expandedJobId = expandedJobId === job.id ? null : job.id)}>
                  <div class="tracker-main">
                    <span class="stage-dot" style="background: var(--{stageColor(job.status)})"></span>
                    <div class="tracker-info">
                      <div class="tracker-title">{job.listing.title}</div>
                      <div class="tracker-sub text-xs text-mu">
                        {job.listing.company} · {job.listing.location}
                        {#if job.appliedAt} · Applied {relTime(job.appliedAt)}{/if}
                      </div>
                    </div>
                  </div>
                  <div class="tracker-right">
                    <span class="stage-badge stage-{job.status}">{job.status}</span>
                    {#if !isEx}
                      <button class="btn-icon danger-icon" onclick={(e) => { e.stopPropagation(); removeJob(job.id); }} title="Remove">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6m5 0V4h4v2"/></svg>
                      </button>
                    {/if}
                  </div>
                </div>

                {#if expandedJobId === job.id}
                  <div class="tracker-expand">
                    <!-- Stage selector -->
                    {#if !isEx}
                      <div class="expand-section">
                        <span class="field-label">Move to stage</span>
                        <div class="stage-select">
                          {#each PIPELINE_STAGES as s}
                            <button class="stage-move-btn" class:active={job.status === s.id}
                              onclick={() => updateStatus(job.id, s.id as JobStatus)}>
                              {s.label}
                            </button>
                          {/each}
                        </div>
                      </div>

                      <!-- Interviews -->
                      <div class="expand-section">
                        <div class="expand-head">
                          <span class="field-label">Interviews ({job.interviews?.length ?? 0})</span>
                          <button class="btn btn-ghost btn-xs" onclick={() => addingInterviewId = addingInterviewId === job.id ? null : job.id}>+ Log</button>
                        </div>
                        {#if addingInterviewId === job.id}
                          <div class="interview-form">
                            <select bind:value={interviewDraft.type}>
                              {#each ['phone', 'technical', 'panel', 'hr', 'onsite', 'other'] as t}
                                <option value={t}>{t}</option>
                              {/each}
                            </select>
                            <textarea bind:value={interviewDraft.notes} placeholder="Notes from the interview…" rows={2}></textarea>
                            <input bind:value={interviewDraft.outcome} placeholder="Outcome / next step" />
                            <button class="btn btn-primary btn-sm" onclick={() => addInterview(job.id)}>Save</button>
                          </div>
                        {/if}
                        {#each (job.interviews ?? []) as iv}
                          <div class="interview-row text-sm">
                            <span class="tag">{iv.type}</span>
                            <span class="text-mu text-xs">{fmtDate(iv.date)}</span>
                            {#if iv.notes}<p class="iv-notes text-mu">{iv.notes}</p>{/if}
                            {#if iv.outcome}<p class="iv-outcome">{iv.outcome}</p>{/if}
                          </div>
                        {/each}
                      </div>

                      <!-- Notes -->
                      <div class="expand-section">
                        <div class="expand-head">
                          <span class="field-label">Notes</span>
                          <button class="btn btn-ghost btn-xs" onclick={() => openNotes(job)}>Edit</button>
                        </div>
                        {#if job.notes}<p class="job-notes-text text-sm text-mu">{job.notes}</p>{/if}
                      </div>

                      <!-- Generate cover letter shortcut -->
                      {#if store.aiSettings.coverLetter}
                      <div class="expand-section">
                        <button class="btn btn-ghost btn-sm" onclick={() => {
                          clSelectedJobId = job.id;
                          clJobTitle = job.listing.title;
                          clCompany = job.listing.company;
                          clJobDesc = job.listing.description;
                          clView = 'compose';
                          tab = 'coverletter';
                        }}>
                          Generate cover letter for this role →
                        </button>
                      </div>
                      {:else}
                      <div class="expand-section">
                        <span class="text-xs text-mu">Enable "Cover letter generator" in Settings → AI features to generate letters.</span>
                      </div>
                      {/if}

                      <!-- Interview prep (Enzo) -->
                      <div class="expand-section">
                        <div class="expand-head">
                          <span class="field-label">Interview prep</span>
                          <button
                            class="btn btn-ghost btn-xs prep-btn"
                            class:prep-active={prepJobId === job.id}
                            onclick={() => runInterviewPrep(job)}
                          >
                            {#if prepStreaming && prepJobId === job.id}
                              <span class="spinner-xs-inline"></span> Thinking…
                            {:else}
                              <span class="enzo-dot-tiny"></span>
                              Ask Enzo
                            {/if}
                          </button>
                        </div>
                        {#if prepJobId === job.id && (prepText || prepStreaming)}
                          <div class="prep-panel">
                            <div class="prep-body text-xs" style="white-space:pre-wrap;line-height:1.65">{prepText || '…'}</div>
                            {#if !prepStreaming}
                              <div class="prep-footer">
                                <button class="btn-link text-xs" onclick={() => { navigator.clipboard.writeText(prepText); showToast('Copied'); }}>Copy</button>
                                <button class="btn-link text-xs" onclick={() => { prepJobId = null; prepText = ''; }}>Close</button>
                              </div>
                            {/if}
                          </div>
                        {/if}
                      </div>
                    {/if}
                    <a class="btn btn-ghost btn-sm" href={job.listing.url} target="_blank" rel="noreferrer">View original posting →</a>
                  </div>
                {/if}
              </div>
            {:else}
              <div class="empty-state">
                <p class="text-mu text-sm">No jobs tracked. Find one in the Feed tab and click Track.</p>
              </div>
            {/each}
          </div>
        </div>

        <!-- Notes modal -->
        {#if editingNotesId}
          <!-- svelte-ignore a11y_click_events_have_key_events -->
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div class="modal-backdrop" onclick={() => editingNotesId = null}>
            <div class="modal" onclick={(e) => e.stopPropagation()}>
              <div class="modal-head">
                <h3>Job notes</h3>
                <button class="btn-icon" onclick={() => editingNotesId = null}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>
              <RichEditor bind:value={editingNotesDraft} placeholder="Notes, contacts, timeline…" minHeight="140px" />
              <div class="modal-actions">
                <button class="btn btn-ghost btn-sm" onclick={() => editingNotesId = null}>Cancel</button>
                <button class="btn btn-primary btn-sm" onclick={saveNotes}>Save</button>
              </div>
            </div>
          </div>
        {/if}

      <!-- ── COMPANIES ──────────────────────────────────────────────────────────── -->
      {:else if tab === 'companies'}
        <div class="companies-view">
          <!-- Tag filter bar -->
          <div class="co-filter-bar">
            <span class="source-label">Filter by</span>
            <div class="co-filter-tags">
              {#each allCompanyTags.slice(0, 24) as t}
                <button
                  class="co-filter-tag"
                  class:active={companyTagFilter === t}
                  onclick={() => companyTagFilter = companyTagFilter === t ? '' : t}
                >{t}</button>
              {/each}
            </div>
            {#if companyTagFilter}
              <button class="co-filter-clear" onclick={() => companyTagFilter = ''}>
                ✕ clear
              </button>
            {/if}
          </div>

          {#each [['EU / UK / Switzerland', EU_COMPANIES], ['India', INDIA_COMPANIES]] as [label, cos]}
            {@const filtered = filterCompanies(cos as typeof EU_COMPANIES)}
            {#if filtered.length > 0}
              <div class="company-region">
                <h3 class="region-heading">{label} <span class="co-count text-mu">({filtered.length})</span></h3>
                <div class="company-grid">
                  {#each filtered as co}
                    <div class="company-card">
                      <div class="co-head">
                        <span class="co-name">{co.name}</span>
                        <span class="tier-badge tier-{co.tier}">{co.tier}</span>
                      </div>
                      <p class="co-loc text-xs text-mu">{co.location}</p>
                      <div class="co-tags">
                        {#each co.focus.slice(0, 4) as f}
                          <button
                            class="tag co-tag-btn"
                            class:active-tag={companyTagFilter === f}
                            onclick={() => companyTagFilter = companyTagFilter === f ? '' : f}
                            title="Filter by: {f}"
                          >{f}</button>
                        {/each}
                      </div>
                      <a class="btn btn-ghost btn-xs co-link" href={co.url} target="_blank" rel="noreferrer">Careers page →</a>
                    </div>
                  {/each}
                </div>
              </div>
            {/if}
          {/each}

          {#if !filterCompanies(EU_COMPANIES).length && !filterCompanies(INDIA_COMPANIES).length}
            <p class="text-mu text-sm" style="padding:24px 0">No companies match "{companyTagFilter}" — <button class="text-link" onclick={() => companyTagFilter = ''}>clear filter</button></p>
          {/if}
        </div>

      <!-- ── CV BUILDER ──────────────────────────────────────────────────────────── -->
      {:else if tab === 'cv'}
        <div class="cv-view">
          <div class="cv-header">
            <div class="cv-tabs">
              {#each [['personal','Personal'],['experience','Experience'],['education','Education'],['publications','Publications'],['skills','Skills'],['conferences','Conferences'],['awards','Awards'],['preview','Preview']] as [id, lbl]}
                <button class="cv-tab" class:active={cvTab === id} onclick={() => cvTab = id as typeof cvTab}>{lbl}</button>
              {/each}
            </div>
            <div class="cv-actions">
              <button class="btn btn-ghost btn-sm" onclick={exportCvMarkdown}>Export .md</button>
              <button class="btn btn-ghost btn-sm" onclick={exportCvWord}>Export .doc</button>
              <button class="btn btn-ghost btn-sm" onclick={exportCvPDF}>Print / PDF</button>
              <button class="btn btn-primary btn-sm" onclick={saveCv} disabled={cvSaving}>{cvSaving ? 'Saving…' : 'Save CV'}</button>
            </div>
          </div>

          <div class="cv-content">
            {#if cvTab === 'personal'}
              <div class="cv-section">
                <h3 class="cv-section-title">Personal Information</h3>
                <div class="field-grid">
                  <div class="field"><label>Full name</label><input bind:value={store.cvProfile.fullName} /></div>
                  <div class="field"><label>Pronouns</label><input bind:value={store.cvProfile.pronouns} placeholder="she/her" /></div>
                  <div class="field"><label>Email</label><input type="email" bind:value={store.cvProfile.email} /></div>
                  <div class="field"><label>Phone</label><input bind:value={store.cvProfile.phone} /></div>
                  <div class="field"><label>Location</label><input bind:value={store.cvProfile.location} /></div>
                  <div class="field"><label>ORCID</label><input bind:value={store.cvProfile.orcid} placeholder="0000-0000-0000-0000" /></div>
                  <div class="field"><label>LinkedIn</label><input bind:value={store.cvProfile.linkedin} /></div>
                  <div class="field"><label>Website</label><input bind:value={store.cvProfile.website} /></div>
                </div>
                <div class="field full">
                  <label>Professional summary</label>
                  <RichEditor bind:value={store.cvProfile.summary} placeholder="2–3 sentence research identity statement…" minHeight="90px" />
                </div>
                <div class="field">
                  <label>Languages (comma-separated)</label>
                  <input value={store.cvProfile.languages.join(', ')} oninput={(e) => store.cvProfile.languages = (e.target as HTMLInputElement).value.split(',').map(l => l.trim()).filter(Boolean)} />
                </div>
              </div>

            {:else if cvTab === 'experience'}
              <div class="cv-section">
                <div class="section-head"><h3 class="cv-section-title">Experience</h3><button class="btn btn-primary btn-sm" onclick={addExperience}>+ Add</button></div>
                {#if store.cvProfile.experience.length === 0}
                  <div class="cv-example-hint">
                    <p class="text-xs text-mu">No experience added yet — here's an example of what to fill in. Click + Add to start.</p>
                    <div class="cv-item cv-item-example">
                      <div class="field-grid">
                        <div class="field"><label>Role / Title</label><input disabled value="Postdoctoral Researcher" /></div>
                        <div class="field"><label>Organisation</label><input disabled value="Heidelberg University" /></div>
                        <div class="field"><label>Location</label><input disabled value="Heidelberg, Germany" /></div>
                        <div class="field-row">
                          <div class="field"><label>Start</label><input disabled value="2022-09" /></div>
                          <div class="field"><label>End</label><input disabled value="" placeholder="Present" /></div>
                        </div>
                      </div>
                      <div class="field full">
                        <label>Bullet points</label>
                        <input disabled value="scRNA-seq analysis of HGSOC tumour microenvironment (n=45 patients)" class="bullet-input" />
                        <input disabled value="Spatial transcriptomics (Visium) for immune cell niche mapping in PARPi-treated cohort" class="bullet-input" />
                        <input disabled value="Biomarker discovery for PARPi resistance — CD8 exhaustion signature validated by multiplex IF" class="bullet-input" />
                      </div>
                    </div>
                  </div>
                {/if}
                {#each store.cvProfile.experience as exp (exp.id)}
                  <div class="cv-item">
                    <button class="cv-item-remove" onclick={() => removeExperience(exp.id)}>×</button>
                    <div class="field-grid">
                      <div class="field"><label>Role / Title</label><input bind:value={exp.role} /></div>
                      <div class="field"><label>Organisation</label><input bind:value={exp.organisation} /></div>
                      <div class="field"><label>Location</label><input bind:value={exp.location} /></div>
                      <div class="field-row">
                        <div class="field"><label>Start (YYYY-MM)</label><input bind:value={exp.startDate} placeholder="2022-09" /></div>
                        <div class="field"><label>End (blank = Present)</label><input bind:value={exp.endDate} placeholder="Present" /></div>
                      </div>
                    </div>
                    <div class="field full">
                      <label>Bullet points</label>
                      {#each exp.bullets as _, i}
                        <input class="bullet-input" bind:value={exp.bullets[i]} placeholder="Achievement or responsibility…" />
                      {/each}
                      <div class="bullet-actions">
                        <button class="btn btn-ghost btn-xs" onclick={() => addExpBullet(exp)}>+ Add bullet</button>
                        {#if store.aiSettings.writerBullets}
                        <button
                          class="btn btn-ghost btn-xs writer-improve-btn"
                          onclick={() => improveExpEntry(exp)}
                          disabled={writerImproving && writerExpId === exp.id}
                        >
                          {#if writerImproving && writerExpId === exp.id}
                            <span class="spinner-xs-inline"></span> Writing…
                          {:else}
                            <span class="writer-w-badge">W</span> Improve with WRITER
                          {/if}
                        </button>
                        {/if}
                      </div>
                    </div>

                    {#if writerExpId === exp.id}
                      <div class="writer-panel">
                        <div class="writer-panel-head">
                          <span class="writer-panel-label">WRITER — improved bullets</span>
                          {#if writerImproving}
                            <span class="spinner-xs-inline"></span>
                          {:else}
                            <span class="text-xs text-mu">Review before accepting</span>
                          {/if}
                        </div>
                        <pre class="writer-preview">{writerBullets || '…'}</pre>
                        {#if !writerImproving && writerBullets}
                          <div class="writer-actions">
                            <button class="btn btn-primary btn-sm" onclick={() => acceptWriterBullets(exp)}>Accept & replace</button>
                            <button class="btn btn-ghost btn-sm" onclick={() => { writerExpId = null; writerBullets = ''; writerAbort?.abort(); }}>Discard</button>
                          </div>
                        {/if}
                      </div>
                    {/if}
                  </div>
                {:else}
                  <p class="empty-hint text-mu text-sm">No experience added yet. Click "+ Add" to start.</p>
                {/each}
              </div>

            {:else if cvTab === 'education'}
              <div class="cv-section">
                <div class="section-head"><h3 class="cv-section-title">Education</h3><button class="btn btn-primary btn-sm" onclick={addEducation}>+ Add</button></div>
                {#each store.cvProfile.education as edu (edu.id)}
                  <div class="cv-item">
                    <button class="cv-item-remove" onclick={() => removeEducation(edu.id)}>×</button>
                    <div class="field-grid">
                      <div class="field"><label>Degree</label><input bind:value={edu.degree} placeholder="PhD Molecular Medicine" /></div>
                      <div class="field"><label>Institution</label><input bind:value={edu.institution} /></div>
                      <div class="field"><label>Location</label><input bind:value={edu.location} /></div>
                      <div class="field"><label>Year</label><input bind:value={edu.year} placeholder="2022" /></div>
                      <div class="field full"><label>Notes</label><input bind:value={edu.notes} placeholder="Thesis title, supervisor, GPA…" /></div>
                    </div>
                  </div>
                {:else}
                  <p class="empty-hint text-mu text-sm">No education added yet.</p>
                {/each}
              </div>

            {:else if cvTab === 'publications'}
              <div class="cv-section">
                <div class="section-head"><h3 class="cv-section-title">Publications</h3><button class="btn btn-primary btn-sm" onclick={addPublication}>+ Add</button></div>
                {#if store.cvProfile.publications.length === 0}
                  <div class="cv-example-hint">
                    <p class="text-xs text-mu">No publications added yet. Example format below — click + Add to enter yours.</p>
                    <div class="cv-item cv-item-example">
                      <div class="field-grid">
                        <div class="field full"><label>Title</label><input disabled value="Single-cell dissection of HGSOC tumour microenvironment reveals CD8+ T cell exhaustion trajectories linked to PARPi resistance" /></div>
                        <div class="field full"><label>Authors</label><input disabled value="Sathyanarayanan A, Müller K, Zhang Y, et al." /></div>
                        <div class="field"><label>Journal</label><input disabled value="Nature Cancer" /></div>
                        <div class="field"><label>Year</label><input disabled value="2025" /></div>
                        <div class="field"><label>DOI</label><input disabled value="10.1038/s43018-025-00xxx" /></div>
                      </div>
                    </div>
                  </div>
                {:else}
                  {#each store.cvProfile.publications as pub (pub.id)}
                    <div class="cv-item">
                      <button class="cv-item-remove" onclick={() => removePublication(pub.id)}>×</button>
                      <div class="field-grid">
                        <div class="field full"><label>Title</label><input bind:value={pub.title} /></div>
                        <div class="field full"><label>Authors</label><input bind:value={pub.authors} placeholder="Sathyanarayanan A, et al." /></div>
                        <div class="field"><label>Journal</label><input bind:value={pub.journal} /></div>
                        <div class="field"><label>Year</label><input type="number" bind:value={pub.year} /></div>
                        <div class="field"><label>DOI</label><input bind:value={pub.doi} placeholder="10.xxxx/…" /></div>
                        <div class="field checkbox-field">
                          <label><input type="checkbox" bind:checked={pub.highlight} /> Highlight (key paper)</label>
                        </div>
                      </div>
                    </div>
                  {/each}
                {/if}
              </div>

            {:else if cvTab === 'skills'}
              <div class="cv-section">
                <div class="section-head"><h3 class="cv-section-title">Skills</h3><button class="btn btn-primary btn-sm" onclick={addSkillGroup}>+ Add group</button></div>
                {#each store.cvProfile.skillGroups as grp (grp.id)}
                  <div class="cv-item">
                    <button class="cv-item-remove" onclick={() => removeSkillGroup(grp.id)}>×</button>
                    <div class="field-grid">
                      <div class="field"><label>Category</label><input bind:value={grp.category} placeholder="Bioinformatics, Wet lab, Languages…" /></div>
                      <div class="field full"><label>Skills (comma-separated)</label>
                        <input value={grp.skills.join(', ')} oninput={(e) => grp.skills = (e.target as HTMLInputElement).value.split(',').map(s => s.trim()).filter(Boolean)} placeholder="Seurat, Scanpy, Python, R, STAR, CellRanger…" />
                      </div>
                    </div>
                  </div>
                {:else}
                  <p class="empty-hint text-mu text-sm">No skill groups added yet.</p>
                {/each}
              </div>

            {:else if cvTab === 'conferences'}
              <div class="cv-section">
                <div class="section-head"><h3 class="cv-section-title">Conferences &amp; Presentations</h3><button class="btn btn-primary btn-sm" onclick={addConference}>+ Add</button></div>
                {#each store.cvProfile.conferences as conf (conf.id)}
                  <div class="cv-item">
                    <button class="cv-item-remove" onclick={() => removeConference(conf.id)}>×</button>
                    <div class="field-grid">
                      <div class="field full"><label>Presentation title</label><input bind:value={conf.title} /></div>
                      <div class="field"><label>Conference</label><input bind:value={conf.event} placeholder="ESMO, AACR, Keystone…" /></div>
                      <div class="field"><label>Location</label><input bind:value={conf.location} /></div>
                      <div class="field"><label>Year</label><input type="number" bind:value={conf.year} /></div>
                      <div class="field"><label>Type</label>
                        <select bind:value={conf.type}>
                          {#each ['oral', 'poster', 'workshop', 'invited'] as t}<option value={t}>{t}</option>{/each}
                        </select>
                      </div>
                    </div>
                  </div>
                {:else}
                  <p class="empty-hint text-mu text-sm">No conferences added yet.</p>
                {/each}
              </div>

            {:else if cvTab === 'awards'}
              <div class="cv-section">
                <div class="section-head"><h3 class="cv-section-title">Awards &amp; Fellowships</h3><button class="btn btn-primary btn-sm" onclick={addAward}>+ Add</button></div>
                {#each store.cvProfile.awards as aw (aw.id)}
                  <div class="cv-item">
                    <button class="cv-item-remove" onclick={() => removeAward(aw.id)}>×</button>
                    <div class="field-grid">
                      <div class="field"><label>Title</label><input bind:value={aw.title} /></div>
                      <div class="field"><label>Issuing body</label><input bind:value={aw.issuer} /></div>
                      <div class="field"><label>Year</label><input type="number" bind:value={aw.year} /></div>
                      <div class="field full"><label>Description (optional)</label><input bind:value={aw.description} /></div>
                    </div>
                  </div>
                {:else}
                  <p class="empty-hint text-mu text-sm">No awards added yet.</p>
                {/each}
              </div>

            {:else if cvTab === 'preview'}
              <div class="cv-preview">
                <div class="cv-preview-head">
                  <h2>{store.cvProfile.fullName}{store.cvProfile.pronouns ? ` (${store.cvProfile.pronouns})` : ''}</h2>
                  <p class="text-mu text-sm">{store.cvProfile.location} · {store.cvProfile.email}{store.cvProfile.orcid ? ` · ORCID: ${store.cvProfile.orcid}` : ''}</p>
                </div>
                {#if store.cvProfile.summary}<p class="cv-summary">{store.cvProfile.summary}</p>{/if}
                {#if store.cvProfile.experience.length}
                  <div class="cv-sec"><h3>Experience</h3>
                    {#each store.cvProfile.experience as e}
                      <div class="cv-exp-item">
                        <div class="cv-exp-head"><strong>{e.role}</strong> — {e.organisation}, {e.location}</div>
                        <div class="text-xs text-mu">{e.startDate} – {e.endDate || 'Present'}</div>
                        {#each e.bullets.filter(b => b.trim()) as b}<div class="cv-bullet">· {b}</div>{/each}
                      </div>
                    {/each}
                  </div>
                {/if}
                {#if store.cvProfile.publications.length}
                  <div class="cv-sec"><h3>Publications</h3>
                    {#each store.cvProfile.publications as p}
                      <div class="cv-pub-item" class:highlight={p.highlight}>
                        {p.authors} ({p.year}). <strong>{p.title}</strong>. <em>{p.journal}</em>
                        {#if p.doi}<a href="https://doi.org/{p.doi}" target="_blank" rel="noreferrer" class="doi-link">DOI</a>{/if}
                      </div>
                    {/each}
                  </div>
                {/if}
                {#if store.cvProfile.skillGroups.length}
                  <div class="cv-sec"><h3>Skills</h3>
                    {#each store.cvProfile.skillGroups as g}<div class="text-sm"><strong>{g.category}:</strong> {g.skills.join(', ')}</div>{/each}
                  </div>
                {/if}
                {#if store.cvProfile.conferences.length}
                  <div class="cv-sec"><h3>Conferences</h3>
                    {#each store.cvProfile.conferences as c}<div class="text-sm">{c.year} · <strong>{c.title}</strong> ({c.type}) — {c.event}, {c.location}</div>{/each}
                  </div>
                {/if}
                {#if store.cvProfile.awards.length}
                  <div class="cv-sec"><h3>Awards</h3>
                    {#each store.cvProfile.awards as a}<div class="text-sm">{a.year} · <strong>{a.title}</strong> — {a.issuer}</div>{/each}
                  </div>
                {/if}
                {#if store.cvProfile.languages.length}<div class="cv-sec"><h3>Languages</h3><p class="text-sm">{store.cvProfile.languages.join(', ')}</p></div>{/if}
              </div>
            {/if}
          </div>
        </div>

      <!-- ── COVER LETTERS ────────────────────────────────────────────────────────── -->
      {:else if tab === 'coverletter'}
        <div class="cl-view">
          {#if clView === 'list'}
            <div class="cl-list-header">
              <h3>Cover Letters ({store.coverLetters.length})</h3>
              <button class="btn btn-primary btn-sm" onclick={() => { clView = 'compose'; clContent = ''; clSelectedJobId = ''; clJobTitle = ''; clCompany = ''; clJobDesc = ''; }}>+ New</button>
            </div>
            {#each store.coverLetters as letter (letter.id)}
              <div class="cl-card">
                <div class="cl-card-head">
                  <div>
                    <div class="cl-role">{letter.role}</div>
                    <div class="text-xs text-mu">{letter.company} · {fmtDate(letter.generatedAt)}</div>
                  </div>
                  <div class="cl-card-actions">
                    <button class="btn btn-ghost btn-xs" onclick={() => { clSelectedLetter = letter; clView = 'view'; }}>View</button>
                    <button class="btn btn-ghost btn-xs" onclick={() => exportLetter(letter)}>Export</button>
                    <button class="btn-icon danger-icon" onclick={() => deleteLetter(letter.id)} title="Delete">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6m5 0V4h4v2"/></svg>
                    </button>
                  </div>
                </div>
                <p class="cl-preview text-sm text-mu">{letter.content.replace(/[#*_]/g, '').slice(0, 180)}…</p>
              </div>
            {:else}
              <div class="empty-state">
                <p class="text-mu text-sm">No cover letters yet. Click "New" to generate one with Enzo.</p>
              </div>
            {/each}

          {:else if clView === 'compose'}
            <div class="cl-compose">
              <button class="btn btn-ghost btn-sm back-btn" onclick={() => clView = 'list'}>← Back</button>
              <h3>Generate Cover Letter</h3>
              <div class="field-grid">
                <div class="field">
                  <label>Link to tracked job (optional)</label>
                  <select bind:value={clSelectedJobId}>
                    <option value="">— Standalone —</option>
                    {#each store.savedJobs as j}<option value={j.id}>{j.listing.title} @ {j.listing.company}</option>{/each}
                  </select>
                </div>
                <div class="field"><label>Job title</label><input bind:value={clJobTitle} placeholder="Senior Scientist" /></div>
                <div class="field"><label>Company</label><input bind:value={clCompany} placeholder="AstraZeneca" /></div>
                <div class="field full"><label>Job description (paste relevant excerpt)</label>
                  <textarea rows={5} bind:value={clJobDesc} placeholder="Paste the job description here…"></textarea>
                </div>
              </div>
              <div class="cl-cv-hint">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2"/>
                  <rect x="8" y="2" width="8" height="4" rx="1" ry="1"/>
                </svg>
                {#if store.cvProfile.experience.length > 0 || store.cvProfile.publications.length > 0}
                  CV data loaded — {store.cvProfile.experience.length} roles, {store.cvProfile.publications.length} publications
                {:else}
                  No CV data yet — <button class="text-link" onclick={() => tab = 'cv'}>fill in the CV builder</button> to improve letter quality
                {/if}
              </div>
              <div class="cl-generate-row">
                {#if !store.aiSettings.coverLetter}
                  <p class="text-xs text-mu">Enable "Cover letter generator" in <button class="text-link" onclick={() => store.view = 'settings'}>Settings → AI features</button>.</p>
                {/if}
                <button class="btn btn-primary" onclick={generateLetter} disabled={clGenerating || !clJobTitle || !clCompany || !store.aiSettings.coverLetter}>
                  {clGenerating ? 'Writing…' : 'Generate cover letter'}
                </button>
                {#if clGenerating}
                  <button class="btn btn-ghost btn-sm" onclick={() => clAbort?.abort()}>Stop</button>
                {/if}
                {#if store.coverLetters.length > 0}
                  <span class="text-xs text-mu">Will reference {Math.min(2, store.coverLetters.length)} previous letter{store.coverLetters.length > 1 ? 's' : ''} to avoid repetition</span>
                {/if}
              </div>
              {#if clContent}
                <div class="field full">
                  <label>Generated cover letter — edit before saving</label>
                  {#if clGenerating}
                    <div class="cl-stream-box">{clContent}</div>
                  {:else}
                    <RichEditor bind:value={clContent} placeholder="Cover letter content…" minHeight="360px" />
                  {/if}
                </div>
                <div class="cl-save-row">
                  <button class="btn btn-ghost btn-sm" onclick={() => { const b = new Blob([clContent], {type:'text/markdown'}); const u = URL.createObjectURL(b); const a = document.createElement('a'); a.href=u; a.download='cover-letter.md'; a.click(); URL.revokeObjectURL(u); }}>Export .md</button>
                  <button class="btn btn-ghost btn-sm" onclick={() => exportCoverLetterDocx(clContent, clCompany)}>Export .doc</button>
                  <button class="btn btn-ghost btn-sm" onclick={() => exportCoverLetterPdf(clContent, clCompany)}>Print / PDF</button>
                  <button class="btn btn-primary btn-sm" onclick={saveCoverLetter} disabled={clSaving}>{clSaving ? 'Saving…' : 'Save'}</button>
                </div>
              {/if}
            </div>

          {:else if clView === 'view' && clSelectedLetter}
            <div class="cl-view-letter">
              <div class="cl-view-head">
                <button class="btn btn-ghost btn-sm back-btn" onclick={() => clView = 'list'}>← Back</button>
                <div>
                  <h3>{clSelectedLetter.role}</h3>
                  <p class="text-xs text-mu">{clSelectedLetter.company} · {fmtDate(clSelectedLetter.generatedAt)}</p>
                </div>
                <button class="btn btn-ghost btn-sm" onclick={() => exportLetter(clSelectedLetter!)}>Export</button>
              </div>
              <RichEditor
                bind:value={clSelectedLetter.content}
                onchange={async () => { clSelectedLetter!.editedAt = Date.now(); await store.saveCoverLetters(); showToast('Saved'); }}
                placeholder="Cover letter content…"
                minHeight="400px"
              />
            </div>
          {/if}
        </div>

      <!-- ── CONTACTS / NETWORK ──────────────────────────────────────────────────── -->
      {:else if tab === 'contacts'}
        <div class="contacts-view">
          <div class="contacts-header">
            <input class="search-input" type="search" bind:value={contactSearch} placeholder="Search contacts…" />
            <button class="btn btn-primary btn-sm" onclick={startNewContact}>+ Add contact</button>
          </div>

          {#if editingContactId}
            <div class="contact-form card">
              <h3>{editingContactId === 'new' ? 'New Contact' : 'Edit Contact'}</h3>
              <div class="field-grid">
                <div class="field"><label for="cd-nm">Name</label><input id="cd-nm" bind:value={contactDraft.name} /></div>
                <div class="field"><label for="cd-ro">Role</label><input id="cd-ro" bind:value={contactDraft.role} /></div>
                <div class="field"><label for="cd-co">Company</label><input id="cd-co" bind:value={contactDraft.company} /></div>
                <div class="field"><label for="cd-em">Email</label><input id="cd-em" type="email" bind:value={contactDraft.email} /></div>
                <div class="field"><label for="cd-li">LinkedIn</label><input id="cd-li" bind:value={contactDraft.linkedin} /></div>
                <div class="field"><label for="cd-mt">Met at</label><input id="cd-mt" bind:value={contactDraft.metAt} placeholder="ESMO 2025, cold email…" /></div>
                <div class="field full"><label for="cd-no">Notes</label><textarea id="cd-no" rows={2} bind:value={contactDraft.notes} placeholder="Key info, follow-up actions…"></textarea></div>
              </div>
              <div class="form-actions">
                <button class="btn btn-ghost btn-sm" onclick={() => editingContactId = null}>Cancel</button>
                <button class="btn btn-primary btn-sm" onclick={saveContact}>Save</button>
              </div>
            </div>
          {/if}

          <div class="contact-list">
            {#each displayContacts as c (c.id)}
              <div class="contact-card card">
                <div class="contact-head">
                  <div>
                    <div class="contact-name">{c.name}</div>
                    <div class="text-xs text-mu">{c.role}{c.company ? ` · ${c.company}` : ''}</div>
                  </div>
                  <div class="contact-actions">
                    {#if c.email}<a class="btn btn-ghost btn-xs" href="mailto:{c.email}">Email</a>{/if}
                    {#if c.linkedin}<a class="btn btn-ghost btn-xs" href={c.linkedin} target="_blank" rel="noreferrer">LinkedIn</a>{/if}
                    <button class="btn-icon danger-icon" onclick={() => deleteContact(c.id)} title="Delete">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6m5 0V4h4v2"/></svg>
                    </button>
                  </div>
                </div>
                {#if c.metAt}<p class="text-xs text-mu">Met at: {c.metAt}</p>{/if}
                {#if c.notes}<p class="text-sm text-mu contact-notes">{c.notes}</p>{/if}
              </div>
            {:else}
              <div class="empty-state">
                <p class="text-mu text-sm">No contacts yet. Log people you meet at conferences, companies you've emailed, referees.</p>
              </div>
            {/each}
          </div>
        </div>

      <!-- ── SALARY ──────────────────────────────────────────────────────────────── -->
      {:else if tab === 'salary'}
        <div class="salary-view">
          <div class="salary-header">
            <h3>Salary Benchmark Database</h3>
            <button class="btn btn-primary btn-sm" onclick={() => addingSalary = !addingSalary}>+ Add entry</button>
          </div>

          {#if addingSalary}
            <div class="salary-form card">
              <div class="field-grid">
                <div class="field"><label for="sd-co">Company</label><input id="sd-co" bind:value={salaryDraft.company} /></div>
                <div class="field"><label for="sd-ro">Role</label><input id="sd-ro" bind:value={salaryDraft.role} /></div>
                <div class="field"><label for="sd-rg">Region / City</label><input id="sd-rg" bind:value={salaryDraft.region} /></div>
                <div class="field"><label for="sd-mn">Min salary</label><input id="sd-mn" type="number" bind:value={salaryDraft.salaryMin} /></div>
                <div class="field"><label for="sd-mx">Max salary</label><input id="sd-mx" type="number" bind:value={salaryDraft.salaryMax} /></div>
                <div class="field"><label for="sd-cu">Currency</label>
                  <select id="sd-cu" bind:value={salaryDraft.currency}>
                    {#each ['EUR','GBP','INR','USD','CHF'] as c}<option value={c}>{c}</option>{/each}
                  </select>
                </div>
                <div class="field"><label for="sd-sr">Source</label>
                  <select id="sd-sr" bind:value={salaryDraft.type}>
                    <option value="estimate">Estimate</option>
                    <option value="offer">Actual offer</option>
                    <option value="glassdoor">Glassdoor</option>
                    <option value="linkedin">LinkedIn</option>
                  </select>
                </div>
                <div class="field"><label for="sd-yr">Year</label><input id="sd-yr" type="number" bind:value={salaryDraft.year} /></div>
                <div class="field full"><label for="sd-no">Notes</label><input id="sd-no" bind:value={salaryDraft.notes} /></div>
              </div>
              <div class="form-actions">
                <button class="btn btn-ghost btn-sm" onclick={() => addingSalary = false}>Cancel</button>
                <button class="btn btn-primary btn-sm" onclick={addSalary}>Add</button>
              </div>
            </div>
          {/if}

          <div class="salary-list">
            {#each displaySalaries as s (s.id)}
              <div class="salary-card" class:example-card={s.id.startsWith('_')}>
                {#if s.id.startsWith('_')}<span class="example-label">· example</span>{/if}
                <div class="salary-head">
                  <div>
                    <div class="salary-role">{s.role}</div>
                    <div class="text-xs text-mu">{s.company} · {s.region} · {s.year}</div>
                  </div>
                  <div class="salary-range">
                    <span class="salary-num">{s.currency} {s.salaryMin.toLocaleString()} – {s.salaryMax.toLocaleString()}</span>
                    <span class="tag source-tag">{s.type}</span>
                  </div>
                  {#if !s.id.startsWith('_')}
                    <button class="btn-icon danger-icon" onclick={() => deleteSalary(s.id)} title="Remove">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6m5 0V4h4v2"/></svg>
                    </button>
                  {/if}
                </div>
                {#if s.notes}<p class="text-xs text-mu">{s.notes}</p>{/if}
              </div>
            {/each}
          </div>
        </div>

      <!-- ── ANALYTICS ──────────────────────────────────────────────────────────── -->
      {:else if tab === 'analytics'}
        {@const a = analytics()}
        <div class="analytics-view">
          <h3>Application Analytics</h3>
          {#if store.savedJobs.length === 0}
            <div class="empty-state"><p class="text-mu text-sm">Track some jobs first — analytics will appear here.</p></div>
          {:else}
            <div class="analytics-grid">
              <div class="stat-box"><span class="stat-num">{a.total}</span><span class="stat-lbl">Jobs tracked</span></div>
              <div class="stat-box"><span class="stat-num">{a.applied}</span><span class="stat-lbl">Applied</span></div>
              <div class="stat-box"><span class="stat-num">{a.withInterviews}</span><span class="stat-lbl">With interviews</span></div>
              <div class="stat-box"><span class="stat-num">{a.conversionRate}%</span><span class="stat-lbl">Applied → interview rate</span></div>
            </div>
            <div class="analytics-section">
              <h4>By stage</h4>
              {#each PIPELINE_STAGES as s}
                {@const count = a.byStatus[s.id] ?? 0}
                {#if count > 0}
                  <div class="bar-row">
                    <span class="bar-label">{s.label}</span>
                    <div class="bar-track"><div class="bar-fill" style="width: {Math.round((count/a.total)*100)}%; background: var(--{stageColor(s.id as JobStatus)})"></div></div>
                    <span class="bar-count">{count}</span>
                  </div>
                {/if}
              {/each}
            </div>
            <div class="analytics-row">
              <div class="analytics-section">
                <h4>By region</h4>
                {#each Object.entries(a.byRegion) as [r, n]}
                  <div class="bar-row"><span class="bar-label">{REGION_LABELS[r] ?? r}</span><div class="bar-track"><div class="bar-fill" style="width: {Math.round((n/a.total)*100)}%"></div></div><span class="bar-count">{n}</span></div>
                {/each}
              </div>
              <div class="analytics-section">
                <h4>By type</h4>
                {#each Object.entries(a.byType) as [t, n]}
                  <div class="bar-row"><span class="bar-label">{TYPE_LABELS[t] ?? t}</span><div class="bar-track"><div class="bar-fill" style="width: {Math.round((n/a.total)*100)}%"></div></div><span class="bar-count">{n}</span></div>
                {/each}
              </div>
            </div>
          {/if}
        </div>
      {/if}

    </div>
  </div>
{/if}

<style>
  /* ── Landing ── */
  .landing {
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
  }
  .landing-inner {
    max-width: 520px;
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
    text-align: center;
  }
  .landing-icon {
    width: 72px; height: 72px;
    border-radius: 20px;
    background: var(--ac-bg);
    border: 1px solid var(--ac);
    display: flex; align-items: center; justify-content: center;
    color: var(--ac);
  }
  .landing-inner h2 { font-size: 1.4rem; font-weight: 700; }
  .landing-desc { font-size: 0.9rem; color: var(--tx2); line-height: 1.6; }
  .landing-features {
    display: flex; flex-direction: column; gap: 8px; width: 100%; text-align: left;
    background: var(--sf); border: 1px solid var(--bd); border-radius: var(--radius); padding: 16px;
  }
  .landing-feature { display: flex; align-items: center; gap: 8px; font-size: 0.875rem; color: var(--tx2); }
  .btn-lg { padding: 12px 32px; font-size: 1rem; }
  .landing-note { margin-top: 4px; }

  /* ── Shell ── */
  .jobs-view {
    height: 100%;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  /* ── Tab bar ── */
  .tab-bar {
    display: flex;
    gap: 2px;
    padding: 10px 16px 0;
    border-bottom: 1px solid var(--bd);
    background: var(--sf);
    flex-shrink: 0;
    overflow-x: auto;
    scrollbar-width: none;
  }
  .tab-bar::-webkit-scrollbar { display: none; }
  .tab-btn {
    padding: 6px 14px;
    border-radius: 6px 6px 0 0;
    font-size: 0.8rem;
    font-weight: 500;
    color: var(--tx2);
    background: transparent;
    border: 1px solid transparent;
    border-bottom: none;
    white-space: nowrap;
    cursor: pointer;
    transition: color var(--transition), background var(--transition);
    display: flex; align-items: center; gap: 5px;
  }
  .tab-btn:hover { color: var(--tx); background: var(--sf2); }
  .tab-btn.active { color: var(--ac); background: var(--bg); border-color: var(--bd); position: relative; top: 1px; }
  .tab-badge { background: var(--ac); color: #fff; font-size: 0.6rem; font-weight: 700; padding: 1px 5px; border-radius: 8px; }

  .tab-content { flex: 1; overflow-y: auto; padding: 20px; }

  /* ── Feed ── */
  .feed-view { display: flex; flex-direction: column; gap: 14px; }
  .feed-controls {
    display: flex; gap: 8px; flex-wrap: wrap; align-items: center;
  }
  .search-input { flex: 1; min-width: 160px; }
  .feed-notice { padding: 8px 12px; background: var(--sf2); border-radius: var(--radius-sm); border: 1px solid var(--bd); }
  .job-list { display: flex; flex-direction: column; gap: 12px; }
  .job-card {
    background: var(--sf); border: 1px solid var(--bd); border-radius: var(--radius);
    padding: 14px 16px; display: flex; flex-direction: column; gap: 8px; position: relative;
  }
  .job-card:hover { border-color: var(--bd2); }
  .job-head { display: flex; flex-direction: column; gap: 4px; }
  .job-title-row { display: flex; align-items: flex-start; gap: 6px; flex-wrap: wrap; }
  .job-title { font-size: 0.95rem; font-weight: 600; flex: 1; min-width: 0; }
  .job-meta { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; font-size: 0.8rem; }
  .company-name { font-weight: 600; color: var(--tx2); }
  .separator { color: var(--bd2); }
  .deadline-badge { background: var(--rd-bg); color: var(--rd); border-radius: 4px; padding: 1px 6px; font-size: 0.72rem; font-weight: 600; }
  .source-tag { font-style: italic; }
  .job-desc { line-height: 1.6; }
  .tag-row { display: flex; flex-wrap: wrap; gap: 4px; }
  .job-actions { display: flex; gap: 8px; }
  .type-industry { background: var(--ac-bg); color: var(--ac); border: 1px solid var(--ac); }
  .type-academic { background: var(--pu-bg, rgba(188,140,255,.12)); color: var(--pu); border: 1px solid var(--pu); }
  .type-fellowship { background: var(--gn-bg); color: var(--gn); border: 1px solid var(--gn); }
  .type-startup { background: var(--yw-bg, rgba(255,200,0,.1)); color: var(--yw); border: 1px solid var(--yw); }
  .region-tag { background: var(--sf2); border: 1px solid var(--bd); color: var(--mu); }

  /* ── Tracker ── */
  .tracker-view { display: flex; flex-direction: column; gap: 14px; }
  .tracker-header { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .stage-pills { display: flex; gap: 4px; flex-wrap: wrap; }
  .stage-pill {
    padding: 4px 10px; border-radius: 20px; font-size: 0.75rem; font-weight: 500;
    background: var(--sf); border: 1px solid var(--bd); color: var(--tx2); cursor: pointer;
    display: flex; align-items: center; gap: 5px;
  }
  .stage-pill:hover { border-color: var(--bd2); }
  .stage-pill.active { background: var(--ac-bg); color: var(--ac); border-color: var(--ac); }
  .stage-count { background: var(--sf2); border-radius: 10px; padding: 0 5px; font-size: 0.65rem; }
  .tracker-list { display: flex; flex-direction: column; gap: 6px; }
  .tracker-card {
    background: var(--sf); border: 1px solid var(--bd); border-radius: var(--radius);
    overflow: hidden; position: relative;
  }
  .tracker-card.expanded { border-color: var(--ac); }
  .tracker-row {
    display: flex; align-items: center; justify-content: space-between;
    padding: 12px 14px; gap: 10px; cursor: pointer;
  }
  .tracker-row:hover { background: var(--sf2); }
  .tracker-main { display: flex; align-items: center; gap: 10px; flex: 1; min-width: 0; }
  .stage-dot { width: 9px; height: 9px; border-radius: 50%; flex-shrink: 0; }
  .tracker-info { min-width: 0; }
  .tracker-title { font-size: 0.875rem; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .tracker-sub { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .tracker-right { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
  .stage-badge {
    font-size: 0.68rem; font-weight: 700; padding: 2px 8px; border-radius: 20px;
    text-transform: uppercase; letter-spacing: 0.04em;
    background: var(--sf2); color: var(--mu); border: 1px solid var(--bd);
  }
  .stage-applied    { background: var(--ac-bg); color: var(--ac); border-color: var(--ac); }
  .stage-screening  { background: var(--yw-bg, rgba(255,200,0,.1)); color: var(--yw); border-color: var(--yw); }
  .stage-interviewing { background: var(--pu-bg, rgba(188,140,255,.1)); color: var(--pu); border-color: var(--pu); }
  .stage-offer      { background: var(--gn-bg); color: var(--gn); border-color: var(--gn); }
  .tracker-expand {
    border-top: 1px solid var(--bd); padding: 14px; display: flex; flex-direction: column; gap: 14px;
  }
  .expand-section { display: flex; flex-direction: column; gap: 6px; }
  .expand-head { display: flex; align-items: center; justify-content: space-between; }
  .stage-select { display: flex; flex-wrap: wrap; gap: 4px; }
  .stage-move-btn {
    padding: 4px 10px; border-radius: 20px; font-size: 0.72rem; font-weight: 500;
    background: var(--sf2); border: 1px solid var(--bd); cursor: pointer;
  }
  .stage-move-btn:hover { border-color: var(--ac); }
  .stage-move-btn.active { background: var(--ac-bg); color: var(--ac); border-color: var(--ac); }
  .interview-form { display: flex; flex-direction: column; gap: 6px; padding: 10px; background: var(--sf2); border-radius: var(--radius-sm); }
  .interview-row { display: flex; flex-direction: column; gap: 4px; padding: 8px; background: var(--sf2); border-radius: var(--radius-sm); border: 1px solid var(--bd); }
  .iv-notes, .iv-outcome { margin: 0; font-size: 0.82rem; }
  .iv-outcome { color: var(--gn); }
  .job-notes-text { padding: 6px 8px; background: var(--sf2); border-radius: var(--radius-sm); }

  .prep-btn { color: var(--enzo, #a855f7); }
  .prep-btn:hover, .prep-active { background: var(--enzo-bg, rgba(168,85,247,0.12)); }
  .enzo-dot-tiny { display: inline-block; width: 5px; height: 5px; border-radius: 50%; background: var(--enzo, #a855f7); margin-right: 3px; vertical-align: middle; }
  .prep-panel {
    margin-top: 8px;
    background: var(--enzo-bg, rgba(168,85,247,0.06));
    border: 1px solid rgba(168,85,247,0.2);
    border-radius: var(--radius-sm);
    padding: 10px 12px;
  }
  .prep-body { color: var(--tx); }
  .prep-footer { display: flex; gap: 12px; justify-content: flex-end; margin-top: 8px; border-top: 1px solid var(--bd); padding-top: 6px; }
  .spinner-xs-inline { display: inline-block; width: 10px; height: 10px; border: 1.5px solid var(--bd2); border-top-color: var(--enzo, #a855f7); border-radius: 50%; animation: spin 0.7s linear infinite; }

  /* ── Companies ── */
  .companies-view { display: flex; flex-direction: column; gap: 24px; }
  .region-heading { font-size: 0.82rem; font-weight: 700; color: var(--mu); text-transform: uppercase; letter-spacing: 0.07em; margin-bottom: 10px; }
  .company-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 10px; }
  .company-card {
    background: var(--sf); border: 1px solid var(--bd); border-radius: var(--radius);
    padding: 12px 14px; display: flex; flex-direction: column; gap: 6px;
  }
  .company-card:hover { border-color: var(--bd2); }
  .co-head { display: flex; align-items: center; justify-content: space-between; gap: 6px; }
  .co-name { font-size: 0.875rem; font-weight: 600; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .co-loc { min-height: 14px; }
  .co-tags { display: flex; flex-wrap: wrap; gap: 3px; }
  .co-tag-btn {
    cursor: pointer;
    border: 1px solid var(--bd);
    background: var(--sf2);
    color: var(--tx2);
    transition: all var(--transition);
    font-family: var(--font);
  }
  .co-tag-btn:hover { border-color: var(--ac); color: var(--ac); background: var(--ac-bg); }
  .co-tag-btn.active-tag { border-color: var(--ac); color: var(--ac); background: var(--ac-bg); font-weight: 700; }
  .co-count { font-size: 0.72rem; font-weight: 400; }
  .co-filter-bar {
    display: flex; flex-wrap: wrap; align-items: center; gap: 6px;
    background: var(--sf2); border: 1px solid var(--bd); border-radius: var(--radius-sm);
    padding: 10px 12px;
  }
  .co-filter-tags { display: flex; flex-wrap: wrap; gap: 4px; flex: 1; }
  .co-filter-tag {
    padding: 2px 9px; border-radius: 20px; font-size: 0.72rem; font-weight: 500;
    border: 1px solid var(--bd); background: var(--sf); color: var(--tx2);
    cursor: pointer; transition: all var(--transition);
  }
  .co-filter-tag:hover { border-color: var(--ac); color: var(--ac); background: var(--ac-bg); }
  .co-filter-tag.active { border-color: var(--ac); color: var(--ac); background: var(--ac-bg); font-weight: 700; }
  .co-filter-clear {
    padding: 2px 9px; border-radius: 20px; font-size: 0.72rem; font-weight: 600;
    border: 1px solid var(--rd); background: var(--rd-bg); color: var(--rd);
    cursor: pointer; flex-shrink: 0;
  }
  .text-link { background: none; border: none; color: var(--ac); cursor: pointer; font-size: inherit; padding: 0; text-decoration: underline; }
  .co-link { margin-top: 2px; align-self: flex-start; }
  .tier-badge { font-size: 0.62rem; font-weight: 700; padding: 2px 6px; border-radius: 8px; text-transform: uppercase; flex-shrink: 0; }
  .tier-large    { background: var(--ac-bg); color: var(--ac); }
  .tier-mid      { background: var(--gn-bg); color: var(--gn); }
  .tier-research { background: var(--pu-bg, rgba(188,140,255,.12)); color: var(--pu); }

  /* ── CV ── */
  .cv-view { display: flex; flex-direction: column; height: 100%; overflow: hidden; }
  .cv-header { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; padding-bottom: 12px; border-bottom: 1px solid var(--bd); margin-bottom: 16px; }
  .cv-tabs { display: flex; gap: 4px; flex-wrap: wrap; flex: 1; }
  .cv-tab {
    padding: 5px 12px; border-radius: var(--radius-sm); font-size: 0.78rem; font-weight: 500;
    background: var(--sf2); border: 1px solid var(--bd); color: var(--tx2); cursor: pointer;
  }
  .cv-tab:hover { border-color: var(--bd2); }
  .cv-tab.active { background: var(--ac-bg); color: var(--ac); border-color: var(--ac); }
  .cv-actions { display: flex; gap: 6px; flex-shrink: 0; }
  .cv-content { flex: 1; overflow-y: auto; }
  .cv-section { display: flex; flex-direction: column; gap: 16px; }
  .cv-section-title { font-size: 1rem; font-weight: 700; margin: 0; }
  .section-head { display: flex; align-items: center; justify-content: space-between; }
  .field-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .field { display: flex; flex-direction: column; gap: 5px; }
  .field.full { grid-column: 1 / -1; }
  .field-row { display: flex; gap: 10px; grid-column: 1 / -1; }
  .field-row .field { flex: 1; }
  .field label { font-size: 0.78rem; font-weight: 500; color: var(--tx2); }
  .checkbox-field { flex-direction: row; align-items: center; padding-top: 18px; }
  .checkbox-field label { display: flex; align-items: center; gap: 6px; cursor: pointer; }
  .bullet-input { margin-bottom: 4px; }
  .bullet-actions { display: flex; gap: 6px; align-items: center; margin-top: 4px; }
  .writer-improve-btn { color: var(--enzo); border-color: var(--enzo-bd); }
  .writer-improve-btn:hover:not(:disabled) { background: var(--enzo-bg); }
  .writer-w-badge {
    display: inline-flex; align-items: center; justify-content: center;
    width: 14px; height: 14px; border-radius: 3px;
    background: var(--enzo); color: white;
    font-size: 0.6rem; font-weight: 800; font-family: var(--mono);
    flex-shrink: 0;
  }
  .spinner-xs-inline {
    width: 10px; height: 10px;
    border: 1.5px solid var(--bd2);
    border-top-color: var(--enzo);
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
    display: inline-block;
    vertical-align: -1px;
    flex-shrink: 0;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
  .writer-panel {
    grid-column: 1 / -1;
    background: var(--enzo-bg);
    border: 1px solid var(--enzo-bd);
    border-radius: var(--radius-sm);
    padding: 12px;
    display: flex; flex-direction: column; gap: 8px;
    margin-top: 8px;
  }
  .writer-panel-head { display: flex; align-items: center; justify-content: space-between; }
  .writer-panel-label { font-size: 0.68rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em; color: var(--enzo); }
  .writer-preview {
    font-family: var(--font); font-size: 0.82rem; line-height: 1.7;
    color: var(--tx); white-space: pre-wrap; word-wrap: break-word;
    background: transparent; border: none; margin: 0; padding: 0;
  }
  .writer-actions { display: flex; gap: 8px; }
  .cv-item {
    background: var(--sf2); border: 1px solid var(--bd); border-radius: var(--radius);
    padding: 14px; position: relative;
  }
  .cv-item-remove {
    position: absolute; top: 10px; right: 10px;
    width: 22px; height: 22px; border-radius: 50%;
    background: var(--rd-bg); color: var(--rd); border: none; cursor: pointer;
    font-size: 14px; display: flex; align-items: center; justify-content: center;
    opacity: 0.6;
  }
  .cv-item-remove:hover { opacity: 1; }
  .empty-hint { padding: 20px 0; }
  .cv-example-hint { display: flex; flex-direction: column; gap: 8px; }
  .cv-item-example { opacity: 0.6; pointer-events: none; }
  .cv-item-example input { cursor: default; }

  /* CV Preview */
  .cv-preview { display: flex; flex-direction: column; gap: 20px; max-width: 640px; }
  .cv-preview-head { border-bottom: 2px solid var(--bd); padding-bottom: 12px; }
  .cv-preview-head h2 { font-size: 1.3rem; font-weight: 700; }
  .cv-summary { font-size: 0.9rem; color: var(--tx2); line-height: 1.6; }
  .cv-sec { display: flex; flex-direction: column; gap: 8px; }
  .cv-sec h3 { font-size: 0.75rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; color: var(--mu); border-bottom: 1px solid var(--bd); padding-bottom: 4px; }
  .cv-exp-item { display: flex; flex-direction: column; gap: 3px; padding: 6px 0; }
  .cv-exp-head { font-size: 0.875rem; }
  .cv-bullet { font-size: 0.82rem; color: var(--tx2); padding-left: 12px; }
  .cv-pub-item { font-size: 0.82rem; color: var(--tx2); line-height: 1.5; padding: 4px 0; }
  .cv-pub-item.highlight { color: var(--tx); }
  .doi-link { color: var(--ac); margin-left: 4px; font-size: 0.72rem; }

  /* ── Cover Letters ── */
  .cl-view { display: flex; flex-direction: column; gap: 14px; }
  .cl-list-header { display: flex; align-items: center; justify-content: space-between; }
  .cl-card {
    background: var(--sf); border: 1px solid var(--bd); border-radius: var(--radius);
    padding: 14px 16px; display: flex; flex-direction: column; gap: 8px;
  }
  .cl-card-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; }
  .cl-role { font-size: 0.875rem; font-weight: 600; }
  .cl-card-actions { display: flex; gap: 4px; flex-shrink: 0; }
  .cl-preview { line-height: 1.5; }
  .cl-compose { display: flex; flex-direction: column; gap: 14px; }
  .back-btn { align-self: flex-start; margin-bottom: 4px; }
  .cl-cv-hint {
    display: flex; align-items: center; gap: 6px;
    font-size: 0.78rem; color: var(--tx2);
    background: var(--sf2); border: 1px solid var(--bd);
    border-radius: var(--radius-sm); padding: 7px 12px;
  }
  .cl-cv-hint svg { color: var(--ac); flex-shrink: 0; }
  .cl-generate-row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
  .cl-textarea { font-family: var(--mono); font-size: 0.85rem; line-height: 1.7; width: 100%; box-sizing: border-box; }
  .cl-stream-box { font-family: var(--mono); font-size: 0.85rem; line-height: 1.7; white-space: pre-wrap; padding: 12px 14px; border: 1px solid var(--bd); border-radius: var(--radius-sm); background: var(--sf); min-height: 200px; color: var(--tx2); }
  .cl-save-row { display: flex; gap: 8px; justify-content: flex-end; }
  .cl-view-letter { display: flex; flex-direction: column; gap: 14px; }
  .cl-view-head { display: flex; align-items: flex-start; gap: 12px; }
  .cl-view-head > div { flex: 1; }

  /* ── Contacts ── */
  .contacts-view { display: flex; flex-direction: column; gap: 14px; }
  .contacts-header { display: flex; gap: 8px; align-items: center; }
  .contact-form { display: flex; flex-direction: column; gap: 12px; }
  .contact-list { display: flex; flex-direction: column; gap: 8px; }
  .contact-card { display: flex; flex-direction: column; gap: 6px; }
  .contact-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; }
  .contact-name { font-size: 0.875rem; font-weight: 600; }
  .contact-actions { display: flex; gap: 4px; flex-shrink: 0; }
  .contact-notes { margin-top: 2px; }
  .form-actions { display: flex; gap: 8px; justify-content: flex-end; }

  /* ── Salary ── */
  .salary-view { display: flex; flex-direction: column; gap: 14px; }
  .salary-header { display: flex; align-items: center; justify-content: space-between; }
  .salary-form { display: flex; flex-direction: column; gap: 12px; }
  .salary-list { display: flex; flex-direction: column; gap: 8px; }
  .salary-card {
    background: var(--sf); border: 1px solid var(--bd); border-radius: var(--radius);
    padding: 12px 14px; display: flex; flex-direction: column; gap: 6px; position: relative;
  }
  .salary-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
  .salary-role { font-size: 0.875rem; font-weight: 600; }
  .salary-range { display: flex; align-items: center; gap: 6px; }
  .salary-num { font-size: 0.9rem; font-weight: 700; font-variant-numeric: tabular-nums; color: var(--gn); }

  /* ── Analytics ── */
  .analytics-view { display: flex; flex-direction: column; gap: 20px; }
  .analytics-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
  .stat-box {
    background: var(--sf); border: 1px solid var(--bd); border-radius: var(--radius);
    padding: 14px 16px; display: flex; flex-direction: column; gap: 3px;
  }
  .stat-num { font-size: 1.7rem; font-weight: 700; letter-spacing: -0.02em; color: var(--tx); }
  .stat-lbl { font-size: 0.72rem; color: var(--mu); }
  .analytics-section { display: flex; flex-direction: column; gap: 7px; }
  .analytics-section h4 { font-size: 0.72rem; font-weight: 700; color: var(--mu); text-transform: uppercase; letter-spacing: 0.07em; }
  .analytics-row { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
  .bar-row { display: flex; align-items: center; gap: 8px; }
  .bar-label { font-size: 0.78rem; color: var(--tx2); min-width: 80px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex-shrink: 0; }
  .bar-track { flex: 1; height: 6px; background: var(--sf2); border-radius: 3px; overflow: hidden; }
  .bar-fill { height: 100%; background: var(--ac); border-radius: 3px; transition: width 0.4s ease; }
  .bar-count { font-size: 0.72rem; color: var(--mu); width: 18px; text-align: right; flex-shrink: 0; }

  /* ── Shared ── */
  .example-card { opacity: 0.6; }
  .example-label { font-size: 0.65rem; font-weight: 700; color: var(--mu); letter-spacing: 0.06em; text-transform: uppercase; }
  .danger-icon { color: var(--mu); }
  .danger-icon:hover { color: var(--rd); background: var(--rd-bg); }
  .empty-state { padding: 40px 20px; text-align: center; }
  .field-label { font-size: 0.78rem; font-weight: 600; color: var(--tx2); }
  .btn-xs { padding: 3px 8px; font-size: 0.72rem; }

  /* Modal */
  .modal-backdrop {
    position: fixed; inset: 0; background: rgba(0,0,0,0.5);
    display: flex; align-items: center; justify-content: center; z-index: 200;
    padding: 20px;
  }
  .modal {
    background: var(--sf); border: 1px solid var(--bd); border-radius: var(--radius);
    padding: 20px; width: 100%; max-width: 480px;
    display: flex; flex-direction: column; gap: 12px;
    box-shadow: var(--shadow-lg);
  }
  .modal-head { display: flex; align-items: center; justify-content: space-between; }
  .modal-head h3 { font-size: 0.95rem; font-weight: 700; }
  .modal-textarea { font-family: var(--mono); font-size: 0.875rem; }
  .modal-actions { display: flex; gap: 8px; justify-content: flex-end; }

  /* ── Mobile responsive ── */
  @media (max-width: 640px) {
    .tab-content { padding: 14px; }
    .field-grid { grid-template-columns: 1fr; }
    .analytics-grid { grid-template-columns: 1fr 1fr; }
    .analytics-row { grid-template-columns: 1fr; }
    .company-grid { grid-template-columns: 1fr; }
    .feed-controls { flex-direction: column; align-items: stretch; }
    .search-input { min-width: unset; }
    .cl-view-head { flex-direction: column; }
    .cv-tabs { gap: 3px; }
    .cv-tab { padding: 4px 8px; font-size: 0.72rem; }
  }
</style>
