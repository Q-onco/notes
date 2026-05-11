import { Node, Extension, mergeAttributes, InputRule } from '@tiptap/core';
import { Plugin } from 'prosemirror-state';
import { Image } from '@tiptap/extension-image';
import katex from 'katex';

export type UploadFn = (file: File, prefix?: string) => Promise<{ key: string }>;

const WORKER_BASE = () => {
  try { return (window as any).__qonco_worker ?? 'https://enzo.quant-onco.workers.dev'; } catch { return 'https://enzo.quant-onco.workers.dev'; }
};

// ─── ImageBlock ────────────────────────────────────────────────────────────────
// Extends the base Image with alignment, width, and caption via a NodeView.

export function createImageBlock(opts: { onUpload: UploadFn }) {
  return Image.extend({
    name: 'imageBlock',

    addAttributes() {
      return {
        src:     { default: null,     parseHTML: el => el.querySelector('img')?.getAttribute('src') ?? null },
        alt:     { default: '',       parseHTML: el => el.querySelector('img')?.getAttribute('alt') ?? '' },
        align:   { default: 'center', parseHTML: el => el.getAttribute('data-align') ?? 'center' },
        width:   { default: 80,       parseHTML: el => parseInt(el.getAttribute('data-width') ?? '80', 10) },
        caption: { default: '',       parseHTML: el => el.querySelector('figcaption')?.textContent ?? '' },
      };
    },

    parseHTML() {
      return [{ tag: 'figure[data-type="image-block"]' }];
    },

    renderHTML({ HTMLAttributes }) {
      const { src, alt, align, width, caption } = HTMLAttributes;
      return ['figure', { 'data-type': 'image-block', 'data-align': align, 'data-width': width, 'data-caption': caption },
        ['img', { src, alt }],
        ['figcaption', {}, caption ?? ''],
      ];
    },

    addNodeView() {
      return ({ node, editor, getPos }) => {
        const wrap = document.createElement('figure');
        wrap.className = 'image-block-node';

        const controls = document.createElement('div');
        controls.className = 'image-block-controls';

        const img = document.createElement('img');
        img.className = 'image-block-img';

        const caption = document.createElement('figcaption');
        caption.className = 'image-block-caption';
        caption.contentEditable = 'true';
        caption.setAttribute('data-placeholder', 'Caption (optional)…');
        caption.addEventListener('blur', () => {
          if (typeof getPos !== 'function') return;
          editor.chain().setNodeSelection(getPos()).updateAttributes('imageBlock', { caption: caption.textContent ?? '' }).run();
        });
        caption.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); caption.blur(); } });

        const render = (n: typeof node) => {
          img.src = n.attrs.src ?? '';
          img.alt = n.attrs.alt ?? '';
          img.style.width = `${n.attrs.width ?? 80}%`;
          caption.textContent = n.attrs.caption ?? '';
          wrap.className = `image-block-node image-block-${n.attrs.align ?? 'center'}`;
        };
        render(node);

        // Alignment + width controls
        const alignIcons: Record<string, string> = {
          left:   `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="6" x2="15" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="15" y2="18"/></svg>`,
          center: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="6" y1="6" x2="18" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="6" y1="18" x2="18" y2="18"/></svg>`,
          right:  `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="9" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="9" y1="18" x2="21" y2="18"/></svg>`,
          full:   `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="5" width="20" height="14" rx="1"/></svg>`,
        };
        (['left','center','right','full'] as const).forEach(a => {
          const btn = document.createElement('button');
          btn.className = `ibctrl ${node.attrs.align === a ? 'ibctrl-active' : ''}`;
          btn.title = `Align ${a}`;
          btn.innerHTML = alignIcons[a];
          btn.addEventListener('mousedown', (e) => {
            e.preventDefault();
            if (typeof getPos !== 'function') return;
            const w = a === 'full' ? 100 : a === 'center' ? 80 : 50;
            editor.chain().setNodeSelection(getPos()).updateAttributes('imageBlock', { align: a, width: w }).run();
          });
          controls.appendChild(btn);
        });

        const sep = document.createElement('span'); sep.className = 'ibctrl-sep'; controls.appendChild(sep);

        const slider = document.createElement('input');
        slider.type = 'range'; slider.min = '20'; slider.max = '100'; slider.step = '5';
        slider.value = String(node.attrs.width ?? 80);
        slider.className = 'ibctrl-slider'; slider.title = 'Width';
        slider.addEventListener('mousedown', e => e.stopPropagation());
        slider.addEventListener('input', (e) => {
          img.style.width = `${(e.target as HTMLInputElement).value}%`;
          if (typeof getPos !== 'function') return;
          editor.chain().setNodeSelection(getPos()).updateAttributes('imageBlock', { width: parseInt((e.target as HTMLInputElement).value) }).run();
        });
        controls.appendChild(slider);

        const sep2 = document.createElement('span'); sep2.className = 'ibctrl-sep'; controls.appendChild(sep2);

        const del = document.createElement('button');
        del.className = 'ibctrl ibctrl-del'; del.title = 'Delete image'; del.textContent = '×';
        del.addEventListener('mousedown', (e) => {
          e.preventDefault();
          if (typeof getPos !== 'function') return;
          editor.chain().deleteRange({ from: getPos(), to: getPos() + node.nodeSize }).run();
        });
        controls.appendChild(del);

        wrap.appendChild(controls);
        wrap.appendChild(img);
        wrap.appendChild(caption);

        return {
          dom: wrap,
          update: (n) => { render(n); return true; },
          stopEvent: (e) => {
            if (e.target === caption) return true;
            if ((e.target as HTMLElement)?.closest?.('.ibctrl-slider')) return true;
            return false;
          },
          ignoreMutation: () => true,
        };
      };
    },

    // Paste handler for images: intercept and upload
    addProseMirrorPlugins() {
      const upload = opts.onUpload;
      const ext = this;
      return [
        new Plugin({
          props: {
            handlePaste: (_view, event: ClipboardEvent) => {
              const items = event.clipboardData?.items;
              if (!items) return false;
              for (const item of Array.from(items)) {
                if (item.type.startsWith('image/')) {
                  event.preventDefault();
                  const file = item.getAsFile();
                  if (!file) continue;
                  upload(file, 'note-images').then(({ key }) => {
                    const url = `${WORKER_BASE()}/file/${key}`;
                    ext.editor.chain().focus().insertContent({
                      type: 'imageBlock',
                      attrs: { src: url, alt: file.name, align: 'center', width: 80 }
                    }).run();
                  });
                  return true;
                }
              }
              return false;
            },
            handleDrop: (_view, event: DragEvent) => {
              const files = event.dataTransfer?.files;
              if (!files?.length) return false;
              for (const file of Array.from(files)) {
                if (file.type.startsWith('image/')) {
                  event.preventDefault();
                  upload(file, 'note-images').then(({ key }) => {
                    const url = `${WORKER_BASE()}/file/${key}`;
                    ext.editor.chain().focus().insertContent({
                      type: 'imageBlock',
                      attrs: { src: url, alt: file.name, align: 'center', width: 80 }
                    }).run();
                  });
                  return true;
                }
              }
              return false;
            },
          }
        })
      ];
    }
  });
}

// ─── AudioClip ─────────────────────────────────────────────────────────────────
// Inline audio player node. Inserted programmatically after recording.

export function createAudioClipExtension() {
  return Node.create({
    name: 'audioClip',
    group: 'block',
    atom: true,
    draggable: true,

    addAttributes() {
      return {
        r2Key:       { default: '' },
        durationSec: { default: 0 },
        mimeType:    { default: 'audio/webm' },
        label:       { default: '' },
      };
    },

    parseHTML() {
      return [{ tag: 'div[data-type="audio-clip"]' }];
    },

    renderHTML({ HTMLAttributes }) {
      return ['div', mergeAttributes({ 'data-type': 'audio-clip' }, HTMLAttributes)];
    },

    addNodeView() {
      return ({ node, editor, getPos }) => {
        const dom = document.createElement('div');
        dom.className = 'audio-clip-node';

        const render = (n: typeof node) => {
          const url = n.attrs.r2Key ? `${WORKER_BASE()}/file/${n.attrs.r2Key}` : '';
          const dur = n.attrs.durationSec ?? 0;
          const label = n.attrs.label || 'Voice note';
          const mins = Math.floor(dur / 60);
          const secs = Math.round(dur % 60).toString().padStart(2, '0');

          dom.innerHTML = '';

          const icon = document.createElement('div');
          icon.className = 'acn-icon';
          icon.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8"/></svg>`;

          const info = document.createElement('div');
          info.className = 'acn-info';
          const lbl = document.createElement('span'); lbl.className = 'acn-label'; lbl.textContent = label;
          const time = document.createElement('span'); time.className = 'acn-time'; time.textContent = `${mins}:${secs}`;
          info.appendChild(lbl); info.appendChild(time);

          let audio: HTMLAudioElement | null = null;
          const playBtn = document.createElement('button');
          playBtn.className = 'acn-play';
          playBtn.title = 'Play';
          playBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>`;
          playBtn.addEventListener('click', () => {
            if (!url) return;
            if (!audio) {
              audio = new Audio(url);
              audio.addEventListener('ended', () => {
                playBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>`;
              });
            }
            if (audio.paused) {
              audio.play();
              playBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>`;
            } else {
              audio.pause();
              playBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>`;
            }
          });

          const del = document.createElement('button');
          del.className = 'acn-del'; del.title = 'Remove'; del.textContent = '×';
          del.addEventListener('mousedown', (e) => {
            e.preventDefault();
            if (typeof getPos !== 'function') return;
            editor.chain().deleteRange({ from: getPos(), to: getPos() + node.nodeSize }).run();
          });

          dom.appendChild(icon);
          dom.appendChild(info);
          dom.appendChild(playBtn);
          dom.appendChild(del);
        };
        render(node);

        return {
          dom,
          update: (n) => { render(n); return true; },
          stopEvent: () => false,
          ignoreMutation: () => true,
        };
      };
    },
  });
}

