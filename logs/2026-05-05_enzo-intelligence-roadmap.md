# Enzo Intelligence Roadmap — 2026-05-05

> Conversation dump. Pinned for implementation. Do not delete.
> Source: Claude Code session, scanning groq.ts + CHARACTER.md + WRITER.md in full.

---

## What was scanned

- `app/src/lib/groq.ts` — full system prompt (`ENZO_SYSTEM`), all exported functions
- `enzo/CHARACTER.md` — canonical identity, domain expertise, behavioral rules
- `enzo/WRITER.md` — career writing character spec
- `app/src/components/Enzo.svelte` — 54 slash commands, picker UI, context assembly

---

## Verdict on current state

**Genuinely strong:**
- Domain depth is real — PARPi trapping potency differences, cGAS-STING rationale for PARPi+IO, CAF subtype distinctions (myoCAF/iCAF/apCAF), specific failure reasons for IMagyn050 and KEYNOTE-100, HRD scoring nuance (Myriad MyChoice, LOH/TAI/LST signatures)
- The Writer's org-specific hooks (AZ vs Merck vs EMBO vs Biocon) are a meaningful differentiator
- Source attribution rules + no-fabrication enforcement well-structured
- Unconventional thinking framework (5-step) is the right idea
- Multiple specialized modes (Deep Read, Critique, Devil's Advocate, PI Report, Interview Prep) all properly separated

**The core gap — stated plainly:**
> Enzo knows the field but knows nothing about Amritha's actual project.
> She can speak peer-to-peer about HGSOC biology but has no idea what Amritha's cohort looks like, what clusters she found, what her current hypothesis actually is, or what she concluded from last month's analysis. Every conversation starts as if they've never spoken.

---

## Intelligence Upgrades — Ranked by Impact

---

### MAJOR 1 — Persistent Project Brief ⭐ HIGHEST PRIORITY

**What:** A structured 300-word block written once by Amritha (or built by Enzo from accumulated context), injected into every system prompt call.

**Should contain:**
- Lab name, PI name, department
- Cohort: n= patients, treatment-naive vs post-PARPi, ascites vs solid, collection site
- Current pipeline stage (e.g. "Finishing Visium deconvolution with cell2location, moving to spatial LR analysis")
- 2-3 active hypotheses (current working models)
- 2-3 key findings already established
- Active collaborators
- Target journal / submission timeline

**Where to build it:**
- Settings page → "Project Brief" section (textarea, saved to GitHub as `data/project.enc`)
- Injected into `ENZO_SYSTEM()` as a `## Your project` block, always at the top, before domain expertise
- Enzo should be able to update it via `/update` command — "Update my project brief: [new info]"

**Why this is #1:**
The difference between "very impressive AI" and "wow it knows *me*" is entirely this. Right now Enzo knows the field; this makes her know the project.

---

### MAJOR 2 — Full Research State Context Assembly

**What:** Instead of only the current open note going into `askEnzo()`, assemble a rich ~600-token "research state" block at query time from live store data.

**Should include:**
- Last 7 journal entries (truncated to 100 chars each, with dates + mood)
- All active/testing hypotheses from Pipeline → Hypotheses tab (titles only)
- Titles of all pinned papers (not just the open note)
- This week's open tasks (top 5)
- Most recent pipeline run (title + status + type)

**Implementation:**
In `Enzo.svelte`, build a `buildResearchContext()` function that reads from `store` and assembles this as a markdown block. Pass it as `journalContext` (or a new parameter) to `askEnzo()`.

**Current code gap:**
```ts
// Current call in Enzo.svelte send()
const result = await askEnzo(messages, viewerText || '', onChunk, abortCtrl.signal, jCtx);
//                                     ^^^^^^^^^^^^^^^^ only open file text
//                                                                        ^^^^ only some journal
```

Enzo is talking to a researcher but has a keyhole view of their work.

---

### MAJOR 3 — Conversation Memory Layer

**What:** Persist key facts from past conversations in localStorage. Inject a "what we've established" block into the system prompt (max 15 bullets, ~200 tokens).

**How it works:**
- At end of each Enzo session, a `/save-memory` pass (using the `quick` model) summarises key decisions, findings, and hypotheses generated in that conversation into 2-3 bullet points
- These are accumulated in localStorage under a `qonco_enzo_memory` key (max 15 entries, rolling window)
- Injected into `ENZO_SYSTEM()` as `## What we've established so far`

**Example of what it would contain:**
```
- 2026-04-28: Established that the CD8+ exhaustion signature in her ascites samples is driven by TOX/ENTPD1, not LAG-3 — LAG-3 expression is low in her dataset
- 2026-05-01: Decided to use cell2location for Visium deconvolution (not RCTD) due to reference atlas size
- 2026-05-03: Doublet rate ~22% — decided to rescue biological doublets near CAF-immune interfaces rather than discard all
```

This is the difference between a tool and a companion.

---

### MAJOR 4 — Temporal Context Injection

**What:** Three lines added to every system prompt call telling Enzo what day it is, upcoming deadlines, and current focus.

**Implementation:**
```ts
const temporalContext = buildTemporalContext(); // reads store.settings.alarms, tasks, calendar
// Output: "Today: 2026-05-05. Upcoming: abstract deadline May 15 (ESMO). Current focus: Visium spatial analysis."
```

Inject into `ENZO_SYSTEM()` as the first line after the identity paragraph.

**Why it matters:** Enzo currently gives context-blind responses. Knowing there's a deadline in 10 days changes how she prioritises suggestions.

---

### MAJOR 5 — Pinned Paper Titles Always in Context

**What:** The titles (+DOIs) of all pinned papers should always be in the system prompt. Enzo can then reference "the Hornburg Nature Cancer paper you've pinned" without guessing.

**Current gap:** Pinned papers live in `store.research.pinnedPapers[]` but never reach `ENZO_SYSTEM()`. Enzo knows these papers from training but doesn't know *Amritha has read and pinned them*.

**Implementation:**
```ts
const pinnedTitles = store.research?.pinnedPapers
  ?.slice(0, 12)
  .map(p => `- ${p.title} (${p.journal}, ${p.year})${p.doi ? ` — doi:${p.doi}` : ''}`)
  .join('\n');
// Inject as "## Papers you've pinned" block
```

This enables responses like: "You pinned the Jiménez-Sánchez PNAS 2020 paper — the immune phenotype switching they describe is directly relevant to what you're asking."

---

## Minor Upgrades — High ROI, Lower Effort

---

### MINOR 1 — Fix the Devil's Advocate Function Prompt

**Problem:** The 5-step unconventional thinking framework (conventional → limitation → unconventional → rationale → test strategy) lives in CHARACTER.md but was never written into the actual `devilsAdvocate()` function prompt in groq.ts.

**Current prompt:**
```ts
"Your job is to argue AGAINST the hypothesis with logic, counter-evidence, and methodological critique."
```

**Should be:**
Explicitly instruct the 5-step structure. The CHARACTER.md thinking is in the file — it just never made it into the function.

---

### MINOR 2 — Fix Paper Critique Template: Drop Forced HGSOC Relevance

**Problem:** `critiquePaper()` always asks for a `## HGSOC Relevance` section. CHARACTER.md correctly says "engage with it on its own terms" — but the critique template forces an awkward non-answer for non-ovarian papers.

**Fix:** Change to `## Field Relevance — describe relevance to the paper's own field, and if applicable, Amritha's work. If no connection, say so in one line.`

Same issue exists in `generateReadingNote()` — the `## Relevance` section forces a connection even when the paper is unrelated.

---

### MINOR 3 — Per-Function Temperature Tuning

**Current state:** All calls use `temperature: 0.4, max_tokens: 2048` (hardcoded in `streamGroq()`).

**Should be:**
| Function | Temp | Max tokens | Reason |
|---|---|---|---|
| `askEnzo()` general | 0.4 | 2048 | fine |
| `devilsAdvocate()` | 0.65 | 2048 | needs creative counter-reasoning |
| `deepReadPaper()` | 0.55 | 1500 | Socratic questions benefit from slight creativity |
| `generateSlides()` | 0.45 | 3000 | hits limit on 12+ slides |
| `assistManuscriptSection()` | 0.3 | 3500 | factual prose, needs length |
| `generatePiReport()` | 0.3 | 1500 | factual, structured |
| `parseTranscriptForEvents()` | 0.1 | 800 | JSON extraction, must be deterministic |
| `generateCoverLetter()` | 0.5 | 1800 | needs some voice variation |
| `generateInterviewQuestions()` | 0.55 | 2500 | needs variety |

**Implementation:** Pass optional `temperature` and `maxTokens` params through `streamGroq()` instead of hardcoding.

---

### MINOR 4 — HGSOC-Specific Failure Modes in System Prompt

**What:** Add a section to `ENZO_SYSTEM` that pre-loads common pitfalls Amritha is likely to hit, so Enzo flags them proactively instead of waiting to be asked.

**Draft content for system prompt:**
```
## Common pitfalls to flag proactively

When relevant, surface these without being asked:
- FFPE scRNA-seq: RNA degradation means high MT% thresholds must be relaxed (don't use standard 20% cutoff — titrate per sample)
- Ascites vs solid tumour batch effects: almost always need separate QC thresholds; Harmony overcorrects if mixed in same integration
- Stromal doublets: CAF-immune co-isolation mimics CAF-T cell "crosstalk" clusters; validate with DoubletFinder cross-referenced against interface markers
- cell2location convergence: ELBO plateaus early on small reference atlases — check loss curve, not just spot deconvolution map
- SpatialDE on Visium HD: computationally prohibitive at full resolution; use NNSVG instead
- CellChat low-cell-number artefacts: filter interactions where sender or receiver < 50 cells per cluster
- BRCA reversion mutations in cfDNA: ddPCR droplet rain near the threshold requires replicate confirmation; don't call on single run
```

---

### MINOR 5 — Coding Defaults Made Explicit in System Prompt

**What:** The current prompt is good for biology but leaves coding defaults generic. Add a specific section.

**Draft:**
```
## Coding defaults

When writing R: use Seurat v5 syntax (not v4). Always include set.seed(42). Use SCpubr for publication-quality plots. Cluster resolution 0.3–0.8 for TME data (start at 0.5). Default palette: cols25() from pals package for cell types.

When writing Python: use AnnData/Scanpy conventions. sc.settings.verbosity = 3. Default to leiden clustering. Use squidpy for spatial operations. Figures via matplotlib, not plotly, unless interactive is requested.

When writing bash/SLURM: assume Heidelberg HPC (bsub or sbatch — ask which if unclear). Default memory 64GB for cellranger, 128GB for STARsolo on full cohort.
```

---

### MINOR 6 — `/myproject` Command

**What:** A new Enzo slash command that synthesises everything Enzo currently knows about Amritha's project from all available context and outputs a structured "current understanding" document.

**Output format:**
```
## Enzo's understanding of your project (as of [date])

**Cohort:** [from project brief]
**Current phase:** [from recent journal + tasks]
**Active hypotheses:** [from pipeline + conversation memory]
**Key findings established:** [from memory layer]
**Pinned papers most relevant to current work:** [from pinned list]
**What I don't know but should:** [honest gaps]
```

This would be the "wow" moment — Enzo synthesising everything she knows about you into one place unprompted.

---

### MINOR 7 — Enzo Should Know Her Own Architecture

**What:** Enzo currently can answer `/status` (token usage) but doesn't know she's running on `llama-3.3-70b-versatile` via Groq, or that the research model is `openai/gpt-oss-120b`. If Amritha asks "why did you get that wrong?" Enzo should be able to say "I'm a 70B model — my knowledge cutoff is [date], this might be post-cutoff."

**Implementation:** Inject into system prompt: `You are running as llama-3.3-70b-versatile via Groq API, proxied through a Cloudflare Worker. Your training cutoff is early 2024. For recent papers (2024–2026), flag that your knowledge may be incomplete and recommend verifying on PubMed.`

---

## Implementation Priority Order

```
1. Project Brief (Settings UI + injection into ENZO_SYSTEM)      — 1 session
2. Full Research State Context Assembly (buildResearchContext())  — 1 session
3. Per-function temperature/token tuning in streamGroq()         — 2 hours
4. Fix devilsAdvocate() prompt to use the 5-step framework       — 30 min
5. Fix critique + reading note HGSOC-relevance issue             — 30 min
6. HGSOC failure modes block in system prompt                    — 1 hour
7. Coding defaults block in system prompt                        — 30 min
8. Temporal context injection (date + deadlines)                 — 1 hour
9. Pinned papers in system prompt                                — 1 hour
10. Conversation memory layer (localStorage accumulation)        — 2 sessions
11. /myproject command                                           — 1 session
12. Enzo self-knowledge (model + cutoff)                        — 20 min
```

---

## Files that need to change

| File | Change |
|---|---|
| `app/src/lib/groq.ts` | `ENZO_SYSTEM()` — add project brief block, temporal context, pinned papers, failure modes, coding defaults, self-knowledge |
| `app/src/lib/groq.ts` | `streamGroq()` — add optional `temperature` + `maxTokens` params |
| `app/src/lib/groq.ts` | `devilsAdvocate()` — rewrite prompt with 5-step structure |
| `app/src/lib/groq.ts` | `critiquePaper()` + `generateReadingNote()` — fix forced HGSOC relevance |
| `app/src/components/Enzo.svelte` | `send()` — call `buildResearchContext()` before `askEnzo()` |
| `app/src/components/Enzo.svelte` | Add `buildResearchContext()` function |
| `app/src/components/Enzo.svelte` | Add `/myproject` command to COMMANDS + executeCommand |
| `app/src/components/Settings.svelte` | Add "Project Brief" textarea section, persisted |
| `app/src/lib/store.svelte.ts` | Add `projectBrief: string` to settings |
| `app/src/lib/github.ts` | Add `PATHS.projectBrief` if storing separately |
| `enzo/CHARACTER.md` | Update to reflect new project brief + memory layer existence |

---

*Session: 2026-05-05 | Claude Code*
*Pin this. Work on it tomorrow.*
