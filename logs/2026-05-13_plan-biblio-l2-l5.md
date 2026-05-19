# Session plan — 2026-05-13 (Biblio Layers 2–5 + L1 gaps)

## L1 Gaps (fix first, in Biblio.svelte)
- [ ] Sort controls: year ↑↓, author, title, date added, rating
- [ ] Collection assignment widget in detail panel (multi-select checkboxes)
- [ ] RIS import parser (parseRIS in existing BibTeX/RIS tab)
- [ ] OpenAlex citation count button per ref (manual fetch, shows cited_by_count)

## Layer 2: Integrations
### Research.svelte
- [ ] "📚 Save to Biblio" button on each PaperResult card (converts PaperResult → BiblioReference)
- [ ] Duplicate guard (same doi/title already in library → show "Already saved" chip)

### Manuscript.svelte
- [ ] Replace existing cite-modal list (currently reads from readingList) with store.biblioRefs
- [ ] Search box inside cite modal to filter by title/author
- [ ] Insert formatted citation using citeStyle (default Vancouver)
- [ ] Auto-append References section: list of all inserted refs at section bottom
- [ ] "Manage cite style" selector in toolbar (Vancouver/APA/Nature/Chicago)

### Pipeline.svelte
- [ ] "🔗 Attach reference" button on each protocol step → opens Biblio picker modal
- [ ] Attached refs shown as small chips on the step card

## Layer 3: PDF Viewer (PDF.js — already in package.json as pdfjs-dist)
### In Biblio.svelte
- [ ] "View PDF" button in detail panel (active when pdfUrl set OR user uploads)
- [ ] PDF drop zone in detail panel — upload PDF → store as dataURL in ref.pdfUrl (or github files if too large)
- [ ] BiblioViewer sub-component (inline in Biblio.svelte as conditional panel):
  - [ ] Render pages using pdfjsLib.getDocument + canvas
  - [ ] Page nav (prev/next, page N of M), zoom (0.5×–2×)
  - [ ] Text layer overlay (selectable text)
  - [ ] Highlight tool: select text → save highlight to ref.notes as JSON annotation
  - [ ] Margin note: click page → add sticky note at position, stored in annotations array
  - [ ] Export annotations as markdown notes
- [ ] New field on BiblioReference: `annotations: BiblioAnnotation[]`
- [ ] New type: `BiblioAnnotation { id, page, rect, text, note, color, createdAt }`

## Layer 4: Citation Network (Cytoscape.js — need to install)
### In Biblio.svelte — new "Network" tab (3rd tab)
- [ ] Install cytoscape via npm
- [ ] CitationNetwork sub-component:
  - [ ] Nodes = refs in My Library (label: citeKey, size = citationCount)
  - [ ] Edges = user-defined "cites" relationships OR auto-fetched from OpenCitations API (free)
  - [ ] OpenCitations: `https://opencitations.net/index/coci/api/v1/references/{doi}` (no key)
  - [ ] Layout selector: cose, circle, grid, breadthfirst
  - [ ] Click node → open detail panel for that ref
  - [ ] Highlight connected nodes on hover
  - [ ] Filter by collection (only show refs in selected collection)
  - [ ] Export graph as PNG
  - [ ] Add/remove edges manually (right-click → "This cites…" picker)
- [ ] "Fetch citations" button per ref in detail panel → populates edges from OpenCitations

## Layer 5: AI Features (ALL behind explicit button, NO auto-trigger)
### In Biblio.svelte detail panel — "✦ Enzo" section
- [ ] **Summarise** button → Groq 70B: title+abstract → structured summary (Population, Intervention, Key findings, Limitations, Relevance)
- [ ] **Key quotes** → extract 3 verbatim key sentences worth citing
- [ ] **Gap finder** → given abstract: what questions remain unanswered?
- [ ] **Auto-tag** → suggest 5 tags based on title+abstract (user can accept/reject each)
- [ ] **PICO extract** → Population, Intervention, Comparison, Outcome structured table
### Multi-ref AI (select 2–5 refs via checkboxes in list)
- [ ] **Compare** → structured comparison table (methods, sample, findings, limitations)
- [ ] **Synthesis** → narrative synthesis paragraph
- [ ] **Gap analysis** → what's missing across these papers together?
### Manuscript integration
- [ ] **Suggest citations** → given highlighted manuscript text, search library by semantic similarity (title/abstract keyword overlap) and suggest top 5 refs

## Files changed
- Biblio.svelte (major extensions)
- Research.svelte (add save-to-biblio button)
- Manuscript.svelte (replace cite modal + cite style selector)
- Pipeline.svelte (attach reference to step)
- types.ts (BiblioAnnotation type)
- package.json (add cytoscape)

## Build gate
Must pass `npm run build` before committing each layer.