// ─── EmbedBlock ────────────────────────────────────────────────────────────────
// Rich URL embed: YouTube, tweets, PDFs, or generic link-preview cards.

export function createEmbedBlock() {
  return Node.create({
    name: 'embedBlock',
    group: 'block',
    atom: true,
    draggable: true,

    addAttributes() {
      return {
        url:         { default: '' },
        type:        { default: 'generic' },
        videoId:     { default: '' },
        tweetId:     { default: '' },
        title:       { default: '' },
        description: { default: '' },
        image:       { default: '' },
        favicon:     { default: '' },
        hostname:    { default: '' },
      };
    },

    parseHTML() {
      return [{ tag: 'div[data-type="embed-block"]' }];
    },

    renderHTML({ HTMLAttributes }) {
      return ['div', mergeAttributes({ 'data-type': 'embed-block' }, HTMLAttributes)];
    },

    addNodeView() {
      return ({ node, editor, getPos }) => {
        const dom = document.createElement('div');
        dom.className = 'embed-block-node';
        dom.setAttribute('contenteditable', 'false');

        const render = (n: typeof node) => {
          dom.innerHTML = '';
          const { type, url, videoId, title, description, image, favicon, hostname } = n.attrs;

          const del = document.createElement('button');
          del.className = 'embed-del'; del.title = 'Remove embed'; del.textContent = '×';
          del.addEventListener('mousedown', (e) => {
            e.preventDefault();
            if (typeof getPos !== 'function') return;
            editor.chain().deleteRange({ from: getPos(), to: getPos() + n.nodeSize }).run();
          });
          dom.appendChild(del);

          if (type === 'youtube' && videoId) {
            const wrap = document.createElement('div'); wrap.className = 'embed-video-wrap';
            const frame = document.createElement('iframe');
            frame.src = `https://www.youtube.com/embed/${videoId}`;
            frame.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
            frame.allowFullscreen = true;
            frame.loading = 'lazy';
            wrap.appendChild(frame); dom.appendChild(wrap);
          } else if (type === 'pdf' && url) {
            const wrap = document.createElement('div'); wrap.className = 'embed-pdf-wrap';
            const frame = document.createElement('iframe');
            frame.src = url; frame.title = title || 'PDF';
            wrap.appendChild(frame); dom.appendChild(wrap);
          } else {
            // Generic link card
            const card = document.createElement('a');
            card.className = 'embed-card'; card.href = url; card.target = '_blank'; card.rel = 'noopener noreferrer';
            if (image) {
              const img = document.createElement('img');
              img.className = 'embed-card-img'; img.src = image; img.alt = '';
              img.onerror = () => img.remove();
              card.appendChild(img);
            }
            const body = document.createElement('div'); body.className = 'embed-card-body';
            const host = document.createElement('div'); host.className = 'embed-card-host';
            if (favicon) { const fav = document.createElement('img'); fav.className = 'embed-fav'; fav.src = favicon; fav.alt = ''; host.appendChild(fav); }
            const hn = document.createElement('span'); hn.textContent = hostname || new URL(url || 'https://x.com').hostname; host.appendChild(hn);
            const ttl = document.createElement('div'); ttl.className = 'embed-card-title'; ttl.textContent = title || url;
            const desc = document.createElement('div'); desc.className = 'embed-card-desc'; desc.textContent = description || '';
            body.appendChild(host); body.appendChild(ttl); if (description) body.appendChild(desc);
            card.appendChild(body); dom.appendChild(card);
          }
        };
        render(node);

        return {
          dom,
          update: (n) => { render(n); return true; },
          stopEvent: () => false,
          ignoreMutation: () => true,
        };
      };
    },
  });
}

