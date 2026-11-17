// People on foot: pedestrians who stroll the sidewalks and flee from danger,
// and Bay PD officers who chase the player on foot when the heat is on.
import * as THREE from 'three';
import { PED_NAMES, CITY_HALF, nearestRoad } from './config.js';
import { resolveBuilding } from './city.js';

const SHIRT_COLORS = [0xe74c3c, 0x3498db, 0x2ecc71, 0xf39c12, 0x9b59b6, 0x1abc9c, 0xecf0f1, 0xfd79a8];
const SKIN_COLORS = [0xf1c27d, 0xe0ac69, 0xc68642, 0x8d5524, 0xffdbac];

export function makePersonMesh(shirt, skin, isCop) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.62, 0.85, 0.36),
    new THREE.MeshLambertMaterial({ color: isCop ? 0x1c2f4a : shirt }),
  );
  body.position.y = 0.95;
  g.add(body);
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.26, 10, 8),
    new THREE.MeshLambertMaterial({ color: skin }),
  );
  head.position.y = 1.62;
  g.add(head);
  if (isCop) {
    const hat = new THREE.Mesh(
      new THREE.CylinderGeometry(0.28, 0.3, 0.14, 10),
      new THREE.MeshLambertMaterial({ color: 0x0e1a2a }),
    );
    hat.position.y = 1.84;
    g.add(hat);
  } else {
    const hair = new THREE.Mesh(
      new THREE.SphereGeometry(0.27, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshLambertMaterial({ color: 0x2d1a0e }),
    );
    hair.position.y = 1.66;
    g.add(hair);
  }
  const legMat = new THREE.MeshLambertMaterial({ color: isCop ? 0x101c2c : 0x2c3e50 });
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.55, 0.24), legMat);
  legL.position.set(-0.16, 0.28, 0);
  legL.name = 'legL';
  g.add(legL);
  const legR = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.55, 0.24), legMat);
  legR.position.set(0.16, 0.28, 0);
  legR.name = 'legR';
  g.add(legR);
  g.userData.legL = legL;
  g.userData.legR = legR;
  return g;
}

export function spawnPedestrians(scene, rng, pedSpawns, count) {
  const peds = [];
  for (let i = 0; i < count; i += 1) {
    const s = rng.pick(pedSpawns);
    const mesh = makePersonMesh(rng.pick(SHIRT_COLORS), rng.pick(SKIN_COLORS), false);
    const x = s.x + rng.range(-6, 6);
    const z = s.z + rng.range(-6, 6);
    mesh.position.set(x, 0, z);
    scene.add(mesh);
    peds.push({
      mesh, x, z, angle: rng.range(0, Math.PI * 2), speed: rng.range(1.1, 2.1),
      name: rng.pick(PED_NAMES), state: 'walk', panic: 0, walkPhase: rng.range(0, 6),
      targetX: x, targetZ: z, health: 100, isCop: false, dead: false,
    });
  }
  return peds;
}

function pickSidewalkTarget(ped, rng) {
  // Walk along the nearest road, on the sidewalk edge.
  const road = nearestRoad(ped.z);
  const along = rng.range(-CITY_HALF, CITY_HALF);
  if (Math.random() < 0.5) return { x: along, z: road + 8.5 };
  const roadX = nearestRoad(ped.x);
  return { x: roadX + 8.5, z: along };
}

export function updatePedestrians(peds, dt, colliders, danger, rng) {
  for (const ped of peds) {
    if (ped.dead) continue;
    ped.walkPhase += dt * 6;
    const distDanger = danger ? Math.hypot(ped.x - danger.x, ped.z - danger.z) : 999;
    if (distDanger < 22) ped.panic = Math.max(ped.panic, 3);
    if (ped.panic > 0) {
      ped.panic -= dt;
      ped.state = 'flee';
    } else if (Math.hypot(ped.targetX - ped.x, ped.targetZ - ped.z) < 2) {
      const t = pickSidewalkTarget(ped, rng);
      ped.targetX = t.x; ped.targetZ = t.z;
      ped.state = 'walk';
    }
    const speed = ped.state === 'flee' ? 5.2 : ped.speed;
    const dx = ped.targetX - ped.x;
    const dz = ped.targetZ - ped.z;
    const dist = Math.hypot(dx, dz);
    let mx = 0; let mz = 0;
    if (ped.state === 'flee') {
      mx = (ped.x - danger.x) / Math.max(1, distDanger);
      mz = (ped.z - danger.z) / Math.max(1, distDanger);
    } else if (dist > 0.5) {
      mx = dx / dist; mz = dz / dist;
    }
    const nx = ped.x + mx * speed * dt;
    const nz = ped.z + mz * speed * dt;
    const resolved = resolveBuilding(colliders, ped.x, ped.z, nx, nz, 0.5);
    ped.x = resolved.x; ped.z = resolved.z;
    if (mx !== 0 || mz !== 0) ped.angle = Math.atan2(mx, mz);
    ped.mesh.position.set(ped.x, 0, ped.z);
    ped.mesh.rotation.y = ped.angle;
    const swing = Math.sin(ped.walkPhase) * (ped.state === 'flee' ? 0.7 : 0.4);
    ped.mesh.userData.legL.rotation.x = swing;
    ped.mesh.userData.legR.rotation.x = -swing;
  }
}

export function spawnCop(scene, x, z) {
  const mesh = makePersonMesh(0x1c2f4a, 0xe0ac69, true);
  mesh.position.set(x, 0, z);
  scene.add(mesh);
  return {
    mesh, x, z, angle: 0, speed: 5.4, name: 'Officer', state: 'chase',
    panic: 0, walkPhase: 0, targetX: x, targetZ: z, health: 60, isCop: true, dead: false,
  };
}

export function updateCops(cops, dt, player, colliders, onArrest) {
  for (const cop of cops) {
    if (cop.dead) continue;
    cop.walkPhase += dt * 8;
    const dx = player.x - cop.x;
    const dz = player.z - cop.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.01) continue;
    const mx = dx / dist; const mz = dz / dist;
    const nx = cop.x + mx * cop.speed * dt;
    const nz = cop.z + mz * cop.speed * dt;
    const resolved = resolveBuilding(colliders, cop.x, cop.z, nx, nz, 0.5);
    cop.x = resolved.x; cop.z = resolved.z;
    cop.angle = Math.atan2(mx, mz);
    cop.mesh.position.set(cop.x, 0, cop.z);
    cop.mesh.rotation.y = cop.angle;
    const swing = Math.sin(cop.walkPhase) * 0.6;
    cop.mesh.userData.legL.rotation.x = swing;
    cop.mesh.userData.legR.rotation.x = -swing;
    if (dist < 2.4) onArrest(cop, dt);
  }
}
