import { OrbManager } from './orbs.js';
import { GameTimer } from './timer.js';
import { initHUD, updateHUD, showGameOver } from '../ui/hud.js';
import { initMusic } from '../audio/music.js';

/**
 * Gameplay glue — the ONLY interface main.js will ever talk to:
 *   initGame(scene)                  once, after scene creation
 *   updateGame(dt, t, spiderPos)     every frame, after wrapWorld()
 */

const TIME_PER_ORB = 5;    // seconds gained per collected orb
const START_SECONDS = 30;

let orbs = null;
let timer = null;
let score = 0;
let gameOver = false;

export function initGame(scene) {
  orbs = new OrbManager(scene);
  timer = new GameTimer();
  score = 0;
  gameOver = false;
  initHUD();
  // page-scoped: restart reloads the page, so this runs once per "session";
  // move this call to the start-menu Play click when Phase 7 lands
  initMusic();
  timer.onDeath(() => {
    gameOver = true;
    showGameOver(score);
  });
  timer.start(START_SECONDS);
}

export function updateGame(dt, t, spiderPos) {
  if (!orbs || gameOver) return;

  orbs.update(t, spiderPos);

  const picked = orbs.checkPickup(spiderPos);
  if (picked) {
    score += picked;
    timer.addTime(TIME_PER_ORB * picked);
  }

  timer.update(dt);
  updateHUD(timer, score);
}
