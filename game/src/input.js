// Keyboard and mouse: driving and on-foot controls, plus one-shot actions
// (enter car, pause) that the game loop consumes once per press.

const KEYMAP = {
  forward: ['KeyW', 'ArrowUp'],
  back: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  sprint: ['ShiftLeft', 'ShiftRight'],
  handbrake: ['Space'],
  action: ['KeyE', 'KeyF'],
  horn: ['KeyH'],
  pause: ['Escape', 'KeyP'],
};

export class Input {
  constructor() {
    this.down = new Set();
    this.pressed = new Set();
    this.mouse = { x: 0, y: 0, down: false };
    globalThis.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.down.add(e.code);
      this.pressed.add(e.code);
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    });
    globalThis.addEventListener('keyup', (e) => this.down.delete(e.code));
    globalThis.addEventListener('blur', () => this.down.clear());
    globalThis.addEventListener('mousemove', (e) => { this.mouse.x = e.clientX; this.mouse.y = e.clientY; });
    globalThis.addEventListener('mousedown', () => { this.mouse.down = true; });
    globalThis.addEventListener('mouseup', () => { this.mouse.down = false; });
  }

  held(action) { return KEYMAP[action].some((k) => this.down.has(k)); }
  once(action) { return KEYMAP[action].some((k) => this.pressed.has(k)); }

  // Called at the end of every frame.
  endFrame() { this.pressed.clear(); }
}
