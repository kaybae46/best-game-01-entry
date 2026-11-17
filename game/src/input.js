// Keyboard and pointer input. The moth steers toward the pointer when the pointer moves,
// or with WASD / arrow keys; Space or a click dashes. One-shot presses (start, restart,
// pause, mute) are queued as bit flags and taken once by the loop, so a press between two
// frames is never lost and never counted twice.
import { FIELD } from './config.js';

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_DASH = 4;
export const ACTION_MUTE = 8;

const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const DASH = new Set(['Space', 'ShiftLeft', 'ShiftRight']);
const MUTE = new Set(['KeyM']);

export function createInput(canvas) {
  let keys = { left: false, right: false, up: false, down: false };
  let actions = 0;
  // Pointer position in field coordinates, and whether it has moved since the last frame:
  // a fresh mouse position steers the moth; a stale one leaves keyboard steering in charge.
  let pointer = { x: FIELD.width / 2, y: FIELD.height / 2, fresh: false };

  function toField(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const scale = Math.min(rect.width / FIELD.width, rect.height / FIELD.height);
    const ox = (rect.width - FIELD.width * scale) / 2;
    const oy = (rect.height - FIELD.height * scale) / 2;
    return {
      x: (clientX - rect.left - ox) / scale,
      y: (clientY - rect.top - oy) / scale,
    };
  }

  window.addEventListener('keydown', (event) => {
    if (LEFT.has(event.code)) keys.left = true;
    else if (RIGHT.has(event.code)) keys.right = true;
    else if (UP.has(event.code)) keys.up = true;
    else if (DOWN.has(event.code)) keys.down = true;
    else {
      // Action keys are separate ifs, not else-ifs: Space is both confirm and dash.
      let handled = false;
      if (CONFIRM.has(event.code) && !event.repeat) {
        actions |= ACTION_CONFIRM;
        handled = true;
      }
      if (DASH.has(event.code) && !event.repeat) {
        actions |= ACTION_DASH;
        handled = true;
      }
      if (PAUSE.has(event.code) && !event.repeat) {
        actions |= ACTION_PAUSE;
        handled = true;
      }
      if (MUTE.has(event.code) && !event.repeat) {
        actions |= ACTION_MUTE;
        handled = true;
      }
      if (!handled) return;
    }
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    if (LEFT.has(event.code)) keys.left = false;
    else if (RIGHT.has(event.code)) keys.right = false;
    else if (UP.has(event.code)) keys.up = false;
    else if (DOWN.has(event.code)) keys.down = false;
  });
  // A key released while the tab is hidden never sends keyup: let go of everything on blur.
  window.addEventListener('blur', () => {
    keys = { left: false, right: false, up: false, down: false };
    pointer.fresh = false;
  });
  canvas.addEventListener('pointermove', (event) => {
    const at = toField(event.clientX, event.clientY);
    pointer.x = at.x;
    pointer.y = at.y;
    pointer.fresh = true;
  });
  canvas.addEventListener('pointerdown', (event) => {
    const at = toField(event.clientX, event.clientY);
    pointer.x = at.x;
    pointer.y = at.y;
    pointer.fresh = true;
    actions |= ACTION_CONFIRM | ACTION_DASH;
  });

  return {
    /**
     * A steering vector for the moth: toward the pointer when it recently moved, else the
     * held keys, else still. Each component is in -1..1, scaled by how far the pointer is.
     */
    steer(mothX, mothY) {
      const kx = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
      const ky = (keys.down ? 1 : 0) - (keys.up ? 1 : 0);
      if (kx !== 0 || ky !== 0) {
        const length = Math.hypot(kx, ky);
        return { x: kx / length, y: ky / length };
      }
      if (!pointer.fresh) return { x: 0, y: 0 };
      const dx = pointer.x - mothX;
      const dy = pointer.y - mothY;
      const distance = Math.hypot(dx, dy);
      if (distance < 6) return { x: 0, y: 0 };
      const pull = Math.min(1, distance / 140);
      return { x: (dx / distance) * pull, y: (dy / distance) * pull };
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
