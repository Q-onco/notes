<script lang="ts">
  let { onclose }: { onclose: () => void } = $props();

  let search = $state('');

  const SECTIONS = [
    {
      id: 'start',
      title: 'Getting started',
      color: 'ac',
      items: [
        {
          q: 'Logging in',
          a: 'Enter your GitHub Personal Access Token (PAT) on the login screen. The PAT is both your authentication credential and your encryption source — it never leaves your device in plaintext.'
        },
        {
          q: 'Where data lives',
          a: 'Every save creates a commit in your GitHub repository as an encrypted .enc file. AES-256-GCM encryption with PBKDF2 (600,000 iterations) — nothing is readable without your PAT.'
        },
        {
          q: 'Trust this device',
          a: 'Checking "Trust this device" on login stores your token in sessionStorage so the app reloads without re-entering the PAT. Logging out clears it immediately.'
        },
        {
          q: 'Offline use',
          a: 'Q·onco is a Progressive Web App (PWA) — install it from your browser\'s install prompt. Once cached, the app shell loads offline; data syncs when connectivity returns.'
        }
      ]
    },
    {
      id: 'notes',
      title: 'Notes',
      color: 'ac',
      items: [
        {
          q: 'Creating and editing',
          a: 'Press + in the sidebar or "New note" on the dashboard. Notes use Markdown — use # for headings, **bold**, *italic*, `code`, and > for blockquotes.'
        },
        {
          q: 'Task extraction',
          a: 'Write - [ ] task text in any note and it automatically appears in your Tasks list. Use - [x] to mark it done. Tasks created this way stay linked to their source note.'
        },
        {
          q: 'Tags',
          a: 'Type in the tag field below the note title and press Enter or comma to add. Tags appear in search and help you group related notes across experiments, papers, or contexts.'
        },
        {
          q: 'Pin and archive',
          a: 'Pinned notes appear at the top of the sidebar. Archived notes are hidden from the main view but never deleted — they remain in your encrypted storage and audit trail.'
        },
        {
          q: 'Auto-save',
          a: 'Notes save automatically 1.2 s after you stop typing. The timestamp in the toolbar confirms the last save. Every save is a distinct GitHub commit.'
        }
      ]
    },
    {
      id: 'journal',
      title: 'Journal',
      color: 'enzo',
      items: [
        {
          q: 'Daily entries',
          a: 'The journal is for free-form reflection — what happened today, what you discovered, what puzzled you. Entries are date-stamped and fully searchable.'
        },
        {
          q: 'Mood and context tags',
          a: 'Select a mood chip (Focused, Curious, Frustrated…) and a context tag (Research, Writing, Experiment…) before saving. These feed into calendar dots and future analytics.'
        },
        {
          q: 'Markdown support',
          a: 'Journal entries render Markdown — paste a code snippet, a gene list, or a table and it will format correctly in the read view.'
        },
        {
          q: 'Searching entries',
          a: 'Use the search bar at the top of the Journal page to filter by any word in the body or context tag. Useful for finding when you last worked on a specific pathway or experiment.'
        }
      ]
    },
    {
      id: 'tasks',
      title: 'Tasks',
      color: 'rd',
      items: [
        {
          q: 'Adding tasks',
          a: 'Type in the task field and press Enter or click Add. Set priority (High / Medium / Low) and an optional due date before adding.'
        },
        {
          q: 'Due dates',
          a: 'Tasks with due dates appear as red dots on the Calendar. Click the day to see all tasks due, and toggle them done directly from the calendar view.'
        },
        {
          q: 'Completing and deleting',
          a: 'Click the checkbox to mark a task done. The × button on the right deletes it permanently. Filter between All / Open / Done using the tabs.'
        },
        {
          q: 'Note-linked tasks',
          a: 'Tasks extracted from a note via - [ ] syntax show a "From note" chip. Click it to jump directly back to the source note.'
        }
      ]
    },
    {
      id: 'calendar',
      title: 'Calendar',
      color: 'yw',
      items: [
        {
          q: 'Colour-coded dots',
          a: 'Each day cell shows coloured dots: blue = notes, amber = journal, purple = audio, green = Enzo sessions, yellow = calendar events, red = tasks due. Click any day to see details.'
        },
        {
          q: 'Apple Calendar import',
          a: 'Export an .ics file from Apple Calendar (File → Export) and import it here. Events appear as yellow dots and show in the day detail panel.'
        },
        {
          q: 'Exporting',
          a: 'Click Export to download all imported calendar events as a single .ics file — ready to re-import into Apple Calendar or any other app.'
        },
        {
          q: 'Clicking the clock',
          a: 'The time display in the top bar is a shortcut: clicking it jumps the calendar to today and selects the current day.'
        }
      ]
    },
    {
      id: 'enzo',
      title: 'Enzo AI',
      color: 'enzo',
      items: [
        {
          q: 'Who is Enzo?',
          a: 'Enzo is your oncology research AI, named after Dr. Amritha\'s dog. She has expert knowledge in ovarian cancer biology, TME, scRNA-seq, spatial transcriptomics, PARP inhibitors, biomarker discovery, and bioinformatics.'
        },
        {
          q: 'Note context',
          a: 'When you have a note open, Enzo can read its content. The blue context bar at the bottom of the chat panel shows which note she is currently referencing.'
        },
        {
          q: 'Quick prompts',
          a: 'The Dashboard has shortcut prompts (Summarise my latest note, Suggest next analysis steps…). Clicking one pre-fills the Enzo input and opens her panel.'
        },
        {
          q: 'Quick vs Deep model',
          a: 'Quick = llama-3.1-8b-instant (fast, lighter tasks). Deep = llama-3.3-70b-versatile (complex reasoning, literature synthesis). Switch in Settings.'
        },
        {
          q: 'Chat history',
          a: 'Click the History tab in the Enzo panel to search all past conversations by keyword. Sessions are grouped by date and stored encrypted in your repository.'
        },
        {
          q: 'Stopping a response',
          a: 'Click Stop at any time to abort a streaming response. The partial text is discarded and the input is re-enabled immediately.'
        }
      ]
    },
    {
      id: 'research',
      title: 'Research feeds',
      color: 'pu',
      items: [
        {
          q: 'Paper sources',
          a: 'The Research tab pulls from PubMed, bioRxiv, medRxiv, Nature, and Cell. Results are fetched via a Cloudflare Worker proxy and ranked by relevance.'
        },
        {
          q: 'Searching',
          a: 'Enter a query (e.g. "ovarian cancer PARP inhibitor resistance") to search across all configured sources simultaneously. Results include title, authors, abstract, and DOI link.'
        },
        {
          q: 'Opening papers',
          a: 'Click any result card to open the paper\'s canonical URL. Use the Enzo panel alongside to discuss the abstract or draft a summary.'
        }
      ]
    },
    {
      id: 'audio',
      title: 'Audio & transcription',
      color: 'pu',
      items: [
        {
          q: 'Recording',
          a: 'Click the microphone button in the Audio view. The browser will request microphone access. Recording stops when you click Stop — the audio is then sent for transcription.'
        },
        {
          q: 'Transcription',
          a: 'Audio is transcribed via Groq Whisper through the Cloudflare Worker. Requires a Worker URL set in Settings. Transcripts are stored encrypted alongside the audio metadata.'
        },
        {
          q: 'Linking to notes',
          a: 'Recordings can be linked to a specific note. Open the note first, then record — the audio record will reference that note automatically.'
        }
      ]
    },
    {
      id: 'settings',
      title: 'Settings',
      color: 'mu',
      items: [
        {
          q: 'Groq API key',
          a: 'Required for Enzo chat if no Worker URL is set. Get a free key at console.groq.com. The key is stored encrypted in your repository settings/keys.enc.'
        },
        {
          q: 'Worker URL',
          a: 'A Cloudflare Worker URL that proxies Groq, Whisper, and paper search requests. Required for audio transcription. Deploy the /worker folder to Cloudflare Workers.'
        },
        {
          q: 'Theme',
          a: 'Auto (follows the clock — light 06:00–19:00, dark at night), Light, or Dark. The toggle in the top bar cycles through all three.'
        },
        {
          q: 'Username',
          a: 'Appears in the Dashboard greeting and in Enzo\'s responses. Change it in Settings to your preferred name.'
        }
      ]
    }
  ];

  const filtered = $derived(
    search.trim()
      ? SECTIONS.map(s => ({
          ...s,
          items: s.items.filter(
            it =>
              it.q.toLowerCase().includes(search.toLowerCase()) ||
              it.a.toLowerCase().includes(search.toLowerCase()) ||
              s.title.toLowerCase().includes(search.toLowerCase())
          )
        })).filter(s => s.items.length > 0)
      : SECTIONS
  );

  let searchEl = $state<HTMLInputElement | undefined>(undefined);

  $effect(() => {
    searchEl?.focus();
  });

  function handleKey(e: KeyboardEvent) {
    if (e.key === 'Escape') onclose();
  }
