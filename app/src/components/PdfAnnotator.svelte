<script lang="ts">
  import { onMount, onDestroy } from 'svelte';

  let {
    url,
    onInsert,
    onClose,
  }: {
    url: string;
    onInsert: (text: string, type: string, page: number) => void;
    onClose: () => void;
  } = $props();

  let canvas: HTMLCanvasElement;
  let currentPage = $state(1);
  let totalPages  = $state(0);
  let loading     = $state(true);
  let error       = $state('');
  let annotText   = $state('');
  let annotType   = $state('info');
  let pdfDoc: any = null;
  let renderTask: any = null;

  const TYPES = [
    { id: 'info',       label: 'Note',        color: 'var(--ac)' },
    { id: 'hypothesis', label: 'Hypothesis',   color: 'var(--pu)' },
    { id: 'result',     label: 'Result',       color: 'var(--gn)' },
    { id: 'warning',    label: 'Flag',         color: 'var(--yw)' },
    { id: 'important',  label: 'Important',    color: 'var(--rd)' },
  ];

  async function init() {
    try {
      const pdfjsLib = await import('pdfjs-dist');
      pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
        'pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url
      ).href;
      pdfDoc = await pdfjsLib.getDocument(url).promise;
      totalPages = pdfDoc.numPages;
      loading = false;
      await renderPage(1);
    } catch (e: any) {
      loading = false;
      error = e?.message ?? 'Failed to load PDF';
    }
  }

  async function renderPage(num: number) {
    if (!pdfDoc || !canvas) return;
    if (renderTask) { renderTask.cancel?.(); }
    const page = await pdfDoc.getPage(num);
    const vp   = page.getViewport({ scale: 1.4 });
    canvas.width  = vp.width;
    canvas.height = vp.height;
    const ctx = canvas.getContext('2d')!;
    renderTask = page.render({ canvasContext: ctx, viewport: vp });
    await renderTask.promise.catch(() => {});
  }

  async function goPage(delta: number) {
    const next = currentPage + delta;
    if (next < 1 || next > totalPages) return;
    currentPage = next;
    await renderPage(currentPage);
  }

  function insert() {
    if (!annotText.trim()) return;
    onInsert(annotText.trim(), annotType, currentPage);
    annotText = '';
  }

  onMount(() => { init(); });
  onDestroy(() => { renderTask?.cancel?.(); pdfDoc?.destroy?.(); });
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="pa-overlay">
  <div class="pa-header">
    <span class="pa-title">PDF Annotator</span>
    <span class="pa-url">{url.split('/').pop()?.split('?')[0] ?? 'PDF'}</span>
    <button class="pa-close" onclick={onClose} title="Close">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
    </button>
  </div>

  <div class="pa-body">
    <!-- Left: PDF viewer -->
    <div class="pa-viewer">
      {#if loading}
        <div class="pa-loading">
          <span class="pa-spin"></span>
          Loading PDF…
        </div>
      {:else if error}
        <div class="pa-error">{error}</div>
      {:else}
        <div class="pa-canvas-wrap">
          <canvas bind:this={canvas}></canvas>
        </div>
        <div class="pa-pager">
          <button class="pa-page-btn" onclick={() => goPage(-1)} disabled={currentPage <= 1}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <span class="pa-page-info">Page {currentPage} of {totalPages}</span>
          <button class="pa-page-btn" onclick={() => goPage(1)} disabled={currentPage >= totalPages}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        </div>
      {/if}
    </div>

    <!-- Right: Annotation panel -->
    <div class="pa-panel">
      <div class="pa-panel-head">Annotate — Page {currentPage}</div>

      <!-- Type selector -->
      <div class="pa-type-row">
        {#each TYPES as t}
          <button
            class="pa-type-btn"
            class:pa-type-active={annotType === t.id}
            style="--tc:{t.color}"
            onclick={() => annotType = t.id}
          >{t.label}</button>
        {/each}
      </div>

      <textarea
        class="pa-textarea"
        placeholder="Write your annotation for this page section…"
        bind:value={annotText}
        onkeydown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); insert(); } }}
      ></textarea>
      <p class="pa-kbd-hint">Ctrl+Enter to insert</p>

      <button class="btn btn-primary pa-insert-btn" onclick={insert} disabled={!annotText.trim()}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 5v14M5 12l7 7 7-7"/></svg>
        Insert into note
      </button>

      <div class="pa-divider"></div>
      <p class="pa-tip">Annotations are inserted as callout blocks at the cursor position in your note.</p>
    </div>
  </div>
