export class Keyboard {
  constructor() {
    this.keys = new Set();
    addEventListener('keydown', (e) => this.keys.add(e.code));
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());
  }
  isDown(code) { return this.keys.has(code); }
  /** returns -1, 0 or +1 */
  axis(negCode, posCode) {
    return (this.isDown(posCode) ? 1 : 0) - (this.isDown(negCode) ? 1 : 0);
  }
}