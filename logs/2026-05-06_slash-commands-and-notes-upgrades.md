# Session: 2026-05-06 — Slash Commands + 10 Notes Upgrades

> Conversation dump. All features shipped and deployed.

---

## What was built

### Slash command system (26 commands)
**Files:** `RichEditor.svelte` (detection), `SlashMenu.svelte` (813-line menu), `Editor.svelte` (wiring)

**How it works:**
- RichEditor detects `/query` patterns via `onUpdate` → calls `onSlashQuery(query, x, y, from, to)`
- SlashMenu renders at `(x, y)` using `position: fixed`; receives `getEditor` ref to execute commands
- Escape → dismiss; ↑↓ → navigate; Enter → pick; backspace through `/` → auto-close
- Commands that need params swap to a 2-field inline form (step: 'param')

**26 commands:**
- Format: h1, h2, h3, bullet, numbered, tasklist, quote, code, table, divider, callout
- Insert: date, datetime, time, progress (bar), deadline (countdown chip)
- Research: hypothesis block, protocol steps, experiment design, gene chip
- Action: task (→ Tasks store), alarm (→ settings.alarms), remind (→ localStorage), timer (countdown + notification)
- AI: enzo (sub-menu OR free text), ask (inline Q&A)

**Enzo sub-menu (11 options):**
- Inline: Summarise, Critique, Expand, Keywords, Next steps, Draft abstract, Research gaps, Suggest methods
- Routing to store: Extract → Tasks (JSON array), Extract → Hypothesis, Save → Protocol, Add → Pipeline run

### 10 Notes upgrades

1. **Tag filter chips** — `Sidebar.svelte`: `allTags` derived from store.notes, chip row below search, `activeTagFilter` state filters `filteredNotes`
2. **Archive restore** — `Sidebar.svelte`: `archivedNotes` derived, collapsible section at bottom, `restoreNote()` sets `archived = false`
3. **Enzo analyse toolbar** — `Editor.svelte`: 3 buttons (Summarise / Key findings / Devil's advocate), calls `askEnzoInline()`, slide-in `analysis-panel` with pre-wrap result
4. **ToC panel** — `Editor.svelte`: `showToc` toggle, `tocItems` derived from DOMParser on `note.body`, 196px side panel, `scrollToHeading()` uses `editor.view.dom.querySelectorAll`
5. **Duplicate note** — `Editor.svelte`: `duplicateNote()` spreads note + new nanoid + "(copy)" suffix
6. **Reading time** — `Editor.svelte`: `readingTime(html) = Math.ceil(words/200)` in footer
7. **Save as template** — `Editor.svelte`: `store.settings.customTemplates[]` in dropdown, persisted via `store.saveSettings()`
8. **Hover preview** — `Sidebar.svelte`: 350ms delay popover (position: fixed), `previewText()` strips HTML to 180 chars
9. **Backlinks panel** — `Editor.svelte`: derived `backlinkTasks/Audio/Manuscripts`, collapsible footer, navigate on click
10. **Colour labels** — `types.ts` `Note.color?: 'ac'|'gn'|'rd'|'yw'|'pu'|'enzo'`, colour dot picker in toolbar, `border-left-color: var(--color)` in sidebar

### Tasks overhaul (from previous session, now committed)
- Tags field (8 predefined + custom input), subtasks expand/collapse, search bar, tag filter row
- SubTask type added to types.ts; Task.tags and Task.subtasks are optional

### Other (from previous session)
- Shell.svelte: deadline notification engine — checks tasks/grants/peer reviews/jobs on auth, fires once per day
- Settings.svelte: browser notification permission UI with granted/denied/request states
- groq.ts: `askEnzoInline(instruction, noteContent, signal)` — streams through ENZO_SYSTEM with note as context block
- types.ts: `AppSettings.customTemplates`, `Note.color`

---

## Files changed (this session)
| File | What changed |
|---|---|
| `app/src/components/Editor.svelte` | Full rewrite — all 10 upgrades + SlashMenu wiring |
| `app/src/components/Sidebar.svelte` | Full rewrite — tag chips, archive restore, hover preview, colour dots |
| `app/src/components/SlashMenu.svelte` | New — 813-line slash menu component |
| `app/src/components/RichEditor.svelte` | Added detectSlash(), onSlashQuery/Close props, slashRef binding |
| `app/src/lib/groq.ts` | Added askEnzoInline() |
| `app/src/lib/types.ts` | Note.color, AppSettings.customTemplates, SubTask, Task.tags/subtasks |
| `app/src/components/Tasks.svelte` | Tags, subtasks, search, inline edit, notifications |
| `app/src/components/Shell.svelte` | Deadline notification engine |
| `app/src/components/Settings.svelte` | Notification permission UI |

---

*Session: 2026-05-06 | Claude Code | Deployed to Q-onco/notes main*
