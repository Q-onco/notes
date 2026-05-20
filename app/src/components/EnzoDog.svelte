<script lang="ts">
  let { emotion = 'content', size = 'md', opening = false }: {
    emotion?: string;
    size?: 'sm' | 'md' | 'lg';
    opening?: boolean;
  } = $props();

  const SIZES = { sm: [24, 30], md: [40, 50], lg: [72, 90] } as const;

  const BRIGHT = new Set([
    'sunlit','excited','playful','proud','motivated','grateful','warm',
    'devoted','relieved','hopeful','alert'
  ]);
  const SLEEPY = new Set(['sleepy','dreamy','midnight','groggy','nostalgic','cozy']);
  const WORRIED = new Set(['worried','anxious','overwhelmed','frantic','tense','anticipating']);
  const SAD = new Set(['sad','lonely','sulking','withdrawn','tired','bored','hungry','frustrated']);

  const visual = $derived(
    BRIGHT.has(emotion)  ? 'bright'  :
    SLEEPY.has(emotion)  ? 'sleepy'  :
    WORRIED.has(emotion) ? 'worried' :
    SAD.has(emotion)     ? 'sad'     :
    'neutral'
  );

  const dims = $derived(SIZES[size as keyof typeof SIZES] ?? SIZES.md);
</script>

<svg
  width={dims[0]}
  height={dims[1]}
  viewBox="0 0 120 150"
  xmlns="http://www.w3.org/2000/svg"
  class="enzo-dog"
  data-visual={visual}
  class:opening
  aria-hidden="true"