// ─── AttachmentBlock ───────────────────────────────────────────────────────────
// File attachment chip rendered inline in the note body.

export function createAttachmentBlock() {
  return Node.create({
    name: 'attachmentBlock',
    group: 'block',
    atom: true,
    draggable: true,

    addAttributes() {
      return {
        r2Key:    { default: '' },
        name:     { default: 'file' },
        size:     { default: 0 },
        mimeType: { default: 'application/octet-stream' },
      };
    },

    parseHTML() {
      return [{ tag: 'div[data-type="attachment-block"]' }];
    },

    renderHTML({ HTMLAttributes }) {
      return ['div', mergeAttributes({ 'data-type': 'attachment-block' }, HTMLAttributes)];
    },

    addNodeView() {
      return ({ node, editor, getPos }) => {
        const dom = document.createElement('div');
        dom.className = 'attachment-block-node';

        const render = (n: typeof node) => {
          dom.innerHTML = '';
          const { r2Key, name, size, mimeType } = n.attrs;
          const url = r2Key ? `${WORKER_BASE()}/file/${r2Key}` : '';
          const sizeStr = size > 1048576 ? `${(size / 1048576).toFixed(1)} MB` : size > 1024 ? `${(size / 1024).toFixed(0)} KB` : `${size} B`;

          const iconSvg = mimeType?.startsWith('image/') ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`
            : mimeType?.startsWith('video/') ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>`
            : `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`;

          const icon = document.createElement('span'); icon.className = 'abn-icon'; icon.innerHTML = iconSvg;
          const info = document.createElement('span'); info.className = 'abn-name'; info.textContent = name;
          const sz = document.createElement('span'); sz.className = 'abn-size'; sz.textContent = sizeStr;

          const dl = document.createElement('a');
          dl.className = 'abn-dl'; dl.href = url; dl.download = name; dl.target = '_blank';
          dl.title = 'Download'; dl.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`;

          const del = document.createElement('button');
          del.className = 'abn-del'; del.title = 'Remove'; del.textContent = '×';
          del.addEventListener('mousedown', (e) => {
            e.preventDefault();
            if (typeof getPos !== 'function') return;
            editor.chain().deleteRange({ from: getPos(), to: getPos() + n.nodeSize }).run();
          });

          dom.appendChild(icon); dom.appendChild(info); dom.appendChild(sz); dom.appendChild(dl); dom.appendChild(del);
        };
        render(node);

        return {
          dom,
          update: (n) => { render(n); return true; },
          stopEvent: () => false,
          ignoreMutation: () => true,
        };
      };
    },
  });
}

// ─── Callout ───────────────────────────────────────────────────────────────────
// Styled callout block (Info / Warning / Hypothesis / Result / Important).
// Content-bearing node so the user can type inside it.

export const CalloutExtension = Node.create({
  name: 'callout',
  group: 'block',
  content: 'block+',

  addAttributes() {
    return { type: { default: 'info' } };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="callout"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes({ 'data-type': 'callout', class: `callout callout-${HTMLAttributes.type ?? 'info'}` }, HTMLAttributes), 0];
  },
});

// ─── InlineMath ────────────────────────────────────────────────────────────────
// Renders $formula$ with KaTeX. Click the rendered node to edit the formula.

export const InlineMathExtension = Node.create({
  name: 'inlineMath',
  group: 'inline',
  inline: true,
  atom: true,

  addAttributes() {
    return { formula: { default: '' } };
  },

  parseHTML() {
    return [{ tag: 'span[data-type="math-inline"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes({ 'data-type': 'math-inline', 'data-formula': HTMLAttributes.formula }, HTMLAttributes)];
  },

  addNodeView() {
    return ({ node, editor, getPos }) => {
      const dom = document.createElement('span');
      dom.className = 'math-inline-node';
      dom.setAttribute('contenteditable', 'false');

      const renderMath = (formula: string) => {
        try {
          dom.innerHTML = katex.renderToString(formula || '\\square', { throwOnError: false, displayMode: false });
        } catch {
          dom.textContent = `$${formula}$`;
        }
      };
      renderMath(node.attrs.formula);

      dom.addEventListener('dblclick', () => {
        const formula = prompt('LaTeX formula:', node.attrs.formula);
        if (formula !== null && typeof getPos === 'function') {
          editor.chain().setNodeSelection(getPos()).updateAttributes('inlineMath', { formula }).run();
        }
      });

      return {
        dom,
        update: (n) => { renderMath(n.attrs.formula); return true; },
        stopEvent: () => false,
        ignoreMutation: () => true,
      };
    };
  },

  addInputRules() {
    return [
      new InputRule({
        find: /(?:^|\s)\$([^$\n]+)\$(?:\s|$)/,
        handler: ({ state, range, match }) => {
          const formula = match[1]?.trim();
          if (!formula) return;
          const node = state.schema.nodes.inlineMath?.create({ formula });
          if (!node) return;
          const tr = state.tr.replaceWith(range.from, range.to, [node, state.schema.text(' ')]);
          state.tr = tr;
        },
      }),
    ];
  },
});

// ─── BlockMath ─────────────────────────────────────────────────────────────────
// Display-mode KaTeX block. Double-click to edit formula.

export const BlockMathExtension = Node.create({
  name: 'blockMath',
  group: 'block',
  atom: true,

  addAttributes() {
    return { formula: { default: '' } };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="math-block"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes({ 'data-type': 'math-block', 'data-formula': HTMLAttributes.formula }, HTMLAttributes)];
  },

  addNodeView() {
    return ({ node, editor, getPos }) => {
      const dom = document.createElement('div');
      dom.className = 'math-block-node';
      dom.setAttribute('contenteditable', 'false');

      const rendered = document.createElement('div');
      rendered.className = 'math-block-rendered';
      const hint = document.createElement('div');
      hint.className = 'math-block-hint';
      hint.textContent = 'Double-click to edit formula';
      dom.appendChild(rendered); dom.appendChild(hint);

      const renderMath = (formula: string) => {
        try {
          rendered.innerHTML = katex.renderToString(formula || '\\square', { throwOnError: false, displayMode: true });
        } catch {
          rendered.textContent = `$$${formula}$$`;
        }
      };
      renderMath(node.attrs.formula);

      dom.addEventListener('dblclick', () => {
        const formula = prompt('LaTeX formula (display mode):', node.attrs.formula);
        if (formula !== null && typeof getPos === 'function') {
          editor.chain().setNodeSelection(getPos()).updateAttributes('blockMath', { formula }).run();
        }
      });

      return {
        dom,
        update: (n) => { renderMath(n.attrs.formula); return true; },
        stopEvent: () => false,
        ignoreMutation: () => true,
      };
    };
  },

  addInputRules() {
    return [
      new InputRule({
        find: /^\$\$([^$]*)\$\$$/,
        handler: ({ state, range, match }) => {
          const formula = match[1]?.trim();
          if (!formula) return;
          const node = state.schema.nodes.blockMath?.create({ formula });
          if (!node) return;
          state.tr.replaceWith(range.from, range.to, node);
        },
      }),
    ];
  },
});

// ─── Columns ───────────────────────────────────────────────────────────────────
// Two-column layout. Each column is a content-bearing sub-node.

export const ColumnExtension = Node.create({
  name: 'column',
  group: 'block',
  content: 'block+',
  isolating: true,
  defining: true,

  parseHTML() {
    return [{ tag: 'div[data-type="column"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes({ 'data-type': 'column', class: 'editor-column' }, HTMLAttributes), 0];
  },
});

export const ColumnsExtension = Node.create({
  name: 'columns',
  group: 'block',
  content: 'column column',

  parseHTML() {
    return [{ tag: 'div[data-type="columns"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes({ 'data-type': 'columns', class: 'editor-columns' }, HTMLAttributes), 0];
  },
});

// ─── MermaidBlock ──────────────────────────────────────────────────────────────
// Renders a Mermaid diagram. Double-click to edit the source code.

export const MermaidBlockExtension = Node.create({
  name: 'mermaidBlock',
  group: 'block',
  atom: true,
  draggable: true,

  addAttributes() {
    return { code: { default: 'graph TD\n  A[Start] --> B[End]' } };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="mermaid-block"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes({ 'data-type': 'mermaid-block' }, HTMLAttributes)];
  },

  addNodeView() {
    return ({ node, editor, getPos }) => {
      const dom = document.createElement('div');
      dom.className = 'mermaid-block-node';
      dom.setAttribute('contenteditable', 'false');

      const rendered = document.createElement('div');
      rendered.className = 'mermaid-rendered';
      const hint = document.createElement('div');
      hint.className = 'mermaid-hint';
      hint.textContent = 'Double-click to edit diagram';

      const del = document.createElement('button');
      del.className = 'mermaid-del';
      del.title = 'Remove';
      del.textContent = '×';
      del.addEventListener('mousedown', (e) => {
        e.preventDefault();
        if (typeof getPos !== 'function') return;
        editor.chain().deleteRange({ from: getPos(), to: getPos() + node.nodeSize }).run();
      });

      dom.appendChild(del);
      dom.appendChild(rendered);
      dom.appendChild(hint);

      let uid = 0;
      const renderDiagram = async (code: string) => {
        try {
          const m = await import('mermaid');
          const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
          m.default.initialize({ startOnLoad: false, theme: isDark ? 'dark' : 'default', securityLevel: 'loose', fontFamily: 'inherit' });
          const id = `mmid-${Date.now()}-${++uid}`;
          const { svg } = await m.default.render(id, code);
          rendered.innerHTML = svg;
        } catch {
          rendered.innerHTML = `<pre class="mermaid-err">${code.replace(/</g, '&lt;')}</pre>`;
        }
      };
      renderDiagram(node.attrs.code);

      dom.addEventListener('dblclick', () => {
        const code = prompt('Mermaid diagram code:', node.attrs.code);
        if (code !== null && typeof getPos === 'function') {
          editor.chain().setNodeSelection(getPos()).updateAttributes('mermaidBlock', { code }).run();
        }
      });

      return {
        dom,
        update: (n) => { renderDiagram(n.attrs.code); return true; },
        stopEvent: () => false,
        ignoreMutation: () => true,
      };
    };
  },

  addInputRules() {
    return [
      new InputRule({
        find: /^```mermaid\s*$/,
        handler: ({ state, range }) => {
          const node = state.schema.nodes.mermaidBlock?.create({ code: 'graph TD\n  A[Start] --> B[End]' });
          if (!node) return;
          state.tr.replaceWith(range.from, range.to, node);
        },
      }),
    ];
  },
});

