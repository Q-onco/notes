import type { Note, JournalEntry, Task, PaperResult } from './types';

function download(filename: string, content: string, mime = 'text/plain'): void {
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

function wordHtml(title: string, htmlBody: string): string {
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

export function exportPapersDocx(papers: PaperResult[], label = 'Research Papers'): void {
  if (papers.length === 0) return;
  const html = `<h1>${label}</h1><p class="meta">Exported ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })} · ${papers.length} papers</p>` +
    papers.map(p => `<h3>${p.title}</h3>${p.authors.length ? `<p><strong>Authors:</strong> ${p.authors.slice(0, 6).join(', ')}${p.authors.length > 6 ? ' et al.' : ''}</p>` : ''}<p><strong>${p.journal}</strong>${p.year ? ` (${p.year})` : ''}</p>${p.doi ? `<p>https://doi.org/${p.doi}</p>` : ''}<hr>`).join('');
  download('qonco-research.doc', wordHtml(label, html), 'application/msword');
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
