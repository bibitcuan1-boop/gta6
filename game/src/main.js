// Palmera Bay — boot, the one game loop, save/load and every system wired together.
// ?seed=N fixes the city. ?shot=start|drive|chase|mission stages a screenshot scene
// instead of running the loop, paints it twice and sets window.__shotReady.
import * as THREE from 'three';
import { SAVE_KEY, PICKUPS, WEAPONS, PLAYER } from './config.js';
import { createRandom } from './random.js';
import { createAudio } from './audio.js';
import { buildCity } from './city.js';
import { spawnTraffic, updateTraffic, driveCar, nearestCar } from './vehicles.js';
import { spawnPedestrians, updatePedestrians, updateCops } from './people.js';
import { createWanted, addWanted, updateWanted, clearPolice } from './police.js';
import { createMissionState, objectiveText, startMission, updateMission, missionTarget, currentMission } from './missions.js';
import { createCombat, switchWeapon, reload, fireShot, punch, updateTracer, damagePlayer, spawnPickups, updatePickups } from './combat.js';
import { createHud } from './hud.js';
import { createInput } from './input.js';
import { createPlayer, updatePlayerOnFoot, updateCamera } from './player.js';
import { stageShot } from './shots.js';

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : 20261118;
const rng = createRandom(seed);

const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = false;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1200);
camera.position.set(-40, 26, 120);

const audio = createAudio();
const hud = createHud();
const input = createInput(canvas);
const city = buildCity(scene, rng);
const player = createPlayer(scene);
const cars = spawnTraffic(scene, rng, city.carSpawns, 14);
const peds = spawnPedestrians(scene, rng, city.pedSpawns, 26);
const wanted = createWanted();
const mission = createMissionState();
const combat = createCombat();
const pickups = spawnPickups(scene, PICKUPS);

const game = {
  scene, camera, renderer, hud, player, cars, peds, wanted, mission, combat,
  screen: 'title', dayTime: 9.5, objectiveText: 'Press N to start Job 1: Borrowed Wheels.',
  missionTarget: null, missionHeatStarted: false, muted: false, hudHidden: false,
  stepWorld,
};
let lastTime = performance.now();
let saveTimer = 0;
let arrestAccum = 0;

function readSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
function writeSave() {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify({
      cash: player.cash, health: player.health, armor: player.armor,
      missionIndex: mission.index, completedCount: mission.completedCount,
      x: player.x, z: player.z, dayTime: game.dayTime,
      weapon: combat.weapon, ammo: combat.ammo,
    }));
  } catch { /* storage off: the session still plays */ }
}
function applySave(s) {
  if (!s) return;
  player.cash = s.cash ?? 150;
  player.health = s.health ?? 100;
  player.armor = s.armor ?? 0;
  mission.index = typeof s.missionIndex === 'number' ? s.missionIndex : 0;
  mission.completedCount = s.completedCount ?? 0;
  player.x = s.x ?? -30; player.z = s.z ?? 30;
  player.mesh.position.set(player.x, 0, player.z);
  game.dayTime = s.dayTime ?? 9.5;
  if (s.weapon && WEAPONS[s.weapon]) switchWeapon(combat, s.weapon);
  if (typeof s.ammo === 'number') combat.ammo = s.ammo;
}

const saved = readSave();
if (saved) {
  hud.els.saveInfo.textContent = `Saved game found: $${Math.floor(saved.cash || 0)}, ${saved.completedCount || 0}/4 jobs done.`;
} else {
  hud.els.saveInfo.textContent = 'No saved game yet — your progress saves automatically.';
}
document.getElementById('btnContinue').addEventListener('click', () => {
  audio.unlock(); audio.startPad();
  applySave(saved);
  startPlaying();
});
document.getElementById('btnPlay').addEventListener('click', () => {
  audio.unlock(); audio.startPad();
  try { window.localStorage.removeItem(SAVE_KEY); } catch {}
  startPlaying();
});
document.getElementById('btnResume').addEventListener('click', () => { game.screen = 'play'; hud.setScreen('none'); });
document.getElementById('btnQuit').addEventListener('click', () => { writeSave(); game.screen = 'title'; hud.setScreen('title'); });
document.getElementById('btnBusted').addEventListener('click', () => respawnAfter('busted'));
document.getElementById('btnWasted').addEventListener('click', () => respawnAfter('wasted'));
document.getElementById('btnFreeRoam').addEventListener('click', () => { game.screen = 'play'; hud.setScreen('none'); });

