import { useEffect, useRef } from 'react';
import { playFireworkBurst } from '../lib/sounds';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

interface Shell {
  x: number;
  y: number;
  vy: number;
  targetY: number;
  color: string;
}

const COLORS = ['#39ff14', '#ffd400', '#00e5ff', '#ff3b3b', '#ff6ec7', '#ffffff', '#a06bff'];

const GRAVITY = 0.035;
const DRAG = 0.985;

/**
 * Canvas firework show for the finale. Hand-rolled rather than pulling in a
 * confetti library — the repo has no animation dependencies and this needs to
 * scale its intensity for the winner anyway.
 *
 * `intensity` 1 = the 3rd/2nd place show. `intensity` 2 = the winner: roughly
 * three times the shells, bigger bursts, deeper booms, and an opening barrage.
 */
export default function Fireworks({ intensity = 1 }: { intensity?: number }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const intensityRef = useRef(intensity);
  intensityRef.current = intensity;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Respect a user's reduced-motion preference — show nothing rather than
    // strobing a full particle system at someone who asked us not to.
    const reduced =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) return;

    let width = 0;
    let height = 0;
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    const particles: Particle[] = [];
    const shells: Shell[] = [];

    const launch = () => {
      const big = intensityRef.current >= 2;
      shells.push({
        x: width * (0.12 + Math.random() * 0.76),
        y: height,
        vy: -(big ? 8.5 + Math.random() * 3 : 7 + Math.random() * 2.5),
        targetY: height * (big ? 0.12 + Math.random() * 0.3 : 0.22 + Math.random() * 0.32),
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
      });
    };

    const explode = (shell: Shell) => {
      const big = intensityRef.current >= 2;
      const count = big ? 90 + Math.floor(Math.random() * 50) : 46 + Math.floor(Math.random() * 24);
      const power = big ? 5.2 : 3.6;
      // Some shells are multicolour, some are a single hue — variety reads richer.
      const single = Math.random() < 0.55;
      for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count + Math.random() * 0.15;
        const speed = power * (0.35 + Math.random() * 0.75);
        const maxLife = (big ? 75 : 58) + Math.random() * 30;
        particles.push({
          x: shell.x,
          y: shell.y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: maxLife,
          maxLife,
          color: single ? shell.color : COLORS[Math.floor(Math.random() * COLORS.length)],
          size: (big ? 2.2 : 1.8) + Math.random() * 1.6,
        });
      }
      // Half the shells are audible, so a heavy barrage doesn't turn to mush.
      if (Math.random() < 0.5) playFireworkBurst(big);
    };

    // Opening barrage — the winner's reveal should hit immediately, not ramp up.
    const opening = intensity >= 2 ? 5 : 2;
    for (let i = 0; i < opening; i++) window.setTimeout(launch, i * 130);

    let raf = 0;
    let sinceLaunch = 0;

    const frame = () => {
      const big = intensityRef.current >= 2;

      // Trails: paint a translucent black over the last frame instead of clearing,
      // so particles smear into comet tails.
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.fillRect(0, 0, width, height);
      ctx.globalCompositeOperation = 'lighter';

      sinceLaunch += 1;
      const interval = big ? 16 : 34;
      if (sinceLaunch >= interval) {
        sinceLaunch = 0;
        launch();
        if (big && Math.random() < 0.5) launch(); // winner gets doubles
      }

      for (let i = shells.length - 1; i >= 0; i--) {
        const s = shells[i];
        s.y += s.vy;
        s.vy += GRAVITY * 3;
        ctx.beginPath();
        ctx.fillStyle = s.color;
        ctx.arc(s.x, s.y, 2.4, 0, Math.PI * 2);
        ctx.fill();
        if (s.y <= s.targetY || s.vy >= 0) {
          explode(s);
          shells.splice(i, 1);
        }
      }

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= DRAG;
        p.vy = p.vy * DRAG + GRAVITY;
        p.life -= 1;
        if (p.life <= 0) {
          particles.splice(i, 1);
          continue;
        }
        const alpha = Math.max(0, p.life / p.maxLife);
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.fillStyle = p.color;
        ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      raf = window.requestAnimationFrame(frame);
    };
    raf = window.requestAnimationFrame(frame);

    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
    // `intensity` is read live through intensityRef; it's in the deps only so the
    // opening barrage re-fires if a reveal escalates to the winner.
  }, [intensity]);

  // `fixed`, not `absolute`: the reveal lives inside a scrollable container, and an
  // absolutely-positioned canvas would size itself to the scroll *content* rather
  // than the viewport, leaving the show clipped or offset once the content is tall.
  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none fixed inset-0 h-full w-full"
    />
  );
}
