# Session plan — 2026-05-13 (Biblio Layer 4 — Citation Network)

## Scope
New "Network" tab in Biblio. Cytoscape.js (v3.33.3, already installed) graph.
Nodes = refs in My Library. Edges from OpenCitations API (free, no key) OR manually defined.

## Biblio.svelte changes

### Types
- [ ] `NetworkEdge { source: string; target: string; relation: 'cites' | 'cited-by'; }` (local interface)

### Imports
- [ ] `import cytoscape from 'cytoscape'`
- [ ] `import coseBilkent from 'cytoscape-cose-bilkent'` if available, else fallback to cose

### State
- [ ] `activeTab` extended to `| 'network'`
- [ ] `netContainer: HTMLElement` (bind:this, but outside {#if} — render always, hide with CSS)
- [ ] `cy: cytoscape.Core | null` — cytoscape instance
- [ ] `netLayout = $state<'cose'|'circle'|'grid'|'breadthfirst'>('cose')`
- [ ] `netFetching = $state(false)`, `netFetchError = $state('')`
- [ ] `netEdges = $state<NetworkEdge[]>([])` — loaded edges
- [ ] `netSelectedId = $state<string | null>(null)` — clicked node → show detail

### Functions
- [ ] `initCytoscape()` — create cy instance, register tap events
- [ ] `buildGraph()` — derive nodes from store.biblioRefs, edges from netEdges, call cy.json(), run layout
- [ ] `fetchOpenCitationsForRef(ref)` — GET opencitations.net/index/coci/api/v1/references/{doi}, parse citing_doi pairs, push to netEdges, rebuild graph
- [ ] `fetchAllEdges()` — iterate refs with doi, call fetchOpenCitationsForRef in sequence (rate limit)
- [ ] `runLayout(name)` — cy.layout({ name }).run()
- [ ] `exportGraphAsPNG()` — cy.png({ output: 'blob' }), download

### UI: tab bar
- [ ] Add 'network' tab between 'library' and 'curated' (or after curated)

### UI: Network tab
- [ ] Toolbar: layout selector (cose/circle/grid/breadthfirst) + "Fetch citations" button (manual trigger) + Export PNG
- [ ] Cytoscape container div (full height) — bind:this={netContainer}, always in DOM but hidden when tab !== 'network'
- [ ] Selected node info panel (right side, 240px): shows ref title, authors, citation count, "Open in Library" btn
- [ ] Loading/error states while fetching OpenCitations

### CSS
- [ ] `.net-root`, `.net-toolbar`, `.net-cy-wrap`, `.net-info-panel`
- [ ] Cytoscape node/edge style (dark theme: bg #1e293b, border #6366f1, label white)

## Build
Must pass `npm run build` before commit.
