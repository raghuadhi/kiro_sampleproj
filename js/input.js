// Keyboard input -> normalized driving controls.
// WASD / arrow keys to drive, Space to brake, R to reset, Esc/P to pause.

export class Input {
  constructor() {
    this.keys = new Set();
    this._onReset = null;
    this._onPause = null;

    window.addEventListener('keydown', (e) => {
      const k = e.key.toLowerCase();
      if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) {
        e.preventDefault();
      }
      if (!this.keys.has(k)) {
        if (k === 'r' && this._onReset) this._onReset();
        if ((k === 'escape' || k === 'p') && this._onPause) this._onPause();
      }
      this.keys.add(k);
    });

    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.key.toLowerCase());
    });

    window.addEventListener('blur', () => this.keys.clear());
  }

  onReset(cb) { this._onReset = cb; }
  onPause(cb) { this._onPause = cb; }

  getControls() {
    const k = this.keys;
    const up = k.has('arrowup') || k.has('w');
    const down = k.has('arrowdown') || k.has('s');
    const left = k.has('arrowleft') || k.has('a');
    const right = k.has('arrowright') || k.has('d');
    const brake = k.has(' ');

    let throttle = 0;
    if (up) throttle += 1;
    if (down) throttle -= 1;

    let steer = 0;
    if (left) steer += 1;
    if (right) steer -= 1;

    return { throttle, steer, brake: brake ? 1 : 0 };
  }
}
