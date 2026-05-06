# Q·onco — Development Rules

These rules apply to every commit, every feature, every fix. No exceptions.

---

## Rule 1: Never be lethargic
Flawless work only. No stubs, no half-implementations, no placeholder logic. Every feature ships complete and tested.

## Rule 2: Session logging
Every work session must be committed as a verbatim dump to `logs/YYYY-MM-DD_HH-MM.md`. Nothing gets lost. The log goes in with the same push as the work.

## Rule 3: Researcher context — be humble
This app is built for a cancer researcher whose work saves lives. Build with that weight. Every UX decision should serve her workflow, not demonstrate engineering cleverness.

## Rule 4: Ask, never assume
Never fill in ambiguous intent with assumptions. If it isn't clear, surface the question and wait. A five-minute clarification prevents hours of rework.

## Rule 5: Cross-device compatibility
The app must work correctly on iPhone, iPad, and MacBook at all times. Every UI change must be verified across all three.

| Device | Viewport | Expected behaviour |
|--------|----------|--------------------|
| iPhone (SE → 15 Pro Max) | 375–430px | Full layout usable. Sidebar defaults closed. No horizontal scroll. Touch targets ≥ 44px. |
| iPad (portrait) | 768–820px | Sidebar visible, narrow. Enzo panel hidden by default. |
| iPad (landscape) / small MacBook | 1024px | Two-panel layout comfortable. Enzo panel optional. |
| MacBook | 1280px+ | Full three-panel layout — sidebar + content + Enzo. |

**Specific rules:**
- No component may overflow its container on any of these viewports
- No fixed-width element wider than 100vw on any breakpoint
- Touch targets: all interactive elements must be ≥ 44px in height on mobile
- After any CSS change touching layout, grid, or flex containers: check all three device sizes
- Scrollable regions must remain scrollable (no `overflow: hidden` trapping content)

## Rule 6: PWA and sync integrity
The PWA installation and encrypted GitHub sync must never break. These are non-negotiable.

**PWA checklist after any change to `public/` or `vite.config.ts`:**
- `public/sw.js` must remain a valid, parseable service worker
- `public/manifest.json` must remain valid — icons must resolve, `start_url` and `scope` must both equal `/notes/`
- The app must still be installable as a PWA in Chrome/Safari after the change

**Sync integrity after any change to `src/lib/`:**
- The `loadEncFile` → `saveEncFile` chain in `github.ts` must not be modified without full integration testing with a real PAT
- The encryption functions in `crypto.ts` (AES-256-GCM, PBKDF2, 600k iterations) must not be altered — changing them makes all existing `.enc` files permanently unreadable for that user
- Every save must result in a GitHub commit. Never cache writes locally without a corresponding commit
- `store.svelte.ts` default settings must always include all fields in `AppSettings` — a missing default silently causes undefined behaviour

**Auth integrity:**
- The PAT is both auth token and encryption key source — never log it, never send it anywhere except GitHub API and the PBKDF2 derivation function
- sessionStorage key `_qt` is the only place the token lives in the browser

## Rule 7: Enzo character
Enzo's full character specification lives in `enzo/CHARACTER.md`. That document is the law.

**The core rule:** Enzo is a know-it-all super dog on Dr. Amritha's research domain. She is not a general assistant. She is not polite to the point of uselessness. Her warmth is loyalty, not servility.

Any change to the system prompt in `app/src/lib/groq.ts` must:
1. Conform to `enzo/CHARACTER.md`
2. Preserve source attribution rules (literature vs notes, never conflated)
3. Preserve the no-fabrication rule (citations, genes, trial names, statistics)
4. Preserve peer-to-peer calibration (she speaks to an expert researcher, not a student)
5. Not add filler openers, emojis, or hedging language

---

*Last updated: 2026-05-03*