function startPlaying() {
  game.screen = 'play';
  hud.setScreen('none');
  hud.banner('WELCOME TO PALMERA BAY');
  hud.say('Mia Torres', 'Mia: "Jax! You\'re out. Meet me — press N to start Job 1, Borrowed Wheels."');
  hud.announce('Playing Palmera Bay. Press N to start the first job.');
}
function respawnAfter(kind) {
  clearPolice(scene, wanted);
  wanted.stars = 0;
  wanted.heat = 0;
  player.health = PLAYER.maxHealth;
  player.armor = 25;
  player.x = -30; player.z = 30; player.y = 0;
  if (player.car) { player.car = null; player.mesh.visible = true; }
  player.mesh.position.set(player.x, 0, player.z);
  mission.active = false;
  if (mission.marker) mission.marker.visible = false;
  game.screen = 'play';
  hud.setScreen('none');
  hud.banner(kind === 'busted' ? 'BACK ON THE STREETS' : 'PATCHED UP');
  writeSave();
}
function endScreen(kind, fine) {
  audio.busted();
  player.cash = Math.max(0, player.cash - fine);
  clearPolice(scene, wanted);
  wanted.stars = 0;
  game.screen = kind;
  hud.setScreen(kind);
  writeSave();
}

function enterCar() {
  const car = nearestCar(cars, player.x, player.z, 4.5, true);
  if (!car) return;
  if (car.isTraffic) {
    addWanted(wanted, 1, 'carjack');
    hud.toast('Carjacked! The driver ran — the cops noticed. ★');
    hud.banner('CARJACKED — WANTED ★');
  } else {
    hud.toast(`You took the ${car.name}.`);
  }
  audio.door();
  player.car = car;
  car.isTraffic = false;
  player.mesh.visible = false;
  player.x = car.x; player.z = car.z;
  if (mission.active && mission.index === 0 && mission.stage === 0) {
    // Stealing the car is the objective of Job 1's first stage.
  }
}
function exitCar() {
  if (!player.car) return;
  const car = player.car;
  player.car = null;
  player.x = car.x + Math.cos(car.angle) * 3;
  player.z = car.z - Math.sin(car.angle) * 3;
  player.mesh.visible = true;
  player.mesh.position.set(player.x, 0, player.z);
  player.angle = car.angle;
  audio.door();
}

function shootTargets() {
  const origin = camera.position.clone();
  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  const targets = [...peds, ...wanted.cops, ...wanted.policeCars];
  const result = fireShot(scene, combat, origin, dir, targets, performance.now() / 1000, (hit, point) => {
    if (hit.dead) return;
    if (hit.health <= 0) {
      hit.dead = true;
      hit.mesh.visible = false;
      if (hit.isCop) {
        mission.takedowns += 1;
        addWanted(wanted, 1, 'cop down');
        hud.toast('Officer down! The heat just went up.');
      } else if (hit.isPolice) {
        addWanted(wanted, 1, 'police car destroyed');
        hud.toast('Police interceptor destroyed!');
        const idx = wanted.policeCars.indexOf(hit);
        if (idx >= 0) wanted.policeCars.splice(idx, 1);
      } else {
        addWanted(wanted, 1, 'pedestrian harmed');
        hud.toast('A bystander went down — witnesses called it in.');
      }
    }
  });
  if (result === 'hit' || result === 'miss') audio.shoot();
  else if (result === 'empty') hud.toast('Out of ammo — press R to reload.');
}

