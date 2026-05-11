import type { Note, JournalEntry, Task, PaperResult } from './types';

export function download(filename: string, content: string, mime = 'text/plain'): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function slug(s: string): string {
  return s.replace(/[^a-z0-9]+/gi, '-').toLowerCase().slice(0, 60);
}

// Minimal Markdown → HTML (good enough for export rendering)
function mdToHtml(md: string): string {
  return md
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/^- \[x\] (.+)$/gm, '<li>✓ $1</li>')
    .replace(/^- \[ \] (.+)$/gm, '<li>☐ $1</li>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/^---$/gm, '<hr>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/^(?!<[hlpico])/gm, '<p>')
    .replace(/\n/g, '<br>');
}

const PRINT_CSS = `
  body { font-family: "Georgia", serif; font-size: 11pt; line-height: 1.7; color: #111; max-width: 740px; margin: 40px auto; padding: 0 24px; }
  h1 { font-size: 18pt; margin: 0 0 8px; } h2 { font-size: 14pt; margin: 20px 0 6px; border-bottom: 1px solid #ccc; padding-bottom: 4px; }
  h3 { font-size: 12pt; margin: 14px 0 4px; } code { background: #f4f4f4; padding: 1px 4px; border-radius: 3px; font-size: 9.5pt; }
  hr { border: none; border-top: 1px solid #ddd; margin: 16px 0; }
  li { margin: 2px 0; } ul, ol { padding-left: 18px; } p { margin: 6px 0; }
  .meta { font-size: 9pt; color: #777; margin-bottom: 16px; }
  @media print { body { max-width: 100%; margin: 0; padding: 20px; } }
`;

function printWindow(title: string, htmlBody: string): void {
  const w = window.open('', '_blank', 'width=800,height=900');
  if (!w) return;
  w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title><style>${PRINT_CSS}</style></head><body>${htmlBody}</body></html>`);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 400);
}

export function wordHtml(title: string, htmlBody: string): string {
  return `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"><title>${title}</title>
<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View></w:WordDocument></xml><![endif]-->
<style>${PRINT_CSS}</style></head><body>${htmlBody}</body></html>`;
}

// ── Notes ──────────────────────────────────────────────────────────────────────

export function exportNote(note: Note): void {
  const md = [`# ${note.title}`, '', note.tags.length > 0 ? `Tags: ${note.tags.join(', ')}` : '', `Updated: ${new Date(note.updatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`, '', '---', '', note.body].filter((l, i) => i < 2 || l !== '').join('\n');
  download(`${slug(note.title) || 'note'}.md`, md, 'text/markdown');
}

export function exportNoteDocx(note: Note): void {
  const html = `<h1>${note.title}</h1><p class="meta">${note.tags.length ? `Tags: ${note.tags.join(', ')} · ` : ''}Updated ${new Date(note.updatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p><hr>${mdToHtml(note.body)}`;
  download(`${slug(note.title) || 'note'}.doc`, wordHtml(note.title, html), 'application/msword');
}

export function exportNotePdf(note: Note): void {
  const html = `<h1>${note.title}</h1><p class="meta">${note.tags.length ? `Tags: ${note.tags.join(', ')} · ` : ''}Updated ${new Date(note.updatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p><hr>${mdToHtml(note.body)}`;
  printWindow(note.title, html);
}

export function exportAllNotes(notes: Note[]): void {
  const active = [...notes].filter(n => !n.archived).sort((a, b) => b.updatedAt - a.updatedAt);
  const body = active.map(n => `# ${n.title}\n${n.tags.length > 0 ? `*${n.tags.join(', ')}* · ` : ''}${new Date(n.updatedAt).toLocaleDateString('en-GB')}\n\n${n.body}\n\n---\n`).join('\n');
  const header = `# Q·onco Notes Export\n\nExported ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}\n${active.length} notes\n\n---\n\n`;
  download('qonco-notes.md', header + body, 'text/markdown');
}

// ── Journal ────────────────────────────────────────────────────────────────────

export function exportJournal(entries: JournalEntry[]): void {
  const sorted = [...entries].sort((a, b) => b.createdAt - a.createdAt);
  const body = sorted.map(e => `## ${new Date(e.createdAt).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}\n${[e.mood, e.contextTag].filter(Boolean).join(' · ') ? `*${[e.mood, e.contextTag].filter(Boolean).join(' · ')}*\n` : ''}\n${e.body}\n\n---\n`).join('\n');
  const header = `# Research Journal\n\nExported ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}\n${sorted.length} entries\n\n---\n\n`;
  download('qonco-journal.md', header + body, 'text/markdown');
}

