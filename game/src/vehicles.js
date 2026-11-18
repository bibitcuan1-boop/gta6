// Cars: boxy stylised groups, traffic that drives the road grid, parked
// stealable cars, driving physics, carjacking, and soft car-to-car
// collisions. A car is a plain object; its THREE group is its position.
import * as THREE from 'three';
import { CAR_COLORS, CAR_NAMES, CFG, ROADS } from './config.js';
import { moveWithCollision } from './city.js';

function buildCarMesh(color, isPolice) {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: isPolice ? 0xf5f5f5 : color });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.75, 4.4), bodyMat);
  body.position.y = 0.65;
  group.add(body);
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(1.8, 0.6, 2.2),
    new THREE.MeshLambertMaterial({ color: 0x1c2733 }),
  );
  cabin.position.set(0, 1.25, -0.2);
  group.add(cabin);
  if (isPolice) {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.14, 0.2, 4.42), new THREE.MeshLambertMaterial({ color: 0x2244cc }));
    stripe.position.y = 0.75;
    group.add(stripe);
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.18, 0.4), new THREE.MeshLambertMaterial({ color: 0x222222 }));
    bar.position.set(0, 1.65, -0.2);
    group.add(bar);
    const red = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 8), new THREE.MeshBasicMaterial({ color: 0xff2222 }));
    red.position.set(-0.35, 1.78, -0.2);
    group.add(red);
    const blue = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 8), new THREE.MeshBasicMaterial({ color: 0x2244ff }));
    blue.position.set(0.35, 1.78, -0.2);
    group.add(blue);
    group.userData.lampRed = red;
    group.userData.lampBlue = blue;
  }
  const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 10);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x14181d });
  const wheels = [];
  for (const [x, z] of [[-1.0, 1.45], [1.0, 1.45], [-1.0, -1.45], [1.0, -1.45]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(x, 0.38, z);
    group.add(w);
    wheels.push(w);
  }
  const lightMat = new THREE.MeshBasicMaterial({ color: 0xfff6c0 });
  for (const x of [-0.7, 0.7]) {
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.18, 0.1), lightMat);
    lamp.position.set(x, 0.7, 2.22);
    group.add(lamp);
  }
  return { group, wheels, body };
}

export function makeCar(scene, rng, isPolice, color) {
  const paint = isPolice ? 0xffffff : (color ?? rng.pick(CAR_COLORS));
  const { group, wheels, body } = buildCarMesh(paint, isPolice);
  scene.add(group);
  const car = {
    group, wheels, bodyMesh: body,
    pos: group.position,
    yaw: 0,
    speed: 0,
    health: 100,
    name: isPolice ? 'Interceptor' : rng.pick(CAR_NAMES),
    color: paint,
    isPolice: !!isPolice,
    parked: false,
    wrecked: false,
    traffic: null, // { axis:'x'|'z', dir, lane, cruise, turnT }
    driver: null, // pedestrian driving a traffic car, if any
    flashT: 0,
  };
  body.userData.carRef = car;
  return car;
}

export function createVehicles(scene, rng) {
  const cars = { traffic: [], parked: [], police: [], all: [] };

  function register(car) {
    cars.all.push(car);
    return car;
  }

  // Fourteen traffic cars, each on a random road, axis and direction,
  // a lane offset of about 2.8 m to its driving side, speed 6-9 m/s.
  for (let i = 0; i < 14; i += 1) {
    const car = makeCar(scene, rng, false);
    const axis = rng.chance(0.5) ? 'x' : 'z';
    const dir = rng.sign();
    const road = rng.pick(ROADS);
    const lane = 2.8 * dir;
    if (axis === 'x') {
      car.pos.set(rng.range(-200, 200), 0, road + lane);
      car.yaw = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    } else {
      car.pos.set(road + lane, 0, rng.range(-200, 200));
      car.yaw = dir > 0 ? Math.PI : 0;
    }
    car.traffic = { axis, dir, road, lane, cruise: rng.range(6, 9), turnT: rng.range(4, 12) };
    car.speed = car.traffic.cruise;
    cars.traffic.push(register(car));
  }

  // Ten parked cars along road edges, stealable with E.
  for (let i = 0; i < 10; i += 1) {
    const car = makeCar(scene, rng, false);
    const axis = rng.chance(0.5) ? 'x' : 'z';
    const road = rng.pick(ROADS);
    const along = rng.range(-190, 190);
    const side = rng.sign() * 5.6;
    if (axis === 'x') {
      car.pos.set(along, 0, road + side);
      car.yaw = rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2;
    } else {
      car.pos.set(road + side, 0, along);
      car.yaw = rng.chance(0.5) ? 0 : Math.PI;
    }
    car.parked = true;
    car.group.rotation.y = car.yaw;
    cars.parked.push(register(car));
  }

  return cars;
}

// Forward unit vector for a yaw (three.js: forward is -Z rotated by yaw).
export function forwardOf(yaw) {
  return { x: -Math.sin(yaw), z: -Math.cos(yaw) };
}

function wrapCoord(v) {
  if (v > CFG.half + 20) return -CFG.half - 20;
  if (v < -CFG.half - 20) return CFG.half + 20;
  return v;
}