function stepWorld(dt, silent) {
  game.dayTime = (game.dayTime + dt / 240) % 24;
  updateTraffic(cars, dt, city.colliders);
  const danger = wanted.stars > 0 || combat.lastShot > performance.now() / 1000 - 1
    ? { x: player.x, z: player.z } : null;
  updatePedestrians(peds, dt, city.colliders, danger, rng);
  // Officers on foot chase the player; close contact builds an arrest.
  arrestAccum = 0;
  updateCops(wanted.cops, dt, player, city.colliders, (cop, d) => {
    arrestAccum += d;
    if (!silent) hud.toast('The cops are grabbing you — move!');
  });
  if (arrestAccum > 0 && game.screen === 'play') {
    wanted.arrestTimer += arrestAccum;
    if (wanted.arrestTimer > 2.2) { endScreen('busted', 300); return; }
  } else {
    wanted.arrestTimer = 0;
  }
  updateWanted(wanted, dt, scene, player, rng, {
    onRam: (d) => {
      if (silent) return;
      if (player.car) { player.car.health -= 30 * d; }
      else if (damagePlayer(player, 12 * d, audio)) endScreen('wasted', 200);
      audio.crash();
    },
    onEscaped: () => {
      if (silent) return;
      hud.banner('YOU LOST THE COPS');
      hud.toast('Clean getaway. The heat is off — for now.');
      audio.missionDone();
    },
  });
  if (mission.active) {
    updateMission(mission, dt, game, hud, {
      setWanted: (n) => { wanted.stars = n; wanted.heat = n * 20; },
    });
    if (!mission.active && currentMission(mission) === null && mission.done) {
      // Story finished inside updateMission's complete path.
    }
    if (mission.justCompleted) {
      mission.justCompleted = false;
    }
  }
  // Mission completion pays out here, where the cash lives.
  if (mission.paidReward) {
    player.cash += mission.paidReward;
    mission.paidReward = 0;
    audio.missionDone();
    writeSave();
  }
  updateTracer(scene, combat, dt);
  updatePickups(pickups, dt, player, combat, (p, pl, cb) => {
    if (p.kind === 'health') { pl.health = Math.min(100, pl.health + 50); hud.toast('+50 health'); }
    if (p.kind === 'armor') { pl.armor = Math.min(100, pl.armor + 50); hud.toast('+50 armor'); }
    if (p.kind === 'cash') { pl.cash += 150; hud.toast('+$150 found cash'); audio.cash(); }
    if (p.kind === 'smg') { switchWeapon(cb, 'smg'); hud.toast('Picked up the VK-9 SMG!'); }
    if (p.kind === 'ammo') { cb.reserve += 48; hud.toast('+48 ammo'); }
    audio.pickup();
  });
  // Clouds drift slowly across the sky.
  for (const child of city.group.children) {
    if (child.userData && child.userData.drift) {
      child.position.x += child.userData.drift * dt;
      if (child.position.x > 300) child.position.x = -300;
    }
  }
  // Player car wrecked?
  if (player.car && player.car.health <= 0) {
    hud.banner('YOUR CAR IS WRECKED');
    audio.crash();
    exitCar();
    player.car = null;
  }
  audio.siren(dt, wanted.stars);
  if (player.car) audio.engine(Math.abs(player.car.speed) / 34, true);
  else audio.engine(0, false);
}

