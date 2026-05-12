# Session log — 2026-05-12 (search history)

## Feature
**Research: Automatic Search History**

Every search run from the Research panel is now auto-logged. No user action required.

## Files changed
- `app/src/lib/types.ts` — `SearchHistoryEntry` interface (id, query, sources, ts, resultCount)
- `app/src/lib/store.svelte.ts` — `searchHistory` state field; included in `loadAll()` research bundle; included in `saveResearch()` payload
- `app/src/components/Research.svelte`:
  - Import `SearchHistoryEntry`
  - `savedTab` local state (`'bookmarks' | 'history'`)
  - Auto-log in `search()`: after papers are resolved, prepend `SearchHistoryEntry` and fire `saveResearch()` without await
  - `runHistoryEntry()` — sets query + sources, switches to results, calls `search()`
  - `bookmarkHistory()` — promotes entry to `savedSearches` with query as default label; guards against duplicates
  - `deleteHistoryEntry()` — removes single entry
  - `clearSearchHistory()` — wipes all history
  - "Saved" tab now has Bookmarks / History toggle with entry counts
  - History view: query + source tags + result count + timestamp + Re-run / Bookmark / Delete per row; Clear all in header
  - CSS: `.saved-toggle`, `.saved-toggle-btn`, `.tog-count`, `.hist-header`, `.hist-item`, `.hist-item-head`, `.hist-query`, `.hist-item-actions`, `.hist-meta`
- `app/src/components/Help.svelte` — "Research: Automatic Search History" What's New card prepended

## Storage
History is bundled into `data/research.enc` alongside `readingList`, `savedSearches`, and `paperCollections`. No new file.

## No cap
History entries are unlimited — all searches retained.

## Build
`✓ built in 43.57s` — no errors
