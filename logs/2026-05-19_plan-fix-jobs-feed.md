# Session plan — 2026-05-19 (Fix: Jobs live feed returns empty)

## Root cause
All 6 feed URLs in `/jobs-rss` return HTML pages, not RSS XML:
- `nature.com/naturecareers/jobs/search?feed=rss` → HTML (wrong URL)
- `euraxess.ec.europa.eu/.../feed=rss` → 403 Forbidden
- `jobs.ac.uk/?feed=1` → HTML (wrong URL / blocked)
- `academicpositions.eu/jobs.rss` → Cloudflare WAF block

The real Nature Careers RSS URL (found in page source) is:
`https://www.nature.com/naturecareers/jobsrss/?keywords=<q>&countrycode=<XX>`
Returns proper RSS with 20 items. Confirmed working for: GB, DE, CH, NL, IN.

## Fix

### worker/src/index.ts — /jobs-rss route
- [ ] Replace broken FEEDS array with 7 Nature Careers feeds:
  - `jobsrss/?keywords=postdoc+{q}` (global)
  - `jobsrss/?keywords={q}+researcher` (global)
  - `jobsrss/?keywords={q}&countrycode=DE` (Germany)
  - `jobsrss/?keywords={q}&countrycode=GB` (UK)
  - `jobsrss/?keywords={q}&countrycode=CH` (Switzerland)
  - `jobsrss/?keywords={q}&countrycode=NL` (Netherlands)
  - `jobsrss/?keywords={q}&countrycode=IN` (India)
- [ ] Each feed tagged with its region (from countrycode, not text inference)
- [ ] Cap per-feed at 20 items (Nature RSS returns exactly 20)
- [ ] Total cap stays at 40 after dedup

### worker/src/index.ts — parseJobItems
- [ ] Nature Careers title format is "Organisation: Job Title" (split on FIRST `:`)
- [ ] Company = organisation part (before first `:`)
- [ ] Title = job title part (after first `:`)
- [ ] Location: parse last line of description (contains city/country)
- [ ] Pass `region` hint from feed config into parseJobItems so countrycode-tagged
  feeds don't rely solely on text inference

## Build + verify
- [ ] `cd app && npm run build` — clean
- [ ] Commit + push → worker deploys via CI
- [ ] Manually hit worker: `curl "https://enzo.quant-onco.workers.dev/jobs-rss?q=oncology"` → non-empty array
