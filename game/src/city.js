// The city: ground, sea and beach, 7x7 blocks of towers with lit-window
// textures, palms, street lights, the Palmera Trust tower, the lighthouse,
// drifting clouds, and the axis-aligned collision boxes everything else
// resolves against.
import * as THREE from 'three';
import { BUILDING_COLORS, CFG, ROADS, ROOF_COLORS } from './config.js';

// A small canvas texture: white base, a grid of small windows, about a
// third of them lit warm yellow, the rest dark blue-grey.
function windowTexture(rng) {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#e8e6df';
  g.fillRect(0, 0, 128, 256);
  for (let y = 8; y < 248; y += 18) {
    for (let x = 8; x < 120; x += 16) {
      g.fillStyle = rng.chance(0.33) ? '#ffd76a' : '#2e4256';
      g.fillRect(x, y, 10, 12);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function makePalm(rng) {
  const group = new THREE.Group();
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x7a5230 });
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.24, 6, 6), trunkMat);
  trunk.position.y = 3;
  trunk.rotation.z = (rng.next() - 0.5) * 0.18;
  group.add(trunk);
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x2fae5f, side: THREE.DoubleSide });
  for (let i = 0; i < 6; i += 1) {
    const leaf = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 0.9), leafMat);
    const a = (i / 6) * Math.PI * 2;
    leaf.position.set(Math.cos(a) * 1.4, 6.1, Math.sin(a) * 1.4);
    leaf.rotation.y = -a + Math.PI / 2;
    leaf.rotation.x = -0.5;
    group.add(leaf);
  }
  return group;
}

