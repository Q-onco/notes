<script lang="ts">
import { store } from '../lib/store.svelte';
import type { GrantApp, GrantAppAim, GrantAppSection, GrantAppBudgetLine, GrantAppReviewComment, GrantAgency, GrantAppStatus } from '../lib/types';
import { streamGrantSection, streamSpecificAims, streamGrantCritique, streamReviewerResponse } from '../lib/groq';
import { nanoid } from 'nanoid';
import { marked } from 'marked';

let { showToast }: { showToast: (msg: string, type?: string) => void } = $props();

// ── Agency metadata ────────────────────────────────────────────────────────────
const AGENCIES: { id: GrantAgency; label: string; short: string; desc: string; color: string }[] = [
  { id: 'nih-r01',  label: 'NIH R01',            short: 'R01', desc: '5-year research project, up to ~$500K direct/year',         color: 'ac' },
  { id: 'nih-r21',  label: 'NIH R21',            short: 'R21', desc: '2-year exploratory, max $275K total direct costs',           color: 'ac' },
  { id: 'erc-stg',  label: 'ERC Starting Grant', short: 'ERC', desc: '5-year, up to €1.5M — 2–7 yrs post-PhD',                  color: 'pu' },
  { id: 'dfg-sach', label: 'DFG Sachbeihilfe',   short: 'DFG', desc: '2–3 year project funding, flexible budget lines',           color: 'gn' },
  { id: 'wellcome', label: 'Wellcome Discovery',  short: 'WEL', desc: 'Up to £3M over 5 years for independent investigators',     color: 'yw' },
  { id: 'custom',   label: 'Custom / Other',      short: 'OTH', desc: 'Generic template for any other funding body',              color: 'mu' },
];

const SECTION_TEMPLATES: Record<GrantAgency, { id: string; label: string; wordLimit?: number }[]> = {
  'nih-r01':  [
    { id: 'specific-aims', label: 'Specific Aims',           wordLimit: 600 },
    { id: 'significance',  label: 'Significance',            wordLimit: 1500 },
    { id: 'innovation',    label: 'Innovation',              wordLimit: 1000 },
    { id: 'approach',      label: 'Approach',                wordLimit: 4000 },
    { id: 'preliminary',   label: 'Preliminary Data',        wordLimit: 1500 },
    { id: 'environment',   label: 'Environment & Resources', wordLimit: 500 },
  ],
  'nih-r21':  [
    { id: 'specific-aims', label: 'Specific Aims',           wordLimit: 600 },
    { id: 'significance',  label: 'Significance & Innovation', wordLimit: 1200 },
    { id: 'approach',      label: 'Approach',                wordLimit: 2500 },
  ],
  'erc-stg':  [
    { id: 'synopsis',      label: 'Extended Synopsis (B1)',  wordLimit: 5000 },
    { id: 'track-record',  label: 'CV & Track Record',       wordLimit: 1500 },
    { id: 'earlier-work',  label: 'Earlier Work',            wordLimit: 2000 },
    { id: 'proposal',      label: 'Research Proposal (B2)',  wordLimit: 15000 },
    { id: 'ethics',        label: 'Ethics & Security',       wordLimit: 500 },
  ],
  'dfg-sach': [
    { id: 'summary',       label: 'Project Summary',         wordLimit: 1000 },
    { id: 'state-art',     label: 'State of the Art',        wordLimit: 2000 },
    { id: 'aims',          label: 'Aims & Hypotheses',       wordLimit: 1500 },
    { id: 'programme',     label: 'Work Programme',          wordLimit: 3000 },
    { id: 'data-mgmt',     label: 'Data Management Plan',    wordLimit: 500 },
  ],
  'wellcome': [
    { id: 'lay-summary',   label: 'Lay Summary',             wordLimit: 200 },
    { id: 'sci-abstract',  label: 'Scientific Abstract',     wordLimit: 500 },
    { id: 'background',    label: 'Background & Rationale',  wordLimit: 2000 },
    { id: 'research-plan', label: 'Research Plan',           wordLimit: 4000 },
    { id: 'impact',        label: 'Impact & Dissemination',  wordLimit: 1000 },
    { id: 'team',          label: 'Team & Expertise',        wordLimit: 500 },
  ],
  'custom':   [
    { id: 'summary',       label: 'Project Summary' },
    { id: 'background',    label: 'Background' },
    { id: 'objectives',    label: 'Objectives' },
    { id: 'methodology',   label: 'Methodology' },
    { id: 'impact',        label: 'Impact' },
  ],
};

const REVIEW_CRITERIA: Record<GrantAgency, string[]> = {
  'nih-r01':  ['Significance', 'Investigator', 'Innovation', 'Approach', 'Environment'],
  'nih-r21':  ['Significance', 'Investigator', 'Innovation', 'Approach', 'Environment'],
  'erc-stg':  ['Scientific Excellence', 'Impact', 'Implementation'],
  'dfg-sach': ['Scientific Quality', 'Impact', 'Feasibility'],
  'wellcome': ['Scientific Excellence', 'Track Record', 'Impact', 'Resources & Cost'],
  'custom':   ['Scientific Merit', 'Feasibility', 'Impact'],
};

// ── HGSOC R01 example ─────────────────────────────────────────────────────────
function makeExampleSections(): GrantAppSection[] {
  return SECTION_TEMPLATES['nih-r01'].map(s => ({
    id: s.id, label: s.label, wordLimit: s.wordLimit, enzoNotes: '',
    content: s.id === 'specific-aims'
      ? `Despite advances in PARP inhibitor (PARPi) therapy, most high-grade serous ovarian cancer (HGSOC) patients develop resistance within 12–18 months and 5-year survival remains below 30%. While intrinsic tumour cell mechanisms of PARPi resistance are increasingly characterised, the contribution of the tumour microenvironment (TME) — particularly macrophage–cancer-associated fibroblast (CAF) crosstalk — remains largely unexplored.\n\n**Central hypothesis:** Inflammatory CAFs (iCAFs) polarise tumour-associated macrophages toward a SPP1⁺ immunosuppressive state via JAK–STAT3 signalling, creating a feed-forward niche that drives PARPi resistance in HGSOC.\n\n**Aim 1:** Characterise tumour-associated macrophage subtypes in PARPi-resistant HGSOC using scRNA-seq and spatial transcriptomics of matched treatment-naïve and post-PARPi biopsies (n=40).\n\n**Aim 2:** Define the iCAF–macrophage paracrine signalling axis using co-culture systems, proteomics, and pharmacological perturbation in HGSOC organoid tricultures.\n\n**Aim 3:** Test CSF1R inhibitor + olaparib co-targeting in HGSOC patient-derived organoids and a syngeneic mouse model to generate a preclinical data package supporting an IND application.\n\nThis work will establish the mechanistic basis for a macrophage-directed combination strategy to overcome PARPi resistance, directly informing clinical trial design for a patient population with critical unmet need.`
      : '',
  }));
}