</script>

<svelte:window onkeydown={handleKey} />

<!-- Backdrop -->
<div class="backdrop" onclick={onclose} role="presentation"></div>

<!-- Dialog -->
<div class="help-dialog" role="dialog" aria-modal="true" aria-label="Help">
  <div class="help-head">
    <div class="help-title-row">
      <h2>Help &amp; reference</h2>
      <button class="btn-icon close-btn" onclick={onclose} aria-label="Close help">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>
    <input
      type="search"
      bind:value={search}
      placeholder="Search help topics..."
      class="help-search"
      bind:this={searchEl}
    />
  </div>

  <div class="help-body">
    {#if filtered.length === 0}
      <p class="no-results text-sm text-mu">No results for "{search}"</p>
    {/if}
    {#each filtered as section}
      <section class="help-section">
        <h3 class="section-title clr-{section.color}">{section.title}</h3>
        <div class="section-items">
          {#each section.items as item}
            <div class="help-item">
              <p class="item-q">{item.q}</p>
              <p class="item-a text-sm">{item.a}</p>
            </div>
          {/each}
        </div>
      </section>
    {/each}
    <p class="help-footer text-xs text-mu">Q·onco — encrypted research intelligence for oncology. Built with care.</p>
  </div>
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.45);
    z-index: 1000;
    backdrop-filter: blur(2px);
  }

  .help-dialog {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: 1001;
    width: min(640px, calc(100vw - 32px));
    max-height: calc(100vh - 80px);
    background: var(--sf);
    border: 1px solid var(--bd);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-lg);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    animation: dialog-in 0.18s ease;
  }

  @keyframes dialog-in {
    from { opacity: 0; transform: translate(-50%, -52%); }
    to   { opacity: 1; transform: translate(-50%, -50%); }
  }

  .help-head {
    padding: 18px 20px 12px;
    border-bottom: 1px solid var(--bd);
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .help-title-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .help-title-row h2 { font-size: 1rem; }

  .close-btn { color: var(--mu); }
  .close-btn:hover { color: var(--tx); background: var(--sf2); }

  .help-search { font-size: 0.875rem; }

  .help-body {
    flex: 1;
    overflow-y: auto;
    padding: 16px 20px 24px;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .no-results { padding: 16px 0; }

  .help-section { display: flex; flex-direction: column; gap: 8px; }

  .section-title {
    font-size: 0.7rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    padding-bottom: 6px;
    border-bottom: 1px solid var(--bd);
  }
  .clr-ac    { color: var(--ac); border-color: var(--ac-bg); }
  .clr-enzo  { color: var(--enzo); border-color: var(--enzo-bd); }
  .clr-rd    { color: var(--rd); border-color: var(--rd-bg); }
  .clr-yw    { color: var(--yw); border-color: var(--yw-bg); }
  .clr-pu    { color: var(--pu); border-color: var(--pu-bg); }
  .clr-mu    { color: var(--mu); border-color: var(--bd); }

  .section-items { display: flex; flex-direction: column; gap: 0; }

  .help-item {
    padding: 9px 0;
    border-bottom: 1px solid var(--bd);
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .help-item:last-child { border-bottom: none; }

  .item-q {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--tx);
  }
  .item-a {
    color: var(--tx2);
    line-height: 1.6;
  }

  .help-footer {
    text-align: center;
    padding-top: 8px;
  }
</style>
