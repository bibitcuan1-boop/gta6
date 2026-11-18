// Palmera Bay — boot, the one game loop, save and load, screen wiring.
// ?seed=N fixes the city layout (default 20261118). ?shot=start|drive|
// chase|mission stages that scene, paints it twice and sets
// window.__shotReady for a screenshot.
import * as THREE from 'three';
import { CFG, MISSIONS, WEAPONS } from './config.js';
import { makeRng } from './random.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { buildCity } from './city.js';
import { createVehicles, driveCar, makeCar, nearestEnterableCar, resolveCarCollisions, updateTrafficCar } from './vehicles.js';
import { createPeople, spawnFleeingPed, spawnOfficer, updateOfficers, updatePedestrians } from './people.js';
import { clearAllPolice, createPolice, updatePolice } from './police.js';
import { createMissions, updateMissions } from './missions.js';
import { createCombat } from './combat.js';
import { createHud } from './hud.js';
import { createPlayer, snapCamera, updateCamera, updatePlayerOnFoot, updateTitleCamera } from './player.js';
import { stageShot } from './shots.js';

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : CFG.seedDefault;

const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1200);
camera.position.set(0, 60, 120);

const rng = makeRng(seed);
const input = createInput(canvas);
const audio = createAudio();

// The shared game state every system reads and writes.
const G = {
  scene, camera, renderer, rng, input, audio,
  timeHours: CFG.startTime,
  mode: 'title',
  titleT: 0,
  saveT: 0,
  muted: false,
  prevMouse: false,
  city: null,
  cars: null,
  people: null,
  police: null,
  missions: null,
  combat: null,
  hud: null,
  player: null,
  shotName,
};

G.city = buildCity(scene, rng);
G.cars = createVehicles(scene, rng);
G.people = createPeople(scene, rng);
G.people.spawnOfficer = (sc, x, z) => spawnOfficer(sc, x, z);
G.people.fleeDriver = (g, x, z) => spawnFleeingPed(scene, rng, g.people, x, z);
G.police = createPolice();
G.missions = createMissions(scene);
G.combat = createCombat(scene);
G.player = createPlayer(scene);
G.player.pos.set(-30, 0, 30);
G.hud = createHud(G);
G.hud.setStars(0);
G.hud.setObjective('Free roam — press N to start a job');

// --- screens -------------------------------------------------------------
const screens = {
  title: document.getElementById('screenTitle'),
  pause: document.getElementById('screenPause'),
  busted: document.getElementById('screenBusted'),
  wasted: document.getElementById('screenWasted'),
  done: document.getElementById('screenDone'),
};
function showScreen(name) {
  for (const key of Object.keys(screens)) {
    if (screens[key]) screens[key].style.display = key === name ? 'flex' : 'none';
  }
  if (canvas) canvas.style.display = '';
}
G.showScreen = showScreen;

// --- save / load ---------------------------------------------------------
function saveGame() {
  try {
    const p = G.player;
    const data = {
      cash: Math.floor(p.cash),
      health: Math.round(p.health),
      armor: Math.round(p.armor),
      jobIndex: G.missions.index,
      jobsDone: G.missions.doneCount,
      x: p.pos.x,
      z: p.pos.z,
      time: G.timeHours,
      weapon: p.weapon,
      mag: p.mag,
      reserve: p.reserve,
    };
    window.localStorage.setItem(CFG.saveKey, JSON.stringify(data));
  } catch { /* storage can be off: the save then lasts this visit only */ }
}
G.saveGame = saveGame;

