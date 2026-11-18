// HUD: plain DOM over the canvas, plus the round minimap drawn on a
// 2D canvas. All elements are the ids the page shell provides.
import { ROADS, districtAt } from './config.js';

export function createHud(G) {
  const $ = (id) => document.getElementById(id);
  const el = {
    cash: $('cash'),
    healthFill: $('healthFill'),
    armorFill: $('armorFill'),
    wanted: $('wanted'),
    clock: $('clock'),
    objective: $('objective'),
    banner: $('banner'),
    dialogue: $('dialogue'),
    crosshair: $('crosshair'),
    toast: $('toast'),
    speedo: $('speedo'),
    weapon: $('weapon'),
    minimap: $('minimap'),
    hint: $('hint'),
    status: $('status'),
    hud: $('hud'),
  };
  const mm = el.minimap ? el.minimap.getContext('2d') : null;
  let bannerT = 0;
  let dialogueT = 0;
  let toastT = 0;
  let visible = true;

  function fmtTime(hours) {
    const h = Math.floor(hours) % 24;
    const m = Math.floor((hours % 1) * 60);
    const hh = ((h + 11) % 12) + 1;
    const ap = h < 12 ? 'AM' : 'PM';
    return `${hh}:${String(m).padStart(2, '0')} ${ap}`;
  }

  const H = {
    setStars(n) {
      if (!el.wanted) return;
      let s = '';
      for (let i = 0; i < 5; i += 1) s += i < n ? '★' : '☆';
      el.wanted.textContent = s;
      el.wanted.style.opacity = n > 0 ? '1' : '0.35';
    },
    setObjective(text) {
      if (el.objective) el.objective.textContent = text;
    },
    banner(text) {
      if (!el.banner) return;
      el.banner.textContent = text;
      el.banner.style.opacity = '1';
      bannerT = 2.5;
      this.announce(text);
    },
    dialogue(name, line) {
      if (!el.dialogue) return;
      el.dialogue.innerHTML = `<b>${name}</b> — ${line}`;
      el.dialogue.style.opacity = '1';
      dialogueT = 6;
      this.announce(`${name}: ${line}`);
    },
    toast(text) {
      if (!el.toast) return;
      el.toast.textContent = text;
      el.toast.style.opacity = '1';
      toastT = 3;
    },
    announce(text) {
      if (el.status) el.status.textContent = text;
    },
    toggle() {
      visible = !visible;
      if (el.hud) el.hud.style.display = visible ? '' : 'none';
      return visible;
    },
    get isVisible() { return visible; },

    update(G, dt) {
      const p = G.player;
      if (bannerT > 0) {
        bannerT -= dt;
        if (bannerT <= 0 && el.banner) el.banner.style.opacity = '0';
      }
      if (dialogueT > 0) {
        dialogueT -= dt;
        if (dialogueT <= 0 && el.dialogue) el.dialogue.style.opacity = '0';
      }
      if (toastT > 0) {
        toastT -= dt;
        if (toastT <= 0 && el.toast) el.toast.style.opacity = '0';
      }
      if (el.cash) el.cash.textContent = `$${Math.floor(p.cash)}`;
      if (el.healthFill) el.healthFill.style.width = `${Math.max(0, p.health)}%`;
      if (el.armorFill) el.armorFill.style.width = `${Math.max(0, p.armor)}%`;
      if (el.clock) {
        const district = districtAt(p.inCar && p.car ? p.car.pos.x : p.pos.x, p.inCar && p.car ? p.car.pos.z : p.pos.z);
        el.clock.textContent = `${fmtTime(G.timeHours)} · ${district} · Jobs ${G.missions.doneCount}/4`;
      }
      if (el.crosshair) {
        el.crosshair.style.display = (!p.inCar && G.mode === 'playing') ? 'block' : 'none';
      }
      if (el.speedo) {
        if (p.inCar && p.car) {
          const kmh = Math.round(Math.abs(p.car.speed) * 3.6);
          el.speedo.innerHTML = `${kmh}<span> km/h</span><br><small>${p.car.name}</small>`;
        } else {
          el.speedo.innerHTML = '';
        }
      }
      if (el.weapon) {
        if (!p.inCar) {
          const wname = p.weapon === 'fists' ? 'Fists' : p.weapon === 'pistol' ? 'P9 Pistol' : 'VK-9 SMG';
          el.weapon.textContent = p.weapon === 'fists' ? wname : `${wname}  ${p.mag} / ${p.reserve}`;
        } else {
          el.weapon.textContent = '';
        }
      }
      if (el.hint) {
        el.hint.textContent = p.inCar
          ? 'W/S drive · A/D steer · E exit · C camera · P pause · H hide HUD'
          : 'WASD move · Shift run · Space jump · E enter car · 1 fists · 2 pistol · 3 SMG · R reload · N job · P pause · H hide HUD';
      }
      this.drawMinimap(G);
    },

    drawMinimap(G) {
      if (!mm || !el.minimap) return;
      const S = 168;
      const scale = S / 480; // world -240..240 maps onto the disc
      const toMap = (x, z) => [S / 2 + x * scale, S / 2 + z * scale];
      mm.clearRect(0, 0, S, S);
      mm.save();
      mm.beginPath();
      mm.arc(S / 2, S / 2, S / 2, 0, Math.PI * 2);
      mm.clip();
      // Dark blue background, sea at the bottom edge.
      mm.fillStyle = '#0e2a4a';
      mm.fillRect(0, 0, S, S);
      mm.fillStyle = '#2f7fc8';
      const [, seaY] = toMap(0, 210);
      mm.fillRect(0, seaY, S, S - seaY);
      // Roads as grey lines.
      mm.strokeStyle = '#7d838c';
      mm.lineWidth = 5;
      for (const r of ROADS) {
        const [x1] = toMap(r, 0);
        mm.beginPath(); mm.moveTo(x1, 0); mm.lineTo(x1, S); mm.stroke();
        const [, z1] = toMap(0, r);
        mm.beginPath(); mm.moveTo(0, z1); mm.lineTo(S, z1); mm.stroke();
      }
      // Mission target as a gold dot.
      const stage = G.missions.currentStage();
      if (stage && stage.x !== undefined) {
        const [mx, mz] = toMap(stage.x, stage.z);
        mm.fillStyle = '#ffd21a';
        mm.beginPath(); mm.arc(mx, mz, 5, 0, Math.PI * 2); mm.fill();
      }
      // Traffic grey, police red, officers blue.
      mm.fillStyle = '#b9bec6';
      for (const car of G.cars.traffic) {
        const [x, z] = toMap(car.pos.x, car.pos.z);
        mm.fillRect(x - 1.5, z - 1.5, 3, 3);
      }
      mm.fillStyle = '#ff3333';
      for (const car of G.cars.police) {
        const [x, z] = toMap(car.pos.x, car.pos.z);
        mm.beginPath(); mm.arc(x, z, 3, 0, Math.PI * 2); mm.fill();
      }
      mm.fillStyle = '#3b7dd8';
      for (const off of G.people.officers) {
        if (off.dead) continue;
        const [x, z] = toMap(off.pos.x, off.pos.z);
        mm.beginPath(); mm.arc(x, z, 2.5, 0, Math.PI * 2); mm.fill();
      }
      // The player: a white arrow that rotates with facing.
      const p = G.player;
      const px = p.inCar && p.car ? p.car.pos.x : p.pos.x;
      const pz = p.inCar && p.car ? p.car.pos.z : p.pos.z;
      const yaw = p.inCar && p.car ? p.car.yaw : p.yaw;
      const [mx, mz] = toMap(px, pz);
      mm.save();
      mm.translate(mx, mz);
      mm.rotate(-yaw);
      mm.fillStyle = '#ffffff';
      mm.beginPath();
      mm.moveTo(0, -7); mm.lineTo(5, 5); mm.lineTo(-5, 5); mm.closePath();
      mm.fill();
      mm.restore();
      // North at the top.
      mm.fillStyle = '#ffffff';
      mm.font = 'bold 11px system-ui, sans-serif';
      mm.textAlign = 'center';
      mm.fillText('N', S / 2, 12);
      mm.restore();
    },
  };
  return H;
}
