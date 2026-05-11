# Session log — 2026-05-11 (Presentations pipeline + bug fixes)

All items completed, built, and pushed to GitHub in this session.

---

## Chunked PDF→Slides Generation Pipeline

### Problem
`generateSlidesDeck` was a single Groq 70b call. A 10-page PDF requesting
20 slides = ~19,280 tokens per request, which exceeds the 12k TPM free-tier
ceiling. The error was a Groq 413 — waiting doesn't help; it's a per-request
ceiling, not a cooldown.

### Solution: Dynamic chunked pipeline

**`groq.ts`**

- Added `max_tokens` parameter to `streamGroq` (default 2048, raised to 4096
  for slide generation calls)
- Added sliding 60-second TPM rate limiter: `tpmWindow`, `awaitTpmBudget()`,
  `recordTpm()` — tracks token usage in rolling 60s window, waits for budget
  before each 70b chunk call, auto-retries on 429
- Added `splitIntoChunks(text, n)` — splits at paragraph boundaries, no LLM
  involvement, raw source text preserved intact
- Added `SlideDeckCallbacks` interface: `onProgress`, `onBrief`, `onOutline`,
  `onConcepts`, `onSlideTitles`
- Rewrote `generateSlidesDeck` to route single vs chunked based on estimated
  token count (threshold: 5,500 tokens)
- `_deckSingle`: single 70b call, injects all context layers
- `_deckChunked`: dynamic ratio — `chunk_count = ceil(content_tokens / 2200)`,
  `slides_per_chunk = ceil(requested / chunk_count)`, sequential 70b passes

**Dynamic ratio examples:**
- 50KB PDF, 20 slides → 5 passes of 4 slides (~2–3 min)
- 150KB PDF, 40 slides → ~14 passes (~7–8 min)
- Up to 25 minutes acceptable per user request

**`Presentations.svelte`**
- Slide count chips updated: `[5, 10, 15, 20, 30]`, max input raised to 60
- Progress message wires to `genProgress` state, shown live during generation

---

## 4-Layer Context System (no quality loss)

### Problem: broken narrative flow across chunks
A 10-page PDF split into 5 chunks → each 70b call sees only its section.
Content from page 5 explaining a mechanism introduced on page 1 is invisible
to the chunk processing page 1. Resulting deck has broken narrative flow.

### Layer design

All 4 context layers use 8b (200k TPM free) — no impact on 70b TPM budget.
Layers 1, 3, 4 run in parallel via `Promise.all` before any 70b pass starts.

| Layer | Model | What it produces | Injected into |
|---|---|---|---|
| 1 — Document Analysis | 8b | 150–200w brief: question → method → finding → implication | Every 70b chunk |
| 2 — Slide carry-over | runtime | Titles of already-generated slides | Next 70b chunk only |
| 3 — Deck Outline | 8b | Section-by-section roadmap with slide groups | Every 70b chunk |
| 4 — Key Concepts | 8b | 10–15 term glossary for consistent terminology | Every 70b chunk |

**Result:** Chunk processing page 2 knows the paper's main finding (L1), the
full deck plan (L3), what "HRD" means across all slides (L4), and which slide
topics were already covered (L2).

### Sidebar — all layers stream live

- Sidebar auto-opens when brief starts streaming
- 4 colour-coded panels: blue (brief), green (outline), amber (concepts),
  neutral (slide list)
- Each streams with blinking cursor while generating
- All persist after generation for reading alongside the finished deck
- Divider line separates AI layers from source entries
- Sources button shows `· Analysis` when brief is present

---

## Bug Fixes

### `file-detail-name` box illegible dimensions (Files.svelte)

**Root cause:** `.file-detail-head` was `display: flex` row — action buttons
(Enzo + Note + Share) were `flex-shrink: 0`, leaving the file name area
squished to ~15px of horizontal space inside a 360px panel.

**Fix:** Changed `.file-detail-head` to `flex-direction: column`. File name
now spans full 360px panel width at `0.92rem`. Action buttons sit in a
wrapping row below the name. Also fixed `<p>` default margins on
`.file-detail-name` (`margin: 0; flex: 1; min-width: 0; line-height: 1.35`).

### Slide content not editable (Presentations.svelte)

**Root cause:** `draggable="true"` on the slide card outer div. Browsers
intercept `mousedown` on draggable elements for drag detection. Tiptap uses
`mousedown` to position the text cursor. Every click into the editor was
captured by the drag system before Tiptap could see it.

**Fix 1:** `ondragstart` on the card now checks if the event originated from
`.slide-drag-handle`. If not, `e.preventDefault()` — no drag starts.
Drag-to-reorder still works from the handle only.

**Fix 2:** `slide-content-wrap` gets:
- `onclick={(e) => e.stopPropagation()}` — prevents card-level
  `activeSlideIdx` setter from firing mid-edit
- `ondragstart={(e) => e.preventDefault()}` — belt-and-suspenders against
  the drag system

---

## Files changed this session

| File | Changes |
|---|---|
| `app/src/lib/groq.ts` | Chunked pipeline, 4 context layer functions, SlideDeckCallbacks interface, rate limiter |
| `app/src/components/Presentations.svelte` | Sidebar panels, state wiring, slide count chips, drag fix, editor isolation |
| `app/src/components/Files.svelte` | file-detail-head column layout, file-detail-name margin/flex fix |

## Commits

- `c2b6e0c` — feat: chunked PDF→slides pipeline with dynamic TPM rate limiting
- `6efe924` — feat: two-layer context for chunked slide generation + document analysis sidebar
- `97ae8b1` — feat: 4-layer slide context pipeline + sidebar panels + file-name-row fix
- `623d0e2` / `1b324f8` — fix: file-detail-head layout — name now gets full panel width
- `069f4ab` — fix: slide content now editable — isolate editor from card drag system
