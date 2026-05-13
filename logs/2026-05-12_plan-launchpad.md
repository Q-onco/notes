# Session plan — 2026-05-12 (Launchpad module)

## Scope
Full "Launchpad" startup + self-dev module — same nav weight as Notes/Journal.
Massive curated resource library (64+ items), SOP playbooks, live biotech news RSS,
Enzo Founder GPS, save/bookmark everywhere, custom resource add, search + filters.

---

## types.ts
- [x] `LaunchpadCustomResource` interface

## github.ts
- [x] `PATHS.launchpad = 'data/launchpad.enc'`

## store.svelte.ts
- [x] `launchpadBookmarks: $state<string[]>([])`
- [x] `launchpadCustom: $state<LaunchpadCustomResource[]>([])`
- [x] `launchpadSha`
- [x] `saveLaunchpad()`
- [x] `loadAll()` loads launchpad bundle
- [x] View type extended to include 'launchpad'

## groq.ts
- [x] `streamFounderGPS(situation, onChunk, signal)` — 70B

## Launchpad.svelte (new, ~800 lines)
### Static data
- [x] 14 podcasts (The Long Run, Mendelspod, Petri, Biotech 2050, a16z, etc.)
- [x] 10 video channels (YC, STAT, Stanford GSB, MIT, LabCentral, etc.)
- [x] 5 playlists (YC Startup School 2024, Stanford CS183, SBIR NIH, etc.)
- [x] 12 communities (LabCentral, IndieBio, Nucleate, AUTM, BioSlack, etc.)
- [x] 15 tools (SBIR.gov, Benchling, Google Patents, Crunchbase, Stripe Atlas, etc.)
- [x] 8 newsletters (STAT, Endpoints, FierceBiotech, Rock Health, etc.)
- [x] 7 SOPs with full step-by-step content (Lab→Company 90days, IP/TTO, Entity, SBIR, SAB, Pitch Deck, FDA)

### Features
- [x] Tab bar: Resources | SOPs | News | Saved
- [x] Type filter chips: All · Podcast · Video · Playlist · Community · Tool · Newsletter
- [x] Stage filter: All · Pre-Formation · Early Stage · Growth
- [x] Full text search across title/desc/tags/category
- [x] Save/bookmark toggle on every card (heart icon)
- [x] Resource card: type badge, platform badge, title, desc, tags, save + open buttons
- [x] SOP cards: expand in right-side panel with full numbered steps
- [x] News tab: RSS from 4 feeds via api.rss2json.com, refresh, source colour badges
- [x] Saved tab: all bookmarked resources + SOPs + custom
- [x] Add custom resource form (type, title, url, desc)
- [x] Enzo Founder GPS: text input → 70B streaming guidance in collapsible panel
- [x] Custom resources get bookmarked automatically on add
- [x] `store.saveLaunchpad()` called on every save/custom add

## Sidebar.svelte
- [x] Add 'launchpad' to NAV with rocket icon
- [x] Add 'launchpad' to NEW_VIEWS set

## Shell.svelte
- [x] Import Launchpad
- [x] Add `{:else if store.view === 'launchpad'}<Launchpad />{/if}`

## Help.svelte
- [x] What's New card for Launchpad module

## Build
✓ built in 42.88s — no errors. Pushed to origin/main (commit 02c87e5).