const EXAMPLE: GrantApp = {
  id: 'example-grant-app-001',
  title: 'Macrophage–CAF Crosstalk in PARP Inhibitor Resistance in High-Grade Serous Ovarian Cancer',
  agency: 'nih-r01', mechanism: 'R01', callId: 'PA-24-184',
  status: 'draft', deadline: Date.now() + 45 * 86400000, duration: 5,
  aims: [
    {
      id: 'a1', label: 'Aim 1', papers: [],
      title: 'Characterise tumour-associated macrophage subtypes in PARPi-resistant HGSOC',
      hypothesis: 'PARPi resistance is associated with enrichment of SPP1⁺ immunosuppressive macrophages that create a pro-tumorigenic niche through CCL2–CCR2 signalling.',
      rationale: 'Emerging scRNA-seq data implicate macrophage heterogeneity in driving chemotherapy resistance in HGSOC, yet the specific subtypes promoting PARPi resistance remain undefined.',
      approach: 'scRNA-seq + spatial transcriptomics of matched pre/post-PARPi HGSOC biopsies (n=40). CellChat ligand–receptor analysis. SPP1⁺ macrophage validation by IHC and MERFISH.',
      milestone: 'Macrophage subtype atlas in PARPi-resistant HGSOC with spatially resolved niche maps. Publication target: Nature Cancer.',
    },
    {
      id: 'a2', label: 'Aim 2', papers: [],
      title: 'Define the iCAF–macrophage paracrine signalling axis sustaining resistance',
      hypothesis: 'Inflammatory CAFs (iCAFs) secrete IL-6 and LIF that polarise macrophages toward the SPP1⁺ state via JAK–STAT3, creating a feed-forward resistance loop.',
      rationale: 'CAF subtypes (iCAF, myCAF, apCAF) differentially regulate the TME; their crosstalk with macrophages in the PARPi context is unexplored.',
      approach: 'CAF–macrophage–tumour organoid tricultures, proteomics of conditioned media, STAT3 inhibitor (stattic) + olaparib combinatorics in 20 HGSOC PDOs.',
      milestone: 'Validated iCAF→macrophage→tumour resistance axis with identified druggable node (JAK–STAT3 or CCL2–CCR2).',
    },
    {
      id: 'a3', label: 'Aim 3', papers: [],
      title: 'Test CSF1R inhibitor + olaparib co-targeting in PDO and syngeneic models',
      hypothesis: 'CSF1R blockade combined with olaparib will overcome PARPi resistance by depleting SPP1⁺ macrophages from the tumour niche.',
      rationale: 'CSF1R inhibitors (pexidartinib) deplete immunosuppressive macrophages in solid tumours; their combination with PARPi is untested in HGSOC.',
      approach: 'Drug sensitivity in 20 HGSOC PDOs ± macrophage co-culture. CSF1Ri + olaparib in ID8-VEGF syngeneic model. Biomarker discovery for patient stratification.',
      milestone: 'Preclinical data package supporting IND application for CSF1Ri + olaparib in BRCA-wt HGSOC.',
    },
  ],
  sections: makeExampleSections(),
  budget: [
    { id: 'b1', category: 'personnel',   description: 'PI salary (2 calendar months)',     year1: 28000, year2: 29000, year3: 30000, justification: 'PI effort for oversight, analysis, and manuscript preparation.' },
    { id: 'b2', category: 'personnel',   description: 'Postdoctoral researcher (100% FTE)', year1: 58000, year2: 60000, year3: 62000, justification: 'Full-time postdoc for scRNA-seq, organoid culture, and drug screening.' },
    { id: 'b3', category: 'consumables', description: '10x Genomics Chromium + NovaSeq',   year1: 45000, year2: 40000, year3: 35000, justification: 'scRNA-seq of 40 biopsy pairs (~$2,500/sample including library prep and sequencing).' },
    { id: 'b4', category: 'equipment',   description: 'Organoid culture infrastructure',    year1: 15000, year2: 0,     year3: 0,     justification: 'Ultra-low attachment plates, Matrigel, microfluidic co-culture chambers.' },
  ],
  reviewComments: [],
  createdAt: Date.now(), updatedAt: Date.now(),
};

// ── UI state ──────────────────────────────────────────────────────────────────
let openId      = $state<string | null>(null);
let innerTab    = $state<'aims' | 'sections' | 'budget' | 'review' | 'preview'>('aims');
let showNewForm = $state(false);

// new grant form
let fTitle = $state(''); let fAgency = $state<GrantAgency>('nih-r01');
let fMech  = $state(''); let fCallId = $state('');
let fDeadline = $state(''); let fDuration = $state(5);

// aims form
let showAimForm = $state(false); let editAimId = $state<string | null>(null);
let afLabel = $state(''); let afTitle = $state(''); let afHyp  = $state('');
let afRat   = $state(''); let afApp   = $state(''); let afMile = $state('');

// enzo aims
let aimsDraft = $state(''); let aimsDraftLoading = $state(false);
let aimsDraftAbort = $state<AbortController | null>(null);

// sections
let activeSectionId    = $state('specific-aims');
let sectionPreview     = $state(false);
let sectionDraft       = $state('');
let sectionDraftLoading = $state(false);
let sectionDraftAbort   = $state<AbortController | null>(null);

// critique
let critiqueDraft   = $state(''); let critiqueLoading = $state(false);
let critiqueAbort   = $state<AbortController | null>(null);

// review form + per-comment response
let showReviewForm = $state(false);
let rfReviewer = $state('Reviewer 1'); let rfCriterion = $state('');
let rfScore = $state(3); let rfComment = $state('');
let responseLoading = $state<string | null>(null);
let responseAbort   = $state<AbortController | null>(null);

let saveTimer: ReturnType<typeof setTimeout> | null = null;

// ── Derived ───────────────────────────────────────────────────────────────────
const allGrants   = $derived(store.grantApps.length === 0 ? [EXAMPLE] : store.grantApps);
const openGrant   = $derived(openId ? allGrants.find(g => g.id === openId) ?? null : null);
const isExample   = $derived(openId === EXAMPLE.id && store.grantApps.length === 0);
const activeSection = $derived(openGrant?.sections.find(s => s.id === activeSectionId) ?? openGrant?.sections[0] ?? null);
const wordCount   = $derived(activeSection ? activeSection.content.trim().split(/\s+/).filter(Boolean).length : 0);
const filledSecs  = $derived(openGrant?.sections.filter(s => s.content.trim()).length ?? 0);
const totalSecs   = $derived(openGrant?.sections.length ?? 0);

const deadlineDays = $derived.by(() => {
  if (!openGrant?.deadline) return null;
  return Math.ceil((openGrant.deadline - Date.now()) / 86400000);
});

const budgetTotals = $derived.by(() => {
  if (!openGrant) return { y1: 0, y2: 0, y3: 0, total: 0 };
  const y1 = openGrant.budget.reduce((s, l) => s + (Number(l.year1) || 0), 0);
  const y2 = openGrant.budget.reduce((s, l) => s + (Number(l.year2) || 0), 0);
  const y3 = openGrant.budget.reduce((s, l) => s + (Number(l.year3) || 0), 0);
  return { y1, y2, y3, total: y1 + y2 + y3 };
});

const totalWords = $derived.by(() =>
  openGrant?.sections.reduce((s, sec) => s + sec.content.trim().split(/\s+/).filter(Boolean).length, 0) ?? 0
);

const assembledText = $derived.by(() => {
  if (!openGrant) return '';
  const ag = agencyInfo(openGrant.agency);
  const lines = [
    `# ${openGrant.title}`,
    `Agency: ${ag.label}${openGrant.mechanism ? ' · ' + openGrant.mechanism : ''}${openGrant.callId ? ' · Call: ' + openGrant.callId : ''}`,
    '',
  ];
  if (openGrant.aims.length) {
    lines.push('## Aims Overview');
    openGrant.aims.forEach(a => {
      lines.push(`\n### ${a.label}: ${a.title}`);
      if (a.hypothesis) lines.push(`**Hypothesis:** ${a.hypothesis}`);
      if (a.approach)   lines.push(`**Approach:** ${a.approach}`);
      if (a.milestone)  lines.push(`**Milestone:** ${a.milestone}`);
    });
    lines.push('');
  }
  openGrant.sections.filter(s => s.content.trim()).forEach(s => {
    lines.push(`## ${s.label}`);
    lines.push(s.content);
    lines.push('');
  });
  return lines.join('\n');
});

// ── Helpers ───────────────────────────────────────────────────────────────────
function agencyInfo(id: GrantAgency) { return AGENCIES.find(a => a.id === id)!; }
function statusColor(s: GrantAppStatus): string {
  return ({ draft:'mu', submitted:'ac', 'under-review':'yw', funded:'gn', rejected:'rd', resubmit:'pu' } as Record<string,string>)[s] ?? 'mu';
}
function fmt$(n: number) { return '$' + n.toLocaleString(); }

function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { if (!isExample) store.saveGrantApps().catch(() => {}); }, 1200);
}

function mutate(id: string, fn: (g: GrantApp) => void) {
  const idx = store.grantApps.findIndex(g => g.id === id);
  if (idx === -1) return;
  fn(store.grantApps[idx]);
  store.grantApps[idx].updatedAt = Date.now();
  scheduleSave();
}

