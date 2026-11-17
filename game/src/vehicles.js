// Cars: building them, driving them, stealing them, and the traffic that fills the roads.
// A car is a THREE.Group plus a small state record; traffic cars follow the road grid.
import * as THREE from 'three';
import { CAR, CAR_COLORS, CAR_NAMES, roadCentres, nearestRoad, clampCity, CITY_HALF } from './config.js';
import { resolveBuilding } from './city.js';

export function makeCarMesh(color, isPolice) {
  const car = new THREE.Group();
  const paint = new THREE.MeshLambertMaterial({ color: isPolice ? 0xf2f2f2 : color });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.75, 4.4), paint);
  body.position.y = 0.65;
  car.add(body);
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(1.8, 0.65, 2.2),
    new THREE.MeshLambertMaterial({ color: isPolice ? 0x1c2f4a : 0x1a2733 }),
  );
  cabin.position.set(0, 1.3, -0.2);
  car.add(cabin);
  if (isPolice) {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.12, 0.3, 4.42), new THREE.MeshLambertMaterial({ color: 0x1448c8 }));
    stripe.position.y = 0.62;
    car.add(stripe);
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.22, 0.5), new THREE.MeshBasicMaterial({ color: 0xff2222 }));
    bar.position.set(0, 1.75, -0.2);
    bar.name = 'lightbar';
    car.add(bar);
    const bar2 = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.22, 0.5), new THREE.MeshBasicMaterial({ color: 0x2266ff }));
    bar2.position.set(0.6, 1.75, -0.2);
    bar2.name = 'lightbar2';
    car.add(bar2);
  }
  const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.3, 10);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x141414 });
  const wheels = [];
  for (const [wx, wz] of [[-1.0, 1.45], [1.0, 1.45], [-1.0, -1.45], [1.0, -1.45]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(wx, 0.42, wz);
    car.add(w);
    wheels.push(w);
  }
  const lightMat = new THREE.MeshBasicMaterial({ color: 0xfff6c0 });
  for (const hx of [-0.7, 0.7]) {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.2, 0.1), lightMat);
    hl.position.set(hx, 0.7, 2.22);
    car.add(hl);
  }
  car.userData.wheels = wheels;
  return car;
}

export function createCar(x, z, angle, color, name, isPolice, isTraffic) {
  const mesh = makeCarMesh(color, isPolice);
  mesh.position.set(x, 0, z);
  mesh.rotation.y = angle;
  return {
    mesh, x, z, angle, speed: 0, color, name,
    isPolice: !!isPolice, isTraffic: !!isTraffic, driver: null,
    steer: 0, health: 100, sirenPhase: Math.random() * 2,
    // Traffic state: which road axis it follows and which way.
    axis: 'x', dir: 1, road: 0, stuck: 0,
  };
}

export function spawnTraffic(scene, rng, carSpawns, count) {
  const cars = [];
  const centres = roadCentres();
  for (let i = 0; i < count; i += 1) {
    const road = rng.pick(centres);
    const axis = rng.chance(0.5) ? 'x' : 'z';
    const dir = rng.chance(0.5) ? 1 : -1;
    const along = rng.range(-CITY_HALF, CITY_HALF);
    const lane = 2.8 * dir;
    const x = axis === 'x' ? along : road + lane;
    const z = axis === 'x' ? road + lane : along;
    const angle = axis === 'x' ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI);
    const car = createCar(x, z, angle, rng.pick(CAR_COLORS), rng.pick(CAR_NAMES), false, true);
    car.axis = axis; car.dir = dir; car.road = road;
    car.speed = rng.range(6, CAR.trafficSpeed);
    scene.add(car.mesh);
    cars.push(car);
  }
  // Parked cars the player can steal.
  for (let i = 0; i < 10; i += 1) {
    const s = carSpawns[(rng.int(0, carSpawns.length - 1))];
    const car = createCar(s.x, s.z, s.angle, rng.pick(CAR_COLORS), rng.pick(CAR_NAMES), false, false);
    scene.add(car.mesh);
    cars.push(car);
  }
  return cars;
}

function carAhead(cars, me, dist) {
  for (const c of cars) {
    if (c === me || c.isTraffic === false) continue;
    const dx = c.x - me.x; const dz = c.z - me.z;
    const forward = Math.sin(me.angle) * dx + Math.cos(me.angle) * dz;
    const side = Math.abs(Math.cos(me.angle) * dx - Math.sin(me.angle) * dz);
    if (forward > 0 && forward < dist && side < 3) return true;
  }
  return false;
}

