# Session plan — 2026-05-19 (Jobs feed: free-text topic search)

## Goal
Let Dr. Amritha search any topic (molecular biology, pathology, etc.)
instead of hardcoded oncology queries.

## Changes

### worker/src/index.ts
- [ ] Read `?q=` param in /jobs-rss (default 'oncology')
- [ ] Inject into all 6 feed URLs: `postdoc {q}`, `researcher {q}`, `{q}` etc.

### app/src/lib/jobs.ts
- [ ] `fetchJobFeed(query = 'oncology')` — pass as `?q=` to worker

### app/src/components/Jobs.svelte
- [ ] Add `feedQuery = $state('oncology')`
- [ ] `fetchFeed()` passes `feedQuery` to `fetchJobFeed`
- [ ] Restructure feed-controls: topic input row (fetch) + filter row (local)
- [ ] Enter on topic input triggers fetchFeed
- [ ] CSS: `.feed-query-row`, `.feed-filter-row`
