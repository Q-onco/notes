# Session plan — 2026-05-13 (Launchpad v2: Funding tab + In-app media)

## Scope
1. New **Funding** tab — government grants, VC/angel directory, funding news, Enzo Funding Advisor (all in-app, nothing opens externally)
2. In-app media — podcast player (RSS+HTML5 audio), YouTube embed panel, mini player bar
3. Resource cards get Listen/Watch/Read in-app buttons

---

## groq.ts
- [x] `streamFundingAdvisor(query, onChunk, signal)` — 70B, Heidelberg/HGSOC context, fundraising+grants strategy

## Launchpad.svelte

### Types
- [x] `Resource` gets `feed?: string`, `ytPlaylistId?: string`
- [x] `Episode { title, url, date, duration, desc }`
- [x] `Grant { id, name, agency, country, type, amount, cycle, focus, eligibility, tags, stage, url, tips }` (15+ entries)
- [x] `VC { id, name, vcType, focus, stage, ticket, geo, thesis, approach, portfolio, url }` (20+ entries)

### Static data
- [x] `feed` URL added to all 14 podcast resources
- [x] `ytPlaylistId` added to video/playlist resources where known
- [x] `feed` URL for 5 newsletter resources
- [x] `GRANTS[]` — 16 entries (NIH SBIR/STTR, BMBF, DFG Emmy Noether, ERC Starting/Consolidator, MSCA, ERA-PerMed, EIT Health, Wellcome, CRUK, InnoSuisse, Helmholtz, ARPA-H, HTGF)
- [x] `VCS[]` — 21 entries (a16z Bio, Sofinnova, Forbion, Andera, Atlas, Third Rock, LifeSci, F-Prime, OrbiMed, 5AM, Versant, Kurma, Novo Seeds, Boehringer VF, High-Tech Gründerfonds, BioMed Partners, Jeito, EIT Health, AngelList Bio)
- [x] 2 new SOPs: GmbH formation (Germany), EU Startup Ecosystem path

### State
- [x] `activeTab` extended to `| 'funding'`
- [x] `fundingSubTab: $state<'grants' | 'vc' | 'news'>`
- [x] `grantSearch`, `grantCountryFilter`, `grantTypeFilter`, `selectedGrant`
- [x] `vcSearch`, `vcGeoFilter`, `vcStageFilter`, `selectedVC`
- [x] `fundingNews`, `fundingNewsLoading`, `fundingNewsError`
- [x] `fundAdvisorOpen`, `fundAdvisorMsgs`, `fundAdvisorInput`, `fundAdvisorStreaming`, `fundAdvisorAbort`, `fundAdvisorContainer`
- [x] `inAppPanel: $state<'podcast' | 'video' | 'article' | null>`
- [x] `panelResource`, `panelArticle`
- [x] `podcastEps`, `podcastLoading`, `podcastError`
- [x] `currentEp`, `audioPlaying`, `audioProgress`, `audioTime`, `audioDuration`, `audioSpeed`, `audioLoading`
- [x] `audioEl: HTMLAudioElement`

### Functions
- [x] `fetchPodcastEps(r)`, `openPodcastPanel(r)`, `openVideoPanel(r)`, `openArticlePanel(item)`, `closePanel()`
- [x] `playEpisode(ep)`, `togglePlay()`, `seekAudio(e)`, `cycleSpeed()`, `onTimeUpdate()`, `onEnded()`
- [x] `fetchFundingNews()`
- [x] `sendFundAdvisor()`, `stopFundAdvisor()`
- [x] `formatTime(s): string`

### Layout restructure
- [x] Wrap scrollable area in `.lp-body` (flex row)
- [x] `.lp-content` (flex:1, scrollable) inside `.lp-body`
- [x] `.lp-panel` (420px right drawer) inside `.lp-body` — shows when `inAppPanel !== null`
- [x] `.lp-player` mini bar (fixed bottom of `.lp`) — shows when `currentEp !== null`

### UI: Resources tab
- [x] Podcast cards: "Listen →" button → `openPodcastPanel`
- [x] Video/Playlist cards: "Watch →" button → `openVideoPanel`
- [x] Newsletter cards: "Read →" button → `openArticlePanel`
- [x] "Open →" → "Open ↗" (external label consistent)

### UI: In-app panel
- [x] Header: resource title + type badge + close button
- [x] Podcast view: episode list (title, date, duration) + "▶ Play" per episode + loading/error states
- [x] Video view: YouTube `<iframe>` (videoseries for playlists, no-embed fallback for channels)
- [x] Article view: source badge + date + title + full body text + "Save to Notes"

### UI: Mini player bar
- [x] Podcast name + episode title (truncated)
- [x] Hidden `<audio>` element + event bindings
- [x] Seekable progress bar
- [x] Time display (current / total)
- [x] Play/pause button, speed cycle button (1x → 1.25x → 1.5x → 2x), close (×)

### UI: Funding tab
- [x] Sub-tabs: Grants | VCs & Angels | Funding News
- [x] Enzo Funding Advisor collapsible panel at top (same as GPS)
- [x] Grants: country + type filters + search → grant cards → detail view (full in-app)
- [x] VC: geo + stage filters + search → VC cards → expandable approach detail
- [x] Funding News: separate RSS (Rock Health, FierceBiotech Funding, Endpoints Deals) + in-app article expand

### Tab bar + header
- [x] 'funding' added between 'sops' and 'news'
- [x] Header stats: add `{GRANTS.length} grants · {VCS.length} investors`

## Help.svelte
- [x] What's New card: "Launchpad: Funding Hub + In-app Media"

## Build
Must pass `npm run build` before commit.
