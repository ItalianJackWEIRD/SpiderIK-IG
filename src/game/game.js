import { OrbManager } from './orbs.js';
import { GameTimer } from './timer.js';
import { initHUD, updateHUD, showGameOver, popTimerDelta } from '../ui/hud.js';
import { initAudio, playMusic, playSfx } from './audio.js';

const DIFFICULTY_SECONDS = { easy: 63, normal: 48, hard: 33 };
let startSeconds = DIFFICULTY_SECONDS.normal; // default

let orbs = null;
let timer = null;
let score = 0;
let gameOver = false;
let started = false;

/** prepara tutto ma NON avvia il timer né la musica (menu attivo) */
export function initGame(scene) {
  orbs = new OrbManager(scene, 6);
  timer = new GameTimer();
  timer.start(startSeconds);   // riempie remaining...
  timer.running = false;        // ...ma resta FERMO finché non parte il gioco
  score = 0;
  gameOver = false;
  started = false;
  initHUD();
  initAudio();
  updateHUD(timer, score);      // mostra "30" fermo nel menu
  timer.onDeath(() => {
    gameOver = true;
    showGameOver(score);
  });
}

/** imposta i secondi iniziali dalla difficoltà del menu; re-arma il timer fermo */
export function setDifficulty(key) {
  startSeconds = DIFFICULTY_SECONDS[key] ?? DIFFICULTY_SECONDS.normal;
  if (timer) { timer.start(startSeconds); timer.running = false; updateHUD(timer, score); }
}

/** chiamata dal Play: avvia timer e musica */
export function startGame() {
  if (started) return;
  started = true;
  timer.running = true;
  playMusic();
}

export function updateGame(dt, t, spiderPos) {
  if (!orbs || gameOver) return;

  orbs.update(t, spiderPos); // bobbing/spin: ok anche prima dello start

  if (!started) return;      // niente pickup/timer finché non premi Play

  for (const e of orbs.checkPickup(spiderPos)) {
    score++;
    timer.addTime(e.seconds);
    playSfx(e.type === 'risk' ? (e.good ? 'risk_good' : 'risk_bad') : e.type);
    popTimerDelta(e.seconds);
  }

  timer.update(dt);
  updateHUD(timer, score);
}

export function isGameOver() { return gameOver; }
export { showPause, hidePause } from '../ui/hud.js';