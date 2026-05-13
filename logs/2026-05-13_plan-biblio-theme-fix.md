# Biblio Theme Fix + Dummy Data

**Date:** 2026-05-13  
**Session:** Resume after context compaction

## Problems Found
- [x] 221 hardcoded dark hex colors in Biblio.svelte CSS (`#0f172a`, `#1e293b`, `#334155`, `#6366f1`, etc.) — caused Biblio to render as jarring dark panel in light mode
- [x] No HGSOC dummy data — library showed blank empty state (violates project rule)
- [x] Grid items missing `min-height: 0` — could cause overflow issues

## Changes Made

### CSS Variables (Biblio.svelte `<style>` block)
- [x] Replaced all 200+ hardcoded dark hex colors with CSS tokens:
  - `#0f172a`, `#090e1a` → `var(--bg)`
  - `#1e293b` (surface) → `var(--sf)` / `var(--sf2)` (hover)
  - `#334155`, `#1e293b` (border) → `var(--bd)` / `var(--bd2)`
  - `#64748b` → `var(--mu)` (muted text)
  - `#94a3b8` → `var(--tx2)` (secondary text)
  - `#e2e8f0`, `#cbd5e1` → `var(--tx)` (primary text)
  - `#6366f1`, `#818cf8`, `#4f46e5` → `var(--ac)` (accent)
  - `#1e1b4b`, `#312e81` → `var(--ac-bg)` (accent background)
  - `#7f1d1d` → `var(--rd-bg)`, `#fca5a5` / `#f87171` → `var(--rd)`
  - `#14532d` → `var(--gn-bg)`, `#86efac` → `var(--gn)`
- [x] Kept intentional semantic colors: cyan DOI (`#164e63/#67e8f9`), orange arXiv (`#451a03/#fb923c`), amber stars (`#f59e0b`), annotation highlight (`#fbbf24`), Cytoscape NET_STYLES (canvas can't use CSS vars)
- [x] Added `min-height: 0` to `.lib-layout`, `.lib-sidebar`, `.lib-main`, `.detail-panel`
- [x] `.status-btn.active` color changed from `#0f172a` to `var(--bg)` for cross-theme contrast

### HGSOC Dummy Data
- [x] Added `EXAMPLE_REFS` array (5 HGSOC papers: Moore 2018 olaparib, TCGA 2011, Labidi-Galy 2017 fallopian tube origin, Bowtell 2015 review, Kang 2021 scRNA-seq TME)
- [x] Template: shows example ref cards (opacity 0.55, non-interactive) when library is empty
- [x] Added `.example-ref` and `.example-label` CSS classes

## Verify
- [x] Build passes (`npm run build` — clean, 37.56s)
- [x] No remaining hardcoded dark hex in CSS sections (only intentional exceptions remain)