function readSave() {
  try {
    const raw = window.localStorage.getItem(CFG.saveKey);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function loadGame() {
  const data = readSave();
  if (!data) return false;
  const p = G.player;
  p.cash = data.cash ?? 150;
  p.health = data.health ?? 100;
  p.armor = data.armor ?? 0;
  p.pos.set(data.x ?? -30, 0, data.z ?? 30);
  G.timeHours = data.time ?? CFG.startTime;
  p.weapon = WEAPONS[data.weapon] ? data.weapon : 'pistol';
  p.mag = data.mag ?? 12;
  p.reserve = data.reserve ?? 60;
  G.missions.index = data.jobIndex ?? 0;
  G.missions.doneCount = data.jobsDone ?? 0;
  G.missions.refreshObjective(G);
  snapCamera(G);
  return true;
}
G.loadGame = loadGame;

// --- busted / wasted -----------------------------------------------------
function respawnAfterTrouble(fine, screenName) {
  const p = G.player;
  if (p.inCar && p.car) G.combat.exitCar(G);
  p.cash = Math.max(0, p.cash - fine);
  p.health = 100;
  p.armor = 25;
  p.pos.set(-30, 0, 30);
  p.yaw = Math.PI;
  G.police.stars = 0;
  G.hud.setStars(0);
  clearAllPolice(G);
  if (G.missions.active) {
    G.missions.active = null;
    G.missions.hideMarker();
  }
  G.missions.refreshObjective(G);
  snapCamera(G);
  G.mode = screenName;
  showScreen(screenName);
  saveGame();
}
G.onBusted = () => {
  audio.busted();
  respawnAfterTrouble(CFG.bailCost, 'busted');
  G.hud.announce('Busted. The Bay PD hauled you in. Bail cost $300.');
};
G.onWasted = () => {
  respawnAfterTrouble(CFG.hospitalCost, 'wasted');
  G.hud.announce('Wasted. The hospital patched you up for $200.');
};

// Spawn a police interceptor at an exact spot (used by the chase shot).
G.policeSpawnCarForShot = (x, z, yaw, speed) => {
  const car = makeCar(scene, rng, true);
  car.pos.set(x, 0, z);
  car.yaw = yaw;
  car.speed = speed;
  car.group.rotation.y = yaw;
  G.cars.police.push(car);
  G.cars.all.push(car);
  return car;
};
// The boot-time factory shots.js uses for the same job.
G.makePoliceCar = G.policeSpawnCarForShot;

// --- entering / exiting cars ----------------------------------------------
function tryEnterCar() {
  const p = G.player;
  if (p.inCar) {
    G.combat.exitCar(G);
    audio.door();
    return;
  }
  const car = nearestEnterableCar(p.pos, G.cars);
  if (!car) return;
  const wasTraffic = !!car.traffic;
  if (wasTraffic) {
    // Carjacking: the driver runs away on foot, wanted +1 star.
    G.people.fleeDriver(G, car.pos.x, car.pos.z);
    G.police.addStar(G, 1);
    G.hud.banner('CARJACKED — THE COPS SAW THAT');
    G.hud.toast('You carjacked a driver! +1 star');
    audio.busted();
  } else {
    G.hud.toast(`You took the ${car.name}`);
  }
  car.parked = false;
  car.traffic = null;
  car.speed = 0;
  p.inCar = true;
  p.car = car;
  p.group.visible = false;
  audio.door();
  G.missions.onCarStolen(G);
}

// --- the world step --------------------------------------------------------
function stepWorld(dt, settling = false) {
  const p = G.player;
  G.timeHours = (G.timeHours + (dt / CFG.dayLength) * 24) % 24;
  G.city.update(dt);

  // Traffic always moves, even behind the title screen.
  for (const car of G.cars.traffic) {
    if (!car.wrecked) updateTrafficCar(car, dt, G.cars.all);
  }
  resolveCarCollisions(G.cars.all);

  const danger = {
    active: G.police.stars > 0 || p.lastShotT < 3,
    x: p.inCar && p.car ? p.car.pos.x : p.pos.x,
    z: p.inCar && p.car ? p.car.pos.z : p.pos.z,
  };
  updatePedestrians(G.people, rng, dt, danger);

  // A settle step moves only traffic and pedestrians (and the clock):
  // the staged player's car keeps its placed position and speed.
  if (settling) return;

  if (G.mode === 'playing') {
    if (p.inCar && p.car) {
      driveCar(p.car, input, dt, G.city.colliders, (speed) => {
        audio.crash();
        if (p.car.health <= 0) G.combat.wreckCar(G, p.car);
      });
      if (p.car.health <= 0) G.combat.wreckCar(G, p.car);
      audio.setEngine(Math.abs(p.car.speed) / CFG.carTopSpeed, true);
    } else {
      updatePlayerOnFoot(G, dt);
      audio.setEngine(0, false);
    }
    updateOfficers(G.people, dt, p.inCar && p.car ? p.car.pos : p.pos, () => G.onBusted());
    updatePolice(G, dt);
    updateMissions(G, dt);
    G.combat.update(G, dt);
    audio.updateSiren(dt, G.police.stars);
    audio.updatePad(dt);

    // Shooting: hold for automatic weapons, click for the rest.
    p.fireT = Math.max(0, (p.fireT || 0) - dt);
    p.lastShotT = (p.lastShotT || 0) + dt;
    if (p.reloadT > 0) {
      p.reloadT -= dt;
      if (p.reloadT <= 0) { p.reloadT = 0; G.combat.finishReload(G); }
    }
    if (!p.inCar) {
      const w = WEAPONS[p.weapon];
      const held = input.mouseHeld;
      const clicked = held && !G.prevMouse;
      if ((w.auto && held) || (!w.auto && clicked)) G.combat.tryShoot(G);
    }
    G.prevMouse = input.mouseHeld;

    // Autosave every fifteen seconds of play.
    G.saveT += dt;
    if (G.saveT >= CFG.saveEvery) { G.saveT = 0; saveGame(); }
  }
}
G.stepWorld = stepWorld;

// --- per-frame key handling ----------------------------------------------
function handleKeys() {
  const p = G.player;
  if (input.wasPressed('KeyH')) G.hud.toggle();
  if (input.wasPressed('KeyM')) {
    G.muted = !G.muted;
    audio.setMuted(G.muted);
    G.hud.toast(G.muted ? 'Sound off' : 'Sound on');
  }
  if (input.wasPressed('KeyP') || input.wasPressed('Escape')) {
    if (G.mode === 'playing') {
      G.mode = 'paused';
      showScreen('pause');
      saveGame();
      G.hud.announce('Paused.');
    } else if (G.mode === 'paused') {
      G.mode = 'playing';
      showScreen(null);
    }
  }
  if (G.mode !== 'playing') return;
  if (input.wasPressed('KeyE')) tryEnterCar();
  if (input.wasPressed('KeyN')) {
    if (!G.missions.active) {
      if (G.missions.index < MISSIONS.length) G.missions.startJob(G, G.missions.index);
      else G.hud.toast('All jobs done — free roam!');
    }
  }
  if (input.wasPressed('KeyR')) G.combat.reload(G);
  if (input.wasPressed('Digit1')) { p.weapon = 'fists'; G.hud.toast('Fists'); }
  if (input.wasPressed('Digit2')) { p.weapon = 'pistol'; G.hud.toast('P9 Pistol'); }
  if (input.wasPressed('Digit3')) {
    if (p.hasSmg) { p.weapon = 'smg'; G.hud.toast('VK-9 SMG'); }
    else G.hud.toast('No SMG yet — find the pink pickup');
  }
  if (input.wasPressed('KeyC')) {
    p.camClose = !p.camClose;
    G.hud.toast(p.camClose ? 'Close camera' : 'Chase camera');
  }
}

// --- buttons ---------------------------------------------------------------
function wireButton(id, fn) {
  const b = document.getElementById(id);
  if (b) b.addEventListener('click', () => { audio.unlock(); audio.click(); fn(); });
}
wireButton('btnPlay', () => {
  audio.unlock();
  G.mode = 'playing';
  showScreen(null);
  G.hud.announce('Playing. Press N to start a job.');
  G.hud.banner('PALMERA BAY');
});
wireButton('btnContinue', () => {
  audio.unlock();
  if (loadGame()) {
    G.mode = 'playing';
    showScreen(null);
    G.hud.toast('Saved game loaded');
  } else {
    G.hud.toast('No saved game found');
  }
});
wireButton('btnResume', () => {
  G.mode = 'playing';
  showScreen(null);
});
wireButton('btnQuit', () => {
  saveGame();
  G.mode = 'title';
  showScreen('title');
  refreshSaveInfo();
});
wireButton('btnBusted', () => {
  G.mode = 'playing';
  showScreen(null);
  G.hud.banner('BACK ON THE STREETS');
});
wireButton('btnWasted', () => {
  G.mode = 'playing';
  showScreen(null);
  G.hud.banner('BACK ON YOUR FEET');
});
wireButton('btnFreeRoam', () => {
  G.mode = 'playing';
  showScreen(null);
  G.hud.banner('FREE ROAM — PALMERA BAY IS YOURS');
});

function refreshSaveInfo() {
  const info = document.getElementById('saveInfo');
  const btn = document.getElementById('btnContinue');
  const data = readSave();
  if (info) {
    info.textContent = data
      ? `Saved game found — $${data.cash ?? 0}, ${data.jobsDone ?? 0}/4 jobs done`
      : 'No saved game found yet.';
  }
  if (btn) btn.style.display = data ? '' : 'none';
}
refreshSaveInfo();

// --- the frame loop ----------------------------------------------------------
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  handleKeys();
  if (G.mode === 'title') {
    G.titleT += dt;
    updateTitleCamera(G, dt, G.titleT);
    stepWorld(dt);
  } else if (G.mode === 'playing') {
    stepWorld(dt);
    updateCamera(G, dt);
  }
  if (G.mode === 'playing' || G.mode === 'title') G.hud.update(G, dt);
  renderer.render(scene, camera);
  input.endFrame();
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// --- staged shots ------------------------------------------------------------
if (shotName) {
  stageShot(G, shotName);
  G.hud.update(G, 0);
  let painted = 0;
  function paint() {
    renderer.render(scene, camera);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
} else {
  showScreen('title');
  G.hud.announce('Palmera Bay. Press START ENGINE to play.');
  requestAnimationFrame(frame);
}