</div>

<style>
  .pa-overlay {
    position: fixed; inset: 0; z-index: 450;
    background: var(--bg);
    display: flex; flex-direction: column;
    animation: pa-in 0.15s ease;
  }
  @keyframes pa-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }

  .pa-header {
    display: flex; align-items: center; gap: 10px;
    padding: 10px 18px; border-bottom: 1px solid var(--bd);
    background: var(--sf); flex-shrink: 0;
  }
  .pa-title { font-size: 0.88rem; font-weight: 700; color: var(--tx); }
  .pa-url   { font-size: 0.75rem; color: var(--mu); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; }
  .pa-close {
    background: transparent; border: none; color: var(--mu);
    cursor: pointer; display: flex; padding: 4px;
  }
  .pa-close:hover { color: var(--tx); }

  .pa-body { flex: 1; display: flex; overflow: hidden; }

  /* Viewer */
  .pa-viewer {
    flex: 1; overflow: auto; background: #333;
    display: flex; flex-direction: column; align-items: center;
    padding: 16px 0 0;
  }
  .pa-canvas-wrap { box-shadow: 0 4px 20px rgba(0,0,0,0.4); }
  .pa-canvas-wrap canvas { display: block; max-width: 100%; }
  .pa-loading {
    display: flex; align-items: center; gap: 10px;
    color: #ccc; font-size: 0.88rem; margin-top: 40px;
  }
  .pa-spin {
    width: 18px; height: 18px; border-radius: 50%;
    border: 2px solid rgba(255,255,255,0.2); border-top-color: #fff;
    animation: spin 0.8s linear infinite; flex-shrink: 0;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
  .pa-error { color: var(--rd); font-size: 0.84rem; margin-top: 40px; }
  .pa-pager {
    display: flex; align-items: center; gap: 10px;
    padding: 10px; color: #ccc; font-size: 0.82rem;
  }
  .pa-page-btn {
    background: rgba(255,255,255,0.1); border: none; color: #ccc;
    border-radius: 4px; cursor: pointer; display: flex; padding: 4px;
  }
  .pa-page-btn:hover:not(:disabled) { background: rgba(255,255,255,0.2); color: #fff; }
  .pa-page-btn:disabled { opacity: 0.35; cursor: default; }
  .pa-page-info { font-size: 0.8rem; min-width: 100px; text-align: center; }

  /* Annotation panel */
  .pa-panel {
    width: 300px; flex-shrink: 0; border-left: 1px solid var(--bd);
    background: var(--sf); display: flex; flex-direction: column; padding: 16px;
    overflow-y: auto;
  }
  .pa-panel-head { font-size: 0.78rem; font-weight: 700; color: var(--tx); margin-bottom: 12px; }

  .pa-type-row { display: flex; flex-wrap: wrap; gap: 5px; margin-bottom: 12px; }
  .pa-type-btn {
    padding: 3px 9px; border-radius: 20px; font-size: 0.74rem; font-weight: 500;
    background: transparent; border: 1px solid var(--tc, var(--bd)); color: var(--tc, var(--mu));
    cursor: pointer; transition: background 0.1s;
  }
  .pa-type-active { background: color-mix(in srgb, var(--tc, var(--ac)) 15%, transparent); }

  .pa-textarea {
    flex: 0 0 auto; height: 160px; resize: vertical;
    font-size: 0.84rem; padding: 10px 12px;
    border: 1px solid var(--bd); border-radius: var(--radius-sm);
    background: var(--bg); color: var(--tx); margin-bottom: 4px;
    font-family: var(--font); line-height: 1.55;
  }
  .pa-textarea:focus { border-color: var(--ac); outline: none; }
  .pa-kbd-hint { font-size: 0.68rem; color: var(--mu); margin-bottom: 10px; }

  .pa-insert-btn { width: 100%; justify-content: center; gap: 6px; }

  .pa-divider { border: none; border-top: 1px solid var(--bd); margin: 16px 0; }
  .pa-tip { font-size: 0.72rem; color: var(--mu); line-height: 1.5; }
</style>
