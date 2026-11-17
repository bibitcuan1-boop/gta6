// Keyboard + mouse input: one place owns every key, so the rest of the game
// only asks questions like "is W held?" or "was E just pressed?".
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_ENTER_CAR = 4;
export const ACTION_JUMP = 8;
export const ACTION_PUNCH = 16;
export const ACTION_RELOAD = 32;
export const ACTION_CAMERA = 64;
export const ACTION_MUTE = 128;

export function createInput(canvas) {
  const keys = new Set();
  const pressed = new Set();
  let mouseDX = 0;
  let mouseDY = 0;
  let mouseDown = false;
  let mouseClicked = false;
  let locked = false;

  function codeOf(e) { return e.code; }
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') e.preventDefault();
    if (!keys.has(e.code)) pressed.add(e.code);
    keys.add(e.code);
  });
  window.addEventListener('keyup', (e) => { keys.delete(e.code); });
  window.addEventListener('blur', () => { keys.clear(); });
  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) { mouseDown = true; mouseClicked = true; }
    if (!locked && document.pointerLockElement !== canvas) {
      try { canvas.requestPointerLock(); } catch { /* pointer lock is a nicety, not a requirement */ }
    }
  });
  window.addEventListener('mouseup', (e) => { if (e.button === 0) mouseDown = false; });
  document.addEventListener('pointerlockchange', () => { locked = document.pointerLockElement === canvas; });
  document.addEventListener('mousemove', (e) => {
    if (locked) { mouseDX += e.movementX; mouseDY += e.movementY; }
  });
  window.addEventListener('contextmenu', (e) => { if (e.target === canvas) e.preventDefault(); });

  return {
    keys,
    isDown(code) { return keys.has(code); },
    wasPressed(code) { return pressed.has(code); },
    takePressed() { const out = new Set(pressed); pressed.clear(); return out; },
    moveAxis() {
      let x = 0; let z = 0;
      if (keys.has('KeyW') || keys.has('ArrowUp')) z -= 1;
      if (keys.has('KeyS') || keys.has('ArrowDown')) z += 1;
      if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
      if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
      return { x, z };
    },
    takeMouse() { const d = { dx: mouseDX, dy: mouseDY }; mouseDX = 0; mouseDY = 0; return d; },
    takeClick() { const c = mouseClicked; mouseClicked = false; return c; },
    isMouseDown() { return mouseDown; },
    takeActions() {
      const p = this.takePressed();
      let a = 0;
      if (p.has('Enter') || p.has('Space')) a |= ACTION_CONFIRM;
      if (p.has('KeyP') || p.has('Escape')) a |= ACTION_PAUSE;
      if (p.has('KeyE')) a |= ACTION_ENTER_CAR;
      if (p.has('Space')) a |= ACTION_JUMP;
      if (p.has('KeyF')) a |= ACTION_PUNCH;
      if (p.has('KeyR')) a |= ACTION_RELOAD;
      if (p.has('KeyC')) a |= ACTION_CAMERA;
      if (p.has('KeyM')) a |= ACTION_MUTE;
      return a;
    },
  };
}
