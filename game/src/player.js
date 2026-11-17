// The player on foot: third-person movement, jumping, camera orbit and the
// chase camera used while driving. The player mesh is a simple stylised figure.
import * as THREE from 'three';
import { PLAYER } from './config.js';
import { resolveBuilding } from './city.js';

export function makePlayerMesh() {
  const g = new THREE.Group();
  const jacket = new THREE.MeshLambertMaterial({ color: 0xff5d8f });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.9, 0.38), jacket);
  body.position.y = 0.98;
  g.add(body);
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.27, 12, 10),
    new THREE.MeshLambertMaterial({ color: 0xe0ac69 }),
  );
  head.position.y = 1.66;
  g.add(head);
  const hair = new THREE.Mesh(
    new THREE.SphereGeometry(0.28, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2.2),
    new THREE.MeshLambertMaterial({ color: 0x1a1a1a }),
  );
  hair.position.y = 1.7;
  g.add(hair);
  const legMat = new THREE.MeshLambertMaterial({ color: 0x24344d });
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.6, 0.26), legMat);
  legL.position.set(-0.17, 0.3, 0);
  g.add(legL);
  const legR = legL.clone();
  legR.position.x = 0.17;
  g.add(legR);
  const armMat = new THREE.MeshLambertMaterial({ color: 0xff5d8f });
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.7, 0.22), armMat);
  armL.position.set(-0.44, 1.0, 0);
  g.add(armL);
  const armR = armL.clone();
  armR.position.x = 0.44;
  g.add(armR);
  g.userData = { legL, legR, armL, armR };
  return g;
}

export function createPlayer(scene) {
  const mesh = makePlayerMesh();
  mesh.position.set(-30, 0, 30);
  scene.add(mesh);
  return {
    mesh, x: -30, z: 30, y: 0, vy: 0, angle: Math.PI,
    camYaw: Math.PI, camPitch: 0.32, camDist: 8.5, camMode: 0,
    health: PLAYER.maxHealth, armor: 0, cash: 150,
    car: null, grounded: true, walkPhase: 0, moving: false,
  };
}

export function updatePlayerOnFoot(player, input, dt, colliders, jumpPressed) {
  const move = input.moveAxis();
  const mouse = input.takeMouse();
  player.camYaw -= mouse.dx * 0.0032;
  player.camPitch = Math.max(-0.15, Math.min(0.9, player.camPitch + mouse.dy * 0.0022));
  const running = input.isDown('ShiftLeft') || input.isDown('ShiftRight');
  const speed = running ? PLAYER.runSpeed : PLAYER.walkSpeed;
  const sin = Math.sin(player.camYaw);
  const cos = Math.cos(player.camYaw);
  // Camera-relative movement: W walks away from the camera.
  const fx = -sin; const fz = -cos;
  const rx = -cos; const rz = sin;
  let mx = fx * -move.z + rx * move.x;
  let mz = fz * -move.z + rz * move.x;
  const len = Math.hypot(mx, mz);
  player.moving = len > 0.01;
  if (player.moving) {
    mx /= len; mz /= len;
    player.angle = Math.atan2(mx, mz);
    const nx = player.x + mx * speed * dt;
    const nz = player.z + mz * speed * dt;
    const resolved = resolveBuilding(colliders, player.x, player.z, nx, nz, PLAYER.radius);
    player.x = resolved.x;
    player.z = resolved.z;
    player.walkPhase += dt * (running ? 13 : 9);
  }
  // Jump and gravity.
  if (jumpPressed && player.grounded) {
    player.vy = PLAYER.jumpSpeed;
    player.grounded = false;
  }
  if (!player.grounded) {
    player.vy -= 22 * dt;
    player.y += player.vy * dt;
    if (player.y <= 0) { player.y = 0; player.vy = 0; player.grounded = true; }
  }
  player.mesh.position.set(player.x, player.y, player.z);
  player.mesh.rotation.y = player.angle;
  const swing = player.moving ? Math.sin(player.walkPhase) * 0.6 : 0;
  player.mesh.userData.legL.rotation.x = swing;
  player.mesh.userData.legR.rotation.x = -swing;
  player.mesh.userData.armL.rotation.x = -swing * 0.7;
  player.mesh.userData.armR.rotation.x = swing * 0.7;
  return speed;
}

export function updateCamera(camera, player, dt) {
  const target = player.car
    ? { x: player.car.x, z: player.car.z, y: 1.2, angle: player.car.angle }
    : { x: player.x, z: player.z, y: 1.6, angle: player.camYaw };
  const dist = player.car ? (player.camMode === 1 ? 6 : 11) : player.camDist;
  const height = player.car ? 4.2 : 3.4;
  let cx; let cz;
  if (player.car) {
    const back = player.camMode === 1 ? 5.5 : 9.5;
    cx = target.x - Math.sin(target.angle) * back;
    cz = target.z - Math.cos(target.angle) * back;
  } else {
    cx = target.x + Math.sin(player.camYaw) * dist;
    cz = target.z + Math.cos(player.camYaw) * dist;
  }
  const desired = new THREE.Vector3(cx, target.y + height - (player.car ? 0 : player.camPitch * 4), cz);
  camera.position.lerp(desired, Math.min(1, dt * 6));
  camera.lookAt(target.x, target.y + 0.8, target.z);
}
