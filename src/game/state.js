// Stato condiviso player → HUD. Scritto da main.js, letto da ui/hud.js
export const playerState = {
  stamina: 1,      // 0..1
  sprinting: false,
  exhausted: false, // stamina a zero: sprint bloccato finché non risale
};