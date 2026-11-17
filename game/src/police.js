// The wanted system: stars, police cars that chase and ram, officers on foot,
// escape timers, and the busted / wasted endings.
import * as THREE from 'three';
import { POLICE, CITY_HALF } from './config.js';
import { createCar } from './vehicles.js';
import { spawnCop } from './people.js';

export function createWanted() {
  return {
    stars: 0, heat: 0, escapeTimer: 0, arrestTimer: 0,
    policeCars: [], cops: [], spawnTimer: 0, lastSeen: 0,
  };
}

export function addWanted(wanted, amount, reason) {
  wanted.stars = Math.max(0, Math.min(POLICE.maxStars, wanted.stars + amount));
  wanted.heat = Math.max(wanted.heat, wanted.stars * 20);
  wanted.escapeTimer = 0;
  return wanted.stars;
}

export function spawnPoliceCar(scene, wanted, px, pz, rng) {
  const angle = rng.range(0, Math.PI * 2);
  const x = px + Math.sin(angle) * 55;
  const z = pz + Math.cos(angle) * 55;
  const car = createCar(x, z, angle, 0xf2f2f2, 'Bay PD Interceptor', true, false);
  car.speed = 12;
  scene.add(car.mesh);
  wanted.policeCars.push(car);
  return car;
}

export function updateWanted(wanted, dt, scene, player, rng, events) {
  const px = player.x; const pz = player.z;
  const inCar = !!player.car;
  // How many police units the stars demand.
  const wantCars = wanted.stars >= 1 ? Math.min(1 + wanted.stars, 5) : 0;
  const wantCops = wanted.stars >= 2 ? Math.min(wanted.stars, 4) : 0;
  wanted.spawnTimer -= dt;
  if (wanted.stars > 0 && wanted.spawnTimer <= 0) {
    wanted.spawnTimer = 2.5;
    if (wanted.policeCars.length < wantCars) spawnPoliceCar(scene, wanted, px, pz, rng);
    if (wanted.cops.length < wantCops && !inCar) {
      const a = rng.range(0, Math.PI * 2);
      wanted.cops.push(spawnCop(scene, px + Math.sin(a) * 22, pz + Math.cos(a) * 22));
    }
  }
  // Police cars chase and ram.
  for (const car of wanted.policeCars) {
    const dx = px - car.x; const dz = pz - car.z;
    const dist = Math.hypot(dx, dz);
    const wantAngle = Math.atan2(dx, dz);
    let diff = wantAngle - car.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    car.angle += Math.max(-2.2 * dt, Math.min(2.2 * dt, diff));
    const targetSpeed = Math.min(POLICE.chaseSpeed, 14 + wanted.stars * 3.5);
    car.speed += (targetSpeed - car.speed) * Math.min(1, dt * 1.2);
    car.x += Math.sin(car.angle) * car.speed * dt;
    car.z += Math.cos(car.angle) * car.speed * dt;
    car.x = Math.max(-CITY_HALF - 30, Math.min(CITY_HALF + 30, car.x));
    car.z = Math.max(-CITY_HALF - 30, Math.min(CITY_HALF + 30, car.z));
    car.mesh.position.set(car.x, 0, car.z);
    car.mesh.rotation.y = car.angle;
    // Flash the light bar.
    const phase = Math.floor(performance.now() / 280) % 2 === 0;
    const bar = car.mesh.getObjectByName('lightbar');
    if (bar) bar.material.color.setHex(phase ? 0xff2222 : 0x2266ff);
    // Ram the player's car or the player.
    if (dist < 4.2) {
      if (inCar && player.car) {
        player.car.speed *= 0.82;
        player.car.health -= 6 * dt * 10;
        events.onRam(dt);
      } else if (dist < 2.6) {
        events.onRam(dt);
      }
    }
    // Nearest police distance drives the escape timer.
    wanted.lastSeen = dist;
  }
  // Escape: no police unit within lose distance for loseTime seconds.
  let nearest = Infinity;
  for (const car of wanted.policeCars) nearest = Math.min(nearest, Math.hypot(car.x - px, car.z - pz));
  for (const cop of wanted.cops) if (!cop.dead) nearest = Math.min(nearest, Math.hypot(cop.x - px, cop.z - pz));
  if (wanted.stars > 0) {
    if (nearest > POLICE.loseDistance) {
      wanted.escapeTimer += dt;
      if (wanted.escapeTimer >= POLICE.loseTime) {
        wanted.stars = 0;
        wanted.escapeTimer = 0;
        events.onEscaped();
        clearPolice(scene, wanted);
      }
    } else {
      wanted.escapeTimer = 0;
    }
  }
  // Wanted decays slowly when the player stays out of sight at 1 star.
  if (wanted.stars === 1) {
    wanted.heat -= dt * 1.2;
    if (wanted.heat <= 0) { wanted.stars = 0; events.onEscaped(); clearPolice(scene, wanted); }
  }
  return nearest;
}

export function clearPolice(scene, wanted) {
  for (const car of wanted.policeCars) scene.remove(car.mesh);
  for (const cop of wanted.cops) scene.remove(cop.mesh);
  wanted.policeCars = [];
  wanted.cops = [];
}

export function wantedLabel(stars) {
  return '★'.repeat(stars) + '☆'.repeat(Math.max(0, 5 - stars));
}
