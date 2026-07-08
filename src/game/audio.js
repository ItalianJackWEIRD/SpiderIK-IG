/**
 * Audio: looping soundtrack + pickup SFX + menu blips.
 * A master volume (0..1) scales BOTH music and SFX.
 * Files live in public/sounds/.
 */
const MUSIC_SRC = 'sounds/ost.mp3';
const MENU_PLAY_SRC = 'sounds/menu_play.mp3';
const MENU_SRC = 'sounds/menu_sound.mp3';
const MUSIC_BASE = 0.35; // base music level, before master
const SFX_BASE = 0.65;    // base SFX level, before master

const SFX = {
  normal:    'sounds/pickup_normal.mp3',
  bonus:     'sounds/pickup_bonus.mp3',
  risk_good: 'sounds/pickup_risk_good.mp3',
  risk_bad:  'sounds/pickup_risk_bad.mp3',
};

let music = null;
let master = 1;           // 0..1, set by the volume slider
const cache = new Map();

export function initAudio() {
  music = new Audio(MUSIC_SRC);
  music.loop = true;
  music.volume = MUSIC_BASE * master;
}

/** start the loop; call from a user gesture (Play button) to satisfy autoplay */
export function playMusic() {
  if (music) music.play().catch(() => {});
}

/** master volume 0..1 — rescales the live music and future SFX */
export function setMasterVolume(v) {
  master = Math.max(0, Math.min(1, v));
  if (music) music.volume = MUSIC_BASE * master;
}

function playClip(src, baseVol) {
  let base = cache.get(src);
  if (!base) { base = new Audio(src); cache.set(src, base); }
  const a = base.cloneNode(); // clone: overlapping plays don't cut each other
  a.volume = baseVol * master;
  a.play().catch(() => {});
}

export function playSfx(name) {
  if (SFX[name]) playClip(SFX[name], SFX_BASE);
}

export function playMenuBlip() {
  playClip(MENU_SRC, SFX_BASE);
}

export function playMenuConfirm() {
  playClip(MENU_PLAY_SRC, SFX_BASE);
}