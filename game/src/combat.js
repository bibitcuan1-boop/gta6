// Combat: shooting, punching, tracers, damage, pickups and the player's health.
// Shooting uses a ray from the camera through the crosshair; hits are resolved
// against pedestrians, officers, police cars and the player's own car.
import * as THREE from 'three';
import { WEAPONS, PLAYER } from './config.js';

export function createCombat() {
  return {
    weapon: 'pistol', ammo: 12, reserve: 60, lastShot: 0, lastPunch: 0,
    tracer: null, tracerLife: 0, muzzle: 0,
  };
}

export function switchWeapon(combat, name) {
  if (!WEAPONS[name]) return;
  combat.weapon = name;
  const w = WEAPONS[name];
  if (w.mag) { combat.ammo = w.mag; combat.reserve = w.mag * 4; }
}

export function reload(combat) {
  const w = WEAPONS[combat.weapon];
  if (!w.mag || combat.ammo === w.mag || combat.reserve <= 0) return false;
  const need = w.mag - combat.ammo;
  const take = Math.min(need, combat.reserve);
  combat.ammo += take;
  combat.reserve -= take;
  return true;
}

// A short-lived glowing line from the muzzle to the hit point.
export function makeTracer(scene, from, to) {
  const geo = new THREE.BufferGeometry().setFromPoints([from, to]);
  const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffe066, transparent: true, opacity: 0.95 }));
  scene.add(line);
  return line;
}

export function fireShot(scene, combat, origin, direction, targets, now, onHit) {
  const w = WEAPONS[combat.weapon];
  if (now - combat.lastShot < w.rate) return null;
  if (w.mag && combat.ammo <= 0) return 'empty';
  combat.lastShot = now;
  if (w.mag) combat.ammo -= 1;
  const ray = new THREE.Raycaster(origin, direction, 0, w.range);
  let best = null; let bestDist = w.range;
  const meshes = [];
  for (const t of targets) {
    if (t.dead) continue;
    meshes.push({ mesh: t.mesh, ref: t });
  }
  // Test each target's body box by raycasting its meshes.
  for (const { mesh, ref } of meshes) {
    const hits = ray.intersectObject(mesh, true);
    if (hits.length > 0 && hits[0].distance < bestDist) {
      bestDist = hits[0].distance;
      best = { ref, point: hits[0].point };
    }
  }
  const end = best ? best.point.clone() : origin.clone().add(direction.clone().multiplyScalar(w.range));
  if (combat.tracer) scene.remove(combat.tracer);
  combat.tracer = makeTracer(scene, origin.clone(), end);
  combat.tracerLife = 0.07;
  if (best) {
    best.ref.health -= w.damage;
    onHit(best.ref, best.point);
  }
  return best ? 'hit' : 'miss';
}

export function punch(combat, player, targets, now, onHit) {
  if (now - combat.lastPunch < 0.45) return null;
  combat.lastPunch = now;
  const fx = Math.sin(player.angle);
  const fz = Math.cos(player.angle);
  let hitAny = null;
  for (const t of targets) {
    if (t.dead) continue;
    const dx = t.x - player.x; const dz = t.z - player.z;
    const dist = Math.hypot(dx, dz);
    if (dist > PLAYER.punchRange) continue;
    const dot = (dx * fx + dz * fz) / Math.max(0.01, dist);
    if (dot < 0.4) continue;
    t.health -= PLAYER.punchDamage;
    hitAny = t;
    onHit(t, new THREE.Vector3(t.x, 1.2, t.z));
  }
  return hitAny;
}

export function updateTracer(scene, combat, dt) {
  if (combat.tracer) {
    combat.tracerLife -= dt;
    if (combat.tracerLife <= 0) {
      scene.remove(combat.tracer);
      combat.tracer.geometry.dispose();
      combat.tracer = null;
    }
  }
}

export function damagePlayer(player, amount, audio) {
  let remaining = amount;
  if (player.armor > 0) {
    const absorbed = Math.min(player.armor, remaining * 0.6);
    player.armor -= absorbed;
    remaining -= absorbed;
  }
  player.health -= remaining;
  if (player.health <= 0) {
    player.health = 0;
    return true;
  }
  return false;
}

// Pickups scattered around the city: health, armor, cash, the SMG and ammo.
export function spawnPickups(scene, list) {
  const out = [];
  for (const p of list) {
    let color = 0x37d67a; let geo = new THREE.BoxGeometry(1, 1, 1);
    if (p.kind === 'armor') color = 0x4aa8ff;
    if (p.kind === 'cash') { color = 0x7dff9b; geo = new THREE.CylinderGeometry(0.6, 0.6, 0.25, 12); }
    if (p.kind === 'smg') { color = 0xff5d8f; geo = new THREE.BoxGeometry(1.4, 0.35, 0.4); }
    if (p.kind === 'ammo') { color = 0xffd23e; geo = new THREE.BoxGeometry(0.7, 0.5, 0.7); }
    const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color, emissive: color, emissiveIntensity: 0.35 }));
    mesh.position.set(p.x, 1.1, p.z);
    mesh.name = 'pickup';
    scene.add(mesh);
    out.push({ ...p, mesh, taken: false, spin: Math.random() * 6 });
  }
  return out;
}

export function updatePickups(pickups, dt, player, combat, onCollect) {
  for (const p of pickups) {
    if (p.taken) continue;
    p.spin += dt;
    p.mesh.rotation.y = p.spin;
    p.mesh.position.y = 1.1 + Math.sin(p.spin * 2) * 0.15;
    const d = Math.hypot(p.x - player.x, p.z - player.z);
    if (d < 2) {
      p.taken = true;
      p.mesh.visible = false;
      onCollect(p, player, combat);
    }
  }
}
