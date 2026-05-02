<script lang="ts">
  import { store } from '../lib/store.svelte';
  import { parseICS, exportICS, daysInMonth, firstDayOfMonth, isSameDay } from '../lib/calendar';
  import type { CalendarEvent } from '../lib/types';

  let { showToast }: { showToast: (msg: string, type?: 'success' | 'error') => void } = $props();

  const today = new Date();
  let year = $state(today.getFullYear());
  let month = $state(today.getMonth());
  let selectedDay = $state<{ y: number; m: number; d: number } | null>(null);

  function prevMonth() {
    if (month === 0) { month = 11; year--; }
    else month--;
  }
  function nextMonth() {
    if (month === 11) { month = 0; year++; }
    else month++;
  }
  function goToday() {
    year = today.getFullYear();
    month = today.getMonth();
    selectedDay = { y: today.getFullYear(), m: today.getMonth(), d: today.getDate() };
  }

  const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const DAY_NAMES = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

  const calGrid = $derived(() => {
    const total = daysInMonth(year, month);
    const start = firstDayOfMonth(year, month);
    const cells: ({ day: number } | null)[] = [];
    for (let i = 0; i < start; i++) cells.push(null);
    for (let d = 1; d <= total; d++) cells.push({ day: d });
    return cells;
  });

  function dayDots(day: number) {
    const ts = (item: { createdAt: number }) => isSameDay(item.createdAt, year, month, day);
    return {
      notes:   store.notes.filter(n => ts(n) && !n.archived).length,
      journal: store.journal.filter(j => ts(j)).length,
      audio:   store.audioRecords.filter(a => ts(a)).length,
      chat:    store.chatSessions.filter(c => isSameDay(new Date(c.date).getTime(), year, month, day)).length,
      events:  store.calEvents.filter(e => isSameDay(e.start, year, month, day)).length
    };
  }

  function selectDay(day: number) {
    selectedDay = { y: year, m: month, d: day };
  }

  const selectedItems = $derived(() => {
    if (!selectedDay) return { notes: [], journal: [], audio: [], chat: [], events: [] };
    const { y, m, d } = selectedDay;
    const ts = (item: { createdAt: number }) => isSameDay(item.createdAt, y, m, d);
    return {
      notes:   store.notes.filter(n => ts(n) && !n.archived),
      journal: store.journal.filter(j => ts(j)),
      audio:   store.audioRecords.filter(a => ts(a)),
      chat:    store.chatSessions.filter(c => isSameDay(new Date(c.date).getTime(), y, m, d)),
      events:  store.calEvents.filter(e => isSameDay(e.start, y, m, d))
    };
  });

  function isToday(day: number) {
    return year === today.getFullYear() && month === today.getMonth() && day === today.getDate();
  }

  function isSelected(day: number) {
    return selectedDay?.y === year && selectedDay?.m === month && selectedDay?.d === day;
  }

  // ICS import
  function importICS() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.ics,text/calendar';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const text = await file.text();
      const events = parseICS(text);
      store.calEvents = [...store.calEvents, ...events];
      showToast(`Imported ${events.length} calendar event${events.length !== 1 ? 's' : ''}`);
    };
    input.click();
  }

  function exportAll() {
    const ics = exportICS(store.calEvents);
    const blob = new Blob([ics], { type: 'text/calendar' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'qonco-calendar.ics';
    a.click();
    URL.revokeObjectURL(url);
    showToast('Calendar exported');
  }

  function fmtTime(ts: number) {
    return new Date(ts).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  }
</script>

<div class="calendar-view">
  <!-- Controls -->
  <div class="cal-header">
    <div class="cal-nav">
      <button class="btn-icon" onclick={prevMonth} aria-label="Previous month">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
      </button>
      <h2 class="month-label">{MONTH_NAMES[month]} {year}</h2>
      <button class="btn-icon" onclick={nextMonth} aria-label="Next month">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
      </button>
      <button class="btn btn-ghost btn-sm" onclick={goToday}>Today</button>
    </div>
    <div class="cal-actions">
      <button class="btn btn-ghost btn-sm" onclick={importICS}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
        Import .ics
      </button>
      {#if store.calEvents.length > 0}
        <button class="btn btn-ghost btn-sm" onclick={exportAll}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Export
        </button>
      {/if}
    </div>
  </div>

  <div class="cal-body">
    <!-- Grid -->
    <div class="cal-grid-wrap">
      <div class="day-names">
        {#each DAY_NAMES as dn}
          <div class="day-name">{dn}</div>
        {/each}
      </div>
      <div class="cal-grid">
        {#each calGrid() as cell}
          {#if cell === null}
            <div class="cal-cell empty"></div>
          {:else}
            {@const dots = dayDots(cell.day)}
            <button
              class="cal-cell day-cell"
              class:today={isToday(cell.day)}
              class:selected={isSelected(cell.day)}
              class:has-content={dots.notes + dots.journal + dots.audio + dots.chat + dots.events > 0}
              onclick={() => selectDay(cell.day)}
            >
              <span class="day-num">{cell.day}</span>
              <div class="dot-row">
                {#if dots.notes > 0}   <span class="dot dot-note"  title="{dots.notes} note{dots.notes>1?'s':''}"></span> {/if}
                {#if dots.journal > 0} <span class="dot dot-journal" title="{dots.journal} journal"></span> {/if}
                {#if dots.audio > 0}   <span class="dot dot-audio" title="{dots.audio} recording{dots.audio>1?'s':''}"></span> {/if}
                {#if dots.chat > 0}    <span class="dot dot-chat"  title="{dots.chat} Enzo session{dots.chat>1?'s':''}"></span> {/if}
                {#if dots.events > 0}  <span class="dot dot-event" title="{dots.events} event{dots.events>1?'s':''}"></span> {/if}
              </div>
            </button>
          {/if}
        {/each}
      </div>
    </div>

    <!-- Day detail panel -->
    {#if selectedDay}
      {@const items = selectedItems()}
      <div class="day-detail">
        <div class="detail-header">
          <h3>{selectedDay.d} {MONTH_NAMES[selectedDay.m]} {selectedDay.y}</h3>
          <div class="detail-legend">
            <span class="legend-item"><span class="dot dot-note"></span> Notes</span>
            <span class="legend-item"><span class="dot dot-journal"></span> Journal</span>
            <span class="legend-item"><span class="dot dot-audio"></span> Audio</span>
            <span class="legend-item"><span class="dot dot-chat"></span> Enzo</span>
            {#if store.calEvents.length > 0}
              <span class="legend-item"><span class="dot dot-event"></span> Calendar</span>
            {/if}
          </div>
        </div>

        {#if items.events.length > 0}
          <section class="detail-section">
            <h4>Calendar events</h4>
            {#each items.events as ev}
              <div class="detail-item event-item">
                <span class="item-time">{fmtTime(ev.start)}</span>
                <span class="item-title">{ev.summary}</span>
                {#if ev.location}<span class="item-meta text-xs text-mu">{ev.location}</span>{/if}
              </div>
            {/each}
          </section>
        {/if}

        {#if items.notes.length > 0}
          <section class="detail-section">
            <h4>Notes</h4>
            {#each items.notes as note}
              <button
                class="detail-item"
                onclick={() => { store.currentNoteId = note.id; store.view = 'notes'; }}
              >
                <span class="item-time">{fmtTime(note.createdAt)}</span>
                <span class="item-title">{note.title}</span>
              </button>
            {/each}
          </section>
        {/if}

        {#if items.journal.length > 0}
          <section class="detail-section">
            <h4>Journal</h4>
            {#each items.journal as entry}
              <div class="detail-item">
                <span class="item-time">{fmtTime(entry.createdAt)}</span>
                <span class="item-title">{entry.body.slice(0, 60)}{entry.body.length > 60 ? '…' : ''}</span>
                {#if entry.mood}<span class="tag text-xs">{entry.mood}</span>{/if}
              </div>
            {/each}
          </section>
        {/if}

        {#if items.audio.length > 0}
          <section class="detail-section">
            <h4>Recordings</h4>
            {#each items.audio as rec}
              <div class="detail-item">
                <span class="item-time">{fmtTime(rec.createdAt)}</span>
                <span class="item-title">{Math.round(rec.durationSec)}s — {rec.transcript.slice(0, 50)}{rec.transcript.length > 50 ? '…' : ''}</span>
              </div>
            {/each}
          </section>
        {/if}

        {#if items.chat.length > 0}
          <section class="detail-section">
            <h4>Enzo sessions</h4>
            {#each items.chat as session}
              <div class="detail-item">
                <span class="item-time">{session.messages.length} messages</span>
                {#if session.noteContext}
                  <span class="item-title text-mu">re: {session.noteContext}</span>
                {/if}
              </div>
            {/each}
          </section>
        {/if}

        {#if items.notes.length + items.journal.length + items.audio.length + items.chat.length + items.events.length === 0}
          <p class="empty-day text-sm text-mu">Nothing recorded on this day.</p>
        {/if}
      </div>
    {/if}
  </div>
</div>

<style>
  .calendar-view { height: 100%; display: flex; flex-direction: column; overflow: hidden; }

  .cal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border-bottom: 1px solid var(--bd);
    flex-shrink: 0;
  }
  .cal-nav { display: flex; align-items: center; gap: 8px; }
  .month-label { font-size: 1.1rem; font-weight: 600; min-width: 160px; text-align: center; }
  .cal-actions { display: flex; gap: 8px; }

  .cal-body { flex: 1; overflow: hidden; display: flex; gap: 0; }

  .cal-grid-wrap {
    flex: 1;
    overflow-y: auto;
    padding: 16px 20px;
    min-width: 0;
  }

  .day-names {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    margin-bottom: 4px;
  }
  .day-name {
    text-align: center;
    font-size: 0.72rem;
    font-weight: 700;
    color: var(--mu);
    letter-spacing: 0.06em;
    text-transform: uppercase;
    padding: 4px 0;
  }

  .cal-grid {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 3px;
  }

  .cal-cell { min-height: 72px; border-radius: var(--radius-sm); }

  .day-cell {
    background: var(--sf);
    border: 1px solid var(--bd);
    padding: 6px 8px;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
    transition: border-color var(--transition), background var(--transition);
  }
  .day-cell:hover { border-color: var(--ac); background: var(--ac-bg); }
  .day-cell.today { border-color: var(--ac); }
  .day-cell.today .day-num { background: var(--ac); color: white; }
  .day-cell.selected { background: var(--ac-bg); border-color: var(--ac); }

  .day-num {
    font-size: 0.82rem;
    font-weight: 600;
    width: 22px; height: 22px;
    display: flex; align-items: center; justify-content: center;
    border-radius: 50%;
  }

  .dot-row { display: flex; gap: 3px; flex-wrap: wrap; }

  .dot {
    width: 6px; height: 6px;
    border-radius: 50%;
    display: inline-block;
  }
  .dot-note    { background: var(--ac); }
  .dot-journal { background: var(--enzo); }
  .dot-audio   { background: var(--pu); }
  .dot-chat    { background: var(--gn); }
  .dot-event   { background: var(--yw); }

  /* Day detail panel */
  .day-detail {
    width: 280px;
    flex-shrink: 0;
    border-left: 1px solid var(--bd);
    overflow-y: auto;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .detail-header { display: flex; flex-direction: column; gap: 8px; }
  .detail-header h3 { font-size: 0.95rem; }

  .detail-legend { display: flex; flex-wrap: wrap; gap: 8px; }
  .legend-item { display: flex; align-items: center; gap: 4px; font-size: 0.7rem; color: var(--mu); }

  .detail-section { display: flex; flex-direction: column; gap: 4px; }
  .detail-section h4 { font-size: 0.75rem; font-weight: 700; color: var(--mu); text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 4px; }

  .detail-item {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 8px 10px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--bd);
    background: var(--sf);
    text-align: left;
    width: 100%;
    cursor: default;
    font-family: var(--font);
  }
  button.detail-item { cursor: pointer; }
  button.detail-item:hover { border-color: var(--ac); background: var(--ac-bg); }

  .event-item { border-color: var(--yw); background: var(--yw-bg); }

  .item-time { font-size: 0.7rem; color: var(--mu); }
  .item-title { font-size: 0.82rem; color: var(--tx); }
  .item-meta { margin-top: 2px; }

  .empty-day { padding: 16px 0; }
</style>
