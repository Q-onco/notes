# Session plan — 2026-05-12 (Lecture Mode)

## Scope
Dedicated Lecture Mode inside Audio & Transcription.
Title + venue inputs, silent chunked Whisper transcription, heuristic
speaker classification live, Groq 70B post-hoc re-labeling, structured
saves with turns array.

---

## types.ts
- [ ] `LectureTurn` interface — `{ role: 'lecturer' | 'audience'; text: string; offsetSec: number; }`
- [ ] `AudioRecord` optional fields: `lectureMode?`, `lectureTitle?`, `lectureVenue?`, `turns?: LectureTurn[]`

## groq.ts
- [ ] `classifyLectureTurns(segments, lectureTitle, signal?)` — 70B, returns `LectureTurn[]`
  - POST to /llm with JSON response_format, system prompt aware of lecture context

## Audio.svelte
### State
- [ ] `lectureMode: $state(false)`
- [ ] `lectureTitle: $state('')`, `lectureVenue: $state('')`
- [ ] `liveTurns: $state<LectureTurn[]>([])` — heuristic-classified during recording
- [ ] `identifyingSpk: $state(false)` — spinner for 70B pass

### Heuristic classifier
- [ ] `heuristicRole(text): 'lecturer' | 'audience'`
  - words > 60 → 'lecturer'
  - ends with `?` → 'audience'
  - starts with question word pattern → 'audience'
  - else 'lecturer'

### startRecording
- [ ] reset `liveTurns = []`
- [ ] capture `capturedTitle = lectureTitle; capturedVenue = lectureVenue`

### handleChunkStop
- [ ] when `lectureMode`, push heuristic turn to `liveTurns`

### stopRecording / draftTranscript
- [ ] when `lectureMode`, `draftTranscript` built from `liveTurns` as `[Lecturer] text\n[Audience] text`
- [ ] else existing behaviour unchanged

### UI additions
- [ ] Mode tabs (Standard | Lecture) above recorder card
- [ ] Lecture setup row (title input + venue input) — visible when `lectureMode && !recording`
- [ ] Live transcript in lecture mode: colored turn badges (blue=Lecturer, amber=Audience)
- [ ] Draft section: "Identify Speakers ✦ [70B]" button when `lectureMode`
  - Calls `classifyLectureTurns` → updates `liveTurns` + rebuilds `draftTranscript`
- [ ] `saveRecording` stores `lectureMode, lectureTitle, lectureVenue, turns: liveTurns`
- [ ] `saveTranscriptAsNote` for lecture records: title `[Lecture] <title> — <date>`, body structured with speaker lines
- [ ] Past recording cards: "Lecture" purple badge + title/venue subtitle row when `rec.lectureMode`

## Help.svelte
- [ ] What's New card for Lecture Mode

## Build
Must pass `npm run build` before commit.
