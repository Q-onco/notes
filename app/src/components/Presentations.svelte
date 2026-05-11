<script lang="ts">
  import { store } from '../lib/store.svelte';
  import { nanoid } from 'nanoid';
  import { marked } from 'marked';
  import { generateSlides, askEnzoInline, generateSlidesDeck } from '../lib/groq';
  import RichEditor from './RichEditor.svelte';
  import type { Presentation, Slide, PresTheme, PresAiContext } from '../lib/types';

  let { showToast }: { showToast: (msg: string, type?: 'success' | 'error') => void } = $props();

  // ── State ─────────────────────────────────────────────────────
  let selectedId      = $state<string | null>(null);
  let presentMode     = $state(false);
  let presentIdx      = $state(0);
  let notesVisible    = $state(false);
  let genOpen         = $state(false);
  let genTopic        = $state('');
  let genCount        = $state(10);
  let genFrom         = $state<'prompt' | 'note' | 'paper'>('prompt');
  let genNoteId       = $state('');
  let genPaperId      = $state('');
  let generating        = $state(false);
  let genProgress       = $state('');
  let docBrief          = $state('');
  let docBriefStreaming = $state(false);
  let docOutline        = $state('');
  let docOutlineStreaming = $state(false);
  let docConcepts       = $state('');
  let docConceptsStreaming = $state(false);
  let generatedTitles   = $state<string[]>([]);
  let saving            = $state(false);
  let saveTimer: ReturnType<typeof setTimeout>;
  let dragIdx         = $state<number | null>(null);
  let dragOver        = $state<number | null>(null);
  let renamingId      = $state<string | null>(null);
  let renameDraft     = $state('');
  let showTemplates   = $state(false);
  let activeSlideIdx  = $state(0);
  let enzoLoadingIdx  = $state<number | null>(null);

  // ── Enhanced generation state ─────────────────────────────────
  let genMode         = $state<'standard' | 'journal_club' | 'lab_meeting' | 'grant_narrative'>('standard');
  let pickedNoteIds   = $state(new Set<string>());
  let pickedPaperIds  = $state(new Set<string>());
  let pickedFileIds   = $state(new Set<string>());
  let pickedRunIds    = $state(new Set<string>());
  let sourcePickerTab = $state<'notes' | 'papers' | 'files' | 'pipeline'>('notes');
  let showSourceSidebar = $state(false);
  let fillTemplateIdx = $state<number | null>(null);
  let extractingFileId = $state<string | null>(null); // file being PDF-extracted

  // ── Presenter timer ───────────────────────────────────────────
  let presentTimer    = $state(0);
  let timerInterval: ReturnType<typeof setInterval> | null = null;

  $effect(() => {
    if (presentMode) {
      presentTimer = 0;
      timerInterval = setInterval(() => { presentTimer++; }, 1000);
    } else {
      if (timerInterval !== null) {
        clearInterval(timerInterval);
        timerInterval = null;
      }
    }
    return () => {
      if (timerInterval !== null) {
        clearInterval(timerInterval);
        timerInterval = null;
      }
    };
  });

  function fmtTimer(s: number): string {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  }

  // ── Transition ────────────────────────────────────────────────
  let slideTransition = $state('slide');

  const pres = $derived(store.presentations.find(p => p.id === selectedId) ?? null);

  const THEMES: Record<PresTheme, { bg: string; fg: string; accent: string; muted: string; label: string }> = {
    white:   { bg: '#ffffff', fg: '#1a1a1a', accent: '#2563eb', muted: '#6b7280', label: 'White' },
    dark:    { bg: '#0f172a', fg: '#e2e8f0', accent: '#60a5fa', muted: '#94a3b8', label: 'Dark' },
    moon:    { bg: '#002b36', fg: '#93a1a1', accent: '#268bd2', muted: '#657b83', label: 'Moon' },
    serif:   { bg: '#faf7f0', fg: '#2c1810', accent: '#9b4208', muted: '#a0785a', label: 'Serif' },
    minimal: { bg: '#fefefe', fg: '#111111', accent: '#111111', muted: '#555555', label: 'Minimal' },
  };

  // ── Slide layout templates ────────────────────────────────────
  const SLIDE_TEMPLATES = [
    {
      name: 'Title slide',
      html: '<h1 style="font-size:2em;font-weight:700">Presentation Title</h1><p style="font-size:1.1em;opacity:0.7">Author · Institution · Date</p>',
    },
    {
      name: 'Section header',
      html: '<h2 style="font-size:1.8em;border-bottom:3px solid currentColor;padding-bottom:0.3em">Section Title</h2>',
    },
    {
      name: 'Content + bullets',
      html: '<h2>Key Points</h2><ul><li>Finding one — with supporting data</li><li>Finding two — mechanism or implication</li><li>Finding three — clinical relevance</li></ul>',
    },
    {
      name: 'Hypothesis',
      html: '<h2>Hypothesis</h2><blockquote style="border-left:4px solid currentColor;padding-left:1em;font-style:italic">H₁: [State your hypothesis here]</blockquote><p style="font-size:0.85em"><strong>Rationale:</strong> Based on [evidence]…</p>',
    },
    {
      name: 'Results',
      html: '<h2>Results</h2><p style="font-size:0.85em"><strong>Key finding:</strong> [Describe main result]</p><div style="border:2px dashed rgba(128,128,128,0.4);border-radius:8px;padding:2em;text-align:center;margin-top:1em;font-size:0.8em;opacity:0.6">[ Figure / Table placeholder ]</div>',
    },
    {
      name: 'Methods',
      html: '<h2>Methods</h2><ol style="font-size:0.85em"><li>Sample preparation: [describe]</li><li>Assay / analysis: [describe]</li><li>Statistical analysis: [test + software]</li></ol>',
    },
    {
      name: 'Two-column',
      html: '<h2>Comparison</h2><div style="display:grid;grid-template-columns:1fr 1fr;gap:1.5em;font-size:0.85em"><div><h3 style="font-size:1em">Condition A</h3><ul><li>Point</li></ul></div><div><h3 style="font-size:1em">Condition B</h3><ul><li>Point</li></ul></div></div>',
    },
    {
      name: 'Quote / Key stat',
      html: '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;text-align:center"><p style="font-size:2.5em;font-weight:700;line-height:1.2">72%</p><p style="font-size:1em;opacity:0.8">of patients showed [outcome] after [treatment]</p><p style="font-size:0.75em;opacity:0.5;margin-top:0.5em">Source: [Citation]</p></div>',
    },
    {
      name: 'Conclusions',
      html: '<h2>Conclusions</h2><ul><li>✓ [Main conclusion]</li><li>✓ [Supporting finding]</li><li>→ [Implication / next step]</li></ul>',
    },
    {
      name: 'Acknowledgements',
      html: '<h2>Acknowledgements</h2><p style="font-size:0.85em"><strong>Funding:</strong> [Grant agency, grant number]</p><p style="font-size:0.85em"><strong>Collaborators:</strong> [Names]</p><p style="font-size:0.85em"><strong>Lab members:</strong> [Names]</p>',
    },
    // ── Research-specific templates ────────────────────────────
    {
      name: 'Conference: Talk overview',
      html: '<h2 style="font-size:1.6em">Talk Title</h2><p style="font-size:0.85em;opacity:0.75">Conference Name · Date · City</p><div style="margin-top:1.2em;font-size:0.82em"><strong>Take-home message:</strong> [One sentence that encapsulates your main finding]</div>',
    },
    {
      name: 'Conference: Key result',
      html: '<h2>Key Result</h2><div style="display:grid;grid-template-columns:1fr 1fr;gap:1.5em;font-size:0.82em"><div><h3 style="font-size:0.9em;margin:0 0 0.5em">Finding</h3><p>[Describe the main finding with quantitative detail]</p></div><div><h3 style="font-size:0.9em;margin:0 0 0.5em">Significance</h3><p>[Clinical or mechanistic implication]</p></div></div><p style="font-size:0.7em;opacity:0.6;margin-top:1em">[Author et al., Journal Year] — [DOI or PMID]</p>',
    },
    {
      name: 'Thesis: Chapter overview',
      html: '<h2>Chapter [N]: [Title]</h2><ul style="font-size:0.85em"><li><strong>Background:</strong> [Context and rationale]</li><li><strong>Aim:</strong> [Specific objective]</li><li><strong>Approach:</strong> [Experimental strategy]</li><li><strong>Outcome:</strong> [Key findings]</li></ul>',
    },
    {
      name: 'Thesis: Conclusion + Future',
      html: '<h2>Conclusions &amp; Future Directions</h2><h3 style="font-size:0.9em">Conclusions</h3><ul style="font-size:0.8em"><li>[Main conclusion 1]</li><li>[Main conclusion 2]</li></ul><h3 style="font-size:0.9em;margin-top:0.8em">Future Work</h3><ul style="font-size:0.8em"><li>[Proposed experiment or direction]</li><li>[Longer-term vision]</li></ul>',
    },
    {
      name: 'Grant: Significance',
      html: '<h2>Significance</h2><p style="font-size:0.85em"><strong>Problem:</strong> [What is the unmet need or knowledge gap?]</p><p style="font-size:0.85em"><strong>Impact:</strong> [How will this project change the field / benefit patients?]</p><p style="font-size:0.85em"><strong>Evidence base:</strong> [Key statistics or findings that justify the work]</p>',
    },
    {
      name: 'Grant: Innovation',
      html: '<h2>Innovation</h2><ul style="font-size:0.85em"><li><strong>Novel approach:</strong> [What is conceptually new?]</li><li><strong>New tools/methods:</strong> [Technology or model not used before in this context]</li><li><strong>Paradigm shift:</strong> [What assumption does this challenge?]</li></ul>',
    },
    {
      name: 'Grant: Approach / Aim',
      html: '<h2>Aim [N]: [Title]</h2><p style="font-size:0.82em"><strong>Rationale:</strong> [Why this aim?]</p><ol style="font-size:0.82em"><li>[Experiment / analysis 1]</li><li>[Experiment / analysis 2]</li></ol><p style="font-size:0.78em;opacity:0.7"><strong>Expected outcome:</strong> [Result] &nbsp;·&nbsp; <strong>Contingency:</strong> [Alternative]</p>',
    },
    {
      name: 'Journal club: Paper summary',
      html: '<h2>Paper Summary</h2><p style="font-size:0.78em;opacity:0.75">[Author et al., Journal Year] — <em>[Paper title]</em></p><div style="display:grid;grid-template-columns:1fr 1fr;gap:1.2em;font-size:0.8em;margin-top:0.8em"><div><strong>Question:</strong><p>[Central research question]</p></div><div><strong>Key finding:</strong><p>[Main result in one sentence]</p></div><div><strong>Methods:</strong><p>[Experimental approach]</p></div><div><strong>Limitation:</strong><p>[Critical weakness]</p></div></div>',
    },
    {
      name: 'Lab meeting: Progress update',
      html: '<h2>Progress Update — [Date]</h2><div style="font-size:0.82em;display:grid;grid-template-columns:1fr 1fr;gap:1em"><div><h3 style="font-size:0.9em">✓ Done since last meeting</h3><ul><li>[Completed task]</li></ul></div><div><h3 style="font-size:0.9em">⏳ In progress</h3><ul><li>[Current task + status]</li></ul></div><div><h3 style="font-size:0.9em">🚧 Blockers</h3><ul><li>[Issue needing team input]</li></ul></div><div><h3 style="font-size:0.9em">→ Next steps</h3><ul><li>[Planned action]</li></ul></div></div>',
    },
    {
      name: 'Methods: Workflow',
      html: '<h2>Experimental Workflow</h2><ol style="font-size:0.82em"><li><strong>Sample collection:</strong> [Patient cohort / cell line / mouse model]</li><li><strong>Processing:</strong> [Preparation steps]</li><li><strong>Assay:</strong> [Sequencing / staining / functional assay]</li><li><strong>Analysis:</strong> [Bioinformatics pipeline / statistical test]</li><li><strong>Validation:</strong> [Orthogonal method]</li></ol>',
    },
    {
      name: 'Data: Results story',
      html: '<h2>Results</h2><p style="font-size:0.85em"><strong>Question asked:</strong> [Specific hypothesis tested]</p><div style="border:2px dashed rgba(128,128,128,0.35);border-radius:8px;padding:1.5em;text-align:center;font-size:0.78em;opacity:0.6;margin:0.8em 0">[ Figure — describe what to insert ]</div><p style="font-size:0.82em"><strong>Interpretation:</strong> [What the data show] — <strong>n =</strong> [sample size], <em>p</em> = [statistic]</p>',
    },
  ];

  async function enzoFillTemplate(idx: number) {
    const tpl = SLIDE_TEMPLATES[idx];
    if (!tpl) return;
    fillTemplateIdx = idx;
    try {
      const context = pickedPaperIds.size > 0
        ? store.readingList.filter(r => pickedPaperIds.has(r.id)).map(r =>
            `${r.paper.title} (${r.paper.authors[0] ?? ''} et al.): ${r.paper.abstract?.slice(0, 400) ?? ''}`
          ).join('\n\n')
        : pickedNoteIds.size > 0
          ? store.notes.filter(n => pickedNoteIds.has(n.id)).map(n =>
              `${n.title}: ${n.body.replace(/<[^>]+>/g, ' ').slice(0, 400)}`
            ).join('\n\n')
          : '';
      const result = await askEnzoInline(
        `Fill in this slide template with real scientific content. ${context ? `Use the following context:\n${context}\n\n` : ''}Replace all placeholder text in brackets with specific, accurate content. Keep the same HTML structure. Return only the filled HTML.`,
        tpl.html
      );
      const cleaned = result.replace(/^```(?:html)?\n?/i, '').replace(/\n?```$/, '').trim();
      insertTemplate(cleaned);
    } catch {
      showToast('Enzo fill failed', 'error');
    } finally {
      fillTemplateIdx = null;
    }
  }

  function insertTemplate(html: string) {
    if (!pres) return;
    // If current active slide is empty (default content), replace it
    const current = pres.slides[activeSlideIdx];
    const isEmptySlide = !current || current.content === '<h2>New Slide</h2>' || current.content === '<h2>New Slide</h2><ul><li>Point one</li><li>Point two</li></ul>' || current.content.trim() === '';
    if (isEmptySlide && current) {
      mutate(p => { p.slides[activeSlideIdx].content = html; });
    } else {
      mutate(p => {
        const s: Slide = { id: nanoid(), content: html, notes: '' };
        p.slides.splice(activeSlideIdx + 1, 0, s);
        activeSlideIdx = activeSlideIdx + 1;
      });
    }
    showTemplates = false;
    // Scroll to the slide
    setTimeout(() => {
      const el = document.getElementById(`slide-${pres!.slides[activeSlideIdx]?.id ?? ''}`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 80);
  }

  // ── CRUD ──────────────────────────────────────────────────────
  function newPresentation() {
    const p: Presentation = {
      id: nanoid(), title: 'Untitled presentation',
      slides: [{ id: nanoid(), content: '<h2>Title</h2><p>Your name · ' + new Date().getFullYear() + '</p>', notes: '' }],
      theme: 'white', createdAt: Date.now(), updatedAt: Date.now(),
    };
    store.presentations = [p, ...store.presentations];
    selectedId = p.id;
    renamingId = p.id; renameDraft = p.title;
    scheduleSave();
  }

  async function deletePresentation(id: string) {
    if (!confirm('Delete this presentation?')) return;
    store.presentations = store.presentations.filter(p => p.id !== id);
    if (selectedId === id) selectedId = null;
    await store.savePresentations();
    showToast('Presentation deleted');
  }

  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
      saving = true;
      try { await store.savePresentations(); } finally { saving = false; }
    }, 1400);
  }

  function mutate(fn: (p: Presentation) => void) {
    if (!pres) return;
    fn(pres); pres.updatedAt = Date.now();
    store.presentations = [...store.presentations];
    scheduleSave();
  }

  function commitRename() {
    if (!renamingId) return;
    const p = store.presentations.find(x => x.id === renamingId);
    if (p && renameDraft.trim()) { p.title = renameDraft.trim(); store.presentations = [...store.presentations]; scheduleSave(); }
    renamingId = null;
  }

  function setTheme(t: PresTheme) { mutate(p => p.theme = t); }

  // ── Slides ────────────────────────────────────────────────────
  function addSlide(afterIdx: number) {
    mutate(p => {
      const s: Slide = { id: nanoid(), content: '<h2>New Slide</h2><ul><li>Point one</li><li>Point two</li></ul>', notes: '' };
      p.slides.splice(afterIdx + 1, 0, s);
    });
  }

  function deleteSlide(idx: number) {
    mutate(p => { if (p.slides.length > 1) p.slides.splice(idx, 1); });
  }

  function duplicateSlide(i: number, slide: Slide) {
    mutate(p => p.slides.splice(i + 1, 0, { id: nanoid(), content: slide.content, notes: slide.notes }));
  }

  function updateContent(idx: number, html: string) { mutate(p => p.slides[idx].content = html); }
  function updateNotes(idx: number, val: string)    { mutate(p => p.slides[idx].notes = val); }

  // ── Drag-to-reorder ───────────────────────────────────────────
  function onDragStart(idx: number) { dragIdx = idx; }
  function onDragOver(e: DragEvent, idx: number) { e.preventDefault(); dragOver = idx; }
  function onDrop(toIdx: number) {
    if (dragIdx === null || dragIdx === toIdx) { dragIdx = null; dragOver = null; return; }
    mutate(p => {
      const [removed] = p.slides.splice(dragIdx!, 1);
      p.slides.splice(toIdx, 0, removed);
    });
    dragIdx = null; dragOver = null;
  }

  // ── Thumbnail strip drag-to-reorder ──────────────────────────
  let thumbDragIdx  = $state<number | null>(null);
  let thumbDragOver = $state<number | null>(null);

  function onThumbDragStart(idx: number) { thumbDragIdx = idx; }
  function onThumbDragOver(e: DragEvent, idx: number) { e.preventDefault(); thumbDragOver = idx; }
  function onThumbDrop(toIdx: number) {
    if (thumbDragIdx === null || thumbDragIdx === toIdx) { thumbDragIdx = null; thumbDragOver = null; return; }
    mutate(p => {
      const [removed] = p.slides.splice(thumbDragIdx!, 1);
      p.slides.splice(toIdx, 0, removed);
    });
    if (activeSlideIdx === thumbDragIdx) activeSlideIdx = toIdx;
    thumbDragIdx = null; thumbDragOver = null;
  }

  function selectSlideFromThumb(i: number) {
    activeSlideIdx = i;
    const slideId = pres?.slides[i]?.id;
    if (slideId) {
      const el = document.getElementById(`slide-${slideId}`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  // ── Present mode ──────────────────────────────────────────────
  function startPresent() {
    if (!pres || pres.slides.length === 0) return;
    presentIdx = 0; presentMode = true; notesVisible = false;
  }

  function exitPresent() { presentMode = false; }

  function onPresentKey(e: KeyboardEvent) {
    if (!presentMode || !pres) return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ') {
      e.preventDefault();
      if (presentIdx < pres.slides.length - 1) presentIdx++;
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (presentIdx > 0) presentIdx--;
    } else if (e.key === 'Escape') {
      exitPresent();
    } else if (e.key === 's' || e.key === 'S') {
      notesVisible = !notesVisible;
    }
  }

  // ── PDF text extraction (for Files source tab) ────────────────
  async function extractPdfTextFromFile(fileId: string): Promise<string> {
    const f = store.files.find(x => x.id === fileId);
    if (!f) return '';
    let url = '';
    if (f.r2Key) {
      url = `${store.workerBase}/file/${encodeURIComponent(f.r2Key)}`;
    } else if (f.data) {
      const binary = atob(f.data);
      const arr = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) arr[i] = binary.charCodeAt(i);
      url = URL.createObjectURL(new Blob([arr], { type: f.mimeType }));
    } else if (f.url) {
      url = f.url;
    }
    if (!url) return '';
    try {
      const pdfjsLib = await import('pdfjs-dist');
      pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();
      const resp = await fetch(url);
      const arrayBuffer = await resp.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let text = '';
      const maxPages = Math.min(pdf.numPages, 10);
      for (let i = 1; i <= maxPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        text += content.items.map((item: any) => item.str).join(' ') + '\n';
      }
      if (f.data) URL.revokeObjectURL(url);
      return text.slice(0, 3000);
    } catch {
      if (f.data) URL.revokeObjectURL(url);
      return '';
    }
  }

  // ── Enzo inline slide improvement (v2 — context-aware) ────────
  async function improveSlide(idx: number, slide: Slide) {
    enzoLoadingIdx = idx;
    try {
      const sources = buildSourcesSync();
      const contextBlock = sources.length
        ? `You have the following source material:\n${sources.map(s => `[${s.type.toUpperCase()}] ${s.title}:\n${s.content}`).join('\n\n---\n\n')}\n\n`
        : '';
      const prompt = `${contextBlock}Improve this research slide. ${sources.length ? 'Use the source material to: add a missing bullet with specific data, strengthen vague claims, insert a citation where one is clearly needed.' : 'Make it clearer, more concise, and scientifically precise.'} Keep the same HTML structure. Return only the improved HTML, no explanations.`;
      const result = await askEnzoInline(prompt, slide.content);
      const cleaned = result.replace(/^```(?:html)?\n?/i, '').replace(/\n?```$/, '').trim();
      mutate(p => { p.slides[idx].content = cleaned; });
      showToast('Slide improved by Enzo');
    } catch (e) {
      showToast('Enzo improvement failed: ' + (e as Error).message, 'error');
    } finally {
      enzoLoadingIdx = null;
    }
  }

  // ── AI generation ─────────────────────────────────────────────
  function buildSourcesSync(): { type: string; title: string; content: string; doi?: string }[] {
    const sources: { type: string; title: string; content: string; doi?: string }[] = [];
    for (const id of pickedNoteIds) {
      const n = store.notes.find(x => x.id === id);
      if (n) sources.push({ type: 'note', title: n.title || 'Untitled', content: n.body.replace(/<[^>]+>/g, ' ').slice(0, 800) });
    }
    for (const id of pickedPaperIds) {
      const r = store.readingList.find(x => x.id === id);
      if (r) sources.push({ type: 'paper', title: r.paper.title, content: r.paper.abstract ?? '', doi: (r.paper as any).doi });
    }
    for (const id of pickedRunIds) {
      const run = store.pipelineRuns.find(x => x.id === id);
      if (run) {
        const steps = run.steps.filter(s => s.status === 'done' && s.notes).map(s => `${s.name}: ${s.notes}`).join('; ');
        sources.push({ type: 'pipeline', title: run.title, content: `Type: ${run.pipelineType}. Sample: ${run.sampleDescription}. Notes: ${run.notes}${steps ? '. Steps: ' + steps : ''}`.slice(0, 800) });
      }
    }
    return sources;
  }

  async function buildSources(): Promise<{ type: string; title: string; content: string; doi?: string }[]> {
    const sources = buildSourcesSync();
    for (const id of pickedFileIds) {
      const f = store.files.find(x => x.id === id);
      if (!f) continue;
      if (f.mimeType === 'text/csv' || f.name.endsWith('.csv')) {
        const text = f.data ? atob(f.data).slice(0, 2000) : '';
        sources.push({ type: 'file', title: f.name, content: text });
      } else if (f.mimeType === 'application/pdf' || f.name.endsWith('.pdf')) {
        extractingFileId = f.id;
        const text = await extractPdfTextFromFile(f.id);
        extractingFileId = null;
        if (text) sources.push({ type: 'file', title: f.name, content: text });
      }
    }
    return sources;
  }

  const totalSourceCount = $derived(pickedNoteIds.size + pickedPaperIds.size + pickedFileIds.size + pickedRunIds.size);

  async function runGenerate() {
    if (!pres) return;
    generating = true;
    const useDeck = genMode !== 'standard' || totalSourceCount > 0;
    try {
      if (useDeck) {
        // New structured path: JSON schema output
        let topic = genTopic;
        if (!topic) {
          if (pickedNoteIds.size > 0) topic = store.notes.find(n => pickedNoteIds.has(n.id))?.title ?? 'Research Presentation';
          else if (pickedPaperIds.size > 0) topic = store.readingList.find(r => pickedPaperIds.has(r.id))?.paper.title ?? 'Research Presentation';
          else if (pickedFileIds.size > 0) topic = store.files.find(f => pickedFileIds.has(f.id))?.name ?? 'Research Presentation';
          else if (pickedRunIds.size > 0) topic = store.pipelineRuns.find(r => pickedRunIds.has(r.id))?.title ?? 'Research Presentation';
          else topic = 'Research Presentation';
        }
        const sources = await buildSources();
        genProgress = ''; docBrief = ''; docOutline = ''; docConcepts = ''; generatedTitles = [];
        docBriefStreaming = false; docOutlineStreaming = false; docConceptsStreaming = false;
        const deck = await generateSlidesDeck(topic, genCount, sources, genMode, undefined, {
          onProgress: (msg) => { genProgress = msg; },
          onBrief: (chunk) => {
            if (!docBriefStreaming) { docBriefStreaming = true; showSourceSidebar = true; }
            docBrief += chunk;
          },
          onOutline: (chunk) => {
            if (!docOutlineStreaming) docOutlineStreaming = true;
            docOutline += chunk;
          },
          onConcepts: (chunk) => {
            if (!docConceptsStreaming) docConceptsStreaming = true;
            docConcepts += chunk;
          },
          onSlideTitles: (titles) => { generatedTitles = [...generatedTitles, ...titles]; },
        });
        if (!deck.length) throw new Error('Enzo returned an empty deck');
        const aiCtx: PresAiContext = {
          brief: docBrief,
          outline: docOutline,
          concepts: docConcepts,
          slideTitles: generatedTitles,
          generatedAt: Date.now(),
        };
        mutate(p => {
          p.slides = deck.map(s => ({
            id: nanoid(),
            content: `<h2>${s.title}</h2><ul>${s.bullets.map(b => `<li>${b}</li>`).join('')}</ul>${s.source_refs.length ? `<p class="cite-strip">${s.source_refs.join(' · ')}</p>` : ''}`,
            notes: s.speaker_notes,
          }));
          p.aiContext = aiCtx;
        });
      } else {
        // Legacy path for simple prompt/note/paper
        let context = '';
        if (genFrom === 'note' && genNoteId) {
          const n = store.notes.find(n => n.id === genNoteId);
          if (n) context = n.body.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
        } else if (genFrom === 'paper' && genPaperId) {
          const p = store.readingList.find(r => r.id === genPaperId);
          if (p) context = `Title: ${p.paper.title}\nAuthors: ${p.paper.authors.join(', ')}\nAbstract: ${p.paper.abstract}`;
        }
        const topic = genFrom === 'prompt' ? genTopic : (genFrom === 'note' ? (store.notes.find(n => n.id === genNoteId)?.title ?? genTopic) : (store.readingList.find(r => r.id === genPaperId)?.paper.title ?? genTopic));
        const raw = await generateSlides(topic, genCount, context);
        mutate(p => {
          p.slides = raw.map(s => ({
            id: nanoid(),
            content: `<h2>${s.title}</h2>${s.content}`,
            notes: s.notes,
          }));
        });
      }
      genOpen = false;
      showToast(`Slides generated`);
    } catch (e) {
      showToast('Generation failed: ' + (e as Error).message, 'error');
    } finally {
      generating = false;
      genProgress = '';
      docBriefStreaming = false; docOutlineStreaming = false; docConceptsStreaming = false;
    }
  }

  // ── Export HTML (reveal.js via CDN) ──────────────────────────
  function exportHtml() {
    if (!pres) return;
    const theme = pres.theme === 'dark' ? 'black' : pres.theme === 'moon' ? 'moon' : pres.theme === 'serif' ? 'serif' : 'white';
    const slidesHtml = pres.slides.map(s =>
      `<section>${s.content}${s.notes ? `<aside class="notes">${s.notes}</aside>` : ''}</section>`
    ).join('\n      ');
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${pres.title}</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/reveal.js@5.1.0/dist/reveal.css">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/reveal.js@5.1.0/dist/theme/${theme}.css">
<style>
  .reveal h2 { font-size: 1.6em; }
  .reveal ul { font-size: 0.9em; text-align: left; }
  .reveal li { margin-bottom: 0.4em; }
  .reveal p { font-size: 0.85em; }
</style>
</head>
<body>
<div class="reveal">
  <div class="slides">
    ${slidesHtml}
  </div>
</div>
<script src="https://cdn.jsdelivr.net/npm/reveal.js@5.1.0/dist/reveal.js"><\/script>
<script>Reveal.initialize({ hash: true, transition: '${slideTransition}', slideNumber: 'c/t' });<\/script>
</body>
</html>`;
    const blob = new Blob([html], { type: 'text/html' });
    const url  = URL.createObjectURL(blob);
    const a    = Object.assign(document.createElement('a'), { href: url, download: `${pres.title.replace(/\s+/g, '-')}.html` });
    a.click(); URL.revokeObjectURL(url);
  }

  const fmtDate = (ts: number) => new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

  // ── Example presentations (loadable) ──────────────────────────
  const EXAMPLE_PRES = [
    {
      title: 'HGSOC TME — Macrophage Crosstalk',
      theme: 'dark' as PresTheme,
      slides: [
        { content: '<h1 style="font-size:1.9em;font-weight:700;margin-bottom:0.3em">Macrophage Crosstalk in the HGSOC Tumour Microenvironment</h1><p style="font-size:0.9em;opacity:0.65">Immunosuppressive architecture and therapeutic vulnerabilities · Lab Meeting 2024</p>' },
        { content: '<h2>Background: HGSOC TME</h2><ul style="font-size:0.85em"><li>High-grade serous ovarian cancer (HGSOC) is characterised by a deeply immunosuppressive TME</li><li>Tumour-infiltrating immune cells are predominantly myeloid: TAMs, MDSCs, and tolerogenic DCs</li><li>CD8⁺ T-cell exclusion correlates with poor platinum response and worse OS</li><li>TAMs account for up to 50% of the tumour mass in ascites-rich HGSOC</li></ul><p class="cite-strip">Bowtell et al., Nature Reviews Cancer 2015 · Curiel et al., Nature Medicine 2004</p>' },
        { content: '<h2>Tumour-Associated Macrophages (TAMs)</h2><div style="display:grid;grid-template-columns:1fr 1fr;gap:1.2em;font-size:0.82em"><div><h3 style="font-size:0.9em;color:var(--pac,#60a5fa)">M1-like (anti-tumour)</h3><ul><li>IL-12, TNFα, iNOS production</li><li>Direct tumour cytotoxicity</li><li>Antigen cross-presentation</li></ul></div><div><h3 style="font-size:0.9em;color:#f97316">M2-like (pro-tumour)</h3><ul><li>IL-10, TGF-β, VEGF secretion</li><li>Immunosuppression of T cells</li><li>Angiogenesis promotion</li></ul></div></div><p style="font-size:0.78em;opacity:0.65;margin-top:0.8em">HGSOC TAMs are predominantly M2-like; ratio predicts prognosis</p>' },
        { content: '<h2>M2 Polarisation Mechanisms</h2><ul style="font-size:0.84em"><li><strong>IL-4 / IL-13:</strong> Th2 cytokines from tumour stroma → STAT6 activation → ARG1, MRC1 upregulation</li><li><strong>CSF1 (M-CSF):</strong> tumour-secreted; drives TAM recruitment and M2 skewing via CSF1R</li><li><strong>IL-6 / STAT3:</strong> bidirectional loop between TAMs and cancer cells</li><li><strong>Prostaglandin E2:</strong> ascites-enriched; suppresses TAM IL-12 production</li></ul><p class="cite-strip">Hagemann et al., JEM 2006 · Reinartz et al., OncoImmunology 2014</p>' },
        { content: '<h2>scRNA-seq Reveals TAM Heterogeneity</h2><p style="font-size:0.83em">Recent single-cell profiling (Hornburg et al., Nature Cancer 2021) identified 4 distinct TAM subsets in HGSOC:</p><ol style="font-size:0.82em"><li><strong>TREM2⁺ immunosuppressive TAMs</strong> — high IL-10, spatially co-localising with exhausted CD8⁺ T cells</li><li><strong>SPP1⁺ inflammatory TAMs</strong> — pro-angiogenic, enriched in ascites</li><li><strong>Cycling TAMs</strong> — expand under platinum pressure</li><li><strong>FOLR2⁺ tissue-resident macrophages</strong> — distinct ontogeny, potentially protective</li></ol>' },
        { content: '<h2>Macrophage–Cancer Cell Crosstalk</h2><div style="font-size:0.82em"><p><strong>Bidirectional signalling axes:</strong></p><ul><li>Cancer cell CSF1 → TAM CSF1R → TAM survival + M2 polarisation → TAM CCL2/CCL22 → further myeloid recruitment</li><li>TAM TGF-β → cancer cell EMT, invasion, platinum resistance</li><li>TAM VEGF-A → endothelial sprouting → immune exclusion</li><li>Cancer cell CD47 "don\'t eat me" → TAM phagocytosis suppression</li></ul></div><p class="cite-strip">Noy & Pollard, Immunity 2014</p>' },
        { content: '<h2>Therapeutic Targeting Strategies</h2><ul style="font-size:0.84em"><li><strong>CSF1R inhibition</strong> (pexidartinib, cabiralizumab) — depletes TAMs; limited single-agent efficacy in HGSOC; combination with anti-PD-1 ongoing (NCT03158272)</li><li><strong>CD47 blockade</strong> (magrolimab) — restores phagocytosis; synergy with carboplatin in preclinical HGSOC models</li><li><strong>IL-6 / JAK-STAT3</strong> — tocilizumab + bevacizumab phase II; primary endpoint not met but subset response</li><li><strong>TAM reprogramming</strong> — agonist CD40 mAbs drive M1 switch; early clinical signals</li></ul>' },
        { content: '<h2>Summary + Open Questions</h2><p style="font-size:0.85em"><strong>Key take-aways:</strong></p><ul style="font-size:0.82em"><li>TREM2⁺ and SPP1⁺ TAM subsets are primary drivers of immunosuppression in HGSOC</li><li>CSF1–CSF1R axis is the dominant polarisation pathway and a druggable target</li><li>Combination with checkpoint blockade is the most clinically advanced strategy</li></ul><p style="font-size:0.82em;margin-top:0.8em"><strong>Open questions:</strong> Does FOLR2⁺ tissue-resident subset predict IO response? What determines TAM ontogeny in recurrent disease? Can spatial niches of TREM2⁺ TAMs be disrupted with targeted agents?</p>' },
      ].map(s => ({ id: nanoid(), content: s.content, notes: '' })),
    },
    {
      title: 'PARPi Resistance Mechanisms — Lab Meeting',
      theme: 'white' as PresTheme,
      slides: [
        { content: '<h1 style="font-size:1.8em;font-weight:700">PARPi Resistance in HGSOC</h1><p style="font-size:0.9em;opacity:0.65">Mechanisms, emerging data, and our scRNA-seq approach · Lab Meeting · 2024</p>' },
        { content: '<h2>PARPi Mechanism of Action</h2><ul style="font-size:0.84em"><li>PARP1/2 inhibition traps PARP at single-strand DNA breaks → stalled replication forks</li><li>In HRD tumours (BRCA1/2 mutant, BRCAness), unrepaired DSBs → mitotic catastrophe</li><li>Approved agents: olaparib, niraparib, rucaparib, veliparib</li><li>First-line maintenance (SOLO-1, PRIMA, PAOLA-1) has transformed HGSOC outcomes</li></ul><p class="cite-strip">Lord & Ashworth, Science 2017</p>' },
        { content: '<h2>Clinical Context: Where We Are</h2><div style="display:grid;grid-template-columns:1fr 1fr;gap:1em;font-size:0.82em"><div><h3 style="font-size:0.88em">Responders (HRD)</h3><ul><li>Olaparib: median PFS 56 mo (SOLO-1)</li><li>Niraparib: PFS benefit in HRD+ (PRIMA)</li><li>Rucaparib maintenance after response</li></ul></div><div><h3 style="font-size:0.88em">Problem: Resistance</h3><ul><li>Nearly all patients eventually progress</li><li>Post-PARPi options are limited</li><li>Platinum re-challenge often fails</li><li>No validated biomarker of resistance</li></ul></div></div>' },
        { content: '<h2>Resistance Mechanism 1: BRCA Reversion</h2><ul style="font-size:0.84em"><li>Secondary mutations restore BRCA1/2 open reading frame</li><li>Detected in ctDNA at progression in 15–46% of patients</li><li>Multiple independent reversion events in different metastatic clones (polyclonal resistance)</li><li>Implications: re-challenge ineffective; need HRD re-testing at progression</li></ul><p style="font-size:0.8em;margin-top:0.8em"><em>Key question: do reversion clones pre-exist at low frequency before PARPi exposure?</em></p><p class="cite-strip">Kondrashova et al., Cancer Discovery 2017</p>' },
        { content: '<h2>Resistance Mechanism 2: RAD51 Paralog Loss + HRR Restoration</h2><ul style="font-size:0.84em"><li>BRCA1-independent HRR restoration via RAD51C/D upregulation</li><li>53BP1 / RIF1 loss → NHEJ shift → end-resection restored without BRCA2</li><li>PALB2 secondary mutations — less common but same effect</li><li>CDK1/2 reactivation — phosphorylates BRCA1 to restore partial HRR function</li></ul><p class="cite-strip">Noordermeer et al., Nature 2018</p>' },
        { content: '<h2>Resistance Mechanism 3: Drug Efflux + Fork Protection</h2><ul style="font-size:0.84em"><li><strong>Pgp (ABCB1) overexpression</strong> — reduces intracellular olaparib/rucaparib concentrations; less relevant for niraparib</li><li><strong>Replication fork protection</strong> — loss of BRCA1/2 normally destabilises forks; PTIP, EZH2, SMARCAL1 mutations restore fork stability independently of HRR</li><li><strong>SLFN11 loss</strong> — impairs replication stress response; associated with multi-drug resistance</li></ul>' },
        { content: '<h2>Our Approach: scRNA-seq of Resistant vs Sensitive HGSOC</h2><p style="font-size:0.84em"><strong>Cohort:</strong> Paired biopsies (pre-PARPi / at progression) from 8 HGSOC patients — BRCA1/2m and sporadic HRD</p><p style="font-size:0.84em;margin-top:0.5em"><strong>Methods:</strong> 10x Chromium v3.1 · CellRanger 7.1 · Seurat 5 · scVelo trajectory · CopyKAT CNV inference</p><div style="border:2px dashed rgba(128,128,128,0.3);border-radius:8px;padding:1em;text-align:center;font-size:0.76em;opacity:0.55;margin-top:0.8em">[ UMAP — pre vs post PARPi, coloured by clone ]</div>' },
        { content: '<h2>Preliminary Findings</h2><ul style="font-size:0.84em"><li>Resistant tumour cells upregulate <strong>CDK1, CCNB1, E2F targets</strong> — consistent with cell-cycle re-wiring</li><li><strong>SPP1⁺ macrophage</strong> expansion in post-PARPi biopsies (3/8 patients) — possible immune evasion</li><li>Trajectory analysis: resistant clones arise from a distinct <strong>intermediate progenitor state</strong> not present pre-treatment</li><li>CopyKAT: chr17q gain (BRCA1 locus) in 4/8 resistant samples — possible amplification-based reversion?</li></ul>' },
        { content: '<h2>Proposed Resistance Model</h2><div style="font-size:0.82em"><p><strong>Working model: PARPi selects a pre-existing progenitor state that acquires HRR-restoring events under treatment pressure</strong></p><ul style="margin-top:0.8em"><li>Progenitor state upregulates CDK1 → partial BRCA1 phosphorylation → marginal HRR</li><li>Under PARPi pressure, secondary BRCA2 reversion or RAD51C upregulation completes resistance</li><li>SPP1⁺ TAM expansion creates immunosuppressive niche that shields emerging resistant clone</li></ul></div><p class="cite-strip">Rottenberg et al., PNAS 2008</p>' },
        { content: '<h2>Blockers + Next Steps</h2><div style="display:grid;grid-template-columns:1fr 1fr;gap:1em;font-size:0.82em"><div><h3 style="font-size:0.88em">🚧 Current blockers</h3><ul><li>Low cell numbers in 2 post-PARPi samples — need re-sequencing</li><li>CopyKAT CNV calling unreliable < 50 cells per clone</li></ul></div><div><h3 style="font-size:0.88em">→ Next steps</h3><ul><li>Spatial transcriptomics (Visium) on 3 resistant samples</li><li>Validate CDK1 upregulation by IHC on FFPE</li><li>Functional assay: CDK1 inhibitor + PARPi in ex vivo organoids</li></ul></div></div>' },
        { content: '<h2>Acknowledgements</h2><p style="font-size:0.85em"><strong>Funding:</strong> [Grant agency — grant number]</p><p style="font-size:0.85em;margin-top:0.5em"><strong>Collaborators:</strong> [Collaborating institutions]</p><p style="font-size:0.85em;margin-top:0.5em"><strong>Lab members:</strong> [Names]</p><p style="font-size:0.85em;margin-top:0.5em"><strong>Core facilities:</strong> Genomics Core · Biobank</p>' },
      ].map(s => ({ id: nanoid(), content: s.content, notes: '' })),
    },
  ];

  function loadExample(ex: typeof EXAMPLE_PRES[number]) {
    const p: Presentation = {
      id: nanoid(),
      title: ex.title,
      slides: ex.slides,
      theme: ex.theme,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    store.presentations = [p, ...store.presentations];
    selectedId = p.id;
    scheduleSave();
  }
</script>

<!-- ── Present mode overlay ─────────────────────────────────── -->
{#if presentMode && pres}
  {@const th = THEMES[pres.theme]}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="present-overlay"
    style="background:{th.bg};color:{th.fg}"
    onkeydown={onPresentKey}
    tabindex="-1"
    role="presentation"
  >
    <div class="present-slide-wrap">
      <div class="present-content" style="--pac:{th.accent};--pmuted:{th.muted}">
        <!-- eslint-disable-next-line svelte/no-at-html-tags -->
        {@html pres.slides[presentIdx]?.content ?? ''}
      </div>
    </div>

    {#if notesVisible && pres.slides[presentIdx]?.notes}
      <div class="present-notes-bar" style="background:{th.bg};border-color:{th.muted}">
        <span class="present-notes-label" style="color:{th.muted}">Notes</span>
        {pres.slides[presentIdx].notes}
      </div>
    {/if}

    <!-- Next slide preview -->
    {#if pres.slides[presentIdx + 1]}
      <div class="present-next-preview" style="border-color:{th.muted}44;background:{th.bg}cc">
        <span class="present-next-label" style="color:{th.muted}">Next →</span>
        <div class="present-next-thumb-wrap">
          <div
            class="present-next-thumb-inner"
            style="--pac:{th.accent};--pmuted:{th.muted};color:{th.fg};background:{th.bg}"
          >
            <!-- eslint-disable-next-line svelte/no-at-html-tags -->
            {@html pres.slides[presentIdx + 1].content}
          </div>
        </div>
      </div>
    {/if}

    <div class="present-footer" style="background:{th.bg}88;color:{th.muted}">
      <button class="present-nav-btn" style="color:{th.fg}" onclick={() => { if (presentIdx > 0) presentIdx--; }} disabled={presentIdx === 0}>←</button>
      <span class="present-counter">{presentIdx + 1} / {pres.slides.length}</span>
      <button class="present-nav-btn" style="color:{th.fg}" onclick={() => { if (presentIdx < pres.slides.length - 1) presentIdx++; }} disabled={presentIdx === pres.slides.length - 1}>→</button>
      <span class="present-timer" style="color:{th.muted}">{fmtTimer(presentTimer)}</span>
      <span class="present-hint">S — notes &nbsp;·&nbsp; Esc — exit</span>
      <button class="present-exit" style="color:{th.muted}" onclick={exitPresent}>✕ Exit</button>
    </div>

    <div class="present-progress-bar" style="background:{th.accent}44">
      <div class="present-progress-fill" style="background:{th.accent};width:{((presentIdx+1)/pres.slides.length)*100}%"></div>
    </div>
  </div>
{/if}

<!-- ── Generate modal ────────────────────────────────────────── -->
{#if genOpen}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="modal-backdrop" onclick={() => genOpen = false}></div>
  <div class="gen-modal card">
    <h3>Generate slides with Enzo</h3>

    <!-- Presentation mode -->
    <div class="gen-section-label">Presentation type</div>
    <div class="gen-tabs">
      {#each ([['standard','Standard'],['journal_club','Journal Club'],['lab_meeting','Lab Meeting'],['grant_narrative','Grant Narrative']] as const) as [m, label]}
        <button class="gen-tab" class:active={genMode === m} onclick={() => genMode = m}>{label}</button>
      {/each}
    </div>

    <!-- Topic -->
    <div class="gen-section-label">Topic / prompt</div>
    <textarea class="gen-textarea" bind:value={genTopic} placeholder="e.g. PARPi resistance mechanisms in HGSOC — 2024 updates" rows={3}></textarea>

    <!-- Source picker -->
    <div class="gen-section-label">
      Sources <span class="gen-source-count">{totalSourceCount} selected</span>
    </div>
    <div class="gen-source-tabs">
      <button class="gen-source-tab" class:active={sourcePickerTab === 'notes'} onclick={() => sourcePickerTab = 'notes'}>
        Notes ({store.notes.filter(n => !n.archived).length})
      </button>
      <button class="gen-source-tab" class:active={sourcePickerTab === 'papers'} onclick={() => sourcePickerTab = 'papers'}>
        Papers ({store.readingList.length})
      </button>
      <button class="gen-source-tab" class:active={sourcePickerTab === 'files'} onclick={() => sourcePickerTab = 'files'}>
        Files ({store.files.filter(f => f.mimeType === 'application/pdf' || f.name.endsWith('.pdf') || f.name.endsWith('.csv')).length})
      </button>
      <button class="gen-source-tab" class:active={sourcePickerTab === 'pipeline'} onclick={() => sourcePickerTab = 'pipeline'}>
        Pipeline ({store.pipelineRuns.length})
      </button>
    </div>
    <div class="gen-source-list">
      {#if sourcePickerTab === 'notes'}
        {#each store.notes.filter(n => !n.archived) as n (n.id)}
          <label class="source-item" class:picked={pickedNoteIds.has(n.id)}>
            <input type="checkbox" checked={pickedNoteIds.has(n.id)} onchange={() => {
              const next = new Set(pickedNoteIds);
              if (next.has(n.id)) next.delete(n.id); else next.add(n.id);
              pickedNoteIds = next;
            }} />
            <span class="source-title">{n.title || 'Untitled'}</span>
          </label>
        {/each}
      {:else if sourcePickerTab === 'papers'}
        {#each store.readingList as r (r.id)}
          <label class="source-item" class:picked={pickedPaperIds.has(r.id)}>
            <input type="checkbox" checked={pickedPaperIds.has(r.id)} onchange={() => {
              const next = new Set(pickedPaperIds);
              if (next.has(r.id)) next.delete(r.id); else next.add(r.id);
              pickedPaperIds = next;
            }} />
            <span class="source-title">{r.paper.title.slice(0, 72)}</span>
          </label>
        {/each}
      {:else if sourcePickerTab === 'files'}
        {@const pdfCsvFiles = store.files.filter(f => f.mimeType === 'application/pdf' || f.name.endsWith('.pdf') || f.name.endsWith('.csv'))}
        {#if pdfCsvFiles.length === 0}
          <p class="gen-source-empty">No PDF or CSV files uploaded yet.</p>
        {:else}
          {#each pdfCsvFiles as f (f.id)}
            <label class="source-item" class:picked={pickedFileIds.has(f.id)}>
              <input type="checkbox" checked={pickedFileIds.has(f.id)} onchange={() => {
                const next = new Set(pickedFileIds);
                if (next.has(f.id)) next.delete(f.id); else next.add(f.id);
                pickedFileIds = next;
              }} />
              <span class="source-title">{f.name}</span>
              <span class="source-meta">{f.name.endsWith('.csv') ? 'CSV' : 'PDF'} · {Math.round(f.size / 1024)}KB</span>
            </label>
          {/each}
        {/if}
      {:else}
        {#if store.pipelineRuns.length === 0}
          <p class="gen-source-empty">No pipeline runs yet.</p>
        {:else}
          {#each store.pipelineRuns.sort((a, b) => b.updatedAt - a.updatedAt) as run (run.id)}
            <label class="source-item" class:picked={pickedRunIds.has(run.id)}>
              <input type="checkbox" checked={pickedRunIds.has(run.id)} onchange={() => {
                const next = new Set(pickedRunIds);
                if (next.has(run.id)) next.delete(run.id); else next.add(run.id);
                pickedRunIds = next;
              }} />
              <span class="source-title">{run.title}</span>
              <span class="source-meta">{run.pipelineType} · {run.status}</span>
            </label>
          {/each}
        {/if}
      {/if}
    </div>

    <!-- Slide count -->
    <div class="gen-count-row">
      <label class="text-sm">Slides:</label>
      {#each [5, 10, 15, 20, 30] as n}
        <button class="count-chip" class:active={genCount === n} onclick={() => genCount = n}>{n}</button>
      {/each}
      <input type="number" class="count-input" bind:value={genCount} min={3} max={60} />
    </div>

    <div class="gen-actions">
      <button class="btn btn-ghost" onclick={() => genOpen = false}>Cancel</button>
      <button
        class="btn btn-primary"
        onclick={runGenerate}
        disabled={generating || (!genTopic.trim() && totalSourceCount === 0)}
      >
        {#if generating}Generating…{:else}Generate<span class="model-pill">[70B]</span>{/if}
      </button>
    </div>
    {#if generating}
      <p class="text-xs text-mu" style="text-align:center;margin-top:6px">
        {genProgress || 'Enzo is writing your slides…'}
      </p>
    {/if}
  </div>
{/if}

<!-- ── Templates popover backdrop ────────────────────────────── -->
{#if showTemplates}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="modal-backdrop templates-backdrop" onclick={() => showTemplates = false}></div>
{/if}

<!-- ── Main layout ────────────────────────────────────────────── -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="pres-shell" onkeydown={onPresentKey} tabindex="-1">

  <!-- Left panel -->
  <aside class="pres-list-panel">
    <div class="pres-list-header">
      <span class="section-label">Presentations</span>
      <button class="btn-icon" onclick={newPresentation} title="New presentation">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
      </button>
    </div>

    <div class="pres-list">
      {#each store.presentations as p (p.id)}
        <div class="pres-item" class:active={selectedId === p.id} onclick={() => selectedId = p.id}>
          <div class="pres-item-icon">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>
          </div>
          <div class="pres-item-body">
            {#if renamingId === p.id}
              <!-- svelte-ignore a11y_autofocus -->
              <input
                class="pres-rename-input"
                bind:value={renameDraft}
                autofocus
                onblur={commitRename}
                onkeydown={(e) => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') renamingId = null; }}
                onclick={(e) => e.stopPropagation()}
              />
            {:else}
              <span class="pres-item-title">{p.title}</span>
            {/if}
            <span class="pres-item-meta">{p.slides.length} slide{p.slides.length !== 1 ? 's' : ''} · {fmtDate(p.updatedAt)}</span>
          </div>
          <div class="pres-item-actions">
            <button class="btn-icon pres-action-btn" title="Rename" onclick={(e) => { e.stopPropagation(); renamingId = p.id; renameDraft = p.title; }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button class="btn-icon pres-action-btn danger" title="Delete" onclick={(e) => { e.stopPropagation(); deletePresentation(p.id); }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6m5 0V4h4v2"/></svg>
            </button>
          </div>
        </div>
      {:else}
        <!-- Example presentations when list is empty -->
        <div class="pres-list-empty">
          <p class="text-mu text-xs">No presentations yet.</p>
          <button class="btn btn-ghost btn-sm" onclick={newPresentation}>Create one</button>
        </div>
        {#each EXAMPLE_PRES as ex}
          <div class="pres-item pres-item-example" onclick={() => loadExample(ex)} title="Load example — click to edit">
            <div class="pres-item-icon">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>
            </div>
            <div class="pres-item-body">
              <span class="pres-item-title">{ex.title}</span>
              <span class="pres-item-meta">{ex.slides.length} slides · <em>click to load</em></span>
            </div>
          </div>
        {/each}
      {/each}
    </div>
  </aside>

  <!-- Thumbnail strip -->
  {#if pres}
    <aside class="pres-thumb-strip">
      {#each pres.slides as slide, i (slide.id)}
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div
          class="thumb-item"
          class:active={activeSlideIdx === i}
          class:thumb-drag-over={thumbDragOver === i}
          draggable="true"
          ondragstart={() => onThumbDragStart(i)}
          ondragover={(e) => onThumbDragOver(e, i)}
          ondrop={() => onThumbDrop(i)}
          ondragend={() => { thumbDragIdx = null; thumbDragOver = null; }}
          onclick={() => selectSlideFromThumb(i)}
          title="Slide {i + 1}"
        >
          <div class="thumb-drag-handle" title="Drag to reorder">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="8" r="1.5"/><circle cx="9" cy="14" r="1.5"/><circle cx="15" cy="8" r="1.5"/><circle cx="15" cy="14" r="1.5"/></svg>
          </div>
          <div class="thumb-preview-wrap">
            <div class="thumb-preview-inner">
              <!-- eslint-disable-next-line svelte/no-at-html-tags -->
              {@html slide.content}
            </div>
          </div>
          <span class="thumb-num">{i + 1}</span>
        </div>
      {/each}
    </aside>
  {/if}

  <!-- Main editor -->
  <div class="pres-main">
    {#if !pres}
      <div class="pres-empty">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" opacity="0.25">
          <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>
        </svg>
        <p class="text-mu text-sm">Select or create a presentation</p>
        <button class="btn btn-primary btn-sm" onclick={newPresentation}>+ New presentation</button>
      </div>
    {:else}
      <!-- Toolbar -->
      <div class="pres-toolbar">
        <div class="pres-toolbar-left">
          {#if renamingId === pres.id}
            <input
              class="pres-title-input"
              bind:value={renameDraft}
              onblur={commitRename}
              onkeydown={(e) => { if (e.key === 'Enter') commitRename(); }}
            />
          {:else}
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <h2 class="pres-title" onclick={() => { renamingId = pres!.id; renameDraft = pres!.title; }}>{pres.title}</h2>
          {/if}
        </div>
        <div class="pres-toolbar-right">
          {#if saving}<span class="save-ind text-xs text-mu">Saving…</span>{/if}
          <select class="theme-select" value={pres.theme} onchange={(e) => setTheme((e.target as HTMLSelectElement).value as PresTheme)}>
            {#each Object.entries(THEMES) as [key, val]}
              <option value={key}>{val.label}</option>
            {/each}
          </select>
          <!-- Transition select -->
          <select class="transition-select" bind:value={slideTransition} title="Slide transition">
            <option value="none">No transition</option>
            <option value="fade">Fade</option>
            <option value="slide">Slide</option>
            <option value="convex">Convex</option>
            <option value="concave">Concave</option>
            <option value="zoom">Zoom</option>
          </select>
          <button class="btn btn-ghost btn-sm" onclick={() => genOpen = true}>
            <span class="enzo-e">E</span> Generate<span class="model-pill">[70B]</span>
          </button>
          <!-- Templates button -->
          <div class="templates-wrap">
            <button class="btn btn-ghost btn-sm" onclick={() => showTemplates = !showTemplates}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
              Templates
            </button>
            {#if showTemplates}
              <div class="templates-dropdown card">
                <p class="templates-hint text-xs text-mu">Insert layout · click name to insert, E to Enzo-fill</p>
                {#each SLIDE_TEMPLATES as tpl, idx}
                  <div class="template-row">
                    <button class="template-item" onclick={() => insertTemplate(tpl.html)}>{tpl.name}</button>
                    <button
                      class="template-enzo-fill"
                      onclick={() => enzoFillTemplate(idx)}
                      disabled={fillTemplateIdx !== null}
                      title="Enzo fill this template with content from selected sources"
                    >
                      {fillTemplateIdx === idx ? '…' : 'E'}
                    </button>
                  </div>
                {/each}
              </div>
            {/if}
          </div>
          <button class="btn btn-ghost btn-sm" onclick={exportHtml} title="Export as reveal.js HTML">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Export HTML
          </button>
          <!-- Source sidebar toggle -->
          {#if totalSourceCount > 0 || docBrief || pres?.aiContext}
            <button class="btn btn-ghost btn-sm" class:active={showSourceSidebar} onclick={() => showSourceSidebar = !showSourceSidebar} title="Toggle source sidebar">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 6h16M4 12h16M4 18h10"/></svg>
              Sources {totalSourceCount > 0 ? `(${totalSourceCount})` : ''}{(docBrief || pres?.aiContext?.brief) ? ' · Analysis' : ''}
            </button>
          {/if}
          <button class="btn btn-primary btn-sm" onclick={startPresent}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            Present
          </button>
        </div>
      </div>

      <!-- Source sidebar + slide editor layout -->
      <div class="slides-editor-wrap">

      <!-- Source sidebar -->
      {#if showSourceSidebar && (totalSourceCount > 0 || docBrief || pres?.aiContext)}
        <div class="source-sidebar">
          <div class="source-sidebar-header">
            <span class="source-sidebar-title">Sources {totalSourceCount > 0 ? `(${totalSourceCount})` : ''}</span>
            <button class="source-sidebar-close" onclick={() => showSourceSidebar = false}>×</button>
          </div>
          <div class="source-sidebar-body">
            {#if docBrief || pres?.aiContext?.brief}
              <div class="source-group-label layer-label-brief">
                ① Document Analysis
                {#if !docBrief && pres?.aiContext?.generatedAt}
                  <span class="layer-saved-badge">· saved {new Date(pres.aiContext.generatedAt).toLocaleDateString()}</span>
                {/if}
              </div>
              <div class="source-entry doc-layer-entry doc-layer-brief">
                <p class="doc-layer-text">{docBrief || pres?.aiContext?.brief || ''}{#if docBriefStreaming}<span class="brief-cursor">▋</span>{/if}</p>
              </div>
            {/if}
            {#if docOutline || pres?.aiContext?.outline}
              <div class="source-group-label layer-label-outline">③ Deck Outline</div>
              <div class="source-entry doc-layer-entry doc-layer-outline">
                <p class="doc-layer-text">{docOutline || pres?.aiContext?.outline || ''}{#if docOutlineStreaming}<span class="brief-cursor">▋</span>{/if}</p>
              </div>
            {/if}
            {#if docConcepts || pres?.aiContext?.concepts}
              <div class="source-group-label layer-label-concepts">④ Key Concepts</div>
              <div class="source-entry doc-layer-entry doc-layer-concepts">
                <p class="doc-layer-text">{docConcepts || pres?.aiContext?.concepts || ''}{#if docConceptsStreaming}<span class="brief-cursor">▋</span>{/if}</p>
              </div>
            {/if}
            {#if generatedTitles.length > 0 || (pres?.aiContext?.slideTitles?.length ?? 0) > 0}
              {@const titles = generatedTitles.length > 0 ? generatedTitles : (pres?.aiContext?.slideTitles ?? [])}
              <div class="source-group-label layer-label-slides">② Slides Generated ({titles.length}{generating ? '…' : ''})</div>
              <div class="source-entry doc-layer-entry doc-layer-slides">
                {#each titles as title, i}
                  <p class="slide-title-item"><span class="slide-num">{i + 1}</span>{title}</p>
                {/each}
              </div>
            {/if}
            {#if (docBrief || docOutline || docConcepts || generatedTitles.length > 0 || pres?.aiContext) && (pickedNoteIds.size > 0 || pickedPaperIds.size > 0 || pickedFileIds.size > 0 || pickedRunIds.size > 0)}
              <hr class="sidebar-divider" />
            {/if}
            {#if pickedNoteIds.size > 0}
              <div class="source-group-label">Notes</div>
              {#each store.notes.filter(n => pickedNoteIds.has(n.id)) as n}
                <div class="source-entry">
                  <span class="source-entry-title">{n.title || 'Untitled'}</span>
                  <p class="source-entry-snippet">{n.body.replace(/<[^>]+>/g, ' ').trim().slice(0, 120)}…</p>
                </div>
              {/each}
            {/if}
            {#if pickedPaperIds.size > 0}
              <div class="source-group-label">Papers</div>
              {#each store.readingList.filter(r => pickedPaperIds.has(r.id)) as r}
                <div class="source-entry">
                  <span class="source-entry-title">{r.paper.title.slice(0, 60)}</span>
                  <p class="source-entry-snippet">{r.paper.abstract?.slice(0, 120) ?? ''}…</p>
                </div>
              {/each}
            {/if}
            {#if pickedFileIds.size > 0}
              <div class="source-group-label">Files</div>
              {#each store.files.filter(f => pickedFileIds.has(f.id)) as f}
                <div class="source-entry">
                  <span class="source-entry-title">{f.name}</span>
                  <p class="source-entry-snippet source-entry-meta">{f.name.endsWith('.csv') ? 'CSV data' : 'PDF document'} · {Math.round(f.size / 1024)}KB{extractingFileId === f.id ? ' · extracting…' : ''}</p>
                </div>
              {/each}
            {/if}
            {#if pickedRunIds.size > 0}
              <div class="source-group-label">Pipeline runs</div>
              {#each store.pipelineRuns.filter(r => pickedRunIds.has(r.id)) as run}
                <div class="source-entry">
                  <span class="source-entry-title">{run.title}</span>
                  <p class="source-entry-snippet">{run.pipelineType} · {run.sampleDescription.slice(0, 80)}</p>
                </div>
              {/each}
            {/if}
          </div>
        </div>
      {/if}

      <!-- Slide editor -->
      <div class="slides-editor">
        {#each pres.slides as slide, i (slide.id)}
          <!-- Add slide above (first slot) -->
          {#if i === 0}
            <div class="add-slide-zone">
              <button class="add-slide-btn" onclick={() => { mutate(p => p.slides.unshift({ id: nanoid(), content: '<h2>New Slide</h2>', notes: '' })); }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              </button>
            </div>
          {/if}

          <!-- Slide card -->
          <div
            id="slide-{slide.id}"
            class="slide-card"
            class:drag-over={dragOver === i}
            draggable="true"
            ondragstart={(e) => {
              if (!(e.target as HTMLElement).closest('.slide-drag-handle')) { e.preventDefault(); return; }
              onDragStart(i);
            }}
            ondragover={(e) => onDragOver(e, i)}
            ondrop={() => onDrop(i)}
            ondragend={() => { dragIdx = null; dragOver = null; }}
            onclick={() => activeSlideIdx = i}
          >
            <div class="slide-card-header">
              <div class="slide-drag-handle" title="Drag to reorder">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="7" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="9" cy="17" r="1.5"/><circle cx="15" cy="7" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="15" cy="17" r="1.5"/></svg>
              </div>
              <!-- Duplicate button -->
              <button
                class="btn-icon slide-dup"
                onclick={(e) => { e.stopPropagation(); duplicateSlide(i, slide); }}
                title="Duplicate slide"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
              </button>
              <span class="slide-num">Slide {i + 1}</span>
              <!-- Enzo improve button -->
              <button
                class="btn-icon slide-enzo-btn"
                onclick={(e) => { e.stopPropagation(); improveSlide(i, slide); }}
                disabled={enzoLoadingIdx !== null}
                title="Improve this slide with Enzo"
              >
                {#if enzoLoadingIdx === i}
                  <span class="enzo-spinner"></span>
                {:else}
                  <span class="enzo-e-purple">E</span>
                {/if}
              </button>
              <button class="btn-icon slide-del" onclick={(e) => { e.stopPropagation(); deleteSlide(i); }} disabled={pres.slides.length <= 1} title="Delete slide">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            <div
              class="slide-content-wrap"
              onclick={(e) => e.stopPropagation()}
              ondragstart={(e) => e.preventDefault()}
            >
              <RichEditor
                value={slide.content}
                onchange={(html) => updateContent(i, html)}
                placeholder="Slide content…"
                minHeight="160px"
                class="slide-rich-editor"
              />
            </div>

            <div class="slide-notes-row">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="notes-icon"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
              <input
                class="slide-notes-input"
                type="text"
                value={slide.notes}
                oninput={(e) => updateNotes(i, (e.target as HTMLInputElement).value)}
                placeholder="Speaker notes (press S during presentation)…"
              />
            </div>
          </div>

          <!-- Add slide between -->
          <div class="add-slide-zone">
            <button class="add-slide-btn" onclick={() => addSlide(i)} title="Add slide after">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            </button>
          </div>
        {/each}
      </div>
      </div> <!-- slides-editor-wrap -->
    {/if}
  </div>
</div>

<style>
  .pres-shell {
    display: flex;
    height: 100%;
    overflow: hidden;
    outline: none;
  }

  /* ── Left panel ── */
  .pres-list-panel {
    width: 220px;
    flex-shrink: 0;
    border-right: 1px solid var(--bd);
    display: flex;
    flex-direction: column;
    background: var(--sf);
    overflow: hidden;
  }
  .pres-list-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 10px 8px;
    border-bottom: 1px solid var(--bd);
    flex-shrink: 0;
  }
  .section-label { font-size: 0.68rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: var(--mu); }
  .pres-list { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 1px; padding: 6px; }
  .pres-list-empty { padding: 16px 8px 8px; text-align: center; display: flex; flex-direction: column; gap: 8px; align-items: center; }

  .pres-item {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    padding: 8px 8px;
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: background var(--transition);
    position: relative;
  }
  .pres-item:hover { background: var(--sf2); }
  .pres-item.active { background: var(--ac-bg); }
  .pres-item-icon { color: var(--mu); flex-shrink: 0; margin-top: 2px; }
  .pres-item.active .pres-item-icon { color: var(--ac); }
  .pres-item-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
  .pres-item-title { font-size: 0.8rem; font-weight: 500; color: var(--tx); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .pres-item.active .pres-item-title { color: var(--ac); }
  .pres-item-meta { font-size: 0.68rem; color: var(--mu); }
  .pres-item-actions { display: flex; gap: 1px; opacity: 0; transition: opacity var(--transition); flex-shrink: 0; }
  .pres-item:hover .pres-item-actions { opacity: 1; }
  .pres-action-btn { width: 22px; height: 22px; border-radius: 4px; }
  .pres-action-btn.danger:hover { color: var(--rd); background: var(--rd-bg); }
  .pres-rename-input { font-size: 0.8rem; font-weight: 500; border: 1px solid var(--ac); border-radius: 3px; padding: 1px 4px; width: 100%; background: var(--bg); color: var(--tx); }

  /* Example pres items */
  .pres-item-example {
    opacity: 0.6;
    cursor: default;
    pointer-events: none;
  }

  /* ── Thumbnail strip ── */
  .pres-thumb-strip {
    width: 130px;
    flex-shrink: 0;
    border-right: 1px solid var(--bd);
    background: var(--sf);
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 8px 6px;
  }

  .thumb-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 3px;
    cursor: pointer;
    border-radius: var(--radius-sm);
    padding: 4px;
    transition: background var(--transition);
    border: 2px solid transparent;
    position: relative;
  }
  .thumb-item:hover { background: var(--sf2); }
  .thumb-item.active { border-color: var(--ac); background: var(--ac-bg); }
  .thumb-item.thumb-drag-over { border-color: var(--ac); border-style: dashed; }

  .thumb-drag-handle {
    position: absolute;
    top: 3px;
    left: 3px;
    color: var(--mu);
    opacity: 0;
    cursor: grab;
    transition: opacity var(--transition);
  }
  .thumb-item:hover .thumb-drag-handle { opacity: 1; }
  .thumb-drag-handle:active { cursor: grabbing; }

  .thumb-preview-wrap {
    width: 110px;
    aspect-ratio: 16 / 9;
    overflow: hidden;
    border-radius: 3px;
    border: 1px solid var(--bd);
    background: #fff;
    position: relative;
  }

  .thumb-preview-inner {
    width: 611px; /* 110 / 0.18 = ~611px */
    height: 344px; /* 611 * 9/16 */
    transform: scale(0.18);
    transform-origin: top left;
    padding: 12px 16px;
    font-size: 14px;
    line-height: 1.4;
    overflow: hidden;
    color: #1a1a1a;
    background: #fff;
    pointer-events: none;
  }

  .thumb-num {
    font-size: 0.65rem;
    color: var(--mu);
    font-weight: 600;
  }

  /* ── Main ── */
  .pres-main { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
  .pres-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; gap: 12px; }

  .pres-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 18px;
    border-bottom: 1px solid var(--bd);
    background: var(--sf);
    flex-shrink: 0;
    gap: 12px;
  }
  .pres-toolbar-left { flex: 1; min-width: 0; }
  .pres-toolbar-right { display: flex; align-items: center; gap: 6px; flex-shrink: 0; flex-wrap: wrap; }
  .pres-title { font-size: 1rem; font-weight: 700; margin: 0; cursor: text; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .pres-title:hover { color: var(--ac); }
  .pres-title-input { font-size: 1rem; font-weight: 700; border: none; border-bottom: 2px solid var(--ac); background: transparent; color: var(--tx); width: 100%; padding: 0; }
  .pres-title-input:focus { outline: none; }
  .save-ind { margin-right: 4px; }
  .theme-select { font-size: 0.78rem; border-radius: var(--radius-sm); padding: 4px 8px; width: auto; flex-shrink: 0; }
  .transition-select { font-size: 0.78rem; border-radius: var(--radius-sm); padding: 4px 8px; width: auto; flex-shrink: 0; }
  .enzo-e { font-family: var(--mono); font-weight: 700; font-size: 0.78rem; color: var(--enzo); }

  /* ── Templates popover ── */
  .templates-wrap { position: relative; }
  .templates-dropdown {
    position: absolute;
    top: calc(100% + 4px);
    right: 0;
    z-index: 500;
    width: 220px;
    padding: 8px;
    display: flex;
    flex-direction: column;
    gap: 2px;
    max-height: 360px;
    overflow-y: auto;
    box-shadow: var(--shadow);
  }
  .templates-hint {
    padding: 2px 6px 6px;
    border-bottom: 1px solid var(--bd);
    margin-bottom: 4px;
  }
  .template-item {
    padding: 6px 10px;
    border-radius: var(--radius-sm);
    font-size: 0.8rem;
    text-align: left;
    background: transparent;
    border: none;
    color: var(--tx);
    cursor: pointer;
    transition: background var(--transition);
  }
  .template-item:hover { background: var(--ac-bg); color: var(--ac); }
  .templates-backdrop { background: transparent; }

  /* ── Slide editor ── */
  .slides-editor { flex: 1; overflow-y: auto; padding: 20px 32px; display: flex; flex-direction: column; align-items: center; background: var(--sf2); }

  .slide-card {
    width: 100%;
    max-width: 800px;
    background: var(--bg);
    border: 1px solid var(--bd);
    border-radius: var(--radius);
    box-shadow: var(--shadow-sm);
    overflow: hidden;
    transition: box-shadow var(--transition), border-color var(--transition);
  }
  .slide-card:hover { box-shadow: var(--shadow); }
  .slide-card.drag-over { border-color: var(--ac); box-shadow: 0 0 0 2px var(--ac-bg); }

  .slide-card-header {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 7px 12px;
    border-bottom: 1px solid var(--bd);
    background: var(--sf);
  }
  .slide-drag-handle { cursor: grab; color: var(--mu); padding: 2px; }
  .slide-drag-handle:active { cursor: grabbing; }
  .slide-num { font-size: 0.72rem; font-weight: 600; color: var(--mu); letter-spacing: 0.05em; flex: 1; }
  .slide-del { opacity: 0.4; }
  .slide-del:hover:not(:disabled) { opacity: 1; color: var(--rd); background: var(--rd-bg); }
  .slide-del:disabled { opacity: 0.2; cursor: not-allowed; }

  /* Duplicate button */
  .slide-dup { opacity: 0.45; transition: opacity var(--transition); }
  .slide-dup:hover { opacity: 1; color: var(--ac); background: var(--ac-bg); }

  /* Enzo inline button */
  .slide-enzo-btn {
    width: 22px;
    height: 22px;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0.7;
    transition: opacity var(--transition), background var(--transition);
  }
  .slide-enzo-btn:hover:not(:disabled) { opacity: 1; background: #ede9fe; }
  .slide-enzo-btn:disabled { opacity: 0.4; cursor: not-allowed; }
  .enzo-e-purple {
    font-family: var(--mono);
    font-weight: 700;
    font-size: 0.78rem;
    color: #7c3aed;
  }
  .enzo-spinner {
    display: inline-block;
    width: 10px;
    height: 10px;
    border: 2px solid #7c3aed44;
    border-top-color: #7c3aed;
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  .slide-content-wrap { border-bottom: 1px solid var(--bd); user-select: text; -webkit-user-select: text; }
  :global(.slide-rich-editor) { border: none !important; border-radius: 0 !important; }
  :global(.slide-rich-editor .re-toolbar) { background: var(--sf) !important; }
  :global(.slide-rich-editor .re-content) { padding: 14px 18px !important; min-height: 160px; }

  .slide-notes-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 14px;
    background: var(--sf);
  }
  .notes-icon { color: var(--mu); flex-shrink: 0; }
  .slide-notes-input {
    flex: 1;
    border: none;
    background: transparent;
    font-size: 0.78rem;
    color: var(--tx2);
    font-family: var(--font);
  }
  .slide-notes-input:focus { outline: none; }
  .slide-notes-input::placeholder { color: var(--mu); }

  /* Add slide zone */
  .add-slide-zone { display: flex; justify-content: center; padding: 4px 0; width: 100%; max-width: 800px; }
  .add-slide-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: var(--sf);
    border: 1px dashed var(--bd2);
    color: var(--mu);
    cursor: pointer;
    transition: all var(--transition);
    opacity: 0.5;
  }
  .add-slide-btn:hover { opacity: 1; border-color: var(--ac); color: var(--ac); background: var(--ac-bg); }

  /* ── Present overlay ── */
  .present-overlay {
    position: fixed;
    inset: 0;
    z-index: 9000;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  .present-slide-wrap {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 60px 80px;
    overflow: hidden;
  }
  .present-content {
    max-width: 900px;
    width: 100%;
    font-size: clamp(1rem, 2.5vw, 1.6rem);
    line-height: 1.5;
  }
  :global(.present-content h1) { font-size: 2.2em; font-weight: 800; margin-bottom: 0.5em; color: var(--pac, inherit); }
  :global(.present-content h2) { font-size: 1.7em; font-weight: 700; margin-bottom: 0.5em; color: var(--pac, inherit); }
  :global(.present-content h3) { font-size: 1.3em; font-weight: 600; margin-bottom: 0.4em; }
  :global(.present-content ul, .present-content ol) { padding-left: 1.4em; }
  :global(.present-content li) { margin-bottom: 0.4em; }
  :global(.present-content p) { margin-bottom: 0.6em; opacity: 0.9; }

  .present-notes-bar {
    padding: 10px 40px;
    font-size: 0.85rem;
    border-top: 1px solid;
    opacity: 0.85;
    line-height: 1.5;
  }
  .present-notes-label { font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; margin-right: 10px; opacity: 0.6; }

  /* Next slide preview */
  .present-next-preview {
    position: absolute;
    bottom: 60px;
    right: 20px;
    width: 200px;
    border: 1px solid;
    border-radius: var(--radius-sm, 6px);
    overflow: hidden;
    padding: 6px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    backdrop-filter: blur(6px);
  }
  .present-next-label {
    font-size: 0.65rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    opacity: 0.7;
  }
  .present-next-thumb-wrap {
    width: 188px;
    aspect-ratio: 16 / 9;
    overflow: hidden;
    border-radius: 3px;
    background: #fff;
    position: relative;
  }
  .present-next-thumb-inner {
    width: 1044px; /* 188 / 0.18 */
    height: 588px;
    transform: scale(0.18);
    transform-origin: top left;
    padding: 12px 16px;
    font-size: 14px;
    line-height: 1.4;
    overflow: hidden;
    pointer-events: none;
  }

  .present-footer {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 24px;
    font-size: 0.82rem;
    flex-shrink: 0;
  }
  .present-nav-btn { background: none; border: none; font-size: 1.2rem; cursor: pointer; padding: 4px 8px; border-radius: 4px; transition: opacity var(--transition); }
  .present-nav-btn:disabled { opacity: 0.25; cursor: default; }
  .present-counter { font-size: 0.8rem; font-weight: 600; min-width: 60px; text-align: center; }
  .present-timer { font-size: 0.78rem; font-weight: 600; font-variant-numeric: tabular-nums; min-width: 44px; text-align: center; opacity: 0.75; }
  .present-hint { font-size: 0.72rem; opacity: 0.55; flex: 1; }
  .present-exit { background: none; border: none; cursor: pointer; font-size: 0.8rem; padding: 4px 8px; border-radius: 4px; transition: opacity var(--transition); }
  .present-exit:hover { opacity: 0.7; }

  .present-progress-bar { height: 3px; width: 100%; flex-shrink: 0; }
  .present-progress-fill { height: 100%; transition: width 0.3s ease; }

  /* ── Generate modal ── */
  .modal-backdrop { position: fixed; inset: 0; z-index: 8999; background: rgba(0,0,0,0.4); }
  .gen-modal {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: 9000;
    width: min(480px, 90vw);
    padding: 24px;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .gen-modal h3 { margin: 0; font-size: 1rem; }
  .gen-tabs { display: flex; gap: 4px; }
  .gen-tab { padding: 5px 12px; border-radius: var(--radius-sm); font-size: 0.8rem; font-weight: 500; background: transparent; border: 1px solid var(--bd); color: var(--mu); cursor: pointer; transition: all var(--transition); }
  .gen-tab.active { background: var(--ac-bg); color: var(--ac); border-color: var(--ac); }
  .gen-textarea { font-size: 0.87rem; resize: vertical; }
  .gen-select { font-size: 0.87rem; }
  .gen-count-row { display: flex; align-items: center; gap: 6px; }
  .count-chip { padding: 3px 10px; border-radius: 20px; font-size: 0.78rem; font-weight: 600; border: 1px solid var(--bd); background: transparent; color: var(--tx2); cursor: pointer; transition: all var(--transition); }
  .count-chip.active { background: var(--ac-bg); color: var(--ac); border-color: var(--ac); }
  .count-input { width: 56px; font-size: 0.82rem; padding: 3px 6px; text-align: center; }
  .gen-actions { display: flex; justify-content: flex-end; gap: 8px; }
  .gen-section-label { font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: var(--mu); margin-bottom: -6px; }
  .gen-source-count { font-weight: 400; text-transform: none; color: var(--ac); margin-left: 4px; }
  .gen-source-tabs { display: flex; gap: 4px; }
  .gen-source-tab { padding: 4px 10px; border-radius: var(--radius-sm); font-size: 0.78rem; background: transparent; border: 1px solid var(--bd); color: var(--mu); cursor: pointer; }
  .gen-source-tab.active { background: var(--ac-bg); color: var(--ac); border-color: var(--ac); }
  .gen-source-list { max-height: 140px; overflow-y: auto; display: flex; flex-direction: column; gap: 2px; border: 1px solid var(--bd); border-radius: var(--radius-sm); padding: 4px; }
  .source-item { display: flex; align-items: center; gap: 8px; padding: 4px 6px; border-radius: 4px; cursor: pointer; font-size: 0.8rem; }
  .source-item:hover { background: var(--hv); }
  .source-item.picked { background: var(--ac-bg); }
  .source-title { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--tx); }
  .source-meta { font-size: 0.7rem; color: var(--mu); flex-shrink: 0; }
  .gen-source-empty { font-size: 0.78rem; color: var(--mu); padding: 8px 6px; }

  /* Templates with Enzo fill */
  .template-row { display: flex; align-items: center; gap: 4px; }
  .template-item { flex: 1; text-align: left; padding: 6px 8px; border-radius: 4px; font-size: 0.82rem; color: var(--tx); background: transparent; border: none; cursor: pointer; transition: background var(--transition); }
  .template-item:hover { background: var(--hv); }
  .template-enzo-fill { flex-shrink: 0; width: 22px; height: 22px; border-radius: 4px; border: 1px solid var(--bd); background: transparent; color: var(--enzo); font-size: 0.78rem; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; }
  .template-enzo-fill:hover { background: var(--enzo)11; border-color: var(--enzo); }
  .template-enzo-fill:disabled { opacity: 0.4; cursor: default; }

  /* Source sidebar */
  .slides-editor-wrap { display: flex; flex: 1; overflow: hidden; }
  .source-sidebar {
    width: 230px; flex-shrink: 0;
    border-right: 1px solid var(--bd);
    background: var(--sf);
    display: flex; flex-direction: column;
  }
  .source-sidebar-header { display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; border-bottom: 1px solid var(--bd); flex-shrink: 0; }
  .source-sidebar-title { font-size: 0.78rem; font-weight: 600; color: var(--tx); }
  .source-sidebar-close { background: none; border: none; color: var(--mu); cursor: pointer; font-size: 1rem; line-height: 1; }
  .source-sidebar-body { flex: 1; overflow-y: auto; padding: 8px; display: flex; flex-direction: column; gap: 8px; }
  .source-group-label { font-size: 0.68rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em; color: var(--mu); padding: 4px 0 2px; display: flex; align-items: center; gap: 5px; }
  .layer-saved-badge { font-size: 0.63rem; font-weight: 400; text-transform: none; letter-spacing: 0; color: var(--mu); opacity: 0.7; }
  .source-entry { border: 1px solid var(--bd); border-radius: 5px; padding: 6px 8px; }
  .source-entry-title { font-size: 0.77rem; font-weight: 500; color: var(--tx); display: block; }
  .source-entry-snippet { font-size: 0.72rem; color: var(--mu); margin: 3px 0 0; line-height: 1.5; }
  /* Layer panel shared */
  .doc-layer-entry { padding: 8px 10px; }
  .doc-layer-text { font-size: 0.72rem; color: var(--tx); line-height: 1.65; margin: 0; white-space: pre-wrap; }
  .brief-cursor { display: inline-block; color: var(--ac); animation: blink 1s step-end infinite; }
  @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
  /* Layer 1 — brief: blue tint */
  .doc-layer-brief { background: color-mix(in srgb, var(--ac) 7%, transparent); border-left: 3px solid var(--ac); border-color: color-mix(in srgb, var(--ac) 22%, transparent); border-left-color: var(--ac); }
  .layer-label-brief { color: var(--ac); }
  /* Layer 3 — outline: green tint */
  .doc-layer-outline { background: color-mix(in srgb, #22c55e 7%, transparent); border-left: 3px solid #22c55e; border-color: color-mix(in srgb, #22c55e 22%, transparent); border-left-color: #22c55e; }
  .layer-label-outline { color: #16a34a; }
  /* Layer 4 — concepts: amber tint */
  .doc-layer-concepts { background: color-mix(in srgb, #f59e0b 7%, transparent); border-left: 3px solid #f59e0b; border-color: color-mix(in srgb, #f59e0b 22%, transparent); border-left-color: #f59e0b; }
  .layer-label-concepts { color: #b45309; }
  /* Layer 2 — slide list: neutral */
  .doc-layer-slides { background: color-mix(in srgb, var(--mu) 6%, transparent); border-left: 3px solid var(--mu); border-color: color-mix(in srgb, var(--mu) 20%, transparent); border-left-color: var(--mu); padding: 6px 8px; }
  .layer-label-slides { color: var(--mu); }
  .slide-title-item { font-size: 0.71rem; color: var(--tx); margin: 2px 0; display: flex; gap: 6px; line-height: 1.4; }
  .slide-num { color: var(--mu); font-variant-numeric: tabular-nums; min-width: 18px; flex-shrink: 0; }
  .sidebar-divider { border: none; border-top: 1px solid var(--bd); margin: 4px 0; }

  /* Citation strip in slides */
  :global(.slide-rich-editor .cite-strip) {
    font-size: 0.65em; color: var(--mu); margin-top: 0.8em;
    padding-top: 0.4em; border-top: 1px solid rgba(128,128,128,0.2);
  }
</style>
