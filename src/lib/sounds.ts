// Synthesized sound effects using the Web Audio API — no audio files needed,
// so the whole app stays self-contained. Everything is generated with
// oscillators and gain envelopes on the fly.
//
// Everything is routed through a shared master gain + gentle compressor so the
// palette stays warm and never clips or gets harsh, even when several notes
// overlap. Waveforms lean on sine/triangle (soft, musical) and only reach for
// square/sawtooth where a note wants a bit of edge.

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = false;

function ac(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    // Master chain: gain -> soft compressor -> speakers.
    master = ctx.createGain();
    master.gain.value = 0.75;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.knee.value = 24;
    comp.ratio.value = 3;
    comp.attack.value = 0.003;
    comp.release.value = 0.25;
    master.connect(comp).connect(ctx.destination);
  }
  // Browsers start the context suspended until a user gesture.
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

/** Call once from a click handler so the audio context is allowed to play. */
export function unlockAudio(): void {
  ac();
}

/**
 * True once the AudioContext has actually resumed (browsers require a real
 * user gesture for this — calling `.resume()` from a `useEffect` on mount,
 * with no click involved, silently leaves it 'suspended' forever). The
 * projector `/board` page uses this to detect the exact case where sound
 * looks "on" in the UI but the browser is still blocking every sound —
 * e.g. someone opens `/board` in a fresh tab to project it and never
 * personally clicks anything on that tab afterwards.
 */
export function isAudioRunning(): boolean {
  return ctx?.state === 'running';
}

export function setMuted(v: boolean): void {
  muted = v;
}

export function isMuted(): boolean {
  return muted;
}

type Wave = OscillatorType;

interface ToneOpts {
  type?: Wave;
  gain?: number;
  slideTo?: number;
  attack?: number;
  /** Curve of the pitch slide. Linear feels smoother for short glides. */
  glide?: 'exp' | 'lin';
}

/** A single enveloped note routed through the master chain. */
function tone(freq: number, start: number, dur: number, opts: ToneOpts = {}) {
  const c = ac();
  if (!c || !master || muted) return;
  const t0 = c.currentTime + start;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = opts.type ?? 'triangle';
  osc.frequency.setValueAtTime(freq, t0);
  if (opts.slideTo) {
    if (opts.glide === 'lin') osc.frequency.linearRampToValueAtTime(opts.slideTo, t0 + dur);
    else osc.frequency.exponentialRampToValueAtTime(Math.max(1, opts.slideTo), t0 + dur);
  }
  const peak = opts.gain ?? 0.16;
  const atk = opts.attack ?? 0.012;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + atk);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.03);
}

/**
 * A soft filtered noise burst — reads as "air / whoosh" rather than harsh
 * static thanks to the lowpass sweep.
 */
