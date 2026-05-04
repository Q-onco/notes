<script lang="ts">
  import { store } from '../lib/store.svelte';
  import { nanoid } from 'nanoid';
  import type { SavedJob, JobListing, JobStatus, JobRegion, JobType, InterviewRecord } from '../lib/types';
  import { fetchJobFeed, PIPELINE_STAGES, REGION_LABELS, TYPE_LABELS, EU_COMPANIES, INDIA_COMPANIES } from '../lib/jobs';

  let { showToast }: { showToast: (msg: string, type?: 'success' | 'error') => void } = $props();

  // ── Tab state ─────────────────────────────────────────────────────
  let tab = $state<'feed' | 'tracker' | 'companies' | 'profile'>('feed');

  // ── Feed state ────────────────────────────────────────────────────
  let feedJobs = $state<JobListing[]>([]);
  let feedLoading = $state(false);
  let feedError = $state('');
  let feedSearch = $state('');
  let regionFilter = $state<'all' | JobRegion>('all');
  let typeFilter = $state<'all' | JobType>('all');

  const EXAMPLE_FEED: JobListing[] = [
    { id: '_jf1', title: 'Senior Scientist — Oncology Biomarkers', company: 'Merck KGaA', location: 'Darmstadt, Germany', region: 'eu', type: 'industry', description: 'Lead translational biomarker strategy for immuno-oncology pipeline. Requires expertise in HGSOC, spatial transcriptomics, and TME profiling. Heidelberg-area preferred.', url: 'https://www.merckgroup.com/en/careers.html', source: 'Example', postedAt: Date.now() - 259200000, deadline: null, tags: ['immuno-oncology', 'biomarkers', 'spatial'] },
    { id: '_jf2', title: 'Postdoctoral Researcher — Single-Cell Genomics', company: 'EMBL', location: 'Heidelberg, Germany', region: 'eu', type: 'academic', description: 'Join the Stegle/Huber group to develop computational methods for spatial single-cell data integration. Strong scRNA-seq and Python/R required.', url: 'https://www.embl.org/careers', source: 'Example', postedAt: Date.now() - 432000000, deadline: Date.now() + 1296000000, tags: ['scRNA-seq', 'spatial', 'bioinformatics'] },
    { id: '_jf3', title: 'Research Scientist — Translational Oncology', company: 'AstraZeneca', location: 'Cambridge, UK', region: 'uk', type: 'industry', description: 'Translational scientist for the ovarian cancer / PARP inhibitor franchise. Work on resistance mechanisms, patient stratification, and companion diagnostics.', url: 'https://careers.astrazeneca.com', source: 'Example', postedAt: Date.now() - 604800000, deadline: null, tags: ['ovarian cancer', 'PARP inhibitors', 'translational'] },
    { id: '_jf4', title: 'Scientist — Oncology Genomics', company: 'Biocon', location: 'Bengaluru, India', region: 'india', type: 'industry', description: 'Drive biomarker discovery for biosimilar trastuzumab and novel oncology biologics. Genomics, NGS, and bioinformatics expertise required.', url: 'https://biocon.com/careers', source: 'Example', postedAt: Date.now() - 864000000, deadline: null, tags: ['genomics', 'bioinformatics', 'biologics'] },
    { id: '_jf5', title: 'Group Leader — Gynaecological Oncology', company: 'DKFZ', location: 'Heidelberg, Germany', region: 'eu', type: 'academic', description: 'Independent group leader position in translational gynaecological oncology research. Excellent infrastructure for scRNA-seq and spatial transcriptomics.', url: 'https://www.dkfz.de/en/stellenangebote/', source: 'Example', postedAt: Date.now() - 1728000000, deadline: Date.now() + 2592000000, tags: ['ovarian cancer', 'scRNA-seq', 'spatial'] },
  ];

  async function fetchFeed() {
    feedLoading = true;
    feedError = '';
    try {
      feedJobs = await fetchJobFeed();
      if (feedJobs.length === 0) feedError = 'No jobs returned — feeds may be temporarily unavailable.';
    } catch (e) {
      feedError = (e as Error).message;
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
      listing: { ...listing, id: listing.id.startsWith('_') ? nanoid() : listing.id },
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
    showToast('Saved to Radar');
  }

  function askEnzoAboutJob(listing: JobListing) {
    const prompt = `I'm considering this job: "${listing.title}" at ${listing.company} (${listing.location}). It focuses on: ${listing.description.slice(0, 200)}. Given my profile in HGSOC, scRNA-seq, spatial transcriptomics, and PARPi resistance, how strong is my fit? What should I emphasise in my application?`;
    store.enzoSearchQuery = prompt;
    store.enzoOpen = true;
  }

  // ── Tracker state ─────────────────────────────────────────────────
  let addJobOpen = $state(false);
  let addForm = $state({ title: '', company: '', location: '', url: '', type: 'industry' as JobType, region: 'eu' as JobRegion, description: '', tags: '' });
  let expandedJobId = $state<string | null>(null);
  let editingNotesId = $state<string | null>(null);
  let notesDraft = $state('');

  const EXAMPLE_TRACKER: SavedJob[] = [
    { id: '_jt1', listing: { id: '_l1', title: 'Senior Scientist — Oncology', company: 'Roche', location: 'Basel, Switzerland', region: 'eu', type: 'industry', description: '', url: 'https://roche.com/careers', source: 'Manual', postedAt: null, deadline: null, tags: ['oncology'] }, status: 'screening', savedAt: Date.now() - 1296000000, appliedAt: Date.now() - 864000000, notes: 'Great alignment with TME work. HR contacted on May 2nd — phone screen scheduled.', nextAction: 'Phone screen with hiring manager', nextActionAt: Date.now() + 172800000, interviews: [] },
    { id: '_jt2', listing: { id: '_l2', title: 'Postdoctoral Researcher', company: 'EMBL Heidelberg', location: 'Heidelberg, Germany', region: 'eu', type: 'academic', description: '', url: 'https://embl.org/careers', source: 'Manual', postedAt: null, deadline: Date.now() + 864000000, tags: ['scRNA-seq'] }, status: 'applied', savedAt: Date.now() - 604800000, appliedAt: Date.now() - 259200000, notes: 'Applied via EMBL portal. Stegle group — perfect fit with spatial work.', nextAction: 'Wait for shortlist', nextActionAt: null, interviews: [] },
    { id: '_jt3', listing: { id: '_l3', title: 'R&D Scientist — Biosimilars', company: 'Biocon', location: 'Bengaluru, India', region: 'india', type: 'industry', description: '', url: 'https://biocon.com/careers', source: 'Manual', postedAt: null, deadline: null, tags: ['biologics'] }, status: 'radar', savedAt: Date.now() - 86400000, appliedAt: null, notes: '', nextAction: 'Tailor CV to biologics experience', nextActionAt: null, interviews: [] },
  ];

  const displayTracker = $derived(store.savedJobs.length > 0 ? store.savedJobs : EXAMPLE_TRACKER);

  function jobsByStatus(status: JobStatus) {
    return displayTracker.filter(j => j.status === status);
  }

  async function updateStatus(jobId: string, newStatus: JobStatus) {
    if (jobId.startsWith('_')) { showToast('Example data — save a real job first'); return; }
    const job = store.savedJobs.find(j => j.id === jobId);
    if (!job) return;
    job.status = newStatus;
    if (newStatus === 'applied' && !job.appliedAt) job.appliedAt = Date.now();
    await store.saveJobs();
    showToast(`Moved to ${newStatus}`);
  }

  async function deleteJob(jobId: string) {
    if (jobId.startsWith('_')) return;
    store.savedJobs = store.savedJobs.filter(j => j.id !== jobId);
    await store.saveJobs();
    showToast('Removed');
  }

  async function saveNotes(jobId: string) {
    if (jobId.startsWith('_')) return;
    const job = store.savedJobs.find(j => j.id === jobId);
    if (!job) return;
    job.notes = notesDraft;
    await store.saveJobs();
    editingNotesId = null;
    showToast('Notes saved');
  }

  function addManualJob() {
    if (!addForm.title.trim() || !addForm.company.trim()) return;
    const listing: JobListing = {
      id: nanoid(),
      title: addForm.title.trim(),
      company: addForm.company.trim(),
      location: addForm.location.trim() || addForm.region,
      region: addForm.region,
      type: addForm.type,
      description: addForm.description.trim(),
      url: addForm.url.trim() || '#',
      source: 'Manual',
      postedAt: Date.now(),
      deadline: null,
      tags: addForm.tags.split(',').map(t => t.trim()).filter(Boolean),
    };
    saveJobToTracker(listing);
    addForm = { title: '', company: '', location: '', url: '', type: 'industry', region: 'eu', description: '', tags: '' };
    addJobOpen = false;
  }

  function daysUntil(ts: number | null): string | null {
    if (!ts) return null;
    const d = Math.ceil((ts - Date.now()) / 86400000);
    if (d < 0) return 'Overdue';
    if (d === 0) return 'Today';
    if (d === 1) return '1 day';
    return `${d} days`;
  }

  function relTime(ts: number): string {
    const d = Math.ceil((Date.now() - ts) / 86400000);
    if (d === 0) return 'today';
    if (d === 1) return 'yesterday';
    return `${d}d ago`;
  }

  // ── Companies state ───────────────────────────────────────────────
  let coFilter = $state<'all' | 'eu' | 'india' | 'de'>('all');

  const filteredEU = $derived(
    EU_COMPANIES.filter(c => coFilter === 'all' || coFilter === 'eu' || (coFilter === 'de' && c.country === 'DE'))
  );
  const filteredIndia = $derived(
    INDIA_COMPANIES.filter(() => coFilter === 'all' || coFilter === 'india')
  );

  // ── Profile state ─────────────────────────────────────────────────
  let editingProfile = $state(false);
  let profileDraft = $state({ ...store.profile });
  let newSpec = $state('');
  let newRole = $state('');
  let newLoc = $state('');
  let newHL = $state('');
  let newPubTitle = $state('');
  let newPubDoi = $state('');
  let newPubYear = $state('');

  function startEditProfile() {
    profileDraft = { ...store.profile, specializations: [...store.profile.specializations], targetRoles: [...store.profile.targetRoles], targetLocations: [...store.profile.targetLocations], cvHighlights: [...store.profile.cvHighlights], publications: store.profile.publications.map(p => ({ ...p })) };
    editingProfile = true;
  }

  async function saveProfile() {
    store.profile = { ...profileDraft };
    await store.saveProfile();
    editingProfile = false;
    showToast('Profile saved');
  }

  function useProfileInEnzo() {
    const p = store.profile;
    const prompt = `My researcher profile:\n- Role: ${p.currentRole} at ${p.institution} (${p.department})\n- Expertise: ${p.specializations.join(', ')}\n- Target roles: ${p.targetRoles.join(', ')}\n- Target locations: ${p.targetLocations.join(', ')}\n${p.cvHighlights.length ? '- Highlights: ' + p.cvHighlights.join('; ') : ''}\n\nI'm exploring pharma/academic jobs in EU and India. What should my job search strategy be?`;
    store.enzoSearchQuery = prompt;
    store.enzoOpen = true;
  }
</script>

<div class="jobs">
  <!-- Header + tabs -->
  <div class="jobs-header">
    <div class="header-left">
      <h2>Jobs</h2>
      <p class="text-sm text-mu">EU & India pharma · academic · research</p>
    </div>
    <div class="header-tabs">
      {#each (['feed', 'tracker', 'companies', 'profile'] as const) as t}
        <button class="tab-btn" class:active={tab === t} onclick={() => tab = t}>
          {t === 'feed' ? 'Feed' : t === 'tracker' ? `Tracker${store.savedJobs.length > 0 ? ` (${store.savedJobs.length})` : ''}` : t === 'companies' ? 'Companies' : 'Profile'}
        </button>
      {/each}
    </div>
  </div>

  <!-- ── FEED ───────────────────────────────────────────────────── -->
  {#if tab === 'feed'}
    <div class="feed-toolbar">
      <input type="search" bind:value={feedSearch} placeholder="Search jobs, companies, tags…" class="feed-search" />
      <select bind:value={regionFilter} class="filter-sel">
        <option value="all">All regions</option>
        <option value="eu">Europe</option>
        <option value="india">India</option>
        <option value="uk">UK</option>
        <option value="remote">Remote</option>
      </select>
      <select bind:value={typeFilter} class="filter-sel">
        <option value="all">All types</option>
        <option value="industry">Industry</option>
        <option value="academic">Academic</option>
        <option value="fellowship">Fellowship</option>
        <option value="startup">Startup</option>
        <option value="contract">Contract</option>
      </select>
      <button class="btn btn-primary btn-sm" onclick={fetchFeed} disabled={feedLoading}>
        {#if feedLoading}
          <span class="spin"></span> Loading…
        {:else}
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
          Refresh feed
        {/if}
      </button>
    </div>

    {#if feedError}
      <div class="feed-notice text-sm text-mu">{feedError}</div>
    {/if}
    {#if feedJobs.length === 0 && !feedLoading}
      <div class="feed-notice text-xs text-mu">Showing example jobs. Click Refresh feed to load live listings.</div>
    {/if}

    <div class="feed-grid">
      {#each displayFeed as job (job.id)}
        <div class="job-card" class:example-card={job.id.startsWith('_')}>
          {#if job.id.startsWith('_')}
            <span class="example-badge">· example</span>
          {/if}
          <div class="job-card-top">
            <div class="job-title-block">
              <span class="job-title">{job.title}</span>
              <span class="job-company">{job.company}</span>
            </div>
            <div class="job-badges">
              <span class="region-badge region-{job.region}">{REGION_LABELS[job.region] ?? job.region}</span>
              <span class="type-badge type-{job.type}">{TYPE_LABELS[job.type] ?? job.type}</span>
            </div>
          </div>
          <div class="job-location text-xs text-mu">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
            {job.location}
            {#if job.postedAt}
              <span class="sep">·</span>
              <span>{relTime(job.postedAt)}</span>
            {/if}
            {#if job.source !== 'Example'}
              <span class="sep">·</span>
              <span class="source-lbl">{job.source}</span>
            {/if}
          </div>
          {#if job.description}
            <p class="job-desc text-sm">{job.description.slice(0, 160)}{job.description.length > 160 ? '…' : ''}</p>
          {/if}
          {#if job.tags.length > 0}
            <div class="job-tags">
              {#each job.tags.slice(0, 4) as tag}
                <span class="job-tag">{tag}</span>
              {/each}
            </div>
          {/if}
          <div class="job-actions">
            <a href={job.url} target="_blank" rel="noreferrer" class="btn btn-ghost btn-sm">
              Open
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
            </a>
            <button class="btn btn-ghost btn-sm" onclick={() => askEnzoAboutJob(job)}>Ask Enzo</button>
            <button class="btn btn-primary btn-sm" onclick={() => saveJobToTracker(job)}>
              {store.savedJobs.some(j => j.listing.url === job.url) ? 'Saved' : '+ Track'}
            </button>
          </div>
        </div>
      {:else}
        <div class="feed-empty text-mu text-sm">No jobs match your filters.</div>
      {/each}
    </div>

  <!-- ── TRACKER ─────────────────────────────────────────────────── -->
  {:else if tab === 'tracker'}
    <div class="tracker-toolbar">
      <p class="text-sm text-mu">{store.savedJobs.length} saved jobs · track your application pipeline</p>
      <button class="btn btn-primary btn-sm" onclick={() => addJobOpen = true}>+ Add job</button>
    </div>

    {#if store.savedJobs.length === 0}
      <div class="feed-notice text-xs text-mu">Showing example jobs. Save jobs from the Feed tab or add manually.</div>
    {/if}

    <!-- Kanban pipeline -->
    <div class="pipeline-board">
      {#each PIPELINE_STAGES as stage}
        {@const stageJobs = jobsByStatus(stage.id as JobStatus)}
        <div class="pipeline-col">
          <div class="col-header" style="--col: var(--{stage.color})">
            <span class="col-name">{stage.label}</span>
            <span class="col-count">{stageJobs.length}</span>
          </div>
          <div class="col-cards">
            {#each stageJobs as job (job.id)}
              <div class="tracker-card" class:example-card={job.id.startsWith('_')}>
                {#if job.id.startsWith('_')}
                  <span class="example-badge">· example</span>
                {/if}
                <div class="tc-title">{job.listing.title}</div>
                <div class="tc-company text-xs text-mu">{job.listing.company}</div>
                <div class="tc-location text-xs text-mu">{job.listing.location}</div>
                {#if job.listing.deadline}
                  {@const days = daysUntil(job.listing.deadline)}
                  <div class="tc-deadline" class:urgent={job.listing.deadline - Date.now() < 604800000}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                    Deadline: {days}
                  </div>
                {/if}
                {#if job.nextAction}
                  <div class="tc-next text-xs">
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
                    {job.nextAction}
                  </div>
                {/if}
                {#if !job.id.startsWith('_')}
                  <div class="tc-actions">
                    <select
                      class="status-sel"
                      value={job.status}
                      onchange={e => updateStatus(job.id, (e.target as HTMLSelectElement).value as JobStatus)}
                    >
                      {#each PIPELINE_STAGES as s}
                        <option value={s.id}>{s.label}</option>
                      {/each}
                    </select>
                    <button class="btn-icon tc-btn" title="Open URL" onclick={() => window.open(job.listing.url, '_blank')}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                    </button>
                    <button class="btn-icon tc-btn" title="Notes" onclick={() => { editingNotesId = job.id; notesDraft = job.notes; }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </button>
                    <button class="btn-icon tc-btn danger" title="Remove" onclick={() => deleteJob(job.id)}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                  </div>
                  {#if job.appliedAt}
                    <div class="tc-meta text-xs text-mu">Applied {relTime(job.appliedAt)}</div>
                  {/if}
                {/if}
              </div>
            {:else}
              <div class="col-empty text-xs text-mu">{stage.desc}</div>
            {/each}
          </div>
        </div>
      {/each}
    </div>

    <!-- Notes editor modal -->
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
          <textarea class="notes-ta" bind:value={notesDraft} placeholder="Notes, contacts, interview prep, salary info…" rows={8}></textarea>
          <div class="modal-actions">
            <button class="btn btn-ghost" onclick={() => editingNotesId = null}>Cancel</button>
            <button class="btn btn-primary" onclick={() => editingNotesId && saveNotes(editingNotesId)}>Save notes</button>
          </div>
        </div>
      </div>
    {/if}

    <!-- Add job modal -->
    {#if addJobOpen}
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div class="modal-backdrop" onclick={() => addJobOpen = false}>
        <div class="modal" onclick={(e) => e.stopPropagation()}>
          <div class="modal-head">
            <h3>Add job manually</h3>
            <button class="btn-icon" onclick={() => addJobOpen = false}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
          <div class="add-form">
            <div class="form-row">
              <div class="field">
                <label>Job title *</label>
                <input type="text" bind:value={addForm.title} placeholder="Senior Scientist – Oncology" />
              </div>
              <div class="field">
                <label>Company *</label>
                <input type="text" bind:value={addForm.company} placeholder="Merck KGaA" />
              </div>
            </div>
            <div class="form-row">
              <div class="field">
                <label>Location</label>
                <input type="text" bind:value={addForm.location} placeholder="Darmstadt, Germany" />
              </div>
              <div class="field">
                <label>Job URL</label>
                <input type="url" bind:value={addForm.url} placeholder="https://…" />
              </div>
            </div>
            <div class="form-row">
              <div class="field">
                <label>Region</label>
                <select bind:value={addForm.region}>
                  <option value="eu">Europe</option>
                  <option value="india">India</option>
                  <option value="uk">UK</option>
                  <option value="remote">Remote</option>
                  <option value="us">USA</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div class="field">
                <label>Type</label>
                <select bind:value={addForm.type}>
                  <option value="industry">Industry</option>
                  <option value="academic">Academic</option>
                  <option value="fellowship">Fellowship</option>
                  <option value="startup">Startup</option>
                  <option value="contract">Contract</option>
                </select>
              </div>
            </div>
            <div class="field">
              <label>Tags (comma-separated)</label>
              <input type="text" bind:value={addForm.tags} placeholder="oncology, scRNA-seq, bioinformatics" />
            </div>
            <div class="field">
              <label>Description</label>
              <textarea bind:value={addForm.description} placeholder="Brief notes on the role…" rows={3}></textarea>
            </div>
          </div>
          <div class="modal-actions">
            <button class="btn btn-ghost" onclick={() => addJobOpen = false}>Cancel</button>
            <button class="btn btn-primary" onclick={addManualJob} disabled={!addForm.title.trim() || !addForm.company.trim()}>Add to Radar</button>
          </div>
        </div>
      </div>
    {/if}

  <!-- ── COMPANIES ───────────────────────────────────────────────── -->
  {:else if tab === 'companies'}
    <div class="co-toolbar">
      <p class="text-sm text-mu">{EU_COMPANIES.length + INDIA_COMPANIES.length} curated companies — pharma, biotech, research</p>
      <div class="co-filters">
        {#each (['all', 'eu', 'de', 'india'] as const) as f}
          <button class="filter-tab" class:active={coFilter === f} onclick={() => coFilter = f}>
            {f === 'all' ? 'All' : f === 'eu' ? 'All EU' : f === 'de' ? 'Germany' : 'India'}
          </button>
        {/each}
      </div>
    </div>

    {#if coFilter !== 'india'}
      <div class="co-section">
        <div class="co-section-head">
          <span class="co-section-label">Europe & UK</span>
          <span class="co-count text-xs text-mu">{filteredEU.length} companies</span>
        </div>
        <div class="co-grid">
          {#each filteredEU as co}
            <div class="co-card tier-{co.tier}">
              <div class="co-card-top">
                <span class="co-name">{co.name}</span>
                <span class="co-country">{co.country}</span>
              </div>
              <span class="co-location text-xs text-mu">{co.location}</span>
              <div class="co-tags">
                {#each co.focus.slice(0, 3) as f}
                  <span class="co-tag">{f}</span>
                {/each}
              </div>
              <a href={co.url} target="_blank" rel="noreferrer" class="btn btn-ghost btn-sm co-btn">
                Careers
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
              </a>
            </div>
          {/each}
        </div>
      </div>
    {/if}

    {#if coFilter !== 'eu' && coFilter !== 'de'}
      <div class="co-section">
        <div class="co-section-head">
          <span class="co-section-label">India</span>
          <span class="co-count text-xs text-mu">{filteredIndia.length} companies</span>
        </div>
        <div class="co-grid">
          {#each filteredIndia as co}
            <div class="co-card tier-{co.tier}">
              <div class="co-card-top">
                <span class="co-name">{co.name}</span>
                <span class="co-country">IN</span>
              </div>
              <span class="co-location text-xs text-mu">{co.location}</span>
              <div class="co-tags">
                {#each co.focus.slice(0, 3) as f}
                  <span class="co-tag">{f}</span>
                {/each}
              </div>
              <a href={co.url} target="_blank" rel="noreferrer" class="btn btn-ghost btn-sm co-btn">
                Careers
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
              </a>
            </div>
          {/each}
        </div>
      </div>
    {/if}

  <!-- ── PROFILE ─────────────────────────────────────────────────── -->
  {:else if tab === 'profile'}
    <div class="profile-panel">
      {#if !editingProfile}
        <div class="profile-view">
          <div class="profile-head">
            <div>
              <h3>{store.profile.currentRole}</h3>
              <p class="text-mu text-sm">{store.profile.institution} · {store.profile.department}</p>
            </div>
            <div class="profile-actions">
              <button class="btn btn-ghost btn-sm" onclick={useProfileInEnzo}>Ask Enzo about my prospects</button>
              <button class="btn btn-primary btn-sm" onclick={startEditProfile}>Edit profile</button>
            </div>
          </div>

          <div class="profile-grid">
            <div class="profile-field">
              <span class="field-label">Specializations</span>
              <div class="tag-list">
                {#each store.profile.specializations as s}
                  <span class="profile-tag">{s}</span>
                {/each}
              </div>
            </div>
            <div class="profile-field">
              <span class="field-label">Target roles</span>
              <div class="tag-list">
                {#each store.profile.targetRoles as r}
                  <span class="profile-tag role-tag">{r}</span>
                {/each}
              </div>
            </div>
            <div class="profile-field">
              <span class="field-label">Target locations</span>
              <div class="tag-list">
                {#each store.profile.targetLocations as l}
                  <span class="profile-tag loc-tag">{l}</span>
                {/each}
              </div>
            </div>
          </div>

          {#if store.profile.cvHighlights.length > 0}
            <div class="profile-field">
              <span class="field-label">CV highlights</span>
              <ul class="cv-list">
                {#each store.profile.cvHighlights as h}
                  <li>{h}</li>
                {/each}
              </ul>
            </div>
          {:else}
            <div class="profile-field">
              <span class="field-label">CV highlights</span>
              <p class="text-mu text-sm">Add key achievements — Enzo will use these when drafting cover letters.</p>
            </div>
          {/if}

          {#if store.profile.publications.length > 0}
            <div class="profile-field">
              <span class="field-label">Key publications</span>
              <div class="pub-list">
                {#each store.profile.publications as pub}
                  <div class="pub-row">
                    <span class="pub-title text-sm">{pub.title}</span>
                    <span class="pub-meta text-xs text-mu">{pub.year}{pub.doi ? ` · doi:${pub.doi}` : ''}</span>
                  </div>
                {/each}
              </div>
            </div>
          {/if}

          {#if store.profile.notes}
            <div class="profile-field">
              <span class="field-label">Notes</span>
              <p class="text-sm">{store.profile.notes}</p>
            </div>
          {/if}
        </div>

      {:else}
        <!-- Edit mode -->
        <div class="profile-edit">
          <div class="form-row">
            <div class="field">
              <label>Current role</label>
              <input type="text" bind:value={profileDraft.currentRole} />
            </div>
            <div class="field">
              <label>Institution</label>
              <input type="text" bind:value={profileDraft.institution} />
            </div>
          </div>
          <div class="field">
            <label>Department</label>
            <input type="text" bind:value={profileDraft.department} />
          </div>

          <div class="field">
            <label>Specializations</label>
            <div class="tag-editor">
              {#each profileDraft.specializations as s, i}
                <span class="profile-tag editable">{s}
                  <button class="tag-rm" onclick={() => profileDraft.specializations = profileDraft.specializations.filter((_, j) => j !== i)}>×</button>
                </span>
              {/each}
              <input type="text" bind:value={newSpec} placeholder="Add specialization…" class="tag-add-input"
                onkeydown={e => { if ((e.key === 'Enter' || e.key === ',') && newSpec.trim()) { profileDraft.specializations = [...profileDraft.specializations, newSpec.trim()]; newSpec = ''; e.preventDefault(); } }}
              />
            </div>
          </div>

          <div class="field">
            <label>Target roles</label>
            <div class="tag-editor">
              {#each profileDraft.targetRoles as r, i}
                <span class="profile-tag role-tag editable">{r}
                  <button class="tag-rm" onclick={() => profileDraft.targetRoles = profileDraft.targetRoles.filter((_, j) => j !== i)}>×</button>
                </span>
              {/each}
              <input type="text" bind:value={newRole} placeholder="Add target role…" class="tag-add-input"
                onkeydown={e => { if ((e.key === 'Enter' || e.key === ',') && newRole.trim()) { profileDraft.targetRoles = [...profileDraft.targetRoles, newRole.trim()]; newRole = ''; e.preventDefault(); } }}
              />
            </div>
          </div>

          <div class="field">
            <label>Target locations</label>
            <div class="tag-editor">
              {#each profileDraft.targetLocations as l, i}
                <span class="profile-tag loc-tag editable">{l}
                  <button class="tag-rm" onclick={() => profileDraft.targetLocations = profileDraft.targetLocations.filter((_, j) => j !== i)}>×</button>
                </span>
              {/each}
              <input type="text" bind:value={newLoc} placeholder="Add location…" class="tag-add-input"
                onkeydown={e => { if ((e.key === 'Enter' || e.key === ',') && newLoc.trim()) { profileDraft.targetLocations = [...profileDraft.targetLocations, newLoc.trim()]; newLoc = ''; e.preventDefault(); } }}
              />
            </div>
          </div>

          <div class="field">
            <label>CV highlights</label>
            <div class="hl-list">
              {#each profileDraft.cvHighlights as h, i}
                <div class="hl-row">
                  <input type="text" bind:value={profileDraft.cvHighlights[i]} class="hl-input" />
                  <button class="btn-icon" onclick={() => profileDraft.cvHighlights = profileDraft.cvHighlights.filter((_, j) => j !== i)}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                </div>
              {/each}
              <div class="hl-row">
                <input type="text" bind:value={newHL} placeholder="Add highlight…" class="hl-input"
                  onkeydown={e => { if (e.key === 'Enter' && newHL.trim()) { profileDraft.cvHighlights = [...profileDraft.cvHighlights, newHL.trim()]; newHL = ''; } }}
                />
                <button class="btn btn-ghost btn-sm" onclick={() => { if (newHL.trim()) { profileDraft.cvHighlights = [...profileDraft.cvHighlights, newHL.trim()]; newHL = ''; } }}>Add</button>
              </div>
            </div>
          </div>

          <div class="field">
            <label>Key publications</label>
            <div class="pub-editor">
              {#each profileDraft.publications as pub, i}
                <div class="pub-edit-row">
                  <input type="text" bind:value={profileDraft.publications[i].title} placeholder="Title" class="pub-title-input" />
                  <input type="text" bind:value={profileDraft.publications[i].doi} placeholder="DOI" class="pub-doi-input" />
                  <input type="number" bind:value={profileDraft.publications[i].year} placeholder="Year" class="pub-year-input" />
                  <button class="btn-icon" onclick={() => profileDraft.publications = profileDraft.publications.filter((_, j) => j !== i)}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                </div>
              {/each}
              <div class="pub-edit-row">
                <input type="text" bind:value={newPubTitle} placeholder="Paper title" class="pub-title-input" />
                <input type="text" bind:value={newPubDoi} placeholder="DOI" class="pub-doi-input" />
                <input type="number" bind:value={newPubYear} placeholder="Year" class="pub-year-input" />
                <button class="btn btn-ghost btn-sm" onclick={() => { if (newPubTitle.trim()) { profileDraft.publications = [...profileDraft.publications, { title: newPubTitle.trim(), doi: newPubDoi.trim(), year: parseInt(newPubYear) || new Date().getFullYear() }]; newPubTitle = ''; newPubDoi = ''; newPubYear = ''; } }}>Add</button>
              </div>
            </div>
          </div>

          <div class="field">
            <label>Notes</label>
            <textarea bind:value={profileDraft.notes} placeholder="Job search strategy, salary expectations, constraints…" rows={4}></textarea>
          </div>

          <div class="edit-actions">
            <button class="btn btn-ghost" onclick={() => editingProfile = false}>Cancel</button>
            <button class="btn btn-primary" onclick={saveProfile}>Save profile</button>
          </div>
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .jobs {
    height: 100%;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 0;
  }

  /* ── Header ── */
  .jobs-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 18px 24px 12px;
    border-bottom: 1px solid var(--bd);
    background: var(--sf);
    flex-shrink: 0;
    flex-wrap: wrap;
    gap: 12px;
  }
  .jobs-header h2 { margin-bottom: 2px; }
  .header-tabs { display: flex; gap: 4px; }
  .tab-btn {
    padding: 5px 14px;
    border-radius: var(--radius-sm);
    font-size: 0.82rem;
    font-weight: 500;
    background: transparent;
    color: var(--mu);
    border: 1px solid transparent;
    cursor: pointer;
    transition: all var(--transition);
  }
  .tab-btn.active { background: var(--ac-bg); color: var(--ac); border-color: var(--ac); }
  .tab-btn:hover:not(.active) { background: var(--sf2); color: var(--tx); }

  /* ── Feed ── */
  .feed-toolbar {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 24px;
    border-bottom: 1px solid var(--bd);
    background: var(--sf);
    flex-shrink: 0;
    flex-wrap: wrap;
  }
  .feed-search { flex: 1; min-width: 160px; font-size: 0.85rem; }
  .filter-sel { width: auto; font-size: 0.82rem; flex-shrink: 0; }

  .feed-notice {
    padding: 8px 24px;
    background: var(--sf2);
    border-bottom: 1px solid var(--bd);
    flex-shrink: 0;
  }

  .feed-grid {
    padding: 16px 24px;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 14px;
    overflow-y: auto;
  }

  .job-card {
    background: var(--sf);
    border: 1px solid var(--bd);
    border-radius: var(--radius);
    padding: 14px 16px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    transition: border-color var(--transition), box-shadow var(--transition);
    position: relative;
  }
  .job-card:hover { border-color: var(--ac); box-shadow: var(--shadow); }
  .job-card.example-card { opacity: 0.7; }

  .example-badge {
    font-size: 0.62rem;
    font-weight: 700;
    color: var(--mu);
    letter-spacing: 0.06em;
    text-transform: uppercase;
    position: absolute;
    top: 8px;
    right: 10px;
  }

  .job-card-top {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 8px;
  }
  .job-title-block { flex: 1; min-width: 0; }
  .job-title { display: block; font-size: 0.9rem; font-weight: 600; color: var(--tx); line-height: 1.35; }
  .job-company { display: block; font-size: 0.8rem; color: var(--tx2); margin-top: 2px; }

  .job-badges { display: flex; flex-direction: column; gap: 3px; flex-shrink: 0; }
  .region-badge, .type-badge {
    font-size: 0.62rem;
    font-weight: 700;
    padding: 2px 6px;
    border-radius: 8px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    white-space: nowrap;
  }
  .region-eu    { background: var(--ac-bg);   color: var(--ac);   }
  .region-india { background: var(--yw-bg);   color: var(--yw);   }
  .region-uk    { background: var(--pu-bg, #2a1f4a); color: var(--pu, #a78bfa); }
  .region-remote{ background: var(--gn-bg);   color: var(--gn);   }
  .region-us    { background: var(--sf2);     color: var(--tx2);  }
  .region-other { background: var(--sf2);     color: var(--tx2);  }
  .type-industry  { background: var(--sf3, var(--sf2)); color: var(--tx2); }
  .type-academic  { background: var(--enzo-bg); color: var(--enzo); }
  .type-fellowship{ background: var(--pu-bg, #2a1f4a); color: var(--pu, #a78bfa); }
  .type-startup   { background: var(--rd-bg); color: var(--rd); }
  .type-contract  { background: var(--sf2);   color: var(--mu);  }

  .job-location {
    display: flex;
    align-items: center;
    gap: 4px;
    color: var(--mu);
  }
  .sep { color: var(--bd2); }
  .source-lbl { color: var(--mu); opacity: 0.7; }

  .job-desc { color: var(--tx2); line-height: 1.5; }
  .job-tags { display: flex; flex-wrap: wrap; gap: 4px; }
  .job-tag {
    font-size: 0.68rem;
    padding: 1px 7px;
    background: var(--ac-bg);
    color: var(--ac);
    border-radius: 10px;
  }

  .job-actions {
    display: flex;
    gap: 6px;
    margin-top: 4px;
    flex-wrap: wrap;
  }

  .feed-empty {
    grid-column: 1 / -1;
    text-align: center;
    padding: 48px;
  }

  .spin {
    display: inline-block;
    width: 10px; height: 10px;
    border: 2px solid var(--ac);
    border-top-color: transparent;
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
    vertical-align: middle;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  /* ── Tracker ── */
  .tracker-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 24px;
    border-bottom: 1px solid var(--bd);
    background: var(--sf);
    flex-shrink: 0;
  }

  .pipeline-board {
    display: flex;
    gap: 0;
    overflow-x: auto;
    flex: 1;
    padding: 16px 24px;
    gap: 12px;
    align-items: flex-start;
  }

  .pipeline-col {
    flex-shrink: 0;
    width: 210px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .col-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 10px;
    background: var(--sf);
    border: 1px solid var(--bd);
    border-top: 3px solid var(--col);
    border-radius: var(--radius-sm);
  }
  .col-name { font-size: 0.78rem; font-weight: 700; color: var(--col); text-transform: uppercase; letter-spacing: 0.06em; }
  .col-count {
    font-size: 0.7rem;
    font-weight: 700;
    background: var(--sf2);
    color: var(--mu);
    padding: 1px 6px;
    border-radius: 8px;
  }

  .col-cards { display: flex; flex-direction: column; gap: 8px; min-height: 60px; }
  .col-empty { padding: 16px 8px; text-align: center; border: 1px dashed var(--bd); border-radius: var(--radius-sm); }

  .tracker-card {
    background: var(--sf);
    border: 1px solid var(--bd);
    border-radius: var(--radius-sm);
    padding: 10px 12px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    position: relative;
    transition: border-color var(--transition);
  }
  .tracker-card:hover { border-color: var(--bd2); }
  .tracker-card.example-card { opacity: 0.6; }

  .tc-title { font-size: 0.82rem; font-weight: 600; color: var(--tx); line-height: 1.35; }
  .tc-company { font-size: 0.75rem; }
  .tc-location { font-size: 0.72rem; }

  .tc-deadline {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 0.72rem;
    color: var(--yw);
    font-weight: 600;
    margin-top: 2px;
  }
  .tc-deadline.urgent { color: var(--rd); }

  .tc-next {
    display: flex;
    align-items: center;
    gap: 3px;
    color: var(--ac);
    font-size: 0.72rem;
    margin-top: 1px;
  }

  .tc-actions {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-top: 4px;
    flex-wrap: wrap;
  }
  .status-sel {
    flex: 1;
    font-size: 0.72rem;
    padding: 3px 6px;
    min-width: 0;
  }
  .tc-btn { opacity: 0.5; padding: 3px; }
  .tc-btn:hover { opacity: 1; }
  .tc-btn.danger:hover { color: var(--rd); background: var(--rd-bg); }
  .tc-meta { margin-top: 2px; }

  /* ── Modals ── */
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.55);
    backdrop-filter: blur(2px);
    z-index: 200;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
  }
  .modal {
    background: var(--sf);
    border: 1px solid var(--bd);
    border-radius: var(--radius);
    box-shadow: var(--shadow-lg);
    width: 100%;
    max-width: 560px;
    max-height: 90vh;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 20px;
  }
  .modal-head { display: flex; align-items: center; justify-content: space-between; }
  .modal-actions { display: flex; justify-content: flex-end; gap: 8px; }
  .notes-ta { font-family: var(--mono); font-size: 0.88rem; min-height: 160px; }

  .add-form { display: flex; flex-direction: column; gap: 12px; }
  .form-row { display: flex; gap: 12px; }
  .form-row .field { flex: 1; min-width: 0; }
  .field { display: flex; flex-direction: column; gap: 5px; }
  .field label { font-size: 0.75rem; font-weight: 600; color: var(--mu); text-transform: uppercase; letter-spacing: 0.06em; }

  /* ── Companies ── */
  .co-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 24px;
    border-bottom: 1px solid var(--bd);
    background: var(--sf);
    flex-shrink: 0;
    flex-wrap: wrap;
    gap: 10px;
  }
  .co-filters { display: flex; gap: 4px; }
  .filter-tab {
    padding: 4px 12px;
    border-radius: var(--radius-sm);
    font-size: 0.8rem;
    font-weight: 500;
    background: transparent;
    color: var(--mu);
    border: 1px solid var(--bd);
    cursor: pointer;
    transition: all var(--transition);
  }
  .filter-tab.active { background: var(--ac-bg); color: var(--ac); border-color: var(--ac); }

  .co-section { padding: 16px 24px 0; }
  .co-section-head { display: flex; align-items: baseline; gap: 8px; margin-bottom: 12px; }
  .co-section-label { font-size: 0.72rem; font-weight: 800; letter-spacing: 0.09em; text-transform: uppercase; color: var(--mu); }

  .co-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 10px;
    margin-bottom: 20px;
  }

  .co-card {
    background: var(--sf);
    border: 1px solid var(--bd);
    border-radius: var(--radius);
    padding: 12px 14px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    transition: border-color var(--transition);
  }
  .co-card:hover { border-color: var(--ac); }
  .co-card.tier-research { border-left: 3px solid var(--enzo); }
  .co-card.tier-large { border-left: 3px solid var(--ac); }
  .co-card.tier-mid { border-left: 3px solid var(--gn); }

  .co-card-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 4px; }
  .co-name { font-size: 0.88rem; font-weight: 700; color: var(--tx); }
  .co-country {
    font-size: 0.65rem;
    font-weight: 800;
    padding: 1px 5px;
    background: var(--sf2);
    color: var(--mu);
    border-radius: 4px;
    letter-spacing: 0.06em;
    flex-shrink: 0;
  }
  .co-location { font-size: 0.75rem; }
  .co-tags { display: flex; flex-wrap: wrap; gap: 3px; }
  .co-tag {
    font-size: 0.65rem;
    padding: 1px 6px;
    background: var(--sf2);
    color: var(--tx2);
    border-radius: 8px;
  }
  .co-btn {
    margin-top: 4px;
    font-size: 0.78rem;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    width: fit-content;
  }

  /* ── Profile ── */
  .profile-panel { padding: 20px 24px; overflow-y: auto; flex: 1; }
  .profile-view { display: flex; flex-direction: column; gap: 20px; max-width: 700px; }
  .profile-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
  .profile-actions { display: flex; gap: 8px; flex-wrap: wrap; }

  .profile-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 16px; }
  .profile-field { display: flex; flex-direction: column; gap: 8px; }
  .field-label { font-size: 0.72rem; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; color: var(--mu); }

  .tag-list { display: flex; flex-wrap: wrap; gap: 5px; }
  .profile-tag {
    font-size: 0.78rem;
    padding: 3px 10px;
    background: var(--ac-bg);
    color: var(--ac);
    border: 1px solid var(--ac);
    border-radius: 20px;
  }
  .role-tag { background: var(--gn-bg); color: var(--gn); border-color: var(--gn); }
  .loc-tag { background: var(--enzo-bg); color: var(--enzo); border-color: var(--enzo-bd); }

  .cv-list { padding-left: 18px; display: flex; flex-direction: column; gap: 4px; }
  .cv-list li { font-size: 0.88rem; color: var(--tx2); }

  .pub-list { display: flex; flex-direction: column; gap: 8px; }
  .pub-row { display: flex; flex-direction: column; gap: 2px; padding: 6px 10px; background: var(--sf2); border-radius: var(--radius-sm); }

  /* Edit mode */
  .profile-edit { display: flex; flex-direction: column; gap: 16px; max-width: 700px; }
  .tag-editor { display: flex; flex-wrap: wrap; gap: 5px; align-items: center; padding: 8px; border: 1px solid var(--bd); border-radius: var(--radius-sm); background: var(--sf2); }
  .profile-tag.editable { cursor: default; display: inline-flex; align-items: center; gap: 4px; }
  .tag-rm { background: transparent; border: none; cursor: pointer; color: currentColor; opacity: 0.6; font-size: 14px; line-height: 1; padding: 0; }
  .tag-rm:hover { opacity: 1; }
  .tag-add-input { border: none; background: transparent; font-size: 0.82rem; color: var(--tx); min-width: 120px; outline: none; padding: 2px 4px; }

  .hl-list { display: flex; flex-direction: column; gap: 6px; }
  .hl-row { display: flex; gap: 6px; align-items: center; }
  .hl-input { flex: 1; font-size: 0.88rem; }

  .pub-editor { display: flex; flex-direction: column; gap: 6px; }
  .pub-edit-row { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
  .pub-title-input { flex: 3; min-width: 0; font-size: 0.82rem; }
  .pub-doi-input { flex: 2; min-width: 0; font-size: 0.82rem; }
  .pub-year-input { width: 70px; flex-shrink: 0; font-size: 0.82rem; }
  .pub-meta { color: var(--mu); }

  .edit-actions { display: flex; justify-content: flex-end; gap: 8px; padding-top: 8px; border-top: 1px solid var(--bd); }

  @media (max-width: 680px) {
    .feed-toolbar { padding: 10px 16px; }
    .feed-grid { padding: 12px 16px; grid-template-columns: 1fr; }
    .pipeline-board { padding: 12px 16px; }
    .jobs-header { padding: 14px 16px 10px; }
    .tracker-toolbar, .co-toolbar { padding: 10px 16px; }
    .co-section { padding: 12px 16px 0; }
    .profile-panel { padding: 16px; }
    .co-grid { grid-template-columns: 1fr; }
    .form-row { flex-direction: column; }
  }
</style>