>
  <!-- Tail -->
  <g class="tail">
    <path d="M 88 72 Q 108 52 100 34 Q 112 42 108 60 Q 118 50 112 68"
      stroke="#c87941" stroke-width="7" fill="none"
      stroke-linecap="round" stroke-linejoin="round"/>
  </g>
  <!-- Body -->
  <ellipse cx="62" cy="94" rx="30" ry="22" fill="#c87941"/>
  <ellipse cx="47" cy="97" rx="13" ry="17" fill="#e8a55a"/>
  <!-- Legs -->
  <rect x="74" y="108" width="11" height="24" rx="5" fill="#b06830"/>
  <rect x="52" y="108" width="11" height="26" rx="5" fill="#c87941"/>
  <rect x="36" y="108" width="11" height="26" rx="5" fill="#c87941"/>
  <!-- Paws -->
  <ellipse cx="57" cy="135" rx="7" ry="4" fill="#7a4010"/>
  <ellipse cx="41" cy="135" rx="7" ry="4" fill="#7a4010"/>
  <ellipse cx="79" cy="133" rx="7" ry="4" fill="#7a4010"/>
  <!-- Neck + head -->
  <rect x="47" y="70" width="22" height="24" rx="9" fill="#c87941"/>
  <circle cx="57" cy="58" r="22" fill="#c87941"/>
  <!-- Snout -->
  <ellipse cx="49" cy="63" rx="13" ry="11" fill="#e8a55a"/>
  <!-- Ears -->
  <g class="ear-l">
    <path d="M 40 42 Q 28 24 35 14 Q 44 30 48 44 Z" fill="#7a4010"/>
  </g>
  <g class="ear-r">
    <path d="M 74 42 Q 86 24 79 14 Q 70 30 66 44 Z" fill="#7a4010"/>
  </g>
  <!-- Eyes (base) -->
  <circle cx="48" cy="53" r="4.5" fill="#1a0a00"/>
  <circle cx="66" cy="53" r="4.5" fill="#1a0a00"/>
  <circle cx="49.5" cy="51.5" r="1.8" fill="white"/>
  <circle cx="67.5" cy="51.5" r="1.8" fill="white"/>
  <!-- Nose -->
  <ellipse cx="50" cy="63" rx="5.5" ry="4" fill="#1a0a00"/>
  <ellipse cx="49" cy="62" rx="2" ry="1.5" fill="rgba(255,255,255,0.2)"/>
  <!-- Mouth (default smile) -->
  <path d="M 44 68 Q 50 73 56 68"
    stroke="#7a4010" stroke-width="1.8" fill="none" stroke-linecap="round"/>
  <!-- Tongue: bright only -->
  {#if visual === 'bright'}
    <ellipse cx="50" cy="71" rx="4.5" ry="3.5" fill="#e06060"/>
  {/if}
  <!-- Collar -->
  <rect x="44" y="75" width="26" height="7" rx="3.5" fill="#3a5fc8"/>
  <circle cx="57" cy="83" r="5" fill="#e8943a"/>
  <text x="57" y="86" text-anchor="middle" fill="white"
    font-size="5" font-weight="700" font-family="Inter, sans-serif">E</text>

  <!-- ── Expression overlays (rendered on top) ── -->

  <!-- Sleepy/sad: droopy eyelids -->
  {#if visual === 'sleepy' || visual === 'sad'}
    <ellipse cx="48" cy="50" rx="5.5" ry="4.5" fill="#c87941"/>
    <ellipse cx="66" cy="50" rx="5.5" ry="4.5" fill="#c87941"/>
  {/if}

  <!-- Worried: inner-brow furrows -->
  {#if visual === 'worried'}
    <path d="M 46 49.5 L 43.5 46.5"
      stroke="#1a0a00" stroke-width="2" stroke-linecap="round"/>
    <path d="M 64 49.5 L 66.5 46.5"
      stroke="#1a0a00" stroke-width="2" stroke-linecap="round"/>
  {/if}

  <!-- Sad: override smile to slight frown -->
  {#if visual === 'sad'}
    <rect x="42" y="66" width="16" height="9" fill="#e8a55a"/>
    <path d="M 44 70 Q 50 67 56 70"
      stroke="#7a4010" stroke-width="1.8" fill="none" stroke-linecap="round"/>
  {/if}
</svg>

<style>
  .enzo-dog {
    display: block;
    /* Animation defaults */
    --wag-dur:   0.55s;
    --wag-from:  -28deg;
    --wag-to:    22deg;
    --bounce-dur: 0.9s;
    --bounce-y:  -9px;
    --ear-dur:   1.1s;
    --ear-r-dur: 1.3s;
    animation: dog-bounce var(--bounce-dur) ease-in-out infinite alternate;
    transform-origin: 60px 135px;
    filter: drop-shadow(0 2px 6px rgba(184,120,60,0.25));
  }

  /* ── Emotion-driven animation variants ── */
  [data-visual="bright"] {
    --wag-dur:    0.38s;
    --wag-from:   -30deg;
    --wag-to:     24deg;
    --bounce-dur: 0.65s;
    --bounce-y:   -13px;
    --ear-dur:    0.7s;
    --ear-r-dur:  0.85s;
  }
  [data-visual="neutral"] {
    --wag-dur:    0.55s;
    --wag-from:   -20deg;
    --wag-to:     16deg;
    --bounce-dur: 0.9s;
    --bounce-y:   -8px;
    --ear-dur:    1.1s;
    --ear-r-dur:  1.3s;
  }
  [data-visual="sleepy"] {
    --wag-dur:    2.2s;
    --wag-from:   -8deg;
    --wag-to:     6deg;
    --bounce-dur: 2.5s;
    --bounce-y:   -3px;
    --ear-dur:    2.0s;
    --ear-r-dur:  2.4s;
  }
  [data-visual="worried"] {
    --wag-dur:    0.3s;
    --wag-from:   -18deg;
    --wag-to:     18deg;
    --bounce-dur: 0.5s;
    --bounce-y:   -7px;
    --ear-dur:    0.6s;
    --ear-r-dur:  0.7s;
  }
  [data-visual="sad"] {
    --wag-dur:    2.8s;
    --wag-from:   -10deg;
    --wag-to:     6deg;
    --bounce-dur: 3.0s;
    --bounce-y:   -3px;
    --ear-dur:    2.5s;
    --ear-r-dur:  2.8s;
  }

  /* ── Den-open stretch animation ── */
  .enzo-dog.opening {
    animation: den-stretch 0.45s ease-out both !important;
  }

  /* ── Sub-element animations ── */
  .tail {
    transform-origin: 88px 72px;
    animation: tail-wag var(--wag-dur) ease-in-out infinite alternate;
  }
  .ear-l {
    transform-origin: 40px 42px;
    animation: ear-flap var(--ear-dur) ease-in-out infinite alternate;
  }
  .ear-r {
    transform-origin: 74px 42px;
    animation: ear-flap-r var(--ear-r-dur) ease-in-out infinite alternate;
  }

  @keyframes dog-bounce {
    from { transform: translateY(0) rotate(-1.5deg); }
    to   { transform: translateY(var(--bounce-y, -9px)) rotate(1.5deg); }
  }
  @keyframes tail-wag {
    from { transform: rotate(var(--wag-from, -28deg)); }
    to   { transform: rotate(var(--wag-to, 22deg)); }
  }
  @keyframes ear-flap {
    from { transform: rotate(-7deg); }
    to   { transform: rotate(9deg); }
  }
  @keyframes ear-flap-r {
    from { transform: rotate(7deg); }
    to   { transform: rotate(-9deg); }
  }
  @keyframes den-stretch {
    0%   { transform: scaleX(1)    translateY(0)     rotate(0deg); }
    25%  { transform: scaleX(1.22) translateY(3px)   rotate(-2deg); }
    55%  { transform: scaleX(0.87) translateY(-10px) rotate(1.5deg); }
    78%  { transform: scaleX(1.06) translateY(-4px)  rotate(0.5deg); }
    100% { transform: scaleX(1)    translateY(0)     rotate(-1.5deg); }
  }
</style>
