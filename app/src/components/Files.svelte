<script lang="ts">
  import { store } from '../lib/store.svelte';
  import { nanoid } from 'nanoid';
  import type { FileRecord } from '../lib/types';

  let { showToast }: { showToast: (msg: string, type?: 'success' | 'error') => void } = $props();

  // ── State ─────────────────────────────────────────────────────
  let search       = $state('');
  let activeTag    = $state('');
  let viewMode     = $state<'list' | 'grid'>('list');
  let selectedId   = $state<string | null>(null);
  let uploading    = $state(false);
  let fileInput    = $state<HTMLInputElement | undefined>(undefined);
  let viewerUrl    = $state<string | null>(null);
  let viewerText   = $state<string | null>(null);
  let viewerTable  = $state<string[][] | null>(null);
  let linkNoteOpen = $state(false);
  let linkRunOpen  = $state(false);
  let addTagDraft  = $state('');
  let addExtUrl    = $state(false);
  let extUrlDraft  = $state('');
  let extNameDraft = $state('');

  const selectedFile = $derived(store.files.find(f => f.id === selectedId) ?? null);

  const allTags = $derived([...new Set(store.files.flatMap(f => f.tags))].sort());

  const filtered = $derived(
    store.files
      .filter(f => {
        const q = search.toLowerCase();
        const matchQ = !q || f.name.toLowerCase().includes(q) || f.description.toLowerCase().includes(q) || f.tags.some(t => t.includes(q));
        const matchT = !activeTag || f.tags.includes(activeTag);
        return matchQ && matchT;
      })
      .sort((a, b) => b.createdAt - a.createdAt)
  );

  // ── Upload ────────────────────────────────────────────────────
  function triggerUpload() { fileInput?.click(); }

  async function handleFiles(e: Event) {
    const files = (e.target as HTMLInputElement).files;
    if (!files || files.length === 0) return;
    uploading = true;
    try {
      const records: FileRecord[] = [];
      for (const file of Array.from(files)) {
        const base64 = await readAsBase64(file);
        records.push({
          id: nanoid(),
          name: file.name,
          mimeType: file.type || guessMime(file.name),
          size: file.size,
          data: base64,
          tags: [],
          linkedNoteIds: [],
          linkedRunIds: [],
          description: '',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      }
      store.files = [...records, ...store.files];
      await store.saveFiles();
      showToast(`${records.length} file${records.length > 1 ? 's' : ''} uploaded`);
      selectedId = records[0].id;
    } catch (err) {
      showToast('Upload failed: ' + (err as Error).message, 'error');
    } finally {
      uploading = false;
      if (fileInput) fileInput.value = '';
    }
  }

  function readAsBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(',')[1]); // strip data-url prefix
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function guessMime(name: string): string {
    const ext = name.split('.').pop()?.toLowerCase() ?? '';
    const map: Record<string, string> = {
      pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
      gif: 'image/gif', svg: 'image/svg+xml', webp: 'image/webp',
      csv: 'text/csv', tsv: 'text/tab-separated-values',
      txt: 'text/plain', md: 'text/markdown',
      r: 'text/x-r', py: 'text/x-python', sh: 'text/x-shellscript',
      js: 'text/javascript', ts: 'text/typescript', json: 'application/json',
      html: 'text/html', xml: 'application/xml',
    };
    return map[ext] ?? 'application/octet-stream';
  }

  async function addExternalLink() {
    if (!extUrlDraft.trim() || !extNameDraft.trim()) return;
    const rec: FileRecord = {
      id: nanoid(), name: extNameDraft.trim(), mimeType: guessMime(extNameDraft),
      size: 0, url: extUrlDraft.trim(), tags: [], linkedNoteIds: [], linkedRunIds: [],
      description: '', createdAt: Date.now(), updatedAt: Date.now(),
    };
    store.files = [rec, ...store.files];
    await store.saveFiles();
    selectedId = rec.id;
    extUrlDraft = ''; extNameDraft = ''; addExtUrl = false;
    showToast('External link added');
  }

  // ── Viewer ────────────────────────────────────────────────────
  $effect(() => {
    // Revoke previous URL
    if (viewerUrl) { URL.revokeObjectURL(viewerUrl); viewerUrl = null; }
    viewerText = null; viewerTable = null;
    if (!selectedFile) return;

    if (selectedFile.url) {
      viewerUrl = selectedFile.url; // external link — open directly
      return;
    }
    if (!selectedFile.data) return;

    const mime = selectedFile.mimeType;
    const bytes = atob(selectedFile.data);
    const arr   = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
    const blob  = new Blob([arr], { type: mime });

    if (mime.startsWith('image/') || mime === 'application/pdf') {
      viewerUrl = URL.createObjectURL(blob);
    } else if (mime.startsWith('text/') || isCodeMime(mime) || mime === 'application/json') {
      const text = new TextDecoder().decode(arr);
      if (mime === 'text/csv' || mime === 'text/tab-separated-values') {
        const sep = mime === 'text/tab-separated-values' ? '\t' : ',';
        viewerTable = text.split('\n').filter(Boolean).map(row => row.split(sep));
      } else {
        viewerText = text;
      }
    }
  });

  function isCodeMime(m: string) {
    return ['text/x-r','text/x-python','text/x-shellscript','text/javascript','text/typescript','application/json','text/markdown','text/html','application/xml'].includes(m);
  }

  // ── File ops ──────────────────────────────────────────────────
  async function deleteFile(id: string) {
    if (!confirm('Delete this file? This cannot be undone.')) return;
    store.files = store.files.filter(f => f.id !== id);
    if (selectedId === id) selectedId = null;
    await store.saveFiles();
    showToast('File deleted');
  }

  async function saveFile() {
    store.files = [...store.files];
    await store.saveFiles();
  }

  function addTag() {
    if (!selectedFile || !addTagDraft.trim()) return;
    const tag = addTagDraft.trim().toLowerCase();
    if (!selectedFile.tags.includes(tag)) {
      selectedFile.tags = [...selectedFile.tags, tag];
      saveFile();
    }
    addTagDraft = '';
  }

  function removeTag(tag: string) {
    if (!selectedFile) return;
    selectedFile.tags = selectedFile.tags.filter(t => t !== tag);
    saveFile();
  }

  function linkNote(noteId: string) {
    if (!selectedFile || selectedFile.linkedNoteIds.includes(noteId)) return;
    selectedFile.linkedNoteIds = [...selectedFile.linkedNoteIds, noteId];
    saveFile(); linkNoteOpen = false;
  }

  function unlinkNote(noteId: string) {
    if (!selectedFile) return;
    selectedFile.linkedNoteIds = selectedFile.linkedNoteIds.filter(id => id !== noteId);
    saveFile();
  }

  function linkRun(runId: string) {
    if (!selectedFile || selectedFile.linkedRunIds.includes(runId)) return;
    selectedFile.linkedRunIds = [...selectedFile.linkedRunIds, runId];
    saveFile(); linkRunOpen = false;
  }

  function unlinkRun(runId: string) {
    if (!selectedFile) return;
    selectedFile.linkedRunIds = selectedFile.linkedRunIds.filter(id => id !== runId);
    saveFile();
  }

  function downloadFile(f: FileRecord) {
    if (f.url) { window.open(f.url, '_blank'); return; }
    if (!f.data) return;
    const bytes = atob(f.data);
    const arr   = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
    const blob  = new Blob([arr], { type: f.mimeType });
    const url   = URL.createObjectURL(blob);
    const a     = Object.assign(document.createElement('a'), { href: url, download: f.name });
    a.click(); URL.revokeObjectURL(url);
  }

  // ── Helpers ───────────────────────────────────────────────────
  function fmtSize(b: number): string {
    if (b === 0) return '—';
    if (b < 1024) return `${b} B`;
    if (b < 1048576) return `${(b/1024).toFixed(1)} KB`;
    return `${(b/1048576).toFixed(1)} MB`;
  }

  function fmtDate(ts: number) {
    return new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function fileCategory(mime: string): 'pdf' | 'image' | 'code' | 'data' | 'link' | 'other' {
    if (mime === 'application/pdf') return 'pdf';
    if (mime.startsWith('image/')) return 'image';
    if (['text/csv','text/tab-separated-values'].includes(mime)) return 'data';
    if (isCodeMime(mime) || mime.startsWith('text/x-')) return 'code';
    return 'other';
  }

  const CAT_COLORS: Record<string, string> = {
    pdf: 'var(--rd)', image: 'var(--gn)', code: 'var(--ac)', data: 'var(--yw)', link: 'var(--enzo)', other: 'var(--mu)',
  };
  const CAT_LABELS: Record<string, string> = {
    pdf: 'PDF', image: 'Image', code: 'Code', data: 'Data', link: 'Link', other: 'File',
  };
</script>

<input type="file" multiple bind:this={fileInput} onchange={handleFiles} style="display:none" />

<div class="files-shell">
  <!-- ── Left panel ── -->
  <aside class="files-sidebar">
    <div class="files-sidebar-head">
      <span class="section-label">Files</span>
      <span class="file-count text-xs text-mu">{store.files.length}</span>
    </div>

    <!-- Tag filter -->
    {#if allTags.length > 0}
      <div class="tag-filter">
        <button class="tag-pill" class:active={!activeTag} onclick={() => activeTag = ''}>All</button>
        {#each allTags as tag}
          <button class="tag-pill" class:active={activeTag === tag} onclick={() => activeTag = tag}>{tag}</button>
        {/each}
      </div>
    {/if}

    <!-- File type filter shorthand -->
    <div class="type-filter">
      {#each ['pdf','image','code','data'] as cat}
        <span class="type-dot" style="background:{CAT_COLORS[cat]}" title={CAT_LABELS[cat]}></span>
        <span class="type-label">{CAT_LABELS[cat]}</span>
      {/each}
    </div>
  </aside>

  <!-- ── Main area ── -->
  <div class="files-main">
    <!-- Top bar -->
    <div class="files-topbar">
      <input type="search" bind:value={search} placeholder="Search files…" class="files-search" />
      <div class="files-topbar-right">
        <button class="btn-icon" class:active={viewMode==='list'} onclick={() => viewMode='list'} title="List view">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
        </button>
        <button class="btn-icon" class:active={viewMode==='grid'} onclick={() => viewMode='grid'} title="Grid view">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
        </button>
        <div class="upload-actions">
          <button class="btn btn-ghost btn-sm" onclick={() => addExtUrl = !addExtUrl} title="Add external link">+ Link</button>
          <button class="btn btn-primary btn-sm" onclick={triggerUpload} disabled={uploading}>
            {uploading ? 'Uploading…' : '+ Upload'}
          </button>
        </div>
      </div>
    </div>

    <!-- External link form -->
    {#if addExtUrl}
      <div class="ext-url-form card">
        <input type="text" bind:value={extNameDraft} placeholder="File name (e.g. paper.pdf)" class="form-input" />
        <input type="url" bind:value={extUrlDraft} placeholder="https://…" class="form-input" />
        <div class="ext-url-actions">
          <button class="btn btn-ghost btn-sm" onclick={() => addExtUrl = false}>Cancel</button>
          <button class="btn btn-primary btn-sm" onclick={addExternalLink} disabled={!extUrlDraft.trim() || !extNameDraft.trim()}>Add link</button>
        </div>
      </div>
    {/if}

    <!-- File list / grid -->
    <div class="files-content">
      <div class="files-{viewMode}">
        {#each filtered as f (f.id)}
          {@const cat = f.url ? 'link' : fileCategory(f.mimeType)}
          <div
            class="file-item file-{viewMode}-item"
            class:selected={selectedId === f.id}
            onclick={() => selectedId = selectedId === f.id ? null : f.id}
          >
            <div class="file-icon" style="color:{CAT_COLORS[cat]}">
              {#if cat === 'pdf'}
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="15" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
              {:else if cat === 'image'}
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
              {:else if cat === 'code'}
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
              {:else if cat === 'data'}
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
              {:else if cat === 'link'}
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>
              {:else}
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              {/if}
            </div>
            <div class="file-info">
              <span class="file-name">{f.name}</span>
              <span class="file-meta text-xs text-mu">
                {CAT_LABELS[cat]} · {fmtSize(f.size)} · {fmtDate(f.createdAt)}
              </span>
              {#if f.tags.length > 0}
                <div class="file-tags">
                  {#each f.tags as tag}<span class="file-tag">{tag}</span>{/each}
                </div>
              {/if}
              {#if f.linkedNoteIds.length > 0}
                <span class="file-link-badge">
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                  {f.linkedNoteIds.length} note{f.linkedNoteIds.length > 1 ? 's' : ''}
                </span>
              {/if}
            </div>
            <div class="file-actions">
              <button class="btn-icon file-action" onclick={(e) => { e.stopPropagation(); downloadFile(f); }} title="Download">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              </button>
              <button class="btn-icon file-action danger" onclick={(e) => { e.stopPropagation(); deleteFile(f.id); }} title="Delete">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6m5 0V4h4v2"/></svg>
              </button>
            </div>
          </div>
        {:else}
          <div class="files-empty">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" opacity="0.25"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            <p class="text-mu text-sm">No files yet — upload one or add an external link.</p>
          </div>
        {/each}
      </div>

      <!-- ── Detail / Viewer panel ── -->
      {#if selectedFile}
        <div class="file-detail">
          <div class="file-detail-head">
            <div>
              <p class="file-detail-name">{selectedFile.name}</p>
              <p class="text-xs text-mu">{fmtSize(selectedFile.size)} · {fmtDate(selectedFile.createdAt)}</p>
            </div>
            <div style="display:flex;gap:4px">
              <button class="btn btn-ghost btn-sm" onclick={() => downloadFile(selectedFile!)}>
                {selectedFile.url ? 'Open link' : 'Download'}
              </button>
              <button class="btn-icon" onclick={() => selectedId = null}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
          </div>

          <!-- Viewer -->
          <div class="file-viewer">
            {#if selectedFile.url}
              <div class="viewer-link-box">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="color:var(--ac)"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>
                <a href={selectedFile.url} target="_blank" rel="noopener noreferrer" class="viewer-link">{selectedFile.url}</a>
              </div>
            {:else if selectedFile.mimeType.startsWith('image/') && viewerUrl}
              <img src={viewerUrl} alt={selectedFile.name} class="viewer-image" />
            {:else if selectedFile.mimeType === 'application/pdf' && viewerUrl}
              <iframe src={viewerUrl} class="viewer-pdf" title={selectedFile.name}></iframe>
            {:else if viewerTable}
              <div class="viewer-table-wrap">
                <table class="viewer-table">
                  {#each viewerTable as row, ri}
                    {#if ri === 0}
                      <thead><tr>{#each row as cell}<th>{cell}</th>{/each}</tr></thead>
                    {:else if ri === 1}
                      <tbody><tr>{#each row as cell}<td>{cell}</td>{/each}</tr></tbody>
                    {:else}
                      <tr>{#each row as cell}<td>{cell}</td>{/each}</tr>
                    {/if}
                  {/each}
                </table>
              </div>
            {:else if viewerText !== null}
              <pre class="viewer-code">{viewerText.slice(0, 8000)}{viewerText.length > 8000 ? '\n…(truncated)' : ''}</pre>
            {:else}
              <div class="viewer-no-preview">
                <p class="text-mu text-sm">No preview available.</p>
                <button class="btn btn-ghost btn-sm" onclick={() => downloadFile(selectedFile!)}>Download to open</button>
              </div>
            {/if}
          </div>

          <!-- Metadata -->
          <div class="file-meta-panel">
            <!-- Description -->
            <div class="meta-section">
              <label class="meta-label">Description</label>
              <input
                type="text"
                class="meta-input"
                value={selectedFile.description}
                oninput={(e) => { selectedFile!.description = (e.target as HTMLInputElement).value; saveFile(); }}
                placeholder="Brief description…"
              />
            </div>

            <!-- Tags -->
            <div class="meta-section">
              <label class="meta-label">Tags</label>
              <div class="meta-tags">
                {#each selectedFile.tags as tag}
                  <span class="file-tag removable">{tag}<button onclick={() => removeTag(tag)}>×</button></span>
                {/each}
                <input
                  type="text"
                  class="tag-add-input"
                  bind:value={addTagDraft}
                  placeholder="Add tag…"
                  onkeydown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(); } }}
                />
              </div>
            </div>

            <!-- Linked notes -->
            <div class="meta-section">
              <div class="meta-label-row">
                <label class="meta-label">Linked notes</label>
                <button class="btn-link text-xs" onclick={() => { linkNoteOpen = !linkNoteOpen; linkRunOpen = false; }}>+ Link</button>
              </div>
              {#if linkNoteOpen}
                <select class="meta-select" onchange={(e) => { linkNote((e.target as HTMLSelectElement).value); (e.target as HTMLSelectElement).value = ''; }}>
                  <option value="">Select note…</option>
                  {#each store.notes.filter(n => !n.archived && !selectedFile!.linkedNoteIds.includes(n.id)) as n}
                    <option value={n.id}>{n.title}</option>
                  {/each}
                </select>
              {/if}
              {#each selectedFile.linkedNoteIds as nid}
                {@const n = store.notes.find(x => x.id === nid)}
                {#if n}
                  <div class="linked-item">
                    <span class="linked-title">{n.title}</span>
                    <button class="btn-link text-xs" onclick={() => { store.currentNoteId = nid; store.view = 'notes'; }}>Open</button>
                    <button class="btn-icon link-remove" onclick={() => unlinkNote(nid)}>×</button>
                  </div>
                {/if}
              {/each}
            </div>

            <!-- Linked runs -->
            <div class="meta-section">
              <div class="meta-label-row">
                <label class="meta-label">Linked pipeline runs</label>
                <button class="btn-link text-xs" onclick={() => { linkRunOpen = !linkRunOpen; linkNoteOpen = false; }}>+ Link</button>
              </div>
              {#if linkRunOpen}
                <select class="meta-select" onchange={(e) => { linkRun((e.target as HTMLSelectElement).value); (e.target as HTMLSelectElement).value = ''; }}>
                  <option value="">Select run…</option>
                  {#each store.pipelineRuns.filter(r => !selectedFile!.linkedRunIds.includes(r.id)) as r}
                    <option value={r.id}>{r.title}</option>
                  {/each}
                </select>
              {/if}
              {#each selectedFile.linkedRunIds as rid}
                {@const r = store.pipelineRuns.find(x => x.id === rid)}
                {#if r}
                  <div class="linked-item">
                    <span class="linked-title">{r.title}</span>
                    <button class="btn-icon link-remove" onclick={() => unlinkRun(rid)}>×</button>
                  </div>
                {/if}
              {/each}
            </div>
          </div>
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  .files-shell { display: flex; height: 100%; overflow: hidden; }

  /* ── Sidebar ── */
  .files-sidebar {
    width: 160px;
    flex-shrink: 0;
    border-right: 1px solid var(--bd);
    background: var(--sf);
    display: flex;
    flex-direction: column;
    padding: 12px 8px;
    gap: 12px;
    overflow-y: auto;
  }
  .files-sidebar-head { display: flex; align-items: center; justify-content: space-between; padding: 0 4px; }
  .section-label { font-size: 0.68rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: var(--mu); }
  .file-count { background: var(--ac-bg); color: var(--ac); padding: 1px 7px; border-radius: 10px; font-weight: 600; }
  .tag-filter { display: flex; flex-direction: column; gap: 2px; }
  .tag-pill { padding: 4px 8px; border-radius: var(--radius-sm); font-size: 0.75rem; background: transparent; border: none; color: var(--tx2); text-align: left; cursor: pointer; transition: background var(--transition); }
  .tag-pill:hover { background: var(--sf2); }
  .tag-pill.active { background: var(--ac-bg); color: var(--ac); font-weight: 600; }
  .type-filter { display: flex; flex-direction: column; gap: 4px; padding: 0 4px; border-top: 1px solid var(--bd); padding-top: 10px; }
  .type-dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; margin-right: 6px; }
  .type-label { font-size: 0.72rem; color: var(--mu); }

  /* ── Main ── */
  .files-main { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
  .files-topbar { display: flex; align-items: center; gap: 8px; padding: 10px 16px; border-bottom: 1px solid var(--bd); background: var(--sf); flex-shrink: 0; }
  .files-search { flex: 1; font-size: 0.85rem; }
  .files-topbar-right { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
  .upload-actions { display: flex; gap: 4px; }

  .ext-url-form { margin: 8px 16px; padding: 12px; display: flex; flex-direction: column; gap: 8px; }
  .ext-url-actions { display: flex; justify-content: flex-end; gap: 6px; }

  .files-content { flex: 1; overflow: hidden; display: flex; }

  /* List view */
  .files-list { flex: 1; overflow-y: auto; display: flex; flex-direction: column; }
  .file-list-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 9px 16px;
    border-bottom: 1px solid var(--bd);
    cursor: pointer;
    transition: background var(--transition);
  }
  .file-list-item:hover { background: var(--sf); }
  .file-list-item.selected { background: var(--ac-bg); }

  /* Grid view */
  .files-grid { flex: 1; overflow-y: auto; display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 10px; padding: 12px; align-content: start; }
  .file-grid-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    padding: 16px 10px 10px;
    border: 1px solid var(--bd);
    border-radius: var(--radius);
    background: var(--sf);
    cursor: pointer;
    transition: background var(--transition), border-color var(--transition);
    text-align: center;
  }
  .file-grid-item:hover { background: var(--sf2); }
  .file-grid-item.selected { border-color: var(--ac); background: var(--ac-bg); }

  .file-icon { flex-shrink: 0; }
  .file-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
  .file-name { font-size: 0.83rem; font-weight: 500; color: var(--tx); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .file-grid-item .file-name { white-space: normal; word-break: break-word; font-size: 0.78rem; }
  .file-tags { display: flex; flex-wrap: wrap; gap: 3px; margin-top: 2px; }
  .file-tag { font-size: 0.68rem; padding: 1px 6px; background: var(--sf2); color: var(--tx2); border-radius: 8px; }
  .file-tag.removable { display: inline-flex; align-items: center; gap: 3px; }
  .file-tag.removable button { background: none; border: none; cursor: pointer; color: var(--mu); font-size: 12px; line-height: 1; padding: 0; }
  .file-link-badge { font-size: 0.68rem; color: var(--ac); display: inline-flex; align-items: center; gap: 3px; }
  .file-actions { display: flex; gap: 2px; opacity: 0; transition: opacity var(--transition); flex-shrink: 0; }
  .file-list-item:hover .file-actions, .file-grid-item:hover .file-actions { opacity: 1; }
  .file-action { width: 26px; height: 26px; border-radius: 4px; }
  .file-action.danger:hover { color: var(--rd); background: var(--rd-bg); }

  .files-empty { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; padding: 40px; }

  /* ── Detail panel ── */
  .file-detail {
    width: 320px;
    flex-shrink: 0;
    border-left: 1px solid var(--bd);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: var(--bg);
  }
  .file-detail-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; padding: 12px 14px; border-bottom: 1px solid var(--bd); flex-shrink: 0; }
  .file-detail-name { font-size: 0.85rem; font-weight: 600; color: var(--tx); word-break: break-word; }

  .file-viewer { flex-shrink: 0; border-bottom: 1px solid var(--bd); overflow: hidden; height: 220px; display: flex; align-items: center; justify-content: center; background: var(--sf2); }
  .viewer-image { max-width: 100%; max-height: 100%; object-fit: contain; }
  .viewer-pdf { width: 100%; height: 100%; border: none; }
  .viewer-code { font-family: var(--mono); font-size: 0.72rem; padding: 10px; overflow: auto; width: 100%; height: 100%; margin: 0; white-space: pre; color: var(--tx2); }
  .viewer-table-wrap { overflow: auto; width: 100%; height: 100%; }
  .viewer-table { font-size: 0.72rem; border-collapse: collapse; width: 100%; }
  .viewer-table th, .viewer-table td { border: 1px solid var(--bd); padding: 3px 8px; white-space: nowrap; }
  .viewer-table th { background: var(--sf); font-weight: 600; }
  .viewer-link-box { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 20px; text-align: center; }
  .viewer-link { font-size: 0.78rem; color: var(--ac); word-break: break-all; }
  .viewer-no-preview { display: flex; flex-direction: column; align-items: center; gap: 8px; }

  .file-meta-panel { flex: 1; overflow-y: auto; padding: 12px 14px; display: flex; flex-direction: column; gap: 14px; }
  .meta-section { display: flex; flex-direction: column; gap: 5px; }
  .meta-label { font-size: 0.68rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: var(--mu); }
  .meta-label-row { display: flex; align-items: center; justify-content: space-between; }
  .meta-input { font-size: 0.82rem; padding: 5px 8px; }
  .meta-tags { display: flex; flex-wrap: wrap; gap: 4px; align-items: center; }
  .tag-add-input { border: none; background: transparent; font-size: 0.78rem; color: var(--tx2); width: 90px; }
  .tag-add-input:focus { outline: none; }
  .meta-select { font-size: 0.8rem; width: 100%; }
  .linked-item { display: flex; align-items: center; gap: 6px; padding: 3px 0; }
  .linked-title { font-size: 0.8rem; flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .link-remove { width: 18px; height: 18px; border-radius: 3px; font-size: 13px; display: flex; align-items: center; justify-content: center; }
  .link-remove:hover { background: var(--rd-bg); color: var(--rd); }
  .btn-link { background: none; border: none; cursor: pointer; color: var(--ac); font-size: 0.75rem; padding: 0; }
  .btn-link:hover { text-decoration: underline; }
</style>
