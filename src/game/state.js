// Shared player → HUD state. Written by main.js, read by ui/hud.js
export const playerState = {
  stamina: 1,      // 0..1
  sprinting: false,
  exhausted: false, // stamina at zero: sprint locked until it recovers
  refillStamina : false,
};