# Session plan — 2026-05-13 (Biblio Layer 5 — AI Features)

## Scope
Wire up the 8 Groq AI functions already in groq.ts into the Biblio UI.
All AI calls are MANUAL trigger only — no auto-run in effects or on mount.

## Per-ref AI panel (in detail panel)
- [ ] "AI Analysis" collapsible section in detail panel (below notes)
- [ ] Buttons: Summarise | Key Quotes | Research Gaps | PICO | Auto-tag
- [ ] Each has streaming output area + stop button
- [ ] Auto-tag: appends tags to ref.tags on completion (still manual trigger)
- [ ] State: `aiMode`, `aiStreaming`, `aiOutput`, `aiAbort`

## Multi-ref AI panel (when 2–5 refs selected in batch mode)
- [ ] In bulk bar: "AI: Compare" button (2–5 selected)
- [ ] Opens modal with Compare | Synthesis | Multi-Gap tabs
- [ ] Streaming output + copy to clipboard + save to Notes

## Imports
- [ ] Import all 8 biblio AI functions from groq.ts

## State
- [ ] `aiMode = $state<'summary'|'quotes'|'gaps'|'pico'|'tag'|null>(null)`
- [ ] `aiOutput = $state('')`
- [ ] `aiStreaming = $state(false)`
- [ ] `aiAbort: AbortController | null`
- [ ] `multiAiOpen = $state(false)`
- [ ] `multiAiMode = $state<'compare'|'synthesis'|'multigap'>('compare')`
- [ ] `multiAiOutput = $state('')`
- [ ] `multiAiStreaming = $state(false)`
- [ ] `multiAiAbort: AbortController | null`

## Functions
- [ ] `runAI(mode)` — calls correct groq function with selectedRef, streams to aiOutput
- [ ] `stopAI()` — abort + reset
- [ ] `applyAutoTags()` — parse aiOutput as JSON array, push unique tags to ref
- [ ] `runMultiAI(mode)` — calls compare/synthesis/multigap on selected refs
- [ ] `stopMultiAI()`
- [ ] `saveAIToNotes()` — save aiOutput as note with ref title

## UI: detail panel AI section
- [ ] Collapsible `<details class="ai-section">` below collections
- [ ] Button row: Summarise | Key Quotes | Gaps | PICO | Auto-tag
- [ ] Output div with streaming text (markdown-lite: newlines → <br>)
- [ ] Spinner while streaming, stop button, copy button

## UI: bulk bar AI button
- [ ] Show when selectMode && selectedIds.size >= 2 && selectedIds.size <= 5
- [ ] "✨ AI Multi" button → opens multiAiModal

## UI: Multi-AI modal
- [ ] Tab: Compare | Synthesis | Gaps
- [ ] Selected refs list (chips)
- [ ] "Run" button (manual), streaming output, stop, copy, save to Notes

## CSS
- [ ] `.ai-section`, `.ai-btn-row`, `.ai-btn`, `.ai-output`, `.ai-actions`
- [ ] `.multi-ai-modal`, `.multi-ai-tab-row`, `.multi-ai-run-btn`

## Build
Must pass `npm run build` before commit.
