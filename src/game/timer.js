/**
 * Countdown game timer. No three.js dependency on purpose.
 * Collecting orbs adds time (see game.js); reaching zero fires the
 * death callback exactly once.
 */
export class GameTimer {
  constructor() {
    this._remaining = 0;
    this.running = false;
    this.dead = false;
    this._onDeath = null;
  }

  start(seconds = 30) {
    this._remaining = seconds;
    this.running = true;
    this.dead = false;
  }

  /** register the callback fired once when the timer reaches 0 */
  onDeath(callback) {
    this._onDeath = callback;
  }

  addTime(seconds) {
    if (!this.dead) this._remaining += seconds;
  }

  get remaining() {
    return Math.max(0, this._remaining);
  }

  update(dt) {
    if (!this.running || this.dead) return;
    this._remaining -= dt;
    if (this._remaining <= 0) {
      this._remaining = 0;
      this.dead = true;
      this.running = false;
      if (this._onDeath) this._onDeath(); // fired exactly once
    }
  }
}
