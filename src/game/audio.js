/**
 * Audio: looping soundtrack + pickup SFX.
 * Files live in public/sounds/ — see the names below.
 * Browsers block autoplay: the music starts on the first user gesture.
 */
const MUSIC_SRC = 'sounds/ost.mp3';
const MUSIC_VOLUME = 0.35;
const SFX_VOLUME = 0.6;

const SFX = {
  normal:    'sounds/pickup_normal.mp3',
  bonus:     'sounds/pickup_bonus.mp3',
  risk_good: 'sounds/pickup_risk_good.mp3',
  risk_bad:  'sounds/pickup_risk_bad.mp3',
};

let music = null;
const cache = new Map();

export function initAudio() {
  music = new Audio(MUSIC_SRC);
  music.loop = true;
  music.volume = MUSIC_VOLUME;
  const start = () => music.play().catch(() => {});
  addEventListener('pointerdown', start, { once: true });
  addEventListener('keydown', start, { once: true });
}

export function playSfx(name) {
  if (!SFX[name]) return;
  let base = cache.get(name);
  if (!base) { base = new Audio(SFX[name]); cache.set(name, base); }
  const a = base.cloneNode(); // clone: overlapping pickups both play
  a.volume = SFX_VOLUME;
  a.play().catch(() => {});
}