// ─── Details (collapsible section) ────────────────────────────────────────────
// A toggleable block whose content is always in the document; hidden via
// display:none when collapsed so ProseMirror never loses it.

export const DetailsExtension = Node.create({
  name: 'details',
  group: 'block',
  content: 'block+',
  defining: true,
  isolating: true,

  addAttributes() {
    return {
      open:    { default: true },
      summary: { default: 'Click to expand' },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="details"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes({ 'data-type': 'details', class: 'details-node' }, HTMLAttributes), 0];
  },

  addNodeView() {
    return ({ node, editor, getPos }) => {
      const dom = document.createElement('div');
      dom.className = 'details-node';

      const header = document.createElement('div');
      header.className = 'details-header';

      const toggleBtn = document.createElement('button');
      toggleBtn.className = 'details-toggle-btn';
      toggleBtn.type = 'button';

      const summaryEl = document.createElement('span');
      summaryEl.className = 'details-summary-text';
      summaryEl.contentEditable = 'true';

      const content = document.createElement('div');
      content.className = 'details-content';

      let currentOpen = node.attrs.open;

      const render = (n: typeof node) => {
        currentOpen = n.attrs.open;
        toggleBtn.innerHTML = currentOpen
          ? `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>`
          : `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 6 15 12 9 18"/></svg>`;
        summaryEl.textContent = n.attrs.summary || 'Click to expand';
        content.style.display = currentOpen ? '' : 'none';
        dom.classList.toggle('details-open', currentOpen);
      };
      render(node);

      toggleBtn.addEventListener('mousedown', (e) => {
        e.preventDefault();
        if (typeof getPos !== 'function') return;
        editor.chain().setNodeSelection(getPos()).updateAttributes('details', { open: !currentOpen }).run();
      });

      summaryEl.addEventListener('blur', () => {
        if (typeof getPos !== 'function') return;
        editor.chain().setNodeSelection(getPos()).updateAttributes('details', { summary: summaryEl.textContent ?? '' }).run();
      });

      summaryEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); summaryEl.blur(); }
        e.stopPropagation();
      });

      header.appendChild(toggleBtn);
      header.appendChild(summaryEl);
      dom.appendChild(header);
      dom.appendChild(content);

      return {
        dom,
        contentDOM: content,
        update: (n) => { render(n); return true; },
        stopEvent: (e) => {
          if ((e.target as Node) === summaryEl || summaryEl.contains(e.target as Node)) return true;
          return false;
        },
        ignoreMutation: (mutation) => {
          if ((mutation.target as Node) === summaryEl || summaryEl.contains(mutation.target as Node)) return true;
          return false;
        },
      };
    };
  },
});

