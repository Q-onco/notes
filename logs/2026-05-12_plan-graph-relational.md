# Session plan — 2026-05-12 (graph relational strength)

## Scope
Extend Note Knowledge Graph with relational strength computation, journal node inclusion,
visual edge weights, and three Enzo-powered generation features.

---

## groq.ts — 2 new functions
- [x] `streamBridgeNote(nodeA, nodeB, strength, onChunk, signal)` — 70b — bridge research note between 2 selected nodes
- [x] `streamIdeaSpark(candidates, onChunk, signal)` — 70b — idea note from algorithmically detected weak-link pairs

---

## NoteGraph.svelte

### Types / state
- [x] `SimNode` gets `nodeType: 'note' | 'journal'`
- [x] `EdgeStrength { link, tag, content, coCite, composite }` interface
- [x] `strengthEdges: $state` array — pre-filtered pairs (composite > 0.05)
- [x] `avgStrengthMap` — per-node avg for heatmap
- [x] `strengthThreshold: $state(0)` — slider value
- [x] `colorMode` extended to `'note' | 'tag' | 'heatmap'`
- [x] `edgeTooltip` state — positioned breakdown card
- [x] `nodeTooltip` state — positioned note preview card
- [x] `bridgeText/bridgeStreaming/bridgeAbort`
- [x] `sparkText/sparkStreaming/sparkAbort`
- [x] `showPanel` extended to `'gaps'|'synth'|'narrative'|'bridge'|'spark'`

### Strength computation (pure JS — no LLM)
- [x] TF-IDF vectorisation of all note + journal bodies
- [x] Pairwise cosine similarity
- [x] Link score (bidirectional link count, capped at 3)
- [x] Tag score (Jaccard similarity of tag sets)
- [x] Co-citation score (shared inbound linkers)
- [x] Composite: link×0.35 + tag×0.20 + content×0.35 + coCite×0.10
- [x] avgStrengthMap per node for heatmap colouring

### Journal nodes
- [x] Journal entries added as nodes in buildGraph()
- [x] Title: `contextTag · DD Mon` or `Journal · DD Mon`
- [x] Diamond shape (polygon) in SVG — distinct from circular note nodes
- [x] Default amber colour `#f5a623` in note-color mode
- [x] Tags = [contextTag, mood] for Jaccard
- [x] Double-click opens: `store.selectedJournalId = id; store.view = 'journal'; onClose()`

### Visual
- [x] Strength edges rendered with `strokeWidth = 0.8 + composite×4`
- [x] Edge opacity: `0.15 + composite×0.7`
- [x] Edge colour by dominant signal: blue (link) · green (tag) · purple (content)
- [x] Transparent wide hit area per edge for hover detection
- [x] Edge hover tooltip: percentage breakdown of all 4 signals + "Bridge ⚡" button
- [x] Strength threshold range slider in toolbar — hides edges below value
- [x] Heatmap mode: node colour = blue (cold/isolated) → orange (hot/hub)
- [x] Node hover card: type badge + snippet + word count + date
- [x] Journal nodes use diamond polygon
- [x] Structural edges (existing note links) kept as before; strength edges layered under

### Simulation
- [x] tick() adds attraction force for pairs with composite ≥ 0.4

### Toolbar additions
- [x] Strength threshold slider
- [x] Heatmap toggle button
- [x] Bridge ⚡ button (visible when selectMode + exactly 2 nodes selected)
- [x] Blend ✦ button (visible when selectMode + 3+ nodes selected) — synthesis with strength context
- [x] Spark ✧ button (always visible) — algorithmic weak-link → idea note

### Panels
- [x] 'bridge': streaming bridge note + Save as Note button
- [x] 'spark': streaming idea note + Save as Note button

### Help.svelte
- [x] What's New card: Graph Relational Strength + Journal Nodes

---

## Models
- 70b (`MODELS.enzo`): Bridge, Spark (generation quality matters)
- 8b: not needed — JS TF-IDF handles all analysis

## Build
Must pass with `npm run build` before push.
