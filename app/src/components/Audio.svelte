<script lang="ts">
  import { store } from '../lib/store.svelte';
  import { transcribeAudio, parseTranscriptForEvents } from '../lib/groq';
  import { nanoid } from 'nanoid';
  import type { Note } from '../lib/types';
  import RichEditor from './RichEditor.svelte';

  let { showToast }: { showToast: (msg: string, type?: 'success' | 'error') => void } = $props();

  // ── Daily Whisper quota ─────────────────────────────────────
  const DAILY_LIMIT = 7200; // 2 hours in seconds
  const storageKey = () => `qonco_wh_${new Date().toISOString().slice(0, 10)}`;
  const getUsed = () => parseInt(localStorage.getItem(storageKey()) || '0');
  const addUsed = (secs: number) => {
    const k = storageKey();
    localStorage.setItem(k, String(getUsed() + secs));
  };

  let whisperUsed = $state(getUsed());
  let whisperRemaining = $derived(Math.max(0, DAILY_LIMIT - whisperUsed));

  // ── Recorder state ──────────────────────────────────────────
  let recording = $state(false);
  let durationSec = $state(0);
  let liveText = $state('');         // text accumulates during recording
  let transcribingCount = $state(0); // pending async transcriptions
  let draftTranscript = $state('');  // shown after stop for editing
  let linkNoteId = $state('');

  let stream: MediaStream | null = null;
  let currentMR: MediaRecorder | null = null;
  let chunkBuffer: Blob[] = [];
  let fullAudioChunks: Blob[] = [];  // accumulates entire session for R2 upload
  let chunkMime = '';
  let isRecordingSession = false;
  let durationTimer: ReturnType<typeof setInterval>;
  let chunkTimer: ReturnType<typeof setTimeout>;

  const CHUNK_SEC = 15;

  // ── Recording ────────────────────────────────────────────────
  async function startRecording() {
    if (!store.settings.workerUrl) {
      showToast('No Worker URL — set it in Settings first', 'error');
      return;
    }
    if (whisperRemaining <= 0) {
      showToast('Daily transcription limit reached (2h)', 'error');
      return;
    }

    liveText = '';
    draftTranscript = '';
    durationSec = 0;
    transcribingCount = 0;
    fullAudioChunks = [];
    whisperUsed = getUsed();

    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      showToast('Microphone access denied', 'error');
      return;
    }

    recording = true;
    isRecordingSession = true;

    durationTimer = setInterval(() => {
      durationSec++;
      whisperUsed = getUsed();
      if (whisperUsed + durationSec >= DAILY_LIMIT) {
        stopRecording();
        showToast('Daily transcription limit reached (2h)', 'error');
      }
    }, 1000);

    startChunk();
  }

  function startChunk() {
    if (!stream || !isRecordingSession) return;

    chunkMime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : 'audio/webm';
    chunkBuffer = [];

    const mr = new MediaRecorder(stream, { mimeType: chunkMime });
    mr.ondataavailable = (e) => { if (e.data.size > 0) { chunkBuffer.push(e.data); fullAudioChunks.push(e.data); } };
    mr.onstop = handleChunkStop;
    mr.start(500);
    currentMR = mr;

    chunkTimer = setTimeout(() => {
      if (currentMR?.state === 'recording') {
        currentMR.stop();
      }
    }, CHUNK_SEC * 1000);
  }

  async function handleChunkStop() {
    const blob = new Blob(chunkBuffer, { type: chunkMime });
    chunkBuffer = [];

    if (blob.size > 500 && store.settings.workerUrl) {
      transcribingCount++;
      try {
        const text = await transcribeAudio(blob, store.settings.workerUrl);
        const trimmed = text.trim();
        if (trimmed) liveText = liveText ? liveText + ' ' + trimmed : trimmed;
        addUsed(CHUNK_SEC);
        whisperUsed = getUsed();
      } catch {
        // silent — individual chunk failures don't abort the session
      } finally {
        transcribingCount--;
        if (!isRecordingSession && transcribingCount === 0) {
          draftTranscript = liveText;
        }
      }
    }

    if (isRecordingSession) {
      startChunk();
    } else if (transcribingCount === 0) {
      draftTranscript = liveText;
    }
  }

  function stopRecording() {
    if (!recording) return;
    isRecordingSession = false;
    recording = false;
    clearTimeout(chunkTimer);
    clearInterval(durationTimer);
    if (currentMR?.state === 'recording') currentMR.stop();
    stream?.getTracks().forEach(t => t.stop());
  }

  // ── Save / export ────────────────────────────────────────────
  async function saveRecording() {
    if (!draftTranscript.replace(/<[^>]*>/g, '').trim()) return;

    let r2Key: string | undefined;
    const mime = chunkMime || 'audio/webm';

    if (fullAudioChunks.length > 0 && store.workerBase) {
      try {
        const fullBlob = new Blob(fullAudioChunks, { type: mime });
        const ext = mime.includes('ogg') ? 'ogg' : 'webm';
        const res = await fetch(
          `${store.workerBase}/upload?prefix=audio&ext=${ext}&mime=${encodeURIComponent(mime)}`,
          { method: 'POST', body: fullBlob, headers: { 'Content-Type': mime } }
        );
        if (res.ok) { const d = await res.json(); r2Key = d.key; }
      } catch { /* non-fatal — save transcript without audio blob */ }
    }

    const rec = {
      id: nanoid(),
      createdAt: Date.now(),
      durationSec,
      transcript: draftTranscript,
      noteId: linkNoteId || null,
      journalId: null,
      sizeBytes: fullAudioChunks.reduce((a, b) => a + b.size, 0),
      r2Key,
      mimeType: mime
    };
    store.audioRecords = [rec, ...store.audioRecords];

    if (linkNoteId) {
      const note = store.notes.find(n => n.id === linkNoteId);
      if (note) {
        const ts = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
        note.audioIds = [...note.audioIds, rec.id];
        note.body += `<hr><p><em>Transcript (${ts}):</em></p>${draftTranscript}`;
        note.updatedAt = Date.now();
        await store.saveNotes();
      }
    }

    await store.saveAudio();
    showToast('Recording saved');
    draftTranscript = '';
    linkNoteId = '';
    liveText = '';
    durationSec = 0;
  }

  function exportMarkdown() {
    if (!draftTranscript.replace(/<[^>]*>/g, '').trim()) return;
    const date = new Date().toISOString().slice(0, 16).replace('T', ' ');
    const plain = draftTranscript.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    const md = `# Audio Transcript\n\n**Date:** ${date}  \n**Duration:** ${fmtDur(durationSec)}\n\n---\n\n${plain}\n`;
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transcript-${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── Helpers ───────────────────────────────────────────────────
  function fmtDur(s: number): string {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
    return `${m}:${String(sec).padStart(2,'0')}`;
  }

  function pct(used: number, total: number): number {
    return Math.min(100, Math.round((used / total) * 100));
  }

  function relTime(ts: number): string {
    const d = Date.now() - ts;
    if (d < 3600000) return `${Math.floor(d / 60000)}m ago`;
    if (d < 86400000) return `${Math.floor(d / 3600000)}h ago`;
    return new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  }

  // ── Master toggle ─────────────────────────────────────────────
  const SESSION_KEY = 'qonco_audio_on';
  let enabled = $state(sessionStorage.getItem(SESSION_KEY) === '1');
  function enable() { enabled = true; sessionStorage.setItem(SESSION_KEY, '1'); }

  const EXAMPLE_RECORDS = [
    {
      id: '_ea1',
      createdAt: Date.now() - 86400000,
      durationSec: 312,
      transcript: 'Lab meeting notes. Discussed the batch 3 HGSOC scRNA-seq results — the doublet rate in samples OV-23-14A and OV-23-17B is higher than expected, possibly due to the fresh tumour dissociation protocol. Suggested switching to cold active protease dissociation for the next cohort. Also discussed the unexpected CXCL12-high cluster — could be CAF-like or endothelial. Need to cross-reference with the Hornburg Nature Cancer paper signatures. Action item: re-run DoubletFinder with lower expected doublet rate and check against known TME interaction pairs.',
      noteId: null,
      journalId: null,
      sizeBytes: 0,
    },
    {
      id: '_ea2',
      createdAt: Date.now() - 172800000,
      durationSec: 185,
      transcript: 'Quick note on the Visium spatial data — the cell2location deconvolution run with n_cells_per_location equals 10 is converging but slowly. Trying 8 and 12 to see which fits better. The CD8 T cell signal is very sparse in the stromal rim sections — consistent with the immune-excluded phenotype. Worth comparing to the matched scRNA-seq to see if there is a spatial sorting artefact or genuine biology.',
      noteId: null,
      journalId: null,
      sizeBytes: 0,
    },
  ];

  // ── Transcript actions ───────────────────────────────────────
  async function saveTranscriptAsNote(rec: typeof EXAMPLE_RECORDS[0]) {
    if (rec.id.startsWith('_')) return;
    const date = new Date(rec.createdAt).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const time = new Date(rec.createdAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    const note: Note = {
      id: nanoid(),
      title: `Transcript — ${new Date(rec.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`,
      body: `# Transcript\n\n**Date:** ${date}  \n**Time:** ${time}  \n**Duration:** ${fmtDur(rec.durationSec)}\n\n---\n\n${rec.transcript}\n`,
      tags: ['audio', 'transcript'],
      createdAt: rec.createdAt,
      updatedAt: Date.now(),
      pinned: false,
      archived: false,
      audioIds: [rec.id]
    };
    store.notes = [note, ...store.notes];
    store.currentNoteId = note.id;
    await store.saveNotes();
    store.view = 'notes';
    showToast('Transcript saved as note');
  }

  function sendTranscriptToEnzo(rec: typeof EXAMPLE_RECORDS[0]) {
    if (rec.id.startsWith('_')) return;
    const date = new Date(rec.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    store.enzoSearchQuery = `I recorded the following on ${date} (${fmtDur(rec.durationSec)}). Analyse it — identify the key scientific points, questions raised, and any concrete action items:\n\n${rec.transcript}`;
    store.enzoOpen = true;
  }

  function sendDraftToEnzo() {
    if (!draftTranscript.replace(/<[^>]*>/g, '').trim()) return;
    const plain = draftTranscript.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    store.enzoSearchQuery = `I just recorded the following (${fmtDur(durationSec)}). Analyse it — identify key scientific points, questions, and action items:\n\n${plain}`;
    store.enzoOpen = true;
  }

  // ── Replay ───────────────────────────────────────────────────
  let playingId = $state<string | null>(null);

  function sendTranscriptAsEmail(rec: typeof EXAMPLE_RECORDS[0]) {
    if (rec.id.startsWith('_')) return;
    const date = new Date(rec.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    const plain = rec.transcript.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    store.openCompose({
      subject: `Voice transcript — ${date}`,
      body: `Audio transcript from ${date} (${fmtDur(rec.durationSec)}):\n\n${plain}`
    });
  }

  // ── Research event extraction (Wave 9) ───────────────────────
  type EventItem = { text: string; approved: boolean };
  type ExtractResult = {
    hypotheses: EventItem[];
    tasks: EventItem[];
    paperTopics: EventItem[];
    observations: EventItem[];
  };

  let extracting = $state(false);
  let extractResult = $state<ExtractResult | null>(null);
  let committing = $state(false);

  async function extractEvents() {
    if (!draftTranscript.replace(/<[^>]*>/g, '').trim()) return;
    extracting = true;
    extractResult = null;
    const plain = draftTranscript.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    try {
      const parsed = await parseTranscriptForEvents(plain);
      extractResult = {
        hypotheses: parsed.hypotheses.map(t => ({ text: t, approved: true })),
        tasks: parsed.tasks.map(t => ({ text: t, approved: true })),
        paperTopics: parsed.paperTopics.map(t => ({ text: t, approved: true })),
        observations: parsed.observations.map(t => ({ text: t, approved: true })),
      };
    } catch {
      showToast('Extraction failed', 'error');
    }
    extracting = false;
  }

  async function commitEvents() {
    if (!extractResult) return;
    committing = true;
    let count = 0;

    for (const item of extractResult.hypotheses.filter(i => i.approved)) {
      store.hypotheses = [{ id: nanoid(), text: item.text, rationale: 'Extracted from voice memo', status: 'active', result: '', linkedNotes: [], createdAt: Date.now(), updatedAt: Date.now() }, ...store.hypotheses];
      count++;
    }
    if (extractResult.hypotheses.some(i => i.approved)) await store.savePipelines();

    for (const item of extractResult.tasks.filter(i => i.approved)) {
      store.tasks = [{ id: nanoid(), text: item.text, done: false, noteId: null, createdAt: Date.now(), dueAt: null, priority: 'medium' }, ...store.tasks];
      count++;
    }
    if (extractResult.tasks.some(i => i.approved)) await store.saveTasks();

    const obsItems = extractResult.observations.filter(i => i.approved);
    if (obsItems.length > 0) {
      const body = obsItems.map(i => `• ${i.text}`).join('\n');
      store.journal = [{ id: nanoid(), body: `<p><strong>Observations from voice memo:</strong></p><p>${body.replace(/\n/g,'</p><p>')}</p>`, mood: '', contextTag: 'Research', createdAt: Date.now(), updatedAt: Date.now(), audioIds: [] }, ...store.journal];
      await store.saveJournal();
      count += obsItems.length;
    }

    const paperItems = extractResult.paperTopics.filter(i => i.approved);
    if (paperItems.length > 0) {
      store.enzoSearchQuery = `Search these topics from my voice memo:\n${paperItems.map(i => '- ' + i.text).join('\n')}\n\nFor each topic, suggest the most relevant recent papers I should look up.`;
      store.enzoOpen = true;
      count += paperItems.length;
    }

    showToast(`${count} event${count !== 1 ? 's' : ''} committed`);
    extractResult = null;
    committing = false;
  }

  // ── Selected audio highlight from Calendar click-through ──────
  $effect(() => {
    if (store.selectedAudioId) {
      // briefly highlight - actual scroll would need DOM ref
      store.selectedAudioId = null;
    }
  });
</script>

{#if !enabled}
  <div class="landing">
    <div class="landing-inner">
      <div class="landing-icon">
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/>
          <path d="M19 10v2a7 7 0 01-14 0v-2"/>
          <line x1="12" y1="19" x2="12" y2="23"/>
          <line x1="8" y1="23" x2="16" y2="23"/>
        </svg>
      </div>
      <h2>Audio &amp; Transcription</h2>
      <p class="text-mu">Record meeting notes, lab observations, and spoken thoughts — transcribed in real time via Groq Whisper. Transcripts link to notes and appear in your calendar.</p>
      <ul class="landing-features">
        <li>Live streaming transcription (15-second chunks, Whisper large-v3)</li>
        <li>Edit transcript before saving</li>
        <li>Link recordings to specific notes</li>
        <li>2-hour daily transcription quota (resets at midnight)</li>
        <li>Export transcripts as Markdown files</li>
      </ul>
      <button class="btn btn-primary landing-btn" onclick={enable}>Enable for this session</button>
      <p class="text-xs text-mu">Requires Worker URL set in Settings. Stays active until you close this tab.</p>
    </div>
  </div>
{:else}
<div class="audio-view">
  <div class="audio-header">
    <h2>Audio &amp; Transcription</h2>
    <p class="text-sm text-mu">{store.audioRecords.length} recording{store.audioRecords.length !== 1 ? 's' : ''}</p>
  </div>

  <!-- Daily quota bar -->
  <div class="quota-bar-wrap">
    <div class="quota-label">
      <span class="text-xs text-mu">Whisper daily quota</span>
      <span class="quota-nums text-xs">
        {fmtDur(whisperUsed + (recording ? durationSec : 0))} used · <strong>{fmtDur(whisperRemaining - (recording ? durationSec : 0))}</strong> left
      </span>
    </div>
    <div class="quota-track">
      <div
        class="quota-fill"
        class:quota-warn={pct(whisperUsed, DAILY_LIMIT) > 75}
        style="width: {pct(whisperUsed + (recording ? durationSec : 0), DAILY_LIMIT)}%"
      ></div>
    </div>
  </div>

  <!-- Recorder card -->
  <div class="recorder card">
    <div class="recorder-top">
      <!-- Visualiser / status circle -->
      <div class="rec-visual" class:active={recording} class:pending={transcribingCount > 0 && !recording}>
        {#if recording}
          <span class="rec-dot"></span>
        {:else if transcribingCount > 0}
          <span class="spin-ring"></span>
        {:else}
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/>
            <path d="M19 10v2a7 7 0 01-14 0v-2"/>
            <line x1="12" y1="19" x2="12" y2="23"/>
            <line x1="8" y1="23" x2="16" y2="23"/>
          </svg>
        {/if}
      </div>

      <div class="rec-middle">
        {#if recording}
          <div class="rec-stats">
            <span class="rec-time">{fmtDur(durationSec)}</span>
            <span class="rec-remaining text-xs text-mu">
              {fmtDur(Math.max(0, whisperRemaining - durationSec))} left today
            </span>
          </div>
          <button class="btn btn-danger" onclick={stopRecording}>Stop</button>
        {:else if transcribingCount > 0}
          <span class="text-sm text-mu">Transcribing {transcribingCount} chunk{transcribingCount !== 1 ? 's' : ''}…</span>
        {:else}
          <div>
            <button
              class="btn btn-primary"
              onclick={startRecording}
              disabled={whisperRemaining <= 0}
            >
              Start recording
            </button>
            {#if whisperRemaining <= 0}
              <p class="text-xs text-mu mt-1">Daily limit reached. Resets at midnight.</p>
            {/if}
          </div>
        {/if}
      </div>
    </div>

    <!-- Live transcript during recording -->
    {#if recording && liveText}
      <div class="live-transcript">
        <span class="live-label text-xs">Live transcript</span>
        <p class="live-text">{liveText}</p>
      </div>
    {/if}

    <!-- Draft for editing after stop -->
    {#if draftTranscript !== '' && !recording && transcribingCount === 0}
      <div class="draft-section">
        <label class="draft-label text-xs text-mu" for="draft-area">
          Transcript — edit before saving
        </label>
        <RichEditor
          bind:value={draftTranscript}
          placeholder="Transcript will appear here — edit before saving"
          minHeight="120px"
        />
        <div class="draft-actions">
          <select bind:value={linkNoteId} class="note-select">
            <option value="">Save standalone</option>
            {#each store.notes.filter(n => !n.archived) as note}
              <option value={note.id}>{note.title}</option>
            {/each}
          </select>
          <button class="btn btn-ghost btn-sm extract-btn" onclick={extractEvents} disabled={extracting} title="Extract research events with Enzo">
            {#if extracting}
              <span class="spinner-xs-inline"></span> Extracting…
            {:else}
              <span class="enzo-dot-tiny"></span>
              Extract events
            {/if}
          </button>
          <button class="btn btn-ghost btn-sm" onclick={sendDraftToEnzo} title="Send to Enzo for analysis">
            <span class="text-enzo" style="font-family:var(--mono);font-weight:700;font-size:0.78rem">E</span>
            Ask Enzo
          </button>
          <button class="btn btn-ghost btn-sm" onclick={exportMarkdown} title="Export as Markdown">
            .md
          </button>
          <button class="btn btn-primary btn-sm" onclick={saveRecording}>Save</button>
        </div>

        {#if extractResult}
          {@const totalApproved = [...extractResult.hypotheses, ...extractResult.tasks, ...extractResult.paperTopics, ...extractResult.observations].filter(i => i.approved).length}
          {@const totalItems = extractResult.hypotheses.length + extractResult.tasks.length + extractResult.paperTopics.length + extractResult.observations.length}
          <div class="extract-panel">
            <div class="extract-head">
              <span class="extract-title">
                <span class="enzo-dot-tiny"></span>
                Research events extracted
              </span>
              <span class="extract-count">{totalApproved}/{totalItems} approved</span>
            </div>

            {#if extractResult.hypotheses.length > 0}
              <div class="extract-section">
                <span class="extract-sec-label">Hypotheses → Pipeline</span>
                {#each extractResult.hypotheses as item, i}
                  <div class="extract-item" class:extract-dismissed={!item.approved}>
                    <p class="extract-item-text">{item.text}</p>
                    <div class="extract-item-actions">
                      <button class="ext-btn ext-approve" class:ext-active={item.approved}
                        onclick={() => extractResult!.hypotheses[i].approved = !extractResult!.hypotheses[i].approved}
                        title={item.approved ? 'Approved — click to dismiss' : 'Dismissed — click to approve'}>
                        {item.approved ? '✓' : '✗'}
                      </button>
                    </div>
                  </div>
                {/each}
              </div>
            {/if}

            {#if extractResult.tasks.length > 0}
              <div class="extract-section">
                <span class="extract-sec-label">Tasks → Task list</span>
                {#each extractResult.tasks as item, i}
                  <div class="extract-item" class:extract-dismissed={!item.approved}>
                    <p class="extract-item-text">{item.text}</p>
                    <div class="extract-item-actions">
                      <button class="ext-btn ext-approve" class:ext-active={item.approved}
                        onclick={() => extractResult!.tasks[i].approved = !extractResult!.tasks[i].approved}>
                        {item.approved ? '✓' : '✗'}
                      </button>
                    </div>
                  </div>
                {/each}
              </div>
            {/if}

            {#if extractResult.paperTopics.length > 0}
              <div class="extract-section">
                <span class="extract-sec-label">Paper topics → Enzo search</span>
                {#each extractResult.paperTopics as item, i}
                  <div class="extract-item" class:extract-dismissed={!item.approved}>
                    <p class="extract-item-text">{item.text}</p>
                    <div class="extract-item-actions">
                      <button class="ext-btn ext-approve" class:ext-active={item.approved}
                        onclick={() => extractResult!.paperTopics[i].approved = !extractResult!.paperTopics[i].approved}>
                        {item.approved ? '✓' : '✗'}
                      </button>
                    </div>
                  </div>
                {/each}
              </div>
            {/if}

            {#if extractResult.observations.length > 0}
              <div class="extract-section">
                <span class="extract-sec-label">Observations → Journal</span>
                {#each extractResult.observations as item, i}
                  <div class="extract-item" class:extract-dismissed={!item.approved}>
                    <p class="extract-item-text">{item.text}</p>
                    <div class="extract-item-actions">
                      <button class="ext-btn ext-approve" class:ext-active={item.approved}
                        onclick={() => extractResult!.observations[i].approved = !extractResult!.observations[i].approved}>
                        {item.approved ? '✓' : '✗'}
                      </button>
                    </div>
                  </div>
                {/each}
              </div>
            {/if}

            {#if totalItems === 0}
              <p class="extract-empty">No structured events detected in this transcript.</p>
            {/if}

            <div class="extract-footer">
              <button class="btn btn-ghost btn-sm" onclick={() => extractResult = null}>Dismiss all</button>
              {#if totalApproved > 0}
                <button class="btn btn-primary btn-sm" onclick={commitEvents} disabled={committing}>
                  {committing ? 'Saving…' : `Commit ${totalApproved} event${totalApproved !== 1 ? 's' : ''}`}
                </button>
              {/if}
            </div>
          </div>
        {/if}
      </div>
    {/if}
  </div>

  <!-- Recordings list -->
  <div class="recordings-list">
    {#each store.audioRecords.length > 0 ? store.audioRecords : EXAMPLE_RECORDS as rec (rec.id)}
      <div class="rec-card card">
        <div class="rec-head">
          <div class="rec-meta">
            <span class="rec-dur">{fmtDur(rec.durationSec)}</span>
            <span class="text-xs text-mu">{relTime(rec.createdAt)}</span>
            {#if rec.noteId}
              {@const note = store.notes.find(n => n.id === rec.noteId)}
              {#if note}
                <button
                  class="note-link text-xs"
                  onclick={() => { store.currentNoteId = rec.noteId!; store.view = 'notes'; }}
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                  </svg>
                  {note.title}
                </button>
              {/if}
            {/if}
          </div>
          {#if !rec.id.startsWith('_')}
            {#if rec.r2Key && store.workerBase}
              <button
                class="btn-icon rec-action-btn"
                class:rec-play-active={playingId === rec.id}
                onclick={() => playingId = playingId === rec.id ? null : rec.id}
                title={playingId === rec.id ? 'Hide player' : 'Play recording'}
              >
                {#if playingId === rec.id}
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="none"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                {:else}
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="5,3 19,12 5,21"/></svg>
                {/if}
              </button>
            {/if}
            <button class="btn-icon rec-action-btn" onclick={() => saveTranscriptAsNote(rec)} title="Save as note">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
              </svg>
            </button>
            <button class="btn-icon rec-action-btn" onclick={() => sendTranscriptToEnzo(rec)} title="Ask Enzo">
              <span class="text-enzo" style="font-family:var(--mono);font-weight:700;font-size:0.72rem">E</span>
            </button>
            <button class="btn-icon rec-action-btn" onclick={() => sendTranscriptAsEmail(rec)} title="Send as email">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
              </svg>
            </button>
          {/if}
          <button
            class="btn-icon"
            onclick={async () => {
              if (rec.r2Key && store.workerBase) {
                fetch(`${store.workerBase}/file/${encodeURIComponent(rec.r2Key)}`, { method: 'DELETE' }).catch(() => {});
              }
              if (playingId === rec.id) playingId = null;
              store.audioRecords = store.audioRecords.filter(r => r.id !== rec.id);
              await store.saveAudio();
              showToast('Deleted');
            }}
            title="Delete"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6m5 0V4h4v2"/>
            </svg>
          </button>
        </div>
        {#if rec.r2Key && store.workerBase && playingId === rec.id}
          <audio
            class="rec-player"
            src="{store.workerBase}/file/{encodeURIComponent(rec.r2Key)}"
            controls
            autoplay
          ></audio>
        {/if}
        {#if rec.transcript}
          <p class="rec-transcript text-sm">{rec.transcript}</p>
        {/if}
      </div>
    {:else}
      <div class="empty-state">
        <p class="text-mu text-sm">No recordings yet. Press Start recording above.</p>
      </div>
    {/each}
    {#if store.audioRecords.length === 0}
      <p class="text-xs text-mu" style="text-align:center;padding:8px;font-style:italic">· example recordings shown above</p>
    {/if}
  </div>
</div>
{/if}

<style>
  .landing {
    height: 100%; display: flex; align-items: center; justify-content: center; padding: 32px; background: var(--bg);
  }
  .landing-inner {
    max-width: 480px; display: flex; flex-direction: column; align-items: center; gap: 14px; text-align: center;
  }
  .landing-icon { color: var(--pu); opacity: 0.8; }
  .landing-inner h2 { font-size: 1.4rem; font-weight: 700; }
  .landing-inner p { color: var(--tx2); line-height: 1.6; max-width: 400px; }
  .landing-features { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 6px; text-align: left; width: 100%; max-width: 380px; }
  .landing-features li { font-size: 0.82rem; color: var(--tx2); padding: 6px 10px; background: var(--sf); border: 1px solid var(--bd); border-radius: var(--radius-sm); display: flex; align-items: center; gap: 8px; }
  .landing-features li::before { content: '→'; color: var(--pu); font-size: 0.75rem; }
  .landing-btn { margin-top: 6px; padding: 10px 28px; }

  .audio-view {
    height: 100%;
    overflow-y: auto;
    padding: 24px;
    display: flex;
    flex-direction: column;
    gap: 18px;
  }

  /* ── Quota bar ── */
  .quota-bar-wrap {
    display: flex;
    flex-direction: column;
    gap: 5px;
  }
  .quota-label {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
  }
  .quota-nums { font-variant-numeric: tabular-nums; }
  .quota-track {
    height: 5px;
    background: var(--sf3);
    border-radius: 3px;
    overflow: hidden;
  }
  .quota-fill {
    height: 100%;
    background: var(--gn);
    border-radius: 3px;
    transition: width 1s linear, background var(--transition);
  }
  .quota-fill.quota-warn { background: var(--yw); }

  /* ── Recorder card ── */
  .recorder { display: flex; flex-direction: column; gap: 14px; }
  .recorder-top { display: flex; align-items: center; gap: 16px; }

  .rec-visual {
    width: 56px; height: 56px;
    border-radius: 50%;
    border: 2px solid var(--bd);
    display: flex; align-items: center; justify-content: center;
    color: var(--mu);
    flex-shrink: 0;
    transition: border-color var(--transition), background var(--transition);
  }
  .rec-visual.active {
    border-color: var(--rd);
    background: var(--rd-bg);
    animation: pulse 1.4s ease-in-out infinite;
  }
  .rec-visual.pending {
    border-color: var(--ac);
    background: var(--ac-bg);
  }
  @keyframes pulse {
    0%, 100% { box-shadow: 0 0 0 0 rgba(176,53,53,0.25); }
    50% { box-shadow: 0 0 0 10px rgba(176,53,53,0); }
  }

  .rec-dot {
    width: 14px; height: 14px;
    background: var(--rd);
    border-radius: 50%;
    animation: blink 1s ease-in-out infinite;
  }
  @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.25} }

  .spin-ring {
    width: 22px; height: 22px;
    border: 2px solid var(--bd2);
    border-top-color: var(--ac);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  .rec-middle { display: flex; flex-direction: column; gap: 6px; }

  .rec-stats { display: flex; flex-direction: column; gap: 1px; }
  .rec-time {
    font-size: 1.4rem;
    font-weight: 700;
    font-family: var(--mono);
    font-variant-numeric: tabular-nums;
    color: var(--rd);
    line-height: 1;
  }
  .rec-remaining { font-variant-numeric: tabular-nums; }

  /* ── Live transcript ── */
  .live-transcript {
    background: var(--sf2);
    border: 1px solid var(--bd);
    border-radius: var(--radius-sm);
    padding: 10px 12px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .live-label {
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    color: var(--ac);
  }
  .live-text {
    font-size: 0.875rem;
    color: var(--tx);
    line-height: 1.6;
    max-height: 120px;
    overflow-y: auto;
  }

  /* ── Draft ── */
  .draft-section { display: flex; flex-direction: column; gap: 8px; }
  .draft-label { display: block; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; }
  .draft-area { font-size: 0.875rem; font-family: var(--mono); min-height: 100px; }

  .draft-actions {
    display: flex;
    gap: 8px;
    align-items: center;
  }
  .note-select { flex: 1; font-size: 0.82rem; }

  /* ── Extract events (Wave 9) ── */
  .extract-btn { color: var(--enzo, #a855f7); border-color: rgba(168,85,247,0.25); }
  .extract-btn:hover:not(:disabled) { background: var(--enzo-bg, rgba(168,85,247,0.1)); }
  .enzo-dot-tiny { display: inline-block; width: 5px; height: 5px; border-radius: 50%; background: var(--enzo, #a855f7); margin-right: 3px; vertical-align: middle; }
  .spinner-xs-inline { display: inline-block; width: 10px; height: 10px; border: 1.5px solid var(--bd2); border-top-color: var(--enzo, #a855f7); border-radius: 50%; animation: spin 0.7s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }

  .extract-panel {
    margin-top: 4px;
    background: var(--enzo-bg, rgba(168,85,247,0.05));
    border: 1px solid rgba(168,85,247,0.2);
    border-radius: var(--radius);
    padding: 14px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .extract-head {
    display: flex; align-items: center; justify-content: space-between;
  }
  .extract-title {
    font-size: 0.8rem; font-weight: 700; color: var(--enzo, #a855f7);
    display: flex; align-items: center; gap: 5px;
  }
  .extract-count { font-size: 0.72rem; color: var(--mu); }

  .extract-section { display: flex; flex-direction: column; gap: 4px; }
  .extract-sec-label {
    font-size: 0.68rem; font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.07em; color: var(--mu); margin-bottom: 2px;
  }
  .extract-item {
    display: flex; align-items: flex-start; gap: 8px;
    padding: 6px 8px;
    border-radius: var(--radius-sm);
    background: var(--sf1);
    border: 1px solid var(--bd);
    transition: opacity 0.15s;
  }
  .extract-dismissed { opacity: 0.35; }
  .extract-item-text { flex: 1; font-size: 0.8rem; color: var(--tx); line-height: 1.4; margin: 0; }
  .extract-item-actions { flex-shrink: 0; }

  .ext-btn {
    width: 22px; height: 22px;
    border-radius: 50%;
    font-size: 0.75rem;
    display: flex; align-items: center; justify-content: center;
    background: var(--sf2);
    color: var(--mu);
    transition: all 0.1s;
  }
  .ext-approve.ext-active {
    background: rgba(34,197,94,0.15);
    color: #22c55e;
    border-color: rgba(34,197,94,0.3);
  }
  .ext-approve:not(.ext-active) {
    background: rgba(239,68,68,0.1);
    color: #ef4444;
  }
  .extract-empty { font-size: 0.8rem; color: var(--mu); text-align: center; padding: 8px 0; }
  .extract-footer { display: flex; gap: 8px; justify-content: flex-end; border-top: 1px solid var(--bd); padding-top: 10px; }

  /* ── Recordings list ── */
  .recordings-list { display: flex; flex-direction: column; gap: 10px; }
  .rec-card { display: flex; flex-direction: column; gap: 8px; }
  .rec-head { display: flex; align-items: center; justify-content: space-between; }
  .rec-meta { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .rec-dur { font-size: 0.875rem; font-weight: 700; font-family: var(--mono); color: var(--tx); }

  .note-link {
    display: inline-flex; align-items: center; gap: 3px;
    color: var(--ac); background: transparent; border: none;
    cursor: pointer; font-family: var(--font); padding: 0;
  }
  .note-link:hover { text-decoration: underline; }

  .rec-transcript {
    color: var(--tx2);
    line-height: 1.6;
    background: var(--sf2);
    border-radius: var(--radius-sm);
    padding: 10px;
  }
  .rec-action-btn { color: var(--mu); }
  .rec-action-btn:hover { color: var(--ac); background: var(--ac-bg); }
  .rec-play-active { color: var(--ac) !important; background: var(--ac-bg) !important; }

  .rec-player {
    width: 100%;
    height: 36px;
    border-radius: var(--radius-sm);
    accent-color: var(--ac);
  }

  .empty-state { padding: 40px; text-align: center; }
</style>