export function buildCity(scene, rng) {
  const colliders = [];
  const clouds = [];
  const winTex = windowTexture(rng);

  scene.background = new THREE.Color(0x9fc8e8);
  scene.fog = new THREE.Fog(0x9fc8e8, 180, 520);

  const sun = new THREE.DirectionalLight(0xfff2d0, 1.6);
  sun.position.set(120, 200, 80);
  scene.add(sun);
  scene.add(new THREE.AmbientLight(0xffffff, 0.55));
  scene.add(new THREE.HemisphereLight(0xbdd8f0, 0x6f8f5f, 0.5));

  // Ground: one large green slab; the sea sits south of the city edge.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(900, 900),
    new THREE.MeshLambertMaterial({ color: 0x5da24a }),
  );
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  const beach = new THREE.Mesh(
    new THREE.PlaneGeometry(900, 26),
    new THREE.MeshLambertMaterial({ color: 0xe8d8a0 }),
  );
  beach.rotation.x = -Math.PI / 2;
  beach.position.set(0, 0.02, 223);
  scene.add(beach);

  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(900, 400),
    new THREE.MeshLambertMaterial({ color: 0x2f7fc8 }),
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(0, 0.01, 436);
  scene.add(sea);

  // Road ribbons along every centre line, both directions.
  const roadMat = new THREE.MeshLambertMaterial({ color: 0x3c4148 });
  for (const r of ROADS) {
    const ns = new THREE.Mesh(new THREE.PlaneGeometry(CFG.roadWidth, 430), roadMat);
    ns.rotation.x = -Math.PI / 2;
    ns.position.set(r, 0.03, 0);
    scene.add(ns);
    const ew = new THREE.Mesh(new THREE.PlaneGeometry(430, CFG.roadWidth), roadMat);
    ew.rotation.x = -Math.PI / 2;
    ew.position.set(0, 0.03, r);
    scene.add(ew);
  }

  const sidewalkMat = new THREE.MeshLambertMaterial({ color: 0xb9b3a4 });
  const towerGeoCache = new Map();
  function towerGeo(w, h, d) {
    const key = `${w}|${h}|${d}`;
    if (!towerGeoCache.has(key)) towerGeoCache.set(key, new THREE.BoxGeometry(w, h, d));
    return towerGeoCache.get(key);
  }

  // Blocks: block centres sit halfway between road lines.
  const blockCentres = [];
  for (let i = 0; i < 6; i += 1) {
    for (let j = 0; j < 6; j += 1) {
      blockCentres.push({ x: -150 + i * 60, z: -150 + j * 60 });
    }
  }
  // The grid is 7 roads a side, so blocks run -150..150 on a 60 pitch.
  for (const bc of blockCentres) {
    const walk = new THREE.Mesh(new THREE.PlaneGeometry(50, 50), sidewalkMat);
    walk.rotation.x = -Math.PI / 2;
    walk.position.set(bc.x, 0.04, bc.z);
    scene.add(walk);

    const downtown = Math.abs(bc.x) <= 60 && Math.abs(bc.z) <= 60;
    const count = downtown ? rng.int(2, 3) : rng.int(1, 2);
    // Towers sit toward the block corners, one per quadrant, so the
    // middle of each block stays open as a plaza a car can cross.
    const quads = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
    for (let i = quads.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rng.next() * (i + 1));
      const tmp = quads[i]; quads[i] = quads[j]; quads[j] = tmp;
    }
    for (let t = 0; t < count; t += 1) {
      const w = rng.range(10, 18);
      const d = rng.range(10, 18);
      const h = downtown ? rng.range(28, 64) : rng.range(8, 26);
      const qx = quads[t][0];
      const qz = quads[t][1];
      // Inner face stays 3.5 m clear of the block centre lines.
      const ox = qx * (w / 2 + 3.5);
      const oz = qz * (d / 2 + 3.5);
      const x = bc.x + ox;
      const z = bc.z + oz;
      const mat = new THREE.MeshLambertMaterial({ color: rng.pick(BUILDING_COLORS), map: winTex });
      const tower = new THREE.Mesh(towerGeo(w, h, d), mat);
      tower.position.set(x, h / 2, z);
      scene.add(tower);
      const roof = new THREE.Mesh(
        new THREE.BoxGeometry(w + 0.6, 0.8, d + 0.6),
        new THREE.MeshLambertMaterial({ color: rng.pick(ROOF_COLORS) }),
      );
      roof.position.set(x, h + 0.4, z);
      scene.add(roof);
      if (h > 40) {
        const beacon = new THREE.Mesh(
          new THREE.SphereGeometry(0.7, 8, 8),
          new THREE.MeshBasicMaterial({ color: 0xff2222 }),
        );
        beacon.position.set(x, h + 1.4, z);
        scene.add(beacon);
      }
      colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
    }

    // Palm trees on block corners, a little over half the time.
    if (rng.chance(0.55)) {
      const palm = makePalm(rng);
      const cx = bc.x + (rng.chance(0.5) ? -21 : 21);
      const cz = bc.z + (rng.chance(0.5) ? -21 : 21);
      palm.position.set(cx, 0, cz);
      scene.add(palm);
    }
  }

  // Street lights line the roads every sixty metres.
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x2b2f36 });
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xffd76a });
  for (const r of ROADS) {
    for (let s = -180; s <= 180; s += 60) {
      for (const [x, z] of [[r + 8, s], [s, r + 8]]) {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 7, 6), poleMat);
        pole.position.set(x, 3.5, z);
        scene.add(pole);
        const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 8), lampMat);
        lamp.position.set(x, 7.1, z);
        scene.add(lamp);
      }
    }
  }

  // Landmark: the golden Palmera Trust tower, downtown.
  const trust = new THREE.Mesh(
    new THREE.BoxGeometry(26, 78, 26),
    new THREE.MeshLambertMaterial({ color: 0xd8a928, map: winTex }),
  );
  trust.position.set(0, 39, 0);
  scene.add(trust);
  const trustRoof = new THREE.Mesh(
    new THREE.BoxGeometry(27, 1.2, 27),
    new THREE.MeshLambertMaterial({ color: 0x6b4d12 }),
  );
  trustRoof.position.set(0, 78.6, 0);
  scene.add(trustRoof);
  colliders.push({ minX: -13, maxX: 13, minZ: -13, maxZ: 13 });

  // Landmark: white lighthouse on the south-west shore, glowing top.
  const light = new THREE.Mesh(
    new THREE.CylinderGeometry(3, 4.5, 26, 10),
    new THREE.MeshLambertMaterial({ color: 0xf5f0e6 }),
  );
  light.position.set(-195, 13, 210);
  scene.add(light);
  const lampTop = new THREE.Mesh(
    new THREE.SphereGeometry(2.2, 10, 10),
    new THREE.MeshBasicMaterial({ color: 0xfff2a0 }),
  );
  lampTop.position.set(-195, 27.5, 210);
  scene.add(lampTop);

  // Fourteen flat cloud blobs, each three flattened spheres, drifting.
  const cloudMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  for (let i = 0; i < 14; i += 1) {
    const cloud = new THREE.Group();
    for (let j = 0; j < 3; j += 1) {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(rng.range(6, 11), 8, 8), cloudMat);
      puff.scale.y = 0.35;
      puff.position.set(j * rng.range(7, 10) - 9, rng.range(-1, 1), rng.range(-3, 3));
      cloud.add(puff);
    }
    cloud.position.set(rng.range(-220, 220), rng.range(70, 110), rng.range(-220, 220));
    cloud.userData.speed = rng.range(0.6, 1.6);
    scene.add(cloud);
    clouds.push(cloud);
  }

  return {
    colliders,
    clouds,
    update(dt) {
      for (const c of clouds) {
        c.position.x += c.userData.speed * dt;
        if (c.position.x > 260) c.position.x = -260;
      }
    },
  };
}

// Axis-aligned collision: try the full step, then each axis alone, so
// the walker slides along walls instead of sticking to them.
export function moveWithCollision(pos, dx, dz, radius, colliders) {
  const nx = pos.x + dx;
  const nz = pos.z + dz;
  if (!hits(nx, nz, radius, colliders)) { pos.x = nx; pos.z = nz; return; }
  if (!hits(nx, pos.z, radius, colliders)) { pos.x = nx; return; }
  if (!hits(pos.x, nz, radius, colliders)) { pos.z = nz; }
}

function hits(x, z, radius, colliders) {
  for (const c of colliders) {
    if (x + radius > c.minX && x - radius < c.maxX && z + radius > c.minZ && z - radius < c.maxZ) return true;
  }
  return false;
}

// Nearest road centre line to a coordinate.
export function nearestRoad(v) {
  let best = ROADS[0];
  let bd = Infinity;
  for (const r of ROADS) {
    const d = Math.abs(v - r);
    if (d < bd) { bd = d; best = r; }
  }
  return best;
}
