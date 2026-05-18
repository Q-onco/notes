# Session plan — 2026-05-19 (Jobs feed: /jobs-rss Worker route)

## Root cause
`/jobs-rss` route never existed in the Worker. Frontend calls it, gets 404, falls
back to "No jobs returned from feeds — examples shown below." Has never worked.

## Feeds chosen (all free, no auth)
| Source | RSS URL pattern |
|---|---|
| Nature Careers (x2 queries) | `nature.com/naturecareers/jobs/search?q=…&feed=rss` |
| EurAxess | `euraxess.ec.europa.eu/jobs/search?q=oncology&feed=rss` |
| jobs.ac.uk (x2 queries) | `jobs.ac.uk/search/?keywords=…&feed=1` |
| Academic Positions EU | `academicpositions.eu/jobs.rss?q=oncology` |

All fetched in parallel; each failure is silent (try/catch per feed).

## Changes

### worker/src/index.ts
- [ ] Add `interface JobResult` (local, mirrors frontend JobListing shape)
- [ ] Add `/jobs-rss` GET route: parallel fetch all feeds → parseJobItems → dedup by URL → sort newest-first → slice 40
- [ ] Add `parseJobItems(xml, source): JobResult[]` — RSS `<item>` parser:
  - title/company split on `|` or `–` separator
  - region inferred from location keywords (eu/uk/india/remote/us/other)
  - type inferred from title keywords (academic/industry/fellowship/contract)
  - tags extracted (scRNA-seq, spatial, PARP, ovarian, immuno-oncology, etc.)
  - postedAt from `<pubDate>`

## Build + deploy
- [ ] `cd worker && npm run build` (or deploy check)
- [ ] `cd app && npm run build`
- [ ] Commit + push → Worker deploys via GitHub Actions
