<script lang="ts">
  import { onMount } from 'svelte';

  let { onDismiss }: { onDismiss: () => void } = $props();

  let canvas: HTMLCanvasElement;
  let msgVisible = $state(false);
  let fading = $state(false);

  const PAIRS: [string, string][] = [
    ['#ff6b9d', '#a855f7'],
    ['#3b82f6', '#10b981'],
    ['#f59e0b', '#ef4444'],
    ['#a855f7', '#3b82f6'],
    ['#10b981', '#ff6b9d'],
    ['#60a5fa', '#f472b6'],
    ['#34d399', '#fbbf24'],
  ];

  interface P {
    x: number; y: number;
    vx: number; vy: number;
    angle: number; spin: number;
    size: number; alpha: number;
    cA: string; cB: string;
    life: number; maxLife: number;
  }

  function drawDna(ctx: CanvasRenderingContext2D, p: P) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle);
    ctx.globalAlpha = p.alpha;

    const s = p.size * 0.5;
    ctx.lineWidth = 1.6;
    ctx.lineCap = 'round';

    ctx.strokeStyle = p.cA;
    ctx.beginPath();
    ctx.moveTo(-s * 0.5, -s);
    ctx.bezierCurveTo(-s * 0.2, -s * 0.3, s * 0.2, s * 0.3, s * 0.5, s);
    ctx.stroke();

    ctx.strokeStyle = p.cB;
    ctx.beginPath();
    ctx.moveTo(s * 0.5, -s);
    ctx.bezierCurveTo(s * 0.2, -s * 0.3, -s * 0.2, s * 0.3, -s * 0.5, s);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-s * 0.44, -s * 0.72);
    ctx.lineTo(s * 0.44, -s * 0.72);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-s * 0.44, s * 0.72);
    ctx.lineTo(s * 0.44, s * 0.72);
    ctx.stroke();

    ctx.restore();
  }

  function dismiss() {
    if (fading) return;
    fading = true;
    setTimeout(onDismiss, 550);
  }

  onMount(() => {
    const ctx = canvas.getContext('2d')!;
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;

    const particles: P[] = Array.from({ length: 85 }, () => {
      const a = Math.random() * Math.PI * 2;
      const spd = 2.5 + Math.random() * 7.5;
      const [cA, cB] = PAIRS[Math.floor(Math.random() * PAIRS.length)];
      return {
        x: cx + (Math.random() - 0.5) * 20,
        y: cy + (Math.random() - 0.5) * 20,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd - 2.5,
        angle: Math.random() * Math.PI * 2,
        spin: (Math.random() - 0.5) * 0.14,
        size: 8 + Math.random() * 9,
        alpha: 1, cA, cB,
        life: 0,
        maxLife: 80 + Math.random() * 55,
      };
    });

    let raf: number;

    setTimeout(() => { msgVisible = true; }, 180);
    setTimeout(dismiss, 3300);

    function tick() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const p of particles) {
        p.life++;
        p.vy += 0.13;
        p.x  += p.vx;
        p.y  += p.vy;
        p.vx *= 0.991;
        p.angle += p.spin;
        const fade = p.maxLife * 0.5;
        p.alpha = p.life < fade ? 1 : Math.max(0, 1 - (p.life - fade) / (p.maxLife - fade));
        if (p.alpha > 0.01) drawDna(ctx, p);
      }
      raf = requestAnimationFrame(tick);
    }

    tick();
    return () => cancelAnimationFrame(raf);
  });
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="overlay" class:fading onclick={dismiss}>
  <canvas bind:this={canvas}></canvas>

  {#if msgVisible}
    <div class="msg" class:fading>
      <div class="glow"></div>
      <p class="headline">Welcome Back, Amu!</p>
      <p class="sub">Your research is waiting.</p>
    </div>
  {/if}
</div>

<style>
  .overlay {
    position: fixed;
    inset: 0;
    z-index: 9999;
    background: rgba(8, 12, 20, 0.72);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: opacity 0.55s ease;
  }
  .overlay.fading { opacity: 0; pointer-events: none; }

  canvas {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }

  .msg {
    position: relative;
    z-index: 1;
    text-align: center;
    animation: pop-in 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) both;
    transition: opacity 0.4s ease;
  }
  .msg.fading { opacity: 0; }

  .glow {
    position: absolute;
    inset: -70px;
    background: radial-gradient(circle, rgba(100,50,220,0.3) 0%, transparent 70%);
    pointer-events: none;
  }

  .headline {
    margin: 0;
    font-size: clamp(2rem, 5vw, 3rem);
    font-weight: 800;
    letter-spacing: -0.04em;
    line-height: 1.1;
    background: linear-gradient(135deg, #60a5fa 0%, #a855f7 45%, #f472b6 100%);
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
    filter: drop-shadow(0 0 18px rgba(168,85,247,0.65));
  }

  .sub {
    margin: 10px 0 0;
    font-size: 0.95rem;
    color: rgba(255,255,255,0.45);
    letter-spacing: 0.06em;
  }

  @keyframes pop-in {
    from { transform: scale(0.65) translateY(18px); opacity: 0; }
    to   { transform: scale(1)    translateY(0);    opacity: 1; }
  }
</style>
