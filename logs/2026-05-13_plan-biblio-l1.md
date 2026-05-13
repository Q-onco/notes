# Session plan — 2026-05-13 (Biblio Layer 1: Core Reference Manager)

## Scope
Full reference manager — standalone "My Library" + separate "Curated Library" sub-tab.
No PDF viewer yet (Layer 3). No integrations yet (Layer 2). Core only.

---

## APIs used (all free, no keys except Unpaywall email param)
- CrossRef: `https://api.crossref.org/works/{doi}`
- PubMed esummary: `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id={pmid}&retmode=json`
- arXiv: `https://export.arxiv.org/api/query?id_list={id}`
- Unpaywall: `https://api.unpaywall.org/v2/{doi}?email=quant.onco@gmail.com`
- OpenAlex (citation count): `https://api.openalex.org/works/doi:{doi}?select=cited_by_count`

## types.ts
- [x] `BiblioReference` interface
- [x] `BiblioCollection` interface

## github.ts
- [x] `PATHS.biblio = 'data/biblio.enc'`

## store.svelte.ts
- [x] `biblioRefs: $state<BiblioReference[]>([])`
- [x] `biblioCollections: $state<BiblioCollection[]>([])`
- [x] `biblioSha: $state<string | null>(null)`
- [x] `saveBiblio()`
- [x] `loadAll()` loads biblio bundle

## Biblio.svelte (new, ~1600 lines)

### Static curated data
- [x] ~80 landmark papers across: Cancer Immunology, scRNA-seq Methods, CRISPR/Functional Genomics,
      Bioinformatics & Computational, Clinical Trial Design, Precision Oncology,
      Tumor Microenvironment, Drug Resistance, Translational & Regulatory, Epigenomics & Multi-omics

### Types
- [x] `CiteStyle = 'vancouver' | 'apa' | 'nature' | 'chicago'`
- [x] `ImportMode = 'doi' | 'pmid' | 'arxiv' | 'bibtex' | 'manual'`

### State
- [x] `activeTab: 'library' | 'curated'`
- [x] `showImport`, `importMode`, `importQuery`, `importLoading`, `importError`, `importPreview`
- [x] `selectedRef`, `editingRef`, `showDetail`
- [x] `search`, `typeFilter`, `statusFilter`, `collectionFilter`, `tagFilter`
- [x] `citeStyle: CiteStyle`
- [x] `curatedCategory`, `curatedSearch`
- [x] `showCollectionForm`, `newCollName`, `newCollColor`, `newCollParent`
- [x] `toast`

### Import functions
- [x] `fetchByDOI(doi)` → CrossRef + Unpaywall OA link
- [x] `fetchByPMID(pmid)` → PubMed esummary
- [x] `fetchByArxiv(id)` → arXiv Atom XML parse
- [x] `parseBibTeX(raw)` → array of BiblioReference
- [x] `importPreviewItem()` / `confirmImport()`
- [x] `addManualRef()` — manual form
- [x] `detectDuplicates(ref)` → existing ref or null (DOI match or title+year fuzzy)

### Citation formatting
- [x] `formatVancouver(ref)` → `Authors. Title. Journal. YYYY;Vol(Issue):Pages. doi:...`
- [x] `formatAPA(ref)` → `Authors (YYYY). Title. Journal, Vol(Issue), Pages. https://doi.org/...`
- [x] `formatNature(ref)` → `Authors. Title. Journal Vol, Pages (YYYY).`
- [x] `formatChicago(ref)` → `Author, First. "Title." Journal Vol, no. Issue (YYYY): Pages.`
- [x] `formatCite(ref, style)` dispatcher
- [x] `generateCiteKey(ref)` → `LastName YYYY` + dedup suffix
- [x] `exportBibTeX(refs[])` → .bib string download
- [x] `exportRIS(refs[])` → .ris string download

### Derived
- [x] `filteredRefs` — search + filters applied
- [x] `allTags` — unique tags across library
- [x] `filteredCurated` — category + search applied

### Layout
- [x] Tab bar: My Library | Curated Library
- [x] **My Library**: left collections sidebar (collapsible) + main list + right detail panel
- [x] **Curated**: category filter chips + paper grid with "Add to My Library" button
- [x] Import modal (tab bar: DOI | PMID | arXiv | BibTeX/RIS | Manual)
- [x] Reference detail panel: all fields, inline edit, cite format picker + copy, export buttons

### UI: My Library
- [x] Stats bar: N refs · N collections · N tags
- [x] Collections sidebar: All / nested collections / Tags section
- [x] Search bar + type/status/tag/year filters
- [x] Reference cards: title, authors truncated, year, journal, DOI chip, tags, status dot
- [x] Empty state with "+ Import your first reference" CTA

### UI: Curated Library
- [x] Category filter chips
- [x] Search within curated
- [x] Paper cards: title, authors, year, journal, abstract preview, category badge, [+ Add to Library] button
- [x] Already-added indicator (check mark, greyed)

### UI: Reference Detail Panel
- [x] Full metadata display with inline edit
- [x] Cite format selector (Vancouver / APA / Nature / Chicago)
- [x] Formatted citation display with one-click copy
- [x] BibTeX cite key display (editable)
- [x] Export single ref as BibTeX / RIS
- [x] Tags, status, rating (1-5 stars), read status
- [x] Notes textarea
- [x] DOI → external link + OA PDF link (Unpaywall)
- [x] Delete button

## Sidebar.svelte
- [x] Add 'biblio' to NAV with book icon

## Shell.svelte
- [x] Import Biblio
- [x] Add `{:else if store.view === 'biblio'}<Biblio />{/if}`

## Help.svelte
- [x] What's New card for Biblio Layer 1

## Build
- [x] `npm run build` passes ✓
