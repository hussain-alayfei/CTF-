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

/** A short click/keystroke blip. */
export function playClick() {
  tone(660, 0, 0.05, { type: 'square', gain: 0.06 });
}

/** Correct answer — rising triumphant arpeggio. */
export function playCorrect() {
  const notes = [523.25, 659.25, 783.99, 1046.5]; // C5 E5 G5 C6
  notes.forEach((f, i) => tone(f, i * 0.09, 0.16, { type: 'triangle', gain: 0.2 }));
}

/** Wrong answer — descending buzzer. */
export function playWrong() {
  tone(220, 0, 0.28, { type: 'sawtooth', gain: 0.16, slideTo: 90 });
  noise(0, 0.12, 0.05);
}

/** First blood — dramatic alarm siren everyone hears. */
export function playFirstBlood() {
  // Two-tone siren sweep.
  tone(880, 0, 0.35, { type: 'sawtooth', gain: 0.22, slideTo: 440 });
  tone(660, 0.3, 0.35, { type: 'sawtooth', gain: 0.22, slideTo: 990 });
  tone(880, 0.62, 0.4, { type: 'square', gain: 0.22, slideTo: 1320 });
  noise(0, 0.2, 0.06);
}

/** A hint being unlocked. */
export function playHint() {
  tone(440, 0, 0.1, { type: 'sine', gain: 0.14 });
  tone(587.33, 0.09, 0.14, { type: 'sine', gain: 0.14 });
}

/** Countdown tick for the final seconds. */
export function playTick() {
  tone(1200, 0, 0.04, { type: 'square', gain: 0.08 });
}

/** Time's up. */
export function playTimeUp() {
  tone(392, 0, 0.5, { type: 'sawtooth', gain: 0.2, slideTo: 130 });
  noise(0, 0.4, 0.08);
}
