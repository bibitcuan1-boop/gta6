// Pedestrians strolling the sidewalks and foot officers chasing the
// player. People are small stylised figures with swinging legs; officers
// wear navy and a cap and can grab the player into an arrest.
import * as THREE from 'three';
import { CFG, PED_NAMES, SHIRT_COLORS, SKIN_TONES } from './config.js';
import { nearestRoad } from './city.js';

function buildFigure({ shirt, skin, hat, isOfficer }) {
  const group = new THREE.Group();
  const shirtMat = new THREE.MeshLambertMaterial({ color: shirt });
  const skinMat = new THREE.MeshLambertMaterial({ color: skin });
  const legMat = new THREE.MeshLambertMaterial({ color: isOfficer ? 0x1a2440 : 0x2e3440 });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.62, 0.32), shirtMat);
  torso.position.y = 1.12;
  group.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.21, 10, 10), skinMat);
  head.position.y = 1.62;
  group.add(head);
  if (hat === 'cap') {
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.23, 0.1, 10),
      new THREE.MeshLambertMaterial({ color: isOfficer ? 0x10203f : 0x333333 }));
    cap.position.y = 1.78;
    group.add(cap);
  } else if (hat === 'hair') {
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 10, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshLambertMaterial({ color: 0x1a1210 }));
    hair.position.y = 1.66;
    group.add(hair);
  }
  const armGeo = new THREE.BoxGeometry(0.13, 0.55, 0.13);
  const armL = new THREE.Mesh(armGeo, shirtMat);
  armL.position.set(-0.36, 1.12, 0);
  group.add(armL);
  const armR = new THREE.Mesh(armGeo, shirtMat);
  armR.position.set(0.36, 1.12, 0);
  group.add(armR);
  const legGeo = new THREE.BoxGeometry(0.17, 0.55, 0.17);
  const legL = new THREE.Mesh(legGeo, legMat);
  legL.position.set(-0.14, 0.55, 0);
  group.add(legL);
  const legR = new THREE.Mesh(legGeo, legMat);
  legR.position.set(0.14, 0.55, 0);
  group.add(legR);
  return { group, armL, armR, legL, legR, torso };
}

function randomSidewalkTarget(rng) {
  const along = rng.range(-200, 200);
  const cross = rng.pick([-180, -120, -60, 0, 60, 120, 180]);
  if (rng.chance(0.5)) return { x: along, z: cross + rng.pick([-8.5, 8.5]) };
  return { x: cross + rng.pick([-8.5, 8.5]), z: along };
}

export function createPeople(scene, rng) {
  const people = { peds: [], officers: [] };

  for (let i = 0; i < 26; i += 1) {
    const skin = rng.pick(SKIN_TONES);
    const shirt = rng.pick(SHIRT_COLORS);
    const hat = rng.chance(0.4) ? 'hair' : 'cap';
    const { group, armL, armR, legL, legR, torso } = buildFigure({ shirt, skin, hat, isOfficer: false });
    const spot = randomSidewalkTarget(rng);
    group.position.set(spot.x, 0, spot.z);
    scene.add(group);
    const ped = {
      group, armL, armR, legL, legR, torso,
      pos: group.position,
      yaw: rng.range(0, Math.PI * 2),
      speed: rng.range(1, 2),
      target: randomSidewalkTarget(rng),
      panic: 0,
      panicT: 0,
      health: 100,
      name: rng.pick(PED_NAMES),
      swing: rng.range(0, Math.PI * 2),
      dead: false,
    };
    torso.userData.pedRef = ped;
    people.peds.push(ped);
  }
  return people;
}

export function spawnOfficer(scene, x, z) {  const { group, armL, armR, legL, legR, torso } = buildFigure({
    shirt: 0x1a2440, skin: 0xf2c89b, hat: 'cap', isOfficer: true,
  });
  group.position.set(x, 0, z);
  scene.add(group);
  const officer = {
    group, armL, armR, legL, legR, torso,
    pos: group.position,
    yaw: 0,
    speed: 5.4,
    health: 60,
    arrestT: 0,
    swing: 0,
    dead: false,
  };
  torso.userData.officerRef = officer;
  return officer;
}

