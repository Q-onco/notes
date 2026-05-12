# Session plan — 2026-05-12 (Launchpad module)

## Scope
Full "Launchpad" startup + self-dev module — same nav weight as Notes/Journal.
Massive curated resource library (64+ items), SOP playbooks, live biotech news RSS,
Enzo Founder GPS, save/bookmark everywhere, custom resource add, search + filters.

---

## types.ts
- [ ] `LaunchpadCustomResource` interface

## github.ts
- [ ] `PATHS.launchpad = 'data/launchpad.enc'`

## store.svelte.ts
- [ ] `launchpadBookmarks: $state<string[]>([])`
- [ ] `launchpadCustom: $state<LaunchpadCustomResource[]>([])`
- [ ] `launchpadSha`
- [ ] `saveLaunchpad()`
- [ ] `loadAll()` loads launchpad bundle
- [ ] View type extended to include 'launchpad'

## groq.ts
- [ ] `streamFounderGPS(situation, onChunk, signal)` — 70B

## Launchpad.svelte (new, ~800 lines)
### Static data
- [ ] 14 podcasts (The Long Run, Mendelspod, Petri, Biotech 2050, a16z, etc.)
- [ ] 10 video channels (YC, STAT, Stanford GSB, MIT, LabCentral, etc.)
- [ ] 5 playlists (YC Startup School 2024, Stanford CS183, SBIR NIH, etc.)
- [ ] 12 communities (LabCentral, IndieBio, Nucleate, AUTM, BioSlack, etc.)
- [ ] 15 tools (SBIR.gov, Benchling, Google Patents, Crunchbase, Stripe Atlas, etc.)
- [ ] 8 newsletters (STAT, Endpoints, FierceBiotech, Rock Health, etc.)
- [ ] 7 SOPs with full step-by-step content (Lab→Company 90days, IP/TTO, Entity, SBIR, SAB, Pitch Deck, FDA)

### Features
- [ ] Tab bar: Resources | SOPs | News | Saved
- [ ] Type filter chips: All · Podcast · Video · Playlist · Community · Tool · Newsletter
- [ ] Stage filter: All · Pre-Formation · Early Stage · Growth
- [ ] Full text search across title/desc/tags/category
- [ ] Save/bookmark toggle on every card (heart icon)
- [ ] Resource card: type badge, platform badge, title, desc, tags, save + open buttons
- [ ] SOP cards: expand in right-side panel with full numbered steps
- [ ] News tab: RSS from 4 feeds via api.rss2json.com, refresh, source colour badges
- [ ] Saved tab: all bookmarked resources + SOPs + custom
- [ ] Add custom resource form (type, title, url, desc)
- [ ] Enzo Founder GPS: text input → 70B streaming guidance in collapsible panel
- [ ] Custom resources get bookmarked automatically on add
- [ ] `store.saveLaunchpad()` called on every save/custom add

## Sidebar.svelte
- [ ] Add 'launchpad' to NAV with rocket icon
- [ ] Add 'launchpad' to NEW_VIEWS set

## Shell.svelte
- [ ] Import Launchpad
- [ ] Add `{:else if store.view === 'launchpad'}<Launchpad />{/if}`

## Help.svelte
- [ ] What's New card for Launchpad module

## Build
Must pass `npm run build` before commit.
