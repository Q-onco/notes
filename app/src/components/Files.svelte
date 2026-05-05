<script lang="ts">
  import { store } from '../lib/store.svelte';
  import { nanoid } from 'nanoid';
  import type { FileRecord } from '../lib/types';

  let { showToast }: { showToast: (msg: string, type?: 'success' | 'error') => void } = $props();

  // ── State ─────────────────────────────────────────────────────
  let search        = $state('');
  let activeTag     = $state('');
  let activeFolder  = $state('');
  let viewMode      = $state<'list' | 'grid'>('list');
  let selectedId    = $state<string | null>(null);
  let uploading     = $state(false);
  let dragOver      = $state(false);
  let fileInput     = $state<HTMLInputElement | undefined>(undefined);
  let viewerUrl     = $state<string | null>(null);
  let viewerText    = $state<string | null>(null);
  let viewerTable   = $state<string[][] | null>(null);
  let viewerExpand  = $state(false);
  let linkNoteOpen  = $state(false);
  let linkRunOpen   = $state(false);
  let addTagDraft   = $state('');
  let addExtUrl     = $state(false);
  let extUrlDraft   = $state('');
  let extNameDraft  = $state('');
  let newFolderDraft = $state('');
  let addFolderMode = $state(false);
  let descTimer: ReturnType<typeof setTimeout>;
  let shareOpen = $state(false);
  let shareExpiry = $state<'1h' | '24h' | '7d' | '30d'>('24h');
  let shareUrl = $state<string | null>(null);
  let shareExpAt = $state<number | null>(null);
  let sharing = $state(false);

  const selectedFile = $derived(store.files.find(f => f.id === selectedId) ?? null);
  const allTags      = $derived([...new Set(store.files.flatMap(f => f.tags))].sort());
  const allFolders   = $derived([...new Set(store.files.map(f => f.folder).filter(Boolean) as string[])].sort());

  const filtered = $derived(
    store.files
      .filter(f => {
        const q = search.toLowerCase();
        const matchQ = !q || f.name.toLowerCase().includes(q) || f.description.toLowerCase().includes(q) || f.tags.some(t => t.includes(q));
        const matchT = !activeTag || f.tags.includes(activeTag);
        const matchF = !activeFolder || f.folder === activeFolder;
        return matchQ && matchT && matchF;
      })
      .sort((a, b) => b.createdAt - a.createdAt)
  );

  // ── Upload ────────────────────────────────────────────────────
  function triggerUpload() { fileInput?.click(); }

  function onDragOver(e: DragEvent) { e.preventDefault(); dragOver = true; }
  function onDragLeave() { dragOver = false; }
  function onDrop(e: DragEvent) {
    e.preventDefault(); dragOver = false;
    const files = e.dataTransfer?.files;
    if (files && files.length > 0) uploadFiles(Array.from(files));
  }

  async function handleFiles(e: Event) {
    const files = (e.target as HTMLInputElement).files;
    if (!files || files.length === 0) return;
    await uploadFiles(Array.from(files));
    if (fileInput) fileInput.value = '';
  }

  async function uploadFiles(files: File[]) {
    uploading = true;
    const workerBase = store.workerBase;
    const useR2 = !!workerBase;
    try {
      const records: FileRecord[] = [];
      for (const file of files) {
        const mime = file.type || guessMime(file.name);
        let r2Key: string | undefined;

        if (useR2) {
          const fd = new FormData();
          fd.append('file', file, file.name);
          fd.append('prefix', 'files');
          const res = await fetch(`${workerBase}/upload`, { method: 'POST', body: fd });
          if (!res.ok) throw new Error(`R2 upload failed: ${res.status}`);
          const data = await res.json() as { key: string };
          r2Key = data.key;
        }

        records.push({
          id: nanoid(),
          name: file.name,
          mimeType: mime,
          size: file.size,
          r2Key,
          data: useR2 ? undefined : await readAsBase64(file),
          tags: [],
          folder: activeFolder || undefined,
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
      // Select after save completes — won't trigger viewer reload mid-save
      selectedId = records[0].id;
    } catch (err) {
      showToast('Upload failed: ' + (err as Error).message, 'error');
    } finally { uploading = false; }
  }

  function readAsBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string).split(',')[1]);
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
      size: 0, url: extUrlDraft.trim(), tags: [], folder: activeFolder || undefined,
      linkedNoteIds: [], linkedRunIds: [],
      description: '', createdAt: Date.now(), updatedAt: Date.now(),
    };
    store.files = [rec, ...store.files];
    await store.saveFiles();
    selectedId = rec.id;
    extUrlDraft = ''; extNameDraft = ''; addExtUrl = false;
    showToast('External link added');
  }

  // ── Viewer ────────────────────────────────────────────────────
  let lastSelectedId = '';
  $effect(() => {
    const sf = selectedFile;
    // Only rebuild viewer when selected file actually changes
    if (sf?.id === lastSelectedId) return;
    lastSelectedId = sf?.id ?? '';

    if (viewerUrl && !viewerUrl.startsWith('http')) URL.revokeObjectURL(viewerUrl);
    viewerUrl = null; viewerText = null; viewerTable = null;
    if (!sf) return;

    if (sf.url) { viewerUrl = sf.url; return; }

    if (sf.r2Key) {
      viewerUrl = `${store.workerBase}/file/${encodeURIComponent(sf.r2Key)}`;
      return;
    }

    if (!sf.data) return;
    const mime  = sf.mimeType;
    const bytes = atob(sf.data);
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
      } else { viewerText = text; }
    }
  });

  function isCodeMime(m: string) {
    return ['text/x-r','text/x-python','text/x-shellscript','text/javascript','text/typescript','application/json','text/markdown','text/html','application/xml'].includes(m);
  }

  // ── Share ─────────────────────────────────────────────────────
  async function createShareLink() {
    if (!selectedFile?.r2Key || !store.workerBase) return;
    sharing = true;
    try {
      const res = await fetch(`${store.workerBase}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ r2Key: selectedFile.r2Key, name: selectedFile.name, mime: selectedFile.mimeType, expiresIn: shareExpiry }),
      });
      if (!res.ok) throw new Error(`Share failed: ${res.status}`);
      const data = await res.json() as { url: string; expiresAt: number };
      shareUrl = data.url;
      shareExpAt = data.expiresAt;
    } catch (err) {
      showToast('Share failed: ' + (err as Error).message, 'error');
    } finally { sharing = false; }
  }

  function copyShareUrl() {
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl).then(() => showToast('Link copied'));
  }

  // ── Enzo ──────────────────────────────────────────────────────
  async function sendToEnzo() {
    if (!selectedFile) return;
    let context = `File: ${selectedFile.name}`;
    if (selectedFile.description) context += `\nDescription: ${selectedFile.description}`;

    let contentLoaded = false;

    if (viewerText) {
      context += `\n\nContent:\n${viewerText.slice(0, 6000)}${viewerText.length > 6000 ? '\n…(truncated)' : ''}`;
      contentLoaded = true;
    } else if (viewerTable) {
      const preview = viewerTable.slice(0, 20).map(r => r.join('\t')).join('\n');
      context += `\n\nData (first 20 rows):\n${preview}`;
      contentLoaded = true;
    } else if (viewerUrl && selectedFile.r2Key) {
      // Try to fetch text content from R2 for text/code files
      const mime = selectedFile.mimeType;
      if (mime.startsWith('text/') || isCodeMime(mime)) {
        try {
          const res = await fetch(viewerUrl);
          if (res.ok) {
            const text = await res.text();
            context += `\n\nContent:\n${text.slice(0, 6000)}${text.length > 6000 ? '\n…(truncated)' : ''}`;
            contentLoaded = true;
          }
        } catch { /* ignore — will fall through to honesty notice */ }
      }
    }

    if (!contentLoaded) {
      // Be honest: Enzo cannot read binary files, PDFs, or images
      context += `\n\n[Note to Enzo: I cannot extract the content of this file (${selectedFile.mimeType}). Only the filename and description above are available. Do not guess or fabricate what the file contains — ask me to share the content or describe what I need help with.]`;
    }

    store.enzoSearchQuery = context;
    store.enzoOpen = true;
  }

  // ── File ops ──────────────────────────────────────────────────
  async function deleteFile(id: string) {
    if (!confirm('Delete this file? This cannot be undone.')) return;
    const f = store.files.find(x => x.id === id);
    if (f?.r2Key) {
      await fetch(`${store.workerBase}/file/${encodeURIComponent(f.r2Key)}`, { method: 'DELETE' }).catch(() => {});
    }
    store.files = store.files.filter(x => x.id !== id);
    if (selectedId === id) selectedId = null;
    await store.saveFiles();
    showToast('File deleted');
  }

  // Svelte 5 tracks property mutations — no array spread needed
  async function saveFile() {
    await store.saveFiles();
  }

  function onDescInput(e: Event) {
    if (!selectedFile) return;
    selectedFile.description = (e.target as HTMLInputElement).value;
    clearTimeout(descTimer);
    descTimer = setTimeout(() => saveFile(), 1500);
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

  function assignFolder(folder: string) {
    if (!selectedFile) return;
    selectedFile.folder = folder || undefined;
    saveFile();
  }

  function createFolder() {
    const name = newFolderDraft.trim();
    if (!name) return;
    if (!allFolders.includes(name)) {
      // Assign to selected file if one is open, otherwise just record the name via a placeholder
      if (selectedFile) {
        selectedFile.folder = name;
        saveFile();
      }
      // Either way, switching active folder shows it
    }
    activeFolder = name;
    newFolderDraft = '';
    addFolderMode = false;
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
    if (f.r2Key) {
      Object.assign(document.createElement('a'), { href: `${store.workerBase}/file/${encodeURIComponent(f.r2Key)}`, download: f.name, target: '_blank' }).click();
      return;
    }
    if (!f.data) return;
    const bytes = atob(f.data);
    const arr   = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
    const blob  = new Blob([arr], { type: f.mimeType });
    const url   = URL.createObjectURL(blob);
    Object.assign(document.createElement('a'), { href: url, download: f.name }).click();
    URL.revokeObjectURL(url);
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
  <!-- ── Left sidebar ── -->
  <aside class="files-sidebar">
    <div class="files-sidebar-head">
      <span class="section-label">Files</span>
      <span class="file-count text-xs text-mu">{store.files.length}</span>
    </div>

    <!-- Folders -->
    <div class="sidebar-section">
      <div class="sidebar-section-head">
        <span class="sidebar-section-label">Folders</span>
        <button class="btn-link text-xs" onclick={() => addFolderMode = !addFolderMode}>+</button>
      </div>
      {#if addFolderMode}
        <div class="new-folder-form">
          <input
            type="text"
            class="folder-input"
            bind:value={newFolderDraft}
            placeholder="Folder name…"
            onkeydown={(e) => { if (e.key === 'Enter') createFolder(); if (e.key === 'Escape') { addFolderMode = false; newFolderDraft = ''; } }}
            autofocus
          />
          <button class="btn btn-primary btn-xs" onclick={createFolder} disabled={!newFolderDraft.trim()}>Add</button>
        </div>
      {/if}
      <button class="folder-pill" class:active={!activeFolder} onclick={() => activeFolder = ''}>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>
        All files
      </button>
      {#each allFolders as folder}
        <button class="folder-pill" class:active={activeFolder === folder} onclick={() => activeFolder = folder}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>
          {folder}
        </button>
      {/each}
    </div>

    <!-- Tags -->
    {#if allTags.length > 0}
      <div class="sidebar-section">
        <div class="sidebar-section-head">
          <span class="sidebar-section-label">Tags</span>
        </div>
        <button class="tag-pill" class:active={!activeTag} onclick={() => activeTag = ''}>All</button>
        {#each allTags as tag}
          <button class="tag-pill" class:active={activeTag === tag} onclick={() => activeTag = tag}>{tag}</button>
        {/each}
      </div>
    {/if}

    <!-- Legend -->
    <div class="type-filter">
      {#each ['pdf','image','code','data'] as cat}
        <span class="type-dot" style="background:{CAT_COLORS[cat]}" title={CAT_LABELS[cat]}></span>
        <span class="type-label">{CAT_LABELS[cat]}</span>
      {/each}
    </div>
  </aside>

  <!-- ── Main area ── -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="files-main"
    ondragover={onDragOver}
    ondragleave={onDragLeave}
    ondrop={onDrop}
    class:drag-active={dragOver}
  >
    {#if dragOver}
      <div class="drop-overlay">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="color:var(--ac)"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
        <span>Drop files to upload</span>
      </div>
    {/if}

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
                {#if f.folder}<span class="folder-badge">{f.folder}</span>{/if}
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
        <div class="file-detail" class:viewer-expanded={viewerExpand}>
          <div class="file-detail-head">
            <div class="file-detail-title">
              <p class="file-detail-name">{selectedFile.name}</p>
              <p class="text-xs text-mu">{fmtSize(selectedFile.size)} · {fmtDate(selectedFile.createdAt)}</p>
            </div>
            <div class="file-detail-actions">
              <!-- Enzo button -->
              <button class="btn-enzo" onclick={sendToEnzo} title="Discuss with Enzo">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/></svg>
                Enzo
              </button>
              <!-- Share button (R2 files only) -->
              {#if selectedFile.r2Key && store.workerBase}
                <div class="share-wrap">
                  <button class="btn btn-ghost btn-sm" onclick={() => { shareOpen = !shareOpen; shareUrl = null; shareExpAt = null; }} title="Share read-only link">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
                    Share
                  </button>
                  {#if shareOpen}
                    <!-- svelte-ignore a11y_no_static_element_interactions -->
                    <!-- svelte-ignore a11y_click_events_have_key_events -->
                    <div class="share-backdrop" onclick={() => shareOpen = false}></div>
                    <div class="share-popover">
                      <p class="share-label">Read-only link · expires after</p>
                      <div class="share-expiry-row">
                        {#each (['1h','24h','7d','30d'] as const) as opt}
                          <button class="expiry-btn" class:active={shareExpiry === opt} onclick={() => shareExpiry = opt}>{opt}</button>
                        {/each}
                      </div>
                      {#if shareUrl}
                        <div class="share-url-row">
                          <input type="text" readonly value={shareUrl} class="share-url-input" onclick={(e) => (e.target as HTMLInputElement).select()} />
                          <button class="btn btn-primary btn-sm" onclick={copyShareUrl}>Copy</button>
                        </div>
                        {#if shareExpAt}
                          <p class="share-exp-note text-xs text-mu">Expires {new Date(shareExpAt).toLocaleString('en-GB', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' })}</p>
                        {/if}
                      {:else}
                        <button class="btn btn-primary btn-sm share-gen-btn" onclick={createShareLink} disabled={sharing}>
                          {sharing ? 'Generating…' : 'Generate link'}
                        </button>
                      {/if}
                    </div>
                  {/if}
                </div>
              {/if}
              <button class="btn btn-ghost btn-sm" onclick={() => downloadFile(selectedFile!)}>
                {selectedFile.url ? 'Open' : 'Download'}
              </button>
              <button class="btn-icon" title={viewerExpand ? 'Collapse viewer' : 'Expand viewer'} onclick={() => viewerExpand = !viewerExpand}>
                {#if viewerExpand}
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="10" y1="14" x2="3" y2="21"/><line x1="21" y1="3" x2="14" y2="10"/></svg>
                {:else}
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
                {/if}
              </button>
              <button class="btn-icon" onclick={() => { selectedId = null; viewerExpand = false; }}>
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
              <div class="viewer-code-wrap">
                <div class="viewer-code-lines">
                  {#each viewerText.slice(0, 10000).split('\n') as line, i}
                    <span class="line-num">{i + 1}</span><span class="line-content">{line}</span>
                  {/each}
                  {#if viewerText.length > 10000}
                    <span class="line-num">…</span><span class="line-content text-mu">truncated — download to view full file</span>
                  {/if}
                </div>
              </div>
            {:else}
              <div class="viewer-no-preview">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.3"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                <p class="text-mu text-sm">No preview available.</p>
                <button class="btn btn-ghost btn-sm" onclick={() => downloadFile(selectedFile!)}>Download to open</button>
              </div>
            {/if}
          </div>

          <!-- Metadata (hidden when viewer is expanded) -->
          {#if !viewerExpand}
            <div class="file-meta-panel">
              <!-- Description -->
              <div class="meta-section">
                <label class="meta-label">Description</label>
                <input
                  type="text"
                  class="meta-input"
                  value={selectedFile.description}
                  oninput={onDescInput}
                  placeholder="Brief description…"
                />
              </div>

              <!-- Folder -->
              <div class="meta-section">
                <label class="meta-label">Folder</label>
                <select class="meta-select" value={selectedFile.folder ?? ''} onchange={(e) => assignFolder((e.target as HTMLSelectElement).value)}>
                  <option value="">— No folder —</option>
                  {#each allFolders as folder}
                    <option value={folder}>{folder}</option>
                  {/each}
                </select>
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
          {/if}
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  .files-shell { display: flex; height: 100%; overflow: hidden; }

  /* ── Sidebar ── */
  .files-sidebar {
    width: 168px;
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

  .sidebar-section { display: flex; flex-direction: column; gap: 2px; }
  .sidebar-section-head { display: flex; align-items: center; justify-content: space-between; padding: 0 4px 4px; }
  .sidebar-section-label { font-size: 0.64rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: var(--mu); }

  .folder-pill {
    display: flex; align-items: center; gap: 6px;
    padding: 4px 8px; border-radius: var(--radius-sm);
    font-size: 0.75rem; background: transparent; border: none;
    color: var(--tx2); text-align: left; cursor: pointer;
    transition: background var(--transition);
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .folder-pill:hover { background: var(--sf2); }
  .folder-pill.active { background: var(--ac-bg); color: var(--ac); font-weight: 600; }
  .folder-pill svg { flex-shrink: 0; }

  .new-folder-form { display: flex; gap: 4px; padding: 2px 4px 4px; }
  .folder-input { flex: 1; font-size: 0.78rem; padding: 4px 6px; min-width: 0; }
  .btn-xs { padding: 3px 8px; font-size: 0.72rem; }

  .tag-filter { display: flex; flex-direction: column; gap: 2px; }
  .tag-pill { padding: 4px 8px; border-radius: var(--radius-sm); font-size: 0.75rem; background: transparent; border: none; color: var(--tx2); text-align: left; cursor: pointer; transition: background var(--transition); }
  .tag-pill:hover { background: var(--sf2); }
  .tag-pill.active { background: var(--ac-bg); color: var(--ac); font-weight: 600; }

  .type-filter { display: flex; flex-direction: column; gap: 4px; padding: 0 4px; border-top: 1px solid var(--bd); padding-top: 10px; margin-top: auto; }
  .type-dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; margin-right: 6px; }
  .type-label { font-size: 0.72rem; color: var(--mu); }

  /* ── Main ── */
  .files-main { flex: 1; display: flex; flex-direction: column; overflow: hidden; position: relative; }
  .files-main.drag-active { outline: 2px dashed var(--ac); outline-offset: -3px; }
  .drop-overlay {
    position: absolute; inset: 0; z-index: 10;
    background: var(--ac-bg);
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: 12px; font-size: 0.95rem; font-weight: 600; color: var(--ac);
    pointer-events: none;
  }
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
    display: flex; align-items: center; gap: 12px;
    padding: 9px 16px; border-bottom: 1px solid var(--bd);
    cursor: pointer; transition: background var(--transition);
  }
  .file-list-item:hover { background: var(--sf); }
  .file-list-item.selected { background: var(--ac-bg); }

  /* Grid view */
  .files-grid { flex: 1; overflow-y: auto; display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 10px; padding: 12px; align-content: start; }
  .file-grid-item {
    display: flex; flex-direction: column; align-items: center; gap: 6px;
    padding: 16px 10px 10px; border: 1px solid var(--bd); border-radius: var(--radius);
    background: var(--sf); cursor: pointer;
    transition: background var(--transition), border-color var(--transition); text-align: center;
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
  .folder-badge { display: inline-block; margin-left: 4px; font-size: 0.65rem; padding: 0 4px; background: var(--sf2); border-radius: 4px; color: var(--tx2); }
  .file-actions { display: flex; gap: 2px; opacity: 0; transition: opacity var(--transition); flex-shrink: 0; }
  .file-list-item:hover .file-actions, .file-grid-item:hover .file-actions { opacity: 1; }
  .file-action { width: 26px; height: 26px; border-radius: 4px; }
  .file-action.danger:hover { color: var(--rd); background: var(--rd-bg); }
  .files-empty { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; padding: 40px; }

  /* ── Detail panel ── */
  .file-detail {
    width: 360px; flex-shrink: 0;
    border-left: 1px solid var(--bd);
    display: flex; flex-direction: column; overflow: hidden; background: var(--bg);
    transition: width var(--transition);
  }
  .file-detail.viewer-expanded { width: 600px; }

  .file-detail-head {
    display: flex; align-items: flex-start; justify-content: space-between;
    gap: 8px; padding: 10px 12px; border-bottom: 1px solid var(--bd); flex-shrink: 0;
  }
  .file-detail-title { min-width: 0; flex: 1; }
  .file-detail-name { font-size: 0.85rem; font-weight: 600; color: var(--tx); word-break: break-word; }
  .file-detail-actions { display: flex; align-items: center; gap: 4px; flex-shrink: 0; }

  /* Enzo button */
  .btn-enzo {
    display: inline-flex; align-items: center; gap: 5px;
    padding: 4px 9px; border-radius: var(--radius-sm);
    font-size: 0.75rem; font-weight: 600;
    background: linear-gradient(135deg, var(--ac-bg), color-mix(in srgb, var(--pu) 15%, transparent));
    color: var(--ac); border: 1px solid color-mix(in srgb, var(--ac) 30%, transparent);
    cursor: pointer; transition: all var(--transition);
  }
  .btn-enzo:hover { background: var(--ac); color: var(--bg); }

  /* Viewer */
  .file-viewer {
    flex-shrink: 0; border-bottom: 1px solid var(--bd);
    overflow: hidden; height: 420px;
    display: flex; align-items: stretch; justify-content: center;
    background: var(--sf2);
  }
  .viewer-expanded .file-viewer { flex: 1; height: auto; }

  .viewer-image { max-width: 100%; max-height: 100%; object-fit: contain; align-self: center; }
  .viewer-pdf { width: 100%; height: 100%; border: none; }

  .viewer-code-wrap { width: 100%; height: 100%; overflow: auto; }
  .viewer-code-lines {
    display: grid; grid-template-columns: 2.5rem 1fr;
    font-family: var(--mono); font-size: 0.71rem; line-height: 1.55;
    padding: 8px 0; width: 100%;
  }
  .line-num {
    color: var(--mu); text-align: right; padding: 0 10px 0 8px;
    user-select: none; border-right: 1px solid var(--bd);
    position: sticky; left: 0; background: var(--sf2);
  }
  .line-content { padding: 0 12px; color: var(--tx2); white-space: pre; }

  .viewer-table-wrap { overflow: auto; width: 100%; height: 100%; }
  .viewer-table { font-size: 0.72rem; border-collapse: collapse; width: 100%; }
  .viewer-table th, .viewer-table td { border: 1px solid var(--bd); padding: 3px 8px; white-space: nowrap; }
  .viewer-table th { background: var(--sf); font-weight: 600; position: sticky; top: 0; }
  .viewer-link-box { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 20px; text-align: center; align-self: center; width: 100%; }
  .viewer-link { font-size: 0.78rem; color: var(--ac); word-break: break-all; }
  .viewer-no-preview { display: flex; flex-direction: column; align-items: center; gap: 8px; align-self: center; }

  /* Meta panel */
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

  /* Share */
  .share-wrap { position: relative; }
  .share-backdrop {
    position: fixed; inset: 0; z-index: 60;
    background: transparent;
  }
  .share-popover {
    position: absolute; top: calc(100% + 6px); right: 0; z-index: 61;
    background: var(--sf); border: 1px solid var(--bd);
    border-radius: var(--radius); box-shadow: var(--shadow-lg);
    padding: 12px; width: 280px;
    display: flex; flex-direction: column; gap: 8px;
  }
  .share-label { font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: var(--mu); }
  .share-expiry-row { display: flex; gap: 4px; }
  .expiry-btn {
    flex: 1; padding: 4px 0; font-size: 0.75rem; font-weight: 600;
    border: 1px solid var(--bd); border-radius: var(--radius-sm);
    background: var(--sf2); color: var(--tx2); cursor: pointer;
    transition: all var(--transition);
  }
  .expiry-btn:hover { border-color: var(--ac); color: var(--ac); }
  .expiry-btn.active { background: var(--ac-bg); border-color: var(--ac); color: var(--ac); }
  .share-gen-btn { align-self: flex-start; }
  .share-url-row { display: flex; gap: 6px; }
  .share-url-input {
    flex: 1; font-size: 0.72rem; padding: 5px 8px; min-width: 0;
    font-family: var(--mono); color: var(--ac);
    background: var(--sf2); border: 1px solid var(--bd); border-radius: var(--radius-sm);
    cursor: pointer;
  }
  .share-exp-note { text-align: center; }
</style>
