<script lang="ts">
  import { store } from '../lib/store.svelte';
  import { nanoid } from 'nanoid';
  import { streamTroubleshoot, streamStatsExplanation, streamReagentCitation } from '../lib/groq';

  let { showToast }: { showToast: (msg: string, type?: 'success' | 'error') => void } = $props();

  let panel = $state<'dilutions' | 'experiments' | 'stats' | 'troubleshoot' | 'reagents'>('dilutions');

  // ══════════════════════════════════════════════════════════
  // PANEL 1 — DILUTIONS
  // ══════════════════════════════════════════════════════════
  let dilTab = $state<'serial' | 'c1v1' | 'seeding'>('serial');

  const UNITS = ['mM', 'µM', 'nM', 'mg/mL', 'µg/mL', 'ng/mL', '%'] as const;
  type DilUnit = typeof UNITS[number];

  // — Serial dilution —
  let sdConc   = $state(10);
  let sdUnit   = $state<DilUnit>('mM');
  let sdFactor = $state(10);
  let sdSteps  = $state(6);
  let sdVol    = $state(1);     // mL per tube

  const sdRows = $derived.by(() => {
    const out: { step: number; conc: number; fromPrev: number; diluent: number }[] = [];
    for (let i = 0; i <= sdSteps; i++) {
      out.push({
        step: i,
        conc:     sdConc / Math.pow(sdFactor, i),
        fromPrev: i === 0 ? 0 : sdVol / sdFactor,
        diluent:  i === 0 ? 0 : sdVol * (1 - 1 / sdFactor),
      });
    }
    return out;
  });

  function fmtConc(n: number): string {
    if (n >= 1000) return `${(n / 1000).toPrecision(3)}k`;
    if (n >= 1)    return n.toPrecision(3);
    if (n >= 0.001) return `${(n * 1000).toPrecision(3)}m`;
    return n.toExponential(2);
  }

  function tubeHue(i: number, total: number): string {
    const t = total > 0 ? i / total : 0;
    const r = Math.round(20  + t * (200 - 20));
    const g = Math.round(120 + t * (220 - 120));
    const b = Math.round(130 + t * (240 - 130));
    return `rgb(${r},${g},${b})`;
  }

  // — C₁V₁ = C₂V₂ —
  let cvC1    = $state(10);
  let cvV1    = $state(0.1);
  let cvC2    = $state(1);
  let cvV2    = $state(0);
  let cvSolve = $state<'c1'|'v1'|'c2'|'v2'>('v2');
  let cvUnit  = $state<DilUnit>('mM');

  const cvResult = $derived.by((): number | null => {
    const [C1, V1, C2, V2] = [cvC1, cvV1, cvC2, cvV2];
    switch (cvSolve) {
      case 'v2': return C1 && V1 && C2 ? C1 * V1 / C2 : null;
      case 'c2': return C1 && V1 && V2 ? C1 * V1 / V2 : null;
      case 'v1': return C1 && C2 && V2 ? C2 * V2 / C1 : null;
      case 'c1': return V1 && C2 && V2 ? C2 * V2 / V1 : null;
    }
    return null;
  });

  function cvLabel(key: 'c1'|'v1'|'c2'|'v2'): string {
    return { c1: 'Stock concentration (C₁)', v1: 'Stock volume (V₁)', c2: 'Target concentration (C₂)', v2: 'Target volume (V₂)' }[key];
  }

  // — Cell seeding —
  const VESSELS: Record<string, { label: string; vol: number }> = {
    '96-well': { label: '96-well plate',  vol: 0.1  },
    '48-well': { label: '48-well plate',  vol: 0.25 },
    '24-well': { label: '24-well plate',  vol: 0.5  },
    '12-well': { label: '12-well plate',  vol: 1.0  },
    '6-well':  { label: '6-well plate',   vol: 2.0  },
    'T25':     { label: 'T-25 flask',     vol: 5.0  },
    'T75':     { label: 'T-75 flask',     vol: 15.0 },
    'T175':    { label: 'T-175 flask',    vol: 35.0 },
  };

  let seedCount      = $state(2500000);
  let seedViability  = $state(92);
  let seedVessel     = $state('96-well');
  let seedTarget     = $state(5000);
  let seedWells      = $state(96);

  const seedResult = $derived.by(() => {
    const viable = seedCount * (seedViability / 100);
    if (!viable || !seedTarget) return null;
    const volPerWellMl = seedTarget / viable;
    const vesselVol    = VESSELS[seedVessel]?.vol ?? 0.1;
    const mediumPerWell = Math.max(0, vesselVol - volPerWellMl);
    const totalTransferMl = volPerWellMl * seedWells;
    const warn = volPerWellMl > vesselVol
      ? 'Stock too dilute — increase cell density or seed fewer wells'
      : volPerWellMl * 1000 < 1.5
      ? 'Transfer volume <1.5 µL — dilute stock 5–10× to reduce pipetting error'
      : '';
    return {
      viable:      (viable / 1e6).toFixed(2),
      volPerWell:  (volPerWellMl * 1000).toFixed(1),   // µL
      mediumPerWell: (mediumPerWell * 1000).toFixed(1), // µL
      totalTransfer: (totalTransferMl * 1000).toFixed(0), // µL
      totalMedium:   (mediumPerWell * seedWells * 1000).toFixed(0), // µL
      warn,
    };
  });

  // ══════════════════════════════════════════════════════════
  // PANEL 2 — EXPERIMENTS
  // ══════════════════════════════════════════════════════════
  const EXP_TYPES: Record<string, { label: string; controls: string[] }> = {
    'cell-viability': { label: 'Cell Viability (MTT / CellTiter-Glo)', controls: [
      'Untreated cells — vehicle control (matched DMSO% or PBS)',
      'DMSO-only: ≤0.1% final in all wells',
      'Positive kill control: staurosporine 1 µM 24h or H₂O₂ 200 µM',
      'Reagent blank: medium + assay reagent, no cells',
      '≥3 biological replicates × triplicates per condition',
      'Equal seeding density confirmed before treatment (crystal violet or count)',
      'HGSOC: BRCA-deficient line (e.g. PEO1) + HR-proficient (e.g. PEO4)',
      'PARPi arms: full IC₅₀ curve — olaparib, niraparib, rucaparib',
    ]},
    'western-blot': { label: 'Western Blot', controls: [
      'Loading control: β-actin (42 kDa), GAPDH (37 kDa), or Vinculin (124 kDa)',
      'Positive control: cell line with confirmed high target expression',
      'Negative control: siRNA knockdown or CRISPR KO of target',
      'MW markers run in every gel',
      'Total protein equalisation: BCA or Bradford before loading (equal µg/lane)',
      'Background control: secondary-only (no primary antibody)',
      'Band quantification: normalise to loading control; report ratio ± SEM',
      'HGSOC: pRAD51 S120 + γH2AX S139 as DNA repair readout',
    ]},
    'flow-cytometry': { label: 'Flow Cytometry (Immune Phenotyping)', controls: [
      'Unstained control (all populations, all conditions)',
      'FMO controls for each fluorochrome',
      'Single-colour compensation controls (one per fluorochrome)',
      'Viability dye: unstained live + fixed dead cells',
      'Isotype controls for non-specific binding',
      'TME panel: CD45+ gating → T cell (CD3), NK (CD56), Macrophage (CD68), DC (CD11c)',
      'HGSOC ascites: fresh or ≤1 freeze-thaw; process within 4h; note ascites pH',
    ]},
    'qpcr': { label: 'qPCR', controls: [
      'No-template control (NTC) per primer pair',
      'No-RT control (genomic DNA contamination check)',
      '≥2 validated reference genes (GAPDH, ACTB, HPRT1 — validate per cell type)',
      'Positive control: high-expression cDNA',
      'Efficiency standard curve: 4-point dilution, E = 90–110%',
      'Melt curve: confirm single-peak per primer pair',
      'Technical triplicates; Cq CV < 0.5 within triplicates',
      'HGSOC: validate housekeepers under PARPi / ICB treatment (expression can shift)',
    ]},
    'if-icc': { label: 'IF / ICC', controls: [
      'Secondary-only control (no primary antibody)',
      'Isotype control (matched species + isotype)',
      'Positive control: high-expression cell line on same slide',
      'Negative control: siRNA knockdown or peptide block',
      'DAPI nuclear counterstain on all slides',
      'Equal exposure time across conditions (set on negative control)',
      'γH2AX + RAD51 foci: fix within 1h of treatment removal',
      'HGSOC: quantify nuclear vs cytoplasmic localisation of repair proteins',
    ]},
    'ex-vivo-tme': { label: 'Ex-vivo TME Co-culture', controls: [
      'Tumour cells only — baseline proliferation/viability (no immune cells)',
      'Immune cells only — spontaneous activation control',
      'Anti-CD3/CD28 stimulation — T cell activation positive control',
      'Isotype pair + each checkpoint blockade (anti-PD1, anti-PDL1, anti-CTLA4)',
      'Fresh vs cryopreserved immune cells: viability comparison before use',
      'Cytokine multiplex at ≥3 time points (IFNγ, IL-2, IL-10, TNFα, TGFβ)',
      'E:T killing curve (CellTiter-Glo or flow-based)',
      'HGSOC: autologous ascites TILs; flow-document TME composition before co-culture',
    ]},
    'scrna-seq': { label: 'scRNA-seq', controls: [
      'Ambient RNA correction: SoupX or DecontX post-mapping',
      'Doublet detection: DoubletFinder or Scrublet before clustering',
      'Cell viability >80% at capture (Calcein/7-AAD)',
      'Batch control: shared cell line spike-in across all batches',
      'QC: ≥20k reads/cell, ≥2k genes/cell, <25% MT genes',
      'ERCC spike-ins if absolute count normalisation needed',
      'Matched pre/post-treatment sample pairs per patient',
      'HGSOC: annotate tumour / immune / stromal clusters by canonical markers',
    ]},
    'crispr-screen': { label: 'CRISPR Screen', controls: [
      '≥100 non-targeting sgRNA sequences in library',
      'Essential gene depletion controls (RPL genes, proteasome subunits)',
      'Non-essential safe-harbour controls (should not deplete)',
      'Library representation ≥500× at transduction and end point',
      'MOI ≤0.3 — confirm single integration by titration',
      'T0 reference: post-selection pre-treatment plasmid DNA',
      'Per-replicate T0 vs Tend comparison (≥3 replicates)',
      'HGSOC: BRCA1/2 guides as positive controls for PARPi sensitiser screen',
    ]},
  };

  let expType    = $state('cell-viability');
  let checkState = $state<Record<string, boolean[]>>({});
  let bioReps    = $state(3);
  let techReps   = $state(3);
  let effectSize = $state(1.0);

  const nPerGroup = $derived(Math.ceil(2 * Math.pow((1.96 + 0.842) / Math.max(0.05, effectSize), 2)));
  const checkTotal = $derived((EXP_TYPES[expType]?.controls ?? []).length);
  const checkDone  = $derived(getChecks(expType).filter(Boolean).length);

  function getChecks(type: string): boolean[] {
    return checkState[type] ?? (EXP_TYPES[type]?.controls ?? []).map(() => false);
  }

  function toggleCheck(type: string, idx: number) {
    const cur = getChecks(type);
    const next = [...cur]; next[idx] = !next[idx];
    checkState = { ...checkState, [type]: next };
  }

  function resetChecks() {
    checkState = { ...checkState, [expType]: (EXP_TYPES[expType]?.controls ?? []).map(() => false) };
  }

  function insertProtocolNote() {
    const controls = EXP_TYPES[expType]?.controls ?? [];
    const label    = EXP_TYPES[expType]?.label ?? expType;
    const checks   = getChecks(expType);
    const md = controls.map((c, i) => `- [${checks[i] ? 'x' : ' '}] ${c}`).join('\n');
    const body = `# ${label} — Controls Checklist\n\n| | |\n|---|---|\n| **Biological replicates** | ${bioReps} |\n| **Technical replicates** | ${techReps} |\n| **Required n/group** (d=${effectSize}, α=0.05, power=0.8) | **${nPerGroup}** |\n\n## Controls\n\n${md}\n`;
    const note = { id: nanoid(), title: `Protocol: ${label}`, body, color: 'none', tags: ['protocol', 'lab'], wordTarget: 0, createdAt: Date.now(), updatedAt: Date.now() };
    store.notes.unshift(note);
    store.saveNotes();
    showToast('Protocol saved as note');
  }

  // ══════════════════════════════════════════════════════════
  // PANEL 3 — STATS ADVISOR
  // ══════════════════════════════════════════════════════════
  let stGroups  = $state('');
  let stPaired  = $state('');
  let stNormal  = $state('');
  let stStep    = $state(0);
  let stTest    = $state('');
  let stNote    = $state('');
  let stExplain = $state('');
  let stStreaming = $state(false);
  let stAbort: AbortController | null = null;

  function stDecide() {
    if (stGroups === '2') {
      if (stPaired === 'paired') {
        stTest = stNormal === 'no' ? 'Wilcoxon signed-rank test' : 'Paired t-test';
        stNote = 'Paired measurements (same subject/sample before and after). Wilcoxon is safer when normality is uncertain.';
      } else if (stNormal === 'no' || stNormal === 'unknown') {
        stTest = 'Mann-Whitney U test';
        stNote = 'Non-parametric test for two independent groups. Reports whether one distribution is stochastically larger. Report median ± IQR.';
      } else {
        stTest = 'Welch two-sample t-test';
        stNote = 'Preferred over Student\'s t for unequal variance. Confirm normality: Shapiro-Wilk (n<50) or Q-Q plot. Report mean ± SEM.';
      }
    } else if (stGroups === '3plus') {
      const post = 'Tukey HSD post-hoc';
      const npPost = 'Dunn post-hoc (Bonferroni)';
      if (stNormal === 'no' || stNormal === 'unknown') {
        stTest = stPaired === 'paired' ? `Friedman test + ${npPost}` : `Kruskal-Wallis + ${npPost}`;
        stNote = 'Non-parametric ANOVA. Family-wise error controlled by Bonferroni–Dunn correction. Report median ± IQR per group.';
      } else {
        stTest = stPaired === 'paired' ? `Repeated-measures ANOVA + ${post}` : `One-way ANOVA + ${post}`;
        stNote = 'Tukey HSD controls family-wise error across all pairwise comparisons. Confirm homoscedasticity: Levene\'s test. Report mean ± SEM.';
      }
    } else if (stGroups === 'timeseries') {
      stTest = 'Two-way ANOVA (time × treatment) + Tukey post-hoc, or mixed-effects model (for missing data)';
      stNote = 'Tests main effects of time, treatment, and their interaction. Mixed-effects model is robust to missing time points. Report F-statistic and interaction p-value.';
    } else if (stGroups === 'survival') {
      stTest = 'Kaplan-Meier curves + log-rank test; Cox proportional hazards model (for covariates)';
      stNote = 'Log-rank compares event-free survival. Cox HR adjusts for covariates — verify proportional hazards assumption. Report HR + 95% CI + median survival.';
    }
    stStep = 10;
  }

  async function runStatsExplain() {
    if (!stTest || stStreaming) return;
    stAbort?.abort();
    stAbort = new AbortController();
    stStreaming = true; stExplain = '';
    try {
      await streamStatsExplanation(stTest, (c) => { stExplain += c; }, stAbort.signal);
    } catch { /* aborted */ }
    stStreaming = false;
  }

  function stReset() {
    stGroups = ''; stPaired = ''; stNormal = ''; stStep = 0;
    stTest = ''; stNote = ''; stExplain = '';
    stStreaming = false; stAbort?.abort();
  }

  // ══════════════════════════════════════════════════════════
  // PANEL 4 — TROUBLESHOOT
  // ══════════════════════════════════════════════════════════
  let trbType      = $state('cell-viability');
  let trbProblem   = $state('');
  let trbText      = $state('');
  let trbStreaming  = $state(false);
  let trbAbort: AbortController | null = null;

  async function runTroubleshoot() {
    if (!trbProblem.trim() || trbStreaming) return;
    trbAbort?.abort();
    trbAbort = new AbortController();
    trbStreaming = true; trbText = '';
    try {
      await streamTroubleshoot(EXP_TYPES[trbType]?.label ?? trbType, trbProblem, (c) => { trbText += c; }, trbAbort.signal);
    } catch { /* aborted */ }
    trbStreaming = false;
  }

  function saveTrbNote() {
    if (!trbText) return;
    const body = `# Troubleshooting: ${EXP_TYPES[trbType]?.label ?? trbType}\n\n**Problem described:**\n${trbProblem}\n\n## Enzo's Differential Diagnosis\n\n${trbText}`;
    const note = { id: nanoid(), title: `Troubleshoot: ${EXP_TYPES[trbType]?.label ?? trbType}`, body, color: 'none', tags: ['troubleshoot', 'lab'], wordTarget: 0, createdAt: Date.now(), updatedAt: Date.now() };
    store.notes.unshift(note);
    store.saveNotes();
    showToast('Analysis saved as note');
  }

  // ══════════════════════════════════════════════════════════
  // PANEL 5 — REAGENT SEARCH
  // ══════════════════════════════════════════════════════════
  type Compound = { cid: number; name: string; iupacName: string; formula: string; mw: number; cas: string; synonyms: string[] };

  const EXAMPLE_COMPOUNDS: Compound[] = [
    { cid: 5978, name: 'Olaparib', iupacName: '4-[(3-[(4-cyclopropylcarbonyl)piperazin-4-yl]carbonyl)-4-fluorobenzyl]phthalazin-1(2H)-one', formula: 'C24H23FN4O3', mw: 434.5, cas: '763113-22-0', synonyms: ['AZD-2281', 'KU-0059436', 'Lynparza', 'PARP1 inhibitor'] },
    { cid: 24785286, name: 'Niraparib', iupacName: '2-{4-[(3S)-3-piperidinyl]phenyl}-2H-indazole-7-carboxamide', formula: 'C19H20N4O', mw: 320.4, cas: '1038915-60-4', synonyms: ['MK-4827', 'Zejula', 'PARP1/2 inhibitor'] },
    { cid: 2723601, name: 'Carboplatin', iupacName: 'azane;cyclobutane-1,1-dicarboxylate;platinum(2+)', formula: 'C6H14N2O4Pt', mw: 371.2, cas: '41575-94-4', synonyms: ['Paraplatin', 'CBDCA', 'JM-8', 'Platinum compound'] },
  ];

  let rqQuery      = $state('');
  let rqResults    = $state<Compound[]>([]);
  let rqLoading    = $state(false);
  let rqError      = $state('');
  let rqCitation   = $state<Record<number, string>>({});
  let rqCitLoading = $state<Record<number, boolean>>({});

  const displayCompounds = $derived(rqResults.length ? rqResults : EXAMPLE_COMPOUNDS);

  // ── Stats choices (avoid template type casts) ────────────────────────────────
  const STATS_GROUP_CHOICES = [
    { v: '2',          l: 'Two groups (e.g. treated vs untreated)' },
    { v: '3plus',      l: 'Three or more groups' },
    { v: 'timeseries', l: 'Time-course / longitudinal data' },
    { v: 'survival',   l: 'Survival / time-to-event' },
  ];
  const STATS_NORMAL_CHOICES = [
    { v: 'yes',     l: 'Yes — confirmed normal (Shapiro-Wilk p>0.05, Q-Q plot)' },
    { v: 'no',      l: 'No — skewed, ordinal, or discrete data' },
    { v: 'unknown', l: "Unsure / small sample (n<15)" },
  ];
  const STATS_BREADCRUMB_MAP: Record<string, string> = {
    '2': 'Two groups', '3plus': '3+ groups', 'timeseries': 'Time series', 'survival': 'Survival',
    'paired': 'Paired', 'unpaired': 'Unpaired',
    'yes': 'Normal', 'no': 'Non-normal', 'unknown': 'Unknown distrib.',
  };

  // ── Nav items (defined here to avoid type casts in template) ─────────────────
  const NAV_ITEMS: { id: typeof panel; label: string; path: string }[] = [
    { id: 'dilutions',    label: 'Dilutions',    path: 'M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z' },
    { id: 'experiments',  label: 'Experiments',  path: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4' },
    { id: 'stats',        label: 'Stats',        path: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
    { id: 'troubleshoot', label: 'Troubleshoot', path: 'M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
    { id: 'reagents',     label: 'Reagents',     path: 'M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z' },
  ];

  async function searchReagents() {
    if (!rqQuery.trim()) return;
    rqLoading = true; rqError = ''; rqResults = [];
    try {
      const base = (window as any).__qonco_worker ?? 'https://enzo.quant-onco.workers.dev';
      const res = await fetch(`${base}/reagents?q=${encodeURIComponent(rqQuery.trim())}`);
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json();
      rqResults = data.compounds ?? [];
      if (!rqResults.length) rqError = 'No compounds found — try a synonym or CAS number.';
    } catch {
      rqError = 'PubChem lookup unavailable — showing example compounds.';
    } finally {
      rqLoading = false;
    }
  }

  async function fetchCitation(r: Compound) {
    if (rqCitLoading[r.cid] || rqCitation[r.cid]) return;
    rqCitLoading = { ...rqCitLoading, [r.cid]: true };
    try {
      let text = '';
      await streamReagentCitation(r.name, r.cas, (c) => { text += c; });
      rqCitation = { ...rqCitation, [r.cid]: text };
    } catch {
      rqCitation = { ...rqCitation, [r.cid]: 'Could not retrieve citation data.' };
    } finally {
      rqCitLoading = { ...rqCitLoading, [r.cid]: false };
    }
  }

  function insertReagentNote(r: Compound) {
    const citation = rqCitation[r.cid] ? `\n## Most Cited Vendor / Cat#\n\n${rqCitation[r.cid]}` : '';
    const body = `# ${r.name}\n\n| Field | Value |\n|---|---|\n| **CAS** | ${r.cas || '—'} |\n| **Formula** | ${r.formula} |\n| **MW** | ${r.mw} g/mol |\n| **PubChem CID** | [${r.cid}](https://pubchem.ncbi.nlm.nih.gov/compound/${r.cid}) |\n\n**Synonyms:** ${r.synonyms.slice(0, 8).join(', ')}${citation}\n`;
    const note = { id: nanoid(), title: r.name, body, color: 'none', tags: ['reagent', 'lab'], wordTarget: 0, createdAt: Date.now(), updatedAt: Date.now() };
    store.notes.unshift(note);
    store.saveNotes();
    showToast(`${r.name} saved as note`);
  }
</script>

<div class="lt-view">

  <!-- ── Panel navigation ─────────────────────────────────── -->
  <nav class="lt-nav">
    {#each NAV_ITEMS as item}
      <button class="lt-nav-btn" class:active={panel === item.id}
        onclick={() => panel = item.id}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
          <path d={item.path}/>
        </svg>
        {item.label}
      </button>
    {/each}
  </nav>

  <div class="lt-body">

    <!-- ══════════════════════════════════════════════
         DILUTIONS
    ══════════════════════════════════════════════ -->
    {#if panel === 'dilutions'}
      <div class="lt-panel">
        <div class="lt-sub-tabs">
          <button class:active={dilTab === 'serial'}  onclick={() => dilTab = 'serial'}>Serial dilution</button>
          <button class:active={dilTab === 'c1v1'}    onclick={() => dilTab = 'c1v1'}>C₁V₁ = C₂V₂</button>
          <button class:active={dilTab === 'seeding'} onclick={() => dilTab = 'seeding'}>Cell seeding</button>
        </div>

        {#if dilTab === 'serial'}
          <div class="calc-grid">
            <div class="calc-form">
              <div class="field-row">
                <label>Starting concentration</label>
                <div class="input-unit-row">
                  <input type="number" bind:value={sdConc} min="0" step="any" class="calc-input" />
                  <select bind:value={sdUnit} class="unit-select">
                    {#each UNITS as u}<option value={u}>{u}</option>{/each}
                  </select>
                </div>
              </div>
              <div class="field-row">
                <label>Dilution factor</label>
                <input type="number" bind:value={sdFactor} min="2" step="1" class="calc-input narrow" />
                <span class="field-hint">× per step</span>
              </div>
              <div class="field-row">
                <label>Number of steps</label>
                <input type="number" bind:value={sdSteps} min="2" max="12" step="1" class="calc-input narrow" />
              </div>
              <div class="field-row">
                <label>Volume per tube (mL)</label>
                <input type="number" bind:value={sdVol} min="0.01" step="any" class="calc-input narrow" />
              </div>
            </div>

            <div class="calc-result">
              <!-- SVG tube chain diagram -->
              <div class="tube-chain-wrap" aria-hidden="true">
                <svg class="tube-chain" viewBox={`0 0 ${(sdSteps + 1) * 56} 90`} preserveAspectRatio="xMidYMid meet">
                  {#each sdRows as row, i}
                    {@const x = i * 56 + 8}
                    <!-- tube body -->
                    <rect x={x} y="8" width="32" height="50" rx="4" fill={tubeHue(i, sdSteps)} stroke="rgba(255,255,255,0.15)" stroke-width="1"/>
                    <!-- liquid level (80% fill) -->
                    <rect x={x + 2} y="14" width="28" height="38" rx="2" fill={tubeHue(i, sdSteps)} opacity="0.6"/>
                    <!-- cap -->
                    <rect x={x + 4} y="4" width="24" height="8" rx="3" fill="rgba(255,255,255,0.25)"/>
                    <!-- concentration label -->
                    <text x={x + 16} y="78" text-anchor="middle" font-size="7" fill="var(--tx2)" font-family="monospace">
                      {fmtConc(row.conc)}
                    </text>
                    <!-- arrow to next -->
                    {#if i < sdSteps}
                      <line x1={x + 34} y1="33" x2={x + 48} y2="33" stroke="var(--bd2)" stroke-width="1.2"/>
                      <polygon points={`${x+48},30 ${x+52},33 ${x+48},36`} fill="var(--bd2)"/>
                    {/if}
                  {/each}
                </svg>
              </div>
              <!-- Results table -->
              <div class="sd-table-wrap">
                <table class="lt-table">
                  <thead>
                    <tr>
                      <th>Tube</th>
                      <th>Conc ({sdUnit})</th>
                      <th>From prev (mL)</th>
                      <th>Diluent (mL)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {#each sdRows as row}
                      <tr>
                        <td>{row.step === 0 ? 'Stock' : `#${row.step}`}</td>
                        <td class="mono">{row.conc >= 0.001 ? row.conc.toPrecision(3) : row.conc.toExponential(2)}</td>
                        <td class="mono">{row.step === 0 ? '—' : row.fromPrev.toPrecision(2)}</td>
                        <td class="mono">{row.step === 0 ? '—' : row.diluent.toPrecision(3)}</td>
                      </tr>
                    {/each}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

        {:else if dilTab === 'c1v1'}
          <div class="c1v1-wrap">
            <p class="calc-subtitle">Solve for any one unknown. Select which value to calculate:</p>
            <div class="solve-chips">
              {#each (['c1','v1','c2','v2'] satisfies (typeof cvSolve)[]) as key}
                <button class="solve-chip" class:active={cvSolve === key} onclick={() => cvSolve = key}>
                  Solve for {key === 'c1' ? 'C₁' : key === 'v1' ? 'V₁' : key === 'c2' ? 'C₂' : 'V₂'}
                </button>
              {/each}
            </div>
            <div class="c1v1-fields">
              <!-- C1 -->
              <div class="c1v1-field" class:solving={cvSolve === 'c1'}>
                <label><span class="sym">C₁</span><span class="desc">{cvLabel('c1')}</span></label>
                {#if cvSolve === 'c1'}
                  <div class="solve-result">{cvResult !== null ? cvResult.toPrecision(4) : '—'}<span class="unit-pill">{cvUnit}</span></div>
                {:else}
                  <div class="input-unit-row"><input type="number" bind:value={cvC1} min="0" step="any" class="calc-input" /><span class="unit-pill">{cvUnit}</span></div>
                {/if}
              </div>
              <!-- V1 -->
              <div class="c1v1-field" class:solving={cvSolve === 'v1'}>
                <label><span class="sym">V₁</span><span class="desc">{cvLabel('v1')}</span></label>
                {#if cvSolve === 'v1'}
                  <div class="solve-result">{cvResult !== null ? cvResult.toPrecision(4) : '—'}<span class="unit-pill">mL</span></div>
                {:else}
                  <div class="input-unit-row"><input type="number" bind:value={cvV1} min="0" step="any" class="calc-input" /><span class="unit-pill">mL</span></div>
                {/if}
              </div>
              <!-- C2 -->
              <div class="c1v1-field" class:solving={cvSolve === 'c2'}>
                <label><span class="sym">C₂</span><span class="desc">{cvLabel('c2')}</span></label>
                {#if cvSolve === 'c2'}
                  <div class="solve-result">{cvResult !== null ? cvResult.toPrecision(4) : '—'}<span class="unit-pill">{cvUnit}</span></div>
                {:else}
                  <div class="input-unit-row"><input type="number" bind:value={cvC2} min="0" step="any" class="calc-input" /><span class="unit-pill">{cvUnit}</span></div>
                {/if}
              </div>
              <!-- V2 -->
              <div class="c1v1-field" class:solving={cvSolve === 'v2'}>
                <label><span class="sym">V₂</span><span class="desc">{cvLabel('v2')}</span></label>
                {#if cvSolve === 'v2'}
                  <div class="solve-result">{cvResult !== null ? cvResult.toPrecision(4) : '—'}<span class="unit-pill">mL</span></div>
                {:else}
                  <div class="input-unit-row"><input type="number" bind:value={cvV2} min="0" step="any" class="calc-input" /><span class="unit-pill">mL</span></div>
                {/if}
              </div>
            </div>
            <div class="field-row" style="margin-top:12px">
              <label>Concentration unit</label>
              <select bind:value={cvUnit} class="unit-select">
                {#each UNITS as u}<option value={u}>{u}</option>{/each}
              </select>
            </div>
            {#if cvResult !== null}
              <div class="answer-box">
                <strong>{cvSolve === 'c1' ? 'C₁' : cvSolve === 'v1' ? 'V₁' : cvSolve === 'c2' ? 'C₂' : 'V₂'}</strong>
                = <span class="answer-val">{cvResult.toPrecision(4)}</span>
                <span class="unit-pill">{cvSolve.startsWith('c') ? cvUnit : 'mL'}</span>
              </div>
            {/if}
          </div>

        {:else if dilTab === 'seeding'}
          <div class="calc-grid">
            <div class="calc-form">
              <div class="field-row">
                <label>Cell count (cells/mL)</label>
                <input type="number" bind:value={seedCount} min="0" step="10000" class="calc-input" />
                <span class="field-hint">{(seedCount / 1e6).toFixed(2)} ×10⁶/mL</span>
              </div>
              <div class="field-row">
                <label>Viability (%)</label>
                <input type="number" bind:value={seedViability} min="0" max="100" step="1" class="calc-input narrow" />
              </div>
              <div class="field-row">
                <label>Target seeding density</label>
                <input type="number" bind:value={seedTarget} min="0" step="1000" class="calc-input" />
                <span class="field-hint">cells per well/flask</span>
              </div>
              <div class="field-row">
                <label>Vessel type</label>
                <select bind:value={seedVessel} class="unit-select wide">
                  {#each Object.entries(VESSELS) as [k, v]}<option value={k}>{v.label} ({v.vol} mL)</option>{/each}
                </select>
              </div>
              <div class="field-row">
                <label>Number of wells/flasks</label>
                <input type="number" bind:value={seedWells} min="1" step="1" class="calc-input narrow" />
              </div>
            </div>

            {#if seedResult}
              <div class="seed-result">
                {#if seedResult.warn}
                  <div class="lt-warn">{seedResult.warn}</div>
                {/if}
                <div class="seed-metric-grid">
                  <div class="seed-metric">
                    <span class="seed-val">{seedResult.viable} ×10⁶</span>
                    <span class="seed-lbl">Viable cells/mL</span>
                  </div>
                  <div class="seed-metric">
                    <span class="seed-val">{seedResult.volPerWell} µL</span>
                    <span class="seed-lbl">Cell suspension / well</span>
                  </div>
                  <div class="seed-metric">
                    <span class="seed-val">{seedResult.mediumPerWell} µL</span>
                    <span class="seed-lbl">Complete medium / well</span>
                  </div>
                  <div class="seed-metric">
                    <span class="seed-val">{seedResult.totalTransfer} µL</span>
                    <span class="seed-lbl">Total suspension needed</span>
                  </div>
                  <div class="seed-metric">
                    <span class="seed-val">{seedResult.totalMedium} µL</span>
                    <span class="seed-lbl">Total medium needed</span>
                  </div>
                </div>
              </div>
            {/if}
          </div>
        {/if}
      </div>

    <!-- ══════════════════════════════════════════════
         EXPERIMENTS
    ══════════════════════════════════════════════ -->
    {:else if panel === 'experiments'}
      <div class="lt-panel">
        <div class="exp-header">
          <div class="field-row">
            <label>Experiment type</label>
            <select bind:value={expType} class="unit-select wide">
              {#each Object.entries(EXP_TYPES) as [k, v]}<option value={k}>{v.label}</option>{/each}
            </select>
          </div>
          <div class="rep-row">
            <div class="field-row compact">
              <label>Biological replicates</label>
              <input type="number" bind:value={bioReps} min="1" max="20" class="calc-input narrow" />
            </div>
            <div class="field-row compact">
              <label>Technical replicates</label>
              <input type="number" bind:value={techReps} min="1" max="20" class="calc-input narrow" />
            </div>
          </div>
        </div>

        <div class="power-section">
          <div class="power-header">
            <span class="section-label">Power analysis (α=0.05, power=0.8)</span>
            <div class="power-result-pill">n = <strong>{nPerGroup}</strong> per group</div>
          </div>
          <div class="field-row">
            <label>Effect size (Cohen's d): <strong>{effectSize.toFixed(1)}</strong></label>
            <input type="range" bind:value={effectSize} min="0.2" max="3" step="0.1" class="effect-slider" />
          </div>
          <div class="effect-ref">
            <span class:ref-active={effectSize < 0.5}>Small (d&lt;0.5)</span>
            <span class:ref-active={effectSize >= 0.5 && effectSize < 0.8}>Medium (0.5–0.8)</span>
            <span class:ref-active={effectSize >= 0.8 && effectSize < 1.5}>Large (0.8–1.5)</span>
            <span class:ref-active={effectSize >= 1.5}>Very large (&gt;1.5, typical in vitro)</span>
          </div>
        </div>

        <div class="checklist-section">
          <div class="checklist-header">
            <span class="section-label">Controls checklist</span>
            <div class="checklist-actions">
              <button class="btn btn-ghost btn-xs" onclick={resetChecks}>Reset</button>
              <button class="btn btn-primary btn-xs" onclick={insertProtocolNote}>Save as note</button>
            </div>
          </div>
          <div class="checklist">
            {#each (EXP_TYPES[expType]?.controls ?? []) as control, i}
              {@const checked = getChecks(expType)[i]}
              <!-- svelte-ignore a11y_click_events_have_key_events -->
              <!-- svelte-ignore a11y_no_static_element_interactions -->
              <div class="check-item" class:checked onclick={() => toggleCheck(expType, i)}>
                <div class="check-box" class:checked>
                  {#if checked}
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
                  {/if}
                </div>
                <span class="check-label">{control}</span>
              </div>
            {/each}
          </div>
          <div class="checklist-progress">
            <div class="progress-bar"><div class="progress-fill" style="width:{checkTotal ? checkDone/checkTotal*100 : 0}%"></div></div>
            <span class="text-xs text-mu">{checkDone}/{checkTotal} controls confirmed</span>
          </div>
        </div>
      </div>

    <!-- ══════════════════════════════════════════════
         STATS ADVISOR
    ══════════════════════════════════════════════ -->
    {:else if panel === 'stats'}
      <div class="lt-panel stats-panel">
        {#if stStep === 0}
          <div class="stats-step">
            <p class="stats-q">How many groups or conditions are you comparing?</p>
            <div class="stats-choices">
              {#each STATS_GROUP_CHOICES as choice}
                <button class="stats-btn" onclick={() => {
                  stGroups = choice.v;
                  if (choice.v === 'timeseries' || choice.v === 'survival') { stDecide(); }
                  else { stStep = 1; }
                }}>{choice.l}</button>
              {/each}
            </div>
          </div>

        {:else if stStep === 1 && (stGroups === '2' || stGroups === '3plus')}
          <div class="stats-step">
            <div class="stats-breadcrumb"><span>{stGroups === '2' ? 'Two groups' : '3+ groups'}</span></div>
            <p class="stats-q">Are measurements paired (same subject/sample before and after)?</p>
            <div class="stats-choices">
              <button class="stats-btn" onclick={() => { stPaired = 'paired'; stStep = 2; }}>
                Paired — same subjects/samples across conditions
              </button>
              <button class="stats-btn" onclick={() => { stPaired = 'unpaired'; stStep = 2; }}>
                Unpaired — independent groups
              </button>
            </div>
          </div>

        {:else if stStep === 2 && (stGroups === '2' || stGroups === '3plus')}
          <div class="stats-step">
            <div class="stats-breadcrumb">
              <span>{stGroups === '2' ? 'Two groups' : '3+ groups'}</span>
              <span>{stPaired === 'paired' ? 'Paired' : 'Unpaired'}</span>
            </div>
            <p class="stats-q">Is your data approximately normally distributed?</p>
            <div class="stats-choices">
              <button class="stats-btn" onclick={() => { stNormal = 'yes'; stDecide(); }}>
                Yes — confirmed normal (Shapiro-Wilk p&gt;0.05, Q-Q plot)
              </button>
              <button class="stats-btn" onclick={() => { stNormal = 'no'; stDecide(); }}>
                No — skewed, ordinal, or discrete data
              </button>
              <button class="stats-btn" onclick={() => { stNormal = 'unknown'; stDecide(); }}>
                Unsure / small sample (n&lt;15)
              </button>
            </div>
          </div>

        {/if}

        {#if stStep === 10 && stTest}
          <div class="stats-result">
            <div class="stats-breadcrumb">
              {#if stGroups}<span>{STATS_BREADCRUMB_MAP[stGroups] ?? stGroups}</span>{/if}
              {#if stPaired}<span>{STATS_BREADCRUMB_MAP[stPaired] ?? stPaired}</span>{/if}
              {#if stNormal}<span>{STATS_BREADCRUMB_MAP[stNormal] ?? stNormal}</span>{/if}
            </div>
            <div class="test-recommendation">
              <div class="test-name-row">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--gn)" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
                <span class="test-name">{stTest}</span>
              </div>
              <p class="test-note text-sm text-mu">{stNote}</p>
            </div>
            <div class="stats-explain-section">
              <div class="explain-head">
                <span class="section-label">How this test works</span>
                <button class="btn btn-ghost btn-sm enzo-btn"
                  disabled={stStreaming}
                  onclick={runStatsExplain}>
                  {#if stStreaming}
                    <span class="spinner-xs-inline"></span> Thinking…
                  {:else}
                    <span class="enzo-dot-tiny"></span> Ask Enzo <span class="model-pill">[70B]</span>
                  {/if}
                </button>
              </div>
              {#if stExplain || stStreaming}
                <div class="explain-body text-sm" style="white-space:pre-wrap;line-height:1.7">{stExplain}{stStreaming ? '▋' : ''}</div>
              {/if}
            </div>
            <button class="btn btn-ghost btn-sm" onclick={stReset} style="margin-top:12px">
              Start over
            </button>
          </div>
        {/if}
      </div>

    <!-- ══════════════════════════════════════════════
         TROUBLESHOOT
    ══════════════════════════════════════════════ -->
    {:else if panel === 'troubleshoot'}
      <div class="lt-panel">
        <div class="trb-form">
          <div class="field-row">
            <label>Experiment type</label>
            <select bind:value={trbType} class="unit-select wide">
              {#each Object.entries(EXP_TYPES) as [k, v]}<option value={k}>{v.label}</option>{/each}
            </select>
          </div>
          <div class="field-col">
            <label>Describe the problem you observed</label>
            <textarea
              bind:value={trbProblem}
              rows={5}
              placeholder="e.g. Signal intensity dropped 50% compared to last week's Western blot. Same antibody, same cell line. Changed nothing except using a new batch of lysis buffer…"
              class="trb-textarea"
            ></textarea>
          </div>
          <div class="trb-actions">
            <button class="btn btn-primary" onclick={runTroubleshoot}
              disabled={!trbProblem.trim() || trbStreaming}>
              {#if trbStreaming}
                <span class="spinner-xs-inline"></span> Analysing…
              {:else}
                <span class="enzo-dot-tiny"></span>
                Ask Enzo <span class="model-pill">[70B]</span>
              {/if}
            </button>
            {#if trbStreaming}
              <button class="btn btn-ghost btn-sm" onclick={() => { trbAbort?.abort(); trbStreaming = false; }}>Stop</button>
            {/if}
          </div>
        </div>

        {#if trbText || trbStreaming}
          <div class="trb-result">
            <div class="trb-result-head">
              <span class="section-label">Differential diagnosis</span>
              {#if !trbStreaming && trbText}
                <button class="btn btn-ghost btn-xs" onclick={saveTrbNote}>Save as note</button>
              {/if}
            </div>
            <div class="trb-body text-sm" style="white-space:pre-wrap;line-height:1.75">{trbText}{trbStreaming ? '▋' : ''}</div>
          </div>
        {/if}
      </div>

    <!-- ══════════════════════════════════════════════
         REAGENTS
    ══════════════════════════════════════════════ -->
    {:else if panel === 'reagents'}
      <div class="lt-panel">
        <div class="rq-search-row">
          <input
            class="search-input rq-input"
            type="search"
            bind:value={rqQuery}
            placeholder="Search compound: olaparib, carboplatin, staurosporine, DMSO…"
            onkeydown={(e) => { if (e.key === 'Enter' && !rqLoading) searchReagents(); }}
          />
          <button class="btn btn-primary btn-sm" onclick={searchReagents} disabled={rqLoading}>
            {rqLoading ? 'Searching…' : 'Search PubChem'}
          </button>
        </div>
        {#if rqError}
          <div class="feed-notice text-xs text-mu">{rqError}</div>
        {/if}
        {#if !rqResults.length && !rqLoading}
          <p class="text-xs text-mu" style="margin:6px 0 8px">Showing HGSOC-relevant examples — search to find any compound.</p>
        {/if}

        <div class="rq-list">
          {#each displayCompounds as r (r.cid)}
            <div class="rq-card">
              <div class="rq-head">
                <div>
                  <h3 class="rq-name">{r.name}</h3>
                  <div class="rq-meta">
                    {#if r.cas}<span class="rq-cas">CAS {r.cas}</span>{/if}
                    <span class="rq-formula mono">{r.formula}</span>
                    <span class="rq-mw text-mu">MW {r.mw} g/mol</span>
                  </div>
                </div>
                <a class="btn btn-ghost btn-xs" href="https://pubchem.ncbi.nlm.nih.gov/compound/{r.cid}"
                  target="_blank" rel="noreferrer">PubChem ↗</a>
              </div>
              {#if r.synonyms.length}
                <div class="rq-syns text-xs text-mu">
                  {r.synonyms.slice(0, 6).join(' · ')}
                </div>
              {/if}
              {#if rqCitation[r.cid]}
                <div class="rq-citation text-sm">
                  <div class="citation-label">Most cited</div>
                  <div style="white-space:pre-wrap;line-height:1.6">{rqCitation[r.cid]}</div>
                </div>
              {/if}
              <div class="rq-actions">
                <button class="btn btn-ghost btn-sm"
                  onclick={() => fetchCitation(r)}
                  disabled={rqCitLoading[r.cid] || !!rqCitation[r.cid]}>
                  {#if rqCitLoading[r.cid]}
                    <span class="spinner-xs-inline"></span> Asking Enzo…
                  {:else if rqCitation[r.cid]}
                    <span class="enzo-dot-tiny"></span> Cited
                  {:else}
                    <span class="enzo-dot-tiny"></span> Most cited vendor
                  {/if}
                </button>
                <button class="btn btn-ghost btn-sm" onclick={() => insertReagentNote(r)}>
                  Insert to notes
                </button>
              </div>
            </div>
          {/each}
        </div>
      </div>
    {/if}

  </div>
</div>

<style>
  .lt-view { display: flex; flex-direction: column; height: 100%; min-height: 0; }

  /* ── Nav ── */
  .lt-nav {
    display: flex; gap: 2px; padding: 10px 14px 0;
    border-bottom: 1px solid var(--bd); flex-shrink: 0; flex-wrap: wrap;
  }
  .lt-nav-btn {
    display: flex; align-items: center; gap: 6px;
    padding: 7px 13px; border-radius: 6px 6px 0 0; font-size: 0.78rem; font-weight: 500;
    background: transparent; border: 1px solid transparent; border-bottom: none;
    color: var(--tx2); cursor: pointer; transition: background 0.15s, color 0.15s;
  }
  .lt-nav-btn:hover { background: var(--sf2); }
  .lt-nav-btn.active { background: var(--sf); border-color: var(--bd); color: var(--ac); }

  /* ── Body ── */
  .lt-body { flex: 1; min-height: 0; overflow-y: auto; padding: 16px; }
  .lt-panel { display: flex; flex-direction: column; gap: 16px; }

  /* ── Sub-tabs ── */
  .lt-sub-tabs { display: flex; gap: 4px; flex-wrap: wrap; }
  .lt-sub-tabs button {
    padding: 5px 14px; border-radius: 20px; font-size: 0.75rem; font-weight: 500;
    background: var(--sf); border: 1px solid var(--bd); color: var(--tx2); cursor: pointer;
  }
  .lt-sub-tabs button:hover { border-color: var(--bd2); }
  .lt-sub-tabs button.active { background: var(--ac-bg); color: var(--ac); border-color: var(--ac); }

  /* ── Form elements ── */
  .calc-grid { display: grid; grid-template-columns: 300px 1fr; gap: 20px; align-items: start; }
  @media (max-width: 700px) { .calc-grid { grid-template-columns: 1fr; } }
  .calc-form { display: flex; flex-direction: column; gap: 12px; }
  .field-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .field-row label { font-size: 0.78rem; color: var(--tx2); min-width: 160px; }
  .field-col { display: flex; flex-direction: column; gap: 6px; }
  .field-col label { font-size: 0.78rem; color: var(--tx2); }
  .field-hint { font-size: 0.72rem; color: var(--mu); }
  .calc-input {
    width: 120px; padding: 5px 8px; background: var(--sf); border: 1px solid var(--bd);
    border-radius: var(--radius); color: var(--tx); font-size: 0.82rem;
  }
  .calc-input.narrow { width: 70px; }
  .calc-input:focus { outline: none; border-color: var(--ac); }
  .input-unit-row { display: flex; align-items: center; gap: 4px; }
  .unit-select {
    padding: 5px 8px; background: var(--sf); border: 1px solid var(--bd);
    border-radius: var(--radius); color: var(--tx2); font-size: 0.78rem; cursor: pointer;
  }
  .unit-select.wide { min-width: 220px; }

  /* ── Serial dilution ── */
  .tube-chain-wrap { overflow-x: auto; padding: 6px 0 4px; }
  .tube-chain { width: 100%; max-width: 600px; height: 90px; display: block; }
  .sd-table-wrap { overflow-x: auto; margin-top: 8px; }
  .calc-subtitle { font-size: 0.78rem; color: var(--mu); margin: 0 0 10px; }

  /* ── LT Table ── */
  .lt-table { width: 100%; border-collapse: collapse; font-size: 0.78rem; }
  .lt-table th { background: var(--sf2); color: var(--tx2); font-weight: 600; padding: 6px 10px; text-align: left; border-bottom: 1px solid var(--bd); }
  .lt-table td { padding: 5px 10px; border-bottom: 1px solid var(--bd); color: var(--tx); }
  .lt-table tr:last-child td { border-bottom: none; }
  .lt-table .mono { font-family: var(--font-mono, monospace); font-size: 0.75rem; }

  /* ── C1V1 ── */
  .c1v1-wrap { display: flex; flex-direction: column; gap: 14px; max-width: 520px; }
  .solve-chips { display: flex; gap: 6px; flex-wrap: wrap; }
  .solve-chip {
    padding: 4px 12px; border-radius: 16px; font-size: 0.75rem; font-weight: 500;
    background: var(--sf); border: 1px solid var(--bd); color: var(--tx2); cursor: pointer;
  }
  .solve-chip.active { background: var(--ac-bg); color: var(--ac); border-color: var(--ac); }
  .c1v1-fields { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  @media (max-width: 500px) { .c1v1-fields { grid-template-columns: 1fr; } }
  .c1v1-field { background: var(--sf); border: 1px solid var(--bd); border-radius: var(--radius); padding: 10px 12px; }
  .c1v1-field.solving { border-color: var(--ac); background: var(--ac-bg); }
  .c1v1-field label { display: flex; flex-direction: column; gap: 2px; margin-bottom: 8px; }
  .c1v1-field .sym { font-size: 1.1rem; font-weight: 700; color: var(--ac); font-style: italic; }
  .c1v1-field .desc { font-size: 0.7rem; color: var(--mu); }
  .solve-result { font-size: 1.2rem; font-weight: 700; color: var(--ac); font-family: monospace; display: flex; align-items: center; gap: 6px; }
  .unit-pill { font-size: 0.7rem; background: var(--sf2); color: var(--mu); padding: 1px 6px; border-radius: 8px; font-weight: 500; }
  .answer-box {
    background: var(--ac-bg); border: 1px solid var(--ac); border-radius: var(--radius);
    padding: 10px 16px; font-size: 1rem; display: flex; align-items: center; gap: 8px;
  }
  .answer-val { font-size: 1.4rem; font-weight: 700; color: var(--ac); font-family: monospace; }

  /* ── Cell seeding ── */
  .seed-result { display: flex; flex-direction: column; gap: 10px; }
  .seed-metric-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 10px; }
  .seed-metric {
    background: var(--sf); border: 1px solid var(--bd); border-radius: var(--radius);
    padding: 10px 12px; display: flex; flex-direction: column; gap: 4px;
  }
  .seed-val { font-size: 1.1rem; font-weight: 700; color: var(--ac); font-family: monospace; }
  .seed-lbl { font-size: 0.68rem; color: var(--mu); }
  .lt-warn {
    background: rgba(255,200,0,.1); border: 1px solid rgba(255,200,0,.3);
    border-radius: var(--radius); padding: 7px 12px; font-size: 0.78rem; color: var(--yw);
  }

  /* ── Experiments ── */
  .exp-header { display: flex; flex-direction: column; gap: 10px; }
  .rep-row { display: flex; gap: 16px; flex-wrap: wrap; }
  .field-row.compact label { min-width: 130px; }
  .power-section {
    background: var(--sf); border: 1px solid var(--bd); border-radius: var(--radius);
    padding: 12px 14px; display: flex; flex-direction: column; gap: 8px;
  }
  .power-header { display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap; }
  .power-result-pill {
    background: var(--ac-bg); color: var(--ac); border: 1px solid var(--ac);
    padding: 3px 12px; border-radius: 20px; font-size: 0.82rem;
  }
  .effect-slider { width: 100%; max-width: 320px; accent-color: var(--ac); }
  .effect-ref { display: flex; gap: 10px; flex-wrap: wrap; }
  .effect-ref span { font-size: 0.68rem; color: var(--mu); padding: 2px 7px; border-radius: 10px; border: 1px solid var(--bd); }
  .effect-ref span.ref-active { color: var(--ac); border-color: var(--ac); background: var(--ac-bg); }
  .section-label { font-size: 0.72rem; font-weight: 600; color: var(--mu); text-transform: uppercase; letter-spacing: 0.06em; }
  .checklist-section { display: flex; flex-direction: column; gap: 8px; }
  .checklist-header { display: flex; align-items: center; justify-content: space-between; }
  .checklist-actions { display: flex; gap: 6px; }
  .checklist { display: flex; flex-direction: column; gap: 3px; }
  .check-item {
    display: flex; align-items: flex-start; gap: 9px;
    padding: 7px 10px; border-radius: 6px; cursor: pointer;
    border: 1px solid transparent; transition: background 0.1s;
  }
  .check-item:hover { background: var(--sf2); }
  .check-item.checked { background: rgba(0,200,100,.06); border-color: rgba(0,200,100,.15); }
  .check-box {
    width: 16px; height: 16px; border: 1.5px solid var(--bd2); border-radius: 4px;
    flex-shrink: 0; margin-top: 1px;
    display: flex; align-items: center; justify-content: center;
  }
  .check-box.checked { background: var(--gn); border-color: var(--gn); color: #000; }
  .check-label { font-size: 0.78rem; line-height: 1.5; color: var(--tx2); }
  .check-item.checked .check-label { color: var(--mu); text-decoration: line-through; }
  .checklist-progress { display: flex; align-items: center; gap: 8px; margin-top: 4px; }
  .progress-bar { flex: 1; height: 4px; background: var(--bd); border-radius: 2px; max-width: 200px; }
  .progress-fill { height: 100%; background: var(--gn); border-radius: 2px; transition: width 0.3s; }

  /* ── Stats ── */
  .stats-panel { max-width: 600px; }
  .stats-step { display: flex; flex-direction: column; gap: 12px; }
  .stats-q { font-size: 0.9rem; font-weight: 500; color: var(--tx); margin: 0; }
  .stats-choices { display: flex; flex-direction: column; gap: 6px; }
  .stats-btn {
    padding: 10px 14px; background: var(--sf); border: 1px solid var(--bd);
    border-radius: var(--radius); color: var(--tx2); font-size: 0.8rem; text-align: left;
    cursor: pointer; transition: border-color 0.15s, background 0.15s;
  }
  .stats-btn:hover { border-color: var(--ac); background: var(--ac-bg); color: var(--ac); }
  .stats-breadcrumb { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 4px; }
  .stats-breadcrumb span {
    font-size: 0.68rem; padding: 2px 8px; border-radius: 10px;
    background: var(--sf2); color: var(--mu); border: 1px solid var(--bd);
  }
  .stats-result { display: flex; flex-direction: column; gap: 12px; }
  .test-recommendation {
    background: var(--sf); border: 1px solid var(--bd); border-radius: var(--radius);
    padding: 12px 14px; display: flex; flex-direction: column; gap: 6px;
  }
  .test-name-row { display: flex; align-items: center; gap: 8px; }
  .test-name { font-size: 1rem; font-weight: 700; color: var(--tx); }
  .test-note { margin: 0; }
  .stats-explain-section {
    background: var(--sf); border: 1px solid var(--bd); border-radius: var(--radius);
    padding: 12px 14px; display: flex; flex-direction: column; gap: 8px;
  }
  .explain-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  .explain-body { color: var(--tx2); }
  .enzo-btn { display: flex; align-items: center; gap: 5px; }

  /* ── Troubleshoot ── */
  .trb-form { display: flex; flex-direction: column; gap: 12px; max-width: 640px; }
  .trb-textarea {
    width: 100%; padding: 10px 12px; background: var(--sf); border: 1px solid var(--bd);
    border-radius: var(--radius); color: var(--tx); font-size: 0.82rem;
    resize: vertical; line-height: 1.6;
  }
  .trb-textarea:focus { outline: none; border-color: var(--ac); }
  .trb-actions { display: flex; gap: 8px; align-items: center; }
  .trb-result {
    background: var(--sf); border: 1px solid var(--bd); border-radius: var(--radius);
    padding: 14px; display: flex; flex-direction: column; gap: 8px;
  }
  .trb-result-head { display: flex; align-items: center; justify-content: space-between; }
  .trb-body { color: var(--tx2); }

  /* ── Reagents ── */
  .rq-search-row { display: flex; gap: 8px; flex-wrap: wrap; }
  .rq-input { flex: 1; min-width: 200px; }
  .rq-list { display: flex; flex-direction: column; gap: 10px; margin-top: 4px; }
  .rq-card {
    background: var(--sf); border: 1px solid var(--bd); border-radius: var(--radius);
    padding: 12px 14px; display: flex; flex-direction: column; gap: 8px;
  }
  .rq-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; }
  .rq-name { margin: 0; font-size: 0.92rem; font-weight: 700; color: var(--tx); }
  .rq-meta { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; margin-top: 3px; }
  .rq-cas { font-size: 0.72rem; background: var(--ac-bg); color: var(--ac); padding: 1px 7px; border-radius: 8px; font-weight: 600; }
  .rq-formula { font-size: 0.75rem; color: var(--tx2); }
  .rq-mw { font-size: 0.72rem; }
  .rq-syns { font-size: 0.72rem; color: var(--mu); }
  .rq-citation {
    background: var(--sf2); border: 1px solid var(--bd); border-radius: 6px;
    padding: 9px 12px; display: flex; flex-direction: column; gap: 4px;
  }
  .citation-label { font-size: 0.68rem; font-weight: 600; color: var(--ac); text-transform: uppercase; letter-spacing: 0.06em; }
  .rq-actions { display: flex; gap: 6px; flex-wrap: wrap; }
  .feed-notice { padding: 6px 0; }

  /* ── Enzo dot / spinner ── */
  .enzo-dot-tiny {
    width: 7px; height: 7px; border-radius: 50%; background: var(--ac);
    display: inline-block; flex-shrink: 0;
  }
  .spinner-xs-inline {
    width: 11px; height: 11px; border: 2px solid var(--bd2); border-top-color: var(--ac);
    border-radius: 50%; display: inline-block; animation: spin 0.7s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
  .model-pill { font-size: 0.65rem; background: var(--sf2); color: var(--mu); padding: 1px 5px; border-radius: 6px; margin-left: 2px; }
</style>
