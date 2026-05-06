<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { Editor } from '@tiptap/core';
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
  import { Placeholder } from '@tiptap/extension-placeholder';
  import { marked } from 'marked';

  export interface SlashRef {
    getEditor: () => Editor | null;
    insertNoteLink: (id: string, title: string, from: number, to: number) => void;
  }

  let {
    value = $bindable(''),
    placeholder = 'Start writing…',
    minHeight = '120px',
    onchange,
    onSlashQuery,
    onSlashClose,
    slashRef = $bindable<SlashRef | null>(null),
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
    class?: string;
  } = $props();

  let editorEl: HTMLElement;
  let editor: Editor | null = null;
  let mounted = $state(false);

  function htmlFromValue(v: string): string {
    if (!v) return '';
    if (v.trimStart().startsWith('<')) return v;
    // Convert legacy markdown to HTML
    return marked.parse(v) as string;
  }

  onMount(() => {
    editor = new Editor({
      element: editorEl,
      extensions: [
        StarterKit.configure({ codeBlock: { languageClassPrefix: 'language-' } }),
        Underline,
        Highlight.configure({ multicolor: false }),
        Link.configure({ openOnClick: false }),
        TaskList,
        TaskItem.configure({ nested: true }),
        Table.configure({ resizable: false }),
        TableRow,
        TableHeader,
        TableCell,
        TextAlign.configure({ types: ['heading', 'paragraph'] }),
        TextStyle,
        Placeholder.configure({ placeholder }),
      ],
      content: htmlFromValue(value),
      onUpdate: ({ editor: e }) => {
        const html = e.getHTML();
        value = html;
        onchange?.(html);
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
      insertNoteLink: (id: string, title: string, from: number, to: number) => {
        if (!editor) return;
        editor.chain()
          .focus()
          .deleteRange({ from, to })
          .insertContent({
            type: 'text',
            text: title,
            marks: [{ type: 'link', attrs: { href: `note:${id}`, target: null, class: 'note-internal-link' } }]
          })
          .insertContent(' ')
          .run();
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
    // Match / preceded by start-of-string, newline, or whitespace
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

  onDestroy(() => {
    editor?.destroy();
  });

  // Keep editor in sync when value changes externally
  $effect(() => {
    if (!editor || !mounted) return;
    const current = editor.getHTML();
    const incoming = htmlFromValue(value);
    if (incoming !== current) {
      editor.commands.setContent(incoming, false);
    }
  });

  function cmd(name: string, attrs?: Record<string, unknown>) {
    if (!editor) return;
    const chain = editor.chain().focus();
    (chain as any)[name]?.(attrs)?.run?.();
    editor.commands.focus();
  }

  function isActive(name: string, attrs?: Record<string, unknown>) {
    return editor?.isActive(name, attrs) ?? false;
  }

  function setLink() {
    if (!editor) return;
    const prev = editor.getAttributes('link').href ?? '';
    const url = prompt('URL:', prev);
    if (url === null) return;
    if (url === '') {
      editor.chain().focus().unsetLink().run();
    } else {
      editor.chain().focus().setLink({ href: url }).run();
    }
  }

  function insertTable() {
    editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
  }
</script>

<div class="rich-editor {extraClass}">
  <!-- Toolbar -->
  {#if mounted && editor}
  <div class="re-toolbar">
    <div class="re-group">
      <button type="button" class="re-btn" class:re-active={isActive('bold')} onclick={() => cmd('toggleBold')} title="Bold (Ctrl+B)"><b>B</b></button>
      <button type="button" class="re-btn" class:re-active={isActive('italic')} onclick={() => cmd('toggleItalic')} title="Italic (Ctrl+I)"><i>I</i></button>
      <button type="button" class="re-btn re-u" class:re-active={isActive('underline')} onclick={() => cmd('toggleUnderline')} title="Underline (Ctrl+U)">U</button>
      <button type="button" class="re-btn re-s" class:re-active={isActive('strike')} onclick={() => cmd('toggleStrike')} title="Strikethrough"><s>S</s></button>
    </div>
    <div class="re-sep"></div>
    <div class="re-group">
      <button type="button" class="re-btn" class:re-active={isActive('heading', { level: 1 })} onclick={() => cmd('toggleHeading', { level: 1 })} title="Heading 1">H1</button>
      <button type="button" class="re-btn" class:re-active={isActive('heading', { level: 2 })} onclick={() => cmd('toggleHeading', { level: 2 })} title="Heading 2">H2</button>
      <button type="button" class="re-btn" class:re-active={isActive('heading', { level: 3 })} onclick={() => cmd('toggleHeading', { level: 3 })} title="Heading 3">H3</button>
    </div>
    <div class="re-sep"></div>
    <div class="re-group">
      <button type="button" class="re-btn" class:re-active={isActive('bulletList')} onclick={() => cmd('toggleBulletList')} title="Bullet list">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><line x1="9" y1="6" x2="20" y2="6"/><line x1="9" y1="12" x2="20" y2="12"/><line x1="9" y1="18" x2="20" y2="18"/><circle cx="4" cy="6" r="1.5" fill="currentColor" stroke="none"/><circle cx="4" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="4" cy="18" r="1.5" fill="currentColor" stroke="none"/></svg>
      </button>
      <button type="button" class="re-btn" class:re-active={isActive('orderedList')} onclick={() => cmd('toggleOrderedList')} title="Ordered list">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><line x1="10" y1="6" x2="21" y2="6"/><line x1="10" y1="12" x2="21" y2="12"/><line x1="10" y1="18" x2="21" y2="18"/><path d="M4 6h1v4" stroke="currentColor"/><path d="M4 10h2" stroke="currentColor"/><path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1" stroke="currentColor"/></svg>
      </button>
      <button type="button" class="re-btn" class:re-active={isActive('taskList')} onclick={() => cmd('toggleTaskList')} title="Task list">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="3" y="5" width="4" height="4" rx="0.5"/><polyline points="4 7 5 8 7 6"/><line x1="10" y1="7" x2="21" y2="7"/><rect x="3" y="14" width="4" height="4" rx="0.5"/><line x1="10" y1="16" x2="21" y2="16"/></svg>
      </button>
    </div>
    <div class="re-sep"></div>
    <div class="re-group">
      <button type="button" class="re-btn" class:re-active={isActive('blockquote')} onclick={() => cmd('toggleBlockquote')} title="Blockquote">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1zm12 0c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z"/></svg>
      </button>
      <button type="button" class="re-btn" class:re-active={isActive('code')} onclick={() => cmd('toggleCode')} title="Inline code">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
      </button>
      <button type="button" class="re-btn" class:re-active={isActive('codeBlock')} onclick={() => cmd('toggleCodeBlock')} title="Code block">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="2" y="4" width="20" height="16" rx="2"/><polyline points="9 9 5 12 9 15"/><polyline points="15 9 19 12 15 15"/></svg>
      </button>
      <button type="button" class="re-btn" class:re-active={isActive('highlight')} onclick={() => cmd('toggleHighlight')} title="Highlight">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M9 11l-4 4 2 4h8l2-4-4-4z"/><path d="M14.5 7l2.5 2.5-8 8"/><path d="M17 5l2 2"/></svg>
      </button>
    </div>
    <div class="re-sep"></div>
    <div class="re-group">
      <button type="button" class="re-btn" class:re-active={isActive('link')} onclick={setLink} title="Link">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>
      </button>
      <button type="button" class="re-btn" onclick={insertTable} title="Insert table">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/></svg>
      </button>
    </div>
    <div class="re-sep"></div>
    <div class="re-group">
      <button type="button" class="re-btn" onclick={() => cmd('undo')} title="Undo">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M3 7v6h6"/><path d="M3 13a9 9 0 109-9 9 9 0 00-6 2.3L3 9"/></svg>
      </button>
      <button type="button" class="re-btn" onclick={() => cmd('redo')} title="Redo">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21 7v6h-6"/><path d="M21 13a9 9 0 11-9-9 9 9 0 016 2.3L21 9"/></svg>
      </button>
    </div>
  </div>
  {/if}

  <div
    bind:this={editorEl}
    class="re-content"
    style="min-height: {minHeight}"
  ></div>
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
    display: flex;
    align-items: center;
    gap: 2px;
    padding: 5px 8px;
    border-bottom: 1px solid var(--bd);
    background: var(--sf);
    flex-wrap: wrap;
  }

  .re-group { display: flex; align-items: center; gap: 1px; }
  .re-sep { width: 1px; height: 16px; background: var(--bd); margin: 0 3px; flex-shrink: 0; }

  .re-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 24px;
    border: none;
    background: transparent;
    color: var(--tx2);
    border-radius: 4px;
    font-size: 0.78rem;
    font-weight: 700;
    cursor: pointer;
    transition: background var(--transition), color var(--transition);
    flex-shrink: 0;
  }
  .re-btn:hover { background: var(--sf2); color: var(--tx); }
  .re-active { background: var(--ac-bg) !important; color: var(--ac) !important; }
  .re-u { text-decoration: underline; }

  .re-content {
    padding: 12px 14px;
    outline: none;
    font-size: 0.9rem;
    line-height: 1.7;
    color: var(--tx);
    overflow-y: auto;
    cursor: text;
  }

  /* ProseMirror placeholder */
  :global(.re-content .ProseMirror p.is-editor-empty:first-child::before) {
    content: attr(data-placeholder);
    color: var(--mu);
    pointer-events: none;
    position: absolute;
  }
  :global(.re-content .ProseMirror) {
    outline: none;
    min-height: inherit;
  }

  /* Content styles */
  :global(.re-content .ProseMirror h1) { font-size: 1.5rem; font-weight: 700; margin: 1rem 0 0.4rem; color: var(--tx); }
  :global(.re-content .ProseMirror h2) { font-size: 1.2rem; font-weight: 700; margin: 0.9rem 0 0.35rem; color: var(--tx); }
  :global(.re-content .ProseMirror h3) { font-size: 1rem; font-weight: 700; margin: 0.8rem 0 0.3rem; color: var(--tx); }
  :global(.re-content .ProseMirror p) { margin: 0 0 0.6em; }
  :global(.re-content .ProseMirror p:last-child) { margin-bottom: 0; }
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

  /* Selected table cell */
  :global(.re-content .ProseMirror .selectedCell) { background: var(--ac-bg); }
</style>
