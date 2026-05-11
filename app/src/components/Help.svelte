<script lang="ts">
  let { onclose, onnavigate }: { onclose: () => void; onnavigate?: (section: string) => void } = $props();

  let active = $state('new');

  function key(e: KeyboardEvent) { if (e.key === 'Escape') onclose(); }
  function go(s: string) { onnavigate?.(s); onclose(); }

  const NAV = [
    { id: 'new',      label: "What's New",    icon: 'M5 3l14 9-14 9V3z' },
    { id: 'start',    label: 'Getting Started', icon: 'M13 10V3L4 14h7v7l9-11h-7z' },
    { id: 'modules',  label: 'All Features',   icon: 'M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z' },
    { id: 'shortcuts', label: 'Shortcuts',     icon: 'M9 7H6a2 2 0 00-2 2v9a2 2 0 002 2h9a2 2 0 002-2v-3M16 5l3 3m-3-3L7 18' },
    { id: 'commands', label: 'Enzo Commands',  icon: 'M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4' },
    { id: 'enzo',     label: 'Enzo Guide',     icon: 'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z' },
  ];

  const NEW_FEATURES = [
    { color: 'pu',   icon: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10', title: 'Research: Paper Collections', desc: 'Organise your reading list into named, colour-coded collections (folders). Create collections from the + collection button above the reading list, then assign papers to one or more collections using the 📁 selector on each item. Filter the list by clicking a collection pill.' },
    { color: 'enzo', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z', title: 'Research: Enzo Paper Compare', desc: 'Select 2–3 papers in your reading list using the checkboxes, then click "Compare with Enzo". Enzo produces a structured comparison table covering study design, sample size, key findings, limitations, and HGSOC relevance — plus a synthesis paragraph.' },
    { color: 'pu',   icon: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z', title: 'Research: Related Papers (OpenAlex)', desc: 'Every reading-list paper now has a magnifier button. Click it to fetch citing papers from OpenAlex — the free, open scholarly index. Results show inline below the paper, each with Open, + List, and Pin actions.' },
    { color: 'gn',   icon: 'M13 10V3L4 14h7v7l9-11h-7z', title: 'Research: Reading Progress Tracking', desc: 'Papers in your reading list cycle through three states: ○ Unread → ⚡ In Progress → ✓ Done. Click the status button on any item to advance it. Done papers are soft-greyed and count toward your weekly reading goal.' },
    { color: 'gn',   icon: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z', title: 'Files: Rename Inline', desc: 'Click the pencil icon that appears next to any filename in the file detail panel to rename it in place. Press Enter or click away to save, Escape to cancel.' },
    { color: 'ac',   icon: 'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z', title: 'Files: Create Note from PDF', desc: 'When a PDF is open in the file viewer, a "Note" button appears in the detail toolbar. Click it to extract the full text (up to 25 pages via PDF.js) and create a linked note. You\'ll be taken directly to the new note to edit.' },
    { color: 'yw',   icon: 'M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z', title: 'Files: Bulk Select + Actions', desc: 'Click the checkbox icon in the Files toolbar to enter bulk mode. Checkboxes appear on every file item. Select any number of files, then use the action bar to move them to a folder or delete them all at once.' },
    { color: 'rd',   icon: 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z', title: 'Files: Image Gallery + Lightbox', desc: 'When your folder contains images, a photo-gallery icon appears in the topbar. Click it to view all images as a responsive grid of thumbnails. Click any thumbnail to open the full-size lightbox viewer with previous/next navigation.' },
    { color: 'ac',   icon: 'M5 3l14 9-14 9V3z', title: 'Note Knowledge Graph', desc: 'Visualise all your notes as a force-directed graph. Node size = word count, edges = [[note]] links. Drag nodes, click to open. Find it via the Graph button in the Notes header.' },
    { color: 'yw',   icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z', title: 'Version History', desc: 'See every saved version of a note with a word-level diff. Click the clock icon in the note toolbar, pick a commit, and the diff panel highlights what changed.' },
    { color: 'pu',   icon: 'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z', title: 'PDF Annotator', desc: 'When a note contains an embedded PDF, a document icon appears in the toolbar. Click it to open the PDF full-screen, navigate pages, write annotations, and insert them as callout blocks directly in your note.' },
    { color: 'enzo', icon: 'M13 10V3L4 14h7v7l9-11h-7z', title: 'AI Inline Continuation', desc: 'Select any text in a note and press the "Continue →" button in the bubble menu. Enzo (Llama 8B) streams a continuation at the cursor position. Press the button again to abort.' },
    { color: 'gn',   icon: 'M9 15l2 2 4-4M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z', title: 'LaTeX Export', desc: 'Export any note as a fully structured .tex file. Click the checkmark-document icon in the note toolbar. All Tiptap blocks — math, callouts, tables, code, headings — are converted to idiomatic LaTeX.' },
    { color: 'ac',   icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z', title: 'Manuscript Writer', desc: 'Full paper writing environment. Structure your paper section by section — Abstract through Discussion — with Enzo assisting at each stage and one-click citations from your reading list.' },
    { color: 'gn',   icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2', title: 'Research Tracker', desc: 'Track grant applications, conference abstract submissions, and peer review assignments in one dedicated section. Never miss a deadline.' },
    { color: 'enzo', icon: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z', title: 'Enzo Intelligence', desc: 'Enzo modes in notes: Summarise, Key Findings, and Devil\'s Advocate — all streaming directly in the editor toolbar. Plus inline continuation anywhere you select text.' },
    { color: 'pu',   icon: 'M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 016 0v6a3 3 0 01-3 3z', title: 'Voice → Research Events', desc: 'After transcription, Enzo parses your voice notes for hypotheses, tasks, and paper links. One tap to approve and connect them to your pipeline runs.' },
    { color: 'rd',   icon: 'M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z', title: 'Interview Intelligence', desc: 'For every saved job, Enzo generates role-specific interview questions from the job description and your CV profile. Draft and refine your answers with AI feedback.' },
    { color: 'ac',   icon: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z', title: 'Extended Global Search', desc: 'Global search covers every section — protocols, hypotheses, pipeline runs, files, pinned papers, grants, and manuscripts.' },
    { color: 'gn',   icon: 'M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4', title: 'WYSIWYG Everywhere', desc: 'TipTap rich editor with full formatting toolbar deployed across notes, journal, protocols, hypotheses, cover letters, manuscript sections, and more.' },
    // ── New batch ──
    { color: 'pu',   icon: 'M13 10V3L4 14h7v7l9-11h-7z', title: 'Note Graph: Enzo Cluster + Semantic Analysis', desc: 'Click "Enzo Analyse" in the graph toolbar to have Enzo cluster your notes into thematic groups, draw dashed semantic edges between related notes, and list 3–5 research gaps. Results overlay the graph live.' },
    { color: 'ac',   icon: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z', title: 'Note Graph: Search + Focus Mode', desc: 'Type in the search bar in the graph header to highlight matching nodes. Click a node to enter focus mode — only that node and its 1-hop neighbours remain visible. Click again or "Clear focus" to reset.' },
    { color: 'gn',   icon: 'M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7', title: 'Note Graph: Multi-select & Synthesis', desc: 'Click "Select" in the graph toolbar to enter multi-select mode. Check any nodes, then click "Synthesise" to have Enzo stream a synthesis paragraph across all selected notes. The result appears in a side panel.' },
    { color: 'enzo', icon: 'M4 6h16M4 10h16M4 14h10', title: 'Presentations: Multi-source + Mode Generation', desc: 'The Generate modal now has source pickers for Notes and Papers — select as many as you like and Enzo uses them as context. Choose a Presentation type: Standard, Journal Club, Lab Meeting, or Grant Narrative. Slides are returned as a structured JSON schema with title, bullets, speaker notes, and citation strips.' },
    { color: 'yw',   icon: 'M4 6h16M4 10h16M4 14h10', title: 'Presentations: Research Templates + Enzo Fill', desc: '11 new research-specific slide templates: Conference talk overview, Thesis chapters, Grant significance/innovation/approach, Journal club paper summary, Lab meeting progress update, Methods workflow, and Data results story. Each template has an "E" button to Enzo-fill it with content from your selected sources.' },
    { color: 'pu',   icon: 'M4 6h16M4 10h16M4 14h10', title: 'Presentations: Source Sidebar', desc: 'After generating with sources, a "Sources (N)" button appears in the toolbar. Click it to open a sidebar showing the full content of all selected notes and papers — keep your reference material visible while editing slides.' },
    { color: 'gn',   icon: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z', title: 'Research: Saved Searches Tab', desc: 'A new "Saved" tab in Research displays all your saved searches with their source badges, run counts, and last-run date. Click "Run" to re-execute any search and switch back to Results.' },
    { color: 'ac',   icon: 'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z', title: 'Research: BibTeX Import', desc: 'Click the "BibTeX" button in the Research toolbar to paste a .bib file and batch-import all papers into your reading list. Duplicates are skipped by title matching.' },
    { color: 'yw',   icon: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z', title: 'Research: Per-paper Inline Notes', desc: 'Every reading-list paper now has a collapsible "▼ Note" section. Click it to expand a text area for your personal notes on that paper. A blue dot on the toggle indicates a saved note.' },
    { color: 'rd',   icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z', title: 'Research: Abstract Keyword Highlighting', desc: 'When you expand a paper\'s abstract, HGSOC-relevant terms are automatically highlighted: TP53, BRCA1/2, PARPi, olaparib, HGSOC, TME, CD8, CAF, scRNA-seq, spatial transcriptomics, and more.' },
    { color: 'enzo', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z', title: 'Research: Radar Digest History', desc: 'Every time Enzo generates a Radar digest, it\'s saved to a history log. Click "History (N)" in the digest panel to expand and read past digests with timestamps and paper counts.' },
    { color: 'gn',   icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z', title: 'Reviews: Bibliography Export', desc: 'Click "Bib" in the Corpus/Themes toolbar to export your full review corpus bibliography in APA, Vancouver, or BibTeX format — download as a file or copy to clipboard.' },
    { color: 'ac',   icon: 'M13 10V3L4 14h7v7l9-11h-7z', title: 'Reviews: Citation Suggestions Panel', desc: 'A new "Suggestions" tab in the Review middle panel. Select a theme and Enzo analyses your draft to identify claims needing citations, generates PubMed search queries for each, and lets you search + add papers to corpus or pin to Research.' },
    { color: 'pu',   icon: 'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z', title: 'Reviews: Per-theme Gap Analysis', desc: 'In the right-side theme editor, click "Gap analysis" next to the Enzo synthesis button. Enzo streams a structured list of 4–6 specific research gaps for the selected theme based on its outline and assigned papers.' },
    { color: 'yw',   icon: 'M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4', title: 'Reviews: LaTeX Export', desc: 'Click "LaTeX" in the Review toolbar to export a complete .tex file with \\section{} per theme, auto-generated \\cite{} markers, and an appended references.bib block — ready for Overleaf or any LaTeX editor.' },
    { color: 'ac',   icon: 'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z', title: 'Reviews: DOCX Export', desc: 'Click "DOCX" in the Review toolbar to download a Word-compatible .doc file containing all your theme sections (with draft text), the review scope, and a numbered bibliography.' },
    { color: 'gn',   icon: 'M13 10V3L4 14h7v7l9-11h-7z', title: 'Reviews: Auto Citation Search', desc: 'Click "Find citations" in the Suggestions panel. Enzo extracts 4–8 citation-worthy claims from your theme text, then automatically runs an OpenAlex search (PubMed fallback) for each claim in parallel — results appear inline without any manual search step.' },
    { color: 'pu',   icon: 'M4 6h16M4 10h16M4 14h10', title: 'Presentations: Files + Pipeline Sources', desc: 'The Generate source picker now includes Files and Pipeline tabs. PDFs are text-extracted automatically via PDF.js; CSVs are passed as raw text. Pipeline runs provide sample description, type, and completed step notes to Enzo.' },
    { color: 'enzo', icon: 'M4 6h16M4 10h16M4 14h10', title: 'Presentations: Context-aware Slide Improve', desc: 'The "E" improve button on each slide now uses your full session source context. When sources are loaded, Enzo adds missing bullets from the source material, strengthens vague claims with specific data, and flags where a citation is needed.' },
    { color: 'yw',   icon: 'M2 3h20v14H2zM8 21h8M12 17v4', title: 'Presentations: Loadable HGSOC Examples', desc: 'Two fully-written example decks appear in the sidebar when no presentations exist: "HGSOC TME — Macrophage Crosstalk" (8 slides) and "PARPi Resistance — Lab Meeting" (11 slides). Click either to load it as a real editable presentation.' },
    { color: 'pu',   icon: 'M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z', title: 'Note Graph: Research Narrative', desc: 'After running Enzo Analyse (which generates cluster labels), click the "Narrative" button. Enzo reads your cluster labels and note titles and writes a 3–4 sentence research narrative describing the intellectual arc of your work — good for grant abstracts or intro paragraphs.' },
    { color: 'ac',   icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2', title: 'Note Graph: Copy + New Note from Synthesis', desc: 'After Enzo synthesises your selected notes in the graph, two action buttons appear below the text: "Copy" copies to clipboard; "New note" creates a tagged note from the synthesis and navigates you there immediately.' },
    // ── 2026-05-11 Presentations + Files overhaul ──
    { color: 'gn',  icon: 'M13 10V3L4 14h7v7l9-11h-7z', title: 'Files: Instant Load + IndexedDB Cache', desc: 'Files now appear instantly on navigation using a local IndexedDB cache keyed by file manifest SHA. Legacy base64 blobs are stripped from memory when an R2 key is present — no more stale fat objects slowing load.' },
    { color: 'ac',  icon: 'M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1', title: 'Files: Cross-Module Linking', desc: 'Link any file to presentations, papers, journal entries, tasks, grants, and manuscripts. Bidirectional — the file detail panel shows every module it belongs to, and linked entries can be opened directly from the panel.' },
    { color: 'yw',  icon: 'M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12', title: 'Files: Sort, Star & Image Thumbnails', desc: 'Sort your file list by name, size, date, or type using the controls in the topbar. Star any file for quick access and filter to starred-only. Images show inline thumbnails in both list and grid views — no need to open the viewer.' },
    { color: 'pu',  icon: 'M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01', title: 'Files: Folder Colour Labels & Usage Summary', desc: 'Right-click any folder to assign a colour from 7 presets — a colour dot appears on all items in that folder for at-a-glance organisation. Each file shows a compact usage badge ("3N · 2R · 1P") counting how many notes, papers, and presentations it is linked to.' },
    { color: 'gn',  icon: 'M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z', title: 'Files: Hover Preview, Duplicate & Version History', desc: 'Hover any file for 350ms to see a floating preview panel (image or PDF thumbnail). A duplicate button clones any file instantly (same R2 key, new ID). Version history tracks every upload timestamp and size under the detail panel.' },
    { color: 'rd',  icon: 'M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12', title: 'Files: Upload Progress, Paste & Dashboard Widget', desc: 'Upload progress now shows a live 0–100% bar per file (XHR-based). Paste a clipboard image anywhere in the Files panel with Ctrl+V to upload it instantly. The Dashboard now shows a "Recent Files" card with the last 5 opened files.' },
    { color: 'enzo', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z', title: 'Files: PDF Note Templates', desc: 'Creating a note from a PDF now shows a template picker with three HGSOC-relevant scaffolds: Paper Notes (structured literature review), Methods Extraction (protocol analysis), and Data Log (quantitative results record). Each pre-fills the note with the appropriate headings and PDF content.' },
    { color: 'yw',  icon: 'M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z', title: 'Presentations: 12 Slide Layouts', desc: '12 Slidev-inspired layout presets: cover, section, two-cols, two-cols-header, image-left, image-right, full-image, stat-callout, quote, statement, end, and default. Pick a layout from the icon row in the slide card header — each pre-scaffolds the HTML content for that layout type.' },
    { color: 'pu',  icon: 'M13 5l7 7-7 7M5 5l7 7-7 7', title: 'Presentations: Step-Reveal & Slide Transitions', desc: 'Toggle "step-reveal" on any slide to have bullet points appear one at a time on arrow-right — just like Slidev v-click. Six transition presets (fade, slide-left/right/up/down, none) are assignable per slide, with a separate transitionBack override for backward navigation. Set a global default transition for the whole deck.' },
    { color: 'ac',  icon: 'M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z', title: 'Presentations: Dual-Panel Presenter Mode', desc: 'Present mode upgrades to a side-by-side layout: large current slide on the left; next slide preview, speaker notes, and live timer on the right. Keyboard shortcuts: → / ← navigate, O opens the full-screen thumbnail overview, G opens the goto-slide dialog, D toggles dark mode, F toggles fullscreen. Speaker notes are now a resizable textarea; a batch editor lets you edit all notes in one scrollable modal.' },
    { color: 'gn',  icon: 'M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4', title: 'Presentations: PDF, PNG & PPTX Export', desc: 'Three export formats in the toolbar. PDF uses print-CSS — slides render at 16:9 in a print window with speaker notes on separate pages. PNG ZIP uses html2canvas to render each slide at 1280×720 and bundles them via JSZip. PPTX uses pptxgenjs — widescreen layout, text content, and speaker notes all included.' },
    { color: 'rd',  icon: 'M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z', title: 'Presentations: Drawing & Annotation Overlay', desc: 'Press the pen icon in present mode to open the drawing toolbar. Choose pen, highlighter (semi-transparent), or eraser in five colour presets. Draw directly on the slide canvas. Annotations are ephemeral — cleared on slide navigation or by the "Clear all" button.' },
    { color: 'enzo', icon: 'M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z', title: 'Presentations: Camera Overlay & Remote QR', desc: 'Toggle your webcam in present mode — the video appears as a draggable, resizable overlay. Reposition by dragging; drag the corner to resize. Camera position/size is saved per session. A QR code button generates a remote-control link (via api.qrserver.com) you can scan with any phone.' },
    { color: 'pu',  icon: 'M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z', title: 'Presentations: Per-Slide Background & CSS Filters', desc: 'Set a hex colour (or gradient / image URL) background on any individual slide via the colour picker in the slide card header. The CSS Filters panel (filter icon in toolbar) adds brightness, contrast, saturation, and hue-rotate sliders applied to the entire presentation in present mode.' },
    { color: 'mu',  icon: 'M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z', title: 'Presentations: Wake Lock & Idle Cursor', desc: 'Screen wake lock (navigator.wakeLock) activates automatically when you enter present mode so the display never sleeps mid-talk — released cleanly on exit. The cursor also hides after 3 seconds of mouse inactivity and reappears the moment you move the mouse.' },
  ];

  const STEPS = [
    { n: '1', color: 'ac',   title: 'Connect GitHub', desc: 'Go to Settings and paste your GitHub personal access token. All data is encrypted with AES-256-GCM before leaving your device.', action: () => go('settings'), cta: 'Open Settings' },
    { n: '2', color: 'gn',   title: 'Write your first note', desc: 'Press the + button in the sidebar, or use Ctrl+J for quick capture. Notes support rich text, tags, tasks, and templates.', action: () => go('notes'), cta: 'Go to Notes' },
    { n: '3', color: 'pu',   title: 'Search papers', desc: 'Research section searches PubMed, OpenAlex, Europe PMC, bioRxiv, medRxiv, Nature, and Cell simultaneously. Pin papers, add to reading list, deep-read with Enzo.', action: () => go('research'), cta: 'Go to Research' },
    { n: '4', color: 'enzo', title: 'Ask Enzo', desc: 'Click the Enzo button in the top right to open the AI panel. Enzo knows your research context, journal entries, and pinned papers.', action: null, cta: null },
    { n: '5', color: 'yw',   title: 'Track experiments', desc: 'Pipeline section logs your runs, protocols, and hypotheses. Link journal entries, notes, and papers to each run.', action: () => go('pipeline'), cta: 'Go to Pipeline' },
    { n: '6', color: 'rd',   title: 'Manage your career', desc: 'Jobs section tracks applications, generates cover letters, manages contacts, and now prepares you for interviews.', action: () => go('jobs'), cta: 'Go to Jobs' },
  ];

  const ALL_MODULES = [
    { id: 'dashboard',     label: 'Dashboard',      color: 'ac',   icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6', desc: 'Overview of all your research activity, stats, analytics, and daily focus.' },
    { id: 'notes',         label: 'Notes',           color: 'ac',   icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z', desc: 'Rich-text notes with tags, templates, focus mode, tasks, version history, PDF annotator, AI continuation, LaTeX export, and knowledge graph.' },
    { id: 'journal',       label: 'Journal',         color: 'enzo', icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253', desc: 'Daily research journal with mood tracking, context tags, and audio links.' },
    { id: 'tasks',         label: 'Tasks',           color: 'rd',   icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4', desc: 'Priority-ranked task list with due dates, note linking, and repeat options.' },
    { id: 'calendar',      label: 'Calendar',        color: 'yw',   icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z', desc: 'Calendar with iCal import and clock widget showing Heidelberg + Chennai time.' },
    { id: 'research',      label: 'Research',        color: 'pu',   icon: 'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z', desc: 'Multi-source paper search (PubMed, OpenAlex, Europe PMC, bioRxiv, Nature, Cell), reading list with 3-state progress, paper collections, Enzo compare, related papers via OpenAlex, DOI resolver, BibTeX import, per-paper inline notes, abstract keyword highlighting, citation formatter, Deep Read, Radar digest history, Saved searches tab, Markers, and Citation Network tabs.' },
    { id: 'pipeline',      label: 'Pipeline',        color: 'gn',   icon: 'M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v10a2 2 0 002 2h10a2 2 0 002-2V5M9 13H5a2 2 0 00-2 2v4a2 2 0 002 2h4a2 2 0 002-2v-4a2 2 0 00-2-2z', desc: 'Bioinformatics pipeline tracker, protocol library, and hypothesis log.' },
    { id: 'jobs',          label: 'Jobs & Career',   color: 'ac',   icon: 'M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z', desc: 'Job tracker, CV builder, cover letter generator, contacts, salary data, interview prep.' },
    { id: 'presentations', label: 'Presentations',   color: 'yw',   icon: 'M2 3h20v14H2zM8 21h8M12 17v4', desc: 'Slide editor with Enzo generation (4 modes), multi-source picker, 12 slide layouts, step-reveal bullets, 6 slide transitions (per-slide + directional back), dual-panel presenter mode with timer + overview + goto, batch notes editor, PDF / PNG ZIP / PPTX export, drawing canvas overlay, per-slide background colours, camera overlay, remote QR control, CSS filter sliders, wake lock, idle cursor hide, and AI context persistence.' },
    { id: 'files',         label: 'Files',           color: 'gn',   icon: 'M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z', desc: 'Upload via drag-drop or Ctrl+V paste with live progress bar, sort by name/size/date/type, star favourites, image thumbnails, folder colour labels, hover quick-look preview, duplicate files, version history, cross-module linking (presentations/papers/journal/tasks/grants/manuscripts), usage summary badge, PDF note templates (3 scaffolds), rename inline, image gallery lightbox, bulk select, and recent files dashboard widget.' },
    { id: 'manuscript',    label: 'Manuscript',      color: 'pu',   icon: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z', desc: 'Structured paper writing with section-by-section Enzo assistance and reading list citations.' },
    { id: 'grants',        label: 'Research Tracker', color: 'gn',  icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2', desc: 'Grant applications, conference abstract tracker, and peer review log.' },
    { id: 'audio',         label: 'Audio',           color: 'pu',   icon: 'M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 016 0v6a3 3 0 01-3 3z', desc: 'Voice recording, Whisper transcription, and voice note → research event parsing.' },
    { id: 'settings',      label: 'Settings',        color: 'mu',   icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z', desc: 'Token, theme, worker URL, AI feature toggles, alarm clock.' },
  ];

  const SHORTCUTS = [
    { group: 'Global', items: [
      { key: '⌘K', desc: 'Global search (all sections)' },
      { key: '⌘J', desc: 'Quick capture (note / task / journal)' },
      { key: '?', desc: 'Open this guide' },
      { key: 'Esc', desc: 'Close panels / modals' },
    ]},
    { group: 'Notes — Editor', items: [
      { key: '⌘⇧F', desc: 'Focus / Zen writing mode' },
      { key: '/', desc: 'Slash command menu — insert any block (heading, code, table, math, mermaid, callout, embed, audio…)' },
      { key: '[[', desc: 'Note link picker — type to filter, Enter to link' },
      { key: '$$', desc: 'Insert inline LaTeX math (renders via KaTeX)' },
      { key: '```mermaid', desc: 'Insert Mermaid diagram block' },
      { key: '⌘B / ⌘I / ⌘U', desc: 'Bold / Italic / Underline' },
      { key: '⌘Z / ⌘Y', desc: 'Undo / Redo' },
      { key: '⌘K', desc: 'Add / edit a hyperlink (select text first)' },
      { key: '⠿ drag', desc: 'Drag any block to reorder — grab the ⠿ handle that appears on the left when you hover' },
    ]},
    { group: 'Notes — Toolbar', items: [
      { key: 'Template', desc: 'Insert a structured template (lab meeting, paper review, grant section, etc.)' },
      { key: 'Summarise / Key findings / Devil\'s advocate', desc: 'Enzo AI analysis — streams a response below the toolbar' },
      { key: '⏱ clock icon', desc: 'Version history — see word-level diff vs any past GitHub commit' },
      { key: '📄 PDF icon', desc: 'PDF annotator — opens when the note has an embedded PDF' },
      { key: '✓ doc icon', desc: 'Export note as LaTeX (.tex)' },
      { key: '+ goal (footer)', desc: 'Set a per-note word-count writing target — progress bar appears in footer' },
    ]},
    { group: 'Notes — Bubble menu', items: [
      { key: 'Select text → Continue →', desc: 'AI inline continuation via Enzo (Llama 8B) — streams text at cursor' },
      { key: 'Select text → Link', desc: 'Convert selection into a hyperlink' },
      { key: 'Ctrl+Enter (in PDF Annotator)', desc: 'Insert annotation as callout block in the note' },
    ]},
    { group: 'Research — Reading List', items: [
      { key: '○ / ⚡ / ✓ button', desc: 'Cycle reading progress: Unread → In Progress → Done' },
      { key: 'Checkbox', desc: 'Select paper for Enzo compare (pick 2–3, then click Compare with Enzo)' },
      { key: '📁 select', desc: 'Assign paper to a named collection; filter list by clicking a collection pill' },
      { key: '🔍 magnifier', desc: 'Fetch citing papers from OpenAlex (requires DOI)' },
      { key: '▼ Note toggle', desc: 'Expand/collapse inline notes per paper — blue dot = note exists' },
    ]},
    { group: 'Research — Toolbar', items: [
      { key: 'BibTeX button', desc: 'Import multiple papers at once from a .bib file — paste and click Import' },
      { key: 'Saved tab', desc: 'View, run, and manage your saved searches in one place' },
    ]},
    { group: 'Note Knowledge Graph', items: [
      { key: 'Click node', desc: 'Enter focus mode — dim all nodes except the clicked node and its direct connections' },
      { key: 'Dbl-click node', desc: 'Open the note for editing' },
      { key: 'Select mode → checkboxes', desc: 'Multi-select nodes, then Synthesise to get an Enzo synthesis of selected notes' },
      { key: 'Enzo Analyse', desc: 'One-click: cluster notes, draw semantic edges, list research gaps' },
      { key: 'Tag color toggle', desc: 'Re-colour nodes by their first tag (deterministic colour hash per tag name)' },
    ]},
    { group: 'Presentations', items: [
      { key: 'Generate → Presentation type', desc: 'Choose Standard / Journal Club / Lab Meeting / Grant Narrative before generating' },
      { key: 'Generate → Sources', desc: 'Select notes and papers as context — Enzo uses them to fill slide content and source_refs' },
      { key: 'Templates → E button', desc: 'Enzo-fill any template with content from your currently selected sources' },
      { key: 'Sources (N) button', desc: 'Toggle source sidebar during editing — see note/paper content alongside your slides' },
    ]},
    { group: 'Reviews', items: [
      { key: 'Suggestions tab', desc: 'Enzo analyses current theme text and suggests claims that need citations + PubMed queries' },
      { key: 'Gap analysis button', desc: 'Next to Synthesize — streams 4–6 research gaps for the selected theme' },
      { key: 'Bib button', desc: 'Export corpus bibliography in APA / Vancouver / BibTeX, copy or download' },
      { key: 'LaTeX button', desc: 'Export full review as .tex file with sections, cites, and .bib appendix' },
    ]},
    { group: 'Files', items: [
      { key: 'Pencil icon (hover filename)', desc: 'Rename file inline — Enter to save, Esc to cancel' },
      { key: 'Note button (PDF viewer)', desc: 'Extract PDF text and create a linked note' },
      { key: '☑ bulk icon (topbar)', desc: 'Toggle bulk-select mode — checkboxes appear on each file' },
      { key: 'Photo grid icon (topbar)', desc: 'Open image gallery — only shown when images are present' },
    ]},
    { group: 'Present mode', items: [
      { key: '← →', desc: 'Navigate slides (→ also advances step-reveal bullets)' },
      { key: 'O', desc: 'Toggle full-screen slide overview grid' },
      { key: 'G', desc: 'Open goto-slide dialog' },
      { key: 'D', desc: 'Toggle dark mode in present view' },
      { key: 'F', desc: 'Toggle fullscreen' },
      { key: 'S', desc: 'Toggle speaker notes' },
      { key: 'Esc', desc: 'Exit presentation' },
    ]},
    { group: 'Files', items: [
      { key: 'Ctrl+V (in Files panel)', desc: 'Paste clipboard image → uploads to R2 automatically' },
      { key: 'Sort bar (topbar)', desc: 'Sort by name / size / date / type — click again to reverse' },
      { key: '★ star button', desc: 'Star a file; use the "Starred" filter chip to show only starred files' },
      { key: 'Hover file (350ms)', desc: 'Quick-look floating preview panel — image or PDF thumbnail' },
      { key: 'Duplicate button', desc: 'Clones the file record (same R2 key, new ID)' },
      { key: 'PDF → Note button', desc: 'Choose template (Paper notes / Methods extraction / Data log) before creating note' },
    ]},
    { group: 'Enzo panel', items: [
      { key: 'Enter', desc: 'Send message' },
      { key: 'Esc', desc: 'Abort streaming response' },
    ]},
  ];

  const ENZO_PROMPTS = [
    { cat: 'Research', prompt: 'What are the key open questions in spatial transcriptomics of HGSOC?', color: 'pu' },
    { cat: 'Analysis', prompt: 'My scRNA-seq shows 4 CAF subclusters. How do I characterise their identities?', color: 'gn' },
    { cat: 'Writing', prompt: 'Help me write an introduction section for a paper on PARP inhibitor resistance', color: 'ac' },
    { cat: 'Career', prompt: 'I\'m applying to a Roche R&D Scientist position. What questions should I prepare for?', color: 'yw' },
    { cat: 'Critique', prompt: 'Challenge my hypothesis that macrophage polarisation drives PARPi resistance', color: 'rd' },
    { cat: 'Summary', prompt: 'Summarise the key arguments in my pinned papers about TLS in ovarian cancer', color: 'enzo' },
  ];

  const CMD_GROUPS = [
    {
      id: 'capture', label: 'Capture', color: 'gn',
      desc: 'Quickly log tasks, notes, ideas, and journal entries without leaving the chat.',
      cmds: [
        { cmd: '/task',  usage: '/task <description>',   desc: 'Add a task to your task list.',                         ex: '/task Draft methods section by Friday' },
        { cmd: '/note',  usage: '/note <title>',          desc: 'Create a new note and open it.',                        ex: '/note PARP inhibitor resistance notes' },
        { cmd: '/log',   usage: '/log <entry>',           desc: 'Add an entry to today\'s lab journal.',                 ex: '/log UMAP clusters look strange — revisit' },
        { cmd: '/idea',  usage: '/idea <text>',           desc: 'Capture an idea with an Idea context tag.',             ex: '/idea Use cell2location for CAF mapping' },
        { cmd: '/hyp',   usage: '/hyp <hypothesis>',      desc: 'Record a hypothesis and have Enzo evaluate it.',        ex: '/hyp Macrophage M2 drives PARPi resistance' },
        { cmd: '/todo',  usage: '/todo',                  desc: 'Show all open tasks grouped by priority.',              ex: '/todo' },
        { cmd: '/today', usage: '/today',                 desc: 'Today\'s tasks plus the current journal snapshot.',     ex: '/today' },
      ],
    },
    {
      id: 'research', label: 'Research', color: 'pu',
      desc: 'Search literature, critique papers, and stress-test hypotheses.',
      cmds: [
        { cmd: '/read',      usage: '/read',                      desc: 'Paste an abstract for a 5-question Socratic deep read.',  ex: '/read (then paste abstract)' },
        { cmd: '/critique',  usage: '/critique',                  desc: 'Peer-review style critique of an abstract.',              ex: '/critique (then paste abstract)' },
        { cmd: '/reading',   usage: '/reading',                   desc: 'Generate a structured reading note (background, methods, findings, relevance).',  ex: '/reading' },
        { cmd: '/devil',     usage: '/devil <hypothesis>',        desc: 'Enzo argues the strongest counter-case against your hypothesis.', ex: '/devil VEGF inhibition will synergise with PARPi' },
        { cmd: '/paper',     usage: '/paper <query>',             desc: 'Search your pinned papers and reading list.',              ex: '/paper spatial transcriptomics ovarian TME' },
        { cmd: '/pubmed',    usage: '/pubmed <query>',            desc: 'Direct PubMed literature search.',                        ex: '/pubmed HGSOC immune checkpoint 2024' },
        { cmd: '/cite',      usage: '/cite <DOI or title>',       desc: 'Format a citation in APA or Vancouver style.',            ex: '/cite 10.1038/s41586-020-2048-1' },
        { cmd: '/explain',   usage: '/explain <term>',            desc: 'Explain a scientific concept in depth.',                  ex: '/explain homologous recombination deficiency' },
        { cmd: '/compare',   usage: '/compare <A> vs <B>',        desc: 'Compare two methods, drugs, or biological concepts.',     ex: '/compare Seurat vs Scanpy for scRNA-seq' },
        { cmd: '/mechanism', usage: '/mechanism <pathway/drug>',  desc: 'Detailed mechanism of action deep-dive.',                 ex: '/mechanism olaparib in BRCA-mutated cells' },
      ],
    },
    {
      id: 'analysis', label: 'Bioinformatics', color: 'ac',
      desc: 'Code help for R, Python, Seurat, Scanpy, Nextflow, and shell pipelines.',
      cmds: [
        { cmd: '/r',        usage: '/r <question>',        desc: 'R / Seurat / Bioconductor code and debugging.',       ex: '/r how do I run DoubletFinder in Seurat v5' },
        { cmd: '/py',       usage: '/py <question>',       desc: 'Python / Scanpy / AnnData code and debugging.',       ex: '/py AnnData subset to CD8 T cells' },
        { cmd: '/code',     usage: '/code <prompt>',       desc: 'Generate complete analysis scripts.',                 ex: '/code UMAP of 10x data with harmony batch correction' },
        { cmd: '/seurat',   usage: '/seurat <question>',   desc: 'Seurat v4/v5 specific questions.',                    ex: '/seurat SCTransform vs NormalizeData differences' },
        { cmd: '/scanpy',   usage: '/scanpy <question>',   desc: 'Scanpy / AnnData specific questions.',                ex: '/scanpy leiden clustering parameter tuning' },
        { cmd: '/spatial',  usage: '/spatial <question>',  desc: 'Spatial transcriptomics — Visium, Slide-seq, MERFISH.', ex: '/spatial deconvolution with cell2location' },
        { cmd: '/nextflow', usage: '/nextflow <question>', desc: 'Nextflow / Snakemake workflow help.',                 ex: '/nextflow nf-core/rnaseq on SLURM cluster' },
        { cmd: '/stats',    usage: '/stats <question>',    desc: 'Statistical analysis and DESeq2 / edgeR questions.',  ex: '/stats pseudobulk DESeq2 multi-donor design' },
        { cmd: '/bash',     usage: '/bash <question>',     desc: 'Shell scripting, SLURM, HPC job management.',         ex: '/bash submit 100 STAR jobs to SLURM array' },
        { cmd: '/debug',    usage: '/debug <code/error>',  desc: 'Paste code or error messages for diagnosis.',         ex: '/debug Error in Seurat: subscript out of bounds' },
      ],
    },
    {
      id: 'writing', label: 'Writing', color: 'yw',
      desc: 'Draft and refine scientific text, cover letters, emails, and presentations.',
      cmds: [
        { cmd: '/draft',     usage: '/draft <prompt>',            desc: 'Draft any scientific text passage.',              ex: '/draft limitations paragraph for scRNA-seq study' },
        { cmd: '/abstract',  usage: '/abstract <title>',          desc: 'Draft a structured paper abstract.',              ex: '/abstract Spatial mapping of HGSOC immune infiltrates' },
        { cmd: '/slides',    usage: '/slides <topic>',            desc: 'Create a slide outline for a talk.',              ex: '/slides group meeting on PARPi resistance' },
        { cmd: '/cover',     usage: '/cover <role at company>',   desc: 'Draft a tailored cover letter.',                  ex: '/cover R&D Scientist at Roche' },
        { cmd: '/bullets',   usage: '/bullets <role>',            desc: 'Sharpen CV bullet points for a specific role.',   ex: '/bullets postdoc bioinformatics immuno-oncology' },
        { cmd: '/interview', usage: '/interview <role at company>', desc: 'Interview question bank + talking points.',     ex: '/interview group leader ovarian cancer Karolinska' },
        { cmd: '/email',     usage: '/email <prompt>',            desc: 'Draft a professional email.',                     ex: '/email request collaboration with Prof Chen at DKFZ' },
        { cmd: '/reply',     usage: '/reply <context>',           desc: 'Draft a reply to a received email.',              ex: '/reply (paste email then describe reply intent)' },
        { cmd: '/translate', usage: '/translate <text>',          desc: 'Translate text to English.',                      ex: '/translate (paste German abstract)' },
        { cmd: '/simplify',  usage: '/simplify <text>',           desc: 'Rewrite for a non-specialist audience.',          ex: '/simplify (paste your dense methods paragraph)' },
      ],
    },
    {
      id: 'manuscript', label: 'Manuscript', color: 'pu',
      desc: 'Section-by-section AI writing assistance for your active manuscript.',
      cmds: [
        { cmd: '/intro',      usage: '/intro',               desc: 'Contextualise Introduction against your literature.', ex: '/intro' },
        { cmd: '/methods',    usage: '/methods',             desc: 'Help with Methods — describe what you ran.',           ex: '/methods' },
        { cmd: '/results',    usage: '/results',             desc: 'Turn bullet-point findings into Results prose.',       ex: '/results' },
        { cmd: '/discussion', usage: '/discussion',          desc: 'Draft Discussion framing for your key findings.',      ex: '/discussion' },
        { cmd: '/revise',     usage: '/revise <paragraph>',  desc: 'Tighten and improve any paragraph.',                   ex: '/revise (paste paragraph)' },
        { cmd: '/title',      usage: '/title <one-liner>',   desc: 'Generate 5 title options for your paper.',             ex: '/title spatial immune atlas HGSOC TME' },
      ],
    },
    {
      id: 'reports', label: 'Reports', color: 'rd',
      desc: 'Auto-generate weekly digests, PI reports, and usage stats.',
      cmds: [
        { cmd: '/digest', usage: '/digest', desc: 'Summarise this week\'s journal, tasks, and papers into a research digest.', ex: '/digest' },
        { cmd: '/pi',     usage: '/pi',     desc: 'Draft a structured progress email for your PI.',                             ex: '/pi' },
        { cmd: '/status', usage: '/status', desc: 'Show app data counts and AI token usage for today.',                         ex: '/status' },
      ],
    },
    {
      id: 'nav', label: 'Navigation', color: 'mu',
      desc: 'Jump anywhere in the app or interact with the current view.',
      cmds: [
        { cmd: '/go',       usage: '/go <section>',  desc: 'Navigate to any section by name or alias.', ex: '/go pipeline — or — /go rsch — or — /go ms' },
        { cmd: '/summarize', usage: '/summarize',    desc: 'Summarise the note currently open in the editor.', ex: '/summarize' },
        { cmd: '/files',    usage: '/files',          desc: 'List stored files grouped by folder.',      ex: '/files' },
        { cmd: '/find',     usage: '/find <query>',   desc: 'Search filenames and descriptions.',        ex: '/find ovarian scRNA 2024' },
        { cmd: '/send',     usage: '/send <recipient>', desc: 'Open mail compose pre-filled to a recipient.', ex: '/send supervisor@uni.de' },
        { cmd: '/help',     usage: '/help',           desc: 'Show the full command picker with all 54 commands.', ex: '/help' },
        { cmd: '/clear',    usage: '/clear',          desc: 'Clear the current Enzo chat session.',      ex: '/clear' },
      ],
    },
  ];
</script>

<svelte:window onkeydown={key} />

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="overlay" onclick={onclose}>
  <div class="modal" onclick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Q·onco Guide" tabindex="-1">

    <!-- ── Left navigation ── -->
    <aside class="side-nav">
      <div class="brand">
        <span class="brand-mark">Q·</span>
        <span class="brand-name">onco</span>
      </div>
      <nav class="side-links">
        {#each NAV as item}
          <button
            class="side-link"
            class:side-active={active === item.id}
            onclick={() => active = item.id}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <path d={item.icon}/>
            </svg>
            {item.label}
          </button>
        {/each}
      </nav>
      <div class="side-footer">
        <span class="version-label">v2.0 · May 2026</span>
        <button class="close-x" onclick={onclose} aria-label="Close">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
    </aside>

    <!-- ── Right content ── -->
    <div class="content">

      <!-- WHAT'S NEW -->
      {#if active === 'new'}
        <div class="section-wrap">
          <div class="section-head">
            <h2>What's new in Q·onco</h2>
            <p class="section-sub">All major upgrades — encrypted, stored, yours.</p>
          </div>
          <div class="feature-grid">
            {#each NEW_FEATURES as f}
              <div class="feature-card feature-{f.color}">
                <div class="fc-icon feature-icon-{f.color}">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                    <path d={f.icon}/>
                  </svg>
                </div>
                <div class="fc-body">
                  <span class="fc-badge badge-{f.color}">New</span>
                  <h4 class="fc-title">{f.title}</h4>
                  <p class="fc-desc">{f.desc}</p>
                </div>
              </div>
            {/each}
          </div>
        </div>

      <!-- GETTING STARTED -->
      {:else if active === 'start'}
        <div class="section-wrap">
          <div class="section-head">
            <h2>Getting started</h2>
            <p class="section-sub">Six steps to a fully wired research workspace</p>
          </div>
          <div class="steps-list">
            {#each STEPS as step}
              <div class="step step-{step.color}">
                <div class="step-num step-num-{step.color}">{step.n}</div>
                <div class="step-body">
                  <h4>{step.title}</h4>
                  <p>{step.desc}</p>
                  {#if step.action}
                    <button class="step-cta" onclick={step.action}>{step.cta} →</button>
                  {/if}
                </div>
              </div>
            {/each}
          </div>
        </div>

      <!-- ALL MODULES -->
      {:else if active === 'modules'}
        <div class="section-wrap">
          <div class="section-head">
            <h2>All features</h2>
            <p class="section-sub">14 sections. Every one encrypted at rest on GitHub.</p>
          </div>
          <div class="modules-grid">
            {#each ALL_MODULES as mod}
              <button class="mod-card" onclick={() => go(mod.id)}>
                <div class="mod-icon mod-icon-{mod.color}">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                    <path d={mod.icon}/>
                  </svg>
                </div>
                <div class="mod-body">
                  <span class="mod-label">{mod.label}</span>
                  <span class="mod-desc">{mod.desc}</span>
                </div>
                <svg class="mod-arrow" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                  <path d="M5 12h14M12 5l7 7-7 7"/>
                </svg>
              </button>
            {/each}
          </div>
        </div>

      <!-- KEYBOARD SHORTCUTS -->
      {:else if active === 'shortcuts'}
        <div class="section-wrap">
          <div class="section-head">
            <h2>Keyboard shortcuts</h2>
            <p class="section-sub">Works on Mac (⌘) and Windows/Linux (Ctrl)</p>
          </div>
          <div class="shortcuts-groups">
            {#each SHORTCUTS as group}
              <div class="shortcut-group">
                <h4 class="sg-title">{group.group}</h4>
                <div class="sg-items">
                  {#each group.items as item}
                    <div class="sg-row">
                      <kbd class="shortcut-key">{item.key}</kbd>
                      <span class="shortcut-desc">{item.desc}</span>
                    </div>
                  {/each}
                </div>
              </div>
            {/each}
          </div>

          <div class="shortcut-tip card-inset">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--enzo);flex-shrink:0">
              <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
            </svg>
            <span>Most actions that happen in a modal can be confirmed with <kbd>Enter</kbd> and cancelled with <kbd>Esc</kbd>.</span>
          </div>
        </div>

      <!-- ENZO COMMANDS -->
      {:else if active === 'commands'}
        <div class="section-wrap">
          <div class="section-head">
            <h2>Enzo slash commands</h2>
            <p class="section-sub">Type <code class="inline-code">/</code> in the Enzo chat input to open the picker. 54 commands across 7 groups.</p>
          </div>

          <div class="cmd-intro card-inset">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--ac);flex-shrink:0">
              <path d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"/>
            </svg>
            <span>Start typing <strong>/</strong> to open the live picker. Use ↑↓ to navigate, Enter to run, Esc to dismiss. Commands that need arguments fill the input as a template — just complete and send.</span>
          </div>

          {#each CMD_GROUPS as grp}
            <div class="cmd-group-block">
              <div class="cmd-group-header">
                <span class="cmd-group-pill badge-{grp.color}">{grp.label}</span>
                <span class="cmd-group-desc">{grp.desc}</span>
              </div>
              <div class="cmd-table">
                {#each grp.cmds as c}
                  <div class="cmd-row">
                    <div class="cmd-row-left">
                      <code class="cmd-code">{c.cmd}</code>
                      <span class="cmd-usage-text">{c.usage}</span>
                    </div>
                    <div class="cmd-row-right">
                      <span class="cmd-row-desc">{c.desc}</span>
                      <span class="cmd-row-ex">e.g. <em>{c.ex}</em></span>
                    </div>
                  </div>
                {/each}
              </div>
            </div>
          {/each}
        </div>

      <!-- ENZO GUIDE -->
      {:else if active === 'enzo'}
        <div class="section-wrap">
          <div class="section-head">
            <h2>Enzo guide</h2>
            <p class="section-sub">Everything Enzo can do — with click-by-click flows</p>
          </div>

          <div class="enzo-who card-inset">
            <div class="enzo-orb"></div>
            <div>
              <strong>Who is Enzo?</strong>
              <p style="margin-top:4px;font-size:0.85rem;line-height:1.6;color:var(--tx2)">Enzo is a brilliant, opinionated research AI specialising in HGSOC, tumour microenvironment, scRNA-seq, spatial transcriptomics, and PARP inhibitor biology. She runs on Llama 70B via Groq and knows your journal, pinned papers, and active tasks. She pushes back when your hypothesis has gaps.</p>
            </div>
          </div>

          <!-- ── Flow diagrams ── -->
          <h4 class="sub-heading">Enzo in Notes</h4>
          <div class="flow-grid">
            <div class="flow-card">
              <div class="flow-title">Summarise / Key Findings / Devil's Advocate</div>
              <div class="flow-steps">
                <div class="fs">1. Open any note</div>
                <div class="fa">↓</div>
                <div class="fs">2. Click <strong>Summarise</strong>, <strong>Key findings</strong>, or <strong>Devil's advocate</strong> in the toolbar</div>
                <div class="fa">↓ streams via Llama 70B</div>
                <div class="fs">3. Response appears below toolbar — click <strong>Insert</strong> to add to note</div>
              </div>
            </div>
            <div class="flow-card">
              <div class="flow-title">AI Inline Continuation</div>
              <div class="flow-steps">
                <div class="fs">1. Select any text in the editor</div>
                <div class="fa">↓</div>
                <div class="fs">2. Click <strong>Continue →</strong> in the bubble menu</div>
                <div class="fa">↓ streams via Llama 8B</div>
                <div class="fs">3. Text appended at cursor — click again to stop</div>
              </div>
            </div>
            <div class="flow-card">
              <div class="flow-title">Word-count Goal Bar</div>
              <div class="flow-steps">
                <div class="fs">1. In any note, click the <strong>pencil icon</strong> in the footer</div>
                <div class="fa">↓</div>
                <div class="fs">2. Type target word count → press Enter</div>
                <div class="fa">↓</div>
                <div class="fs">3. Progress bar: green ≥100%, blue ≥60%, yellow &lt;60%</div>
              </div>
            </div>
          </div>

          <h4 class="sub-heading">Enzo in Research</h4>
          <div class="flow-grid">
            <div class="flow-card">
              <div class="flow-title">Paper Compare</div>
              <div class="flow-steps">
                <div class="fs">1. Go to Research → Reading List tab</div>
                <div class="fa">↓</div>
                <div class="fs">2. Check 2–3 paper checkboxes</div>
                <div class="fa">↓</div>
                <div class="fs">3. Click <strong>Compare with Enzo</strong> in the compare bar</div>
                <div class="fa">↓ streams via Llama 70B</div>
                <div class="fs">4. Markdown comparison table + synthesis paragraph appear</div>
              </div>
            </div>
            <div class="flow-card">
              <div class="flow-title">Deep Read</div>
              <div class="flow-steps">
                <div class="fs">1. Expand any paper in Results or Reading List</div>
                <div class="fa">↓</div>
                <div class="fs">2. Click <strong>Deep Read</strong></div>
                <div class="fa">↓ streams via GPT-OSS 120B</div>
                <div class="fs">3. 5 Socratic questions for critical engagement appear</div>
              </div>
            </div>
            <div class="flow-card">
              <div class="flow-title">Paper Critique</div>
              <div class="flow-steps">
                <div class="fs">1. Expand a paper</div>
                <div class="fa">↓</div>
                <div class="fs">2. Click <strong>Critique</strong></div>
                <div class="fa">↓ streams via Llama 70B</div>
                <div class="fs">3. Structured breakdown: question, methods, novelty, relevance, limitations</div>
              </div>
            </div>
            <div class="flow-card">
              <div class="flow-title">Radar Digest</div>
              <div class="flow-steps">
                <div class="fs">1. Go to Research → Radar tab</div>
                <div class="fa">↓</div>
                <div class="fs">2. Click <strong>Scan PubMed</strong> — fetches new papers across your terms</div>
                <div class="fa">↓</div>
                <div class="fs">3. Click <strong>Summarise new papers</strong></div>
                <div class="fa">↓ streams via Llama 70B</div>
                <div class="fs">4. Digest saved to History — browse past scans with timestamps</div>
              </div>
            </div>
            <div class="flow-card">
              <div class="flow-title">Marker Lookup</div>
              <div class="flow-steps">
                <div class="fs">1. Go to Research → Markers tab</div>
                <div class="fa">↓</div>
                <div class="fs">2. Type a gene symbol (e.g. FOLR1, CD8A, FOXP3)</div>
                <div class="fa">↓</div>
                <div class="fs">3. Click <strong>Ask Enzo</strong></div>
                <div class="fa">↓ streams via Llama 70B</div>
                <div class="fs">4. HGSOC-specific cell-type expression, pathway role, and clinical relevance</div>
              </div>
            </div>
          </div>

          <h4 class="sub-heading">Enzo in Note Knowledge Graph</h4>
          <div class="flow-grid">
            <div class="flow-card">
              <div class="flow-title">Graph Analysis (Clusters + Semantic Edges + Gaps)</div>
              <div class="flow-steps">
                <div class="fs">1. Open Notes → click <strong>Graph</strong> button in header</div>
                <div class="fa">↓</div>
                <div class="fs">2. Click <strong>Enzo Analyse</strong> in the graph toolbar</div>
                <div class="fa">↓ Llama 70B receives all note titles + tags + snippets</div>
                <div class="fs">3. Graph re-renders: cluster labels appear, dashed orange edges connect semantically related notes</div>
                <div class="fa">↓</div>
                <div class="fs">4. Click <strong>Gaps (N)</strong> to open the side panel — 3–5 research gap observations</div>
              </div>
            </div>
            <div class="flow-card">
              <div class="flow-title">Multi-note Synthesis</div>
              <div class="flow-steps">
                <div class="fs">1. In the graph, click <strong>Select</strong></div>
                <div class="fa">↓</div>
                <div class="fs">2. Click nodes to select (white dot = selected)</div>
                <div class="fa">↓</div>
                <div class="fs">3. Click <strong>Synthesise</strong></div>
                <div class="fa">↓ streams via Llama 70B</div>
                <div class="fs">4. Synthesis paragraph appears in right side panel</div>
              </div>
            </div>
          </div>

          <h4 class="sub-heading">Enzo in Presentations</h4>
          <div class="flow-grid">
            <div class="flow-card">
              <div class="flow-title">Generate Slide Deck (JSON Schema Mode)</div>
              <div class="flow-steps">
                <div class="fs">1. Open Presentations → select or create a presentation</div>
                <div class="fa">↓</div>
                <div class="fs">2. Click <strong>Generate [70B]</strong></div>
                <div class="fa">↓</div>
                <div class="fs">3. Choose presentation type: Standard / Journal Club / Lab Meeting / Grant Narrative</div>
                <div class="fa">↓</div>
                <div class="fs">4. Select sources: check Notes and/or Papers tabs</div>
                <div class="fa">↓</div>
                <div class="fs">5. Set slide count → click <strong>Generate</strong></div>
                <div class="fa">↓ Llama 70B returns JSON: {'{'}title, bullets[], speaker_notes, source_refs[]{'}'}</div>
                <div class="fs">6. Slides appear in editor — speaker notes pre-filled, citation strips at slide footers</div>
              </div>
            </div>
            <div class="flow-card">
              <div class="flow-title">Enzo Fill Template</div>
              <div class="flow-steps">
                <div class="fs">1. Select sources (Notes/Papers) in the Generate modal, then close</div>
                <div class="fa">↓</div>
                <div class="fs">2. Click <strong>Templates</strong> in the toolbar</div>
                <div class="fa">↓</div>
                <div class="fs">3. Click the orange <strong>E</strong> button next to any template</div>
                <div class="fa">↓ Llama 70B fills placeholder brackets with real content</div>
                <div class="fs">4. Filled slide inserted at current position</div>
              </div>
            </div>
            <div class="flow-card">
              <div class="flow-title">Enzo Improve Single Slide</div>
              <div class="flow-steps">
                <div class="fs">1. In slide editor, click the <strong>E</strong> button in the slide header</div>
                <div class="fa">↓ Llama 70B rewrites slide for clarity and precision</div>
                <div class="fs">2. Slide content replaced inline — undo with Ctrl+Z</div>
              </div>
            </div>
          </div>

          <h4 class="sub-heading">Enzo in Reviews</h4>
          <div class="flow-grid">
            <div class="flow-card">
              <div class="flow-title">Theme Synthesis</div>
              <div class="flow-steps">
                <div class="fs">1. Open Reviews → select article → select a theme</div>
                <div class="fa">↓</div>
                <div class="fs">2. Add papers to the theme via the Corpus tab checkboxes</div>
                <div class="fa">↓</div>
                <div class="fs">3. Click <strong>Synthesize theme</strong> in the right panel</div>
                <div class="fa">↓ streams via Llama 70B using papers + outline</div>
                <div class="fs">4. Click <strong>Replace draft</strong> or <strong>Append to draft</strong></div>
              </div>
            </div>
            <div class="flow-card">
              <div class="flow-title">Gap Analysis (per theme)</div>
              <div class="flow-steps">
                <div class="fs">1. Select a theme with an outline and assigned papers</div>
                <div class="fa">↓</div>
                <div class="fs">2. Click <strong>Gap analysis</strong> next to the Synthesize button</div>
                <div class="fa">↓ streams via Llama 70B</div>
                <div class="fs">3. 4–6 specific gaps appear: missing methods, populations, mechanisms, evidence</div>
              </div>
            </div>
            <div class="flow-card">
              <div class="flow-title">Citation Suggestions</div>
              <div class="flow-steps">
                <div class="fs">1. Select a theme with draft content</div>
                <div class="fa">↓</div>
                <div class="fs">2. Click the <strong>Suggestions</strong> tab in the middle panel</div>
                <div class="fa">↓ Llama 70B reads draft + existing corpus</div>
                <div class="fs">3. Each suggestion shows: the claim, why it needs a citation, and a PubMed query</div>
                <div class="fa">↓</div>
                <div class="fs">4. Click <strong>Search PubMed</strong> → results appear inline</div>
                <div class="fa">↓</div>
                <div class="fs">5. Click <strong>+ Corpus</strong> to add to review, or <strong>Pin to Research</strong></div>
              </div>
            </div>
          </div>

          <h4 class="sub-heading">Enzo special modes</h4>
          <div class="enzo-modes">
            <div class="enzo-mode">
              <span class="em-badge badge-rd">Devil's Advocate</span>
              <p>Actively argues against your hypothesis using literature evidence. Available from the Hypotheses tab in Pipeline.</p>
            </div>
            <div class="enzo-mode">
              <span class="em-badge badge-pu">Paper Critique</span>
              <p>Structured breakdown: research question, methodology, novelty, HGSOC relevance, limitations. Available on any paper in Research.</p>
            </div>
            <div class="enzo-mode">
              <span class="em-badge badge-gn">Deep Read</span>
              <p>5 pointed Socratic questions to force critical engagement. Available on any paper via Deep Read button.</p>
            </div>
            <div class="enzo-mode">
              <span class="em-badge badge-yw">PI Report</span>
              <p>Reads all activity from the past week and drafts a structured progress email. Available from Dashboard.</p>
            </div>
            <div class="enzo-mode">
              <span class="em-badge badge-ac">Weekly Digest</span>
              <p>Monday morning summary of journal themes, tasks, papers, and pipeline progress. Enable in Settings → AI Features.</p>
            </div>
            <div class="enzo-mode">
              <span class="em-badge badge-enzo">Interview Prep</span>
              <p>Generates tailored interview questions from a job description and your CV profile, then critiques your draft answers.</p>
            </div>
          </div>

          <h4 class="sub-heading">Prompts worth trying</h4>
          <div class="prompt-gallery">
            {#each ENZO_PROMPTS as p}
              <div class="pg-card pg-{p.color}">
                <span class="pg-cat">{p.cat}</span>
                <p class="pg-text">"{p.prompt}"</p>
              </div>
            {/each}
          </div>

          <div class="privacy-note card-inset">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--gn);flex-shrink:0">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
            <span>Enzo runs on Groq's API via your personal Cloudflare Worker. Your prompts and data are never stored by Anthropic, OpenAI, or any third party. Your GitHub token encrypts everything at rest.</span>
          </div>
        </div>
      {/if}

    </div>
  </div>
</div>

<style>
  .overlay {
    position: fixed; inset: 0;
    background: rgba(0,0,0,0.55);
    backdrop-filter: blur(3px);
    z-index: 500;
    display: flex; align-items: center; justify-content: center;
    padding: 20px;
  }

  .modal {
    width: min(1020px, 96vw);
    height: min(88vh, 760px);
    background: var(--bg);
    border: 1px solid var(--bd);
    border-radius: 14px;
    box-shadow: 0 32px 80px rgba(0,0,0,0.32);
    display: flex;
    overflow: hidden;
  }

  /* ── Side nav ── */
  .side-nav {
    width: 200px;
    flex-shrink: 0;
    background: var(--sf);
    border-right: 1px solid var(--bd);
    display: flex;
    flex-direction: column;
    padding: 20px 0 16px;
  }

  .brand {
    display: flex; align-items: baseline; gap: 1px;
    padding: 0 18px 20px;
    border-bottom: 1px solid var(--bd);
    margin-bottom: 12px;
  }
  .brand-mark { font-size: 1.3rem; font-weight: 900; color: var(--ac); letter-spacing: -0.04em; }
  .brand-name { font-size: 1.1rem; font-weight: 700; color: var(--tx); letter-spacing: -0.02em; }

  .side-links { flex: 1; display: flex; flex-direction: column; gap: 2px; padding: 0 8px; }

  .side-link {
    display: flex; align-items: center; gap: 9px;
    padding: 9px 12px;
    border-radius: 8px;
    font-size: 0.875rem; font-weight: 500;
    color: var(--tx2);
    background: transparent; border: none;
    cursor: pointer; text-align: left;
    transition: background var(--transition), color var(--transition);
  }
  .side-link:hover { background: var(--sf2); color: var(--tx); }
  .side-active { background: var(--ac-bg); color: var(--ac); }
  .side-active svg { stroke: var(--ac); }

  .side-footer {
    padding: 12px 16px 0;
    border-top: 1px solid var(--bd);
    display: flex; align-items: center; justify-content: space-between;
  }
  .version-label { font-size: 0.68rem; color: var(--mu); letter-spacing: 0.04em; }
  .close-x {
    width: 26px; height: 26px; display: flex; align-items: center; justify-content: center;
    border-radius: 6px; background: transparent; border: none;
    color: var(--mu); cursor: pointer;
  }
  .close-x:hover { background: var(--sf2); color: var(--rd); }

  /* ── Right content ── */
  .content {
    flex: 1;
    overflow-y: auto;
    scroll-behavior: smooth;
  }

  .section-wrap {
    padding: 32px 36px;
    display: flex;
    flex-direction: column;
    gap: 24px;
    min-height: 100%;
  }

  .section-head { display: flex; flex-direction: column; gap: 5px; }
  .section-head h2 { font-size: 1.5rem; font-weight: 800; letter-spacing: -0.03em; color: var(--tx); }
  .section-sub { font-size: 0.9rem; color: var(--mu); }

  /* ── What's New cards ── */
  .feature-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
  }

  .feature-card {
    display: flex;
    gap: 14px;
    padding: 16px;
    border-radius: 10px;
    border: 1px solid var(--bd);
    background: var(--sf);
    transition: border-color var(--transition), box-shadow var(--transition);
  }
  .feature-card:hover { box-shadow: var(--shadow); }
  .feature-ac:hover  { border-color: var(--ac); }
  .feature-gn:hover  { border-color: var(--gn); }
  .feature-pu:hover  { border-color: var(--pu, #8b5cf6); }
  .feature-rd:hover  { border-color: var(--rd); }
  .feature-yw:hover  { border-color: var(--yw); }
  .feature-enzo:hover { border-color: var(--enzo); }

  .fc-icon {
    width: 36px; height: 36px; border-radius: 8px; flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
  }
  .feature-icon-ac   { background: var(--ac-bg);   color: var(--ac);   }
  .feature-icon-gn   { background: var(--gn-bg);   color: var(--gn);   }
  .feature-icon-pu   { background: rgba(139,92,246,.1); color: #8b5cf6; }
  .feature-icon-rd   { background: var(--rd-bg);   color: var(--rd);   }
  .feature-icon-yw   { background: rgba(234,179,8,.1); color: var(--yw); }
  .feature-icon-enzo { background: var(--enzo-bg); color: var(--enzo); }

  .fc-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; }
  .fc-badge {
    display: inline-block; font-size: 0.6rem; font-weight: 800;
    letter-spacing: 0.08em; text-transform: uppercase;
    padding: 1px 7px; border-radius: 10px; width: fit-content;
  }
  .badge-ac   { background: var(--ac-bg);   color: var(--ac);   }
  .badge-gn   { background: var(--gn-bg);   color: var(--gn);   }
  .badge-pu   { background: rgba(139,92,246,.1); color: #8b5cf6; }
  .badge-rd   { background: var(--rd-bg);   color: var(--rd);   }
  .badge-yw   { background: rgba(234,179,8,.1); color: var(--yw); }
  .badge-enzo { background: var(--enzo-bg); color: var(--enzo); }
  .badge-mu   { background: var(--sf2);     color: var(--mu);   }

  .fc-title { font-size: 0.9rem; font-weight: 700; color: var(--tx); }
  .fc-desc  { font-size: 0.8rem; color: var(--tx2); line-height: 1.55; }

  /* ── Getting started ── */
  .steps-list { display: flex; flex-direction: column; gap: 12px; }

  .step {
    display: flex; gap: 16px; align-items: flex-start;
    padding: 16px 18px;
    border-radius: 10px;
    border: 1px solid var(--bd);
    background: var(--sf);
  }

  .step-num {
    width: 32px; height: 32px; border-radius: 50%; flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
    font-size: 0.9rem; font-weight: 800;
  }
  .step-num-ac   { background: var(--ac-bg);   color: var(--ac);   }
  .step-num-gn   { background: var(--gn-bg);   color: var(--gn);   }
  .step-num-pu   { background: rgba(139,92,246,.1); color: #8b5cf6; }
  .step-num-enzo { background: var(--enzo-bg); color: var(--enzo); }
  .step-num-yw   { background: rgba(234,179,8,.1); color: var(--yw); }
  .step-num-rd   { background: var(--rd-bg);   color: var(--rd);   }

  .step-body { flex: 1; }
  .step-body h4 { font-size: 0.92rem; font-weight: 700; color: var(--tx); margin-bottom: 4px; }
  .step-body p  { font-size: 0.82rem; color: var(--tx2); line-height: 1.55; }
  .step-cta {
    margin-top: 8px; display: inline-block;
    font-size: 0.78rem; font-weight: 600; color: var(--ac);
    background: transparent; border: none; cursor: pointer; padding: 0;
    font-family: var(--font);
  }
  .step-cta:hover { text-decoration: underline; }

  /* ── All modules ── */
  .modules-grid { display: flex; flex-direction: column; gap: 6px; }

  .mod-card {
    display: flex; align-items: center; gap: 14px;
    padding: 13px 16px;
    border-radius: 8px;
    border: 1px solid var(--bd);
    background: var(--sf);
    cursor: pointer;
    text-align: left;
    transition: border-color var(--transition), background var(--transition);
    width: 100%;
  }
  .mod-card:hover { border-color: var(--ac); background: var(--ac-bg); }
  .mod-card:hover .mod-arrow { opacity: 1; color: var(--ac); }
  .mod-card:hover .mod-label { color: var(--ac); }

  .mod-icon {
    width: 32px; height: 32px; border-radius: 7px; flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
  }
  .mod-icon-ac   { background: var(--ac-bg);   color: var(--ac);   }
  .mod-icon-gn   { background: var(--gn-bg);   color: var(--gn);   }
  .mod-icon-pu   { background: rgba(139,92,246,.1); color: #8b5cf6; }
  .mod-icon-rd   { background: var(--rd-bg);   color: var(--rd);   }
  .mod-icon-yw   { background: rgba(234,179,8,.1); color: var(--yw); }
  .mod-icon-enzo { background: var(--enzo-bg); color: var(--enzo); }
  .mod-icon-mu   { background: var(--sf2);     color: var(--mu);   }

  .mod-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
  .mod-label { font-size: 0.875rem; font-weight: 600; color: var(--tx); }
  .mod-desc  { font-size: 0.78rem; color: var(--mu); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .mod-arrow { color: var(--mu); opacity: 0; transition: opacity var(--transition); flex-shrink: 0; }

  /* ── Shortcuts ── */
  .shortcuts-groups { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
  .shortcut-group { display: flex; flex-direction: column; gap: 10px; }
  .sg-title { font-size: 0.72rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.09em; color: var(--mu); margin-bottom: 4px; }
  .sg-items { display: flex; flex-direction: column; gap: 6px; }
  .sg-row { display: flex; align-items: center; gap: 12px; }
  .shortcut-key {
    font-size: 0.72rem; font-weight: 700; font-family: var(--mono);
    background: var(--sf2); border: 1px solid var(--bd);
    border-radius: 5px; padding: 3px 8px;
    color: var(--tx); white-space: nowrap; flex-shrink: 0;
  }
  .shortcut-desc { font-size: 0.82rem; color: var(--tx2); }

  /* ── Enzo guide ── */
  .enzo-who {
    display: flex; gap: 14px; align-items: flex-start;
  }
  .enzo-orb {
    width: 40px; height: 40px; flex-shrink: 0;
    border-radius: 50%;
    background: var(--enzo-bg);
    border: 2px solid var(--enzo-bd);
    position: relative;
  }
  .enzo-orb::after {
    content: ''; position: absolute;
    width: 12px; height: 12px; border-radius: 50%;
    background: var(--gn);
    top: 50%; left: 50%; transform: translate(-50%, -50%);
  }

  .sub-heading {
    font-size: 0.8rem; font-weight: 800; text-transform: uppercase;
    letter-spacing: 0.09em; color: var(--mu);
  }

  .enzo-modes { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .enzo-mode {
    padding: 13px 15px;
    border: 1px solid var(--bd);
    border-radius: 8px;
    background: var(--sf);
    display: flex; flex-direction: column; gap: 6px;
  }
  .em-badge {
    font-size: 0.65rem; font-weight: 800; text-transform: uppercase;
    letter-spacing: 0.07em; padding: 2px 8px; border-radius: 10px; width: fit-content;
  }
  .enzo-mode p { font-size: 0.82rem; color: var(--tx2); line-height: 1.55; margin: 0; }

  .prompt-gallery { display: flex; flex-direction: column; gap: 8px; }
  .pg-card {
    padding: 12px 15px;
    border-radius: 8px;
    border: 1px solid var(--bd);
    background: var(--sf);
    display: flex; flex-direction: column; gap: 4px;
  }
  .pg-cat { font-size: 0.65rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.07em; color: var(--mu); }
  .pg-text { font-size: 0.85rem; color: var(--tx2); line-height: 1.5; margin: 0; font-style: italic; }
  .pg-ac   { border-left: 3px solid var(--ac); }
  .pg-gn   { border-left: 3px solid var(--gn); }
  .pg-pu   { border-left: 3px solid #8b5cf6; }
  .pg-yw   { border-left: 3px solid var(--yw); }
  .pg-rd   { border-left: 3px solid var(--rd); }
  .pg-enzo { border-left: 3px solid var(--enzo); }

  .privacy-note {
    display: flex; gap: 10px; align-items: flex-start;
  }
  .privacy-note span { font-size: 0.82rem; color: var(--tx2); line-height: 1.6; }

  /* ── Shared ── */
  .card-inset {
    padding: 14px 16px;
    border-radius: 8px;
    background: var(--sf2);
    border: 1px solid var(--bd);
  }

  .shortcut-tip {
    display: flex; gap: 10px; align-items: center;
    font-size: 0.82rem; color: var(--tx2);
  }
  .shortcut-tip kbd {
    font-size: 0.7rem; font-family: var(--mono);
    background: var(--sf); border: 1px solid var(--bd);
    border-radius: 3px; padding: 1px 5px;
    color: var(--tx);
  }

  /* ── Commands tab ── */
  .inline-code {
    font-family: var(--mono);
    font-size: 0.85em;
    background: var(--sf2);
    border: 1px solid var(--bd);
    border-radius: 3px;
    padding: 1px 5px;
    color: var(--ac);
  }
  .cmd-intro {
    display: flex; gap: 10px; align-items: flex-start;
    font-size: 0.82rem; color: var(--tx2); line-height: 1.6;
  }
  .cmd-group-block { display: flex; flex-direction: column; gap: 8px; }
  .cmd-group-header {
    display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
  }
  .cmd-group-pill {
    font-size: 0.65rem; font-weight: 800; text-transform: uppercase;
    letter-spacing: 0.08em; padding: 2px 9px; border-radius: 10px;
    flex-shrink: 0;
  }
  .cmd-group-desc { font-size: 0.8rem; color: var(--mu); }

  .cmd-table { display: flex; flex-direction: column; gap: 2px; }
  .cmd-row {
    display: grid;
    grid-template-columns: 220px 1fr;
    gap: 12px;
    align-items: start;
    padding: 8px 12px;
    border-radius: 7px;
    border: 1px solid var(--bd);
    background: var(--sf);
    transition: background var(--transition);
  }
  .cmd-row:hover { background: var(--sf2); }
  .cmd-row-left { display: flex; flex-direction: column; gap: 2px; }
  .cmd-code {
    font-family: var(--mono); font-size: 0.82rem; font-weight: 700;
    color: var(--ac);
  }
  .cmd-usage-text { font-family: var(--mono); font-size: 0.72rem; color: var(--mu); }
  .cmd-row-right { display: flex; flex-direction: column; gap: 2px; }
  .cmd-row-desc { font-size: 0.82rem; color: var(--tx2); line-height: 1.45; }
  .cmd-row-ex   { font-size: 0.75rem; color: var(--mu);  line-height: 1.4; }
  .cmd-row-ex em { font-style: normal; color: var(--tx2); }

  @media (max-width: 720px) {
    .modal { flex-direction: column; height: 95vh; }
    .side-nav { width: 100%; height: auto; flex-direction: row; flex-wrap: wrap; padding: 10px; border-right: none; border-bottom: 1px solid var(--bd); }
    .brand { display: none; }
    .side-links { flex-direction: row; flex-wrap: wrap; gap: 4px; flex: 1; }
    .side-footer { display: none; }
    .feature-grid { grid-template-columns: 1fr; }
    .shortcuts-groups { grid-template-columns: 1fr; }
    .enzo-modes { grid-template-columns: 1fr; }
    .cmd-row { grid-template-columns: 1fr; }
    .section-wrap { padding: 20px; }
  }
</style>