function noise(start: number, dur: number, gain = 0.1, cutoff = 2400) {
  const c = ac();
  if (!c || !master || muted) return;
  const t0 = c.currentTime + start;
  const frames = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, frames, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < frames; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
  const src = c.createBufferSource();
  src.buffer = buf;
  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(cutoff, t0);
  lp.frequency.exponentialRampToValueAtTime(Math.max(200, cutoff * 0.35), t0 + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(lp).connect(g).connect(master);
  src.start(t0);
}

// ============================================================
//  Warm, digital "cyber-arcade" palette — clean and musical.
// ============================================================

/**
 * A fast, high "data blip" — a very short bandpass noise chirp that reads as a
 * terminal/keystroke tick. Layered under some cues to give a hacker texture.
 */
function dataBlip(start: number, gain = 0.05, cutoff = 5200) {
  const c = ac();
  if (!c || !master || muted) return;
  const t0 = c.currentTime + start;
  const dur = 0.03;
  const frames = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, frames, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < frames; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
  const src = c.createBufferSource();
  src.buffer = buf;
  const bp = c.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = cutoff;
  bp.Q.value = 6;
  const g = c.createGain();
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(bp).connect(g).connect(master);
  src.start(t0);
}

/** A short, soft UI keystroke blip — a clean high sine tick (data-processing feel). */
export function playClick() {
  tone(2000, 0, 0.02, { type: 'sine', gain: 0.05, attack: 0.002 });
  dataBlip(0, 0.035, 6000);
}

/**
 * Correct — "ACCESS GRANTED": two quick digital chirps, then a bright ascending
 * major arpeggio with a shimmering bell tail. The chirps + data blips give it a
 * distinctly hacker/terminal character.
 */
export function playCorrect() {
  // Quick data-chirps up front.
  tone(880, 0.0, 0.05, { type: 'square', gain: 0.06, slideTo: 1320, glide: 'lin' });
  dataBlip(0.0, 0.045);
  dataBlip(0.05, 0.04);
  // C5 – E5 – G5 – C6 arpeggio (log ramps make each note "chirp" in).
  tone(523.25, 0.1, 0.16, { type: 'triangle', gain: 0.16 });
  tone(659.25, 0.19, 0.16, { type: 'triangle', gain: 0.16 });
  tone(783.99, 0.28, 0.2, { type: 'triangle', gain: 0.17 });
  tone(1046.5, 0.38, 0.5, { type: 'sine', gain: 0.16 });
  tone(1567.98, 0.4, 0.4, { type: 'sine', gain: 0.06 }); // airy overtone
}

/**
 * Wrong — "ACCESS DENIED": a short square-wave glitch dive (the classic
 * cyberpunk error), softened with a sine sub so it alerts without screeching.
 */
export function playWrong() {
  tone(300, 0.0, 0.16, { type: 'square', gain: 0.08, slideTo: 120, glide: 'lin' });
  tone(220, 0.0, 0.2, { type: 'sine', gain: 0.16, slideTo: 130, glide: 'lin' });
  tone(98, 0.1, 0.3, { type: 'triangle', gain: 0.08 }); // sub weight
  dataBlip(0.0, 0.04, 2600);
}

/** Fallback synthesized siren — dramatic breach alert with a glitch sweep. */
function playFirstBloodSynth() {
  // Two-tone alarm sweep (minor interval) + a filtered impact whoosh + glitch.
  tone(392, 0.0, 0.34, { type: 'sawtooth', gain: 0.16, slideTo: 587.33, glide: 'lin' });
  tone(392, 0.34, 0.34, { type: 'sawtooth', gain: 0.16, slideTo: 587.33, glide: 'lin' });
  tone(196, 0.0, 0.7, { type: 'sine', gain: 0.12 }); // ominous sub drone
  tone(1046.5, 0.7, 0.5, { type: 'triangle', gain: 0.12 }); // resolving stab
  noise(0.0, 0.5, 0.08, 1800);
  dataBlip(0.02, 0.05, 4200);
  dataBlip(0.09, 0.045, 3200);
}

function playAudioFile(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const audio = new Audio(src);
    audio.volume = 0.9;
    let settled = false;
    const fail = () => {
      if (settled) return;
      settled = true;
      reject(new Error('unplayable'));
    };
    const ok = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    audio.addEventListener('error', fail, { once: true });
    audio.play().then(ok).catch(fail);
  });
}

// Cache whether a custom clip exists so repeated first bloods in the same
// session don't keep retrying a missing file.
let firstBloodFileMissing = false;

/**
 * First blood — plays a custom uploaded clip if the admin dropped one in
 * `public/sounds/first-blood.mp3` (or `.wav`); otherwise falls back to the
 * built-in synthesized siren automatically.
 */
export function playFirstBlood() {
  if (muted) return;
  if (firstBloodFileMissing) {
    playFirstBloodSynth();
    return;
  }
  playAudioFile('/sounds/first-blood.mp3')
    .catch(() => playAudioFile('/sounds/first-blood.wav'))
    .catch(() => {
      firstBloodFileMissing = true;
      playFirstBloodSynth();
    });
}

/** A hint being unlocked — soft, magical decrypt shimmer. */
export function playHint() {
  tone(587.33, 0.0, 0.12, { type: 'sine', gain: 0.12 });
  tone(880, 0.08, 0.14, { type: 'sine', gain: 0.12 });
  tone(1174.66, 0.16, 0.22, { type: 'triangle', gain: 0.1 });
}

/** Countdown tick for the final seconds — soft, rounded blip. */
export function playTick() {
  tone(1100, 0, 0.05, { type: 'sine', gain: 0.09, attack: 0.004 });
}