export function exportJournalDocx(entries: JournalEntry[]): void {
  const sorted = [...entries].sort((a, b) => b.createdAt - a.createdAt);
  const html = `<h1>Research Journal</h1><p class="meta">Exported ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })} · ${sorted.length} entries</p>` +
    sorted.map(e => `<h2>${new Date(e.createdAt).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</h2>${[e.mood, e.contextTag].filter(Boolean).length ? `<p><em>${[e.mood, e.contextTag].filter(Boolean).join(' · ')}</em></p>` : ''}${mdToHtml(e.body)}<hr>`).join('');
  download('qonco-journal.doc', wordHtml('Research Journal', html), 'application/msword');
}

export function exportJournalPdf(entries: JournalEntry[]): void {
  const sorted = [...entries].sort((a, b) => b.createdAt - a.createdAt);
  const html = `<h1>Research Journal</h1><p class="meta">Exported ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })} · ${sorted.length} entries</p>` +
    sorted.map(e => `<h2>${new Date(e.createdAt).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</h2>${[e.mood, e.contextTag].filter(Boolean).length ? `<p><em>${[e.mood, e.contextTag].filter(Boolean).join(' · ')}</em></p>` : ''}${mdToHtml(e.body)}<hr>`).join('');
  printWindow('Research Journal', html);
}

// ── Tasks ──────────────────────────────────────────────────────────────────────

export function exportTasks(tasks: Task[]): void {
  const byPriority = (a: Task, b: Task) => { const p = { high: 0, medium: 1, low: 2 }; return p[a.priority] - p[b.priority]; };
  const open = [...tasks].filter(t => !t.done).sort(byPriority);
  const done = [...tasks].filter(t => t.done);
  const fmt = (t: Task): string => {
    const check = t.done ? '[x]' : '[ ]';
    const pri = t.priority !== 'medium' ? ` *(${t.priority})*` : '';
    const due = t.dueAt ? ` — due ${new Date(t.dueAt).toLocaleDateString('en-GB')}` : '';
    return `- ${check} ${t.text}${pri}${due}`;
  };
  download('qonco-tasks.md', ['# Q·onco Tasks', `Exported ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`, '', `## Open (${open.length})`, ...open.map(fmt), '', `## Completed (${done.length})`, ...done.map(fmt)].join('\n'), 'text/markdown');
}

// ── Papers ─────────────────────────────────────────────────────────────────────