// One traffic car's autopilot: slow for a car ahead, sometimes turn at a
// junction, wrap around the far edge so traffic never runs out.
export function updateTrafficCar(car, dt, allCars) {
  const t = car.traffic;
  let target = t.cruise;
  const f = forwardOf(car.yaw);
  for (const other of allCars) {
    if (other === car || other.wrecked) continue;
    const dx = other.pos.x - car.pos.x;
    const dz = other.pos.z - car.pos.z;
    const ahead = dx * f.x + dz * f.z;
    const side = Math.abs(dx * f.z - dz * f.x);
    if (ahead > 0 && ahead < 11 && side < 3) { target = 0; break; }
  }
  car.speed += (target - car.speed) * Math.min(1, dt * 2.5);
  car.pos.x += f.x * car.speed * dt;
  car.pos.z += f.z * car.speed * dt;
  t.turnT -= dt;
  const onJunction = Math.abs(car.pos.x - Math.round(car.pos.x / 60) * 60) < 4
    && Math.abs(car.pos.z - Math.round(car.pos.z / 60) * 60) < 4;
  if (t.turnT <= 0 && onJunction && car.speed > 1) {
    t.turnT = 8 + Math.random() * 10;
    if (Math.random() < 0.4) {
      // Turn onto the crossing road: swap axis, keep the lane offset.
      const newAxis = t.axis === 'x' ? 'z' : 'x';
      const newDir = Math.random() < 0.5 ? -1 : 1;
      const road = Math.round((newAxis === 'x' ? car.pos.z : car.pos.x) / 60) * 60;
      t.axis = newAxis; t.dir = newDir; t.road = road; t.lane = 2.8 * newDir;
      car.yaw = newAxis === 'x' ? (newDir > 0 ? Math.PI / 2 : -Math.PI / 2) : (newDir > 0 ? Math.PI : 0);
    }
  }
  if (t.axis === 'x') car.pos.x = wrapCoord(car.pos.x);
  else car.pos.z = wrapCoord(car.pos.z);
  car.group.rotation.y = car.yaw;
  for (const w of car.wheels) w.rotation.x += (car.speed * dt) / 0.38;
}

// Driving: W accelerates, S brakes or reverses, A/D steer. Called from
// the main loop with the player's car.
export function driveCar(car, input, dt, colliders, onCrash) {
  const fwd = input.down('KeyW') || input.down('ArrowUp');
  const back = input.down('KeyS') || input.down('ArrowDown');
  const left = input.down('KeyA') || input.down('ArrowLeft');
  const right = input.down('KeyD') || input.down('ArrowRight');
  if (fwd) car.speed += 22 * dt;
  else if (back) car.speed -= car.speed > 0.5 ? 30 * dt : 12 * dt;
  else car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 8 * dt);
  car.speed = Math.max(-CFG.carReverseSpeed, Math.min(CFG.carTopSpeed, car.speed));
  const steer = (left ? 1 : 0) - (right ? 1 : 0);
  const speedFactor = Math.min(1, Math.abs(car.speed) / 10);
  car.yaw += steer * CFG.carTurnRate * speedFactor * Math.sign(car.speed || 1) * dt;
  const f = forwardOf(car.yaw);
  const nx = car.pos.x + f.x * car.speed * dt;
  const nz = car.pos.z + f.z * car.speed * dt;
  const beforeX = car.pos.x;
  const beforeZ = car.pos.z;
  moveWithCollision(car.pos, nx - beforeX, nz - beforeZ, 1.6, colliders);
  const moved = Math.hypot(car.pos.x - beforeX, car.pos.z - beforeZ);
  const wanted = Math.hypot(nx - beforeX, nz - beforeZ);
  if (wanted > 0.01 && moved < wanted * 0.4 && Math.abs(car.speed) > 6) {
    // Hit a building: slow sharply, thud.
    car.speed *= 0.35;
    if (onCrash) onCrash(Math.abs(car.speed));
  }
  car.pos.x = Math.max(-CFG.bound, Math.min(CFG.bound, car.pos.x));
  car.pos.z = Math.max(-CFG.bound, Math.min(CFG.bound, car.pos.z));
  car.group.rotation.y = car.yaw;
  for (const w of car.wheels) w.rotation.x += (car.speed * dt) / 0.38;
}

// Soft car-to-car collisions: push apart, both lose speed.
export function resolveCarCollisions(allCars) {
  for (let i = 0; i < allCars.length; i += 1) {
    for (let j = i + 1; j < allCars.length; j += 1) {
      const a = allCars[i];
      const b = allCars[j];
      if (a.wrecked || b.wrecked) continue;
      const dx = b.pos.x - a.pos.x;
      const dz = b.pos.z - a.pos.z;
      const d = Math.hypot(dx, dz);
      if (d > 0.01 && d < 4.2) {
        const push = (4.2 - d) / 2;
        const ux = dx / d;
        const uz = dz / d;
        a.pos.x -= ux * push; a.pos.z -= uz * push;
        b.pos.x += ux * push; b.pos.z += uz * push;
        a.speed *= 0.82; b.speed *= 0.82;
      }
    }
  }
}

// Nearest car the player could enter, within 3.5 m.
export function nearestEnterableCar(playerPos, cars) {
  let best = null;
  let bd = 3.5;
  for (const car of cars.all) {
    if (car.wrecked || car.isPolice) continue;
    const d = Math.hypot(car.pos.x - playerPos.x, car.pos.z - playerPos.z);
    if (d < bd) { bd = d; best = car; }
  }
  return best;
}
