const MUSIC_SRC = 'sounds/ost.mp3';
const MENU_PLAY_SRC = 'sounds/menu_play.mp3';
const MENU_SRC = 'sounds/menu_sound.mp3';
const MUSIC_BASE = 0.35;
const SFX_BASE = 0.65;

const SFX = {
  normal:    'sounds/pickup_normal.mp3',
  bonus:     'sounds/pickup_bonus.mp3',
  risk_good: 'sounds/pickup_risk_good.mp3',
  risk_bad:  'sounds/pickup_risk_bad.mp3',
};

let music = null;
let master = 1;
const cache = new Map();

export function initAudio() {
  music = new Audio(MUSIC_SRC);
  music.loop = true;
  music.volume = MUSIC_BASE * master;
}


export function playMusic() {
  if (music) music.play().catch(() => {});
}


export function setMasterVolume(v) {
  master = Math.max(0, Math.min(1, v));
  if (music) music.volume = MUSIC_BASE * master;
}

function playClip(src, baseVol) {
  let base = cache.get(src);
  if (!base) { base = new Audio(src); cache.set(src, base); }
  const a = base.cloneNode();
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