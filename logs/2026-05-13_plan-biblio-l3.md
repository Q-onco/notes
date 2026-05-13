# Session plan — 2026-05-13 (Biblio Layer 3 — PDF Viewer)

## Scope
In-app PDF viewer with annotation support. pdfjs-dist v5.6.205 already installed.

## Biblio.svelte changes

### Imports
- [x] `import * as pdfjsLib from 'pdfjs-dist'` at top of script
- [x] Set `pdfjsLib.GlobalWorkerOptions.workerSrc` to worker.mjs URL

### Types imported
- [x] Add `BiblioAnnotation` to import from types.ts

### State
- [x] `pdfOpen`, `pdfRefId`, `pdfDoc`, `pdfPage`, `pdfTotal`, `pdfScale`, `pdfLoading`, `pdfError`
- [x] `pdfHighlight` — highlight mode toggle
- [x] `pendingAnnotText`, `pendingAnnotPage`, `showAnnotInput`, `newAnnotNote`
- [x] `pdfRef` derived from pdfRefId + store.biblioRefs

### Functions
- [x] `openPDFViewer(ref)` — set pdfRefId, pdfPage=1, load pdfjs document
- [x] `renderCurrentPage()` — get canvas by ID, call page.render()
- [x] `closePDFViewer()` — pdfOpen=false, destroy pdfDoc
- [x] `pdfNextPage()`, `pdfPrevPage()`, `pdfZoomIn()`, `pdfZoomOut()`
- [x] `capturePDFSelection()` — window.getSelection(), set pendingAnnotText
- [x] `saveAnnotation()` — push BiblioAnnotation to ref.annotations, saveBiblio
- [x] `deleteAnnotation(annId)` — remove from ref.annotations, saveBiblio
- [x] `exportAnnotationsAsMarkdown(ref)` — returns markdown string, save to Notes

### UI: detail panel
- [x] Replace `<a>` PDF link with two elements: external link ↗ + "View" button (calls openPDFViewer)

### UI: PDF viewer modal
- [x] Full overlay div (z-index: 3000)
- [x] Header: title + page nav + zoom + highlight toggle + close
- [x] Body split: canvas area (left) + annotations panel (right)
- [x] Canvas area: loading/error states, `<canvas id="biblio-pdf-canvas">`
- [x] Annotations panel: add annotation input box (when showAnnotInput) + list of saved annotations per page + export button

### CSS
- [x] `.pdf-overlay`, `.pdf-viewer`, `.pdf-header`, `.pdf-body`, `.pdf-canvas-area`
- [x] `.pdf-annot-panel`, `.annot-item`, `.annot-quote`, `.annot-note`, `.annot-del`
- [x] `.pdf-loading`, `.pdf-error`, `.pdf-view-btn`

## Build
- [x] `npm run build` — ✓ built in 37.91s
