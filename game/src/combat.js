// Combat: fists, pistol and SMG, raycast shooting from the crosshair,
// glowing tracers, pickups, and damage to the player through armor.
import * as THREE from 'three';
import { PICKUPS, PICKUP_STYLE, WEAPONS } from './config.js';

export function createCombat(scene) {
  const raycaster = new THREE.Raycaster();
  const tracers = [];
  const pickups = [];

  // Pickups at the eight fixed spots: spinning coloured shapes about a
  // metre above the ground.
  for (const spot of PICKUPS) {
    const style = PICKUP_STYLE[spot.kind];
    let mesh;
    if (style.shape === 'cyl') {
      mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.35, 12),
        new THREE.MeshLambertMaterial({ color: style.color, emissive: style.color, emissiveIntensity: 0.35 }));
    } else if (style.shape === 'flat') {
      mesh = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.18, 0.4),
        new THREE.MeshLambertMaterial({ color: style.color, emissive: style.color, emissiveIntensity: 0.35 }));
    } else {
      mesh = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 0.7),
        new THREE.MeshLambertMaterial({ color: style.color, emissive: style.color, emissiveIntensity: 0.35 }));
    }
    mesh.position.set(spot.x, 1.1, spot.z);
    scene.add(mesh);
    pickups.push({ kind: spot.kind, mesh, taken: false, phase: Math.random() * Math.PI * 2 });
  }

  function hittables(G) {
    const list = [];
    for (const ped of G.people.peds) {
      if (!ped.dead) {
        ped.torso.userData.hit = { type: 'ped', ref: ped };
        list.push(ped.torso);
      }
    }
    for (const off of G.people.officers) {
      if (!off.dead) {
        off.torso.userData.hit = { type: 'officer', ref: off };
        list.push(off.torso);
      }
    }
    for (const car of G.cars.all) {
      if (!car.wrecked) {
        car.bodyMesh.userData.hit = { type: car.isPolice ? 'policeCar' : 'car', ref: car };
        list.push(car.bodyMesh);
      }
    }
    return list;
  }

  function addTracer(G, from, to) {
    const geo = new THREE.BufferGeometry().setFromPoints([from.clone(), to.clone()]);
    const mat = new THREE.LineBasicMaterial({ color: 0xffe14d, transparent: true, opacity: 1 });
    const line = new THREE.Line(geo, mat);
    G.scene.add(line);
    tracers.push({ line, t: 0.07 });
  }

  function applyHit(G, hit, damage, point) {
    if (hit.type === 'ped') {
      const ped = hit.ref;
      ped.health -= damage;
      if (ped.health <= 0 && !ped.dead) {
        ped.dead = true;
        ped.group.visible = false;
        G.police.addStar(G, 1);
        G.hud.toast(`${ped.name} is down — the cops noticed`);
      } else if (!ped.dead) {
        G.police.addStar(G, 1);
        G.hud.toast('You hit a bystander!');
      }
    } else if (hit.type === 'officer') {
      const off = hit.ref;
      off.health -= damage;
      if (off.health <= 0 && !off.dead) {
        off.dead = true;
        off.group.visible = false;
        G.police.addStar(G, 1);
        G.hud.toast('Officer down');
        G.missions.onTakedown(G);
      }
    } else if (hit.type === 'policeCar' || hit.type === 'car') {
      const car = hit.ref;
      car.health -= damage;
      if (car.health <= 0 && !car.wrecked) {
        wreckCar(G, car);
        if (car.isPolice) {
          G.police.addStar(G, 1);
          G.hud.toast('Police car destroyed!');
        }
      }
    }
  }

  function wreckCar(G, car) {
    car.wrecked = true;
    car.speed = 0;
    car.group.rotation.z = 0.25;
    G.hud.banner('CAR WRECKED');
    G.audio.crash();
    if (G.player.inCar && G.player.car === car) {
      // The player is put back on foot beside the wreck.
      exitCar(G);
    }
  }

  function exitCar(G) {
    const p = G.player;
    if (!p.car) return;
    const car = p.car;
    p.pos.set(car.pos.x + 3, 0, car.pos.z + 3);
    p.yaw = car.yaw;
    p.inCar = false;
    p.car = null;
    p.group.visible = true;
  }

  return {
    tracers,
    pickups,
    wreckCar: (G, car) => wreckCar(G, car),
    exitCar: (G) => exitCar(G),

    // Armor absorbs 60% of each hit until it is gone, then health takes it.
    damagePlayer(G, amount) {
      const p = G.player;
      if (p.health <= 0 || G.mode !== 'playing') return;
      let rest = amount;
      if (p.armor > 0) {
        const absorbed = Math.min(p.armor, amount * 0.6);
        p.armor -= absorbed;
        rest = amount - absorbed;
      }
      p.health -= rest;
      if (p.health <= 0) {
        p.health = 0;
        G.onWasted();
      }
    },

    tryShoot(G) {
      const p = G.player;
      const w = WEAPONS[p.weapon];
      if (p.fireT > 0 || p.reloadT > 0) return;
      if (p.weapon === 'fists') { this.punch(G); return; }
      if (p.mag <= 0) {
        G.hud.toast('Press R to reload');
        return;
      }
      p.fireT = w.rate;
      p.mag -= 1;
      G.audio.shot();
      raycaster.setFromCamera({ x: 0, y: 0 }, G.camera);
      raycaster.far = w.range;
      const hits = raycaster.intersectObjects(hittables(G), false);
      const muzzle = G.camera.position.clone();
      let end;
      if (hits.length > 0) {
        const h = hits[0];
        end = h.point.clone();
        applyHit(G, h.object.userData.hit, w.damage, end);
      } else {
        end = muzzle.clone().add(new THREE.Vector3(0, 0, -1).applyQuaternion(G.camera.quaternion).multiplyScalar(w.range));
      }
      addTracer(G, muzzle, end);
      G.player.lastShotT = 0;
    },

    punch(G) {
      const p = G.player;
      if (p.fireT > 0) return;
      p.fireT = WEAPONS.fists.rate;
      G.audio.punch();
      const f = { x: -Math.sin(p.yaw), z: -Math.cos(p.yaw) };
      for (const ped of G.people.peds) {
        if (ped.dead) continue;
        const dx = ped.pos.x - p.pos.x;
        const dz = ped.pos.z - p.pos.z;
        const d = Math.hypot(dx, dz);
        if (d < 2.2 && (dx * f.x + dz * f.z) > 0) {
          applyHit(G, { type: 'ped', ref: ped }, WEAPONS.fists.damage);
        }
      }
      for (const off of G.people.officers) {
        if (off.dead) continue;
        const dx = off.pos.x - p.pos.x;
        const dz = off.pos.z - p.pos.z;
        const d = Math.hypot(dx, dz);
        if (d < 2.2 && (dx * f.x + dz * f.z) > 0) {
          applyHit(G, { type: 'officer', ref: off }, WEAPONS.fists.damage);
        }
      }
    },

    reload(G) {
      const p = G.player;
      const w = WEAPONS[p.weapon];
      if (!w || !Number.isFinite(w.mag) || p.mag >= w.mag || p.reserve <= 0 || p.reloadT > 0) return;
      p.reloadT = 0.9;
      G.audio.reload();
    },

    finishReload(G) {
      const p = G.player;
      const w = WEAPONS[p.weapon];
      if (!w || !Number.isFinite(w.mag)) return;
      const need = w.mag - p.mag;
      const take = Math.min(need, p.reserve);
      p.mag += take;
      p.reserve -= take;
    },

    update(G, dt) {
      for (let i = tracers.length - 1; i >= 0; i -= 1) {
        const tr = tracers[i];
        tr.t -= dt;
        tr.line.material.opacity = Math.max(0, tr.t / 0.07);
        if (tr.t <= 0) {
          G.scene.remove(tr.line);
          tr.line.geometry.dispose();
          tr.line.material.dispose();
          tracers.splice(i, 1);
        }
      }
      // Pickups bob, spin, and get collected within two metres.
      const p = G.player;
      const px = p.inCar && p.car ? p.car.pos.x : p.pos.x;
      const pz = p.inCar && p.car ? p.car.pos.z : p.pos.z;
      for (const pk of pickups) {
        if (pk.taken) continue;
        pk.phase += dt * 2;
        pk.mesh.rotation.y += dt * 1.5;
        pk.mesh.position.y = 1.1 + Math.sin(pk.phase) * 0.15;
        const d = Math.hypot(pk.mesh.position.x - px, pk.mesh.position.z - pz);
        if (d < 2) {
          pk.taken = true;
          pk.mesh.visible = false;
          if (pk.kind === 'health') { p.health = Math.min(100, p.health + 50); G.hud.toast('Health +50'); }
          if (pk.kind === 'armor') { p.armor = Math.min(100, p.armor + 50); G.hud.toast('Armor +50'); }
          if (pk.kind === 'cash') { p.cash += 150; G.hud.toast('+$150'); G.audio.cash(); }
          if (pk.kind === 'smg') { p.hasSmg = true; G.hud.toast('VK-9 SMG picked up — press 3'); G.audio.pickup(); }
          if (pk.kind === 'ammo') { p.reserve += 48; G.hud.toast('Ammo +48'); G.audio.pickup(); }
          if (pk.kind === 'health' || pk.kind === 'armor') G.audio.pickup();
        }
      }
    },
  };
}
