// Palmera Bay itself: ground, sea, sky, roads, buildings, palms, lights, props.
// Builds every static mesh once and hands back the collision boxes and spawn points.
import * as THREE from 'three';
import { BLOCK, ROAD, GRID, PITCH, CITY_HALF, roadCentres } from './config.js';

const BUILDING_COLORS = [0x8fa3b8, 0xb8a58f, 0x7d94a6, 0xd9c1a3, 0x9fb4c7, 0xc7a2a2, 0xa8b89a, 0x6f87a0];
const ROOF_COLORS = [0x3a4a5a, 0x5a4a3a, 0x2f3d4d, 0x6b5a4a];

export function buildCity(scene, rng) {
  const colliders = [];
  const carSpawns = [];
  const pedSpawns = [];
  const group = new THREE.Group();
  group.name = 'PalmeraBayCity';

  // Sky, sun, fog and light.
  scene.background = new THREE.Color(0x87bfe8);
  scene.fog = new THREE.Fog(0x9cc8e8, 180, 520);
  const sun = new THREE.DirectionalLight(0xfff2d0, 2.4);
  sun.position.set(120, 180, 60);
  scene.add(sun);
  scene.add(new THREE.AmbientLight(0xbfd9ff, 0.9));
  const hemi = new THREE.HemisphereLight(0xbfe3ff, 0x8a7a5a, 0.7);
  scene.add(hemi);

  // Ground: city slab plus a big sea plane to the south and a sand beach strip.
  const ground = new THREE.Mesh(
    new THREE.BoxGeometry(CITY_HALF * 2 + 120, 1, CITY_HALF * 2 + 120),
    new THREE.MeshLambertMaterial({ color: 0x5d7a52 }),
  );
  ground.position.y = -0.5;
  group.add(ground);
  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(900, 260),
    new THREE.MeshLambertMaterial({ color: 0x1f7fa8 }),
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(0, -0.4, CITY_HALF + 150);
  group.add(sea);
  const sand = new THREE.Mesh(
    new THREE.BoxGeometry(CITY_HALF * 2 + 120, 0.4, 26),
    new THREE.MeshLambertMaterial({ color: 0xe8d8a8 }),
  );
  sand.position.set(0, -0.2, CITY_HALF + 18);
  group.add(sand);

  // Clouds: flat white blobs drifting high above the city.
  const cloudMat = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 });
  for (let i = 0; i < 14; i += 1) {
    const cloud = new THREE.Group();
    for (let j = 0; j < 3; j += 1) {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(rng.range(6, 11), 8, 6), cloudMat);
      puff.position.set(j * 9 - 9, rng.range(-1, 1), rng.range(-2, 2));
      puff.scale.y = 0.45;
      cloud.add(puff);
    }
    cloud.position.set(rng.range(-260, 260), rng.range(70, 110), rng.range(-260, 260));
    cloud.userData.drift = rng.range(0.5, 1.5);
    group.add(cloud);
  }

  // Roads: dark strips along every grid line, plus pale centre dashes.
  const centres = roadCentres();
  const roadMat = new THREE.MeshLambertMaterial({ color: 0x2e343c });
  const dashMat = new THREE.MeshLambertMaterial({ color: 0xf5d76e });
  const span = CITY_HALF * 2 + 40;
  for (const c of centres) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(span, 0.2, ROAD), roadMat);
    h.position.set(0, 0.05, c);
    group.add(h);
    const v = new THREE.Mesh(new THREE.BoxGeometry(ROAD, 0.2, span), roadMat);
    v.position.set(c, 0.05, 0);
    group.add(v);
    for (let d = -CITY_HALF; d < CITY_HALF; d += 12) {
      const dash = new THREE.Mesh(new THREE.BoxGeometry(5, 0.05, 0.7), dashMat);
      dash.position.set(d, 0.18, c);
      group.add(dash);
    }
  }
  // Sidewalks: light frames around each block.
  const walkMat = new THREE.MeshLambertMaterial({ color: 0xb9b3a4 });
  for (let i = 0; i < GRID; i += 1) {
    for (let j = 0; j < GRID; j += 1) {
      const cx = -CITY_HALF + PITCH / 2 + i * PITCH;
      const cz = -CITY_HALF + PITCH / 2 + j * PITCH;
      const walk = new THREE.Mesh(new THREE.BoxGeometry(BLOCK + 4, 0.3, BLOCK + 4), walkMat);
      walk.position.set(cx, 0.12, cz);
      group.add(walk);
    }
  }

  // Buildings: 1–3 towers per block, windows as a glowing grid texture drawn on canvas.
  const windowTex = makeWindowTexture();
  for (let i = 0; i < GRID; i += 1) {
    for (let j = 0; j < GRID; j += 1) {
      const cx = -CITY_HALF + PITCH / 2 + i * PITCH;
      const cz = -CITY_HALF + PITCH / 2 + j * PITCH;
      const isDowntown = Math.abs(cx) < 70 && Math.abs(cz) < 70;
      const count = isDowntown ? rng.int(2, 3) : rng.int(1, 2);
      for (let k = 0; k < count; k += 1) {
        const w = rng.range(10, 18);
        const d = rng.range(10, 18);
        const h = isDowntown ? rng.range(28, 64) : rng.range(8, 26);
        const ox = rng.range(-9, 9);
        const oz = rng.range(-9, 9);
        const color = rng.pick(BUILDING_COLORS);
        const mat = new THREE.MeshLambertMaterial({ color, map: windowTex });
        const tower = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
        tower.position.set(cx + ox, h / 2, cz + oz);
        group.add(tower);
        const roof = new THREE.Mesh(
          new THREE.BoxGeometry(w + 1, 1.2, d + 1),
          new THREE.MeshLambertMaterial({ color: rng.pick(ROOF_COLORS) }),
        );
        roof.position.set(cx + ox, h + 0.6, cz + oz);
        group.add(roof);
        if (h > 40) {
          const beacon = new THREE.Mesh(
            new THREE.SphereGeometry(0.7, 8, 6),
            new THREE.MeshBasicMaterial({ color: 0xff4444 }),
          );
          beacon.position.set(cx + ox, h + 1.6, cz + oz);
          beacon.name = 'beacon';
          group.add(beacon);
        }
        colliders.push({ minX: cx + ox - w / 2, maxX: cx + ox + w / 2, minZ: cz + oz - d / 2, maxZ: cz + oz + d / 2 });
      }
      // Palm trees on the block corners.
      for (const [px, pz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        if (!rng.chance(0.55)) continue;
        const palm = makePalm(rng);
        palm.position.set(cx + px * (BLOCK / 2 - 2), 0, cz + pz * (BLOCK / 2 - 2));
        group.add(palm);
      }
      pedSpawns.push({ x: cx + 12, z: cz + 12 });
    }
  }

  // Street lights along the roads and a few benches / hydrants as props.
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x30363e });
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
  for (const c of centres) {
    for (let d = -CITY_HALF + 20; d < CITY_HALF; d += 60) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 7, 6), poleMat);
      pole.position.set(d, 3.5, c + ROAD / 2 + 1);
      group.add(pole);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.55, 8, 6), lampMat);
      lamp.position.set(d, 7.1, c + ROAD / 2 + 1);
      group.add(lamp);
    }
  }

  // Landmarks: the Palmera Trust tower downtown, the Marina lighthouse, the Strip sign.
  const trust = new THREE.Mesh(
    new THREE.BoxGeometry(26, 78, 26),
    new THREE.MeshLambertMaterial({ color: 0xd9c98a, map: windowTex }),
  );
  trust.position.set(14, 39, -14);
  group.add(trust);
  colliders.push({ minX: 1, maxX: 27, minZ: -27, maxZ: -1 });
  const lightHouse = new THREE.Group();
  const towerMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(3, 4.5, 26, 10),
    new THREE.MeshLambertMaterial({ color: 0xf2ede4 }),
  );
  towerMesh.position.y = 13;
  lightHouse.add(towerMesh);
  const lampTop = new THREE.Mesh(
    new THREE.SphereGeometry(2.2, 10, 8),
    new THREE.MeshBasicMaterial({ color: 0xfff2a8 }),
  );
  lampTop.position.y = 27;
  lightHouse.add(lampTop);
  lightHouse.position.set(-CITY_HALF - 6, 0, CITY_HALF + 8);
  group.add(lightHouse);

  // Parked-car spawn points along road edges.
  for (const c of centres) {
    for (let d = -CITY_HALF + 30; d < CITY_HALF; d += 75) {
      carSpawns.push({ x: d, z: c + ROAD / 2 - 2.5, angle: 0 });
      carSpawns.push({ x: c + ROAD / 2 - 2.5, z: d, angle: Math.PI / 2 });
    }
  }

  scene.add(group);
  return { colliders, carSpawns, pedSpawns, group };
}