// ─── GlobalDragHandle ──────────────────────────────────────────────────────────
// Floating ⠿ handle that appears on hover and lets you drag any top-level block.

export const GlobalDragHandle = Extension.create({
  name: 'globalDragHandle',

  addProseMirrorPlugins() {
    let handle: HTMLElement | null = null;
    let dragPos = -1;

    return [new Plugin({
      view(editorView) {
        handle = document.createElement('div');
        handle.className = 'pm-drag-handle';
        handle.setAttribute('draggable', 'true');
        handle.textContent = '⠿';
        document.body.appendChild(handle);

        const hide = () => { if (handle) { handle.style.opacity = '0'; handle.dataset.pos = '-1'; } };

        const onMouseMove = (e: MouseEvent) => {
          if ((e.target as HTMLElement).closest('.pm-drag-handle, .re-bubble')) return;
          const pos = editorView.posAtCoords({ left: e.clientX, top: e.clientY });
          if (!pos) { hide(); return; }
          try {
            const $pos = editorView.state.doc.resolve(pos.pos);
            if ($pos.depth < 1) { hide(); return; }
            const blockPos = $pos.before(1);
            const domCoords = editorView.coordsAtPos(blockPos + 1);
            const editorLeft = editorView.dom.getBoundingClientRect().left;
            if (handle) {
              handle.style.opacity = '1';
              handle.style.left = (editorLeft - 26) + 'px';
              handle.style.top = domCoords.top + 'px';
              handle.dataset.pos = String(blockPos);
            }
          } catch { hide(); }
        };

        const onDragStart = (e: DragEvent) => {
          dragPos = parseInt(handle?.dataset.pos ?? '-1');
          if (dragPos < 0) return;
          if (e.dataTransfer) {
            e.dataTransfer.setData('application/x-pm-node', String(dragPos));
            e.dataTransfer.effectAllowed = 'move';
          }
        };

        editorView.dom.addEventListener('mousemove', onMouseMove);
        editorView.dom.addEventListener('mouseleave', hide);
        handle.addEventListener('dragstart', onDragStart);

        return {
          destroy() {
            editorView.dom.removeEventListener('mousemove', onMouseMove);
            editorView.dom.removeEventListener('mouseleave', hide);
            handle?.remove();
            handle = null;
          },
        };
      },

      props: {
        handleDrop(view, event) {
          if (dragPos < 0) return false;
          const from = dragPos;
          dragPos = -1;
          const dropCoords = view.posAtCoords({ left: event.clientX, top: event.clientY });
          if (!dropCoords) return false;
          const { state, dispatch } = view;
          const node = state.doc.nodeAt(from);
          if (!node) return false;
          try {
            const $drop = state.doc.resolve(dropCoords.pos);
            if ($drop.depth < 1) return false;
            const to = $drop.before(1);
            if (to === from) return false;
            let tr = state.tr.delete(from, from + node.nodeSize);
            const adj = to > from ? to - node.nodeSize : to;
            dispatch(tr.insert(adj, node).scrollIntoView());
          } catch { return false; }
          return true;
        },
      },
    })];
  },
});
