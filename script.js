// Quagsire types along with you: each key press drops an arm, plays a watery
// "plip", and the first press starts a generated lo-fi loop. No audio files.

const LEFT_HAND = new Set([
  'Backquote', 'Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5',
  'Tab', 'KeyQ', 'KeyW', 'KeyE', 'KeyR', 'KeyT',
  'CapsLock', 'KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyG',
  'KeyZ', 'KeyX', 'KeyC', 'KeyV', 'KeyB', 'Escape',
]);
const PLIP_NOTES = [261.6, 293.7, 329.6, 392.0, 440.0, 523.3, 587.3, 659.3]; // C major pentatonic
const PLIP_PITCH = 0.75; // typing sounds sit a fourth below the written notes; lower = deeper
const PLIP_VOLUME = 0.2;
const CHORDS = [
  [174.6, 220.0, 261.6, 329.6], // Fmaj7
  [164.8, 196.0, 246.9, 293.7], // Em7
  [146.8, 174.6, 220.0, 261.6], // Dm7
  [130.8, 164.8, 196.0, 246.9], // Cmaj7
];
const BEAT = 60 / 72; // seconds
const MAX_TYPED = 48;

const arms = { left: document.querySelector('.arm-l'), right: document.querySelector('.arm-r') };
const typed = document.getElementById('typed');
const hint = document.getElementById('hint');
const soundButton = document.getElementById('sound');

const held = new Map(); // key code -> 'left' | 'right'
let lastSide = 'right';
let text = '';

// ---------- arms ----------

function sideFor(code) {
  if (code.endsWith('Left') || LEFT_HAND.has(code)) return 'left';
  if (code === 'Space') return lastSide === 'left' ? 'right' : 'left';
  return 'right';
}

function refreshArms() {
  const down = new Set(held.values());
  arms.left.classList.toggle('down', down.has('left'));
  arms.right.classList.toggle('down', down.has('right'));
}

function press(code) {
  const side = sideFor(code);
  lastSide = side;
  held.set(code, side);
  refreshArms();
  startAudio();
  plip(code);
}

function release(code) {
  held.delete(code);
  refreshArms();
}

// ---------- terminal ----------

function type(key) {
  if (key === 'Enter') text = '';
  else if (key === 'Backspace') text = text.slice(0, -1);
  else if (key.length === 1) text = (text + key).slice(-MAX_TYPED);
  else return;
  hint.hidden = true;
  typed.textContent = text;
}

// ---------- water gun (Ctrl+C) ----------

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
let sprayTimers = [];

function waterGun() {
  if (reducedMotion) return type('Enter');
  sprayTimers.forEach(clearTimeout);
  document.body.classList.remove('spraying');
  void document.body.offsetWidth; // restart the animations
  document.body.classList.add('spraying');
  whoosh();
  sprayTimers = [
    setTimeout(() => type('Enter'), 500),
    setTimeout(() => document.body.classList.remove('spraying'), 900),
  ];
}

// ---------- audio ----------

let ctx, master, noise, nextBar, bar = 0;
let soundOn = true;

function startAudio() {
  if (ctx) return;
  ctx = new AudioContext();
  master = ctx.createGain();
  master.gain.value = soundOn ? 1 : 0;
  master.connect(ctx.destination);

  noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const samples = noise.getChannelData(0);
  for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;

  nextBar = ctx.currentTime + 0.1;
  setInterval(scheduleMusic, 100);
  document.body.classList.add('playing');
}

function envelope(at, peak, attack, length) {
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.linearRampToValueAtTime(peak, at + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + length);
  gain.connect(master);
  return gain;
}

function tone(type, freq, at, peak, attack, length, glideTo) {
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, at);
  if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, at + length * 0.4);
  osc.connect(envelope(at, peak, attack, length));
  osc.start(at);
  osc.stop(at + length);
}

function hiss(at, peak, length, filterType, freq) {
  const src = ctx.createBufferSource();
  src.buffer = noise;
  const filter = ctx.createBiquadFilter();
  filter.type = filterType;
  filter.frequency.value = freq;
  src.connect(filter).connect(envelope(at, peak, 0.002, length));
  src.start(at, Math.random() * 0.5, length);
}

function plip(code) {
  const index = [...code].reduce((sum, c) => sum + c.charCodeAt(0), 0) % PLIP_NOTES.length;
  const freq = PLIP_NOTES[index] * PLIP_PITCH;
  // a bubble: soft attack, pitch rising as it pops
  tone('sine', freq, ctx.currentTime, PLIP_VOLUME, 0.014, 0.18, freq * 1.7);
}

function whoosh() {
  const at = ctx.currentTime;
  const src = ctx.createBufferSource();
  src.buffer = noise;
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(500, at);
  filter.frequency.exponentialRampToValueAtTime(2600, at + 0.5);
  src.connect(filter).connect(envelope(at, 0.5, 0.08, 0.7));
  src.start(at, 0, 0.7);
}

function scheduleMusic() {
  while (nextBar < ctx.currentTime + 0.4) {
    const chord = CHORDS[bar % CHORDS.length];
    for (const freq of chord) tone('triangle', freq, nextBar, 0.05, 0.08, BEAT * 4);
    tone('sine', chord[0] / 2, nextBar, 0.12, 0.02, BEAT * 3.5); // bass

    for (let beat = 0; beat < 4; beat++) {
      const at = nextBar + beat * BEAT;
      if (beat % 2 === 0) tone('sine', 120, at, 0.5, 0.004, 0.28, 45); // kick
      else hiss(at, 0.16, 0.16, 'bandpass', 1800); // snare
      hiss(at + BEAT / 2 + 0.03, 0.03, 0.09, 'bandpass', 6500); // lazy, soft hat
    }
    // a wandering melody note on the off-beat
    const note = PLIP_NOTES[(bar * 3 + 2) % PLIP_NOTES.length];
    tone('sine', note * 2, nextBar + BEAT * 2.5, 0.035, 0.02, BEAT * 1.5);

    nextBar += BEAT * 4;
    bar++;
  }
}

// ---------- events ----------

addEventListener('keydown', (e) => {
  if (e.repeat || e.target === soundButton) return;
  // Ctrl+C: Quagsire water-guns the line away, unless there's selected text to copy (Windows/Linux)
  if (e.ctrlKey && e.code === 'KeyC' && !e.metaKey && !e.altKey && getSelection().isCollapsed) {
    e.preventDefault();
    press(e.code);
    waterGun();
    return;
  }
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.code === 'Space' || e.code === 'Backspace') e.preventDefault();
  press(e.code);
  type(e.key);
});

addEventListener('keyup', (e) => release(e.code));

addEventListener('blur', () => {
  held.clear();
  refreshArms();
});

// touch / mouse: tap the drawing
document.querySelector('.scene').addEventListener('pointerdown', () => {
  const code = lastSide === 'left' ? 'TapRight' : 'TapLeft';
  held.set(code, code === 'TapLeft' ? 'left' : 'right');
  lastSide = held.get(code);
  refreshArms();
  startAudio();
  plip(code + Math.floor(Math.random() * 8));
  hint.hidden = true;
  setTimeout(() => release(code), 110);
});

soundButton.addEventListener('click', () => {
  soundOn = !soundOn;
  soundButton.textContent = soundOn ? 'sound: on' : 'sound: off';
  soundButton.setAttribute('aria-pressed', soundOn);
  if (master) master.gain.value = soundOn ? 1 : 0;
  soundButton.blur(); // so typing goes back to Quagsire
});
