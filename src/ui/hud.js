import { playerState } from '../game/state.js';

/**
 * HTML HUD overlay (course requirement: HUD outside the WebGL canvas).
 * - big timer, top center: integer seconds, turns red below 10
 * - orb counter, top left
 * - stamina bar, bottom center: reads playerState from game/state.js
 *   (the agreed single contact point with Task A); recolors when exhausted
 * - game-over screen: dark overlay + Restart (location.reload() for now)
 *
 * Exports: initHUD(), updateHUD(timer, score), showGameOver(finalScore)
 */

const COLORS = {
  text: '#cfe9ff',
  timerLow: '#ff4d5a',
  stamina: '#7fd4ff',
  staminaExhausted: '#ff4d5a',
  glow: 'rgba(102, 204, 255, 0.75)',
};

let timerEl = null;
let scoreNumEl = null;
let staminaFill = null;
let overEl = null;

/** small glowing circle, mirrors the in-game orbs (avoids any logo-like glyph) */
function orbDot(size, parent) {
  return el('span', `
    width: ${size}px; height: ${size}px; border-radius: 50%;
    background: ${COLORS.stamina};
    box-shadow: 0 0 ${size * 0.8}px ${COLORS.glow};
    flex: none;
  `, parent);
}

function el(tag, css, parent = document.body) {
  const e = document.createElement(tag);
  e.style.cssText = css;
  parent.appendChild(e);
  return e;
}

export function initHUD() {
  const font = "'Segoe UI', system-ui, sans-serif";

  timerEl = el('div', `
    position: fixed; top: 14px; left: 50%; transform: translateX(-50%);
    z-index: 10; font: 700 44px ${font}; color: ${COLORS.text};
    text-shadow: 0 0 14px ${COLORS.glow};
    user-select: none; pointer-events: none;
  `);

  const scoreBox = el('div', `
    position: fixed; top: 18px; left: 18px; z-index: 10;
    display: flex; align-items: center; gap: 9px;
    font: 700 26px ${font}; color: ${COLORS.text};
    text-shadow: 0 0 12px ${COLORS.glow};
    user-select: none; pointer-events: none;
  `);
  orbDot(15, scoreBox);
  scoreNumEl = el('span', '', scoreBox);

  const staminaBox = el('div', `
    position: fixed; bottom: 22px; left: 50%; transform: translateX(-50%);
    z-index: 10; width: 220px; height: 12px; border-radius: 6px;
    background: rgba(255, 255, 255, 0.15);
    box-shadow: 0 0 8px rgba(0, 0, 0, 0.5);
    user-select: none; pointer-events: none;
  `);
  staminaFill = el('div', `
    width: 100%; height: 100%; border-radius: 6px;
    background: ${COLORS.stamina};
    transition: background-color 0.15s;
  `, staminaBox);
}

export function updateHUD(timer, score) {
  const secs = Math.ceil(timer.remaining);
  timerEl.textContent = secs;
  timerEl.style.color = secs < 10 ? COLORS.timerLow : COLORS.text;

  scoreNumEl.textContent = score;

  staminaFill.style.width = `${playerState.stamina * 100}%`;
  staminaFill.style.backgroundColor =
    playerState.exhausted ? COLORS.staminaExhausted : COLORS.stamina;
}

export function showGameOver(finalScore) {
  if (overEl) return;
  const font = "'Segoe UI', system-ui, sans-serif";

  overEl = el('div', `
    position: fixed; inset: 0; z-index: 20;
    display: flex; flex-direction: column; align-items: center;
    justify-content: center; gap: 14px;
    background: rgba(4, 6, 14, 0.82);
  `);
  el('div', `
    font: 800 64px ${font}; color: ${COLORS.timerLow};
    text-shadow: 0 0 18px rgba(255, 77, 90, 0.6);
  `, overEl).textContent = 'GAME OVER';
  const finalBox = el('div', `
    display: flex; align-items: center; gap: 10px;
    font: 600 26px ${font}; color: ${COLORS.text};
  `, overEl);
  orbDot(17, finalBox);
  el('span', '', finalBox).textContent = finalScore;

  const btn = el('button', `
    margin-top: 10px; padding: 10px 34px; border: none; border-radius: 8px;
    font: 700 22px ${font}; color: #04060e; background: ${COLORS.stamina};
    cursor: pointer;
  `, overEl);
  btn.textContent = 'Restart';
  btn.onclick = () => location.reload(); // full reset for now
}
