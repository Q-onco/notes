<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { store } from '../lib/store.svelte';

  let { onClose }: { onClose: () => void } = $props();

  interface SimNode {
    id: string; title: string; color: string | undefined;
    x: number; y: number; vx: number; vy: number;
    r: number; pinned: boolean;
  }
  interface SimEdge { source: string; target: string; }

  let svgEl: SVGSVGElement;
  let W = $state(800);
  let H = $state(600);
  let renderTick = $state(0);
  let hoverId = $state<string | null>(null);
  let draggingId: string | null = null;
  let dragOffset = { x: 0, y: 0 };

  let simNodes: SimNode[] = [];
  let simEdges: SimEdge[] = [];
  const nodeMap = new Map<string, SimNode>();
  let rafId = 0;
  let settled = false;
  let tickCount = 0;

  const COLOR_MAP: Record<string, string> = {
    ac: '#3d7fff', gn: '#52c77f', rd: '#e85d5d',
    yw: '#f5a623', pu: '#7c67ee', enzo: '#f97316',
  };

  function buildGraph() {
    const notes = store.notes.filter(n => !n.archived);
    const cx = W / 2, cy = H / 2;
    simNodes = notes.map(n => {
      const wc = Math.min(200, Math.max(10, n.body.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length));
      const r = 6 + Math.sqrt(wc) * 0.6;
      const angle = Math.random() * Math.PI * 2;
      const dist = 60 + Math.random() * Math.min(W, H) * 0.3;
      return { id: n.id, title: n.title || 'Untitled', color: n.color, x: cx + Math.cos(angle) * dist, y: cy + Math.sin(angle) * dist, vx: 0, vy: 0, r, pinned: false };
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

    for (const e of simEdges) {
      const s = nodeMap.get(e.source), t = nodeMap.get(e.target);
      if (!s || !t) continue;
      const dx = t.x - s.x, dy = t.y - s.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
      const rest = 110;
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
  });

  function openNote(id: string) {
    store.currentNoteId = id;
    onClose();
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

  function onSvgMouseUp(e: MouseEvent) {
    if (!draggingId) return;
    draggingId = null;
  }

  // Derived snapshot for template (updated by renderTick)
  const nodes = $derived(renderTick >= 0 ? [...simNodes] : []);
  const edges = $derived(renderTick >= 0 ? [...simEdges] : []);
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="graph-overlay">
  <div class="graph-header">
    <span class="graph-title">Note Knowledge Graph</span>
    <span class="graph-sub">{simNodes.length} notes · {simEdges.length} links</span>
    <button class="graph-close" onclick={onClose} title="Close">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
    </button>
  </div>
  <p class="graph-hint">Click a node to open the note · Drag to reposition · Node size = word count</p>

  <div class="graph-canvas">
    <svg
      bind:this={svgEl}
      width={W} height={H}
      onmousedown={onSvgMouseDown}
      onmousemove={onSvgMouseMove}
      onmouseup={onSvgMouseUp}
      onmouseleave={onSvgMouseUp}
    >
      <!-- Edges -->
      {#each edges as e (e.source + '→' + e.target)}
        {@const s = nodeMap.get(e.source)}
        {@const t = nodeMap.get(e.target)}
        {#if s && t}
          <line
            x1={s.x} y1={s.y} x2={t.x} y2={t.y}
            stroke="var(--bd)" stroke-width="1.2" stroke-opacity="0.6"
          />
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
          onclick={() => openNote(n.id)}
          style="cursor:pointer"
        >
          <circle
            r={n.r}
            fill={n.color ? (COLOR_MAP[n.color] ?? 'var(--ac)') : 'var(--ac)'}
            fill-opacity={hoverId === n.id ? 0.9 : 0.65}
            stroke={n.color ? (COLOR_MAP[n.color] ?? 'var(--ac)') : 'var(--ac)'}
            stroke-width={hoverId === n.id ? 2 : 1}
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
            >{n.title.length > 20 ? n.title.slice(0, 18) + '…' : n.title}</text>
          {/if}
        </g>
      {/each}
    </svg>
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
    display: flex; align-items: center; gap: 12px;
    padding: 12px 20px; border-bottom: 1px solid var(--bd);
    background: var(--sf); flex-shrink: 0;
  }
  .graph-title { font-size: 0.9rem; font-weight: 700; color: var(--tx); }
  .graph-sub   { font-size: 0.78rem; color: var(--mu); }
  .graph-close {
    margin-left: auto; background: transparent; border: none;
    color: var(--mu); cursor: pointer; display: flex; padding: 4px;
  }
  .graph-close:hover { color: var(--tx); }
  .graph-hint { font-size: 0.72rem; color: var(--mu); padding: 6px 20px 0; flex-shrink: 0; margin: 0; }
  .graph-canvas { flex: 1; overflow: hidden; }
  .graph-canvas svg { display: block; width: 100%; height: 100%; }

  .graph-node { user-select: none; }
  .graph-node circle { transition: fill-opacity 0.1s, stroke-width 0.1s; }
  .graph-node text { pointer-events: none; font-family: var(--font); }
</style>