export function updateTraffic(cars, dt, colliders) {
  for (const car of cars) {
    if (!car.isTraffic) continue;
    // Slow down for the car ahead, stop at nothing else — Palmera Bay has no traffic lights.
    const target = carAhead(cars, car, 11) ? 0 : CAR.trafficSpeed;
    car.speed += (target - car.speed) * Math.min(1, dt * 1.5);
    const step = car.speed * car.dir * dt;
    if (car.axis === 'x') car.x += step; else car.z += step;
    // At a junction, sometimes turn onto the crossing road.
    const onRoad = Math.abs((car.axis === 'x' ? car.z : car.x) - nearestRoad(car.axis === 'x' ? car.z : car.x)) < 1;
    const atJunction = Math.abs(nearestRoad(car.axis === 'x' ? car.x : car.z) - (car.axis === 'x' ? car.x : car.z)) < 2.5;
    if (onRoad && atJunction && Math.random() < dt * 0.25) {
      const newAxis = car.axis === 'x' ? 'z' : 'x';
      const newRoad = nearestRoad(car.axis === 'x' ? car.x : car.z);
      car.axis = newAxis;
      if (newAxis === 'x') { car.z = newRoad + 2.8 * car.dir; } else { car.x = newRoad + 2.8 * car.dir; }
      car.angle = newAxis === 'x' ? (car.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (car.dir > 0 ? 0 : Math.PI);
    }
    if (car.x > CITY_HALF + 20 || car.x < -CITY_HALF - 20 || car.z > CITY_HALF + 20 || car.z < -CITY_HALF - 20) {
      // Wrap around the far edge so traffic never runs out.
      if (car.axis === 'x') car.x = -car.dir * (CITY_HALF + 18); else car.z = -car.dir * (CITY_HALF + 18);
    }
    car.mesh.position.set(car.x, 0, car.z);
    car.mesh.rotation.y = car.angle;
    const spin = car.speed * dt * 2.4;
    for (const w of car.mesh.userData.wheels) w.rotation.x += spin;
  }
}

export function driveCar(car, input, dt, colliders, cars) {
  const move = input.moveAxis();
  const forward = -move.z; // W is forward
  const steerInput = move.x;
  if (forward > 0) car.speed += CAR.accel * dt;
  else if (forward < 0) car.speed -= (car.speed > 0.5 ? CAR.brake : CAR.accel * 0.6) * dt;
  else car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 8 * dt);
  car.speed = Math.max(-CAR.reverseSpeed, Math.min(CAR.maxSpeed, car.speed));
  const steerAmount = steerInput * CAR.turnRate * dt * Math.min(1, Math.abs(car.speed) / 8) * Math.sign(car.speed || 1);
  car.angle += steerAmount;
  const nx = car.x + Math.sin(car.angle) * car.speed * dt;
  const nz = car.z + Math.cos(car.angle) * car.speed * dt;
  const resolved = resolveBuilding(colliders, car.x, car.z, nx, nz, 2.2);
  if ((resolved.x !== nx || resolved.z !== nz) && Math.abs(car.speed) > 6) {
    car.speed *= 0.45;
  }
  car.x = clampCity(resolved.x);
  car.z = clampCity(resolved.z);
  // Soft bumps against other cars.
  for (const other of cars) {
    if (other === car) continue;
    const dx = car.x - other.x; const dz = car.z - other.z;
    const d2 = dx * dx + dz * dz;
    if (d2 < 16 && d2 > 0.01) {
      const d = Math.sqrt(d2);
      car.x = other.x + (dx / d) * 4;
      car.z = other.z + (dz / d) * 4;
      car.speed *= 0.7;
    }
  }
  car.mesh.position.set(car.x, 0, car.z);
  car.mesh.rotation.y = car.angle;
  const spin = car.speed * dt * 2.4;
  for (const w of car.mesh.userData.wheels) w.rotation.x += spin;
  return Math.abs(car.speed);
}

export function nearestCar(cars, x, z, maxDist, excludePolice) {
  let best = null; let bd = maxDist;
  for (const car of cars) {
    if (excludePolice && car.isPolice) continue;
    const d = Math.hypot(car.x - x, car.z - z);
    if (d < bd) { bd = d; best = car; }
  }
  return best;
}
