// Wanted level and police: stars 0-5, police cars and foot officers
// scaling with stars, chases, rams, arrests, escape and slow decay.
import { CFG } from './config.js';
import { forwardOf, makeCar } from './vehicles.js';

export function createPolice() {
  return {
    stars: 0,
    spawnT: 0,
    escapeT: 0,
    decayT: 0,
    // Pure helper, also used by the headless tests.
    policeCarTarget(stars) {
      return Math.min(30, 14 + 3.5 * stars);
    },
    wantedCarCount(stars) {
      return Math.min(5, 1 + stars);
    },
    wantedOfficerCount(stars) {
      return stars >= 2 ? Math.min(4, stars) : 0;
    },
    addStar(G, n = 1) {
      if (this.stars >= 5) return;
      this.stars = Math.min(5, this.stars + n);
      this.escapeT = 0;
      if (G.hud) G.hud.setStars(this.stars);
    },
    clearStars(G, silent) {
      this.stars = 0;
      this.escapeT = 0;
      if (G.hud) G.hud.setStars(0);
      if (!silent && G.hud) G.hud.banner('YOU LOST THE COPS');
    },
  };
}

function playerTarget(G) {
  const p = G.player;
  if (p.inCar && p.car) return { x: p.car.pos.x, z: p.car.pos.z };
  return { x: p.pos.x, z: p.pos.z };
}

function spawnPoliceCar(G) {
  const t = playerTarget(G);
  const angle = Math.random() * Math.PI * 2;
  const x = t.x + Math.cos(angle) * 55;
  const z = t.z + Math.sin(angle) * 55;
  const car = makeCar(G.scene, G.rng, true);
  car.pos.set(Math.max(-220, Math.min(220, x)), 0, Math.max(-220, Math.min(220, z)));
  car.yaw = Math.atan2(-(t.x - car.pos.x), -(t.z - car.pos.z));
  car.speed = 12;
  G.cars.police.push(car);
  G.cars.all.push(car);
  return car;
}

function spawnOfficer(G) {
  const t = playerTarget(G);
  const angle = Math.random() * Math.PI * 2;
  const x = t.x + Math.cos(angle) * 22;
  const z = t.z + Math.sin(angle) * 22;
  const off = G.people.spawnOfficer(G.scene, x, z);
  G.people.officers.push(off);
  return off;
}

export function updatePolice(G, dt) {
  const P = G.police;
  const cars = G.cars.police;
  const officers = G.people.officers;

  // Trim dead police cars / officers from the active lists.
  for (let i = cars.length - 1; i >= 0; i -= 1) {
    if (cars[i].wrecked) cars.splice(i, 1);
  }
  for (let i = officers.length - 1; i >= 0; i -= 1) {
    if (officers[i].dead) officers.splice(i, 1);
  }

  if (P.stars <= 0) return;

  // Spawn new units every 2.5 s until the wanted counts are met.
  P.spawnT -= dt;
  if (P.spawnT <= 0) {
    P.spawnT = 2.5;
    if (cars.length < P.wantedCarCount(P.stars)) spawnPoliceCar(G);
    if (officers.length < P.wantedOfficerCount(P.stars)) spawnOfficer(G);
  }

  // Police cars chase: steer toward the player, ram within 4.2 m.
  const t = playerTarget(G);
  const targetSpeed = P.policeCarTarget(P.stars);
  for (const car of cars) {
    const dx = t.x - car.pos.x;
    const dz = t.z - car.pos.z;
    const d = Math.hypot(dx, dz);
    const wantYaw = Math.atan2(-dx, -dz);
    let diff = wantYaw - car.yaw;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    const turn = Math.max(-2.2 * dt, Math.min(2.2 * dt, diff));
    car.yaw += turn;
    car.speed += (targetSpeed - car.speed) * Math.min(1, dt * 1.2);
    const f = forwardOf(car.yaw);
    car.pos.x += f.x * car.speed * dt;
    car.pos.z += f.z * car.speed * dt;
    car.group.rotation.y = car.yaw;
    for (const w of car.wheels) w.rotation.x += (car.speed * dt) / 0.38;
    // Light bar flashes red and blue on a roughly quarter-second beat.
    car.flashT += dt;
    const on = Math.floor(car.flashT / 0.25) % 2 === 0;
    if (car.group.userData.lampRed) {
      car.group.userData.lampRed.material.color.setHex(on ? 0xff2222 : 0x441111);
      car.group.userData.lampBlue.material.color.setHex(on ? 0x111144 : 0x2244ff);
    }
    if (d < 4.2) {
      // Ram: heavy damage to the player's car, or damage on foot.
      if (G.player.inCar && G.player.car) {
        G.player.car.health -= 18 * dt * 4;
        G.player.car.speed *= 0.92;
        if (G.player.car.health <= 0) G.combat.wreckCar(G, G.player.car);
      } else {
        G.combat.damagePlayer(G, 12 * dt * 4);
      }
      car.speed *= 0.7;
    }
  }

  // Escape: if no police unit is within 95 m for 9 continuous seconds,
  // the stars clear. At one star the heat also decays slowly out of sight.
  const t2 = playerTarget(G);
  let nearest = Infinity;
  for (const car of cars) {
    nearest = Math.min(nearest, Math.hypot(car.pos.x - t2.x, car.pos.z - t2.z));
  }
  for (const off of officers) {
    nearest = Math.min(nearest, Math.hypot(off.pos.x - t2.x, off.pos.z - t2.z));
  }
  if (nearest > CFG.escapeRadius) {
    P.escapeT += dt;
    if (P.escapeT >= CFG.escapeTime) {
      P.clearStars(G);
      if (G.missions) G.missions.onEscape();
    }
  } else {
    P.escapeT = 0;
  }
  if (P.stars === 1 && nearest > CFG.escapeRadius) {
    P.decayT += dt;
    if (P.decayT >= 20) {
      P.decayT = 0;
      P.clearStars(G);
      if (G.missions) G.missions.onEscape();
    }
  } else {
    P.decayT = 0;
  }
}

// Remove every police unit (arrest, death, mission reset).
export function clearAllPolice(G) {
  for (const car of G.cars.police) {
    G.scene.remove(car.group);
    const i = G.cars.all.indexOf(car);
    if (i >= 0) G.cars.all.splice(i, 1);
  }
  G.cars.police.length = 0;
  for (const off of G.people.officers) G.scene.remove(off.group);
  G.people.officers.length = 0;
}
