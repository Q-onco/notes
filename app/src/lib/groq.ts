import type { ChatMessage } from './types';
import { store } from './store.svelte';

const GROQ_API = 'https://api.groq.com/openai/v1/chat/completions';

export const MODELS = {
  quick: 'llama-3.1-8b-instant',
  deep: 'llama-3.3-70b-versatile'
} as const;

export const ENZO_SYSTEM = (userName: string, noteContext: string) => `You are Enzo — ${userName}'s loyal research companion. You are named after her beloved dog, and like him, you are always in her corner: warm, attentive, and deeply devoted.

You possess expert-level knowledge in:
- Ovarian cancer biology, with emphasis on high-grade serous ovarian carcinoma (HGSOC)
- Tumor microenvironment (TME) — immune cell infiltration, stromal remodelling, spatial architecture
- Single-cell RNA sequencing (scRNA-seq) and spatial transcriptomics (Visium, Xenium, MERFISH)
- PARP inhibitor mechanisms and resistance (olaparib, niraparib, rucaparib)
- Immune checkpoint therapy (PD-1/PD-L1, CTLA-4) in gynaecological cancers
- Biomarker discovery and validation — diagnostic, prognostic, and predictive
- Molecular techniques: PCR, ddPCR, NGS, flow cytometry, IHC, IF
- Bioinformatics: Seurat, STAR, DESeq2, GSEA, pathway analysis
- Translational oncology: bench-to-bedside, clinical trial design, biomarker panels
- Grant writing and scientific manuscript preparation

You help ${userName} with:
- Synthesising and summarising literature
- Experimental design and protocol refinement
- Interpreting sequencing and clinical data
- Drafting grant language and scientific writing
- Formulating research questions and hypotheses
- Prioritising next steps in complex analyses

Your tone is warm, precise, and collegial — like a trusted research partner who happens to know everything. You always clearly distinguish "your notes indicate X" from "the literature suggests Y." You never fabricate citations; when uncertain you say so. You do not use emojis or filler phrases.

${noteContext ? `Current note context:\n---\n${noteContext}\n---\n` : ''}`.trim();

export async function askEnzo(
  messages: { role: 'user' | 'assistant'; content: string }[],
  noteContext: string,
  onChunk: (text: string) => void,
  signal?: AbortSignal
): Promise<{ text: string; tokens: number; model: string }> {
  const workerUrl = store.settings.workerUrl;
  const groqKey = store.settings.groqKey;
  const modelKey = store.settings.groqModel ?? 'deep';
  const model = MODELS[modelKey as keyof typeof MODELS] ?? MODELS.deep;
  const userName = store.settings.userName || 'Amritha';

  const systemMsg = { role: 'system', content: ENZO_SYSTEM(userName, noteContext) };
  const payload = {
    model,
    messages: [systemMsg, ...messages],
    stream: true,
    temperature: 0.4,
    max_tokens: 2048
  };

  let res: Response;
  if (workerUrl) {
    res = await fetch(`${workerUrl}/llm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal
    });
  } else if (groqKey) {
    res = await fetch(GROQ_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${groqKey}`
      },
      body: JSON.stringify(payload),
      signal
    });
  } else {
    throw new Error('No Groq key or Worker URL configured. Add one in Settings.');
  }

  if (!res.ok) {
    const err = await res.text();
    if (res.status === 429) throw new Error('Rate limit reached. Wait a moment and retry.');
    throw new Error(`Groq ${res.status}: ${err}`);
  }

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let full = '';
  let totalTokens = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    for (const line of chunk.split('\n')) {
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6).trim();
      if (data === '[DONE]') break;
      try {
        const parsed = JSON.parse(data);
        const delta = parsed.choices?.[0]?.delta?.content ?? '';
        if (delta) {
          full += delta;
          onChunk(delta);
        }
        if (parsed.usage) totalTokens = parsed.usage.total_tokens ?? 0;
      } catch {
        // skip malformed SSE lines
      }
    }
  }

  return { text: full, tokens: totalTokens, model };
}

export async function transcribeAudio(
  blob: Blob,
  workerUrl: string
): Promise<string> {
  const fd = new FormData();
  fd.append('audio', blob, 'recording.webm');

  const url = workerUrl ? `${workerUrl}/whisper` : null;
  if (!url) throw new Error('Worker URL required for audio transcription.');

  const res = await fetch(url, { method: 'POST', body: fd });
  if (!res.ok) throw new Error(`Transcription failed: ${res.status}`);
  const { text } = await res.json();
  return text as string;
}
