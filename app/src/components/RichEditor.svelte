<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { Editor, Extension } from '@tiptap/core';
  import { StarterKit } from '@tiptap/starter-kit';
  import { Underline } from '@tiptap/extension-underline';
  import { Link } from '@tiptap/extension-link';
  import { Highlight } from '@tiptap/extension-highlight';
  import { TaskList } from '@tiptap/extension-task-list';
  import { TaskItem } from '@tiptap/extension-task-item';
  import { Table } from '@tiptap/extension-table';
  import { TableRow } from '@tiptap/extension-table-row';
  import { TableHeader } from '@tiptap/extension-table-header';
  import { TableCell } from '@tiptap/extension-table-cell';
  import { TextAlign } from '@tiptap/extension-text-align';
  import { TextStyle } from '@tiptap/extension-text-style';
  import { Color } from '@tiptap/extension-color';
  import { Subscript } from '@tiptap/extension-subscript';
  import { Superscript } from '@tiptap/extension-superscript';
  import { Placeholder } from '@tiptap/extension-placeholder';
  import { Typography } from '@tiptap/extension-typography';
  import { marked } from 'marked';
  import 'katex/dist/katex.min.css';
  import {
    createImageBlock,
    createAudioClipExtension,
    createEmbedBlock,
    createAttachmentBlock,
    CalloutExtension,
    InlineMathExtension,
    BlockMathExtension,
    ColumnExtension,
    ColumnsExtension,
    MermaidBlockExtension,
    DetailsExtension,
    type UploadFn,
  } from '../lib/tiptap-extensions';

  export interface SlashRef {
    getEditor: () => Editor | null;
    insertNoteLink: (id: string, title: string, from: number, to: number) => void;
    insertAudioClip: (attrs: { r2Key: string; durationSec: number; mimeType: string; label: string }) => void;
    insertEmbed: (attrs: Record<string, string>) => void;
    insertAttachment: (attrs: { r2Key: string; name: string; size: number; mimeType: string }) => void;
    insertCallout: (type: string) => void;
    insertMath: (display?: boolean) => void;
    insertColumns: () => void;
  }

  let {
    value = $bindable(''),
    placeholder = 'Start writing…',
    minHeight = '120px',
    onchange,
    onSlashQuery,
    onSlashClose,
    onNoteLinkQuery,
    onNoteLinkClose,
    slashRef = $bindable<SlashRef | null>(null),
    onUpload,
    class: extraClass = '',
  }: {
    value?: string;
    placeholder?: string;
    minHeight?: string;
    onchange?: (html: string) => void;
    onSlashQuery?: (query: string, x: number, y: number, from: number, to: number) => void;
    onSlashClose?: () => void;
    onNoteLinkQuery?: (query: string, x: number, y: number, from: number, to: number) => void;
    onNoteLinkClose?: () => void;
    slashRef?: SlashRef | null;
    onUpload?: UploadFn;
    onError?: (msg: string) => void;
    class?: string;
  } = $props();

  let editorEl: HTMLElement;
  let editor = $state<Editor | null>(null);
  let mounted = $state(false);

  // Bubble menu
  let bubbleVisible = $state(false);
  let bubbleX = $state(0);
  let bubbleY = $state(0);

  // Emoji picker
  let showEmojiPicker = $state(false);

  const EMOJIS = [
    '🔬','🧬','🧪','🧫','💊','🩺','🌡️','⚗️','🔭','📡','🫀','🫁',
    '📊','📈','📉','📋','📄','📝','📌','📍','💾','🖥️','📱','⌨️',
    '✅','❌','⚠️','💡','🎯','💯','🔥','⭐','🌟','🏆','🎖️','🏅',
    '🔍','🔎','🔑','📣','💬','🗣️','✉️','📬','🗂️','📦','🗃️','📚',
    '🌱','🌿','🍀','🌊','🌍','🌙','☀️','❄️','💧','🌡️','🌬️','⚡',
    '👍','👎','👋','🤝','💪','🤔','💭','❤️','🧠','🙏','👁️','🫶',
    '🚀','🎉','⚙️','🔧','🛠️','🏗️','🧩','🔮','⚖️','🗺️','🔬','🎓',
    '→','←','↑','↓','↔','⇒','⟹','∴','∵','≈','≠','≤',
    '≥','∞','∑','∫','∂','α','β','γ','δ','μ','σ','π',
    'λ','Δ','Ω','φ','ψ','χ','ρ','ε','θ','η','ξ','ζ',
  ];

  // Find & Replace
  let showFindReplace = $state(false);
  let findText = $state('');
  let replaceText = $state('');
  let findCount = $state(0);
  let findInput: HTMLInputElement;
  let findMatchIndex = $state(0);

  // Text colour picker
  let showColorPicker = $state(false);
  let activeTextColor = $state('#e85d5d');

  // Callout picker
  let showCalloutPicker = $state(false);

  const CALLOUT_TYPES = [
    { id: 'info',       label: 'Info',       emoji: 'ℹ️' },
    { id: 'warning',    label: 'Warning',    emoji: '⚠️' },
    { id: 'important',  label: 'Important',  emoji: '❗' },
    { id: 'hypothesis', label: 'Hypothesis', emoji: '💡' },
    { id: 'result',     label: 'Result',     emoji: '📊' },
  ];

  const TEXT_COLORS = [
    '#e85d5d', '#f5a623', '#f8d147', '#52c77f', '#4fa3e3',
    '#7c67ee', '#e865b8', '#94a3b8', '#ffffff', '#1e293b',
  ];

  // ── Upload helper ──────────────────────────────────────────────────────────
  async function doUpload(file: File, prefix = 'files'): Promise<{ key: string }> {
    if (onUpload) return onUpload(file, prefix);
    // Fallback: use global worker base
    const workerUrl = (window as any).__qonco_worker ?? 'https://enzo.quant-onco.workers.dev';
    const fd = new FormData();
    fd.append('file', file);
    fd.append('prefix', prefix);
    const res = await fetch(`${workerUrl}/upload`, { method: 'POST', body: fd });
    if (!res.ok) throw new Error('Upload failed');
    return res.json();
  }

  function htmlFromValue(v: string): string {
    if (!v) return '';
    if (v.trimStart().startsWith('<')) return v;
    return marked.parse(v) as string;
  }

  onMount(() => {
    const imageExt = createImageBlock({ onUpload: doUpload });
    const audioClipExt = createAudioClipExtension();
    const embedExt = createEmbedBlock();
    const attachExt = createAttachmentBlock();

    editor = new Editor({
      element: editorEl,
      extensions: [
        StarterKit.configure({ codeBlock: { languageClassPrefix: 'language-' } }),
        Underline,
        Highlight.configure({ multicolor: true }),
        Link.configure({ openOnClick: false, autolink: true, HTMLAttributes: { rel: 'noopener noreferrer' } }),
        TaskList,
        TaskItem.configure({ nested: true }),
        Table.configure({ resizable: false }),
        TableRow, TableHeader, TableCell,
        TextAlign.configure({ types: ['heading', 'paragraph', 'imageBlock'] }),
        TextStyle,
        Color,
        Subscript,
        Superscript,
        Placeholder.configure({ placeholder }),
        imageExt,
        audioClipExt,
        embedExt,
        attachExt,
        CalloutExtension,
        InlineMathExtension,
        BlockMathExtension,
        ColumnExtension,
        ColumnsExtension,
        MermaidBlockExtension,
        DetailsExtension,
        Typography,
      ],
      content: htmlFromValue(value),
      onSelectionUpdate: ({ editor: e }) => {
        updateBubble(e);
      },
      onUpdate: ({ editor: e }) => {
        const html = e.getHTML();
        value = html;
        onchange?.(html);
        updateBubble(e);
        const { from } = e.state.selection;
        const textBefore = e.state.doc.textBetween(Math.max(0, from - 80), from, '\n');
        if (textBefore.match(/\[\[([^\]]*)$/)) {
          onSlashClose?.();
          detectNoteLink(e, textBefore);
        } else {
          onNoteLinkClose?.();
          detectSlash(e);
        }
      },
    });

    slashRef = {
      getEditor: () => editor,
      insertNoteLink: (id, title, from, to) => {
        if (!editor) return;
        editor.chain().focus().deleteRange({ from, to })
          .insertContent({ type: 'text', text: title, marks: [{ type: 'link', attrs: { href: `note:${id}`, target: null, class: 'note-internal-link' } }] })
          .insertContent(' ').run();
      },
      insertAudioClip: (attrs) => {
        editor?.chain().focus().insertContent({ type: 'audioClip', attrs }).run();
      },
      insertEmbed: (attrs) => {
        editor?.chain().focus().insertContent({ type: 'embedBlock', attrs }).run();
      },
      insertAttachment: (attrs) => {
        editor?.chain().focus().insertContent({ type: 'attachmentBlock', attrs }).run();
      },
      insertCallout: (type) => {
        editor?.chain().focus().insertContent({
          type: 'callout', attrs: { type },
          content: [{ type: 'paragraph', content: [{ type: 'text', text: '' }] }],
        }).run();
      },
      insertMath: (display = false) => {
        const formula = prompt(display ? 'Display LaTeX formula:' : 'Inline LaTeX formula:') ?? '';
        if (!formula.trim()) return;
        if (display) {
          editor?.chain().focus().insertContent({ type: 'blockMath', attrs: { formula } }).run();
        } else {
          editor?.chain().focus().insertContent({ type: 'inlineMath', attrs: { formula } }).run();
        }
      },
      insertColumns: () => {
        editor?.chain().focus().insertContent({
          type: 'columns',
          content: [
            { type: 'column', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Column 1' }] }] },
            { type: 'column', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Column 2' }] }] },
          ]
        }).run();
      },
    };
    mounted = true;
  });

  function detectNoteLink(e: Editor, textBefore: string) {
    const match = textBefore.match(/\[\[([^\]]*)$/);
    if (!match) { onNoteLinkClose?.(); return; }
    const linkFrom = e.state.selection.from - match[0].length;
    try {
      const coords = e.view.coordsAtPos(linkFrom);
      onNoteLinkQuery?.(match[1], coords.left, coords.bottom, linkFrom, e.state.selection.from);
    } catch { /* coords unavailable */ }
  }

  function detectSlash(e: Editor) {
    const { from } = e.state.selection;
    const textBefore = e.state.doc.textBetween(Math.max(0, from - 120), from, '\n');
    const match = textBefore.match(/(?:^|\n| )\/([a-zA-Z0-9 _-]*)$/);
    if (match) {
      const slashOffset = match[0].indexOf('/');
      const slashFrom = from - (match[0].length - slashOffset);
      try {
        const coords = e.view.coordsAtPos(slashFrom);
        onSlashQuery?.(match[1], coords.left, coords.bottom, slashFrom, from);
      } catch { /* coords unavailable */ }
    } else {
      onSlashClose?.();
    }
  }

  onDestroy(() => editor?.destroy());

  function updateBubble(e: Editor) {
    const { from, to, empty } = e.state.selection;
    if (empty || from === to) { bubbleVisible = false; return; }
    try {
      const start = e.view.coordsAtPos(from);
      const end = e.view.coordsAtPos(to);
      bubbleX = (start.left + end.right) / 2;
      bubbleY = Math.min(start.top, end.top) - 46;
      bubbleVisible = true;
    } catch { bubbleVisible = false; }
  }

  function insertEmoji(emoji: string) {
    editor?.chain().focus().insertContent(emoji).run();
    showEmojiPicker = false;
  }

  function insertMermaid() {
    editor?.chain().focus().insertContent({ type: 'mermaidBlock', attrs: { code: 'graph TD\n  A[HGSOC] --> B[TME]\n  B --> C[CD8+ T cells]\n  B --> D[M2 Macrophages]' } }).run();
  }

  function insertDetails() {
    editor?.chain().focus().insertContent({
      type: 'details',
      attrs: { open: true, summary: 'Section title' },
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Content here…' }] }],
    }).run();
  }

  $effect(() => {
    if (!editor || !mounted) return;
    const current = editor.getHTML();
    const incoming = htmlFromValue(value);
    if (incoming !== current) editor.commands.setContent(incoming, false as any);
  });

  function cmd(name: string, attrs?: Record<string, unknown>) {
    if (!editor) return;
    (editor.chain().focus() as any)[name]?.(attrs)?.run?.();
    editor.commands.focus();
  }

  function isActive(name: string, attrs?: Record<string, unknown>) {
    return editor?.isActive(name, attrs) ?? false;
  }

  function setLink() {
    if (!editor) return;
    const prev = editor.getAttributes('link').href ?? '';
    const url = prompt('URL (or leave blank to remove):', prev);
    if (url === null) return;
    if (url === '') { editor.chain().focus().unsetLink().run(); }
    else { editor.chain().focus().setLink({ href: url }).run(); }
  }

  function insertTable() {
    editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
  }

  function applyTextColor(color: string) {
    activeTextColor = color;
    editor?.chain().focus().setColor(color).run();
    showColorPicker = false;
  }

  // ── Image insert via file input ────────────────────────────────────────────
  let imgInput: HTMLInputElement;

  async function onImageInputChange() {
    const file = imgInput?.files?.[0];
    if (!file) return;
    try {
      const { key } = await doUpload(file, 'note-images');
      const workerUrl = (window as any).__qonco_worker ?? 'https://enzo.quant-onco.workers.dev';
      editor?.chain().focus().insertContent({
        type: 'imageBlock',
        attrs: { src: `${workerUrl}/file/${key}`, alt: file.name, align: 'center', width: 80 }
      }).run();
    } catch { onError?.('Image upload failed'); }
    imgInput.value = '';
  }

  // ── File attach via file input ─────────────────────────────────────────────
  let fileInput: HTMLInputElement;

  async function onFileInputChange() {
    const file = fileInput?.files?.[0];
    if (!file) return;
    try {
      const { key } = await doUpload(file, 'note-files');
      slashRef?.insertAttachment({ r2Key: key, name: file.name, size: file.size, mimeType: file.type });
    } catch { onError?.('File upload failed'); }
    fileInput.value = '';
  }

  // ── URL embed ─────────────────────────────────────────────────────────────
  async function insertEmbed() {
    const url = prompt('Paste a URL to embed:');
    if (!url?.trim()) return;
    const workerUrl = (window as any).__qonco_worker ?? 'https://enzo.quant-onco.workers.dev';
    try {
      const res = await fetch(`${workerUrl}/embed-meta`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      });
      const meta = await res.json();
      slashRef?.insertEmbed(meta);
    } catch {
      slashRef?.insertEmbed({ type: 'generic', url: url.trim(), title: url.trim(), hostname: new URL(url.trim()).hostname });
    }
  }

  // ── Find & Replace ─────────────────────────────────────────────────────────
  function toggleFindReplace() {
    showFindReplace = !showFindReplace;
    if (showFindReplace) setTimeout(() => findInput?.focus(), 50);
    else { findText = ''; replaceText = ''; findCount = 0; }
  }

  function doFind() {
    if (!editor || !findText) { findCount = 0; return; }
    const doc = editor.state.doc;
    let count = 0;
    const search = findText.toLowerCase();
    doc.descendants(node => {
      if (node.isText) count += (node.text!.toLowerCase().split(search).length - 1);
    });
    findCount = count;
  }

  function doReplace() {
    if (!editor || !findText) return;
    const { state } = editor;
    let tr = state.tr;
    let offset = 0;
    state.doc.descendants((node, pos) => {
      if (!node.isText) return;
      const idx = node.text!.toLowerCase().indexOf(findText.toLowerCase());
      if (idx !== -1) {
        tr = tr.replaceWith(pos + offset + idx, pos + offset + idx + findText.length, state.schema.text(replaceText));
        offset += replaceText.length - findText.length;
        return false;
      }
    });
    editor.view.dispatch(tr);
    doFind();
  }

  function doReplaceAll() {
    if (!editor || !findText) return;
    const { state } = editor;
    let tr = state.tr;
    let offset = 0;
    const search = findText.toLowerCase();
    state.doc.descendants((node, pos) => {
      if (!node.isText || !node.text) return;
      let text = node.text;
      let searchPos = 0;
      while (true) {
        const idx = text.toLowerCase().indexOf(search, searchPos);
        if (idx === -1) break;
        const absPos = pos + offset + idx;
        tr = tr.replaceWith(absPos, absPos + findText.length, state.schema.text(replaceText));
        offset += replaceText.length - findText.length;
        searchPos = idx + replaceText.length;
        text = text.slice(0, idx) + replaceText + text.slice(idx + findText.length);
      }
    });
    const prevCount = findCount;
    editor.view.dispatch(tr);
    doFind();
    if (prevCount > 0) onError?.(`Replaced ${prevCount} instance${prevCount > 1 ? 's' : ''}`);
  }
</script>

<div class="rich-editor {extraClass}">
  <!-- Hidden inputs -->
  <input type="file" accept="image/*" bind:this={imgInput} onchange={onImageInputChange} style="display:none" />
  <input type="file" bind:this={fileInput} onchange={onFileInputChange} style="display:none" />

  <!-- Bubble menu (appears on text selection) -->
  {#if bubbleVisible && mounted && editor}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="re-bubble"
      style="left:{bubbleX}px; top:{bubbleY}px;"
      onmousedown={(e) => e.preventDefault()}
    >
      <button type="button" class="re-btn" class:re-active={isActive('bold')} onclick={() => cmd('toggleBold')} title="Bold"><b>B</b></button>
      <button type="button" class="re-btn re-i" class:re-active={isActive('italic')} onclick={() => cmd('toggleItalic')} title="Italic"><i>I</i></button>
      <button type="button" class="re-btn re-u" class:re-active={isActive('underline')} onclick={() => cmd('toggleUnderline')} title="Underline"><u>U</u></button>
      <button type="button" class="re-btn re-s" class:re-active={isActive('strike')} onclick={() => cmd('toggleStrike')} title="Strike"><s>S</s></button>
      <div class="re-bubble-sep"></div>
      <button type="button" class="re-btn" class:re-active={isActive('link')} onclick={setLink} title="Link">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>
      </button>
      <button type="button" class="re-btn" class:re-active={isActive('highlight')} onclick={() => cmd('toggleHighlight')} title="Highlight">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M9 11l-4 4 2 4h8l2-4-4-4z"/><path d="M14.5 7l2.5 2.5-8 8"/></svg>
      </button>
      <button type="button" class="re-btn" class:re-active={isActive('code')} onclick={() => cmd('toggleCode')} title="Inline code">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
      </button>
    </div>
  {/if}

  {#if mounted && editor}
  <!-- ── Main toolbar ─────────────────────────────────────────────────────── -->
  <div class="re-toolbar">

    <!-- Row 1 -->
    <div class="re-row">

      <!-- History -->
      <div class="re-group">
        <button type="button" class="re-btn" onclick={() => cmd('undo')} title="Undo (Ctrl+Z)">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M3 7v6h6"/><path d="M3 13a9 9 0 109-9 9 9 0 00-6 2.3L3 9"/></svg>
        </button>
        <button type="button" class="re-btn" onclick={() => cmd('redo')} title="Redo (Ctrl+Shift+Z)">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21 7v6h-6"/><path d="M21 13a9 9 0 11-9-9 9 9 0 016 2.3L21 9"/></svg>
        </button>
      </div>
      <div class="re-sep"></div>

      <!-- Text format -->
      <div class="re-group">
        <button type="button" class="re-btn" class:re-active={isActive('bold')} onclick={() => cmd('toggleBold')} title="Bold (Ctrl+B)"><b>B</b></button>
        <button type="button" class="re-btn re-i" class:re-active={isActive('italic')} onclick={() => cmd('toggleItalic')} title="Italic (Ctrl+I)"><i>I</i></button>
        <button type="button" class="re-btn re-u" class:re-active={isActive('underline')} onclick={() => cmd('toggleUnderline')} title="Underline (Ctrl+U)">U</button>
        <button type="button" class="re-btn re-s" class:re-active={isActive('strike')} onclick={() => cmd('toggleStrike')} title="Strikethrough"><s>S</s></button>
        <button type="button" class="re-btn" class:re-active={isActive('subscript')} onclick={() => cmd('toggleSubscript')} title="Subscript">X<sub style="font-size:0.65em">2</sub></button>
        <button type="button" class="re-btn" class:re-active={isActive('superscript')} onclick={() => cmd('toggleSuperscript')} title="Superscript">X<sup style="font-size:0.65em">2</sup></button>
      </div>
      <div class="re-sep"></div>

      <!-- Headings -->
      <div class="re-group">
        <button type="button" class="re-btn" class:re-active={isActive('heading', { level: 1 })} onclick={() => cmd('toggleHeading', { level: 1 })} title="Heading 1">H1</button>
        <button type="button" class="re-btn" class:re-active={isActive('heading', { level: 2 })} onclick={() => cmd('toggleHeading', { level: 2 })} title="Heading 2">H2</button>
        <button type="button" class="re-btn" class:re-active={isActive('heading', { level: 3 })} onclick={() => cmd('toggleHeading', { level: 3 })} title="Heading 3">H3</button>
      </div>
      <div class="re-sep"></div>

      <!-- Lists -->
      <div class="re-group">
        <button type="button" class="re-btn" class:re-active={isActive('bulletList')} onclick={() => cmd('toggleBulletList')} title="Bullet list">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><line x1="9" y1="6" x2="20" y2="6"/><line x1="9" y1="12" x2="20" y2="12"/><line x1="9" y1="18" x2="20" y2="18"/><circle cx="4" cy="6" r="1.5" fill="currentColor" stroke="none"/><circle cx="4" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="4" cy="18" r="1.5" fill="currentColor" stroke="none"/></svg>
        </button>
        <button type="button" class="re-btn" class:re-active={isActive('orderedList')} onclick={() => cmd('toggleOrderedList')} title="Numbered list">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><line x1="10" y1="6" x2="21" y2="6"/><line x1="10" y1="12" x2="21" y2="12"/><line x1="10" y1="18" x2="21" y2="18"/><path d="M4 6h1v4" stroke="currentColor"/><path d="M4 10h2" stroke="currentColor"/><path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1" stroke="currentColor"/></svg>
        </button>
        <button type="button" class="re-btn" class:re-active={isActive('taskList')} onclick={() => cmd('toggleTaskList')} title="Task list">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="3" y="5" width="4" height="4" rx="0.5"/><polyline points="4 7 5 8 7 6"/><line x1="10" y1="7" x2="21" y2="7"/><rect x="3" y="14" width="4" height="4" rx="0.5"/><line x1="10" y1="16" x2="21" y2="16"/></svg>
        </button>
      </div>
      <div class="re-sep"></div>

      <!-- Blocks -->
      <div class="re-group">
        <button type="button" class="re-btn" class:re-active={isActive('blockquote')} onclick={() => cmd('toggleBlockquote')} title="Blockquote">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1zm12 0c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z"/></svg>
        </button>

        <!-- Callout picker -->
        <div class="re-dropdown-wrap">
          <button type="button" class="re-btn" onclick={() => { showCalloutPicker = !showCalloutPicker; }} title="Insert callout block">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          </button>
          {#if showCalloutPicker}
            <!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
            <div class="re-backdrop" onclick={() => showCalloutPicker = false}></div>
            <div class="re-dropdown">
              {#each CALLOUT_TYPES as ct}
                <button class="re-dropdown-item" onclick={() => { slashRef?.insertCallout(ct.id); showCalloutPicker = false; }}>
                  <span>{ct.emoji}</span> {ct.label}
                </button>
              {/each}
            </div>
          {/if}
        </div>
      </div>
      <div class="re-sep"></div>

      <!-- Alignment -->
      <div class="re-group">
        <button type="button" class="re-btn" class:re-active={isActive({ textAlign: 'left' })} onclick={() => cmd('setTextAlign', { alignment: 'left' })} title="Align left">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="15" y2="12"/><line x1="3" y1="18" x2="18" y2="18"/></svg>
        </button>
        <button type="button" class="re-btn" class:re-active={isActive({ textAlign: 'center' })} onclick={() => cmd('setTextAlign', { alignment: 'center' })} title="Center">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="6" y1="12" x2="18" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/></svg>
        </button>
        <button type="button" class="re-btn" class:re-active={isActive({ textAlign: 'right' })} onclick={() => cmd('setTextAlign', { alignment: 'right' })} title="Align right">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="9" y1="12" x2="21" y2="12"/><line x1="6" y1="18" x2="21" y2="18"/></svg>
        </button>
      </div>
      <div class="re-sep"></div>

      <!-- Code + Math -->
      <div class="re-group">
        <button type="button" class="re-btn" class:re-active={isActive('code')} onclick={() => cmd('toggleCode')} title="Inline code">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
        </button>
        <button type="button" class="re-btn" class:re-active={isActive('codeBlock')} onclick={() => cmd('toggleCodeBlock')} title="Code block">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="2" y="4" width="20" height="16" rx="2"/><polyline points="9 9 5 12 9 15"/><polyline points="15 9 19 12 15 15"/></svg>
        </button>
        <button type="button" class="re-btn" onclick={() => slashRef?.insertMath(false)} title="Inline math ($…$)">
          <span style="font-size:0.8rem;font-style:italic">∑</span>
        </button>
        <button type="button" class="re-btn" onclick={() => slashRef?.insertMath(true)} title="Display math ($$…$$)">
          <span style="font-size:0.8rem;font-style:italic">∫</span>
        </button>
      </div>
      <div class="re-sep"></div>

      <!-- Decoration -->
      <div class="re-group">
        <button type="button" class="re-btn" class:re-active={isActive('highlight')} onclick={() => cmd('toggleHighlight')} title="Highlight">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M9 11l-4 4 2 4h8l2-4-4-4z"/><path d="M14.5 7l2.5 2.5-8 8"/><path d="M17 5l2 2"/></svg>
        </button>
        <!-- Text color -->
        <div class="re-dropdown-wrap">
          <button type="button" class="re-btn re-color-btn" onclick={() => { showColorPicker = !showColorPicker; showCalloutPicker = false; }} title="Text colour">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9.37 5.51A7.35 7.35 0 0016.5 16.5"/><circle cx="12" cy="12" r="10"/></svg>
            <span class="re-color-dot" style="background:{activeTextColor}"></span>
          </button>
          {#if showColorPicker}
            <!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
            <div class="re-backdrop" onclick={() => showColorPicker = false}></div>
            <div class="re-dropdown re-color-picker">
              {#each TEXT_COLORS as c}
                <button class="re-color-swatch" style="background:{c}" onclick={() => applyTextColor(c)} title={c}></button>
              {/each}
              <button class="re-color-swatch re-color-clear" onclick={() => { editor?.chain().focus().unsetColor().run(); showColorPicker = false; }} title="Remove colour">×</button>
            </div>
          {/if}
        </div>
      </div>
    </div>

    <!-- Row 2: Insert tools -->
    <div class="re-row re-row2">

      <!-- Structural -->
      <div class="re-group">
        <button type="button" class="re-btn" class:re-active={isActive('link')} onclick={setLink} title="Insert / edit hyperlink">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>
        </button>
        <button type="button" class="re-btn" onclick={insertTable} title="Insert table">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/></svg>
        </button>
        <button type="button" class="re-btn" onclick={() => slashRef?.insertColumns()} title="Two-column layout">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="2" y="3" width="9" height="18" rx="1"/><rect x="13" y="3" width="9" height="18" rx="1"/></svg>
        </button>
        <button type="button" class="re-btn" onclick={() => cmd('setHorizontalRule')} title="Divider">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><line x1="3" y1="12" x2="21" y2="12"/></svg>
        </button>
      </div>
      <div class="re-sep"></div>

      <!-- Media inserts -->
      <div class="re-group">
        <button type="button" class="re-btn" onclick={() => imgInput?.click()} title="Insert image">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
        </button>
        <button type="button" class="re-btn" onclick={() => fileInput?.click()} title="Attach file">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/></svg>
        </button>
        <button type="button" class="re-btn" onclick={insertEmbed} title="Embed URL (YouTube, PDF, link card…)">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M15 3h6v6M10 14L21 3M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/></svg>
        </button>
        <button type="button" class="re-btn" onclick={insertMermaid} title="Insert Mermaid diagram">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="5" cy="12" r="2"/><circle cx="19" cy="5" r="2"/><circle cx="19" cy="19" r="2"/><line x1="7" y1="11" x2="17" y2="6"/><line x1="7" y1="13" x2="17" y2="18"/></svg>
        </button>
        <button type="button" class="re-btn" onclick={insertDetails} title="Insert collapsible section">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M3 6h18M3 12h12M3 18h8"/><polyline points="15 15 19 12 15 9" stroke-width="2"/></svg>
        </button>
      </div>
      <div class="re-sep"></div>

      <!-- Emoji picker -->
      <div class="re-group">
        <div class="re-dropdown-wrap">
          <button type="button" class="re-btn" onclick={() => { showEmojiPicker = !showEmojiPicker; }} title="Insert emoji / symbol">
            <span style="font-size:0.95rem;line-height:1">😊</span>
          </button>
          {#if showEmojiPicker}
            <!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
            <div class="re-backdrop" onclick={() => showEmojiPicker = false}></div>
            <div class="re-emoji-picker">
              {#each EMOJIS as e}
                <button class="re-emoji-btn" onclick={() => insertEmoji(e)} title={e}>{e}</button>
              {/each}
            </div>
          {/if}
        </div>
      </div>
      <div class="re-sep"></div>

      <!-- Utilities -->
      <div class="re-group">
        <button type="button" class="re-btn" class:re-active={showFindReplace} onclick={toggleFindReplace} title="Find & Replace (Ctrl+H)">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="10" cy="10" r="7"/><line x1="21" y1="21" x2="15" y2="15"/></svg>
        </button>
      </div>

    </div>

    <!-- Find & Replace panel -->
    {#if showFindReplace}
      <div class="re-find-panel">
        <input
          bind:this={findInput}
          class="re-find-input"
          placeholder="Find…"
          bind:value={findText}
          oninput={doFind}
          onkeydown={(e) => { if (e.key === 'Escape') toggleFindReplace(); if (e.key === 'Enter') doReplace(); }}
        />
        <input
          class="re-find-input"
          placeholder="Replace with…"
          bind:value={replaceText}
          onkeydown={(e) => { if (e.key === 'Enter') doReplaceAll(); }}
        />
        <span class="re-find-count">{findCount > 0 ? `${findCount} match${findCount !== 1 ? 'es' : ''}` : findText ? 'No matches' : ''}</span>
        <button class="re-find-btn" onclick={doReplace} disabled={!findText} title="Replace next">Replace</button>
        <button class="re-find-btn" onclick={doReplaceAll} disabled={!findText} title="Replace all">All</button>
        <button class="re-find-close" onclick={toggleFindReplace} title="Close">×</button>
      </div>
    {/if}

  </div>
  {/if}

  <div bind:this={editorEl} class="re-content" style="min-height: {minHeight}"></div>
</div>

<style>
  .rich-editor {
    border: 1px solid var(--bd);
    border-radius: var(--radius-sm);
    background: var(--bg);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    transition: border-color var(--transition);
  }
  .rich-editor:focus-within { border-color: var(--ac); }

  .re-toolbar {
    display: flex; flex-direction: column;
    border-bottom: 1px solid var(--bd);
    background: var(--sf);
    flex-shrink: 0;
  }
  .re-row {
    display: flex; align-items: center; gap: 2px;
    padding: 4px 6px; flex-wrap: wrap;
  }
  .re-row2 { border-top: 1px solid var(--bd); background: color-mix(in srgb, var(--sf2) 60%, var(--sf)); }

  .re-group { display: flex; align-items: center; gap: 1px; }
  .re-sep { width: 1px; height: 16px; background: var(--bd); margin: 0 2px; flex-shrink: 0; }

  .re-btn {
    display: flex; align-items: center; justify-content: center;
    width: 26px; height: 24px;
    border: none; background: transparent; color: var(--tx2);
    border-radius: 4px; font-size: 0.78rem; font-weight: 700;
    cursor: pointer; transition: background var(--transition), color var(--transition);
    flex-shrink: 0; white-space: nowrap;
  }
  .re-btn:hover { background: var(--sf2); color: var(--tx); }
  .re-active { background: var(--ac-bg) !important; color: var(--ac) !important; }
  .re-u { text-decoration: underline; }
  .re-i { font-style: italic; }

  /* Dropdowns */
  .re-dropdown-wrap { position: relative; }
  .re-backdrop { position: fixed; inset: 0; z-index: 50; }
  .re-dropdown {
    position: absolute; top: calc(100% + 4px); left: 0; z-index: 51;
    background: var(--sf); border: 1px solid var(--bd);
    border-radius: var(--radius-sm); box-shadow: 0 8px 24px rgba(0,0,0,0.15);
    min-width: 140px; overflow: hidden;
  }
  .re-dropdown-item {
    display: flex; align-items: center; gap: 8px; width: 100%;
    padding: 7px 12px; background: transparent; border: none;
    font-size: 0.82rem; color: var(--tx); cursor: pointer; font-family: var(--font);
    text-align: left;
  }
  .re-dropdown-item:hover { background: var(--sf2); color: var(--ac); }

  /* Colour picker */
  .re-color-btn { position: relative; width: 32px !important; }
  .re-color-dot { position: absolute; bottom: 2px; left: 50%; transform: translateX(-50%); width: 16px; height: 3px; border-radius: 2px; }
  .re-color-picker { display: flex; flex-wrap: wrap; gap: 4px; padding: 8px; min-width: auto; width: 136px; }
  .re-color-swatch { width: 20px; height: 20px; border-radius: 4px; border: 2px solid transparent; cursor: pointer; transition: transform var(--transition); }
  .re-color-swatch:hover { transform: scale(1.2); border-color: var(--tx); }
  .re-color-clear { background: var(--sf2) !important; border-color: var(--bd) !important; font-size: 14px; color: var(--mu); display: flex; align-items: center; justify-content: center; line-height: 1; }

  /* Find & Replace */
  .re-find-panel {
    display: flex; align-items: center; gap: 6px; flex-wrap: wrap;
    padding: 5px 8px; border-top: 1px solid var(--bd);
    background: color-mix(in srgb, var(--ac-bg) 40%, var(--sf));
  }
  .re-find-input {
    padding: 3px 8px; border: 1px solid var(--bd); border-radius: 4px;
    font-size: 0.8rem; background: var(--bg); color: var(--tx);
    width: 140px;
  }
  .re-find-input:focus { border-color: var(--ac); outline: none; }
  .re-find-count { font-size: 0.75rem; color: var(--mu); white-space: nowrap; }
  .re-find-btn {
    padding: 3px 10px; font-size: 0.78rem; border-radius: 4px;
    background: var(--ac-bg); color: var(--ac); border: 1px solid var(--ac);
    cursor: pointer; font-family: var(--font); font-weight: 500;
  }
  .re-find-btn:disabled { opacity: 0.4; cursor: default; }
  .re-find-close { background: transparent; border: none; font-size: 16px; color: var(--mu); cursor: pointer; padding: 0 4px; }
  .re-find-close:hover { color: var(--tx); }

  /* Editor content */
  .re-content {
    padding: 12px 14px; outline: none; font-size: 0.9rem;
    line-height: 1.7; color: var(--tx); overflow-y: auto; cursor: text;
  }

  /* ── ProseMirror base ── */
  :global(.re-content .ProseMirror p.is-editor-empty:first-child::before) {
    content: attr(data-placeholder); color: var(--mu); pointer-events: none; position: absolute;
  }
  :global(.re-content .ProseMirror) { outline: none; min-height: inherit; }
  :global(.re-content .ProseMirror h1) { font-size: 1.5rem; font-weight: 700; margin: 1rem 0 0.4rem; }
  :global(.re-content .ProseMirror h2) { font-size: 1.2rem; font-weight: 700; margin: 0.9rem 0 0.35rem; }
  :global(.re-content .ProseMirror h3) { font-size: 1rem; font-weight: 700; margin: 0.8rem 0 0.3rem; }
  :global(.re-content .ProseMirror p) { margin: 0 0 0.6em; }
  :global(.re-content .ProseMirror ul, .re-content .ProseMirror ol) { padding-left: 1.4rem; margin: 0.4em 0; }
  :global(.re-content .ProseMirror li) { margin: 0.2em 0; }
  :global(.re-content .ProseMirror blockquote) { border-left: 3px solid var(--ac); margin: 0.6em 0; padding: 0.3em 1em; color: var(--tx2); background: var(--sf); border-radius: 0 var(--radius-sm) var(--radius-sm) 0; }
  :global(.re-content .ProseMirror code) { background: var(--sf2); padding: 1px 5px; border-radius: 4px; font-family: var(--mono); font-size: 0.85em; color: var(--ac); }
  :global(.re-content .ProseMirror pre) { background: var(--sf2); border: 1px solid var(--bd); border-radius: var(--radius-sm); padding: 10px 14px; overflow-x: auto; margin: 0.6em 0; }
  :global(.re-content .ProseMirror pre code) { background: none; padding: 0; color: var(--tx); font-size: 0.85rem; }
  :global(.re-content .ProseMirror mark) { background: color-mix(in srgb, var(--yw) 30%, transparent); color: inherit; border-radius: 2px; padding: 0 2px; }
  :global(.re-content .ProseMirror a) { color: var(--ac); text-decoration: underline; }
  :global(.re-content .ProseMirror a.note-internal-link) { color: var(--pu); text-decoration: underline; text-decoration-style: dashed; }
  :global(.re-content .ProseMirror hr) { border: none; border-top: 1px solid var(--bd); margin: 1em 0; }
  :global(.re-content .ProseMirror table) { border-collapse: collapse; width: 100%; margin: 0.6em 0; font-size: 0.88rem; }
  :global(.re-content .ProseMirror th, .re-content .ProseMirror td) { border: 1px solid var(--bd); padding: 5px 10px; text-align: left; }
  :global(.re-content .ProseMirror th) { background: var(--sf); font-weight: 600; }
  :global(.re-content .ProseMirror ul[data-type="taskList"]) { list-style: none; padding-left: 0.2rem; }
  :global(.re-content .ProseMirror ul[data-type="taskList"] li) { display: flex; align-items: baseline; gap: 6px; }
  :global(.re-content .ProseMirror ul[data-type="taskList"] li > label) { flex-shrink: 0; }
  :global(.re-content .ProseMirror ul[data-type="taskList"] li > label input[type="checkbox"]) { accent-color: var(--ac); }
  :global(.re-content .ProseMirror ul[data-type="taskList"] li[data-checked="true"] > div) { opacity: 0.55; text-decoration: line-through; }
  :global(.re-content .ProseMirror .selectedCell) { background: var(--ac-bg); }

  /* ── Columns ── */
  :global(.re-content .ProseMirror .editor-columns) {
    display: flex; gap: 1.5rem; margin: 0.8em 0;
    border: 1px dashed var(--bd); border-radius: var(--radius-sm); padding: 8px;
  }
  :global(.re-content .ProseMirror .editor-column) { flex: 1; min-width: 0; }

  /* ── Callouts ── */
  :global(.re-content .ProseMirror .callout) {
    border-left: 4px solid; border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
    padding: 10px 14px; margin: 0.8em 0; position: relative;
  }
  :global(.re-content .ProseMirror .callout-info)       { border-color: var(--ac);   background: color-mix(in srgb, var(--ac)   8%, var(--sf)); }
  :global(.re-content .ProseMirror .callout-warning)    { border-color: var(--yw);   background: color-mix(in srgb, var(--yw)   10%, var(--sf)); }
  :global(.re-content .ProseMirror .callout-important)  { border-color: var(--rd);   background: color-mix(in srgb, var(--rd)   8%, var(--sf)); }
  :global(.re-content .ProseMirror .callout-hypothesis) { border-color: var(--pu);   background: color-mix(in srgb, var(--pu)   8%, var(--sf)); }
  :global(.re-content .ProseMirror .callout-result)     { border-color: var(--gn);   background: color-mix(in srgb, var(--gn)   8%, var(--sf)); }

  /* ── ImageBlock NodeView ── */
  :global(.image-block-node) {
    display: block; margin: 1em 0; position: relative; user-select: none;
  }
  :global(.image-block-center) { text-align: center; }
  :global(.image-block-left) { float: left; margin-right: 1.5em; }
  :global(.image-block-right) { float: right; margin-left: 1.5em; }
  :global(.image-block-full) { text-align: center; }

  :global(.image-block-controls) {
    display: none; align-items: center; gap: 4px;
    position: absolute; top: -32px; left: 50%; transform: translateX(-50%);
    background: var(--sf); border: 1px solid var(--bd); border-radius: var(--radius-sm);
    padding: 3px 6px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); z-index: 10;
    white-space: nowrap;
  }
  :global(.image-block-node:hover .image-block-controls) { display: flex; }
  :global(.image-block-node.ProseMirror-selectednode .image-block-controls) { display: flex; }

  :global(.ibctrl) {
    background: transparent; border: none; cursor: pointer; padding: 2px 4px;
    color: var(--tx2); border-radius: 3px; font-size: 0.8rem;
    display: flex; align-items: center;
  }
  :global(.ibctrl:hover) { background: var(--sf2); color: var(--tx); }
  :global(.ibctrl-active) { color: var(--ac) !important; }
  :global(.ibctrl-del) { color: var(--rd) !important; font-size: 15px; }
  :global(.ibctrl-sep) { width: 1px; height: 14px; background: var(--bd); margin: 0 2px; }
  :global(.ibctrl-slider) { width: 60px; accent-color: var(--ac); cursor: pointer; }

  :global(.image-block-img) { max-width: 100%; height: auto; border-radius: var(--radius-sm); display: block; margin: 0 auto; }
  :global(.image-block-caption) {
    display: block; text-align: center; font-size: 0.78rem; color: var(--mu);
    font-style: italic; margin-top: 4px; outline: none; min-height: 1em;
  }
  :global(.image-block-caption:empty::before) { content: attr(data-placeholder); color: var(--mu); pointer-events: none; }

  /* ── AudioClip NodeView ── */
  :global(.audio-clip-node) {
    display: inline-flex; align-items: center; gap: 8px;
    background: color-mix(in srgb, var(--ac) 8%, var(--sf));
    border: 1px solid color-mix(in srgb, var(--ac) 25%, var(--bd));
    border-radius: 20px; padding: 5px 10px 5px 8px;
    margin: 4px 0; max-width: 100%;
  }
  :global(.acn-icon) { color: var(--ac); flex-shrink: 0; display: flex; }
  :global(.acn-info) { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
  :global(.acn-label) { font-size: 0.78rem; font-weight: 600; color: var(--tx); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  :global(.acn-time) { font-size: 0.68rem; color: var(--mu); }
  :global(.acn-play) {
    width: 24px; height: 24px; border-radius: 50%; border: none;
    background: var(--ac); color: #fff; cursor: pointer; flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
    transition: background var(--transition), transform var(--transition);
  }
  :global(.acn-play:hover) { background: color-mix(in srgb, var(--ac) 80%, #000); transform: scale(1.08); }
  :global(.acn-del) { background: transparent; border: none; color: var(--mu); cursor: pointer; font-size: 14px; padding: 0 2px; }
  :global(.acn-del:hover) { color: var(--rd); }

  /* ── Attachment NodeView ── */
  :global(.attachment-block-node) {
    display: inline-flex; align-items: center; gap: 8px;
    background: var(--sf); border: 1px solid var(--bd);
    border-radius: var(--radius-sm); padding: 6px 10px;
    margin: 4px 0; max-width: 100%;
  }
  :global(.abn-icon) { color: var(--tx2); flex-shrink: 0; display: flex; }
  :global(.abn-name) { font-size: 0.82rem; font-weight: 500; color: var(--tx); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; min-width: 0; }
  :global(.abn-size) { font-size: 0.72rem; color: var(--mu); flex-shrink: 0; }
  :global(.abn-dl) { color: var(--ac); display: flex; align-items: center; padding: 2px; flex-shrink: 0; }
  :global(.abn-dl:hover) { color: color-mix(in srgb, var(--ac) 70%, #000); }
  :global(.abn-del) { background: transparent; border: none; color: var(--mu); cursor: pointer; font-size: 14px; padding: 0 2px; flex-shrink: 0; }
  :global(.abn-del:hover) { color: var(--rd); }

  /* ── Embed NodeView ── */
  :global(.embed-block-node) {
    position: relative; margin: 1em 0;
    border: 1px solid var(--bd); border-radius: var(--radius-sm); overflow: hidden;
  }
  :global(.embed-del) {
    position: absolute; top: 6px; right: 6px; z-index: 5;
    background: var(--sf); border: 1px solid var(--bd); border-radius: 4px;
    color: var(--mu); cursor: pointer; font-size: 14px; padding: 1px 6px;
    opacity: 0; transition: opacity var(--transition);
  }
  :global(.embed-block-node:hover .embed-del) { opacity: 1; }
  :global(.embed-del:hover) { color: var(--rd); }

  :global(.embed-video-wrap) { position: relative; padding-bottom: 56.25%; height: 0; }
  :global(.embed-video-wrap iframe) { position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: none; }
  :global(.embed-pdf-wrap) { height: 500px; }
  :global(.embed-pdf-wrap iframe) { width: 100%; height: 100%; border: none; }

  :global(.embed-card) {
    display: flex; text-decoration: none; color: inherit;
    background: var(--sf); transition: background var(--transition);
  }
  :global(.embed-card:hover) { background: var(--sf2); }
  :global(.embed-card-img) { width: 120px; height: 80px; object-fit: cover; flex-shrink: 0; }
  :global(.embed-card-body) { padding: 10px 14px; flex: 1; min-width: 0; }
  :global(.embed-card-host) { display: flex; align-items: center; gap: 5px; margin-bottom: 4px; }
  :global(.embed-fav) { width: 14px; height: 14px; }
  :global(.embed-card-host span) { font-size: 0.72rem; color: var(--mu); }
  :global(.embed-card-title) { font-size: 0.88rem; font-weight: 600; color: var(--tx); overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
  :global(.embed-card-desc) { font-size: 0.76rem; color: var(--tx2); margin-top: 3px; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }

  /* ── Math nodes ── */
  :global(.math-inline-node) {
    display: inline; cursor: pointer; padding: 0 2px;
    background: color-mix(in srgb, var(--pu) 8%, transparent);
    border-radius: 3px;
  }
  :global(.math-inline-node:hover) { background: color-mix(in srgb, var(--pu) 15%, transparent); }

  :global(.math-block-node) {
    display: block; text-align: center; margin: 1em 0;
    padding: 12px; cursor: pointer;
    background: color-mix(in srgb, var(--pu) 5%, var(--sf));
    border: 1px solid color-mix(in srgb, var(--pu) 20%, var(--bd));
    border-radius: var(--radius-sm);
  }
  :global(.math-block-node:hover) { background: color-mix(in srgb, var(--pu) 10%, var(--sf)); }
  :global(.math-block-hint) { font-size: 0.68rem; color: var(--mu); margin-top: 4px; }

  /* KaTeX overrides for dark mode */
  :global(.katex) { font-size: 1em !important; color: var(--tx); }

  /* ── Bubble menu (floating on selection) ── */
  .re-bubble {
    position: fixed;
    transform: translateX(-50%);
    z-index: 200;
    display: flex;
    align-items: center;
    gap: 1px;
    background: var(--sf);
    border: 1px solid var(--bd);
    border-radius: var(--radius-sm);
    box-shadow: 0 4px 16px rgba(0,0,0,0.2);
    padding: 3px 5px;
    pointer-events: all;
    animation: bubble-in 0.1s ease;
  }
  @keyframes bubble-in {
    from { opacity: 0; transform: translateX(-50%) translateY(4px); }
    to   { opacity: 1; transform: translateX(-50%) translateY(0); }
  }
  .re-bubble .re-btn { width: 24px; height: 22px; }
  .re-bubble-sep { width: 1px; height: 14px; background: var(--bd); margin: 0 2px; flex-shrink: 0; }

  /* ── Emoji picker ── */
  .re-emoji-picker {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    z-index: 51;
    background: var(--sf);
    border: 1px solid var(--bd);
    border-radius: var(--radius-sm);
    box-shadow: 0 8px 24px rgba(0,0,0,0.15);
    display: grid;
    grid-template-columns: repeat(12, 1fr);
    gap: 1px;
    padding: 6px;
    width: 300px;
    max-height: 220px;
    overflow-y: auto;
  }
  .re-emoji-btn {
    width: 22px; height: 22px;
    display: flex; align-items: center; justify-content: center;
    font-size: 0.85rem; line-height: 1;
    background: transparent; border: none; cursor: pointer;
    border-radius: 3px;
    transition: background var(--transition);
  }
  .re-emoji-btn:hover { background: var(--sf2); }

  /* ── Mermaid NodeView ── */
  :global(.mermaid-block-node) {
    position: relative;
    margin: 1em 0;
    border: 1px solid var(--bd);
    border-radius: var(--radius-sm);
    background: var(--sf);
    padding: 12px;
    text-align: center;
    user-select: none;
  }
  :global(.mermaid-block-node:hover) { border-color: var(--ac); }
  :global(.mermaid-rendered svg) { max-width: 100%; height: auto; }
  :global(.mermaid-hint) { font-size: 0.68rem; color: var(--mu); margin-top: 6px; }
  :global(.mermaid-del) {
    position: absolute; top: 6px; right: 6px;
    background: var(--sf); border: 1px solid var(--bd);
    border-radius: 4px; color: var(--mu); cursor: pointer;
    font-size: 13px; padding: 1px 6px; opacity: 0;
    transition: opacity var(--transition);
  }
  :global(.mermaid-block-node:hover .mermaid-del) { opacity: 1; }
  :global(.mermaid-del:hover) { color: var(--rd); }
  :global(.mermaid-err) {
    text-align: left; font-size: 0.78rem; color: var(--rd);
    background: var(--rd-bg); border-radius: 4px; padding: 8px;
    font-family: var(--mono); white-space: pre-wrap; overflow-x: auto;
  }

  /* ── Details/collapsible NodeView ── */
  :global(.details-node) {
    border: 1px solid var(--bd);
    border-radius: var(--radius-sm);
    margin: 0.8em 0;
    overflow: hidden;
  }
  :global(.details-header) {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    background: var(--sf);
    border-bottom: 1px solid var(--bd);
    cursor: default;
  }
  :global(.details-open .details-header) { border-bottom: 1px solid var(--bd); }
  :global(.details-node:not(.details-open) .details-header) { border-bottom: none; }
  :global(.details-toggle-btn) {
    background: transparent; border: none;
    color: var(--mu); cursor: pointer;
    padding: 2px; display: flex; align-items: center;
    flex-shrink: 0;
    transition: color var(--transition);
  }
  :global(.details-toggle-btn:hover) { color: var(--ac); }
  :global(.details-summary-text) {
    font-size: 0.88rem; font-weight: 600; color: var(--tx);
    outline: none; flex: 1; cursor: text;
  }
  :global(.details-summary-text:focus) { color: var(--ac); }
  :global(.details-content) {
    padding: 10px 14px;
    background: var(--bg);
  }
</style>