// ── CRUD ──────────────────────────────────────────────────────────────────────
function createGrant() {
  if (!fTitle.trim()) { showToast('Title required', 'error'); return; }
  const secs = SECTION_TEMPLATES[fAgency].map(s => ({ id: s.id, label: s.label, wordLimit: s.wordLimit, content: '', enzoNotes: '' }));
  const g: GrantApp = {
    id: nanoid(), title: fTitle.trim(), agency: fAgency,
    mechanism: fMech.trim() || undefined, callId: fCallId.trim() || undefined,
    status: 'draft', deadline: fDeadline ? new Date(fDeadline).getTime() : undefined,
    duration: fDuration, aims: [], sections: secs, budget: [], reviewComments: [],
    createdAt: Date.now(), updatedAt: Date.now(),
  };
  store.grantApps.push(g);
  scheduleSave();
  openId = g.id; innerTab = 'aims'; showNewForm = false;
  fTitle = ''; fAgency = 'nih-r01'; fMech = ''; fCallId = ''; fDeadline = ''; fDuration = 5;
  showToast('Grant application created');
}

function deleteGrant(id: string) {
  if (id === EXAMPLE.id) return;
  if (!confirm('Delete this grant application?')) return;
  store.grantApps = store.grantApps.filter(g => g.id !== id);
  if (openId === id) openId = null;
  scheduleSave(); showToast('Deleted');
}

function openAimForm(aim?: GrantAppAim) {
  if (aim) { editAimId = aim.id; afLabel = aim.label; afTitle = aim.title; afHyp = aim.hypothesis; afRat = aim.rationale; afApp = aim.approach; afMile = aim.milestone; }
  else { editAimId = null; afLabel = `Aim ${(openGrant?.aims.length ?? 0) + 1}`; afTitle = afHyp = afRat = afApp = afMile = ''; }
  showAimForm = true;
}

function saveAim() {
  if (!openId || isExample) return;
  if (!afTitle.trim()) { showToast('Title required', 'error'); return; }
  const data = { label: afLabel, title: afTitle, hypothesis: afHyp, rationale: afRat, approach: afApp, milestone: afMile };
  mutate(openId, g => {
    if (editAimId) { const i = g.aims.findIndex(a => a.id === editAimId); if (i >= 0) Object.assign(g.aims[i], data); }
    else g.aims.push({ ...data, id: nanoid(), papers: [] });
  });
  showAimForm = false;
}

function deleteAim(aimId: string) {
  if (!openId || isExample) return;
  mutate(openId, g => { g.aims = g.aims.filter(a => a.id !== aimId); });
}

function updateSection(sId: string, content: string) {
  if (!openId || isExample) return;
  mutate(openId, g => { const s = g.sections.find(x => x.id === sId); if (s) s.content = content; });
}

function acceptSectionDraft() {
  if (!openId || isExample || !sectionDraft) return;
  updateSection(activeSectionId, sectionDraft);
  sectionDraft = ''; showToast('Draft accepted');
}

function addBudgetLine() {
  if (!openId || isExample) return;
  mutate(openId, g => { g.budget.push({ id: nanoid(), category: 'consumables', description: '', year1: 0, year2: 0, year3: 0, justification: '' }); });
}

function updateBudget(lineId: string, field: string, value: string | number) {
  if (!openId || isExample) return;
  mutate(openId, g => { const l = g.budget.find(x => x.id === lineId); if (l) (l as any)[field] = value; });
}

function removeBudgetLine(lineId: string) {
  if (!openId || isExample) return;
  mutate(openId, g => { g.budget = g.budget.filter(l => l.id !== lineId); });
}

function addComment() {
  if (!openId || isExample) return;
  if (!rfComment.trim()) { showToast('Comment required', 'error'); return; }
  mutate(openId, g => {
    g.reviewComments.push({
      id: nanoid(), reviewer: rfReviewer,
      criterion: rfCriterion || (REVIEW_CRITERIA[g.agency]?.[0] ?? 'General'),
      score: rfScore, comment: rfComment, response: '', resolved: false,
    });
  });
  rfComment = ''; rfScore = 3; showReviewForm = false;
}

function updateResponse(cId: string, resp: string) {
  if (!openId || isExample) return;
  mutate(openId, g => { const c = g.reviewComments.find(x => x.id === cId); if (c) c.response = resp; });
}

function toggleResolved(cId: string) {
  if (!openId || isExample) return;
  mutate(openId, g => { const c = g.reviewComments.find(x => x.id === cId); if (c) c.resolved = !c.resolved; });
}

function removeComment(cId: string) {
  if (!openId || isExample) return;
  mutate(openId, g => { g.reviewComments = g.reviewComments.filter(c => c.id !== cId); });
}

function updateStatus(s: GrantAppStatus) {
  if (!openId || isExample) return;
  mutate(openId, g => { g.status = s; });
}

// ── Enzo actions (all behind explicit buttons) ────────────────────────────────
async function genAimsPage() {
  if (!openGrant || !openGrant.aims.length) { showToast('Add aims first', 'error'); return; }
  const aimsText = openGrant.aims.map(a =>
    `${a.label}: ${a.title}\nHypothesis: ${a.hypothesis}\nApproach: ${a.approach}\nMilestone: ${a.milestone}`
  ).join('\n\n');
  aimsDraft = ''; aimsDraftLoading = true; aimsDraftAbort = new AbortController();
  try { await streamSpecificAims(openGrant.title, aimsText, t => { aimsDraft += t; }, aimsDraftAbort.signal); }
  catch { /* aborted */ }
  aimsDraftLoading = false; aimsDraftAbort = null;
}

function acceptAimsDraft() {
  if (!openId || isExample || !aimsDraft) return;
  mutate(openId, g => { const s = g.sections.find(x => x.id === 'specific-aims'); if (s) s.content = aimsDraft; });
  aimsDraft = ''; activeSectionId = 'specific-aims'; innerTab = 'sections';
  showToast('Aims draft saved to Specific Aims section');
}

async function genSection() {
  if (!openGrant || !activeSection) return;
  const aimsText = openGrant.aims.map(a => `${a.label}: ${a.title} — ${a.approach}`).join('\n');
  sectionDraft = ''; sectionDraftLoading = true; sectionDraftAbort = new AbortController();
  try {
    await streamGrantSection(
      agencyInfo(openGrant.agency).label, activeSection.label,
      openGrant.title, aimsText,
      t => { sectionDraft += t; }, sectionDraftAbort.signal
    );
  } catch { /* aborted */ }
  sectionDraftLoading = false; sectionDraftAbort = null;
}

async function runCritique() {
  if (!openGrant) return;
  const text = openGrant.sections.filter(s => s.content.trim()).map(s => `## ${s.label}\n${s.content}`).join('\n\n');
  if (!text) { showToast('Add section content first', 'error'); return; }
  critiqueDraft = ''; critiqueLoading = true; critiqueAbort = new AbortController();
  try { await streamGrantCritique(openGrant.title, agencyInfo(openGrant.agency).label, text, t => { critiqueDraft += t; }, critiqueAbort.signal); }
  catch { /* aborted */ }
  critiqueLoading = false; critiqueAbort = null;
}

async function genResponse(comment: GrantAppReviewComment) {
  if (!openGrant || isExample) return;
  const secContent = openGrant.sections.find(s =>
    s.label.toLowerCase().includes(comment.criterion.toLowerCase().split(' ')[0])
  )?.content ?? openGrant.sections.find(s => s.content)?.content ?? '';
  responseLoading = comment.id; responseAbort = new AbortController();
  let resp = '';
  try { await streamReviewerResponse(comment.criterion, comment.comment, secContent, t => { resp += t; }, responseAbort.signal); }
  catch { /* aborted */ }
  responseLoading = null; responseAbort = null;
  if (resp) updateResponse(comment.id, resp);
}

function copyPreview() {
  navigator.clipboard.writeText(assembledText).then(() => showToast('Copied to clipboard'));
}
</script>

