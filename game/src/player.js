// The player on foot: a stylised figure in a pink jacket, camera-
// relative movement, jumping, limb swing, and the chase cameras for
// both on-foot and driving, plus the title screen's slow orbit.
import * as THREE from 'three';
import { CFG } from './config.js';
import { moveWithCollision } from './city.js';
import { moveKeys } from './input.js';
import { forwardOf } from './vehicles.js';

export function createPlayer(scene) {
  const group = new THREE.Group();
  const jacket = new THREE.MeshLambertMaterial({ color: 0xe86ec2 });
  const dark = new THREE.MeshLambertMaterial({ color: 0x23272e });
  const skin = new THREE.MeshLambertMaterial({ color: 0xf2c89b });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.65, 0.34), jacket);
  torso.position.y = 1.15;
  group.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 12), skin);
  head.position.y = 1.66;
  group.add(head);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.23, 12, 12, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshLambertMaterial({ color: 0x14100e }));
  hair.position.y = 1.7;
  group.add(hair);
  const armGeo = new THREE.BoxGeometry(0.14, 0.58, 0.14);
  const armL = new THREE.Mesh(armGeo, jacket);
  armL.position.set(-0.39, 1.15, 0);
  group.add(armL);
  const armR = new THREE.Mesh(armGeo, jacket);
  armR.position.set(0.39, 1.15, 0);
  group.add(armR);
  const legGeo = new THREE.BoxGeometry(0.18, 0.58, 0.18);
  const legL = new THREE.Mesh(legGeo, dark);
  legL.position.set(-0.15, 0.58, 0);
  group.add(legL);
  const legR = new THREE.Mesh(legGeo, dark);
  legR.position.set(0.15, 0.58, 0);
  group.add(legR);
  scene.add(group);

  return {
    group, armL, armR, legL, legR,
    pos: group.position,
    yaw: Math.PI, // facing south at the start point
    pitch: 0.12,
    vy: 0,
    onGround: true,
    health: 100,
    armor: 0,
    cash: 150,
    weapon: 'pistol',
    mag: 12,
    reserve: 60,
    hasSmg: false,
    inCar: false,
    car: null,
    swing: 0,
    camDist: 8.5,
    camClose: false,
    lastShotT: 99,
  };
}

export function updatePlayerOnFoot(G, dt) {
  const p = G.player;
  const input = G.input;
  const mouse = input.takeMouse();
  p.yaw -= mouse.dx * 0.0032;
  p.pitch = Math.max(-0.35, Math.min(0.55, p.pitch + mouse.dy * 0.0022));

  const keys = moveKeys(input);
  const speed = keys.run ? CFG.runSpeed : CFG.walkSpeed;
  // Movement is relative to the camera: W walks away from it.
  const sin = Math.sin(p.yaw);
  const cos = Math.cos(p.yaw);
  let mx = 0;
  let mz = 0;
  if (keys.forward) { mx -= sin; mz -= cos; }
  if (keys.back) { mx += sin; mz += cos; }
  if (keys.left) { mx -= cos; mz += sin; }
  if (keys.right) { mx += cos; mz -= sin; }
  const len = Math.hypot(mx, mz);
  let moving = false;
  if (len > 0.01) {
    moving = true;
    const step = speed * dt;
    moveWithCollision(p.pos, (mx / len) * step, (mz / len) * step, 0.5, G.city.colliders);
  }
  p.pos.x = Math.max(-CFG.bound, Math.min(CFG.bound, p.pos.x));
  p.pos.z = Math.max(-CFG.bound, Math.min(CFG.bound, p.pos.z));

  if (input.wasPressed('Space') && p.onGround) {
    p.vy = CFG.jumpSpeed;
    p.onGround = false;
  }
  if (!p.onGround) {
    p.vy -= CFG.gravity * dt;
    p.pos.y += p.vy * dt;
    if (p.pos.y <= 0) { p.pos.y = 0; p.vy = 0; p.onGround = true; }
  }

  if (moving) {
    p.swing += dt * speed * 1.6;
    const s = Math.sin(p.swing) * 0.6;
    p.legL.rotation.x = s;
    p.legR.rotation.x = -s;
    p.armL.rotation.x = -s * 0.8;
    p.armR.rotation.x = s * 0.8;
  } else {
    p.legL.rotation.x *= 0.8;
    p.legR.rotation.x *= 0.8;
    p.armL.rotation.x *= 0.8;
    p.armR.rotation.x *= 0.8;
  }
  p.group.rotation.y = p.yaw;
}

// Camera follow: on foot about 8.5 m behind and 3.4 m above the player,
// driving about 9.5 m back and 4.2 m up (5.5 m in the closer mode).
// The camera eases toward its target so a cut never whips the view.
export function updateCamera(G, dt) {
  const p = G.player;
  const cam = G.camera;
  let tx, ty, tz, lx, ly, lz;
  if (p.inCar && p.car) {
    const car = p.car;
    const back = p.camClose ? 5.5 : 9.5;
    const up = p.camClose ? 2.6 : 4.2;
    const f = forwardOf(car.yaw);
    tx = car.pos.x - f.x * back;
    ty = up;
    tz = car.pos.z - f.z * back;
    lx = car.pos.x + f.x * 6;
    ly = 1.4;
    lz = car.pos.z + f.z * 6;
  } else {
    const f = forwardOf(p.yaw);
    tx = p.pos.x - f.x * p.camDist;
    ty = p.pos.y + 3.4 + p.pitch * 6;
    tz = p.pos.z - f.z * p.camDist;
    lx = p.pos.x + f.x * 4;
    ly = p.pos.y + 1.5;
    lz = p.pos.z + f.z * 4;
  }
  const k = 1 - Math.exp(-dt * 10);
  cam.position.x += (tx - cam.position.x) * k;
  cam.position.y += (ty - cam.position.y) * k;
  cam.position.z += (tz - cam.position.z) * k;
  cam.lookAt(lx, ly, lz);
}

// Title screen: a slow cinematic orbit of the city while traffic and
// pedestrians keep moving behind it.
export function updateTitleCamera(G, dt, t) {
  const cam = G.camera;
  const a = t * 0.045;
  const r = 150;
  cam.position.set(Math.cos(a) * r, 62, Math.sin(a) * r);
  cam.lookAt(0, 18, 0);
}

// Snap the camera to its follow target at once (used after teleports
// and before the first paint of a staged scene).
export function snapCamera(G) {
  const p = G.player;
  const cam = G.camera;
  if (p.inCar && p.car) {
    const f = forwardOf(p.car.yaw);
    const back = p.camClose ? 5.5 : 9.5;
    cam.position.set(p.car.pos.x - f.x * back, 4.2, p.car.pos.z - f.z * back);
    cam.lookAt(p.car.pos.x + f.x * 6, 1.4, p.car.pos.z + f.z * 6);
  } else {
    const f = forwardOf(p.yaw);
    cam.position.set(p.pos.x - f.x * p.camDist, p.pos.y + 3.4, p.pos.z - f.z * p.camDist);
    cam.lookAt(p.pos.x + f.x * 4, p.pos.y + 1.5, p.pos.z + f.z * 4);
  }
}
