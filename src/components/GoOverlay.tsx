import { useEffect, useRef, useState } from 'react';

type Phase = 'idle' | 'three' | 'two' | 'one' | 'go';

// How long each countdown number is shown (ms)
const TICK = 750;
// How long the GO! screen stays before fading (ms)
const GO_HOLD = 2000;
// Fade-out starts this many ms before unmount
const EXIT_OFFSET = 420;

interface Particle {
  emoji: string;
  angle: number; // degrees — parent div rotates to this angle, child flies "up"
  size: number;  // px
  delay: number; // ms
}

// Two rings of particles for the explosion burst
const PARTICLES: Particle[] = [
  // inner ring (10 particles)
  { emoji: '🔥', angle: 0,   size: 30, delay: 0   },
  { emoji: '⚡', angle: 36,  size: 24, delay: 55  },
  { emoji: '💥', angle: 72,  size: 32, delay: 25  },
  { emoji: '🔥', angle: 108, size: 26, delay: 85  },
  { emoji: '🌪️', angle: 144, size: 28, delay: 15  },
  { emoji: '⚡', angle: 180, size: 22, delay: 65  },
  { emoji: '🔥', angle: 216, size: 30, delay: 40  },
  { emoji: '💥', angle: 252, size: 24, delay: 95  },
  { emoji: '🌪️', angle: 288, size: 26, delay: 50  },
  { emoji: '⚡', angle: 324, size: 28, delay: 75  },
  // outer ring (10 particles, offset 18°, more delay)
  { emoji: '✨', angle: 18,  size: 20, delay: 120 },
  { emoji: '🔥', angle: 54,  size: 22, delay: 145 },
  { emoji: '💥', angle: 90,  size: 20, delay: 130 },
  { emoji: '✨', angle: 126, size: 22, delay: 160 },
  { emoji: '🔥', angle: 162, size: 20, delay: 105 },
  { emoji: '⚡', angle: 198, size: 22, delay: 170 },
  { emoji: '✨', angle: 234, size: 20, delay: 140 },
  { emoji: '💥', angle: 270, size: 22, delay: 175 },
  { emoji: '🌪️', angle: 306, size: 24, delay: 185 },
  { emoji: '✨', angle: 342, size: 20, delay: 195 },
];

