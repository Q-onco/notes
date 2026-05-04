<script lang="ts">
  import type { PipelineRun, PipelineStep, QCMetric, Protocol } from '../lib/types';
  import { store } from '../lib/store.svelte';
  import { nanoid } from 'nanoid';

  let { showToast }: { showToast: (msg: string, type?: 'success' | 'error') => void } = $props();

  type PanelTab = 'runs' | 'protocols';
  type PipelineType = PipelineRun['pipelineType'];
  type ProtocolType = Protocol['type'];

  let panelTab = $state<PanelTab>('runs');
  let selectedRunId = $state<string | null>(null);
  let selectedProtocolId = $state<string | null>(null);
  let showNewRun = $state(false);
  let showNewProtocol = $state(false);
  let leftOpen = $state(true);   // mobile toggle

  // New run form
  let newRunTitle = $state('');
  let newRunSampleId = $state('');
  let newRunType = $state<PipelineType>('scrna-seq');
  let newRunTissue = $state('');
  let newRunCondition = $state('pre-chemo');
  let newRunOrganism = $state('Homo sapiens');
  let newRunTags = $state('');

  // New protocol form
  let newProtoTitle = $state('');
  let newProtoType = $state<ProtocolType>('scrna-seq');
  let newProtoVersion = $state('1.0');

  // Auto-save timer
  let saveTimer: ReturnType<typeof setTimeout> | null = null;

  function scheduleSave() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      store.savePipelines().catch(() => {});
    }, 800);
  }

  const selectedRun = $derived(store.pipelineRuns.find(r => r.id === selectedRunId) ?? null);
  const selectedProtocol = $derived(store.protocols.find(p => p.id === selectedProtocolId) ?? null);

  // Grouped runs
  const activeRuns = $derived(
    store.pipelineRuns.filter(r => ['planned', 'running', 'qc-review'].includes(r.status))
  );
  const completedRuns = $derived(
    store.pipelineRuns.filter(r => r.status === 'completed')
  );
  const failedRuns = $derived(
    store.pipelineRuns.filter(r => r.status === 'failed')
  );
  const archivedRuns = $derived(
    store.pipelineRuns.filter(r => r.status === 'archived')
  );

  const recentRuns = $derived(
    [...store.pipelineRuns]
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, 5)
  );

  const PIPELINE_TYPES: { key: PipelineType; label: string; desc: string }[] = [
    { key: 'scrna-seq',  label: 'scRNA-seq',   desc: '10x Chromium single-cell RNA sequencing' },
    { key: 'spatial',    label: 'Spatial',      desc: 'Visium / Xenium spatial transcriptomics' },
    { key: 'bulk-rna',   label: 'Bulk RNA-seq', desc: 'Bulk RNA sequencing and differential expression' },
    { key: 'wes',        label: 'WES',          desc: 'Whole exome sequencing, variant calling' },
    { key: 'custom',     label: 'Custom',       desc: 'Free-form custom pipeline' },
  ];

  const PROTOCOL_TYPES: { key: ProtocolType; label: string }[] = [
    { key: 'scrna-seq',  label: 'scRNA-seq' },
    { key: 'spatial',    label: 'Spatial' },
    { key: 'bulk-rna',   label: 'Bulk RNA-seq' },
    { key: 'wes',        label: 'WES' },
    { key: 'ifm',        label: 'Multiplex IF' },
    { key: 'flow',       label: 'Flow Cytometry' },
    { key: 'ddpcr',      label: 'ddPCR' },
    { key: 'organoid',   label: 'Organoid' },
    { key: 'custom',     label: 'Custom' },
  ];

  const CONDITIONS = ['pre-chemo', 'post-chemo', 'untreated', 'relapsed', 'custom'];

  const STEP_TEMPLATES: Record<PipelineType, Omit<PipelineStep, 'id' | 'status' | 'notes' | 'completedAt'>[]> = {
    'scrna-seq': [
      { name: 'Library preparation',        tool: '10x Chromium',         version: '',      params: 'target_cells: 10000\nviability_threshold: 80%' },
      { name: 'Sequencing',                  tool: 'Illumina NovaSeq',     version: '',      params: 'read_length: 28+90\ndepth: 50000 reads/cell' },
      { name: 'Alignment & count matrix',   tool: 'Cell Ranger',           version: '7.1.0', params: 'genome: GRCh38-2020-A\ninclude_introns: true' },
      { name: 'QC filtering',               tool: 'Seurat / Scanpy',       version: '',      params: 'min_genes: 200\nmax_genes: 6000\nmt_pct: 20\nmin_cells: 3' },
      { name: 'Doublet detection',          tool: 'DoubletFinder',         version: '2.0.3', params: 'pK: 0.09\nnExp: auto\nreuse_pANN: false' },
      { name: 'Normalization + HVG',        tool: 'Seurat',                version: '',      params: 'method: NormalizeData\nnfeatures: 2000\nscale: all genes' },
      { name: 'Dimensionality reduction',   tool: 'PCA + UMAP',            version: '',      params: 'npcs: 30\nn_neighbors: 30\nmin_dist: 0.3' },
      { name: 'Clustering',                 tool: 'Leiden / Louvain',      version: '',      params: 'resolution: 0.5\nalgorithm: leiden\nrandom_seed: 42' },
      { name: 'Cell type annotation',       tool: 'SingleR + manual',      version: '',      params: 'reference: HumanPrimaryCellAtlas\nconfidence: 0.5' },
      { name: 'Cell–cell communication',    tool: 'CellChat / NicheNet',   version: '',      params: 'db: CellChatDB.human\nmin_cells: 10' },
      { name: 'Export',                     tool: 'Seurat RDS / h5ad',     version: '',      params: '' },
    ],
    'spatial': [
      { name: 'Tissue sectioning + H&E',        tool: 'Cryostat',             version: '',      params: 'thickness: 10µm\nstaining: H&E' },
      { name: 'Visium library preparation',     tool: '10x Visium',           version: '',      params: 'capture_area: 6.5mm\ntarget_reads: 50000/spot' },
      { name: 'Alignment + count matrix',       tool: 'Space Ranger',         version: '2.1.0', params: 'genome: GRCh38-2020-A\naligner: STAR' },
      { name: 'QC filtering',                   tool: 'Scanpy / Seurat',      version: '',      params: 'min_counts: 1000\nmin_genes: 500\nmt_pct: 30' },
      { name: 'Normalization',                  tool: 'scran / SCTransform',  version: '',      params: 'method: scran\nnormalize_total: true' },
      { name: 'Spatially variable genes',       tool: 'SpatialDE / NNSVG',   version: '',      params: 'n_top_genes: 3000' },
      { name: 'Cell type deconvolution',        tool: 'cell2location',        version: '0.1.3', params: 'n_cells_per_location: 10\ndetection_alpha: 20' },
      { name: 'Spatial clustering',             tool: 'Banksy / GraphST',     version: '',      params: 'resolution: 0.5\nuse_cell2location: true' },
      { name: 'Neighbourhood enrichment',       tool: 'Squidpy',              version: '1.4',   params: 'n_perms: 1000\nalpha: 0.05' },
      { name: 'Ligand-receptor (spatial)',      tool: 'spatialDM / COMMOT',  version: '',      params: 'db: CellPhoneDB\nmode: global' },
      { name: 'scRNA-seq integration',          tool: 'Harmony / BBKNN',      version: '',      params: 'reference: matched_scrna' },
      { name: 'Export',                         tool: 'AnnData h5ad',         version: '',      params: '' },
    ],
    'bulk-rna': [
      { name: 'RNA extraction + QC',      tool: 'RNeasy / Bioanalyzer',   version: '',        params: 'RIN_threshold: 7\nyield_min: 500ng' },
      { name: 'Library preparation',      tool: 'NEBNext Ultra II',        version: '',        params: 'selection: poly-A\ninput: 100ng' },
      { name: 'Alignment',               tool: 'STAR',                    version: '2.7.10',   params: 'genome: GRCh38\nannotation: GENCODE v43\nalignSJoverhangMin: 8' },
      { name: 'Count matrix',            tool: 'featureCounts / RSEM',    version: '',         params: 'strandedness: reverse\nfeature_type: exon\ngene_id: gene_name' },
      { name: 'QC report',               tool: 'MultiQC + RSeQC',         version: '',         params: 'min_mapping_rate: 75\nmax_dup_rate: 50' },
      { name: 'Differential expression', tool: 'DESeq2 / edgeR',          version: '',         params: 'design: ~condition\npadj_cutoff: 0.05\nlfc_threshold: 1' },
      { name: 'Gene set enrichment',     tool: 'fGSEA / clusterProfiler', version: '',         params: 'db: MSigDB_Hallmarks\nperm: 10000\npval: 0.05' },
      { name: 'Visualization',           tool: 'ggplot2 + ComplexHeatmap',version: '',         params: '' },
      { name: 'Export',                  tool: 'R / Python',              version: '',         params: '' },
    ],
    'wes': [
      { name: 'DNA extraction + QC',         tool: 'QIAamp + Bioanalyzer', version: '',      params: 'DIN_threshold: 7\nmin_input: 1µg' },
      { name: 'Library prep + capture',      tool: 'KAPA HyperExome',      version: '',      params: 'target: whole_exome\ncoverage_target: 100x' },
      { name: 'Alignment',                   tool: 'BWA-MEM2',              version: '2.2.1', params: 'genome: GRCh38\nmarkDup: GATK MarkDuplicates' },
      { name: 'Variant calling',             tool: 'GATK Mutect2',          version: '4.4',   params: 'mode: tumor_only OR tumor_normal\nfiltering: PASS_only' },
      { name: 'Copy number analysis',        tool: 'CNVkit / FACETS',       version: '',      params: 'purity: estimated\nploidy: estimated' },
      { name: 'Annotation',                  tool: 'ANNOVAR / VEP',         version: '',      params: 'db: gnomAD_v4\nfilter: coding+splicing' },
      { name: 'TMB / MSI calculation',       tool: 'TMBur / MSIsensor2',    version: '',      params: 'TMB_threshold: 10 mut/Mb' },
      { name: 'HRD scoring',                 tool: 'scarHRD / CHORD',       version: '',      params: 'method: LOH+TAI+LST\nthreshold: 42' },
      { name: 'Report',                      tool: 'Custom R Rmarkdown',    version: '',      params: '' },
    ],
    'custom': [],
  };

  const STATUS_CYCLE: PipelineStep['status'][] = ['pending', 'running', 'done', 'failed', 'skipped'];

  function cycleStepStatus(runId: string, stepId: string) {
    store.pipelineRuns = store.pipelineRuns.map(r => {
      if (r.id !== runId) return r;
      const steps = r.steps.map(s => {
        if (s.id !== stepId) return s;
        const idx = STATUS_CYCLE.indexOf(s.status);
        const next = STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length];
        return { ...s, status: next, completedAt: next === 'done' ? Date.now() : s.completedAt };
      });
      return { ...r, steps, updatedAt: Date.now() };
    });
    scheduleSave();
  }

  function stepStatusIcon(status: PipelineStep['status']): string {
    switch (status) {
      case 'pending':  return '○';
      case 'running':  return '⚡';
      case 'done':     return '✓';
      case 'failed':   return '✗';
      case 'skipped':  return '—';
    }
  }

  function stepStatusCls(status: PipelineStep['status']): string {
    switch (status) {
      case 'pending':  return 'step-pending';
      case 'running':  return 'step-running';
      case 'done':     return 'step-done';
      case 'failed':   return 'step-failed';
      case 'skipped':  return 'step-skipped';
    }
  }

  function runStatusCls(status: PipelineRun['status']): string {
    switch (status) {
      case 'planned':    return 'status-planned';
      case 'running':    return 'status-running';
      case 'qc-review':  return 'status-qc';
      case 'completed':  return 'status-completed';
      case 'failed':     return 'status-failed';
      case 'archived':   return 'status-archived';
    }
  }

  function qcFlagCls(flag: QCMetric['flag']): string {
    switch (flag) {
      case 'pass': return 'qc-pass';
      case 'warn': return 'qc-warn';
      case 'fail': return 'qc-fail';
      default:     return '';
    }
  }

  function addStep(runId: string) {
    store.pipelineRuns = store.pipelineRuns.map(r => {
      if (r.id !== runId) return r;
      const step: PipelineStep = {
        id: nanoid(),
        name: 'New step',
        tool: '',
        version: '',
        params: '',
        status: 'pending',
        notes: '',
        completedAt: null,
      };
      return { ...r, steps: [...r.steps, step], updatedAt: Date.now() };
    });
    scheduleSave();
  }

  function deleteStep(runId: string, stepId: string) {
    store.pipelineRuns = store.pipelineRuns.map(r => {
      if (r.id !== runId) return r;
      return { ...r, steps: r.steps.filter(s => s.id !== stepId), updatedAt: Date.now() };
    });
    scheduleSave();
  }

  function addQCMetric(runId: string) {
    store.pipelineRuns = store.pipelineRuns.map(r => {
      if (r.id !== runId) return r;
      const metric: QCMetric = { key: '', value: '', flag: '' };
      return { ...r, qcMetrics: [...r.qcMetrics, metric], updatedAt: Date.now() };
    });
    scheduleSave();
  }

  function deleteQCMetric(runId: string, idx: number) {
    store.pipelineRuns = store.pipelineRuns.map(r => {
      if (r.id !== runId) return r;
      const qcMetrics = r.qcMetrics.filter((_, i) => i !== idx);
      return { ...r, qcMetrics, updatedAt: Date.now() };
    });
    scheduleSave();
  }

  function updateRunField<K extends keyof PipelineRun>(id: string, key: K, value: PipelineRun[K]) {
    store.pipelineRuns = store.pipelineRuns.map(r =>
      r.id === id ? { ...r, [key]: value, updatedAt: Date.now() } : r
    );
    scheduleSave();
  }

  function updateStepField<K extends keyof PipelineStep>(runId: string, stepId: string, key: K, value: PipelineStep[K]) {
    store.pipelineRuns = store.pipelineRuns.map(r => {
      if (r.id !== runId) return r;
      const steps = r.steps.map(s => s.id === stepId ? { ...s, [key]: value } : s);
      return { ...r, steps, updatedAt: Date.now() };
    });
    scheduleSave();
  }

  function updateQCMetric(runId: string, idx: number, field: keyof QCMetric, value: string) {
    store.pipelineRuns = store.pipelineRuns.map(r => {
      if (r.id !== runId) return r;
      const qcMetrics = r.qcMetrics.map((m, i) =>
        i === idx ? { ...m, [field]: value } : m
      );
      return { ...r, qcMetrics, updatedAt: Date.now() };
    });
    scheduleSave();
  }

  function createRun() {
    if (!newRunTitle.trim()) return;
    const templates = STEP_TEMPLATES[newRunType] ?? [];
    const steps: PipelineStep[] = templates.map(t => ({
      id: nanoid(),
      name: t.name,
      tool: t.tool,
      version: t.version,
      params: t.params,
      status: 'pending',
      notes: '',
      completedAt: null,
    }));

    const run: PipelineRun = {
      id: nanoid(),
      title: newRunTitle.trim(),
      sampleId: newRunSampleId.trim(),
      sampleDescription: '',
      organism: newRunOrganism.trim() || 'Homo sapiens',
      tissue: newRunTissue.trim(),
      condition: newRunCondition,
      pipelineType: newRunType,
      protocolId: null,
      status: 'planned',
      steps,
      qcMetrics: [],
      noteId: null,
      journalIds: [],
      audioIds: [],
      paperDois: [],
      tags: newRunTags ? newRunTags.split(',').map(t => t.trim()).filter(Boolean) : [],
      notes: '',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      completedAt: null,
    };
    store.pipelineRuns = [run, ...store.pipelineRuns];
    scheduleSave();
    selectedRunId = run.id;
    selectedProtocolId = null;
    showNewRun = false;
    // Reset form
    newRunTitle = '';
    newRunSampleId = '';
    newRunType = 'scrna-seq';
    newRunTissue = '';
    newRunCondition = 'pre-chemo';
    newRunOrganism = 'Homo sapiens';
    newRunTags = '';
    showToast('Run created');
  }

  function createProtocol() {
    if (!newProtoTitle.trim()) return;
    const proto: Protocol = {
      id: nanoid(),
      title: newProtoTitle.trim(),
      type: newProtoType,
      version: newProtoVersion.trim() || '1.0',
      body: '',
      tags: [],
      source: '',
      isTemplate: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    store.protocols = [proto, ...store.protocols];
    scheduleSave();
    selectedProtocolId = proto.id;
    selectedRunId = null;
    showNewProtocol = false;
    newProtoTitle = '';
    newProtoType = 'scrna-seq';
    newProtoVersion = '1.0';
    showToast('Protocol created');
  }

  function deleteRun(id: string) {
    if (!confirm('Delete this pipeline run? This cannot be undone.')) return;
    store.pipelineRuns = store.pipelineRuns.filter(r => r.id !== id);
    if (selectedRunId === id) selectedRunId = null;
    store.savePipelines().then(() => showToast('Run deleted'));
  }

  function deleteProtocol(id: string) {
    if (!confirm('Delete this protocol?')) return;
    store.protocols = store.protocols.filter(p => p.id !== id);
    if (selectedProtocolId === id) selectedProtocolId = null;
    store.savePipelines().then(() => showToast('Protocol deleted'));
  }

  function addPaperDoi(runId: string) {
    const doi = prompt('Enter paper DOI:');
    if (!doi?.trim()) return;
    const run = store.pipelineRuns.find(r => r.id === runId);
    if (!run) return;
    updateRunField(runId, 'paperDois', [...run.paperDois, doi.trim()]);
  }

  function removePaperDoi(runId: string, doi: string) {
    const run = store.pipelineRuns.find(r => r.id === runId);
    if (!run) return;
    updateRunField(runId, 'paperDois', run.paperDois.filter(d => d !== doi));
  }

  let expandedSteps = $state<Set<string>>(new Set());

  function toggleStepExpand(stepId: string) {
    const next = new Set(expandedSteps);
    if (next.has(stepId)) next.delete(stepId);
    else next.add(stepId);
    expandedSteps = next;
  }

  function formatDate(ts: number): string {
    return new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  const stats = $derived({
    total: store.pipelineRuns.length,
    active: activeRuns.length,
    completed: completedRuns.length,
    protocols: store.protocols.length,
  });

  // ── Master toggle ─────────────────────────────────────────────
  const SESSION_KEY = 'qonco_pipeline_on';
  let enabled = $state(sessionStorage.getItem(SESSION_KEY) === '1');
  function enable() { enabled = true; sessionStorage.setItem(SESSION_KEY, '1'); }

  // Example runs displayed when no real runs exist
  const EXAMPLE_RUNS = [
    { id: '_ep1', title: 'HGSOC TME scRNA-seq — cohort batch 3', pipelineType: 'scrna-seq', sampleId: 'AMR-23-BT3', status: 'qc-review', updatedAt: Date.now() - 86400000 },
    { id: '_ep2', title: 'Visium spatial — pre/post PARPi paired', pipelineType: 'spatial',   sampleId: 'AMR-24-SP1', status: 'running',   updatedAt: Date.now() - 3600000  },
  ] as const;
</script>

{#if !enabled}
  <div class="landing">
    <div class="landing-inner">
      <div class="landing-icon">
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18"/>
        </svg>
      </div>
      <h2>Pipeline Tracker</h2>
      <p class="text-mu">Track analysis runs for scRNA-seq, spatial transcriptomics, WES, and bulk RNA-seq. Step-by-step progress, QC metrics, protocol templates, and linked resources — all in one place.</p>
      <ul class="landing-features">
        <li>Structured run tracking with pre-configured step templates</li>
        <li>QC metric logging with pass/warn/fail flags</li>
        <li>Protocol library with Markdown bodies</li>
        <li>Link runs to notes, papers, audio recordings</li>
        <li>Status management: planned → running → QC review → completed</li>
      </ul>
      <button class="btn btn-primary landing-btn" onclick={enable}>Enable for this session</button>
      <p class="text-xs text-mu">Stays active until you close this tab.</p>
    </div>
  </div>
{:else}
<div class="pipeline" class:sidebar-closed={!leftOpen}>
  <!-- Mobile toggle -->
  <button class="mobile-sidebar-toggle btn-icon" onclick={() => leftOpen = !leftOpen} title="Toggle sidebar">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
      <rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
    </svg>
  </button>

  {#if leftOpen}
    <aside class="left-panel">
      <div class="left-header">
        <div class="left-tabs">
          <button class="ltab" class:active={panelTab === 'runs'} onclick={() => panelTab = 'runs'}>Runs</button>
          <button class="ltab" class:active={panelTab === 'protocols'} onclick={() => panelTab = 'protocols'}>Protocols</button>
        </div>
        {#if panelTab === 'runs'}
          <button
            class="btn btn-primary btn-xs new-run-btn"
            onclick={() => { showNewRun = true; selectedRunId = null; selectedProtocolId = null; }}
          >+ New Run</button>
        {:else}
          <button
            class="btn btn-primary btn-xs new-run-btn"
            onclick={() => { showNewProtocol = true; selectedRunId = null; selectedProtocolId = null; }}
          >+ New</button>
        {/if}
      </div>

      <div class="left-list">
        {#if panelTab === 'runs'}
          {#if store.pipelineRuns.length === 0}
            <p class="left-empty">No runs yet. Click + New Run to start.</p>
            {#each EXAMPLE_RUNS as ex}
              <div class="run-item example-run">
                <div class="run-item-top">
                  <span class="run-title-sm">{ex.title}</span>
                  <span class="run-status-dot status-{ex.status === 'qc-review' ? 'qc' : ex.status}"></span>
                </div>
                <div class="run-item-sub">
                  <span class="type-badge">{ex.pipelineType}</span>
                  <span class="text-xs text-mu">{ex.sampleId}</span>
                  <span class="example-dot text-xs text-mu">· example</span>
                </div>
              </div>
            {/each}
          {/if}

          {#if activeRuns.length > 0}
            <div class="run-group-label">Active ({activeRuns.length})</div>
            {#each activeRuns as run (run.id)}
              <button
                class="run-item"
                class:active={selectedRunId === run.id}
                onclick={() => { selectedRunId = run.id; selectedProtocolId = null; showNewRun = false; showNewProtocol = false; }}
              >
                <div class="run-item-top">
                  <span class="run-title-sm">{run.title}</span>
                  <span class="run-status-dot {runStatusCls(run.status)}"></span>
                </div>
                <div class="run-item-sub">
                  <span class="type-badge">{run.pipelineType}</span>
                  {#if run.sampleId}<span class="text-xs text-mu">{run.sampleId}</span>{/if}
                </div>
              </button>
            {/each}
          {/if}

          {#if completedRuns.length > 0}
            <div class="run-group-label">Completed ({completedRuns.length})</div>
            {#each completedRuns as run (run.id)}
              <button
                class="run-item"
                class:active={selectedRunId === run.id}
                onclick={() => { selectedRunId = run.id; selectedProtocolId = null; showNewRun = false; showNewProtocol = false; }}
              >
                <div class="run-item-top">
                  <span class="run-title-sm">{run.title}</span>
                  <span class="run-status-dot {runStatusCls(run.status)}"></span>
                </div>
                <div class="run-item-sub">
                  <span class="type-badge">{run.pipelineType}</span>
                  {#if run.sampleId}<span class="text-xs text-mu">{run.sampleId}</span>{/if}
                </div>
              </button>
            {/each}
          {/if}

          {#if failedRuns.length > 0}
            <div class="run-group-label">Failed ({failedRuns.length})</div>
            {#each failedRuns as run (run.id)}
              <button
                class="run-item"
                class:active={selectedRunId === run.id}
                onclick={() => { selectedRunId = run.id; selectedProtocolId = null; showNewRun = false; showNewProtocol = false; }}
              >
                <div class="run-item-top">
                  <span class="run-title-sm">{run.title}</span>
                  <span class="run-status-dot {runStatusCls(run.status)}"></span>
                </div>
                <div class="run-item-sub">
                  <span class="type-badge">{run.pipelineType}</span>
                </div>
              </button>
            {/each}
          {/if}

          {#if archivedRuns.length > 0}
            <div class="run-group-label">Archived ({archivedRuns.length})</div>
            {#each archivedRuns as run (run.id)}
              <button
                class="run-item"
                class:active={selectedRunId === run.id}
                onclick={() => { selectedRunId = run.id; selectedProtocolId = null; showNewRun = false; showNewProtocol = false; }}
              >
                <div class="run-item-top">
                  <span class="run-title-sm">{run.title}</span>
                  <span class="run-status-dot {runStatusCls(run.status)}"></span>
                </div>
                <div class="run-item-sub">
                  <span class="type-badge">{run.pipelineType}</span>
                </div>
              </button>
            {/each}
          {/if}

        {:else}
          <!-- Protocols tab -->
          {#if store.protocols.length === 0}
            <p class="left-empty">No protocols yet.</p>
          {/if}
          {#each store.protocols as proto (proto.id)}
            <button
              class="run-item"
              class:active={selectedProtocolId === proto.id}
              onclick={() => { selectedProtocolId = proto.id; selectedRunId = null; showNewRun = false; showNewProtocol = false; }}
            >
              <div class="run-item-top">
                <span class="run-title-sm">{proto.title}</span>
                {#if proto.isTemplate}<span class="tpl-badge">TPL</span>{/if}
              </div>
              <div class="run-item-sub">
                <span class="type-badge">{proto.type}</span>
                <span class="text-xs text-mu">v{proto.version}</span>
              </div>
            </button>
          {/each}
        {/if}
      </div>
    </aside>
  {/if}

  <main class="main-panel">
    {#if showNewRun}
      <!-- New run form -->
      <div class="main-scroll">
        <div class="section-head-row">
          <h2>New Analysis Run</h2>
          <button class="btn btn-ghost btn-sm" onclick={() => showNewRun = false}>Cancel</button>
        </div>

        <div class="form-grid">
          <div class="form-group form-full">
            <label class="form-label" for="nr-title">Run title <span class="req">*</span></label>
            <input id="nr-title" type="text" bind:value={newRunTitle} placeholder="e.g. HGSOC TME scRNA-seq batch 3" class="form-input" />
          </div>
          <div class="form-group">
            <label class="form-label" for="nr-sample">Sample ID</label>
            <input id="nr-sample" type="text" bind:value={newRunSampleId} placeholder="e.g. AMR-23-001" class="form-input" />
          </div>
          <div class="form-group">
            <label class="form-label" for="nr-type">Pipeline type</label>
            <select id="nr-type" bind:value={newRunType} class="form-input">
              {#each PIPELINE_TYPES as pt}
                <option value={pt.key}>{pt.label} — {pt.desc}</option>
              {/each}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label" for="nr-tissue">Tissue</label>
            <input id="nr-tissue" type="text" bind:value={newRunTissue} placeholder="e.g. Ovarian tumour, Ascites" class="form-input" />
          </div>
          <div class="form-group">
            <label class="form-label" for="nr-condition">Condition</label>
            <select id="nr-condition" bind:value={newRunCondition} class="form-input">
              {#each CONDITIONS as c}<option value={c}>{c}</option>{/each}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label" for="nr-organism">Organism</label>
            <input id="nr-organism" type="text" bind:value={newRunOrganism} placeholder="Homo sapiens" class="form-input" />
          </div>
          <div class="form-group form-full">
            <label class="form-label" for="nr-tags">Tags (comma-separated)</label>
            <input id="nr-tags" type="text" bind:value={newRunTags} placeholder="e.g. HGSOC, TME, ascites" class="form-input" />
          </div>
        </div>

        <div class="template-preview">
          <p class="template-note text-sm text-mu">
            This will create {STEP_TEMPLATES[newRunType]?.length ?? 0} pre-configured steps for a {PIPELINE_TYPES.find(p=>p.key===newRunType)?.label} pipeline.
          </p>
        </div>

        <button
          class="btn btn-primary"
          onclick={createRun}
          disabled={!newRunTitle.trim()}
        >Create run</button>
      </div>

    {:else if showNewProtocol}
      <div class="main-scroll">
        <div class="section-head-row">
          <h2>New Protocol</h2>
          <button class="btn btn-ghost btn-sm" onclick={() => showNewProtocol = false}>Cancel</button>
        </div>
        <div class="form-grid">
          <div class="form-group form-full">
            <label class="form-label" for="np-title">Title <span class="req">*</span></label>
            <input id="np-title" type="text" bind:value={newProtoTitle} placeholder="Protocol title" class="form-input" />
          </div>
          <div class="form-group">
            <label class="form-label" for="np-type">Type</label>
            <select id="np-type" bind:value={newProtoType} class="form-input">
              {#each PROTOCOL_TYPES as pt}
                <option value={pt.key}>{pt.label}</option>
              {/each}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label" for="np-version">Version</label>
            <input id="np-version" type="text" bind:value={newProtoVersion} placeholder="1.0" class="form-input" />
          </div>
        </div>
        <button class="btn btn-primary" onclick={createProtocol} disabled={!newProtoTitle.trim()}>
          Create protocol
        </button>
      </div>

    {:else if selectedRun}
      {@const run = selectedRun}
      <div class="main-scroll">
        <!-- Run header -->
        <div class="run-header">
          <div class="run-header-top">
            <input
              type="text"
              class="run-title-input"
              value={run.title}
              onchange={(e) => updateRunField(run.id, 'title', (e.target as HTMLInputElement).value)}
            />
            <div class="run-header-actions">
              <select
                class="status-sel status-sel-{runStatusCls(run.status)}"
                value={run.status}
                onchange={(e) => updateRunField(run.id, 'status', (e.target as HTMLSelectElement).value as PipelineRun['status'])}
              >
                <option value="planned">Planned</option>
                <option value="running">Running</option>
                <option value="qc-review">QC Review</option>
                <option value="completed">Completed</option>
                <option value="failed">Failed</option>
                <option value="archived">Archived</option>
              </select>
              <button class="btn-icon danger-icon" onclick={() => deleteRun(run.id)} title="Delete run">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="3 6 5 6 21 6"/>
                  <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
                  <path d="M10 11v6M14 11v6"/>
                </svg>
              </button>
            </div>
          </div>

          <div class="run-meta-grid">
            <div class="run-meta-field">
              <span class="meta-label">Sample ID</span>
              <input
                type="text"
                class="meta-input"
                value={run.sampleId}
                placeholder="—"
                onchange={(e) => updateRunField(run.id, 'sampleId', (e.target as HTMLInputElement).value)}
              />
            </div>
            <div class="run-meta-field">
              <span class="meta-label">Tissue</span>
              <input
                type="text"
                class="meta-input"
                value={run.tissue}
                placeholder="—"
                onchange={(e) => updateRunField(run.id, 'tissue', (e.target as HTMLInputElement).value)}
              />
            </div>
            <div class="run-meta-field">
              <span class="meta-label">Condition</span>
              <input
                type="text"
                class="meta-input"
                value={run.condition}
                placeholder="—"
                onchange={(e) => updateRunField(run.id, 'condition', (e.target as HTMLInputElement).value)}
              />
            </div>
            <div class="run-meta-field">
              <span class="meta-label">Organism</span>
              <input
                type="text"
                class="meta-input"
                value={run.organism}
                placeholder="Homo sapiens"
                onchange={(e) => updateRunField(run.id, 'organism', (e.target as HTMLInputElement).value)}
              />
            </div>
            <div class="run-meta-field">
              <span class="meta-label">Type</span>
              <select
                class="meta-input"
                value={run.pipelineType}
                onchange={(e) => updateRunField(run.id, 'pipelineType', (e.target as HTMLSelectElement).value as PipelineType)}
              >
                {#each PIPELINE_TYPES as pt}
                  <option value={pt.key}>{pt.label}</option>
                {/each}
              </select>
            </div>
            <div class="run-meta-field">
              <span class="meta-label">Created</span>
              <span class="meta-value">{formatDate(run.createdAt)}</span>
            </div>
          </div>

          {#if run.tags.length > 0}
            <div class="tag-row">
              {#each run.tags as tag}
                <span class="tag tag-yw">{tag}</span>
              {/each}
            </div>
          {/if}
        </div>

        <!-- Pipeline steps -->
        <section class="pipeline-section">
          <div class="section-head-row">
            <h3 class="section-title">Pipeline Steps</h3>
            <button class="btn btn-ghost btn-sm" onclick={() => addStep(run.id)}>+ Add step</button>
          </div>

          <div class="steps-list">
            {#each run.steps as step, idx (step.id)}
              <div class="step-row" class:step-expanded={expandedSteps.has(step.id)}>
                <div class="step-main">
                  <span class="step-num text-xs text-mu">{idx + 1}</span>
                  <button
                    class="step-status-btn {stepStatusCls(step.status)}"
                    onclick={() => cycleStepStatus(run.id, step.id)}
                    title="Click to advance status"
                  >{stepStatusIcon(step.status)}</button>
                  <div class="step-info">
                    <input
                      type="text"
                      class="step-name-input"
                      value={step.name}
                      onchange={(e) => updateStepField(run.id, step.id, 'name', (e.target as HTMLInputElement).value)}
                    />
                    <div class="step-tool-row">
                      <input
                        type="text"
                        class="step-tool-input"
                        value={step.tool}
                        placeholder="Tool"
                        onchange={(e) => updateStepField(run.id, step.id, 'tool', (e.target as HTMLInputElement).value)}
                      />
                      <input
                        type="text"
                        class="step-version-input"
                        value={step.version}
                        placeholder="Version"
                        onchange={(e) => updateStepField(run.id, step.id, 'version', (e.target as HTMLInputElement).value)}
                      />
                    </div>
                  </div>
                  <div class="step-actions">
                    <button
                      class="btn-icon"
                      onclick={() => toggleStepExpand(step.id)}
                      title="Expand step"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                        style="transform: rotate({expandedSteps.has(step.id) ? 180 : 0}deg); transition: transform 0.15s">
                        <polyline points="6 9 12 15 18 9"/>
                      </svg>
                    </button>
                    <button class="btn-icon danger-icon" onclick={() => deleteStep(run.id, step.id)} title="Delete step">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                      </svg>
                    </button>
                  </div>
                </div>
                {#if expandedSteps.has(step.id)}
                  <div class="step-expand">
                    <div class="step-expand-row">
                      <label class="form-label" for="step-params-{step.id}">Parameters</label>
                      <textarea
                        id="step-params-{step.id}"
                        class="step-params-input"
                        value={step.params}
                        placeholder="key: value&#10;key2: value2"
                        rows="4"
                        onchange={(e) => updateStepField(run.id, step.id, 'params', (e.target as HTMLTextAreaElement).value)}
                      ></textarea>
                    </div>
                    <div class="step-expand-row">
                      <label class="form-label" for="step-notes-{step.id}">Notes</label>
                      <textarea
                        id="step-notes-{step.id}"
                        class="step-notes-input"
                        value={step.notes}
                        placeholder="Step-specific notes…"
                        rows="2"
                        onchange={(e) => updateStepField(run.id, step.id, 'notes', (e.target as HTMLTextAreaElement).value)}
                      ></textarea>
                    </div>
                    {#if step.completedAt}
                      <p class="text-xs text-mu">Completed: {formatDate(step.completedAt)}</p>
                    {/if}
                  </div>
                {/if}
              </div>
            {:else}
              <p class="text-sm text-mu">No steps yet. Click + Add step.</p>
            {/each}
          </div>
        </section>

        <!-- QC Metrics -->
        <section class="pipeline-section">
          <div class="section-head-row">
            <h3 class="section-title">QC Metrics</h3>
            <button class="btn btn-ghost btn-sm" onclick={() => addQCMetric(run.id)}>+ Add metric</button>
          </div>

          {#if run.qcMetrics.length > 0}
            <div class="qc-table">
              <div class="qc-header">
                <span class="qc-col-key">Metric</span>
                <span class="qc-col-val">Value</span>
                <span class="qc-col-flag">Flag</span>
                <span class="qc-col-del"></span>
              </div>
              {#each run.qcMetrics as metric, i}
                <div class="qc-row">
                  <input
                    type="text"
                    class="qc-input qc-col-key"
                    value={metric.key}
                    placeholder="e.g. median_genes"
                    onchange={(e) => updateQCMetric(run.id, i, 'key', (e.target as HTMLInputElement).value)}
                  />
                  <input
                    type="text"
                    class="qc-input qc-col-val"
                    value={metric.value}
                    placeholder="e.g. 2847"
                    onchange={(e) => updateQCMetric(run.id, i, 'value', (e.target as HTMLInputElement).value)}
                  />
                  <div class="qc-col-flag">
                    <select
                      class="qc-flag-sel"
                      value={metric.flag}
                      onchange={(e) => updateQCMetric(run.id, i, 'flag', (e.target as HTMLSelectElement).value)}
                    >
                      <option value="">—</option>
                      <option value="pass">Pass</option>
                      <option value="warn">Warn</option>
                      <option value="fail">Fail</option>
                    </select>
                    {#if metric.flag}
                      <span class="qc-dot {qcFlagCls(metric.flag)}"></span>
                    {/if}
                  </div>
                  <button class="btn-icon danger-icon qc-col-del" onclick={() => deleteQCMetric(run.id, i)} title="Delete">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                  </button>
                </div>
              {/each}
            </div>
          {:else}
            <p class="text-sm text-mu">No QC metrics recorded.</p>
          {/if}
        </section>

        <!-- Linked resources -->
        <section class="pipeline-section">
          <div class="section-head-row">
            <h3 class="section-title">Linked Resources</h3>
          </div>

          {#if run.paperDois.length > 0}
            <div class="linked-papers">
              <span class="meta-label">Papers</span>
              <div class="doi-list">
                {#each run.paperDois as doi}
                  <div class="doi-row">
                    <a href="https://doi.org/{doi}" target="_blank" rel="noreferrer" class="doi-link">{doi}</a>
                    <button class="btn-icon danger-icon" onclick={() => removePaperDoi(run.id, doi)} title="Remove">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                      </svg>
                    </button>
                  </div>
                {/each}
              </div>
            </div>
          {/if}

          <div class="link-actions">
            <button class="btn btn-ghost btn-sm" onclick={() => addPaperDoi(run.id)}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              Add paper DOI
            </button>
          </div>
        </section>

        <!-- Notes -->
        <section class="pipeline-section">
          <h3 class="section-title">Notes</h3>
          <textarea
            class="run-notes-area"
            value={run.notes}
            placeholder="Freeform notes about this run (markdown supported)…"
            rows="6"
            onchange={(e) => updateRunField(run.id, 'notes', (e.target as HTMLTextAreaElement).value)}
          ></textarea>
          <p class="autosave-hint text-xs text-mu">Auto-saves 800ms after changes</p>
        </section>
      </div>

    {:else if selectedProtocol}
      {@const proto = selectedProtocol}
      <div class="main-scroll">
        <div class="section-head-row">
          <h2>Protocol</h2>
          <button class="btn-icon danger-icon" onclick={() => deleteProtocol(proto.id)} title="Delete protocol">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
              <path d="M10 11v6M14 11v6"/>
            </svg>
          </button>
        </div>

        <div class="form-grid">
          <div class="form-group form-full">
            <label class="form-label" for="ep-title">Title</label>
            <input
              id="ep-title"
              type="text"
              class="form-input"
              value={proto.title}
              onchange={(e) => {
                const val = (e.target as HTMLInputElement).value;
                store.protocols = store.protocols.map(p => p.id === proto.id ? { ...p, title: val, updatedAt: Date.now() } : p);
                scheduleSave();
              }}
            />
          </div>
          <div class="form-group">
            <label class="form-label" for="ep-type">Type</label>
            <select
              id="ep-type"
              class="form-input"
              value={proto.type}
              onchange={(e) => {
                const val = (e.target as HTMLSelectElement).value as ProtocolType;
                store.protocols = store.protocols.map(p => p.id === proto.id ? { ...p, type: val, updatedAt: Date.now() } : p);
                scheduleSave();
              }}
            >
              {#each PROTOCOL_TYPES as pt}
                <option value={pt.key}>{pt.label}</option>
              {/each}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label" for="ep-version">Version</label>
            <input
              id="ep-version"
              type="text"
              class="form-input"
              value={proto.version}
              onchange={(e) => {
                const val = (e.target as HTMLInputElement).value;
                store.protocols = store.protocols.map(p => p.id === proto.id ? { ...p, version: val, updatedAt: Date.now() } : p);
                scheduleSave();
              }}
            />
          </div>
          <div class="form-group">
            <label class="form-label" for="ep-source">Source (DOI or URL)</label>
            <input
              id="ep-source"
              type="text"
              class="form-input"
              value={proto.source}
              placeholder="https://..."
              onchange={(e) => {
                const val = (e.target as HTMLInputElement).value;
                store.protocols = store.protocols.map(p => p.id === proto.id ? { ...p, source: val, updatedAt: Date.now() } : p);
                scheduleSave();
              }}
            />
          </div>
          <div class="form-group form-full">
            <label class="form-label" for="ep-tags">Tags (comma-separated)</label>
            <input
              id="ep-tags"
              type="text"
              class="form-input"
              value={proto.tags.join(', ')}
              placeholder="e.g. HGSOC, scRNA-seq"
              onchange={(e) => {
                const val = (e.target as HTMLInputElement).value.split(',').map(t => t.trim()).filter(Boolean);
                store.protocols = store.protocols.map(p => p.id === proto.id ? { ...p, tags: val, updatedAt: Date.now() } : p);
                scheduleSave();
              }}
            />
          </div>
        </div>

        <div class="form-group">
          <label class="form-label" for="ep-body">Protocol body (Markdown)</label>
          <textarea
            id="ep-body"
            class="proto-body-area"
            value={proto.body}
            placeholder="Write protocol steps in Markdown…"
            rows="20"
            onchange={(e) => {
              const val = (e.target as HTMLTextAreaElement).value;
              store.protocols = store.protocols.map(p => p.id === proto.id ? { ...p, body: val, updatedAt: Date.now() } : p);
              scheduleSave();
            }}
          ></textarea>
        </div>
        <p class="autosave-hint text-xs text-mu">Auto-saves 800ms after changes</p>
      </div>

    {:else}
      <!-- Default: dashboard -->
      <div class="main-scroll default-panel">
        <div class="pipeline-title-row">
          <div>
            <h2>Pipeline Tracker</h2>
            <p class="text-sm text-mu">Analysis command centre for scRNA-seq, spatial, WES, and custom pipelines</p>
          </div>
        </div>

        <div class="stats-grid">
          <div class="stat-card">
            <span class="stat-num">{stats.total}</span>
            <span class="stat-label">Total runs</span>
          </div>
          <div class="stat-card stat-card-ac">
            <span class="stat-num">{stats.active}</span>
            <span class="stat-label">Active</span>
          </div>
          <div class="stat-card stat-card-gn">
            <span class="stat-num">{stats.completed}</span>
            <span class="stat-label">Completed</span>
          </div>
          <div class="stat-card stat-card-pu">
            <span class="stat-num">{stats.protocols}</span>
            <span class="stat-label">Protocols</span>
          </div>
        </div>

        {#if recentRuns.length > 0}
          <div class="recent-section">
            <h3 class="section-title">Recent Runs</h3>
            <div class="recent-list">
              {#each recentRuns as run (run.id)}
                <button
                  class="recent-item"
                  onclick={() => { selectedRunId = run.id; selectedProtocolId = null; }}
                >
                  <div class="recent-item-left">
                    <span class="recent-title">{run.title}</span>
                    <div class="recent-meta">
                      <span class="type-badge">{run.pipelineType}</span>
                      {#if run.sampleId}<span class="text-xs text-mu">{run.sampleId}</span>{/if}
                      <span class="text-xs text-mu">{formatDate(run.updatedAt)}</span>
                    </div>
                  </div>
                  <span class="run-status-pill {runStatusCls(run.status)}">{run.status}</span>
                </button>
              {/each}
            </div>
          </div>
        {/if}

        <button
          class="cta-btn"
          onclick={() => { showNewRun = true; selectedRunId = null; selectedProtocolId = null; }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Start a new analysis run
        </button>
      </div>
    {/if}
  </main>
</div>
{/if}

<style>
  /* Landing page */
  .landing {
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 32px;
    background: var(--bg);
  }
  .landing-inner {
    max-width: 480px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 14px;
    text-align: center;
  }
  .landing-icon { color: var(--ac); opacity: 0.7; }
  .landing-inner h2 { font-size: 1.4rem; font-weight: 700; }
  .landing-inner p { color: var(--tx2); line-height: 1.6; max-width: 400px; }
  .landing-features {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
    text-align: left;
    width: 100%;
    max-width: 380px;
  }
  .landing-features li {
    font-size: 0.82rem;
    color: var(--tx2);
    padding: 6px 10px;
    background: var(--sf);
    border: 1px solid var(--bd);
    border-radius: var(--radius-sm);
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .landing-features li::before { content: '→'; color: var(--ac); font-size: 0.75rem; }
  .landing-btn { margin-top: 6px; padding: 10px 28px; }
  .example-run { opacity: 0.72; cursor: default; }
  .example-dot { font-size: 0.6rem; }

  .pipeline {
    height: 100%;
    display: flex;
    overflow: hidden;
    position: relative;
  }

  .mobile-sidebar-toggle {
    display: none;
    position: absolute;
    top: 12px;
    left: 12px;
    z-index: 10;
  }

  /* Left panel */
  .left-panel {
    width: 240px;
    flex-shrink: 0;
    border-right: 1px solid var(--bd);
    background: var(--sf);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .left-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 10px 8px;
    border-bottom: 1px solid var(--bd);
    flex-shrink: 0;
    gap: 8px;
  }

  .left-tabs { display: flex; gap: 2px; }
  .ltab {
    padding: 4px 10px;
    border-radius: var(--radius-sm);
    font-size: 0.77rem;
    font-weight: 600;
    background: transparent;
    border: none;
    color: var(--tx2);
    cursor: pointer;
    transition: all var(--transition);
  }
  .ltab.active { background: var(--ac-bg); color: var(--ac); }
  .ltab:hover:not(.active) { background: var(--sf2); color: var(--tx); }

  .btn-xs { padding: 3px 8px; font-size: 0.72rem; }
  .new-run-btn { flex-shrink: 0; }

  .left-list {
    flex: 1;
    overflow-y: auto;
    padding: 6px 6px 12px;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .left-empty {
    font-size: 0.78rem;
    color: var(--mu);
    padding: 16px 8px;
    text-align: center;
    line-height: 1.5;
  }

  .run-group-label {
    font-size: 0.63rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--mu);
    padding: 8px 6px 3px;
  }

  .run-item {
    display: flex;
    flex-direction: column;
    gap: 3px;
    padding: 7px 8px;
    border-radius: var(--radius-sm);
    background: transparent;
    border: none;
    text-align: left;
    cursor: pointer;
    transition: background var(--transition);
    width: 100%;
  }
  .run-item:hover { background: var(--sf2); }
  .run-item.active { background: var(--ac-bg); }

  .run-item-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 6px;
  }

  .run-title-sm {
    font-size: 0.82rem;
    font-weight: 500;
    color: var(--tx);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 1;
  }

  .run-item-sub {
    display: flex;
    align-items: center;
    gap: 5px;
  }

  .run-status-dot {
    width: 7px; height: 7px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .type-badge {
    font-size: 0.62rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    background: var(--sf2);
    color: var(--mu);
    padding: 1px 5px;
    border-radius: 4px;
    border: 1px solid var(--bd);
    flex-shrink: 0;
  }

  .tpl-badge {
    font-size: 0.6rem;
    font-weight: 700;
    background: var(--enzo-bg);
    color: var(--enzo);
    padding: 1px 4px;
    border-radius: 3px;
  }

  /* Status colors */
  .status-planned  { background: var(--mu); }
  .status-running  { background: var(--ac); animation: pulse 1.5s ease-in-out infinite; }
  .status-qc       { background: var(--yw); }
  .status-completed{ background: var(--gn); }
  .status-failed   { background: var(--rd); }
  .status-archived { background: var(--bd2); }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.4; }
  }

  /* Main panel */
  .main-panel {
    flex: 1;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .main-scroll {
    flex: 1;
    overflow-y: auto;
    padding: 24px;
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  /* Run header */
  .run-header {
    display: flex;
    flex-direction: column;
    gap: 12px;
    background: var(--sf);
    border: 1px solid var(--bd);
    border-radius: var(--radius);
    padding: 16px;
  }

  .run-header-top {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
  }

  .run-title-input {
    flex: 1;
    font-size: 1.1rem;
    font-weight: 700;
    background: transparent;
    border: none;
    border-bottom: 1px solid transparent;
    color: var(--tx);
    padding: 2px 0;
    font-family: var(--font);
    min-width: 160px;
  }
  .run-title-input:focus { outline: none; border-bottom-color: var(--ac); }

  .run-header-actions { display: flex; align-items: center; gap: 8px; }

  .status-sel {
    font-size: 0.78rem;
    font-weight: 600;
    padding: 4px 8px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--bd);
    background: var(--sf2);
    color: var(--tx);
    cursor: pointer;
    font-family: var(--font);
  }

  .run-meta-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    gap: 10px;
  }
  .run-meta-field { display: flex; flex-direction: column; gap: 3px; }
  .meta-label {
    font-size: 0.62rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    color: var(--mu);
  }
  .meta-input {
    font-size: 0.82rem;
    padding: 4px 6px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--bd);
    background: var(--sf2);
    color: var(--tx);
    font-family: var(--font);
  }
  .meta-input:focus { outline: none; border-color: var(--ac); }
  .meta-value { font-size: 0.82rem; color: var(--tx2); padding: 4px 0; }

  .tag-row { display: flex; flex-wrap: wrap; gap: 5px; }

  /* Sections */
  .pipeline-section {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .section-head-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .section-title {
    font-size: 0.82rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    color: var(--mu);
  }

  /* Steps */
  .steps-list { display: flex; flex-direction: column; gap: 4px; }

  .step-row {
    border: 1px solid var(--bd);
    border-radius: var(--radius-sm);
    background: var(--sf);
    overflow: hidden;
  }

  .step-main {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 10px;
  }

  .step-num {
    width: 16px;
    text-align: right;
    flex-shrink: 0;
    font-variant-numeric: tabular-nums;
  }

  .step-status-btn {
    width: 26px;
    height: 26px;
    border-radius: 50%;
    border: 1px solid var(--bd);
    background: var(--sf2);
    cursor: pointer;
    font-size: 0.82rem;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    transition: all var(--transition);
    font-family: monospace;
  }
  .step-status-btn:hover { border-color: var(--ac); }

  .step-pending  { color: var(--mu); }
  .step-running  { color: var(--ac); border-color: var(--ac); animation: pulse 1.5s ease-in-out infinite; }
  .step-done     { color: var(--gn); border-color: var(--gn); background: var(--gn-bg); }
  .step-failed   { color: var(--rd); border-color: var(--rd); background: var(--rd-bg); }
  .step-skipped  { color: var(--mu); opacity: 0.5; }

  .step-info { flex: 1; display: flex; flex-direction: column; gap: 3px; min-width: 0; }
  .step-name-input {
    font-size: 0.85rem;
    font-weight: 600;
    background: transparent;
    border: none;
    color: var(--tx);
    padding: 0;
    font-family: var(--font);
    width: 100%;
  }
  .step-name-input:focus { outline: none; color: var(--ac); }

  .step-tool-row { display: flex; gap: 6px; }
  .step-tool-input {
    font-size: 0.73rem;
    color: var(--tx2);
    background: transparent;
    border: none;
    padding: 0;
    font-family: var(--font);
    flex: 1;
    min-width: 0;
  }
  .step-tool-input:focus { outline: none; color: var(--ac); }
  .step-version-input {
    font-size: 0.68rem;
    color: var(--mu);
    background: var(--sf2);
    border: 1px solid var(--bd);
    border-radius: 3px;
    padding: 1px 5px;
    font-family: var(--mono);
    width: 70px;
    flex-shrink: 0;
  }
  .step-version-input:focus { outline: none; border-color: var(--ac); }

  .step-actions { display: flex; gap: 2px; align-items: center; flex-shrink: 0; }

  .step-expand {
    padding: 10px 12px 12px 52px;
    background: var(--sf2);
    border-top: 1px solid var(--bd);
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .step-expand-row { display: flex; flex-direction: column; gap: 4px; }
  .step-params-input, .step-notes-input {
    font-size: 0.8rem;
    font-family: var(--mono);
    resize: vertical;
    width: 100%;
  }

  /* QC table */
  .qc-table { display: flex; flex-direction: column; gap: 0; border: 1px solid var(--bd); border-radius: var(--radius-sm); overflow: hidden; }
  .qc-header {
    display: grid;
    grid-template-columns: 1fr 1fr 90px 30px;
    gap: 0;
    padding: 6px 8px;
    background: var(--sf2);
    border-bottom: 1px solid var(--bd);
    font-size: 0.65rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    color: var(--mu);
  }
  .qc-row {
    display: grid;
    grid-template-columns: 1fr 1fr 90px 30px;
    gap: 0;
    align-items: center;
    border-bottom: 1px solid var(--bd);
    padding: 0 8px;
  }
  .qc-row:last-child { border-bottom: none; }
  .qc-input {
    font-size: 0.8rem;
    background: transparent;
    border: none;
    padding: 7px 4px;
    font-family: var(--font);
    color: var(--tx);
    width: 100%;
  }
  .qc-input:focus { outline: none; background: var(--ac-bg); }
  .qc-col-flag {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 4px;
  }
  .qc-flag-sel {
    font-size: 0.72rem;
    padding: 2px 4px;
    border: 1px solid var(--bd);
    border-radius: 3px;
    background: var(--sf2);
    color: var(--tx2);
    cursor: pointer;
    font-family: var(--font);
    width: 55px;
  }
  .qc-dot {
    width: 7px; height: 7px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .qc-pass { background: var(--gn); }
  .qc-warn { background: var(--yw); }
  .qc-fail { background: var(--rd); }

  /* Linked resources */
  .linked-papers { display: flex; flex-direction: column; gap: 6px; }
  .doi-list { display: flex; flex-direction: column; gap: 3px; }
  .doi-row { display: flex; align-items: center; gap: 6px; }
  .doi-link {
    font-size: 0.8rem;
    color: var(--ac);
    text-decoration: none;
    font-family: var(--mono);
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .doi-link:hover { text-decoration: underline; }
  .link-actions { display: flex; gap: 8px; flex-wrap: wrap; }

  /* Run notes */
  .run-notes-area, .proto-body-area {
    width: 100%;
    font-size: 0.85rem;
    font-family: var(--mono);
    resize: vertical;
  }
  .autosave-hint { margin-top: 4px; }

  /* Danger icon */
  .danger-icon { color: var(--mu); }
  .danger-icon:hover { color: var(--rd); background: var(--rd-bg); }

  /* Forms */
  .form-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 14px;
  }
  .form-full { grid-column: 1 / -1; }
  .form-group { display: flex; flex-direction: column; gap: 4px; }
  .form-label {
    font-size: 0.72rem;
    font-weight: 700;
    color: var(--mu);
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }
  .form-input {
    padding: 7px 10px;
    font-size: 0.85rem;
  }
  .req { color: var(--rd); }

  .template-preview {
    background: var(--sf2);
    border: 1px solid var(--bd);
    border-radius: var(--radius-sm);
    padding: 10px 14px;
  }
  .template-note { margin: 0; }

  /* Default dashboard */
  .default-panel { padding: 32px; }
  .pipeline-title-row { margin-bottom: 8px; }
  .pipeline-title-row h2 { margin-bottom: 4px; }

  .stats-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 12px;
    margin-bottom: 8px;
  }
  .stat-card {
    background: var(--sf);
    border: 1px solid var(--bd);
    border-radius: var(--radius);
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .stat-card-ac  { border-color: var(--ac); background: var(--ac-bg); }
  .stat-card-gn  { border-color: var(--gn); background: var(--gn-bg); }
  .stat-card-pu  { border-color: var(--pu); background: var(--pu-bg); }
  .stat-num {
    font-size: 1.8rem;
    font-weight: 800;
    font-variant-numeric: tabular-nums;
    color: var(--tx);
    line-height: 1;
  }
  .stat-label {
    font-size: 0.72rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--mu);
  }

  .recent-section { display: flex; flex-direction: column; gap: 8px; }
  .recent-list { display: flex; flex-direction: column; gap: 4px; }
  .recent-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 10px 14px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--bd);
    background: var(--sf);
    cursor: pointer;
    transition: all var(--transition);
    text-align: left;
    width: 100%;
  }
  .recent-item:hover { border-color: var(--ac); background: var(--ac-bg); }
  .recent-item-left { display: flex; flex-direction: column; gap: 3px; flex: 1; min-width: 0; }
  .recent-title {
    font-size: 0.88rem;
    font-weight: 600;
    color: var(--tx);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .recent-meta { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }

  .run-status-pill {
    padding: 2px 8px;
    border-radius: 12px;
    font-size: 0.7rem;
    font-weight: 700;
    flex-shrink: 0;
  }
  .run-status-pill.status-planned   { background: var(--sf2);   color: var(--mu); }
  .run-status-pill.status-running   { background: var(--ac-bg); color: var(--ac); }
  .run-status-pill.status-qc        { background: var(--yw-bg); color: var(--yw); }
  .run-status-pill.status-completed { background: var(--gn-bg); color: var(--gn); }
  .run-status-pill.status-failed    { background: var(--rd-bg); color: var(--rd); }
  .run-status-pill.status-archived  { background: var(--sf2);   color: var(--mu); }

  .cta-btn {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    padding: 14px 24px;
    border-radius: var(--radius);
    background: var(--ac);
    color: white;
    font-size: 0.9rem;
    font-weight: 700;
    border: none;
    cursor: pointer;
    transition: opacity var(--transition);
    align-self: flex-start;
  }
  .cta-btn:hover { opacity: 0.85; }

  @media (max-width: 768px) {
    .mobile-sidebar-toggle { display: flex; }
    .left-panel {
      position: absolute;
      top: 0; left: 0;
      height: 100%;
      z-index: 20;
      box-shadow: var(--shadow-lg);
    }
    .pipeline.sidebar-closed .left-panel { display: none; }
    .main-scroll { padding: 16px; padding-top: 48px; }
    .form-grid { grid-template-columns: 1fr; }
    .stats-grid { grid-template-columns: 1fr 1fr; }
    .default-panel { padding: 48px 16px 16px; }
  }

  @media (max-width: 480px) {
    .stats-grid { grid-template-columns: 1fr 1fr; }
    .run-meta-grid { grid-template-columns: 1fr; }
    .qc-header, .qc-row { grid-template-columns: 1fr 1fr 80px 26px; }
  }
</style>
