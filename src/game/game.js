import { OrbManager } from './orbs.js';
import { GameTimer } from './timer.js';
import { initHUD, updateHUD, showGameOver, popTimerDelta } from '../ui/hud.js';
export { showPause, hidePause } from '../ui/hud.js';
import { initAudio, playSfx } from './audio.js';

const START_SECONDS = 30;

let orbs = null;
let timer = null;
let score = 0;
let gameOver = false;

export function initGame(scene) {
  orbs = new OrbManager(scene, 6);
  timer = new GameTimer();
  score = 0;
  gameOver = false;
  initHUD();
  initAudio();
  timer.onDeath(() => {
    gameOver = true;
    showGameOver(score);
  });
  timer.start(START_SECONDS);
}

export function updateGame(dt, t, spiderPos) {
  if (!orbs || gameOver) return;

  orbs.update(t, spiderPos);

  for (const e of orbs.checkPickup(spiderPos)) {
    score++;
    timer.addTime(e.seconds); // can be negative (risk gone bad)
    playSfx(e.type === 'risk' ? (e.good ? 'risk_good' : 'risk_bad') : e.type);
    popTimerDelta(e.seconds);
  }

  timer.update(dt);
  updateHUD(timer, score);
}

export function isGameOver() {
  return gameOver;
}