export default function GoOverlay({
  show,
  onDone,
}: {
  show: boolean;
  onDone: () => void;
}) {
  const [phase, setPhase] = useState<Phase>('idle');
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    if (!show) {
      setPhase('idle');
      return;
    }
    // Sequence: 3 → 2 → 1 → GO! → done
    setPhase('three');
    const timers: ReturnType<typeof setTimeout>[] = [];
    timers.push(setTimeout(() => setPhase('two'),  TICK));
    timers.push(setTimeout(() => setPhase('one'),  TICK * 2));
    timers.push(setTimeout(() => setPhase('go'),   TICK * 3));
    timers.push(setTimeout(() => {
      setPhase('idle');
      onDoneRef.current();
    }, TICK * 3 + GO_HOLD));
    return () => timers.forEach(clearTimeout);
  }, [show]);

  if (phase === 'idle') return null;

  // ─── GO! explosion phase ───────────────────────────────────────────────────
  if (phase === 'go') {
    const exitDelay = GO_HOLD - EXIT_OFFSET;
    return (
      <div
        className="pointer-events-none fixed inset-0 z-50 overflow-hidden"
        style={{
          background: 'rgba(0,0,0,0.9)',
          animation: `ctf-go-fadein 0.25s ease-out, ctf-go-exit ${EXIT_OFFSET}ms ease-in ${exitDelay}ms forwards`,
        }}
      >
        {/* Fire glow layers — two pulsing radial gradients */}
        <div
          style={{
            position: 'absolute', inset: 0,
            background: 'radial-gradient(ellipse at 50% 60%, rgba(255,80,0,0.35) 0%, transparent 60%)',
            animation: 'ctf-fire-glow 0.7s ease-in-out infinite alternate',
          }}
        />
        <div
          style={{
            position: 'absolute', inset: 0,
            background: 'radial-gradient(ellipse at 50% 40%, rgba(57,255,20,0.22) 0%, transparent 55%)',
            animation: 'ctf-fire-glow 1.1s ease-in-out infinite alternate',
            animationDelay: '0.35s',
          }}
        />
        <div
          style={{
            position: 'absolute', inset: 0,
            background: 'radial-gradient(ellipse at 50% 50%, rgba(255,200,0,0.18) 0%, transparent 45%)',
            animation: 'ctf-fire-glow 0.9s ease-in-out infinite alternate',
            animationDelay: '0.2s',
          }}
        />

        {/* Burst rings */}
        {([0, 0.13, 0.26] as const).map((delay) => (
          <div
            key={delay}
            style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <div
              style={{
                width: 100,
                height: 100,
                borderRadius: '50%',
                border: '2px solid rgba(57,255,20,0.65)',
                animation: `ctf-burst 1.4s ease-out forwards`,
                animationDelay: `${delay}s`,
                opacity: 0,
              }}
            />
          </div>
        ))}

        {/* Orange burst rings */}
        {([0.07, 0.2] as const).map((delay) => (
          <div
            key={`o${delay}`}
            style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <div
              style={{
                width: 80,
                height: 80,
                borderRadius: '50%',
                border: '2px solid rgba(255,120,0,0.5)',
                animation: `ctf-burst 1.3s ease-out forwards`,
                animationDelay: `${delay}s`,
                opacity: 0,
              }}
            />
          </div>
        ))}

        {/* Explosion particles — each is a rotated parent + fly-out child */}
        {PARTICLES.map((p, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              transform: `rotate(${p.angle}deg)`,
              transformOrigin: '0 0',
            }}
          >
            <span
              style={{
                display: 'block',
                fontSize: p.size,
                lineHeight: 1,
                animation: `ctf-particle 1.15s ease-out forwards`,
                animationDelay: `${p.delay}ms`,
                opacity: 0,
              }}
            >
              {p.emoji}
            </span>
          </div>
        ))}

        {/* GO! text + sub-label */}
        <div
          style={{
            position: 'absolute', inset: 0,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
          }}
        >
          <div
            style={{
              fontSize: 'clamp(5rem, 22vw, 13rem)',
              fontWeight: 900,
              lineHeight: 1,
              letterSpacing: '-0.02em',
              color: 'rgb(57 255 20)',
              textShadow:
                '0 0 30px rgb(57 255 20 / 0.9), 0 0 70px rgb(57 255 20 / 0.5), 0 0 140px rgb(57 255 20 / 0.25)',
              animation: 'ctf-go-blast 0.55s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
            }}
          >
            GO!
          </div>
          <div
            style={{
              marginTop: '0.75rem',
              fontSize: '0.8rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.4em',
              color: 'rgb(57 255 20 / 0.75)',
              animation: 'ctf-go-sub 0.4s ease-out 0.35s both',
            }}
          >
            The hunt begins
          </div>
        </div>
      </div>
    );
  }

  // ─── 3 / 2 / 1 countdown phases ───────────────────────────────────────────
  const num = phase === 'three' ? '3' : phase === 'two' ? '2' : '1';
  // Green → Amber → Red progression mirrors urgency
  const [textColor, glowColor] =
    phase === 'three'
      ? ['rgb(57 255 20)',   'rgb(57 255 20 / 0.6)']
      : phase === 'two'
        ? ['rgb(255 176 0)', 'rgb(255 176 0 / 0.6)']
        : ['rgb(255 59 59)', 'rgb(255 59 59 / 0.6)'];

  return (
    // key={phase} forces React to unmount+remount the div on each phase change
    // so the CSS animation restarts cleanly for every new number.
    <div
      key={phase}
      className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center"
      style={{
        background: 'rgba(0,0,0,0.88)',
        animation: `ctf-countdown-flash ${TICK}ms ease-in-out forwards`,
      }}
    >
      <div
        style={{
          fontSize: 'clamp(9rem, 34vw, 20rem)',
          fontWeight: 900,
          lineHeight: 1,
          color: textColor,
          textShadow: `0 0 40px ${glowColor}, 0 0 100px ${glowColor}`,
          animation: `ctf-countdown ${TICK}ms ease-out forwards`,
        }}
      >
        {num}
      </div>
    </div>
  );
}
