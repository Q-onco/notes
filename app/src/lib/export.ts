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

export function exportNote(note: Note): void {
  const frontmatter = [
    `# ${note.title}`,
    '',
    note.tags.length > 0 ? `Tags: ${note.tags.join(', ')}` : '',
    `Created: ${new Date(note.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`,
    `Updated: ${new Date(note.updatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`,
    '',
    '---',
    '',
    note.body
  ].filter((l, i) => i < 2 || l !== '').join('\n');
  download(`${slug(note.title) || 'note'}.md`, frontmatter, 'text/markdown');
}

export function exportAllNotes(notes: Note[]): void {
  const active = [...notes].filter(n => !n.archived).sort((a, b) => b.updatedAt - a.updatedAt);
  const body = active.map(n =>
    `# ${n.title}\n` +
    (n.tags.length > 0 ? `*${n.tags.join(', ')}* · ` : '') +
    `${new Date(n.updatedAt).toLocaleDateString('en-GB')}\n\n` +
    `${n.body}\n\n---\n`
  ).join('\n');
  const header = `# Q·onco Notes Export\n\nExported ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}\n${active.length} notes\n\n---\n\n`;
  download('qonco-notes.md', header + body, 'text/markdown');
}

export function exportJournal(entries: JournalEntry[]): void {
  const sorted = [...entries].sort((a, b) => b.createdAt - a.createdAt);
  const body = sorted.map(e =>
    `## ${new Date(e.createdAt).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}\n` +
    ([e.mood, e.contextTag].filter(Boolean).join(' · ')
      ? `*${[e.mood, e.contextTag].filter(Boolean).join(' · ')}*\n`
      : '') +
    `\n${e.body}\n\n---\n`
  ).join('\n');
  const header = `# Research Journal\n\nExported ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}\n${sorted.length} entries\n\n---\n\n`;
  download('qonco-journal.md', header + body, 'text/markdown');
}

export function exportTasks(tasks: Task[]): void {
  const byPriority = (a: Task, b: Task) => {
    const p = { high: 0, medium: 1, low: 2 };
    return p[a.priority] - p[b.priority];
  };
  const open = [...tasks].filter(t => !t.done).sort(byPriority);
  const done = [...tasks].filter(t => t.done);

  const fmt = (t: Task): string => {
    const check = t.done ? '[x]' : '[ ]';
    const pri = t.priority !== 'medium' ? ` *(${t.priority})*` : '';
    const due = t.dueAt ? ` — due ${new Date(t.dueAt).toLocaleDateString('en-GB')}` : '';
    return `- ${check} ${t.text}${pri}${due}`;
  };

  const lines = [
    '# Q·onco Tasks',
    `Exported ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`,
    '',
    `## Open (${open.length})`,
    ...open.map(fmt),
    '',
    `## Completed (${done.length})`,
    ...done.map(fmt)
  ];
  download('qonco-tasks.md', lines.join('\n'), 'text/markdown');
}

export function exportPapers(papers: PaperResult[], label = 'Pinned Research Papers'): void {
  if (papers.length === 0) return;
  const body = papers.map(p =>
    `### ${p.title}\n\n` +
    (p.authors.length > 0 ? `**Authors:** ${p.authors.slice(0, 6).join(', ')}${p.authors.length > 6 ? ' et al.' : ''}\n` : '') +
    `**Journal:** ${p.journal}${p.year > 0 ? ` (${p.year})` : ''}\n` +
    (p.doi ? `**DOI:** https://doi.org/${p.doi}\n` : `**URL:** ${p.url}\n`) +
    (p.abstract ? `\n${p.abstract}\n` : '') +
    '\n---\n'
  ).join('\n');
  const header = `# ${label}\n\nExported ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}\n${papers.length} papers\n\n---\n\n`;
  download('qonco-research.md', header + body, 'text/markdown');
}