// Reward payout hook: missions.completeMission sets mission.paidReward and the
// cash lands in stepWorld, so main stays the only file that touches player.cash.

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;
  if (game.screen !== 'play') {
    // Title screen: slow cinematic orbit over the city.
    if (game.screen === 'title') {
      const t = now / 1000;
      camera.position.set(Math.sin(t * 0.05) * 150, 55, Math.cos(t * 0.05) * 150);
      camera.lookAt(0, 10, 0);
      updateTraffic(cars, dt, city.colliders);
      updatePedestrians(peds, dt, city.colliders, null, rng);
    }
    renderer.render(scene, camera);
    return;
  }
  // --- live play ---
  // Read the pressed set exactly once: takeActions() clears it, so every
  // key check in this frame must come from this one snapshot.
  const pressed = input.takePressed();
  const jumpPressed = pressed.has('Space');
  const mutedToggle = pressed.has('KeyM');
  const pausePressed = pressed.has('KeyP') || pressed.has('Escape');
  const cameraPressed = pressed.has('KeyC');
  const reloadPressed = pressed.has('KeyR');
  const enterPressed = pressed.has('KeyE');
  const punchPressed = pressed.has('KeyF');
  if (mutedToggle) { game.muted = !game.muted; audio.setMuted(game.muted); hud.toast(game.muted ? 'Sound muted' : 'Sound on'); }
  if (pausePressed) { game.screen = 'pause'; hud.setScreen('pause'); writeSave(); return; }
  if (cameraPressed) { player.camMode = (player.camMode + 1) % 2; }
  if (pressed.has('KeyH')) {
    game.hudHidden = !game.hudHidden;
    for (const el of document.querySelectorAll('.hud')) el.style.visibility = game.hudHidden ? 'hidden' : '';
  }
  if (pressed.has('KeyN') && !mission.active) {
    const m = currentMission(mission);
    if (m) {
      game.missionHeatStarted = false;
      startMission(mission, scene, hud);
      audio.missionStart();
    }
  }
  if (pressed.has('Digit1')) switchWeapon(combat, 'fists');
  if (pressed.has('Digit2')) switchWeapon(combat, 'pistol');
  if (reloadPressed) { if (reload(combat)) hud.toast('Reloaded.'); }
  if (enterPressed) { if (player.car) exitCar(); else enterCar(); }

  if (player.car) {
    driveCar(player.car, input, dt, city.colliders, cars);
    player.x = player.car.x; player.z = player.car.z;
    player.mesh.position.set(player.x, 0, player.z);
    if (input.takeClick()) shootTargets();
  } else {
    updatePlayerOnFoot(player, input, dt, city.colliders, jumpPressed);
    if (input.isMouseDown() || input.takeClick()) shootTargets();
    if (punchPressed) {
      const hit = punch(combat, player, [...peds, ...wanted.cops], performance.now() / 1000, (t) => {
        audio.punch();
        if (t.health <= 0 && !t.dead) {
          t.dead = true; t.mesh.visible = false;
          if (t.isCop) { mission.takedowns += 1; addWanted(wanted, 1, 'cop down'); }
        }
      });
      if (hit) audio.punch();
    }
  }
  stepWorld(dt, false);
  // Mission reward: detect a stage-to-complete transition by watching completedCount.
  game.objectiveText = objectiveText(mission);
  game.missionTarget = missionTarget(mission);
  if (mission.done && game.screen === 'play' && !game.doneShown) {
    game.doneShown = true;
    game.screen = 'done';
    hud.setScreen('done');
  }
  updateCamera(camera, player, dt);
  hud.render(game, dt);
  renderer.render(scene, camera);
  saveTimer += dt;
  if (saveTimer > 15) { saveTimer = 0; writeSave(); }
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// --- boot ---
hud.setScreen('title');
hud.render(game, 0);
if (shotName) {
  // Staged screenshot: build the scene, paint it twice, signal readiness.
  const staged = stageShot(shotName, game);
  void staged;
  // Snap the chase camera into place: the camera lerps toward its target, so
  // run it to convergence before the first paint, or the shot is a wide view
  // from the spawn point instead of the staged scene.
  for (let i = 0; i < 80; i += 1) updateCamera(camera, player, 0.016);
  renderer.render(scene, camera);
  hud.render(game, 0);
  requestAnimationFrame(() => {
    updateCamera(camera, player, 0.016);
    renderer.render(scene, camera);
    hud.render(game, 0);
    window.__shotReady = true;
  });
} else {
  requestAnimationFrame(frame);
}
