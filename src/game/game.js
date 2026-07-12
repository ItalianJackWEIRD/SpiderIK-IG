import { OrbManager } from './orbs.js';
import { GameTimer } from './timer.js';
import { initHUD, updateHUD, showGameOver, popTimerDelta } from '../ui/hud.js';
import { initAudio, playMusic, playSfx } from './audio.js';
import { playerState } from './state.js';

const DIFFICULTY_SECONDS = { easy: 63, normal: 48, hard: 33 };
let startSeconds = DIFFICULTY_SECONDS.normal; 
let orbs = null;
let timer = null;
let score = 0;
let gameOver = false;
let started = false;


export function initGame(scene) {
  orbs = new OrbManager(scene, 6);
  timer = new GameTimer();
  timer.start(startSeconds);
  timer.running = false;
  score = 0;
  gameOver = false;
  started = false;
  initHUD();
  initAudio();
  updateHUD(timer, score);
  timer.onDeath(() => {
    gameOver = true;
    showGameOver(score);
  });
}

export function setDifficulty(key) {
  startSeconds = DIFFICULTY_SECONDS[key] ?? DIFFICULTY_SECONDS.normal;
  if (timer) { timer.start(startSeconds); timer.running = false; updateHUD(timer, score); }
}


export function startGame() {
  if (started) return;
  started = true;
  timer.running = true;
  playMusic();
}

export function updateGame(dt, t, spiderPos) {
  if (!orbs || gameOver) return;

  orbs.update(t, spiderPos);

  if (!started) return;

  for (const e of orbs.checkPickup(spiderPos)) {
    score++;
    timer.addTime(e.seconds);
    playSfx(e.type === 'risk' ? (e.good ? 'risk_good' : 'risk_bad') : e.type);
    popTimerDelta(e.seconds);
    if (e.type === 'bonus') playerState.refillStamina = true;
  }

  timer.update(dt);
  updateHUD(timer, score);
}

export function isGameOver() { return gameOver; }
export { showPause, hidePause } from '../ui/hud.js';