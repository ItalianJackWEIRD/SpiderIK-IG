import { setMasterVolume, playMenuBlip, playMenuConfirm } from '../game/audio.js';

/**
 * Keyboard-only main menu overlay. Up/Down move between rows,
 * Left/Right change slider values, Enter triggers Play.
 * Ground/sky/volume apply LIVE (the skybox behind updates as you scroll).
 *
 * initMainMenu({ onPlay, onGround, onSky, groundCount, skyCount, volume })
 */
export function initMainMenu(opts) {
  const font = "'Segoe UI', system-ui, sans-serif";
  const C = { text: '#cfe9ff', accent: '#7fd4ff', glow: 'rgba(102,204,255,0.75)' };
  const DIFFS = [
    { key: 'easy', label: 'Easy' },
    { key: 'normal', label: 'Normal' },
    { key: 'hard', label: 'Hard' },
  ];

  const state = {
    volume: opts.volume ?? 100, // 0..100, master
    diff: 1,
    ground: 1,
    sky: 1,
    row: 0,
  };
  setMasterVolume(state.volume / 100);

  const root = document.createElement('div');
  root.style.cssText = `
    position: fixed; inset: 0; z-index: 30;
    display: flex; flex-direction: column; align-items: center;
    justify-content: center; gap: 26px;
    background: rgba(4, 6, 14, 0.55);
    font-family: ${font}; user-select: none;
  `;
  document.body.appendChild(root);

  const title = document.createElement('div');
  title.textContent = 'A SPIDER LOST IN SPACE';
  title.style.cssText = `
    font: 800 64px ${font}; color: ${C.text}; letter-spacing: 6px;
    text-shadow: 0 0 24px ${C.glow}; margin-bottom: 10px;
  `;
  root.appendChild(title);

  // 4 rows: Play, Volume, Ground, Skybox
  const rows = [
    { key: 'play', label: 'PLAY' },
    { key: 'diff', label: 'Difficulty' },
    { key: 'volume', label: 'Volume' },
    { key: 'ground', label: 'World texture' },
    { key: 'sky', label: 'Skybox' },
  ];
  const rowEls = rows.map((r) => {
    const el = document.createElement('div');
    el.style.cssText = `
      display: flex; align-items: center; justify-content: space-between;
      width: 420px; padding: 12px 22px; border-radius: 10px;
      font: 600 24px ${font}; color: ${C.text};
      border: 1px solid transparent;
    `;
    const lab = document.createElement('span');
    lab.textContent = r.label;
    const val = document.createElement('span');
    val.style.cssText = `color: ${C.accent}; font-weight: 700;`;
    el.appendChild(lab); el.appendChild(val);
    root.appendChild(el);
    return { el, val, key: r.key };
  });

  const hint = document.createElement('div');
  hint.textContent = '↑ ↓  select      ← →  change      Enter  confirm';
  hint.style.cssText = `
    margin-top: 18px; font: 500 15px ${font};
    color: ${C.text}; opacity: 0.7; letter-spacing: 1px;
  `;
  root.appendChild(hint);

  function render() {
    rowEls.forEach((re, i) => {
      const active = i === state.row;
      re.el.style.background = active ? 'rgba(127,212,255,0.12)' : 'transparent';
      re.el.style.borderColor = active ? 'rgba(127,212,255,0.5)' : 'transparent';
      if (re.key === 'play') re.val.textContent = active ? '▶' : '';
      if (re.key === 'diff') re.val.textContent = DIFFS[state.diff].label;
      if (re.key === 'volume') re.val.textContent = `${state.volume}`;
      if (re.key === 'ground') re.val.textContent = `${state.ground} / ${opts.groundCount}`;
      if (re.key === 'sky') re.val.textContent = `${state.sky} / ${opts.skyCount}`;
    });
  }
  render();

  function cycle(v, delta, count) {
    return ((v - 1 + delta) % count + count) % count + 1; // wrap 1..count
  }

  function onKey(e) {
    let handled = true;
    switch (e.code) {
      case 'ArrowUp':
        state.row = (state.row + rows.length - 1) % rows.length; break;
      case 'ArrowDown':
        state.row = (state.row + 1) % rows.length; break;
      case 'ArrowLeft':
      case 'ArrowRight': {
        const dir = e.code === 'ArrowRight' ? 1 : -1;
        const key = rows[state.row].key;
        if (key === 'volume') {
          state.volume = Math.max(0, Math.min(100, state.volume + dir * 5));
          setMasterVolume(state.volume / 100);
        } else if (key === 'diff') {
          state.diff = (state.diff + dir + DIFFS.length) % DIFFS.length; // wrap Easy↔Hard
          opts.onDifficulty(DIFFS[state.diff].key);
        } else if (key === 'ground') {
          state.ground = cycle(state.ground, dir, opts.groundCount);
          opts.onGround(state.ground);
        } else if (key === 'sky') {
          state.sky = cycle(state.sky, dir, opts.skyCount);
          opts.onSky(state.sky);
        } else handled = false;
        break;
      }
      case 'Enter':
      case 'Space':
        if (rows[state.row].key === 'play') {
          playMenuConfirm();
          close();
          opts.onPlay();
          return;
        }
        break;
      default:
        handled = false;
    }
    if (handled) { playMenuBlip(); render(); e.preventDefault(); }
  }

  function close() {
    removeEventListener('keydown', onKey);
    root.remove();
  }

  addEventListener('keydown', onKey);
}