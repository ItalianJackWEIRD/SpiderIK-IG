import { playerState } from '../game/state.js';

/**
 * HTML HUD overlay (course requirement: HUD outside the WebGL canvas).
 * - big timer, top center: integer seconds, turns red below 10
 * - orb counter, top left
 * - stamina bar, bottom center: reads playerState from game/state.js
 *   (the agreed single contact point with Task A); recolors when exhausted
 * - game-over screen: dark overlay + Restart (location.reload() for now)
 *
 * Exports: initHUD(), updateHUD(timer, score), showGameOver(finalScore),
 *          popTimerDelta(seconds) — floating +N/-N next to the timer on pickup
 */

const COLORS = {
  text: '#cfe9ff',
  timerLow: '#ff4d5a',
  stamina: '#7fd4ff',
  staminaExhausted: '#ff4d5a',
  glow: 'rgba(102, 204, 255, 0.75)',
};

let timerBox = null;
let timerEl = null;
let scoreNumEl = null;
let staminaFill = null;
let overEl = null;
let deltaPopupCount = 0; // stacking offset per popup +N/-N attivo

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

  timerBox = el('div', `
    position: fixed; top: 14px; left: 50%; transform: translateX(-50%);
    z-index: 10; user-select: none; pointer-events: none;
  `);
  timerEl = el('div', `
    font: 700 44px ${font}; color: ${COLORS.text};
    text-shadow: 0 0 14px ${COLORS.glow};
  `, timerBox);

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

/** floating +N / -N next to the timer, called once per orb pickup */
export function popTimerDelta(seconds) {
  if (!timerBox || !seconds) return;
  const font = "'Segoe UI', system-ui, sans-serif";
  const positive = seconds > 0;
  const label = `${positive ? '+' : '\u2212'}${Math.abs(Math.round(seconds))}`;

  const offsetTop = 10 + deltaPopupCount * 26;
  deltaPopupCount++;

  const popup = el('span', `
    position: absolute; left: calc(100% + 10px); top: ${offsetTop}px;
    font: 700 22px ${font};
    color: ${positive ? COLORS.stamina : COLORS.timerLow};
    text-shadow: 0 0 10px ${positive ? COLORS.glow : 'rgba(255, 77, 90, 0.6)'};
    white-space: nowrap;
  `, timerBox);
  popup.textContent = label;

  const anim = popup.animate(
    [
      { transform: 'translateY(0px)', opacity: 1 },
      { transform: 'translateY(-24px)', opacity: 0 },
    ],
    { duration: 850, easing: 'ease-out' }
  );
  anim.onfinish = () => {
    popup.remove();
    deltaPopupCount = Math.max(0, deltaPopupCount - 1);
  };
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

let pauseEl = null;

/** velo nero + "PAUSE" + riquadro comandi (course requirement: controls list) */
export function showPause() {
  if (pauseEl) return;
  const font = "'Segoe UI', system-ui, sans-serif";

  pauseEl = el('div', `
    position: fixed; inset: 0; z-index: 18;
    display: flex; align-items: center; justify-content: center;
    background: rgba(4, 6, 14, 0.72);
  `);
  el('div', `
    font: 800 72px ${font}; color: ${COLORS.text};
    text-shadow: 0 0 22px ${COLORS.glow}; letter-spacing: 4px;
  `, pauseEl).textContent = 'PAUSE';

  // riquadro comandi in alto a destra
  const box = el('div', `
    position: absolute; top: 22px; right: 22px;
    padding: 16px 20px; border-radius: 10px;
    background: rgba(10, 14, 26, 0.85);
    border: 1px solid rgba(127, 212, 255, 0.25);
    box-shadow: 0 0 18px rgba(0, 0, 0, 0.5);
    font: 500 15px ${font}; color: ${COLORS.text}; line-height: 1.9;
  `, pauseEl);
  const rows = [
    ['W / S', 'Move forward / back'],
    ['A / D', 'Strafe left / right'],
    ['Q / E', 'Turn left / right'],
    ['Shift', 'Sprint (uses stamina)'],
    ['Mouse', 'Orbit camera'],
    ['Esc', 'Resume'],
    ['Mouse / C', 'Orbit camera / toggle view'],
  ];
  el('div', `
    font: 700 16px ${font}; margin-bottom: 8px;
    color: ${COLORS.stamina}; letter-spacing: 1px;
  `, box).textContent = 'CONTROLS';
  for (const [key, desc] of rows) {
    const row = el('div', 'display: flex; gap: 14px; align-items: baseline;', box);
    el('span', `
      min-width: 62px; font-weight: 700; color: ${COLORS.stamina};
    `, row).textContent = key;
    el('span', 'opacity: 0.9;', row).textContent = desc;
  }
}

export function hidePause() {
  if (pauseEl) { pauseEl.remove(); pauseEl = null; }
}