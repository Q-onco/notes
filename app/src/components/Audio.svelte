<script lang="ts">
  import { store } from '../lib/store.svelte';
  import { transcribeAudio } from '../lib/groq';
  import { nanoid } from 'nanoid';

  let { showToast }: { showToast: (msg: string, type?: 'success' | 'error') => void } = $props();

  let recording = $state(false);
  let transcribing = $state(false);
  let durationSec = $state(0);
  let draftTranscript = $state('');
  let linkNoteId = $state('');
  let timer: ReturnType<typeof setInterval>;

  let mediaRecorder: MediaRecorder | null = null;
  let chunks: Blob[] = [];
  let stream: MediaStream | null = null;

  async function startRecording() {
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';
      mediaRecorder = new MediaRecorder(stream, { mimeType });
      chunks = [];
      durationSec = 0;

      mediaRecorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
      mediaRecorder.onstop = handleStop;
      mediaRecorder.start(1000);
      recording = true;

      timer = setInterval(() => { durationSec++; }, 1000);
    } catch (e) {
      showToast('Microphone access denied', 'error');
    }
  }

  async function stopRecording() {
    if (!mediaRecorder) return;
    clearInterval(timer);
    mediaRecorder.stop();
    stream?.getTracks().forEach(t => t.stop());
    recording = false;
  }

  async function handleStop() {
    const blob = new Blob(chunks, { type: chunks[0]?.type || 'audio/webm' });
    const workerUrl = store.settings.workerUrl;

    if (!workerUrl) {
      draftTranscript = '[Set Worker URL in settings to enable transcription]';
      showToast('No Worker URL set — transcript unavailable', 'error');
      return;
    }

    transcribing = true;
    try {
      const text = await transcribeAudio(blob, workerUrl);
      draftTranscript = text;
    } catch (e) {
      draftTranscript = '';
      showToast((e as Error).message, 'error');
    } finally {
      transcribing = false;
    }
  }

  async function saveRecording() {
    if (!draftTranscript) return;
    const rec = {
      id: nanoid(),
      createdAt: Date.now(),
      durationSec,
      transcript: draftTranscript,
      noteId: linkNoteId || null,
      journalId: null,
      sizeBytes: chunks.reduce((acc, c) => acc + c.size, 0)
    };
    store.audioRecords = [rec, ...store.audioRecords];

    // Link to note if selected
    if (linkNoteId) {
      const note = store.notes.find(n => n.id === linkNoteId);
      if (note) {
        note.audioIds = [...note.audioIds, rec.id];
        note.body += `\n\n---\n*Transcript (${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}):*\n\n${draftTranscript}`;
        note.updatedAt = Date.now();
        await store.saveNotes();
      }
    }

    await store.saveAudio();
    showToast('Recording saved');
    draftTranscript = '';
    linkNoteId = '';
    durationSec = 0;
  }

  function fmtDuration(s: number): string {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${String(sec).padStart(2, '0')}`;
  }

  function relTime(ts: number): string {
    const d = Date.now() - ts;
    if (d < 3600000) return `${Math.floor(d / 60000)}m ago`;
    if (d < 86400000) return `${Math.floor(d / 3600000)}h ago`;
    return new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  }
</script>

<div class="audio-view">
  <div class="audio-header">
    <h2>Audio recordings</h2>
    <p class="text-sm text-mu">{store.audioRecords.length} recordings</p>
  </div>

  <!-- Recorder -->
  <div class="recorder card">
    <div class="recorder-inner">
      <div class="rec-visual" class:active={recording}>
        {#if recording}
          <span class="rec-dot"></span>
          <span class="rec-time">{fmtDuration(durationSec)}</span>
        {:else}
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
            <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
            <line x1="12" y1="19" x2="12" y2="23"/>
            <line x1="8" y1="23" x2="16" y2="23"/>
          </svg>
        {/if}
      </div>

      {#if !recording}
        <button class="btn btn-primary" onclick={startRecording}>Start recording</button>
      {:else}
        <button class="btn btn-danger" onclick={stopRecording}>Stop recording</button>
      {/if}
    </div>

    {#if transcribing}
      <div class="transcribing-msg text-sm text-mu">Transcribing with Whisper...</div>
    {/if}

    {#if draftTranscript}
      <div class="transcript-draft">
        <label class="text-xs text-mu font-label" for="transcript-area">Transcript</label>
        <textarea
          id="transcript-area"
          bind:value={draftTranscript}
          rows={5}
          class="transcript-area"
        ></textarea>
        <div class="save-row">
          <select bind:value={linkNoteId} class="note-select">
            <option value="">Save standalone (no linked note)</option>
            {#each store.notes.filter(n => !n.archived) as note}
              <option value={note.id}>{note.title}</option>
            {/each}
          </select>
          <button class="btn btn-primary" onclick={saveRecording}>Save transcript</button>
        </div>
      </div>
    {/if}
  </div>

  <!-- Recordings list -->
  <div class="recordings-list">
    {#each store.audioRecords as rec (rec.id)}
      <div class="rec-card card">
        <div class="rec-head">
          <div class="rec-meta">
            <span class="rec-dur">{fmtDuration(rec.durationSec)}</span>
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
          <button
            class="btn-icon"
            onclick={async () => {
              store.audioRecords = store.audioRecords.filter(r => r.id !== rec.id);
              await store.saveAudio();
              showToast('Recording deleted');
            }}
            title="Delete"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6m5 0V4h4v2"/>
            </svg>
          </button>
        </div>
        {#if rec.transcript}
          <p class="rec-transcript text-sm">{rec.transcript}</p>
        {/if}
      </div>
    {:else}
      <div class="empty-state">
        <p class="text-mu">No recordings yet. Use the recorder above to capture spoken notes.</p>
      </div>
    {/each}
  </div>
</div>

<style>
  .audio-view {
    height: 100%;
    overflow-y: auto;
    padding: 24px;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .recorder { display: flex; flex-direction: column; gap: 14px; }
  .recorder-inner { display: flex; align-items: center; gap: 20px; }

  .rec-visual {
    width: 60px; height: 60px;
    border-radius: 50%;
    border: 2px solid var(--bd);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--mu);
    flex-shrink: 0;
    transition: border-color var(--transition);
  }
  .rec-visual.active {
    border-color: var(--rd);
    background: var(--rd-bg);
    animation: pulse 1.2s ease-in-out infinite;
  }
  @keyframes pulse {
    0%, 100% { box-shadow: 0 0 0 0 rgba(176,53,53,0.2); }
    50%       { box-shadow: 0 0 0 10px rgba(176,53,53,0); }
  }

  .rec-dot {
    width: 12px; height: 12px;
    background: var(--rd);
    border-radius: 50%;
    animation: blink 1s ease-in-out infinite;
  }
  @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }

  .rec-time { font-size: 0.9rem; font-weight: 700; font-family: var(--mono); color: var(--rd); margin-left: 6px; }

  .transcribing-msg { text-align: center; padding: 8px; }

  .transcript-draft { display: flex; flex-direction: column; gap: 10px; }
  .font-label { display: block; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 2px; }
  .transcript-area { font-size: 0.875rem; font-family: var(--mono); min-height: 100px; }
  .save-row { display: flex; gap: 8px; }
  .note-select { flex: 1; font-size: 0.82rem; }

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

  .empty-state { padding: 40px; text-align: center; }
</style>
