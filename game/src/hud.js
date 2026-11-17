// HUD and minimap: every DOM readout plus the round top-down minimap canvas.
// The HUD never owns game state — it only renders what main hands it each frame.
import { districtAt, CITY_HALF, roadCentres } from './config.js';
import { wantedLabel } from './police.js';

export function createHud() {
  const $ = (id) => document.getElementById(id);
  const els = {
    cash: $('cash'), health: $('healthFill'), armor: $('armorFill'),
    wanted: $('wanted'), clock: $('clock'), objective: $('objective'),
    banner: $('banner'), dialogue: $('dialogue'), crosshair: $('crosshair'),
    toast: $('toast'), speedo: $('speedo'), weapon: $('weapon'),
    hint: $('hint'), minimap: $('minimap'), status: $('status'),
    title: $('screenTitle'), pause: $('screenPause'), busted: $('screenBusted'),
    wasted: $('screenWasted'), done: $('screenDone'), saveInfo: $('saveInfo'),
  };
  let bannerTimer = null;
  let dialogueTimer = null;
  let toastTimer = null;

  function show(el, on) { if (el) el.style.display = on ? '' : 'none'; }

  return {
    els,
    banner(text) {
      els.banner.textContent = text;
      show(els.banner, true);
      clearTimeout(bannerTimer);
      bannerTimer = setTimeout(() => show(els.banner, false), 2600);
    },
    say(who, text) {
      els.dialogue.innerHTML = `<span class="who">${who}:</span> ${text.replace(/^[^:]*:\s*/, '')}`;
      show(els.dialogue, true);
      clearTimeout(dialogueTimer);
      dialogueTimer = setTimeout(() => show(els.dialogue, false), 6000);
    },
    toast(text) {
      els.toast.textContent = text;
      show(els.toast, true);
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => show(els.toast, false), 3200);
    },
    announce(text) { els.status.textContent = text; },
    setScreen(name) {
      show(els.title, name === 'title');
      show(els.pause, name === 'pause');
      show(els.busted, name === 'busted');
      show(els.wasted, name === 'wasted');
      show(els.done, name === 'done');
    },
    render(game, dt) {
      const p = game.player;
      els.cash.textContent = `$${Math.floor(p.cash).toLocaleString('en-US')}`;
      els.health.style.width = `${Math.max(0, p.health)}%`;
      els.armor.style.width = `${Math.max(0, p.armor)}%`;
      const stars = game.wanted.stars;
      els.wanted.innerHTML = stars > 0
        ? `<span>${'★'.repeat(stars)}</span><span class="dim">${'★'.repeat(5 - stars)}</span>`
        : `<span class="dim">☆☆☆☆☆</span>`;
      const hours = Math.floor(game.dayTime) % 24;
      const mins = Math.floor((game.dayTime % 1) * 60);
      const hh = String(hours).padStart(2, '0');
      const mm = String(mins).padStart(2, '0');
      els.clock.textContent = `${hh}:${mm}  •  ${districtAt(p.x, p.z)}  •  ${game.mission.completedCount}/4 jobs done`;
      els.objective.innerHTML = `<b>MISSION</b> — ${game.objectiveText}`;
      show(els.crosshair, game.screen === 'play' && !p.car);
      if (p.car) {
        const kmh = Math.round(Math.abs(p.car.speed) * 3.6);
        els.speedo.innerHTML = `<span class="big">${kmh}</span> km/h<br>${p.car.name}<br><span style="color:#ffd23e">E — exit car</span>`;
      } else {
        els.speedo.innerHTML = '';
      }
      els.weapon.innerHTML = p.car ? '' : `${game.combat.weapon === 'fists' ? 'Fists' : game.combat.weapon.toUpperCase()} — ${game.combat.ammo} / ${game.combat.reserve} &nbsp;•&nbsp; R reload`;
      els.hint.innerHTML = p.car
        ? 'W/S drive &nbsp;•&nbsp; A/D steer &nbsp;•&nbsp; E exit &nbsp;•&nbsp; C camera &nbsp;•&nbsp; P pause'
        : 'WASD move &nbsp;•&nbsp; SHIFT run &nbsp;•&nbsp; E steal car &nbsp;•&nbsp; CLICK shoot &nbsp;•&nbsp; F punch &nbsp;•&nbsp; N next job';
      this.drawMinimap(game);
    },
    drawMinimap(game) {
      const cv = els.minimap;
      const g = cv.getContext('2d');
      const S = 168;
      const scale = S / (CITY_HALF * 2 + 90);
      const toMap = (x, z) => [S / 2 + x * scale, S / 2 + z * scale];
      g.clearRect(0, 0, S, S);
      g.fillStyle = '#0e2438';
      g.fillRect(0, 0, S, S);
      // Sea at the bottom edge.
      g.fillStyle = '#1f7fa8';
      const [, seaY] = toMap(0, CITY_HALF + 10);
      g.fillRect(0, seaY, S, S - seaY);
      // Roads.
      g.strokeStyle = '#5a6b7d';
      g.lineWidth = 4;
      const centres = roadCentres();
      for (const c of centres) {
        const [x1, y1] = toMap(c, -CITY_HALF - 20);
        const [x2, y2] = toMap(c, CITY_HALF + 20);
        g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
        const [ax1, ay1] = toMap(-CITY_HALF - 20, c);
        const [ax2, ay2] = toMap(CITY_HALF + 20, c);
        g.beginPath(); g.moveTo(ax1, ay1); g.lineTo(ax2, ay2); g.stroke();
      }
      const dot = (x, z, color, r) => {
        const [mx, my] = toMap(x, z);
        g.fillStyle = color;
        g.beginPath(); g.arc(mx, my, r, 0, Math.PI * 2); g.fill();
      };
      // Mission marker.
      const target = game.missionTarget;
      if (target) dot(target.x, target.z, '#ffd23e', 6);
      // Traffic (grey), police (blue/red), player (white arrow).
      for (const car of game.cars) {
        if (car.isPolice) continue;
        dot(car.x, car.z, '#9fb8cc', 2);
      }
      for (const car of game.wanted.policeCars) dot(car.x, car.z, '#ff4444', 3);
      for (const cop of game.wanted.cops) if (!cop.dead) dot(cop.x, cop.z, '#4488ff', 2);
      const [px, py] = toMap(game.player.x, game.player.z);
      g.save();
      g.translate(px, py);
      g.rotate(game.player.angle);
      g.fillStyle = '#ffffff';
      g.strokeStyle = '#111';
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(0, -7); g.lineTo(5, 6); g.lineTo(-5, 6); g.closePath();
      g.fill(); g.stroke();
      g.restore();
      // North tick.
      g.fillStyle = '#fff';
      g.font = 'bold 11px Arial';
      g.fillText('N', S / 2 - 4, 12);
      void wantedLabel;
    },
  };
}