/** Time's up — gentle system power-down. */
export function playTimeUp() {
  tone(523.25, 0.0, 0.7, { type: 'triangle', gain: 0.16, slideTo: 130, glide: 'exp' });
  tone(261.63, 0.12, 0.7, { type: 'sine', gain: 0.12, slideTo: 90 });
  noise(0.0, 0.5, 0.06, 1400);
}

/**
 * A podium place being revealed — a rising "power-up" riser that escalates per
 * place (3rd smallest, 2nd bigger) plus a noise whoosh, a data-chirp ladder,
 * and a solid landing stab so each reveal feels like a build-and-drop.
 */
export function playReveal(place: number) {
  const base = place === 3 ? 392 : 523.25; // 2nd is higher/brighter than 3rd
  // Whoosh in.
  noise(0.0, 0.3, 0.06, 1800);
  // Rising riser sweep.
  tone(base * 0.5, 0.0, 0.34, { type: 'triangle', gain: 0.14, slideTo: base * 1.5, glide: 'lin' });
  // Data-chirp ladder building tension.
  dataBlip(0.0, 0.04, 3000);
  dataBlip(0.1, 0.045, 4200);
  dataBlip(0.2, 0.05, 5400);
  // Landing stab (a bright fifth) when it lands.
  tone(base, 0.34, 0.32, { type: 'triangle', gain: 0.17 });
  tone(base * 1.5, 0.36, 0.3, { type: 'sine', gain: 0.1 });
  tone(base * 0.5, 0.34, 0.4, { type: 'sine', gain: 0.09 }); // sub weight
}

/**
 * Winner fanfare for 1st place — a big, triumphant cyber-victory sequence: a
 * riser sweep into an ascending arpeggio run with octave sparkles, an impact
 * whoosh, a sub-bass drop, and a held major chord to land on. Clearly the
 * biggest moment of the finale.
 */
export function playFanfare() {
  // Riser + impact whoosh to kick it off.
  tone(200, 0.0, 0.34, { type: 'triangle', gain: 0.14, slideTo: 1046.5, glide: 'lin' });
  noise(0.0, 0.28, 0.07, 3200);
  tone(65.41, 0.28, 0.6, { type: 'sine', gain: 0.16 }); // sub-bass drop
  // Ascending triumphant run: C-E-G-C-E.
  const seq = [523.25, 659.25, 783.99, 1046.5, 1318.5];
  seq.forEach((f, i) => {
    const t = 0.3 + i * 0.11;
    tone(f, t, 0.26, { type: 'triangle', gain: 0.18 });
    tone(f * 2, t, 0.2, { type: 'sine', gain: 0.05 }); // sparkle octave
    dataBlip(t, 0.03, 6000);
  });
  // Held triumphant C-major chord to land on.
  const hold = 0.3 + seq.length * 0.11 + 0.05;
  tone(1046.5, hold, 0.9, { type: 'triangle', gain: 0.17 });
  tone(1318.5, hold + 0.02, 0.88, { type: 'sine', gain: 0.12 });
  tone(1567.98, hold + 0.04, 0.86, { type: 'sine', gain: 0.1 });
  tone(523.25, hold, 0.9, { type: 'sine', gain: 0.1 }); // root weight
  noise(hold - 0.04, 0.35, 0.05, 3400);
}

/** Event start — warm "SYSTEM ONLINE" boot-up + confirm chime. */
export function playEventStart() {
  tone(160, 0.0, 0.45, { type: 'triangle', gain: 0.14, slideTo: 640, glide: 'lin' });
  tone(523.25, 0.46, 0.14, { type: 'triangle', gain: 0.16 });
  tone(783.99, 0.58, 0.14, { type: 'triangle', gain: 0.16 });
  tone(1046.5, 0.7, 0.4, { type: 'sine', gain: 0.16 });
  noise(0.0, 0.24, 0.04, 2600);
}

/** Event end — soft descending "SYSTEM STANDBY" chime. */
export function playEventEnd() {
  tone(783.99, 0.0, 0.4, { type: 'triangle', gain: 0.16 });
  tone(587.33, 0.14, 0.4, { type: 'triangle', gain: 0.15 });
  tone(392, 0.28, 0.6, { type: 'sine', gain: 0.15 });
  noise(0.0, 0.4, 0.05, 1600);
}
