# Biblio Feature Enhancements (Post Theme Fix)

**Date:** 2026-05-13  
**Session:** Feature sprints after Biblio L1–L5 + theme fix

## Six Features Planned

1. **Duplicate detection improvements** ✅ (prior session)
2. **Network empty states** ✅ (prior session)
3. **AI annotation context** ✅ (prior session)
4. **Reading queue + page progress** ✅ (prior session)
5. **Notes ↔ Biblio linking** ✅ (this session)
6. **PDF full-text search** (pending)

## Feature 5: Notes ↔ Biblio Linking

### Problem
- No way to see which notes reference a given paper
- Citation panel in Editor only searched PubMed, not local library

### Changes Made

#### Editor.svelte
- [x] Citation panel input placeholder changed to "Search library or PubMed…"
- [x] PubMed button label changed from "Search" to "PubMed"
- [x] "My Library" section added above PubMed results:
  - Shows when `citationQuery.trim().length >= 2`
  - Filters `store.biblioRefs` by title / author / DOI (top 5 matches)
  - Inserts `Author et al. (Year)` as a linked hyperlink on click
  - Uses `editorRef?.getEditor()?.chain().focus().insertContent()` API
- [x] Empty state messages updated to guide users
- [x] CSS: `citation-lib-header`, `citation-lib-item`, `citation-divider` classes added

#### Biblio.svelte
- [x] `citedInNotes` derived state: scans `store.notes[].body` for DOI or citeKey matches
- [x] "Cited in N notes" section shown in detail panel when any notes reference the ref
- [x] Each note shown as a clickable button — navigates to note by setting:
  `store.openTabs`, `store.currentNoteId`, `store.view = 'notes'`
- [x] Shows up to 5 notes, "+N more" label if more
- [x] CSS: `detail-cited-section`, `cited-notes-list`, `cited-note-btn`, `cited-note-more`

### Build
- [x] `npm run build` passes (40.96s, clean)

### Fix: `{@const}` placement
- Initial attempt used `{@const}` inside `<div>` — Svelte 5 forbids this
- Fixed by moving to `$derived.by()` in script block

## Feature 6: PDF Full-Text Search ✅

### Changes (Biblio.svelte)
- [x] State: `pdfSearchQuery`, `pdfSearchHits` (page numbers), `pdfSearchIdx`, `pdfSearching`, `pdfSearchDone`
- [x] `runPDFSearch()`: iterates all pages, calls `page.getTextContent()`, joins item strings, case-insensitive match
- [x] `searchJumpPrev()` / `searchJumpNext()`: cycle through matching page numbers
- [x] Search bar row below PDF controls: input (Enter triggers search) + ⌕ button + "N/M pg" count + prev/next + clear ✕
- [x] `closePDFViewer` resets all search state
- [x] `pdfSearchDone` flag prevents "0 results" showing before search is run; `oninput` resets it when query changes
- [x] CSS: `.pdf-search-row`, `.pdf-search-input`, `.pdf-search-count`, `.pdf-search-none`
- [x] Build passes (39.33s, clean)
