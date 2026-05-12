<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { store } from '../lib/store.svelte';
  import { analyzeNoteGraph, synthesizeNotes, graphNarrative, streamBridgeNote, streamIdeaSpark } from '../lib/groq';
  import { nanoid } from 'nanoid';

  let { onClose }: { onClose: () => void } = $props();

  interface SimNode {
    id: string; title: string; color: string | undefined; tags: string[];
    x: number; y: number; vx: number; vy: number;
    r: number; pinned: boolean;
    nodeType: 'note' | 'journal';
    snippet: string;
    wordCount: number;
    updatedAt: number;
  }
  interface SimEdge { source: string; target: string; semantic?: boolean; }
  interface EdgeStrength { link: number; tag: number; content: number; coCite: number; composite: number; }

  const COLOR_MAP: Record<string, string> = {
    ac: '#3d7fff', gn: '#52c77f', rd: '#e85d5d',
    yw: '#f5a623', pu: '#7c67ee', enzo: '#f97316',
  };
  const TAG_PALETTE = ['ac', 'gn', 'rd', 'yw', 'pu', 'enzo'];
  const JOURNAL_COLOR = '#f5a623';

  function tagToColor(tag: string): string {
    let h = 0;
    for (const c of tag) h = (h * 31 + c.charCodeAt(0)) & 0x7fffffff;
    return TAG_PALETTE[h % TAG_PALETTE.length];
  }

  let svgEl: SVGSVGElement;
  let W = $state(800);
  let H = $state(600);
  let renderTick = $state(0);
  let hoverId = $state<string | null>(null);
  let draggingId: string | null = null;
  let dragOffset = { x: 0, y: 0 };

  let focusId = $state<string | null>(null);
  let searchQ = $state('');
  let colorMode = $state<'note' | 'tag' | 'heatmap'>('note');
  let selectMode = $state(false);
  let selectedNodes = $state(new Set<string>());

  // Strength
  let strengthEdges = $state<{ source: string; target: string; s: EdgeStrength }[]>([]);
  let strengthThreshold = $state(0.05);
  const strengthMap = new Map<string, EdgeStrength>();
  const avgStrengthMap = new Map<string, number>();
  let edgeTooltip = $state<{ x: number; y: number; s: EdgeStrength; titleA: string; titleB: string } | null>(null);
  let nodeTooltip = $state<{ x: number; y: number; n: SimNode } | null>(null);

  // Enzo analysis
  let semanticEdges = $state<{ a: string; b: string }[]>([]);
  let clusterData = $state<{ label: string; ids: string[] }[]>([]);
  let gapObservations = $state<string[]>([]);
  let analyzing = $state(false);
  let analyzeError = $state('');

  // Panels
  type PanelType = 'gaps' | 'synth' | 'narrative' | 'bridge' | 'spark';
  let showPanel = $state<PanelType | null>(null);
  let synthText = $state('');
  let synthStreaming = $state(false);
  let synthAbort: AbortController | null = null;
  let narrativeText = $state('');
  let narrativeStreaming = $state(false);
  let narrativeAbort: AbortController | null = null;
  let bridgeText = $state('');
  let bridgeStreaming = $state(false);
  let bridgeAbort: AbortController | null = null;
  let sparkText = $state('');
  let sparkStreaming = $state(false);
  let sparkAbort: AbortController | null = null;

  let simNodes: SimNode[] = [];
  let simEdges: SimEdge[] = [];
  const nodeMap = new Map<string, SimNode>();
  let rafId = 0;
  let settled = false;
  let tickCount = 0;

  const focusSet = $derived((() => {
    if (!focusId) return null;
    const s = new Set([focusId]);
    for (const e of simEdges) {
      if (e.source === focusId) s.add(e.target);
      if (e.target === focusId) s.add(e.source);
    }
    for (const e of semanticEdges) {
      if (e.a === focusId) s.add(e.b);
      if (e.b === focusId) s.add(e.a);
    }
    for (const e of strengthEdges) {
      if (e.source === focusId) s.add(e.target);
      if (e.target === focusId) s.add(e.source);
    }
    return s;
  })());

  const searchMatches = $derived(
    searchQ.trim()
      ? new Set(simNodes.filter(n => n.title.toLowerCase().includes(searchQ.toLowerCase().trim())).map(n => n.id))
      : null
  );

  const clusterLabels = $derived(renderTick >= 0 ? clusterData.map(c => {
    const members = c.ids.map(id => nodeMap.get(id)).filter(Boolean) as SimNode[];
    if (!members.length) return null;
    return {
      label: c.label,
      cx: members.reduce((s, n) => s + n.x, 0) / members.length,
      cy: Math.min(...members.map(n => n.y)) - 18,
    };
  }).filter(Boolean) : []);

  const nodes = $derived(renderTick >= 0 ? [...simNodes] : []);
  const edges = $derived(renderTick >= 0 ? [...simEdges] : []);
  const visibleStrengthEdges = $derived(
    strengthEdges.filter(e => e.s.composite >= strengthThreshold)
  );

  function heatColor(nodeId: string): string {
    const allVals = [...avgStrengthMap.values()];
    const max = Math.max(...allVals, 0.001);
    const v = Math.min(1, (avgStrengthMap.get(nodeId) ?? 0) / max);
    const r = Math.round(61 + v * (249 - 61));
    const g = Math.round(127 + v * (115 - 127));
    const b = Math.round(255 + v * (0 - 255));
    return `rgb(${r},${g},${b})`;
  }

  function nodeColor(n: SimNode): string {
    if (colorMode === 'heatmap') return heatColor(n.id);
    if (colorMode === 'tag') {
      const tag = n.tags[0];
      if (tag) return COLOR_MAP[tagToColor(tag)] ?? COLOR_MAP.ac;
      return '#888';
    }
    if (n.nodeType === 'journal') return JOURNAL_COLOR;
    return n.color ? (COLOR_MAP[n.color] ?? COLOR_MAP.ac) : COLOR_MAP.ac;
  }

  function nodeOpacity(n: SimNode): number {
    if (searchMatches) return searchMatches.has(n.id) ? 1 : 0.15;
    if (focusSet) return focusSet.has(n.id) ? 1 : 0.15;
    if (selectMode && selectedNodes.size > 0) return selectedNodes.has(n.id) ? 1 : 0.45;
    return hoverId === n.id ? 0.95 : 0.72;
  }

  function edgeStrokeColor(s: EdgeStrength): string {
    const wL = s.link * 0.35, wT = s.tag * 0.20, wC = s.content * 0.35;
    if (wL >= wC && wL >= wT && s.link > 0.1) return '#3d7fff';
    if (wT >= wL && wT >= wC && s.tag > 0.15) return '#52c77f';
    return '#7c67ee';
  }

  function edgeStrokeWidth(s: EdgeStrength): number {
    return 0.8 + s.composite * 4.2;
  }

  function edgeOpacity(s: EdgeStrength): number {
    return 0.15 + s.composite * 0.7;
  }

  // ── Stop words for TF-IDF ────────────────────────────────────────
  const STOP = new Set(['the','a','an','and','or','but','in','on','at','to','for','of','with','that','this','is','are','was','were','be','been','have','has','had','do','did','will','would','could','should','may','might','it','its','by','from','as','into','through','during','before','after','then','when','where','which','who','what','he','she','we','you','they','them','our','their','not','also','more','been','if','so','about','can','these','those','all','some','any','up','out','no','just']);

  function tokenize(text: string): string[] {
    return text.toLowerCase().replace(/<[^>]+>/g, ' ').replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length > 3 && !STOP.has(w));
  }

  function computeStrength() {
    strengthMap.clear();
    avgStrengthMap.clear();

    const notes = store.notes.filter(n => !n.archived);
    const journals = store.journal;

    const corpus = [
      ...notes.map(n => ({ id: n.id, text: n.body.replace(/<[^>]+>/g, ' '), tags: Array.isArray((n as any).tags) ? (n as any).tags as string[] : [] })),
      ...journals.map(j => ({ id: j.id, text: j.body.replace(/<[^>]+>/g, ' '), tags: [j.contextTag, j.mood].filter(Boolean) })),
    ];

    if (corpus.length < 2) return;

    // TF-IDF
    const tfMap = new Map<string, Map<string, number>>();
    const dfMap = new Map<string, number>();
    for (const doc of corpus) {
      const tokens = tokenize(doc.text);
      const tf = new Map<string, number>();
      for (const t of tokens) tf.set(t, (tf.get(t) ?? 0) + 1);
      const maxTf = Math.max(...tf.values(), 1);
      for (const [t, c] of tf) tf.set(t, c / maxTf);
      tfMap.set(doc.id, tf);
      for (const t of tf.keys()) dfMap.set(t, (dfMap.get(t) ?? 0) + 1);
    }
    const N = corpus.length;
    const tfidfMap = new Map<string, Map<string, number>>();
    for (const [id, tf] of tfMap) {
      const v = new Map<string, number>();
      for (const [t, val] of tf) {
        v.set(t, val * Math.log((N + 1) / ((dfMap.get(t) ?? 0) + 1)));
      }
      tfidfMap.set(id, v);
    }

    // Link counts
    const linkCount = new Map<string, number>();
    for (const e of simEdges) {
      const key = [e.source, e.target].sort().join('::');
      linkCount.set(key, (linkCount.get(key) ?? 0) + 1);
    }

    // Co-citation
    const inbound = new Map<string, Set<string>>();
    for (const e of simEdges) {
      if (!inbound.has(e.target)) inbound.set(e.target, new Set());
      inbound.get(e.target)!.add(e.source);
    }

    const tagSets = new Map(corpus.map(d => [d.id, new Set(d.tags)]));

    for (let i = 0; i < corpus.length; i++) {
      for (let j = i + 1; j < corpus.length; j++) {
        const a = corpus[i], b = corpus[j];
        const key = [a.id, b.id].sort().join('::');

        const linkRaw = linkCount.get(key) ?? 0;
        const link = Math.min(1, linkRaw / 3);

        const tA = tagSets.get(a.id)!, tB = tagSets.get(b.id)!;
        const inter = [...tA].filter(t => tB.has(t)).length;
        const union = new Set([...tA, ...tB]).size;
        const tag = union > 0 ? inter / union : 0;

        const va = tfidfMap.get(a.id)!, vb = tfidfMap.get(b.id)!;
        let dot = 0, magA = 0, magB = 0;
        for (const [t, v] of va) { dot += v * (vb.get(t) ?? 0); magA += v * v; }
        for (const v of vb.values()) magB += v * v;
        const content = magA && magB ? dot / (Math.sqrt(magA) * Math.sqrt(magB)) : 0;

        const sharedCite = [...(inbound.get(a.id) ?? [])].filter(id => (inbound.get(b.id) ?? new Set()).has(id)).length;
        const coCite = Math.min(1, sharedCite / 3);

        const composite = Math.min(1, link * 0.35 + tag * 0.20 + content * 0.35 + coCite * 0.10);

        if (composite > 0.04) {
          strengthMap.set(key, { link, tag, content, coCite, composite });
        }
      }
    }

    // avg per node for heatmap
    const sums = new Map<string, number>(), counts = new Map<string, number>();
    for (const [key, s] of strengthMap) {
      const [idA, idB] = key.split('::');
      sums.set(idA, (sums.get(idA) ?? 0) + s.composite);
      sums.set(idB, (sums.get(idB) ?? 0) + s.composite);
      counts.set(idA, (counts.get(idA) ?? 0) + 1);
      counts.set(idB, (counts.get(idB) ?? 0) + 1);
    }
    for (const [id, sum] of sums) avgStrengthMap.set(id, sum / (counts.get(id) ?? 1));

    // Build reactive edge array
    const arr: { source: string; target: string; s: EdgeStrength }[] = [];
    for (const [key, s] of strengthMap) {
      const [source, target] = key.split('::');
      // only draw if both nodes exist and it's not already a structural edge
      if (nodeMap.has(source) && nodeMap.has(target)) {
        arr.push({ source, target, s });
      }
    }
    strengthEdges = arr;
  }

  function buildGraph() {
    const notes = store.notes.filter(n => !n.archived);
    const journals = store.journal;
    const cx = W / 2, cy = H / 2;

    const noteNodes: SimNode[] = notes.map(n => {
      const text = n.body.replace(/<[^>]+>/g, ' ');
      const wc = Math.min(200, Math.max(10, text.split(/\s+/).filter(Boolean).length));
      const r = 6 + Math.sqrt(wc) * 0.6;
      const angle = Math.random() * Math.PI * 2;
      const dist = 60 + Math.random() * Math.min(W, H) * 0.3;
      return {
        id: n.id, title: n.title || 'Untitled', color: n.color,
        tags: Array.isArray((n as any).tags) ? (n as any).tags : [],
        x: cx + Math.cos(angle) * dist, y: cy + Math.sin(angle) * dist,
        vx: 0, vy: 0, r, pinned: false, nodeType: 'note',
        snippet: text.trim().slice(0, 180),
        wordCount: wc, updatedAt: n.updatedAt,
      };
    });

    const journalNodes: SimNode[] = journals.map(j => {
      const text = j.body.replace(/<[^>]+>/g, ' ');
      const wc = Math.min(120, Math.max(8, text.split(/\s+/).filter(Boolean).length));
      const r = 5 + Math.sqrt(wc) * 0.5;
      const angle = Math.random() * Math.PI * 2;
      const dist = 80 + Math.random() * Math.min(W, H) * 0.3;
      const date = new Date(j.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
      const title = j.contextTag ? `${j.contextTag} · ${date}` : `Journal · ${date}`;
      return {
        id: j.id, title, color: undefined,
        tags: [j.contextTag, j.mood].filter(Boolean),
        x: cx + Math.cos(angle) * dist, y: cy + Math.sin(angle) * dist,
        vx: 0, vy: 0, r, pinned: false, nodeType: 'journal',
        snippet: text.trim().slice(0, 180),
        wordCount: wc, updatedAt: j.updatedAt,
      };
    });

    simNodes = [...noteNodes, ...journalNodes];
    nodeMap.clear();
    simNodes.forEach(n => nodeMap.set(n.id, n));

    const noteSet = new Set(notes.map(n => n.id));
    simEdges = [];
    for (const n of notes) {
      const matches = n.body.matchAll(/href="note:([a-zA-Z0-9_-]+)"/g);
      for (const m of matches) {
        if (m[1] !== n.id && noteSet.has(m[1]))
          simEdges.push({ source: n.id, target: m[1] });
      }
    }

    computeStrength();
  }

  function tick() {
    if (settled) { rafId = requestAnimationFrame(tick); return; }
    tickCount++;
    const alpha = Math.max(0.01, 1 - tickCount / 300);
    const allEdges = [...simEdges, ...semanticEdges.map(e => ({ source: e.a, target: e.b, semantic: true }))];

    // Repulsion
    for (let i = 0; i < simNodes.length; i++) {
      for (let j = i + 1; j < simNodes.length; j++) {
        const a = simNodes[i], b = simNodes[j];
        const dx = b.x - a.x || 0.01, dy = b.y - a.y || 0.01;
        const dist2 = dx * dx + dy * dy;
        const dist = Math.sqrt(dist2) || 0.01;
        const repel = 3500 / dist2;
        const fx = (dx / dist) * repel * alpha, fy = (dy / dist) * repel * alpha;
        if (!a.pinned) { a.vx -= fx; a.vy -= fy; }
        if (!b.pinned) { b.vx += fx; b.vy += fy; }
      }
    }

    // Structural + semantic springs
    for (const e of allEdges) {
      const s = nodeMap.get(e.source), t = nodeMap.get(e.target);
      if (!s || !t) continue;
      const dx = t.x - s.x, dy = t.y - s.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
      const rest = e.semantic ? 140 : 110;
      const spring = (dist - rest) * 0.04 * alpha;
      const fx = (dx / dist) * spring, fy = (dy / dist) * spring;
      if (!s.pinned) { s.vx += fx; s.vy += fy; }
      if (!t.pinned) { t.vx -= fx; t.vy -= fy; }
    }

    // Strength-based attraction (composite ≥ 0.35)
    for (const e of strengthEdges) {
      if (e.s.composite < 0.35) continue;
      const s = nodeMap.get(e.source), t = nodeMap.get(e.target);
      if (!s || !t) continue;
      const dx = t.x - s.x, dy = t.y - s.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
      const rest = 90 - e.s.composite * 50;
      const spring = (dist - rest) * 0.025 * alpha;
      const fx = (dx / dist) * spring, fy = (dy / dist) * spring;
      if (!s.pinned) { s.vx += fx; s.vy += fy; }
      if (!t.pinned) { t.vx -= fx; t.vy -= fy; }
    }

    let maxV = 0;
    for (const n of simNodes) {
      if (n.pinned) continue;
      n.vx += (W / 2 - n.x) * 0.003 * alpha;
      n.vy += (H / 2 - n.y) * 0.003 * alpha;
      n.vx *= 0.82; n.vy *= 0.82;
      n.x += n.vx; n.y += n.vy;
      n.x = Math.max(n.r + 4, Math.min(W - n.r - 4, n.x));
      n.y = Math.max(n.r + 4, Math.min(H - n.r - 4, n.y));
      maxV = Math.max(maxV, Math.abs(n.vx), Math.abs(n.vy));
    }

    if (maxV < 0.05 && tickCount > 60) settled = true;
    renderTick++;
    rafId = requestAnimationFrame(tick);
  }

  function resize() {
    if (!svgEl) return;
    const rect = svgEl.parentElement!.getBoundingClientRect();
    W = rect.width; H = rect.height;
  }

  onMount(() => {
    resize();
    buildGraph();
    rafId = requestAnimationFrame(tick);
    window.addEventListener('resize', resize);
  });

  onDestroy(() => {
    cancelAnimationFrame(rafId);
    window.removeEventListener('resize', resize);
    synthAbort?.abort(); narrativeAbort?.abort();
    bridgeAbort?.abort(); sparkAbort?.abort();
  });

  function openNode(n: SimNode) {
    if (n.nodeType === 'journal') {
      store.selectedJournalId = n.id;
      store.view = 'journal';
    } else {
      store.currentNoteId = n.id;
    }
    onClose();
  }

  function handleNodeClick(id: string) {
    if (selectMode) {
      const next = new Set(selectedNodes);
      if (next.has(id)) next.delete(id); else next.add(id);
      selectedNodes = next;
    } else {
      focusId = focusId === id ? null : id;
    }
  }

  function handleNodeDblClick(id: string) {
    if (!selectMode) {
      const n = nodeMap.get(id);
      if (n) openNode(n);
    }
  }

  function onSvgMouseDown(e: MouseEvent) {
    const target = (e.target as Element).closest('[data-nid]');
    if (!target) return;
    const id = target.getAttribute('data-nid')!;
    const n = nodeMap.get(id);
    if (!n) return;
    draggingId = id;
    n.pinned = true;
    const svgRect = svgEl.getBoundingClientRect();
    dragOffset.x = e.clientX - svgRect.left - n.x;
    dragOffset.y = e.clientY - svgRect.top - n.y;
    e.preventDefault();
  }

  function onSvgMouseMove(e: MouseEvent) {
    if (!draggingId) return;
    const n = nodeMap.get(draggingId);
    if (!n) return;
    const svgRect = svgEl.getBoundingClientRect();
    n.x = Math.max(n.r + 4, Math.min(W - n.r - 4, e.clientX - svgRect.left - dragOffset.x));
    n.y = Math.max(n.r + 4, Math.min(H - n.r - 4, e.clientY - svgRect.top - dragOffset.y));
    settled = false; tickCount = 0; renderTick++;
  }

  let wasDragging = false;
  function onSvgMouseUp() {
    if (draggingId) wasDragging = true; else wasDragging = false;
    draggingId = null;
  }

  function flyTo(id: string) {
    const n = nodeMap.get(id);
    if (!n) return;
    focusId = id;
    n.x = W / 2; n.y = H / 2;
    n.vx = 0; n.vy = 0;
    settled = false; tickCount = 0; renderTick++;
  }

  function handleSearchKey(e: KeyboardEvent) {
    if (e.key === 'Enter' && searchMatches && searchMatches.size === 1) flyTo([...searchMatches][0]);
    if (e.key === 'Escape') searchQ = '';
  }

  function handleEdgeEnter(e: MouseEvent, key: string, s: EdgeStrength) {
    const [idA, idB] = key.split('::');
    const svgRect = svgEl.getBoundingClientRect();
    edgeTooltip = {
      x: e.clientX - svgRect.left,
      y: e.clientY - svgRect.top,
      s, titleA: nodeMap.get(idA)?.title ?? '', titleB: nodeMap.get(idB)?.title ?? '',
    };
  }

  function handleNodeEnter(e: MouseEvent, n: SimNode) {
    hoverId = n.id;
    const svgRect = svgEl.getBoundingClientRect();
    nodeTooltip = { x: e.clientX - svgRect.left, y: e.clientY - svgRect.top, n };
  }

  async function runEnzoAnalysis() {
    if (analyzing) return;
    analyzing = true; analyzeError = '';
    try {
      const notes = store.notes.filter(n => !n.archived).map(n => ({
        id: n.id, title: n.title || 'Untitled',
        snippet: n.body.replace(/<[^>]+>/g, ' ').trim().slice(0, 300),
        tags: Array.isArray((n as any).tags) ? (n as any).tags : [],
      }));
      const result = await analyzeNoteGraph(notes);
      clusterData = result.clusters ?? [];
      semanticEdges = result.semantic_edges ?? [];
      gapObservations = result.gaps ?? [];
      settled = false; tickCount = 0;
    } catch {
      analyzeError = 'Analysis failed. Check API key.';
    } finally {
      analyzing = false;
    }
  }

  async function runSynthesis() {
    if (synthStreaming) { synthAbort?.abort(); return; }
    const ids = selectMode && selectedNodes.size > 0 ? [...selectedNodes] : simNodes.map(n => n.id);
    const notes = store.notes.filter(n => ids.includes(n.id)).map(n => ({
      title: n.title || 'Untitled',
      body: n.body.replace(/<[^>]+>/g, ' ').trim(),
    }));
    if (!notes.length) return;
    synthText = ''; synthStreaming = true; showPanel = 'synth';
    synthAbort = new AbortController();
    try {
      await synthesizeNotes(notes, chunk => { synthText += chunk; }, synthAbort.signal);
    } catch { /* aborted */ }
    synthStreaming = false;
  }

  function clearSelection() { selectedNodes = new Set(); selectMode = false; showPanel = null; }

  async function runNarrative() {
    if (narrativeStreaming) { narrativeAbort?.abort(); return; }
    if (!clusterData.length) return;
    narrativeText = ''; narrativeStreaming = true; showPanel = 'narrative';
    narrativeAbort = new AbortController();
    const isolated = simNodes.filter(n => !clusterData.some(c => c.ids.includes(n.id))).map(n => n.title);
    try {
      await graphNarrative(
        clusterData.map(c => ({ label: c.label, titles: c.ids.map(id => nodeMap.get(id)?.title ?? '').filter(Boolean) })),
        isolated, chunk => { narrativeText += chunk; }, narrativeAbort.signal
      );
    } catch { /* aborted */ }
    narrativeStreaming = false;
  }

  async function runBridge() {
    if (bridgeStreaming) { bridgeAbort?.abort(); return; }
    const [idA, idB] = [...selectedNodes];
    const nA = nodeMap.get(idA), nB = nodeMap.get(idB);
    if (!nA || !nB) return;
    const key = [idA, idB].sort().join('::');
    const s = strengthMap.get(key) ?? { link: 0, tag: 0, content: 0, coCite: 0, composite: 0 };
    bridgeText = ''; bridgeStreaming = true; showPanel = 'bridge';
    bridgeAbort = new AbortController();
    try {
      await streamBridgeNote(
        { title: nA.title, snippet: nA.snippet, type: nA.nodeType },
        { title: nB.title, snippet: nB.snippet, type: nB.nodeType },
        s, chunk => { bridgeText += chunk; }, bridgeAbort.signal
      );
    } catch { /* aborted */ }
    bridgeStreaming = false;
  }

  async function runSpark() {
    if (sparkStreaming) { sparkAbort?.abort(); return; }
    // Find top content-similar but not explicitly linked pairs
    const candidates: { title: string; snippet: string; type: 'note' | 'journal' }[] = [];
    const seen = new Set<string>();
    const sorted = [...strengthMap.entries()]
      .filter(([, s]) => s.content >= 0.2 && s.link === 0)
      .sort(([, a], [, b]) => b.content - a.content)
      .slice(0, 5);
    for (const [key] of sorted) {
      for (const id of key.split('::')) {
        if (!seen.has(id)) {
          seen.add(id);
          const n = nodeMap.get(id);
          if (n) candidates.push({ title: n.title, snippet: n.snippet, type: n.nodeType });
        }
      }
    }
    if (!candidates.length) { sparkText = 'No weak-link pairs detected — run searches and add more notes first.'; showPanel = 'spark'; return; }
    sparkText = ''; sparkStreaming = true; showPanel = 'spark';
    sparkAbort = new AbortController();
    try {
      await streamIdeaSpark(candidates.slice(0, 6), chunk => { sparkText += chunk; }, sparkAbort.signal);
    } catch { /* aborted */ }
    sparkStreaming = false;
  }

  function saveGeneratedNote(text: string, prefix: string, tags: string[]) {
    if (!text) return;
    const n = {
      id: nanoid(), title: `${prefix} — ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`,
      body: text.replace(/\n/g, '<br>'), color: undefined, tags,
      createdAt: Date.now(), updatedAt: Date.now(), archived: false,
    } as any;
    store.notes = [n, ...store.notes];
    store.currentNoteId = n.id;
    onClose();
  }

  function copySynthText() { navigator.clipboard.writeText(synthText).catch(() => {}); }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="graph-overlay">
  <!-- Header -->
  <div class="graph-header">
    <span class="graph-title">Note Knowledge Graph</span>
    <span class="graph-sub">
      {simNodes.filter(n => n.nodeType === 'note').length} notes · {simNodes.filter(n => n.nodeType === 'journal').length} journal · {simEdges.length} links · {strengthEdges.length} relational
    </span>

    <div class="graph-toolbar">
      <!-- Search -->
      <div class="search-wrap">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
        <input class="graph-search" placeholder="Search notes…" bind:value={searchQ} onkeydown={handleSearchKey} />
        {#if searchMatches && searchMatches.size === 1}
          <button class="fly-btn" onclick={() => flyTo([...searchMatches!][0])} title="Fly to">→</button>
        {/if}
      </div>

      <!-- Color mode -->
      <button class="tb-btn" class:active={colorMode === 'tag'} onclick={() => colorMode = colorMode === 'tag' ? 'note' : 'tag'} title="Color by tag">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 2v10l6 3"/></svg>
        {colorMode === 'tag' ? 'Tag' : 'Color'}
      </button>

      <!-- Heatmap -->
      <button class="tb-btn" class:active={colorMode === 'heatmap'} onclick={() => colorMode = colorMode === 'heatmap' ? 'note' : 'heatmap'} title="Strength heatmap">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a7 7 0 017 7c0 5-7 13-7 13S5 14 5 9a7 7 0 017-7z"/><circle cx="12" cy="9" r="2.5"/></svg>
        Hub
      </button>

      <!-- Strength threshold -->
      <div class="threshold-wrap" title="Edge strength threshold">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
        <input type="range" min="0" max="0.9" step="0.05" bind:value={strengthThreshold} class="threshold-slider" />
        <span class="threshold-val">{(strengthThreshold * 100).toFixed(0)}%</span>
      </div>

      <!-- Select mode -->
      <button class="tb-btn" class:active={selectMode} onclick={() => { selectMode = !selectMode; if (!selectMode) clearSelection(); }} title="Multi-select">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
        {selectMode ? `${selectedNodes.size} sel` : 'Select'}
      </button>

      <!-- Bridge (2 selected) -->
      {#if selectMode && selectedNodes.size === 2}
        <button class="tb-btn bridge-btn" onclick={runBridge} title="Generate bridge note between selected nodes">
          {#if bridgeStreaming}
            <span class="spin">⟳</span> Bridging…
          {:else}
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 12h16M4 12l4-4M4 12l4 4M20 12l-4-4M20 12l-4 4"/></svg>
            Bridge ⚡
          {/if}
        </button>
      {/if}

      <!-- Blend (3+ selected) -->
      {#if selectMode && selectedNodes.size >= 3}
        <button class="tb-btn synth-btn" onclick={runSynthesis} title="Blend selected notes weighted by relational strength">
          {#if synthStreaming}Stop{:else}Blend ✦{/if}
        </button>
      {/if}

      <!-- Enzo analyse -->
      <button class="tb-btn enzo-btn" onclick={runEnzoAnalysis} disabled={analyzing} title="Enzo: analyse graph">
        {#if analyzing}<span class="spin">⟳</span> Analysing…{:else}
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a10 10 0 1 0 10 10"/><path d="M22 2 12 12"/></svg>
          Enzo Analyse
        {/if}
      </button>

      <!-- Idea Spark -->
      <button class="tb-btn spark-btn" onclick={runSpark} disabled={sparkStreaming} title="Generate idea from weakly-connected notes">
        {#if sparkStreaming}<span class="spin">⟳</span> Sparking…{:else}
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
          Spark ✧
        {/if}
      </button>

      {#if gapObservations.length}
        <button class="tb-btn gap-btn" onclick={() => showPanel = showPanel === 'gaps' ? null : 'gaps'}>
          Gaps ({gapObservations.length})
        </button>
      {/if}

      {#if clusterData.length}
        <button class="tb-btn narr-btn" onclick={runNarrative} disabled={narrativeStreaming}>
          {#if narrativeStreaming}<span class="spin">⟳</span> Narrative…{:else}
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
            Narrative
          {/if}
        </button>
      {/if}

      {#if focusId}
        <button class="tb-btn" onclick={() => focusId = null}>Clear focus</button>
      {/if}
    </div>

    <button class="graph-close" onclick={onClose}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
    </button>
  </div>

  {#if analyzeError}<p class="graph-error">{analyzeError}</p>{/if}

  <p class="graph-hint">
    {#if selectMode}
      Click nodes to select · Double-click to open · 2 selected → Bridge ⚡ · 3+ → Blend ✦
    {:else}
      Click = focus · Double-click = open · Drag = reposition · ◆ = journal entry · Edge colour: blue=link, green=tag, purple=content
    {/if}
  </p>

  <div class="graph-body">
    <div class="graph-canvas">
      <svg
        bind:this={svgEl}
        width={W} height={H}
        onmousedown={onSvgMouseDown}
        onmousemove={onSvgMouseMove}
        onmouseup={onSvgMouseUp}
        onmouseleave={() => { onSvgMouseUp(); edgeTooltip = null; nodeTooltip = null; }}
      >
        <!-- Strength edges (layered below structural) -->
        {#each visibleStrengthEdges as e (e.source + '~~' + e.target)}
          {@const s = nodeMap.get(e.source)}
          {@const t = nodeMap.get(e.target)}
          {#if s && t}
            {@const key = [e.source, e.target].sort().join('::')}
            <!-- hit area -->
            <line x1={s.x} y1={s.y} x2={t.x} y2={t.y}
              stroke="transparent" stroke-width="14"
              onmouseenter={(ev) => handleEdgeEnter(ev, key, e.s)}
              onmouseleave={() => edgeTooltip = null}
              style="cursor:crosshair"
            />
            <!-- visual line -->
            <line x1={s.x} y1={s.y} x2={t.x} y2={t.y}
              stroke={edgeStrokeColor(e.s)}
              stroke-width={edgeStrokeWidth(e.s)}
              stroke-opacity={edgeOpacity(e.s)}
              pointer-events="none"
            />
          {/if}
        {/each}

        <!-- Structural edges -->
        {#each edges as e (e.source + '→' + e.target)}
          {@const s = nodeMap.get(e.source)}
          {@const t = nodeMap.get(e.target)}
          {#if s && t}
            <line x1={s.x} y1={s.y} x2={t.x} y2={t.y}
              stroke="var(--bd)" stroke-width="1.6" stroke-opacity="0.7" pointer-events="none"
            />
          {/if}
        {/each}

        <!-- Semantic edges (dashed) -->
        {#each semanticEdges as e (e.a + '~' + e.b)}
          {@const s = nodeMap.get(e.a)}
          {@const t = nodeMap.get(e.b)}
          {#if s && t}
            <line x1={s.x} y1={s.y} x2={t.x} y2={t.y}
              stroke="#f97316" stroke-width="1" stroke-opacity="0.45"
              stroke-dasharray="5,4" pointer-events="none"
            />
          {/if}
        {/each}

        <!-- Cluster labels -->
        {#each clusterLabels as cl}
          {#if cl}
            <text x={cl.cx} y={cl.cy} text-anchor="middle" font-size="10"
              fill="var(--mu)" font-style="italic"
              paint-order="stroke" stroke="var(--bg)" stroke-width="3"
              pointer-events="none">{cl.label}</text>
          {/if}
        {/each}

        <!-- Nodes -->
        {#each nodes as n (n.id)}
          <!-- svelte-ignore a11y_click_events_have_key_events -->
          <g
            data-nid={n.id}
            class="graph-node"
            transform="translate({n.x},{n.y})"
            onmouseenter={(e) => handleNodeEnter(e, n)}
            onmouseleave={() => { hoverId = null; nodeTooltip = null; }}
            onclick={() => { if (!wasDragging) handleNodeClick(n.id); wasDragging = false; }}
            ondblclick={() => handleNodeDblClick(n.id)}
            style="cursor:pointer"
          >
            {#if n.nodeType === 'journal'}
              <!-- Diamond for journal entries -->
              <polygon
                points="0,{-n.r} {n.r},0 0,{n.r} {-n.r},0"
                fill={nodeColor(n)}
                fill-opacity={nodeOpacity(n)}
                stroke={selectedNodes.has(n.id) ? '#fff' : nodeColor(n)}
                stroke-width={selectedNodes.has(n.id) ? 2.5 : hoverId === n.id ? 2 : 1}
              />
            {:else}
              <!-- Circle for notes -->
              <circle r={n.r}
                fill={nodeColor(n)}
                fill-opacity={nodeOpacity(n)}
                stroke={selectedNodes.has(n.id) ? '#fff' : nodeColor(n)}
                stroke-width={selectedNodes.has(n.id) ? 2.5 : hoverId === n.id ? 2 : 1}
              />
            {/if}
            {#if n.r >= 10 || hoverId === n.id}
              <text y={n.r + 13} text-anchor="middle"
                font-size={hoverId === n.id ? 12 : 10}
                fill="var(--tx)"
                paint-order="stroke" stroke="var(--bg)" stroke-width="3"
                pointer-events="none"
              >{n.title.length > 22 ? n.title.slice(0, 20) + '…' : n.title}</text>
            {/if}
            {#if selectMode && selectedNodes.has(n.id)}
              <circle r="4" cx={n.r - 2} cy={-(n.r - 2)} fill="#fff" stroke="#3d7fff" stroke-width="1.5"/>
            {/if}
          </g>
        {/each}
      </svg>

      <!-- Edge tooltip -->
      {#if edgeTooltip}
        <div class="edge-tooltip" style="left:{edgeTooltip.x + 10}px;top:{edgeTooltip.y - 10}px">
          <div class="ett-titles">{edgeTooltip.titleA} ↔ {edgeTooltip.titleB}</div>
          <div class="ett-scores">
            <span class="ett-score sc-link">link {(edgeTooltip.s.link * 100).toFixed(0)}%</span>
            <span class="ett-score sc-tag">tag {(edgeTooltip.s.tag * 100).toFixed(0)}%</span>
            <span class="ett-score sc-content">content {(edgeTooltip.s.content * 100).toFixed(0)}%</span>
            <span class="ett-score sc-co">co-cite {(edgeTooltip.s.coCite * 100).toFixed(0)}%</span>
          </div>
          <div class="ett-composite">strength {(edgeTooltip.s.composite * 100).toFixed(0)}%</div>
        </div>
      {/if}

      <!-- Node tooltip -->
      {#if nodeTooltip}
        {@const nt = nodeTooltip}
        <div class="node-tooltip" style="left:{nt.x + nt.n.r + 8}px;top:{nt.y - 28}px">
          <div class="ntt-header">
            <span class="ntt-type-badge" class:badge-journal={nt.n.nodeType === 'journal'}>{nt.n.nodeType}</span>
            <span class="ntt-wc">{nt.n.wordCount}w</span>
            {#if avgStrengthMap.has(nt.n.id)}
              <span class="ntt-hub">hub {(avgStrengthMap.get(nt.n.id)! * 100).toFixed(0)}%</span>
            {/if}
          </div>
          {#if nt.n.snippet}
            <p class="ntt-snippet">{nt.n.snippet.slice(0, 120)}{nt.n.snippet.length > 120 ? '…' : ''}</p>
          {/if}
        </div>
      {/if}
    </div>

    <!-- Side panel -->
    {#if showPanel}
      <div class="graph-panel">
        <div class="panel-header">
          <span class="panel-title">
            {showPanel === 'gaps' ? 'Research Gaps' : showPanel === 'narrative' ? 'Research Narrative' : showPanel === 'bridge' ? 'Bridge Note ⚡' : showPanel === 'spark' ? 'Idea Spark ✧' : 'Synthesis'}
          </span>
          <button class="panel-close" onclick={() => showPanel = null}>×</button>
        </div>

        {#if showPanel === 'gaps'}
          <div class="panel-body">
            {#each gapObservations as gap, i}
              <div class="gap-item"><span class="gap-num">{i + 1}</span><span>{gap}</span></div>
            {/each}
          </div>

        {:else if showPanel === 'synth'}
          <div class="panel-body">
            {#if synthStreaming}<p class="synth-streaming">Enzo is synthesising…</p>{/if}
            <p class="synth-text">{synthText || (synthStreaming ? '' : 'No synthesis yet.')}</p>
            {#if synthText && !synthStreaming}
              <div class="panel-actions">
                <button class="panel-action-btn" onclick={copySynthText}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>Copy
                </button>
                <button class="panel-action-btn" onclick={() => saveGeneratedNote(synthText, 'Graph synthesis', ['graph-synthesis'])}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>New note
                </button>
              </div>
            {/if}
          </div>

        {:else if showPanel === 'narrative'}
          <div class="panel-body">
            {#if narrativeStreaming}<p class="synth-streaming">Enzo is writing…</p>{/if}
            <p class="synth-text narrative-text">{narrativeText || (narrativeStreaming ? '' : 'Run "Enzo Analyse" first.')}</p>
            {#if narrativeText && !narrativeStreaming}
              <div class="panel-actions">
                <button class="panel-action-btn" onclick={() => navigator.clipboard.writeText(narrativeText).catch(() => {})}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>Copy
                </button>
              </div>
            {/if}
          </div>

        {:else if showPanel === 'bridge'}
          <div class="panel-body">
            {#if bridgeStreaming}<p class="synth-streaming">Enzo is bridging…</p>{/if}
            <p class="synth-text">{bridgeText || (bridgeStreaming ? '' : 'Select exactly 2 nodes, then click Bridge ⚡.')}</p>
            {#if bridgeText && !bridgeStreaming}
              <div class="panel-actions">
                <button class="panel-action-btn" onclick={() => navigator.clipboard.writeText(bridgeText).catch(() => {})}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>Copy
                </button>
                <button class="panel-action-btn" onclick={() => saveGeneratedNote(bridgeText, 'Bridge note', ['bridge', 'graph-generated'])}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>Save as note
                </button>
              </div>
            {/if}
          </div>

        {:else if showPanel === 'spark'}
          <div class="panel-body">
            {#if sparkStreaming}<p class="synth-streaming">Enzo is sparking…</p>{/if}
            <p class="synth-text">{sparkText || (sparkStreaming ? '' : 'Click Spark ✧ to generate an idea from weak connections.')}</p>
            {#if sparkText && !sparkStreaming && !sparkText.startsWith('No weak')}
              <div class="panel-actions">
                <button class="panel-action-btn" onclick={() => navigator.clipboard.writeText(sparkText).catch(() => {})}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>Copy
                </button>
                <button class="panel-action-btn" onclick={() => saveGeneratedNote(sparkText, 'Idea spark', ['idea', 'graph-generated'])}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>Save as note
                </button>
              </div>
            {/if}
          </div>
        {/if}
      </div>
    {/if}
  </div>

  <!-- Legend -->
  <div class="graph-legend">
    <span class="leg-item"><span class="leg-dot" style="background:#3d7fff"></span>Link</span>
    <span class="leg-item"><span class="leg-dot" style="background:#52c77f"></span>Tag</span>
    <span class="leg-item"><span class="leg-dot" style="background:#7c67ee"></span>Content</span>
    <span class="leg-item"><span class="leg-dot" style="background:#f97316;opacity:0.6"></span>Semantic (Enzo)</span>
    <span class="leg-item"><span class="leg-diamond"></span>Journal</span>
    {#if colorMode === 'tag'}
      {@const tagCounts = (() => {
        const map = new Map<string, number>();
        for (const n of simNodes) for (const t of n.tags) map.set(t, (map.get(t) ?? 0) + 1);
        return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
      })()}
      {#each tagCounts as [tag, count]}
        <span class="legend-pill" style="background:{COLOR_MAP[tagToColor(tag)] ?? '#888'}22;border-color:{COLOR_MAP[tagToColor(tag)] ?? '#888'}">
          #{tag} <span class="legend-count">{count}</span>
        </span>
      {/each}
    {/if}
  </div>
</div>

<style>
  .graph-overlay {
    position: fixed; inset: 0; z-index: 400;
    background: var(--bg);
    display: flex; flex-direction: column;
    animation: fade-in 0.15s ease;
  }
  @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }

  .graph-header {
    display: flex; align-items: center; gap: 10px;
    padding: 10px 16px; border-bottom: 1px solid var(--bd);
    background: var(--sf); flex-shrink: 0; flex-wrap: wrap;
  }
  .graph-title { font-size: 0.88rem; font-weight: 700; color: var(--tx); white-space: nowrap; }
  .graph-sub { font-size: 0.72rem; color: var(--mu); white-space: nowrap; }
  .graph-close { margin-left: auto; background: transparent; border: none; color: var(--mu); cursor: pointer; display: flex; padding: 4px; flex-shrink: 0; }
  .graph-close:hover { color: var(--tx); }

  .graph-toolbar { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; flex: 1; }

  .search-wrap { display: flex; align-items: center; gap: 4px; background: var(--ip); border: 1px solid var(--bd); border-radius: 6px; padding: 3px 8px; }
  .search-wrap svg { color: var(--mu); flex-shrink: 0; }
  .graph-search { background: none; border: none; outline: none; font-size: 0.78rem; color: var(--tx); width: 130px; }
  .fly-btn { background: none; border: none; color: var(--ac); cursor: pointer; font-size: 1rem; line-height: 1; padding: 0; }

  .threshold-wrap { display: flex; align-items: center; gap: 4px; }
  .threshold-wrap svg { color: var(--mu); flex-shrink: 0; }
  .threshold-slider { width: 70px; accent-color: var(--ac); cursor: pointer; }
  .threshold-val { font-size: 0.72rem; color: var(--mu); min-width: 24px; }

  .tb-btn { display: flex; align-items: center; gap: 4px; font-size: 0.75rem; padding: 4px 9px; border-radius: 6px; border: 1px solid var(--bd); background: var(--sf); color: var(--tx); cursor: pointer; white-space: nowrap; }
  .tb-btn:hover { background: var(--hv); }
  .tb-btn.active { background: var(--ac)22; border-color: var(--ac); color: var(--ac); }
  .tb-btn:disabled { opacity: 0.5; cursor: default; }
  .enzo-btn { border-color: #f97316; color: #f97316; }
  .enzo-btn:hover { background: #f9731611; }
  .bridge-btn { border-color: #3d7fff; color: #3d7fff; }
  .bridge-btn:hover { background: #3d7fff11; }
  .spark-btn { border-color: #f8d147; color: #c8991a; }
  .spark-btn:hover { background: #f8d14711; }
  .synth-btn { border-color: var(--ac); color: var(--ac); }
  .gap-btn { border-color: #52c77f; color: #52c77f; }
  .narr-btn { border-color: #7c67ee; color: #7c67ee; }
  .narr-btn:hover { background: #7c67ee11; }

  .spin { display: inline-block; animation: spin 0.8s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }

  .graph-error { font-size: 0.76rem; color: #e85d5d; padding: 4px 16px; margin: 0; flex-shrink: 0; }
  .graph-hint { font-size: 0.72rem; color: var(--mu); padding: 5px 16px 0; flex-shrink: 0; margin: 0; }

  .graph-body { flex: 1; display: flex; overflow: hidden; }
  .graph-canvas { flex: 1; overflow: hidden; position: relative; }
  .graph-canvas svg { display: block; width: 100%; height: 100%; }

  /* Edge tooltip */
  .edge-tooltip { position: absolute; pointer-events: none; z-index: 10; background: var(--sf); border: 1px solid var(--bd); border-radius: 8px; padding: 8px 10px; box-shadow: 0 4px 12px rgba(0,0,0,0.2); max-width: 220px; }
  .ett-titles { font-size: 0.74rem; font-weight: 600; color: var(--tx); margin-bottom: 5px; line-height: 1.3; }
  .ett-scores { display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 4px; }
  .ett-score { font-size: 0.68rem; padding: 1px 6px; border-radius: 10px; font-weight: 600; }
  .sc-link { background: #3d7fff22; color: #3d7fff; }
  .sc-tag { background: #52c77f22; color: #52c77f; }
  .sc-content { background: #7c67ee22; color: #7c67ee; }
  .sc-co { background: #f9731622; color: #f97316; }
  .ett-composite { font-size: 0.72rem; color: var(--mu); }

  /* Node tooltip */
  .node-tooltip { position: absolute; pointer-events: none; z-index: 11; background: var(--sf); border: 1px solid var(--bd); border-radius: 8px; padding: 8px 10px; box-shadow: 0 4px 12px rgba(0,0,0,0.2); max-width: 200px; }
  .ntt-header { display: flex; align-items: center; gap: 6px; margin-bottom: 5px; }
  .ntt-type-badge { font-size: 0.65rem; font-weight: 700; text-transform: uppercase; padding: 1px 5px; border-radius: 4px; background: var(--ac)22; color: var(--ac); }
  .ntt-type-badge.badge-journal { background: #f5a62322; color: #c8841a; }
  .ntt-wc { font-size: 0.68rem; color: var(--mu); }
  .ntt-hub { font-size: 0.68rem; color: #f97316; }
  .ntt-snippet { font-size: 0.73rem; color: var(--tx); line-height: 1.5; margin: 0; }

  /* Panel */
  .graph-panel { width: 290px; flex-shrink: 0; border-left: 1px solid var(--bd); background: var(--sf); display: flex; flex-direction: column; }
  .panel-header { display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; border-bottom: 1px solid var(--bd); flex-shrink: 0; }
  .panel-title { font-size: 0.82rem; font-weight: 600; color: var(--tx); }
  .panel-close { background: none; border: none; color: var(--mu); cursor: pointer; font-size: 1.1rem; line-height: 1; padding: 0; }
  .panel-body { flex: 1; overflow-y: auto; padding: 12px 14px; display: flex; flex-direction: column; gap: 10px; }
  .gap-item { display: flex; gap: 8px; font-size: 0.78rem; color: var(--tx); line-height: 1.5; }
  .gap-num { font-weight: 700; color: #52c77f; flex-shrink: 0; }
  .synth-streaming { font-size: 0.76rem; color: #f97316; margin: 0; }
  .synth-text { font-size: 0.8rem; color: var(--tx); line-height: 1.7; margin: 0; white-space: pre-wrap; }
  .narrative-text { font-style: italic; }
  .panel-actions { display: flex; gap: 6px; padding-top: 10px; border-top: 1px solid var(--bd); margin-top: 8px; flex-wrap: wrap; }
  .panel-action-btn { display: flex; align-items: center; gap: 5px; font-size: 0.74rem; padding: 4px 10px; border-radius: 5px; border: 1px solid var(--bd); background: var(--sf); color: var(--tx); cursor: pointer; }
  .panel-action-btn:hover { background: var(--hv); }

  /* Legend */
  .graph-legend { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 14px; padding: 7px 16px; border-top: 1px solid var(--bd); background: var(--sf); flex-shrink: 0; }
  .leg-item { display: flex; align-items: center; gap: 5px; font-size: 0.71rem; color: var(--mu); }
  .leg-dot { width: 10px; height: 3px; border-radius: 2px; flex-shrink: 0; }
  .leg-diamond { width: 8px; height: 8px; background: #f5a623; transform: rotate(45deg); flex-shrink: 0; }
  .legend-pill { font-size: 0.72rem; padding: 2px 8px; border-radius: 10px; border: 1px solid; color: var(--tx); }
  .legend-count { font-size: 0.68rem; color: var(--mu); margin-left: 2px; }

  .graph-node { user-select: none; }
  .graph-node circle, .graph-node polygon { transition: fill-opacity 0.12s; }
  .graph-node text { pointer-events: none; font-family: var(--font); }
</style>
