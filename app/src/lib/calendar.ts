import type { CalendarEvent } from './types';

export function parseICS(text: string): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  // Unfold continuation lines
  const unfolded = lines.replace(/\n[ \t]/g, '');
  const blocks = unfolded.split('BEGIN:VEVENT');

  for (let i = 1; i < blocks.length; i++) {
    const block = blocks[i];
    const get = (key: string) => {
      const match = block.match(new RegExp(`^${key}[;:][^\n]*\n?`, 'm'));
      if (!match) return '';
      return match[0].replace(new RegExp(`^${key}[^:]*:`), '').trim();
    };

    const startRaw = get('DTSTART');
    const endRaw = get('DTEND');

    const parseDate = (s: string): number => {
      if (!s) return Date.now();
      s = s.replace(/[TZ]/g, '');
      if (s.length === 8) s += '000000';
      const y = s.slice(0, 4), mo = s.slice(4, 6), d = s.slice(6, 8);
      const h = s.slice(8, 10) || '00', mi = s.slice(10, 12) || '00', sec = s.slice(12, 14) || '00';
      return new Date(`${y}-${mo}-${d}T${h}:${mi}:${sec}Z`).getTime();
    };

    const uid = get('UID') || `ics-${Math.random()}`;
    const summary = decodeICSText(get('SUMMARY'));
    const location = decodeICSText(get('LOCATION'));
    const description = decodeICSText(get('DESCRIPTION'));

    if (!summary) continue;

    events.push({
      uid,
      summary,
      start: parseDate(startRaw),
      end: parseDate(endRaw) || parseDate(startRaw) + 3600000,
      location,
      description,
      source: 'apple'
    });
  }

  return events;
}

function decodeICSText(s: string): string {
  return s
    .replace(/\\n/g, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\')
    .trim();
}

export function exportICS(events: CalendarEvent[]): string {
  const fmt = (ts: number) => {
    const d = new Date(ts);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
  };

  const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/,/g, '\\,').replace(/;/g, '\\;').replace(/\n/g, '\\n');

  const vevents = events.map(e => [
    'BEGIN:VEVENT',
    `UID:${e.uid}`,
    `DTSTART:${fmt(e.start)}`,
    `DTEND:${fmt(e.end)}`,
    `SUMMARY:${esc(e.summary)}`,
    e.location ? `LOCATION:${esc(e.location)}` : '',
    e.description ? `DESCRIPTION:${esc(e.description)}` : '',
    'END:VEVENT'
  ].filter(Boolean).join('\r\n'));

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Q-onco Notes//EN',
    'CALSCALE:GREGORIAN',
    ...vevents,
    'END:VCALENDAR'
  ].join('\r\n');
}

export function getDayKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function isSameDay(ts: number, year: number, month: number, day: number): boolean {
  const d = new Date(ts);
  return d.getFullYear() === year && d.getMonth() === month && d.getDate() === day;
}

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

export function firstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}