// Pedestrians walk between random sidewalk targets. When danger is near
// — the player is wanted or recently fired a weapon — within 22 m, they
// panic for three seconds and flee at 5.2 m/s.
export function updatePedestrians(people, rng, dt, danger) {
  for (const ped of people.peds) {
    if (ped.dead) continue;
    let speed = ped.speed;
    let tx = ped.target.x;
    let tz = ped.target.z;
    if (danger && danger.active) {
      const dx = ped.pos.x - danger.x;
      const dz = ped.pos.z - danger.z;
      const d = Math.hypot(dx, dz);
      if (d < 22) {
        ped.panic = 3;
        ped.panicT = 3;
      }
    }
    if (ped.panic > 0) {
      ped.panic -= dt;
      speed = 5.2;
      if (danger) {
        const dx = ped.pos.x - danger.x;
        const dz = ped.pos.z - danger.z;
        const d = Math.hypot(dx, dz) || 1;
        tx = ped.pos.x + (dx / d) * 30;
        tz = ped.pos.z + (dz / d) * 30;
      }
    }
    const dx = tx - ped.pos.x;
    const dz = tz - ped.pos.z;
    const d = Math.hypot(dx, dz);
    if (d < 1.5 && ped.panic <= 0) {
      ped.target = randomSidewalkTarget(rng);
    } else if (d > 0.01) {
      ped.yaw = Math.atan2(-dx, -dz);
      ped.pos.x += (dx / d) * speed * dt;
      ped.pos.z += (dz / d) * speed * dt;
    }
    ped.swing += dt * speed * 3.2;
    const s = Math.sin(ped.swing) * 0.55;
    ped.legL.rotation.x = s;
    ped.legR.rotation.x = -s;
    ped.armL.rotation.x = -s * 0.7;
    ped.armR.rotation.x = s * 0.7;
    ped.group.rotation.y = ped.yaw;
  }
}

// Officers chase the player directly. Within 2.4 m they grab, building
// an arrest timer; 2.2 s of contact means BUSTED.
export function updateOfficers(people, dt, playerPos, onArrest) {
  for (const off of people.officers) {
    if (off.dead) continue;
    const dx = playerPos.x - off.pos.x;
    const dz = playerPos.z - off.pos.z;
    const d = Math.hypot(dx, dz);
    if (d > 0.01) {
      off.yaw = Math.atan2(-dx, -dz);
      off.pos.x += (dx / d) * off.speed * dt;
      off.pos.z += (dz / d) * off.speed * dt;
    }
    off.swing += dt * off.speed * 3;
    const s = Math.sin(off.swing) * 0.6;
    off.legL.rotation.x = s;
    off.legR.rotation.x = -s;
    off.armL.rotation.x = -s * 0.7;
    off.armR.rotation.x = s * 0.7;
    off.group.rotation.y = off.yaw;
    if (d < 2.4) {
      off.arrestT += dt;
      if (off.arrestT >= CFG.arrestGrabTime) {
        off.arrestT = 0;
        onArrest();
      }
    } else {
      off.arrestT = Math.max(0, off.arrestT - dt * 2);
    }
  }
}

export { nearestRoad };

// A carjacked driver runs away on foot: a fresh pedestrian at the car
// who panics and flees from the spot.
export function spawnFleeingPed(scene, rng, people, x, z) {
  const { group, armL, armR, legL, legR, torso } = buildFigure({
    shirt: rng.pick(SHIRT_COLORS), skin: rng.pick(SKIN_TONES),
    hat: rng.chance(0.5) ? 'hair' : 'cap', isOfficer: false,
  });
  group.position.set(x, 0, z);
  scene.add(group);
  const ped = {
    group, armL, armR, legL, legR, torso,
    pos: group.position,
    yaw: rng.range(0, Math.PI * 2),
    speed: rng.range(1, 2),
    target: { x: x + rng.range(-40, 40), z: z + rng.range(-40, 40) },
    panic: 3,
    panicT: 3,
    health: 100,
    name: rng.pick(PED_NAMES),
    swing: 0,
    dead: false,
  };
  torso.userData.pedRef = ped;
  people.peds.push(ped);
  return ped;
}