export function exportPapers(papers: PaperResult[], label = 'Pinned Research Papers'): void {
  if (papers.length === 0) return;
  const body = papers.map(p => `### ${p.title}\n\n${p.authors.length > 0 ? `**Authors:** ${p.authors.slice(0, 6).join(', ')}${p.authors.length > 6 ? ' et al.' : ''}\n` : ''}**Journal:** ${p.journal}${p.year > 0 ? ` (${p.year})` : ''}\n${p.doi ? `**DOI:** https://doi.org/${p.doi}\n` : `**URL:** ${p.url}\n`}${p.abstract ? `\n${p.abstract}\n` : ''}\n---\n`).join('\n');
  const header = `# ${label}\n\nExported ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}\n${papers.length} papers\n\n---\n\n`;
  download('qonco-research.md', header + body, 'text/markdown');
}

export function exportPapersBibTeX(papers: PaperResult[]): void {
  if (papers.length === 0) return;
  const entries = papers.map(p => {
    const key = `${p.authors[0]?.split(' ').pop() ?? 'Unknown'}${p.year}${p.title.split(' ')[0]}`.replace(/[^a-zA-Z0-9]/g, '');
    const authors = p.authors.join(' and ') || 'Unknown';
    return `@article{${key},\n  author  = {${authors}},\n  title   = {${p.title}},\n  journal = {${p.journal}},\n  year    = {${p.year || ''}},\n${p.doi ? `  doi     = {${p.doi}},\n  url     = {https://doi.org/${p.doi}},\n` : p.url ? `  url     = {${p.url}},\n` : ''}  abstract = {${(p.abstract || '').replace(/[{}]/g, '')}}\n}`;
  });
  download('qonco-reading-list.bib', entries.join('\n\n'), 'text/plain');
}

export function exportManuscriptPdf(title: string, sections: { label: string; content: string }[], targetJournal?: string): void {
  const meta = targetJournal ? `<p class="meta">Target journal: ${targetJournal}</p>` : '';
  const html = `<h1>${title}</h1>${meta}` + sections.map(s => `<h2>${s.label}</h2>${s.content}`).join('');
  printWindow(title, html);
}

export function exportPapersDocx(papers: PaperResult[], label = 'Research Papers'): void {
  if (papers.length === 0) return;
  const html = `<h1>${label}</h1><p class="meta">Exported ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })} · ${papers.length} papers</p>` +
    papers.map(p => `<h3>${p.title}</h3>${p.authors.length ? `<p><strong>Authors:</strong> ${p.authors.slice(0, 6).join(', ')}${p.authors.length > 6 ? ' et al.' : ''}</p>` : ''}<p><strong>${p.journal}</strong>${p.year ? ` (${p.year})` : ''}</p>${p.doi ? `<p>https://doi.org/${p.doi}</p>` : ''}<hr>`).join('');
  download('qonco-research.doc', wordHtml(label, html), 'application/msword');
}

// ── LaTeX ─────────────────────────────────────────────────────────────────────

function escapeTex(s: string): string {
  return s
    .replace(/\\/g, '\\textbackslash{}')
    .replace(/&/g, '\\&')
    .replace(/%/g, '\\%')
    .replace(/\$/g, '\\$')
    .replace(/#/g, '\\#')
    .replace(/_/g, '\\_')
    .replace(/\{/g, '\\{')
    .replace(/\}/g, '\\}')
    .replace(/~/g, '\\textasciitilde{}')
    .replace(/\^/g, '\\textasciicircum{}');
}

function tableToTex(table: Element): string {
  const rows = Array.from(table.querySelectorAll('tr'));
  if (!rows.length) return '';
  const colCount = Math.max(...rows.map(r => r.querySelectorAll('th,td').length));
  if (!colCount) return '';
  const spec = Array(colCount).fill('l').join(' | ');
  const lines = [`\\begin{tabular}{| ${spec} |}`, '\\hline'];
  rows.forEach((row, i) => {
    const cells = Array.from(row.querySelectorAll('th,td'))
      .map(c => Array.from(c.childNodes).map(domToTex).join('').trim());
    lines.push(cells.join(' & ') + ' \\\\');
    if (i === 0) lines.push('\\hline');
  });
  lines.push('\\hline', '\\end{tabular}');
  return `\n\n${lines.join('\n')}\n\n`;
}

function domToTex(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return escapeTex(node.textContent ?? '');
  const el = node as Element;
  const dtype = el.getAttribute?.('data-type');
  const kids = () => Array.from(el.childNodes).map(domToTex).join('');
  const tag = el.tagName?.toLowerCase();

  if (dtype === 'math-inline') return `$${el.getAttribute('data-formula') ?? ''}$`;
  if (dtype === 'math-block')  return `\n\n\\[\n${el.getAttribute('data-formula') ?? ''}\n\\]\n\n`;
  if (dtype === 'image-block') {
    const img = el.querySelector('img');
    const cap = el.getAttribute('data-caption') ?? '';
    return `\n\n\\begin{figure}[h!]\n\\centering\n\\includegraphics[width=0.8\\textwidth]{${img?.getAttribute('src') ?? ''}}` +
      (cap ? `\n\\caption{${escapeTex(cap)}}` : '') + `\n\\end{figure}\n\n`;
  }
  if (dtype === 'mermaid-block') return '';
  if (dtype === 'callout') {
    const t = (el.className.match(/callout-(\w+)/)?.[1]) ?? 'info';
    const labels: Record<string,string> = { info:'Note', warning:'Warning', important:'Important', hypothesis:'Hypothesis', result:'Result' };
    return `\n\n\\begin{quote}\n\\textbf{${labels[t] ?? 'Note'}:} ${kids()}\\end{quote}\n\n`;
  }
  if (dtype === 'details') {
    const summary = el.getAttribute('summary') ?? el.getAttribute('data-summary') ?? 'Section';
    return `\n\n\\paragraph{${escapeTex(summary)}}\n${kids()}\n`;
  }
  if (dtype === 'audio-clip' || dtype === 'attachment-block' || dtype === 'embed-block') return '';
  if (dtype === 'columns' || dtype === 'column') return kids();

  switch (tag) {
    case 'h1': return `\n\n\\section{${kids()}}\n`;
    case 'h2': return `\n\n\\subsection{${kids()}}\n`;
    case 'h3': return `\n\n\\subsubsection{${kids()}}\n`;
    case 'p':  { const t = kids().trim(); return t ? `\n\n${t}\n` : ''; }
    case 'strong': case 'b': return `\\textbf{${kids()}}`;
    case 'em':     case 'i': return `\\textit{${kids()}}`;
    case 'u': return `\\underline{${kids()}}`;
    case 's': return `\\sout{${kids()}}`;
    case 'code': return `\\texttt{${escapeTex(el.textContent ?? '')}}`;
    case 'pre': return `\n\n\\begin{verbatim}\n${el.textContent ?? ''}\n\\end{verbatim}\n\n`;
    case 'blockquote': return `\n\n\\begin{quote}\n${kids()}\\end{quote}\n\n`;
    case 'hr': return `\n\n\\noindent\\rule{\\linewidth}{0.4pt}\n\n`;
    case 'ul': return `\n\n\\begin{itemize}\n${kids()}\\end{itemize}\n\n`;
    case 'ol': return `\n\n\\begin{enumerate}\n${kids()}\\end{enumerate}\n\n`;
    case 'li': return `  \\item ${kids().trim()}\n`;
    case 'a': {
      const href = el.getAttribute('href') ?? '';
      const txt = kids();
      return href.startsWith('note:') ? txt : `\\href{${href}}{${txt}}`;
    }
    case 'sup': return `$^{${kids()}}$`;
    case 'sub': return `$_{${kids()}}$`;
    case 'br':  return '\\\\\n';
    case 'mark': return `\\colorbox{yellow!30}{${kids()}}`;
    case 'table': return tableToTex(el);
    case 'thead': case 'tbody': case 'tfoot':
    case 'tr': case 'th': case 'td': return '';
    default: return kids();
  }
}

export function exportNoteTex(note: Note): void {
  const doc = new DOMParser().parseFromString(note.body, 'text/html');
  const body = Array.from(doc.body.childNodes).map(domToTex).join('').replace(/\n{3,}/g, '\n\n').trim();
  const tags = note.tags.length ? `% Tags: ${note.tags.join(', ')}\n` : '';
  const tex = `\\documentclass[12pt,a4paper]{article}
\\usepackage[utf8]{inputenc}
\\usepackage[T1]{fontenc}
\\usepackage{amsmath,amssymb}
\\usepackage{graphicx}
\\usepackage{hyperref}
\\usepackage{verbatim}
\\usepackage{geometry}
\\usepackage{soul}
\\usepackage{xcolor}
\\geometry{margin=2.5cm}
${tags}
\\title{${escapeTex(note.title)}}
\\date{${new Date(note.updatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}}

\\begin{document}
\\maketitle

${body}

\\end{document}
`;
  download(`${slug(note.title) || 'note'}.tex`, tex, 'text/plain');
}

// ── CV ─────────────────────────────────────────────────────────────────────────

export function exportCvHtml(mdContent: string, title = 'Curriculum Vitae'): void {
  const html = `<h1>${title}</h1>${mdToHtml(mdContent)}`;
  download('cv-amritha.doc', wordHtml(title, html), 'application/msword');
}

export function exportCvPdf(mdContent: string, title = 'Curriculum Vitae'): void {
  const html = `<h1>${title}</h1>${mdToHtml(mdContent)}`;
  printWindow(title, html);
}

// ── Cover Letter ───────────────────────────────────────────────────────────────

export function exportCoverLetterDocx(content: string, company: string): void {
  const html = `<h1>Cover Letter</h1><p class="meta">${company}</p><hr>${mdToHtml(content)}`;
  download(`cover-letter-${slug(company)}.doc`, wordHtml('Cover Letter', html), 'application/msword');
}

export function exportCoverLetterPdf(content: string, company: string): void {
  const html = `<h1>Cover Letter — ${company}</h1><hr>${mdToHtml(content)}`;
  printWindow(`Cover Letter — ${company}`, html);
}
