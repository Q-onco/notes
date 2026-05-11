# Session plan — 2026-05-11 (remaining features)

Verified against committed code before this session. Every box must be ticked
or marked [DEFERRED: reason] before the next `git push`.

---

## Presentations

- [x] Source picker modal — Notes tab
- [x] Source picker modal — Papers tab
- [x] Source picker modal — Files tab (PDF text extraction + CSV)
- [x] Source picker modal — Pipeline tab
- [x] JSON-schema slide output (generateSlidesDeck)
- [x] Generation modes: Standard, Journal Club, Lab Meeting, Grant Narrative
- [x] Slide citation strip (cite-strip footer)
- [x] Improve slide v2 — context-aware with session sources
- [x] Source sidebar (collapsible, shows all picked sources)
- [x] Loadable example presentations — 2 HGSOC-themed decks with real slide content, click-to-load into editor

---

## Reviews

- [x] Bibliography generator (APA / Vancouver / BibTeX + download)
- [x] Suggestions panel (dedicated tab)
- [x] Auto citation search — OpenAlex per claim in parallel, PubMed fallback, no manual button
- [x] Per-theme gap analysis (streaming)
- [x] LaTeX export
- [x] DOCX export

---

## Note Knowledge Graph

- [x] Focus mode (click node → 1-hop neighbours, dim rest)
- [x] Search + fly-to
- [x] Color by tag
- [x] Semantic edges (dashed, manual Enzo Analyse button)
- [x] Cluster labels (float above cluster centroid)
- [x] Multi-select mode
- [x] Synthesis panel (streaming)
- [x] Copy button on synthesis panel result
- [x] "New note from synthesis" button on synthesis panel result
- [x] Guided narrative button — "What story does my graph tell?" (Enzo reads cluster labels + hub titles → 3–4 sentence research narrative)

---

## Research

- [x] Saved searches tab (6th tab, re-run / delete)
- [x] BibTeX batch import modal
- [x] Per-paper inline notes (expand/collapse, autosave, blue-dot indicator)
- [x] HGSOC abstract keyword highlighting
- [x] Radar digest history log

---

## Help.svelte

- [x] What's New cards for all above features
- [x] Update after this session's additions (examples, graph actions, guided narrative)
