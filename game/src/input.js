// Keyboard and mouse input. Held keys are read every frame; one-shot
// presses (E, R, N, H, M, C, P, 1, 2, Space) are queued and taken once
// by the loop, so a press between two frames is never lost or double
// counted. The mouse orbits the camera while the pointer is captured.

export function createInput(canvas) {
  const keys = new Set();
  const pressed = new Set();
  let mouseDX = 0;
  let mouseDY = 0;
  let mouseDown = false;
  let locked = false;

  window.addEventListener('keydown', (e) => {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    keys.add(e.code);
    if (!e.repeat) pressed.add(e.code);
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', () => { keys.clear(); mouseDown = false; });

  canvas.addEventListener('click', () => {
    if (!locked && canvas.requestPointerLock) {
      try { canvas.requestPointerLock(); } catch { /* pointer lock is a nicety */ }
    }
  });
  document.addEventListener('pointerlockchange', () => {
    locked = document.pointerLockElement === canvas;
  });
  document.addEventListener('mousemove', (e) => {
    if (locked) { mouseDX += e.movementX || 0; mouseDY += e.movementY || 0; }
  });
  canvas.addEventListener('mousedown', (e) => { if (e.button === 0) mouseDown = true; });
  window.addEventListener('mouseup', (e) => { if (e.button === 0) mouseDown = false; });

  return {
    keys,
    get locked() { return locked; },
    down(code) { return keys.has(code); },
    // True once for the frame after the key went down.
    wasPressed(code) { return pressed.has(code); },
    // True while the left mouse button is held this frame.
    get mouseHeld() { return mouseDown; },
    takeMouse() {
      const d = { dx: mouseDX, dy: mouseDY };
      mouseDX = 0; mouseDY = 0;
      return d;
    },
    // Call at the end of every frame.
    endFrame() { pressed.clear(); },
  };
}

// Movement helpers shared by the player and the camera code.
export function moveKeys(input) {
  return {
    forward: input.down('KeyW') || input.down('ArrowUp'),
    back: input.down('KeyS') || input.down('ArrowDown'),
    left: input.down('KeyA') || input.down('ArrowLeft'),
    right: input.down('KeyD') || input.down('ArrowRight'),
    run: input.down('ShiftLeft') || input.down('ShiftRight'),
  };
}