<!-- ── NEW GRANT FORM ─────────────────────────────────────────────────────────── -->
{#if showNewForm}
<div class="gw-wrap">
  <header class="gw-bar">
    <button class="back-btn" onclick={() => showNewForm = false}>← Back</button>
    <h2 class="gw-page-title">New Grant Application</h2>
  </header>
  <div class="gw-form-body">
    <div class="form-field">
      <label>Grant Title *</label>
      <input type="text" bind:value={fTitle} placeholder="e.g. Macrophage polarisation in PARPi resistance in HGSOC" class="form-input-wide" />
    </div>
    <div class="form-field">
      <label>Funding Agency</label>
      <div class="agency-grid">
        {#each AGENCIES as ag}
          <button class="agency-card" class:agency-selected={fAgency === ag.id} onclick={() => fAgency = ag.id}>
            <span class="agency-short pill-{ag.color}">{ag.short}</span>
            <span class="agency-label">{ag.label}</span>
            <span class="agency-desc">{ag.desc}</span>
          </button>
        {/each}
      </div>
    </div>
    <div class="form-row-2">
      <div class="form-field">
        <label>Mechanism (optional)</label>
        <input type="text" bind:value={fMech} placeholder="e.g. R01, R21" />
      </div>
      <div class="form-field">
        <label>Call / FOA ID (optional)</label>
        <input type="text" bind:value={fCallId} placeholder="e.g. PA-24-184" />
      </div>
      <div class="form-field">
        <label>Submission Deadline</label>
        <input type="date" bind:value={fDeadline} />
      </div>
      <div class="form-field">
        <label>Duration (years)</label>
        <input type="number" bind:value={fDuration} min="1" max="10" />
      </div>
    </div>
    <div class="form-actions">
      <button class="btn-primary" onclick={createGrant}>Create Grant Application →</button>
      <button class="btn-ghost" onclick={() => showNewForm = false}>Cancel</button>
    </div>
  </div>
</div>

<!-- ── DETAIL VIEW ────────────────────────────────────────────────────────────── -->
{:else if openGrant}
<div class="gw-wrap">

  <header class="gw-bar">
    <button class="back-btn" onclick={() => { openId = null; aimsDraft = ''; sectionDraft = ''; critiqueDraft = ''; }}>← Back</button>
    <div class="gw-grant-head">
      <h2 class="gw-grant-title">{openGrant.title}</h2>
      <div class="gw-grant-meta">
        <span class="pill pill-{agencyInfo(openGrant.agency).color}">{agencyInfo(openGrant.agency).short}</span>
        {#if openGrant.mechanism}<span class="pill pill-mu">{openGrant.mechanism}</span>{/if}
        <select
          class="status-sel status-{statusColor(openGrant.status)}"
          value={openGrant.status}
          onchange={(e) => updateStatus((e.target as HTMLSelectElement).value as GrantAppStatus)}
          disabled={isExample}
        >
          {#each (['draft','submitted','under-review','funded','rejected','resubmit'] as GrantAppStatus[]) as s}
            <option value={s}>{s}</option>
          {/each}
        </select>
        {#if deadlineDays !== null}
          <span class="pill pill-{deadlineDays < 14 ? 'rd' : deadlineDays < 30 ? 'yw' : 'gn'}">
            {deadlineDays > 0 ? deadlineDays + 'd left' : 'Overdue'}
          </span>
        {/if}
      </div>
    </div>
    {#if !isExample}
      <button class="btn-icon-sm" onclick={() => deleteGrant(openGrant.id)} title="Delete grant">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="3 6 5 6 21 6"/>
          <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6M10 11v6M14 11v6"/>
        </svg>
      </button>
    {/if}
  </header>

  {#if isExample}
    <div class="example-banner">
      Example grant — <button class="example-link" onclick={() => showNewForm = true}>create your own</button> to write and save
    </div>
  {/if}

  <nav class="gw-tabs">
    {#each [['aims','Aims'],['sections',`Sections (${filledSecs}/${totalSecs})`],['budget','Budget'],['review','Review'],['preview','Preview']] as [tid, tlabel]}
      <button class="gw-tab" class:gw-tab-active={innerTab === tid} onclick={() => innerTab = tid as typeof innerTab}>{tlabel}</button>
    {/each}
  </nav>

  <div class="gw-tab-body">

    <!-- ── AIMS TAB ── -->
    {#if innerTab === 'aims'}
    <div class="aims-tab">
      <div class="aims-topbar">
        <h3>Research Aims</h3>
        {#if !isExample}
          <button class="btn-sm btn-primary" onclick={() => openAimForm()}>+ Add Aim</button>
        {/if}
      </div>

      {#if openGrant.aims.length === 0}
        <div class="empty-state">No aims yet. Add 2–3 specific, testable aims to structure your grant narrative.</div>
      {:else}
        <div class="aims-list">
          {#each openGrant.aims as aim}
            <div class="aim-card">
              <div class="aim-head">
                <span class="aim-label-badge">{aim.label}</span>
                <span class="aim-title-text">{aim.title}</span>
                {#if !isExample}
                  <div class="aim-btns">
                    <button class="btn-xs btn-ghost" onclick={() => openAimForm(aim)}>Edit</button>
                    <button class="btn-xs btn-ghost text-rd" onclick={() => deleteAim(aim.id)}>×</button>
                  </div>
                {/if}
              </div>
              {#if aim.hypothesis}<p class="aim-row"><strong>Hypothesis:</strong> {aim.hypothesis}</p>{/if}
              {#if aim.approach}  <p class="aim-row"><strong>Approach:</strong> {aim.approach}</p>{/if}
              {#if aim.milestone} <p class="aim-row"><strong>Milestone:</strong> {aim.milestone}</p>{/if}
            </div>
          {/each}
        </div>
      {/if}

      {#if showAimForm}
        <div class="aim-form card-inset">
          <div class="form-row-2">
            <div class="form-field form-field-sm">
              <label>Label</label>
              <input bind:value={afLabel} placeholder="Aim 1" />
            </div>
            <div class="form-field">
              <label>Title *</label>
              <input bind:value={afTitle} placeholder="Short aim title" />
            </div>
          </div>
          <div class="form-field">
            <label>Hypothesis</label>
            <textarea bind:value={afHyp} rows="2" placeholder="Central hypothesis for this aim…"></textarea>
          </div>
          <div class="form-field">
            <label>Rationale</label>
            <textarea bind:value={afRat} rows="2" placeholder="Why is this aim needed / what gap does it address?"></textarea>
          </div>
          <div class="form-field">
            <label>Approach (brief)</label>
            <textarea bind:value={afApp} rows="2" placeholder="Key methods and experimental approach…"></textarea>
          </div>
          <div class="form-field">
            <label>Milestone / Deliverable</label>
            <input bind:value={afMile} placeholder="Expected output, publication target, data package…" />
          </div>
          <div class="form-actions-row">
            <button class="btn-primary" onclick={saveAim}>{editAimId ? 'Update Aim' : 'Add Aim'}</button>
            <button class="btn-ghost" onclick={() => showAimForm = false}>Cancel</button>
          </div>
        </div>
      {/if}

      <!-- Enzo Specific Aims draft -->
      <div class="enzo-aims-section">
        <div class="enzo-aims-head">
          <div>
            <h4>Enzo: Draft Specific Aims Page</h4>
            <p class="hint-text">Enzo writes the classic NIH 1-pager from your aims above — hook, knowledge gap, central hypothesis, aims list, and impact close (~600 words).</p>
          </div>
          {#if aimsDraftLoading}
            <button class="btn-sm btn-ghost" onclick={() => { aimsDraftAbort?.abort(); aimsDraftLoading = false; }}>Abort</button>
          {:else}
            <button class="btn-sm btn-enzo" onclick={genAimsPage} disabled={openGrant.aims.length === 0 || isExample}>
              Enzo: Draft Specific Aims ✦
            </button>
          {/if}
        </div>
        {#if aimsDraftLoading && !aimsDraft}
          <div class="streaming-hint">Enzo is drafting…</div>
        {/if}
        {#if aimsDraft}
          <div class="draft-box">
            <div class="draft-prose">{@html String(marked(aimsDraft))}</div>
            <div class="draft-actions">
              <button class="btn-sm btn-primary" onclick={acceptAimsDraft}>Accept → Sections</button>
              <button class="btn-sm btn-ghost" onclick={() => aimsDraft = ''}>Discard</button>
            </div>
          </div>
        {/if}
      </div>
    </div>

    <!-- ── SECTIONS TAB ── -->
    {:else if innerTab === 'sections'}
    <div class="sections-tab">
      <aside class="sec-nav">
        {#each openGrant.sections as sec}
          {@const wc = sec.content.trim().split(/\s+/).filter(Boolean).length}
          {@const pct = sec.wordLimit ? Math.min(110, Math.round((wc / sec.wordLimit) * 100)) : 0}
          <button
            class="sec-nav-btn"
            class:sec-nav-active={activeSectionId === sec.id}
            onclick={() => { activeSectionId = sec.id; sectionPreview = false; sectionDraft = ''; }}
          >
            <div class="sec-nav-row">
              <span class="sec-nav-label">{sec.label}</span>
              {#if sec.content.trim()}
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="var(--gn)" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
              {/if}
            </div>
            {#if sec.wordLimit}
              <div class="sec-wc-row">
                <div class="sec-bar"><div class="sec-bar-fill sec-bar-{pct > 100 ? 'over' : pct > 90 ? 'warn' : 'ok'}" style="width:{Math.min(100,pct)}%"></div></div>
                <span class="sec-wc {pct > 100 ? 'text-rd' : ''}">{wc}/{sec.wordLimit}</span>
              </div>
            {/if}
          </button>
        {/each}
      </aside>

      {#if activeSection}
        <div class="sec-editor">
          <div class="sec-editor-top">
            <div class="sec-editor-title-row">
              <h3>{activeSection.label}</h3>
              <span class="sec-wc-display {wordCount > (activeSection.wordLimit ?? Infinity) ? 'text-rd' : ''}">
                {wordCount}{activeSection.wordLimit ? ' / ' + activeSection.wordLimit + ' words' : ' words'}
              </span>
            </div>
            <div class="sec-editor-actions">
              <div class="toggle-group">
                <button class="toggle-btn" class:toggle-active={!sectionPreview} onclick={() => sectionPreview = false}>Edit</button>
                <button class="toggle-btn" class:toggle-active={sectionPreview}  onclick={() => sectionPreview = true}>Preview</button>
              </div>
              {#if sectionDraftLoading}
                <button class="btn-sm btn-ghost" onclick={() => { sectionDraftAbort?.abort(); sectionDraftLoading = false; }}>Abort</button>
              {:else}
                <button class="btn-sm btn-enzo" onclick={genSection} disabled={isExample}>Enzo draft ✦</button>
              {/if}
            </div>
          </div>

          {#if sectionPreview}
            <div class="sec-preview">
              {#if activeSection.content.trim()}
                {@html String(marked(activeSection.content))}
              {:else}
                <span class="empty-hint">No content — switch to Edit or use Enzo draft.</span>
              {/if}
            </div>
          {:else}
            <textarea
              class="sec-textarea"
              value={activeSection.content}
              oninput={(e) => updateSection(activeSectionId, (e.target as HTMLTextAreaElement).value)}
              placeholder="Write the {activeSection.label} here, or click Enzo draft ✦ to generate a first draft…"
              disabled={isExample}
            ></textarea>
          {/if}

          {#if sectionDraftLoading && !sectionDraft}
            <div class="streaming-hint">Enzo is drafting…</div>
          {/if}
          {#if sectionDraft}
            <div class="draft-box">
              <div class="draft-label">Enzo draft — review before accepting</div>
              <div class="draft-prose">{@html String(marked(sectionDraft))}</div>
              <div class="draft-actions">
                <button class="btn-sm btn-primary" onclick={acceptSectionDraft}>Accept (replaces content)</button>
                <button class="btn-sm btn-ghost" onclick={() => sectionDraft = ''}>Discard</button>
              </div>
            </div>
          {/if}
        </div>
      {:else}
        <div class="sec-empty">Select a section.</div>
      {/if}
    </div>

    <!-- ── BUDGET TAB ── -->
    {:else if innerTab === 'budget'}
    <div class="budget-tab">
      <div class="budget-topbar">
        <h3>Direct Costs Budget</h3>
        {#if !isExample}
          <button class="btn-sm btn-primary" onclick={addBudgetLine}>+ Add Line</button>
        {/if}
      </div>
      <div class="budget-scroll">
        <table class="budget-table">
          <thead>
            <tr>
              <th>Category</th><th>Description</th>
              <th class="num-col">Year 1</th><th class="num-col">Year 2</th><th class="num-col">Year 3</th>
              <th>Justification</th>
              {#if !isExample}<th class="del-col"></th>{/if}
            </tr>
          </thead>
          <tbody>
            {#each openGrant.budget as line}
              <tr>
                <td>
                  {#if isExample}<span class="cat-badge">{line.category}</span>{:else}
                    <select value={line.category} onchange={(e) => updateBudget(line.id, 'category', (e.target as HTMLSelectElement).value)}>
                      {#each ['personnel','equipment','consumables','travel','indirect','other'] as c}
                        <option value={c}>{c}</option>
                      {/each}
                    </select>
                  {/if}
                </td>
                <td>
                  {#if isExample}{line.description}{:else}
                    <input type="text" value={line.description} oninput={(e) => updateBudget(line.id,'description',(e.target as HTMLInputElement).value)} />
                  {/if}
                </td>
                <td class="num-col">
                  {#if isExample}{fmt$(line.year1)}{:else}
                    <input type="number" value={line.year1} oninput={(e) => updateBudget(line.id,'year1',Number((e.target as HTMLInputElement).value))} class="num-input" />
                  {/if}
                </td>
                <td class="num-col">
                  {#if isExample}{fmt$(line.year2)}{:else}
                    <input type="number" value={line.year2} oninput={(e) => updateBudget(line.id,'year2',Number((e.target as HTMLInputElement).value))} class="num-input" />
                  {/if}
                </td>
                <td class="num-col">
                  {#if isExample}{fmt$(line.year3)}{:else}
                    <input type="number" value={line.year3} oninput={(e) => updateBudget(line.id,'year3',Number((e.target as HTMLInputElement).value))} class="num-input" />
                  {/if}
                </td>
                <td>
                  {#if isExample}<span class="just-text">{line.justification}</span>{:else}
                    <input type="text" value={line.justification} oninput={(e) => updateBudget(line.id,'justification',(e.target as HTMLInputElement).value)} />
                  {/if}
                </td>
                {#if !isExample}
                  <td class="del-col"><button class="btn-del" onclick={() => removeBudgetLine(line.id)}>×</button></td>
                {/if}
              </tr>
            {/each}
          </tbody>
          <tfoot>
            <tr class="total-row">
              <td colspan="2"><strong>Total Direct Costs</strong></td>
              <td class="num-col"><strong>{fmt$(budgetTotals.y1)}</strong></td>
              <td class="num-col"><strong>{fmt$(budgetTotals.y2)}</strong></td>
              <td class="num-col"><strong>{fmt$(budgetTotals.y3)}</strong></td>
              <td colspan={isExample ? 1 : 2}><strong>Grand: {fmt$(budgetTotals.total)}</strong></td>
            </tr>
          </tfoot>
        </table>
      </div>
      <div class="budget-note">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--yw)" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        Indirect costs (F&A, typically 26–56% of MTDC for NIH) not included above. Add as a separate line after confirming your institution's negotiated rate.
      </div>
    </div>

    <!-- ── REVIEW TAB ── -->
    {:else if innerTab === 'review'}
    <div class="review-tab">
      <div class="critique-block">
        <div class="critique-head">
          <div>
            <h3>Mock Study Section Review</h3>
            <p class="hint-text">Enzo simulates a peer reviewer for {agencyInfo(openGrant.agency).label} — scores each criterion, lists strengths and weaknesses, and suggests revisions.</p>
          </div>
          {#if critiqueLoading}
            <button class="btn-sm btn-ghost" onclick={() => { critiqueAbort?.abort(); critiqueLoading = false; }}>Abort</button>
          {:else}
            <button class="btn-sm btn-enzo" onclick={runCritique} disabled={filledSecs === 0}>
              Enzo: Mock Review ✦
            </button>
          {/if}
        </div>
        {#if critiqueLoading && !critiqueDraft}
          <div class="streaming-hint">Enzo is reviewing…</div>
        {/if}
        {#if critiqueDraft}
          <div class="critique-output">{@html String(marked(critiqueDraft))}</div>
          <button class="btn-xs btn-ghost" style="margin-top:8px" onclick={() => critiqueDraft = ''}>Clear</button>
        {/if}
      </div>

      <div class="review-divider"></div>

      <div class="comments-block">
        <div class="comments-head">
          <h3>Reviewer Comments</h3>
          {#if !isExample}
            <button class="btn-sm btn-primary" onclick={() => showReviewForm = !showReviewForm}>
              {showReviewForm ? 'Cancel' : '+ Add Comment'}
            </button>
          {/if}
        </div>

        {#if showReviewForm}
          <div class="comment-form card-inset">
            <div class="form-row-3">
              <div class="form-field">
                <label>Reviewer</label>
                <input bind:value={rfReviewer} placeholder="Reviewer 1" />
              </div>
              <div class="form-field">
                <label>Criterion</label>
                <select bind:value={rfCriterion}>
                  {#each REVIEW_CRITERIA[openGrant.agency] as c}
                    <option value={c}>{c}</option>
                  {/each}
                </select>
              </div>
              <div class="form-field form-field-xs">
                <label>Score (1–9)</label>
                <input type="number" bind:value={rfScore} min="1" max="9" />
              </div>
            </div>
            <div class="form-field">
              <label>Comment *</label>
              <textarea bind:value={rfComment} rows="3" placeholder="Paste the reviewer comment…"></textarea>
            </div>
            <button class="btn-primary" onclick={addComment}>Add Comment</button>
          </div>
        {/if}

        {#if openGrant.reviewComments.length === 0 && !showReviewForm}
          <div class="empty-state">No reviewer comments yet. After receiving a real or mock review, add comments here to draft point-by-point responses.</div>
        {:else}
          <div class="comments-list">
            {#each openGrant.reviewComments as comment}
              <div class="comment-card" class:comment-resolved={comment.resolved}>
                <div class="comment-meta">
                  <span class="comment-reviewer">{comment.reviewer}</span>
                  <span class="comment-criterion">{comment.criterion}</span>
                  {#if comment.score}<span class="score-badge score-{comment.score <= 3 ? 'good' : comment.score <= 6 ? 'mid' : 'poor'}">{comment.score}</span>{/if}
                  {#if !isExample}
                    <div class="comment-btns">
                      <button class="btn-xs btn-ghost" class:btn-active={comment.resolved} onclick={() => toggleResolved(comment.id)}>
                        {comment.resolved ? '✓ Done' : 'Resolve'}
                      </button>
                      <button class="btn-xs btn-ghost text-rd" onclick={() => removeComment(comment.id)}>×</button>
                    </div>
                  {/if}
                </div>
                <p class="comment-text">{comment.comment}</p>
                <div class="response-block">
                  <div class="response-label-row">
                    <span class="response-lbl">Response</span>
                    {#if !isExample}
                      {#if responseLoading === comment.id}
                        <button class="btn-xs btn-ghost" onclick={() => { responseAbort?.abort(); responseLoading = null; }}>Abort</button>
                      {:else}
                        <button class="btn-xs btn-enzo" onclick={() => genResponse(comment)}>Enzo draft ✦</button>
                      {/if}
                    {/if}
                  </div>
                  {#if isExample}
                    <div class="response-readonly">{comment.response || '(no response yet)'}</div>
                  {:else}
                    <textarea
                      class="response-ta"
                      value={comment.response}
                      oninput={(e) => updateResponse(comment.id, (e.target as HTMLTextAreaElement).value)}
                      placeholder="Draft your response…"
                      rows="3"
                    ></textarea>
                  {/if}
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    </div>

    <!-- ── PREVIEW TAB ── -->
    {:else}
    <div class="preview-tab">
      <div class="preview-topbar">
        <div class="preview-stats">
          <span class="stat-chip"><strong>{totalWords.toLocaleString()}</strong> words</span>
          <span class="stat-chip"><strong>{filledSecs}/{totalSecs}</strong> sections written</span>
          <span class="stat-chip"><strong>{openGrant.aims.length}</strong> aims</span>
          <span class="stat-chip"><strong>{openGrant.budget.length}</strong> budget lines</span>
        </div>
        <button class="btn-sm btn-primary" onclick={copyPreview}>Copy all text</button>
      </div>
      <div class="preview-body">{@html String(marked(assembledText))}</div>
    </div>
    {/if}

  </div>
</div>

<!-- ── LANDING ────────────────────────────────────────────────────────────────── -->
{:else}
<div class="gw-wrap">
  <header class="gw-bar">
    <div>
      <h2 class="gw-page-title">Grant Writing Studio</h2>
      <p class="gw-page-sub">Structure your aims, draft sections with Enzo, plan your budget, and respond to reviewers</p>
    </div>
    <button class="btn-primary" onclick={() => showNewForm = true}>+ New Grant</button>
  </header>

  <div class="gw-list">
    {#each allGrants as g}
      {@const ag = agencyInfo(g.agency)}
      {@const filled = g.sections.filter(s => s.content.trim()).length}
      {@const days = g.deadline ? Math.ceil((g.deadline - Date.now()) / 86400000) : null}
      <div class="gw-card">
        <div class="gw-card-top">
          <span class="pill pill-{ag.color}">{ag.short}</span>
          {#if g.mechanism}<span class="pill pill-mu">{g.mechanism}</span>{/if}
          <span class="pill pill-{statusColor(g.status)}">{g.status}</span>
          {#if days !== null}
            <span class="pill pill-{days < 14 ? 'rd' : days < 30 ? 'yw' : 'gn'}">{days > 0 ? days + 'd left' : 'overdue'}</span>
          {/if}
        </div>
        <h3 class="gw-card-title">{g.title}</h3>
        <div class="gw-card-stats">
          <div class="prog-row">
            <span class="prog-label">{filled}/{g.sections.length} sections</span>
            <div class="prog-bar"><div class="prog-fill" style="width:{g.sections.length ? Math.round((filled/g.sections.length)*100) : 0}%"></div></div>
          </div>
          <span class="aims-count">{g.aims.length} aims · {g.budget.length} budget lines</span>
        </div>
        <button class="btn-sm btn-primary" onclick={() => { openId = g.id; innerTab = 'aims'; }}>Open →</button>
      </div>
    {/each}
  </div>
</div>
{/if}

<style>
.gw-wrap { display:flex; flex-direction:column; height:100%; overflow:hidden; background:var(--bg); }

/* header bar */
.gw-bar { display:flex; align-items:center; gap:12px; padding:14px 20px; border-bottom:1px solid var(--bd); flex-shrink:0; }
.gw-page-title { font-size:1.05rem; font-weight:600; color:var(--tx); margin:0; }
.gw-page-sub   { font-size:0.78rem; color:var(--tx2); margin:2px 0 0; }
.back-btn { background:none; border:none; color:var(--tx2); cursor:pointer; font-size:0.82rem; padding:4px 8px; border-radius:6px; }
.back-btn:hover { background:var(--sf2); color:var(--tx); }
.btn-icon-sm { background:none; border:none; cursor:pointer; color:var(--mu); padding:5px; border-radius:6px; }
.btn-icon-sm:hover { background:var(--rd-bg); color:var(--rd); }

/* grant header */
.gw-grant-head { flex:1; min-width:0; }
.gw-grant-title { font-size:0.92rem; font-weight:600; color:var(--tx); margin:0 0 4px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.gw-grant-meta  { display:flex; align-items:center; gap:6px; flex-wrap:wrap; }
.status-sel { font-size:0.72rem; padding:2px 6px; border-radius:6px; border:1px solid var(--bd); background:var(--sf2); color:var(--tx); cursor:pointer; }

/* example banner */
.example-banner { background:var(--yw-bg); color:var(--yw); border-bottom:1px solid var(--yw); padding:7px 20px; font-size:0.78rem; flex-shrink:0; }
.example-link { background:none; border:none; color:var(--ac); cursor:pointer; text-decoration:underline; font-size:inherit; padding:0; }

/* pills */
.pill { display:inline-flex; align-items:center; height:18px; padding:0 7px; border-radius:9px; font-size:0.68rem; font-weight:600; }
.pill-ac  { background:var(--ac-bg); color:var(--ac); }
.pill-pu  { background:var(--pu-bg); color:var(--pu); }
.pill-gn  { background:var(--gn-bg); color:var(--gn); }
.pill-yw  { background:var(--yw-bg); color:var(--yw); }
.pill-rd  { background:var(--rd-bg); color:var(--rd); }
.pill-mu  { background:var(--sf3);   color:var(--tx2); }

/* tabs */
.gw-tabs { display:flex; gap:0; border-bottom:1px solid var(--bd); padding:0 16px; flex-shrink:0; }
.gw-tab { background:none; border:none; border-bottom:2px solid transparent; padding:9px 14px; font-size:0.8rem; color:var(--tx2); cursor:pointer; white-space:nowrap; transition:color .15s; }
.gw-tab:hover { color:var(--tx); }
.gw-tab-active { color:var(--ac); border-bottom-color:var(--ac); font-weight:600; }
.gw-tab-body { flex:1; overflow:hidden; display:flex; flex-direction:column; }

/* buttons */
.btn-primary { background:var(--ac); color:#fff; border:none; border-radius:7px; padding:6px 14px; font-size:0.8rem; font-weight:600; cursor:pointer; }
.btn-primary:hover { background:var(--ac-h); }
.btn-primary:disabled { opacity:.5; cursor:not-allowed; }
.btn-ghost  { background:none; border:1px solid var(--bd); border-radius:7px; padding:5px 12px; font-size:0.78rem; color:var(--tx2); cursor:pointer; }
.btn-ghost:hover { background:var(--sf2); }
.btn-sm { padding:4px 10px; font-size:0.76rem; border-radius:6px; }
.btn-xs { padding:2px 7px; font-size:0.7rem; border-radius:5px; }
.btn-enzo { background:linear-gradient(135deg,#5b50d6,#3b82f6); color:#fff; border:none; border-radius:7px; cursor:pointer; font-size:0.76rem; font-weight:600; padding:4px 12px; }
.btn-enzo:hover { opacity:.9; }
.btn-enzo:disabled { opacity:.5; cursor:not-allowed; }
.btn-active { background:var(--ac-bg); color:var(--ac); border-color:var(--ac); }
.text-rd { color:var(--rd); }
.btn-del { background:none; border:none; cursor:pointer; color:var(--mu); font-size:1.1rem; padding:2px 5px; border-radius:4px; }
.btn-del:hover { color:var(--rd); background:var(--rd-bg); }

/* forms */
.form-field { display:flex; flex-direction:column; gap:4px; }
.form-field label { font-size:0.74rem; font-weight:600; color:var(--tx2); }
.form-field input, .form-field select, .form-field textarea {
  padding:6px 9px; border:1px solid var(--bd); border-radius:7px; background:var(--sf); color:var(--tx);
  font-size:0.82rem; resize:vertical;
}
.form-field input:focus, .form-field select:focus, .form-field textarea:focus { outline:none; border-color:var(--ac); }
.form-input-wide { width:100%; }
.form-row-2 { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
.form-row-3 { display:grid; grid-template-columns:1fr 1fr auto; gap:12px; }
.form-field-sm { max-width:120px; }
.form-field-xs { max-width:90px; }
.form-actions { display:flex; gap:10px; padding-top:8px; }
.form-actions-row { display:flex; gap:8px; margin-top:4px; }
.card-inset { background:var(--sf2); border:1px solid var(--bd); border-radius:10px; padding:16px; display:flex; flex-direction:column; gap:10px; margin-top:14px; }

/* new form layout */
.gw-form-body { flex:1; overflow-y:auto; padding:20px 24px; display:flex; flex-direction:column; gap:16px; }
.agency-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:8px; }
.agency-card { display:flex; flex-direction:column; gap:3px; padding:10px 12px; border:1.5px solid var(--bd); border-radius:10px; background:var(--sf); cursor:pointer; text-align:left; transition:border-color .15s; }
.agency-card:hover { border-color:var(--ac); }
.agency-selected { border-color:var(--ac); background:var(--ac-bg); }
.agency-short { font-size:0.7rem; font-weight:700; padding:2px 6px; border-radius:6px; align-self:flex-start; background:var(--sf3); color:var(--tx2); }
.agency-label { font-size:0.82rem; font-weight:600; color:var(--tx); }
.agency-desc  { font-size:0.72rem; color:var(--tx2); line-height:1.35; }

/* landing */
.gw-list { flex:1; overflow-y:auto; padding:16px 20px; display:grid; grid-template-columns:repeat(auto-fill,minmax(320px,1fr)); gap:12px; align-content:start; }
.gw-card { background:var(--sf); border:1px solid var(--bd); border-radius:12px; padding:14px; display:flex; flex-direction:column; gap:8px; }
.gw-card:hover { border-color:var(--bd2); }
.gw-card-top { display:flex; gap:5px; flex-wrap:wrap; align-items:center; }
.gw-card-title { font-size:0.88rem; font-weight:600; color:var(--tx); line-height:1.35; margin:0; }
.gw-card-stats { display:flex; flex-direction:column; gap:5px; }
.prog-row { display:flex; align-items:center; gap:8px; }
.prog-label { font-size:0.72rem; color:var(--tx2); white-space:nowrap; min-width:70px; }
.prog-bar { flex:1; height:4px; background:var(--sf3); border-radius:2px; overflow:hidden; }
.prog-fill { height:100%; background:var(--ac); border-radius:2px; transition:width .3s; }
.aims-count { font-size:0.72rem; color:var(--mu); }

/* AIMS TAB */
.aims-tab { flex:1; overflow-y:auto; padding:16px 20px; display:flex; flex-direction:column; gap:14px; }
.aims-topbar { display:flex; align-items:center; justify-content:space-between; }
.aims-topbar h3 { margin:0; font-size:0.88rem; font-weight:600; }
.aims-list { display:flex; flex-direction:column; gap:10px; }
.aim-card { background:var(--sf); border:1px solid var(--bd); border-radius:10px; padding:12px 14px; }
.aim-head { display:flex; align-items:center; gap:8px; margin-bottom:6px; }
.aim-label-badge { background:var(--ac-bg); color:var(--ac); font-size:0.7rem; font-weight:700; padding:2px 7px; border-radius:6px; white-space:nowrap; }
.aim-title-text { font-size:0.86rem; font-weight:600; color:var(--tx); flex:1; }
.aim-btns { display:flex; gap:4px; }
.aim-row { font-size:0.78rem; color:var(--tx2); margin:3px 0 0; line-height:1.4; }
.enzo-aims-section { background:var(--sf); border:1px solid var(--bd); border-radius:10px; padding:14px; }
.enzo-aims-head { display:flex; align-items:flex-start; justify-content:space-between; gap:12px; margin-bottom:8px; }
.enzo-aims-head h4 { margin:0 0 3px; font-size:0.84rem; font-weight:600; }
.hint-text { font-size:0.76rem; color:var(--tx2); margin:0; line-height:1.4; }
.streaming-hint { font-size:0.78rem; color:var(--mu); padding:8px 0; animation:pulse 1.5s infinite; }
@keyframes pulse { 0%,100%{opacity:.6} 50%{opacity:1} }
.draft-box { background:var(--sf2); border:1px solid var(--bd); border-radius:8px; padding:12px; margin-top:8px; }
.draft-label { font-size:0.72rem; color:var(--mu); font-weight:600; margin-bottom:6px; text-transform:uppercase; letter-spacing:.05em; }
.draft-prose { font-size:0.82rem; color:var(--tx); line-height:1.6; }
.draft-prose :global(h1) { font-size:0.86rem; font-weight:700; margin:.8em 0 .3em; color:var(--tx); }
.draft-prose :global(h2) { font-size:0.86rem; font-weight:700; margin:.8em 0 .3em; color:var(--tx); }
.draft-prose :global(h3) { font-size:0.86rem; font-weight:700; margin:.8em 0 .3em; color:var(--tx); }
.draft-prose :global(h4) { font-size:0.86rem; font-weight:700; margin:.8em 0 .3em; color:var(--tx); }
.draft-prose :global(p) { margin:.4em 0; }
.draft-prose :global(strong) { color:var(--tx); }
.draft-actions { display:flex; gap:8px; margin-top:10px; }
.empty-state { color:var(--mu); font-size:0.82rem; padding:20px; text-align:center; border:1px dashed var(--bd); border-radius:8px; }
.empty-hint { font-size:0.78rem; color:var(--mu); font-style:italic; }

/* SECTIONS TAB */
.sections-tab { flex:1; overflow:hidden; display:flex; }
.sec-nav { width:210px; flex-shrink:0; border-right:1px solid var(--bd); overflow-y:auto; padding:8px; display:flex; flex-direction:column; gap:2px; }
.sec-nav-btn { display:flex; flex-direction:column; gap:4px; padding:8px 10px; border:none; border-radius:8px; background:none; cursor:pointer; text-align:left; }
.sec-nav-btn:hover { background:var(--sf2); }
.sec-nav-active { background:var(--ac-bg); }
.sec-nav-active .sec-nav-label { color:var(--ac); font-weight:600; }
.sec-nav-row { display:flex; align-items:center; justify-content:space-between; gap:4px; }
.sec-nav-label { font-size:0.78rem; color:var(--tx2); }
.sec-wc-row { display:flex; align-items:center; gap:5px; }
.sec-bar { flex:1; height:3px; background:var(--sf3); border-radius:2px; overflow:hidden; }
.sec-bar-fill { height:100%; border-radius:2px; transition:width .3s; }
.sec-bar-ok   { background:var(--gn); }
.sec-bar-warn { background:var(--yw); }
.sec-bar-over { background:var(--rd); }
.sec-wc { font-size:0.65rem; color:var(--mu); white-space:nowrap; }
.text-rd { color:var(--rd) !important; }
.sec-editor { flex:1; min-width:0; display:flex; flex-direction:column; overflow:hidden; }
.sec-editor-top { display:flex; align-items:flex-start; justify-content:space-between; padding:12px 16px; border-bottom:1px solid var(--bd); gap:12px; flex-shrink:0; }
.sec-editor-title-row { display:flex; align-items:center; gap:10px; }
.sec-editor-title-row h3 { margin:0; font-size:0.88rem; font-weight:600; }
.sec-wc-display { font-size:0.74rem; color:var(--mu); }
.sec-editor-actions { display:flex; align-items:center; gap:8px; flex-shrink:0; }
.toggle-group { display:flex; border:1px solid var(--bd); border-radius:6px; overflow:hidden; }
.toggle-btn { background:none; border:none; padding:3px 10px; font-size:0.74rem; color:var(--tx2); cursor:pointer; }
.toggle-btn:hover { background:var(--sf2); }
.toggle-active { background:var(--ac); color:#fff; }
.sec-textarea { flex:1; border:none; outline:none; padding:14px 16px; font-size:0.82rem; color:var(--tx); background:var(--bg); resize:none; font-family:inherit; line-height:1.6; }
.sec-textarea:disabled { opacity:.6; }
.sec-preview { flex:1; overflow-y:auto; padding:14px 16px; font-size:0.82rem; color:var(--tx); line-height:1.7; }
.sec-preview :global(h1) { font-size:0.9rem; font-weight:700; margin:.8em 0 .3em; }
.sec-preview :global(h2) { font-size:0.9rem; font-weight:700; margin:.8em 0 .3em; }
.sec-preview :global(h3) { font-size:0.9rem; font-weight:700; margin:.8em 0 .3em; }
.sec-preview :global(h4) { font-size:0.9rem; font-weight:700; margin:.8em 0 .3em; }
.sec-preview :global(p) { margin:.5em 0; }
.sec-preview :global(strong) { color:var(--tx); }
.sec-empty { flex:1; display:flex; align-items:center; justify-content:center; color:var(--mu); font-size:0.82rem; }

/* BUDGET TAB */
.budget-tab { flex:1; overflow:hidden; display:flex; flex-direction:column; padding:16px 20px; gap:12px; }
.budget-topbar { display:flex; align-items:center; justify-content:space-between; }
.budget-topbar h3 { margin:0; font-size:0.88rem; font-weight:600; }
.budget-scroll { flex:1; overflow:auto; }
.budget-table { width:100%; border-collapse:collapse; font-size:0.78rem; }
.budget-table th { padding:7px 10px; text-align:left; font-size:0.7rem; color:var(--tx2); font-weight:600; border-bottom:1px solid var(--bd); white-space:nowrap; background:var(--sf); }
.budget-table td { padding:6px 8px; border-bottom:1px solid var(--sf3); color:var(--tx); vertical-align:top; }
.budget-table td input, .budget-table td select { width:100%; padding:3px 6px; border:1px solid var(--bd); border-radius:5px; background:var(--sf); color:var(--tx); font-size:0.78rem; }
.num-col { width:80px; text-align:right; }
.num-input { width:80px; text-align:right; }
.del-col { width:30px; }
.cat-badge { font-size:0.7rem; background:var(--sf3); color:var(--tx2); padding:2px 6px; border-radius:5px; }
.just-text { font-size:0.76rem; color:var(--tx2); }
.total-row td { padding:8px 8px; font-size:0.78rem; border-top:2px solid var(--bd); background:var(--sf2); }
.budget-note { display:flex; align-items:flex-start; gap:6px; font-size:0.74rem; color:var(--tx2); background:var(--yw-bg); border:1px solid var(--yw); border-radius:8px; padding:8px 10px; line-height:1.45; }

/* REVIEW TAB */
.review-tab { flex:1; overflow-y:auto; padding:16px 20px; display:flex; flex-direction:column; gap:14px; }
.critique-block { background:var(--sf); border:1px solid var(--bd); border-radius:10px; padding:14px; }
.critique-head { display:flex; align-items:flex-start; justify-content:space-between; gap:12px; margin-bottom:8px; }
.critique-head h3 { margin:0 0 3px; font-size:0.88rem; font-weight:600; }
.critique-output { font-size:0.8rem; color:var(--tx); line-height:1.65; margin-top:8px; }
.critique-output :global(h1) { font-size:0.86rem; font-weight:700; margin:.8em 0 .3em; }
.critique-output :global(h2) { font-size:0.86rem; font-weight:700; margin:.8em 0 .3em; }
.critique-output :global(h3) { font-size:0.86rem; font-weight:700; margin:.8em 0 .3em; }
.critique-output :global(h4) { font-size:0.86rem; font-weight:700; margin:.8em 0 .3em; }
.critique-output :global(p) { margin:.4em 0; }
.critique-output :global(li) { margin:.2em 0; }
.review-divider { height:1px; background:var(--bd); }
.comments-block { display:flex; flex-direction:column; gap:10px; }
.comments-head { display:flex; align-items:center; justify-content:space-between; }
.comments-head h3 { margin:0; font-size:0.88rem; font-weight:600; }
.comment-form { }
.comments-list { display:flex; flex-direction:column; gap:10px; }
.comment-card { background:var(--sf); border:1px solid var(--bd); border-radius:10px; padding:12px 14px; }
.comment-resolved { opacity:.55; }
.comment-meta { display:flex; align-items:center; gap:7px; margin-bottom:7px; flex-wrap:wrap; }
.comment-reviewer { font-size:0.74rem; font-weight:700; color:var(--tx); background:var(--sf2); padding:2px 7px; border-radius:6px; }
.comment-criterion { font-size:0.74rem; color:var(--tx2); background:var(--sf3); padding:2px 7px; border-radius:6px; }
.score-badge { font-size:0.72rem; font-weight:700; padding:2px 6px; border-radius:6px; }
.score-good { background:var(--gn-bg); color:var(--gn); }
.score-mid  { background:var(--yw-bg); color:var(--yw); }
.score-poor { background:var(--rd-bg); color:var(--rd); }
.comment-btns { display:flex; gap:4px; margin-left:auto; }
.comment-text { font-size:0.8rem; color:var(--tx); line-height:1.5; margin-bottom:8px; }
.response-block { border-top:1px solid var(--sf3); padding-top:8px; }
.response-label-row { display:flex; align-items:center; justify-content:space-between; margin-bottom:5px; }
.response-lbl { font-size:0.72rem; font-weight:600; color:var(--tx2); }
.response-ta { width:100%; border:1px solid var(--bd); border-radius:7px; padding:7px; font-size:0.78rem; color:var(--tx); background:var(--sf2); resize:vertical; font-family:inherit; line-height:1.5; }
.response-ta:focus { outline:none; border-color:var(--ac); }
.response-readonly { font-size:0.78rem; color:var(--tx2); font-style:italic; }

/* PREVIEW TAB */
.preview-tab { flex:1; overflow:hidden; display:flex; flex-direction:column; }
.preview-topbar { display:flex; align-items:center; justify-content:space-between; padding:12px 16px; border-bottom:1px solid var(--bd); flex-shrink:0; gap:12px; }
.preview-stats { display:flex; gap:8px; flex-wrap:wrap; align-items:center; }
.stat-chip { font-size:0.76rem; background:var(--sf2); color:var(--tx2); padding:3px 8px; border-radius:6px; }
.preview-body { flex:1; overflow-y:auto; padding:16px 20px; font-size:0.82rem; color:var(--tx); line-height:1.7; }
.preview-body :global(h1) { font-size:1.05rem; font-weight:700; margin:0 0 6px; }
.preview-body :global(h2) { font-size:0.92rem; font-weight:700; margin:1.2em 0 .4em; color:var(--ac); }
.preview-body :global(h3) { font-size:0.86rem; font-weight:600; margin:.9em 0 .3em; }
.preview-body :global(p) { margin:.4em 0; }
.preview-body :global(strong) { color:var(--tx); }
</style>