function makeWindowTexture() {
  const cv = document.createElement('canvas');
  cv.width = 64; cv.height = 128;
  const g = cv.getContext('2d');
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, 64, 128);
  for (let y = 6; y < 122; y += 12) {
    for (let x = 6; x < 58; x += 12) {
      const lit = Math.random() < 0.35;
      g.fillStyle = lit ? '#ffe9a0' : '#2c3e50';
      g.fillRect(x, y, 7, 8);
    }
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function makePalm(rng) {
  const palm = new THREE.Group();
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.35, 6, 6),
    new THREE.MeshLambertMaterial({ color: 0x8a6b46 }),
  );
  trunk.position.y = 3;
  trunk.rotation.z = rng.range(-0.08, 0.08);
  palm.add(trunk);
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x2fae5f, side: THREE.DoubleSide });
  for (let i = 0; i < 6; i += 1) {
    const leaf = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 1.1), leafMat);
    leaf.position.y = 6.1;
    leaf.rotation.y = (i / 6) * Math.PI * 2;
    leaf.rotation.x = -0.5;
    leaf.translateX(1.4);
    palm.add(leaf);
  }
  return palm;
}

// AABB collision: true when a circle at (x,z) radius r overlaps any building box.
export function hitsBuilding(colliders, x, z, r) {
  for (const b of colliders) {
    if (x + r > b.minX && x - r < b.maxX && z + r > b.minZ && z - r < b.maxZ) return true;
  }
  return false;
}
export function resolveBuilding(colliders, px, pz, nx, nz, r) {
  // Try the full step, then each axis alone, so the player slides along walls.
  if (!hitsBuilding(colliders, nx, nz, r)) return { x: nx, z: nz };
  if (!hitsBuilding(colliders, nx, pz, r)) return { x: nx, z: pz };
  if (!hitsBuilding(colliders, px, nz, r)) return { x: px, z: nz };
  return { x: px, z: pz };
}
