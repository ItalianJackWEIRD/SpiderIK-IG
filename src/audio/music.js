/**
 * Background music, page-scoped on purpose: starts once per page load and
 * only restarts on reload (the game-over Restart does location.reload()).
 *
 * Browser autoplay policy: play() before a user gesture is rejected, so we
 * try immediately and fall back to the first keydown / pointerdown. When
 * the start menu (Phase 7) lands, call initMusic() from its Play click
 * instead and the gesture fallback becomes redundant.
 *
 * Fires 'music:started' on window the moment playback really begins —
 * useful to phase-lock the spider breathing to the track later on.
 */
const TRACK = 'audio/Call It What You Like.mp3';

let audio = null;
let started = false;

export function initMusic({ volume = 0.4, loop = true } = {}) {
  if (audio) return;
  audio = new Audio(TRACK);
  audio.loop = loop;
  audio.volume = volume;

  const tryPlay = () => {
    if (started) return;
    audio.play().then(() => {
      if (started) return;
      started = true;
      removeEventListener('keydown', tryPlay);
      removeEventListener('pointerdown', tryPlay);
      dispatchEvent(new CustomEvent('music:started'));
    }).catch(() => { /* no gesture yet: keep waiting */ });
  };

  addEventListener('keydown', tryPlay);
  addEventListener('pointerdown', tryPlay);
  tryPlay(); // some browsers allow it right away (e.g. after a reload)
}
