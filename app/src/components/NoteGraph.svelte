<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { store } from '../lib/store.svelte';
  import { analyzeNoteGraph, synthesizeNotes, graphNarrative } from '../lib/groq';
  import { nanoid } from 'nanoid';

  let { onClose }: { onClose: () => void } = $props();

  interface SimNode {
    id: string; title: string; color: string | undefined; tags: string[];
    x: number; y: number; vx: number; vy: number;
    r: number; pinned: boolean;
  }
  interface SimEdge { source: string; target: string; semantic?: boolean; }

  const COLOR_MAP: Record<string, string> = {
    ac: '#3d7fff', gn: '#52c77f', rd: '#e85d5d',
    yw: '#f5a623', pu: '#7c67ee', enzo: '#f97316',
  };
  const TAG_PALETTE = ['ac', 'gn', 'rd', 'yw', 'pu', 'enzo'];
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

  // New: focus, search, select
  let focusId = $state<string | null>(null);
  let searchQ = $state('');
  let colorMode = $state<'note' | 'tag'>('note');
  let selectMode = $state(false);
  let selectedNodes = $state(new Set<string>());

  // Enzo analysis state
  let semanticEdges = $state<{ a: string; b: string }[]>([]);
  let clusterData = $state<{ label: string; ids: string[] }[]>([]);
  let gapObservations = $state<string[]>([]);
  let analyzing = $state(false);
  let analyzeError = $state('');

  // Result panels
  let showPanel = $state<'gaps' | 'synth' | 'narrative' | null>(null);
  let synthText = $state('');
  let synthStreaming = $state(false);
  let synthAbort: AbortController | null = null;

  // Guided narrative
  let narrativeText = $state('');
  let narrativeStreaming = $state(false);
  let narrativeAbort: AbortController | null = null;

  let simNodes: SimNode[] = [];
  let simEdges: SimEdge[] = [];
  const nodeMap = new Map<string, SimNode>();
  let rafId = 0;
  let settled = false;
  let tickCount = 0;

  // Derived: focus set (node + 1-hop neighbors)
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
    return s;
  })());

  // Derived: search matches
  const searchMatches = $derived(
    searchQ.trim()
      ? new Set(simNodes.filter(n => n.title.toLowerCase().includes(searchQ.toLowerCase().trim())).map(n => n.id))
      : null
  );

  // Derived: cluster centroid labels (snapshot triggers on renderTick)
  const clusterLabels = $derived(renderTick >= 0 ? clusterData.map(c => {
    const members = c.ids.map(id => nodeMap.get(id)).filter(Boolean) as SimNode[];
    if (!members.length) return null;
    return {
      label: c.label,
      cx: members.reduce((s, n) => s + n.x, 0) / members.length,
      cy: Math.min(...members.map(n => n.y)) - 18,
    };
  }).filter(Boolean) : []);

  // Snapshot arrays for template
  const nodes = $derived(renderTick >= 0 ? [...simNodes] : []);
  const edges = $derived(renderTick >= 0 ? [...simEdges] : []);

  function nodeColor(n: SimNode): string {
    if (colorMode === 'tag') {
      const tag = n.tags[0];
      if (tag) return COLOR_MAP[tagToColor(tag)] ?? COLOR_MAP.ac;
      return '#888';
    }
    return n.color ? (COLOR_MAP[n.color] ?? COLOR_MAP.ac) : COLOR_MAP.ac;
  }

  function nodeOpacity(n: SimNode): number {
    if (searchMatches) return searchMatches.has(n.id) ? 1 : 0.15;
    if (focusSet) return focusSet.has(n.id) ? 1 : 0.15;
    if (selectMode && selectedNodes.size > 0) return selectedNodes.has(n.id) ? 1 : 0.45;
    return hoverId === n.id ? 0.95 : 0.7;
  }

  function buildGraph() {
    const notes = store.notes.filter(n => !n.archived);
    const cx = W / 2, cy = H / 2;
    simNodes = notes.map(n => {
      const wc = Math.min(200, Math.max(10, n.body.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length));
      const r = 6 + Math.sqrt(wc) * 0.6;
      const angle = Math.random() * Math.PI * 2;
      const dist = 60 + Math.random() * Math.min(W, H) * 0.3;
      const tags = Array.isArray((n as any).tags) ? (n as any).tags : [];
      return { id: n.id, title: n.title || 'Untitled', color: n.color, tags, x: cx + Math.cos(angle) * dist, y: cy + Math.sin(angle) * dist, vx: 0, vy: 0, r, pinned: false };
    });
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
  }

  function tick() {
    if (settled) { rafId = requestAnimationFrame(tick); return; }
    tickCount++;
    const alpha = Math.max(0.01, 1 - tickCount / 300);
    const allEdges = [...simEdges, ...semanticEdges.map(e => ({ source: e.a, target: e.b, semantic: true }))];

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
    synthAbort?.abort();
    narrativeAbort?.abort();
  });

  function openNote(id: string) {
    store.currentNoteId = id;
    onClose();
  }

  function handleNodeClick(id: string) {
    if (selectMode) {
      const next = new Set(selectedNodes);
      if (next.has(id)) next.delete(id); else next.add(id);
      selectedNodes = next;
    } else {
      if (focusId === id) { focusId = null; }
      else { focusId = id; }
    }
  }

  function handleNodeDblClick(id: string) {
    if (!selectMode) openNote(id);
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
    settled = false; tickCount = 0;
    renderTick++;
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
    // nudge node toward center so it's visible
    n.x = W / 2; n.y = H / 2;
    n.vx = 0; n.vy = 0;
    settled = false; tickCount = 0; renderTick++;
  }

  function handleSearchKey(e: KeyboardEvent) {
    if (e.key === 'Enter' && searchMatches && searchMatches.size === 1) {
      flyTo([...searchMatches][0]);
    }
    if (e.key === 'Escape') { searchQ = ''; }
  }

  async function runEnzoAnalysis() {
    if (analyzing) return;
    analyzing = true; analyzeError = '';
    try {
      const notes = store.notes.filter(n => !n.archived).map(n => ({
        id: n.id,
        title: n.title || 'Untitled',
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
    synthText = '';
    synthStreaming = true;
    showPanel = 'synth';
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
    narrativeText = '';
    narrativeStreaming = true;
    showPanel = 'narrative';
    narrativeAbort = new AbortController();
    const isolated = simNodes
      .filter(n => !clusterData.some(c => c.ids.includes(n.id)))
      .map(n => n.title);
    try {
      await graphNarrative(
        clusterData.map(c => ({
          label: c.label,
          titles: c.ids.map(id => nodeMap.get(id)?.title ?? '').filter(Boolean),
        })),
        isolated,
        chunk => { narrativeText += chunk; },
        narrativeAbort.signal
      );
    } catch { /* aborted */ }
    narrativeStreaming = false;
  }

  function copySynthText() {
    navigator.clipboard.writeText(synthText).catch(() => {});
  }

  function createNoteFromSynthesis() {
    if (!synthText) return;
    const n = {
      id: nanoid(),
      title: 'Graph synthesis — ' + new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
      body: synthText.replace(/\n/g, '<br>'),
      color: undefined,
      tags: ['graph-synthesis'],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      archived: false,
    } as any;
    store.notes = [n, ...store.notes];
    store.currentNoteId = n.id;
    onClose();
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="graph-overlay">
  <!-- Header -->
  <div class="graph-header">
    <span class="graph-title">Note Knowledge Graph</span>
    <span class="graph-sub">{simNodes.length} notes · {simEdges.length} links{semanticEdges.length ? ` · ${semanticEdges.length} semantic` : ''}</span>

    <div class="graph-toolbar">
      <!-- Search -->
      <div class="search-wrap">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
        <input
          class="graph-search"
          placeholder="Search notes…"
          bind:value={searchQ}
          onkeydown={handleSearchKey}
        />
        {#if searchMatches && searchMatches.size === 1}
          <button class="fly-btn" onclick={() => flyTo([...searchMatches!][0])} title="Fly to">→</button>
        {/if}
      </div>

      <!-- Color mode -->
      <button
        class="tb-btn"
        class:active={colorMode === 'tag'}
        onclick={() => colorMode = colorMode === 'note' ? 'tag' : 'note'}
        title="Color by tag"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 2v10l6 3"/></svg>
        {colorMode === 'tag' ? 'Tag color' : 'Note color'}
      </button>

      <!-- Select mode -->
      <button
        class="tb-btn"
        class:active={selectMode}
        onclick={() => { selectMode = !selectMode; if (!selectMode) clearSelection(); }}
        title="Multi-select"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
        {selectMode ? `${selectedNodes.size} selected` : 'Select'}
      </button>

      <!-- Enzo analyse -->
      <button class="tb-btn enzo-btn" onclick={runEnzoAnalysis} disabled={analyzing} title="Enzo: analyse graph">
        {#if analyzing}
          <span class="spin">⟳</span> Analysing…
        {:else}
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a10 10 0 1 0 10 10"/><path d="M22 2 12 12"/></svg>
          Enzo Analyse
        {/if}
      </button>

      <!-- Synthesise (active when selecting) -->
      {#if selectMode}
        <button class="tb-btn synth-btn" onclick={runSynthesis} title="Synthesise selected notes">
          {#if synthStreaming}Stop{:else}Synthesise{/if}
        </button>
      {/if}

      {#if gapObservations.length}
        <button class="tb-btn gap-btn" onclick={() => showPanel = showPanel === 'gaps' ? null : 'gaps'} title="Research gaps">
          Gaps ({gapObservations.length})
        </button>
      {/if}

      {#if clusterData.length}
        <button class="tb-btn narr-btn" onclick={runNarrative} disabled={narrativeStreaming} title="What story does my graph tell?">
          {#if narrativeStreaming}
            <span class="spin">⟳</span> Narrative…
          {:else}
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
            Narrative
          {/if}
        </button>
      {/if}

      {#if focusId}
        <button class="tb-btn" onclick={() => focusId = null} title="Clear focus">Clear focus</button>
      {/if}
    </div>

    <button class="graph-close" onclick={onClose} title="Close">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
    </button>
  </div>

  {#if analyzeError}
    <p class="graph-error">{analyzeError}</p>
  {/if}

  <p class="graph-hint">
    {#if selectMode}
      Click nodes to select · Double-click to open note · Synthesise or analyse selected
    {:else}
      Click = focus mode · Double-click = open note · Drag to reposition · Node size = word count
    {/if}
  </p>

  <div class="graph-body">
    <!-- SVG canvas -->
    <div class="graph-canvas">
      <svg
        bind:this={svgEl}
        width={W} height={H}
        onmousedown={onSvgMouseDown}
        onmousemove={onSvgMouseMove}
        onmouseup={onSvgMouseUp}
        onmouseleave={onSvgMouseUp}
      >
        <!-- Structural edges -->
        {#each edges as e (e.source + '→' + e.target)}
          {@const s = nodeMap.get(e.source)}
          {@const t = nodeMap.get(e.target)}
          {#if s && t}
            <line
              x1={s.x} y1={s.y} x2={t.x} y2={t.y}
              stroke="var(--bd)" stroke-width="1.4" stroke-opacity="0.55"
            />
          {/if}
        {/each}

        <!-- Semantic edges (dashed) -->
        {#each semanticEdges as e (e.a + '~' + e.b)}
          {@const s = nodeMap.get(e.a)}
          {@const t = nodeMap.get(e.b)}
          {#if s && t}
            <line
              x1={s.x} y1={s.y} x2={t.x} y2={t.y}
              stroke="#f97316" stroke-width="1" stroke-opacity="0.45"
              stroke-dasharray="5,4"
            />
          {/if}
        {/each}

        <!-- Cluster labels -->
        {#each clusterLabels as cl}
          {#if cl}
            <text
              x={cl.cx} y={cl.cy}
              text-anchor="middle"
              font-size="10"
              fill="var(--mu)"
              font-style="italic"
              paint-order="stroke"
              stroke="var(--bg)"
              stroke-width="3"
              pointer-events="none"
            >{cl.label}</text>
          {/if}
        {/each}

        <!-- Nodes -->
        {#each nodes as n (n.id)}
          <!-- svelte-ignore a11y_click_events_have_key_events -->
          <g
            data-nid={n.id}
            class="graph-node"
            transform="translate({n.x},{n.y})"
            onmouseenter={() => hoverId = n.id}
            onmouseleave={() => hoverId = null}
            onclick={() => { if (!wasDragging) handleNodeClick(n.id); wasDragging = false; }}
            ondblclick={() => handleNodeDblClick(n.id)}
            style="cursor:pointer"
          >
            <circle
              r={n.r}
              fill={nodeColor(n)}
              fill-opacity={nodeOpacity(n)}
              stroke={selectedNodes.has(n.id) ? '#fff' : nodeColor(n)}
              stroke-width={selectedNodes.has(n.id) ? 2.5 : hoverId === n.id ? 2 : 1}
            />
            {#if n.r >= 10 || hoverId === n.id}
              <text
                y={n.r + 13}
                text-anchor="middle"
                font-size={hoverId === n.id ? 12 : 10}
                fill="var(--tx)"
                paint-order="stroke"
                stroke="var(--bg)"
                stroke-width="3"
              >{n.title.length > 22 ? n.title.slice(0, 20) + '…' : n.title}</text>
            {/if}
            <!-- select indicator -->
            {#if selectMode && selectedNodes.has(n.id)}
              <circle r="4" cx={n.r - 2} cy={-(n.r - 2)} fill="#fff" stroke="#3d7fff" stroke-width="1.5"/>
            {/if}
          </g>
        {/each}
      </svg>
    </div>

    <!-- Side panel -->
    {#if showPanel}
      <div class="graph-panel">
        <div class="panel-header">
          <span class="panel-title">
            {showPanel === 'gaps' ? 'Research Gaps' : showPanel === 'narrative' ? 'Research Narrative' : 'Synthesis'}
          </span>
          <button class="panel-close" onclick={() => { showPanel = null; }}>×</button>
        </div>
        {#if showPanel === 'gaps'}
          <div class="panel-body">
            {#each gapObservations as gap, i}
              <div class="gap-item"><span class="gap-num">{i + 1}</span><span>{gap}</span></div>
            {/each}
          </div>
        {:else if showPanel === 'synth'}
          <div class="panel-body">
            {#if synthStreaming}
              <p class="synth-streaming">Enzo is synthesising…</p>
            {/if}
            <p class="synth-text">{synthText || (synthStreaming ? '' : 'No synthesis yet.')}</p>
            {#if synthText && !synthStreaming}
              <div class="panel-actions">
                <button class="panel-action-btn" onclick={copySynthText} title="Copy to clipboard">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
                  Copy
                </button>
                <button class="panel-action-btn" onclick={createNoteFromSynthesis} title="Save as new note">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
                  New note
                </button>
              </div>
            {/if}
          </div>
        {:else if showPanel === 'narrative'}
          <div class="panel-body">
            {#if narrativeStreaming}
              <p class="synth-streaming">Enzo is writing the narrative…</p>
            {/if}
            <p class="synth-text narrative-text">{narrativeText || (narrativeStreaming ? '' : 'Run "Enzo Analyse" first to generate clusters, then click Narrative.')}</p>
            {#if narrativeText && !narrativeStreaming}
              <div class="panel-actions">
                <button class="panel-action-btn" onclick={() => navigator.clipboard.writeText(narrativeText).catch(() => {})} title="Copy to clipboard">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
                  Copy
                </button>
              </div>
            {/if}
          </div>
        {/if}
      </div>
    {/if}
  </div>

  <!-- Tag color legend (shown in tag mode) -->
  {#if colorMode === 'tag'}
    {@const tagCounts = (() => {
      const map = new Map<string, number>();
      for (const n of simNodes) for (const t of n.tags) map.set(t, (map.get(t) ?? 0) + 1);
      return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
    })()}
    {#if tagCounts.length}
      <div class="tag-legend">
        {#each tagCounts as [tag, count]}
          <span class="legend-pill" style="background:{COLOR_MAP[tagToColor(tag)] ?? '#888'}22;border-color:{COLOR_MAP[tagToColor(tag)] ?? '#888'}">
            #{tag} <span class="legend-count">{count}</span>
          </span>
        {/each}
      </div>
    {/if}
  {/if}
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
  .graph-sub { font-size: 0.75rem; color: var(--mu); white-space: nowrap; }
  .graph-close {
    margin-left: auto; background: transparent; border: none;
    color: var(--mu); cursor: pointer; display: flex; padding: 4px;
    flex-shrink: 0;
  }
  .graph-close:hover { color: var(--tx); }

  .graph-toolbar {
    display: flex; align-items: center; gap: 6px; flex-wrap: wrap; flex: 1;
  }

  .search-wrap {
    display: flex; align-items: center; gap: 4px;
    background: var(--ip); border: 1px solid var(--bd); border-radius: 6px;
    padding: 3px 8px;
  }
  .search-wrap svg { color: var(--mu); flex-shrink: 0; }
  .graph-search {
    background: none; border: none; outline: none;
    font-size: 0.78rem; color: var(--tx); width: 140px;
  }
  .fly-btn {
    background: none; border: none; color: var(--ac); cursor: pointer;
    font-size: 1rem; line-height: 1; padding: 0;
  }

  .tb-btn {
    display: flex; align-items: center; gap: 4px;
    font-size: 0.75rem; padding: 4px 9px; border-radius: 6px;
    border: 1px solid var(--bd); background: var(--sf);
    color: var(--tx); cursor: pointer; white-space: nowrap;
  }
  .tb-btn:hover { background: var(--hv); }
  .tb-btn.active { background: var(--ac)22; border-color: var(--ac); color: var(--ac); }
  .tb-btn:disabled { opacity: 0.5; cursor: default; }
  .enzo-btn { border-color: #f97316; color: #f97316; }
  .enzo-btn:hover { background: #f9731611; }
  .synth-btn { border-color: var(--ac); color: var(--ac); }
  .gap-btn { border-color: #52c77f; color: #52c77f; }

  .spin { display: inline-block; animation: spin 0.8s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }

  .graph-error { font-size: 0.76rem; color: #e85d5d; padding: 4px 16px; margin: 0; flex-shrink: 0; }
  .graph-hint { font-size: 0.72rem; color: var(--mu); padding: 5px 16px 0; flex-shrink: 0; margin: 0; }

  .graph-body {
    flex: 1; display: flex; overflow: hidden;
  }
  .graph-canvas { flex: 1; overflow: hidden; }
  .graph-canvas svg { display: block; width: 100%; height: 100%; }

  .graph-panel {
    width: 280px; flex-shrink: 0;
    border-left: 1px solid var(--bd);
    background: var(--sf);
    display: flex; flex-direction: column;
  }
  .panel-header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 10px 14px; border-bottom: 1px solid var(--bd); flex-shrink: 0;
  }
  .panel-title { font-size: 0.82rem; font-weight: 600; color: var(--tx); }
  .panel-close {
    background: none; border: none; color: var(--mu); cursor: pointer;
    font-size: 1.1rem; line-height: 1; padding: 0;
  }
  .panel-body { flex: 1; overflow-y: auto; padding: 12px 14px; display: flex; flex-direction: column; gap: 10px; }

  .gap-item {
    display: flex; gap: 8px; font-size: 0.78rem; color: var(--tx); line-height: 1.5;
  }
  .gap-num { font-weight: 700; color: #52c77f; flex-shrink: 0; }

  .synth-streaming { font-size: 0.76rem; color: #f97316; margin: 0; }
  .synth-text { font-size: 0.8rem; color: var(--tx); line-height: 1.7; margin: 0; white-space: pre-wrap; }
  .narrative-text { font-style: italic; }
  .narr-btn { border-color: #7c67ee; color: #7c67ee; }
  .narr-btn:hover { background: #7c67ee11; }

  .panel-actions { display: flex; gap: 6px; padding-top: 10px; border-top: 1px solid var(--bd); margin-top: 8px; }
  .panel-action-btn {
    display: flex; align-items: center; gap: 5px;
    font-size: 0.74rem; padding: 4px 10px; border-radius: 5px;
    border: 1px solid var(--bd); background: var(--sf);
    color: var(--tx); cursor: pointer;
  }
  .panel-action-btn:hover { background: var(--hv); }

  .tag-legend {
    display: flex; flex-wrap: wrap; gap: 6px;
    padding: 8px 16px; border-top: 1px solid var(--bd);
    background: var(--sf); flex-shrink: 0;
  }
  .legend-pill {
    font-size: 0.72rem; padding: 2px 8px; border-radius: 10px;
    border: 1px solid; color: var(--tx);
  }
  .legend-count { font-size: 0.68rem; color: var(--mu); margin-left: 2px; }

  .graph-node { user-select: none; }
  .graph-node circle { transition: fill-opacity 0.12s; }
  .graph-node text { pointer-events: none; font-family: var(--font); }
</style>
