// Synthesized sound effects using the Web Audio API — no audio files needed,
// so the whole app stays self-contained. Everything is generated with
// oscillators and gain envelopes on the fly.

let ctx: AudioContext | null = null;
let muted = false;

function ac(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  // Browsers start the context suspended until a user gesture.
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

/** Call once from a click handler so the audio context is allowed to play. */
export function unlockAudio(): void {
  ac();
}

export function setMuted(v: boolean): void {
  muted = v;
}

export function isMuted(): boolean {
  return muted;
}

type Wave = OscillatorType;

function tone(freq: number, start: number, dur: number, opts: { type?: Wave; gain?: number; slideTo?: number } = {}) {
  const c = ac();
  if (!c || muted) return;
  const t0 = c.currentTime + start;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = opts.type ?? 'square';
  osc.frequency.setValueAtTime(freq, t0);
  if (opts.slideTo) osc.frequency.exponentialRampToValueAtTime(opts.slideTo, t0 + dur);
  const peak = opts.gain ?? 0.18;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

function noise(start: number, dur: number, gain = 0.12) {
  const c = ac();
  if (!c || muted) return;
  const t0 = c.currentTime + start;
  const frames = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, frames, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < frames; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
  const src = c.createBufferSource();
  src.buffer = buf;
  const g = c.createGain();
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(g).connect(c.destination);
  src.start(t0);
}

// ============================================================
//  Cyber / "Black Hat" themed sound palette. Everything leans
//  dark and digital: detuned squares, glitchy noise bursts,
//  and terminal-style data blips.
// ============================================================

/** A short digital keystroke blip. */
export function playClick() {
  tone(880, 0, 0.035, { type: 'square', gain: 0.05 });
}

/** Correct — a clean "ACCESS GRANTED" data-confirm chirp. */
export function playCorrect() {
  // Crisp ascending digital triad with a bright confirm tail.
  tone(523.25, 0, 0.08, { type: 'square', gain: 0.16 });
  tone(783.99, 0.08, 0.09, { type: 'square', gain: 0.16 });
  tone(1174.66, 0.17, 0.16, { type: 'triangle', gain: 0.18 });
  tone(1567.98, 0.28, 0.14, { type: 'sine', gain: 0.12 });
}

/** Wrong — harsh "ACCESS DENIED" glitch buzz. */
export function playWrong() {
  tone(180, 0, 0.22, { type: 'sawtooth', gain: 0.18, slideTo: 70 });
  tone(90, 0.06, 0.24, { type: 'square', gain: 0.12 });
  noise(0, 0.18, 0.08);
}

/** First blood — menacing breach alarm everyone hears. */
export function playFirstBlood() {
  // Deep descending klaxon + rising alert sweep + glitch static.
  tone(440, 0, 0.4, { type: 'sawtooth', gain: 0.22, slideTo: 220 });
  tone(330, 0.36, 0.4, { type: 'sawtooth', gain: 0.22, slideTo: 660 });
  tone(220, 0.72, 0.5, { type: 'square', gain: 0.2, slideTo: 880 });
  noise(0, 0.3, 0.09);
  noise(0.7, 0.2, 0.06);
}

/** A hint being unlocked — soft data-decrypt shimmer. */
export function playHint() {
  tone(392, 0, 0.09, { type: 'sine', gain: 0.12 });
  tone(523.25, 0.08, 0.1, { type: 'sine', gain: 0.12 });
  tone(659.25, 0.16, 0.12, { type: 'triangle', gain: 0.1 });
}

/** Countdown tick for the final seconds — sharp terminal blip. */
export function playTick() {
  tone(1400, 0, 0.035, { type: 'square', gain: 0.08 });
}

/** Time's up — system power-down groan. */
export function playTimeUp() {
  tone(420, 0, 0.6, { type: 'sawtooth', gain: 0.2, slideTo: 80 });
  tone(210, 0.1, 0.6, { type: 'square', gain: 0.12, slideTo: 50 });
  noise(0, 0.5, 0.09);
}

/** A podium place being revealed (glitchy drumroll stab). Pitch rises per place. */
export function playReveal(place: number) {
  const base = place === 3 ? 330 : place === 2 ? 440 : 587.33;
  noise(0, 0.18, 0.06);
  tone(base, 0.06, 0.22, { type: 'square', gain: 0.2 });
  tone(base * 1.5, 0.14, 0.2, { type: 'triangle', gain: 0.15 });
}

/** Winner fanfare for 1st place — cinematic cyber victory. */
export function playFanfare() {
  const seq = [523.25, 659.25, 783.99, 1046.5, 1318.5];
  seq.forEach((f, i) => tone(f, i * 0.11, 0.28, { type: 'square', gain: 0.2 }));
  tone(1046.5, 0.55, 0.4, { type: 'triangle', gain: 0.18 });
  tone(1567.98, 0.6, 0.5, { type: 'sine', gain: 0.14 });
  noise(0, 0.25, 0.06);
}

/** Event start — "SYSTEM ONLINE" boot-up sequence. */
export function playEventStart() {
  // Rising boot sweep + confirm beeps.
  tone(120, 0, 0.5, { type: 'sawtooth', gain: 0.16, slideTo: 720 });
  tone(523.25, 0.5, 0.1, { type: 'square', gain: 0.16 });
  tone(783.99, 0.62, 0.1, { type: 'square', gain: 0.16 });
  tone(1046.5, 0.74, 0.22, { type: 'triangle', gain: 0.18 });
  noise(0, 0.2, 0.05);
}

/** Event end — "SYSTEM SHUTDOWN" descending power-off. */
export function playEventEnd() {
  tone(880, 0, 0.5, { type: 'sawtooth', gain: 0.18, slideTo: 110 });
  tone(440, 0.12, 0.5, { type: 'square', gain: 0.12, slideTo: 70 });
  noise(0, 0.45, 0.08);
}
