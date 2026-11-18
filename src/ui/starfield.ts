/**
 * Lightweight static starfield behind the transparent globe canvas.
 * Deterministic (seeded) so it looks the same on every reload.
 */
export function mountStarfield(canvas: HTMLCanvasElement): () => void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return () => undefined;

  let frame = 0;
  let disposed = false;

  const draw = (): void => {
    if (disposed) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = window.innerWidth;
    const height = window.innerHeight;

    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const random = mulberry32(7 + width * 13 + height);
    const starCount = Math.round((width * height) / 8200);

    for (let i = 0; i < starCount; i += 1) {
      const x = random() * width;
      const y = random() * height;
      const radius = 0.25 + random() * 1.15;
      const bright = 0.18 + random() * 0.6;
      const tint = i % 19 === 0 ? '233, 185, 107' : i % 11 === 0 ? '120, 220, 201' : '226, 240, 236';

      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${tint}, ${bright.toFixed(2)})`;
      ctx.fill();

      if (radius > 1.15) {
        ctx.beginPath();
        ctx.arc(x, y, radius * 3.2, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${tint}, 0.045)`;
        ctx.fill();
      }
    }
  };

  const schedule = (): void => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(draw);
  };

  window.addEventListener('resize', schedule);
  schedule();

  return () => {
    disposed = true;
    cancelAnimationFrame(frame);
    window.removeEventListener('resize', schedule);
  };
}

/** Small, fast deterministic PRNG (mulberry32). */
function mulberry32(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value = (value + 0x6d2b79f5) >>> 0;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
