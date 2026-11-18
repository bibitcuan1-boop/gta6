// The four-job chain: Borrowed Wheels, The Package, Heat on the Strip,
// The Bay Job. Stages are steal / goto / pickup / deliver (timed) /
// survive / hold / escape. A golden ring and a tall translucent beam
// mark the current target on the ground.
import * as THREE from 'three';
import { MISSIONS } from './config.js';

export function createMissions(scene) {
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(4, 5.4, 40),
    new THREE.MeshBasicMaterial({ color: 0xffd21a, side: THREE.DoubleSide, transparent: true, opacity: 0.9 }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.1;
  ring.visible = false;
  scene.add(ring);
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(2.2, 2.2, 60, 16, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffd21a, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false }),
  );
  beam.position.y = 30;
  beam.visible = false;
  scene.add(beam);

  const M = {
    index: 0, // next job to start
    doneCount: 0,
    active: null, // { job, stage }
    stageIdx: 0,
    timer: 0,
    holdT: 0,
    kills: 0,
    ring,
    beam,

    currentStage() {
      if (!this.active) return null;
      return this.active.job.stages[this.stageIdx];
    },

    setMarker(x, z) {
      ring.position.x = x;
      ring.position.z = z;
      ring.visible = true;
      beam.position.x = x;
      beam.position.z = z;
      beam.visible = true;
    },
    hideMarker() {
      ring.visible = false;
      beam.visible = false;
    },

    startJob(G, i) {
      if (this.active) return false;
      if (i >= MISSIONS.length) return false;
      const job = MISSIONS[i];
      this.active = { job };
      this.stageIdx = 0;
      this.timer = 0;
      this.holdT = 0;
      this.kills = 0;
      this.index = i;
      G.hud.dialogue(job.giver, job.intro);
      G.audio.jobStart();
      G.hud.toast(`${job.title} — ${job.giver}`);
      if (job.id === 3) {
        // Heat on the Strip opens at three stars of wanted level.
        G.police.stars = 3;
        G.police.escapeT = 0;
        G.hud.setStars(3);
      }
      this.enterStage(G);
      return true;
    },

    enterStage(G) {
      const stage = this.currentStage();
      if (!stage) return;
      this.holdT = 0;
      if (stage.kind === 'deliver') this.timer = stage.time;
      if (stage.kind === 'hold') this.timer = stage.hold;
      if (stage.kind === 'escape') {
        // The Bay Job's escape opens at three stars of wanted level.
        G.police.stars = 3;
        G.police.escapeT = 0;
        G.hud.setStars(3);
        G.hud.banner('3 STARS — LOSE THE COPS');
      }
      if (stage.x !== undefined) this.setMarker(stage.x, stage.z);
      else this.hideMarker();
      this.refreshObjective(G);
    },

    refreshObjective(G) {
      const stage = this.currentStage();
      if (!stage) {
        G.hud.setObjective(this.doneCount >= MISSIONS.length
          ? 'All jobs done — free roam, Palmera Bay is yours'
          : 'Free roam — press N to start a job');
        this.hideMarker();
        return;
      }
      let text = `${this.active.job.title}: ${stage.text}`;
      if (stage.kind === 'deliver') text += ` — ${Math.ceil(this.timer)}s`;
      if (stage.kind === 'hold') text += ` — ${Math.ceil(this.holdT)}/${stage.hold}s`;
      if (stage.kind === 'survive') text += ` — ${this.kills}/${stage.takedowns} down`;
      G.hud.setObjective(text);
    },

    advance(G) {
      this.stageIdx += 1;
      if (this.stageIdx >= this.active.job.stages.length) {
        this.completeJob(G);
      } else {
        this.enterStage(G);
      }
    },

    completeJob(G) {
      const job = this.active.job;
      G.player.cash += job.reward;
      G.audio.jobDone();
      G.hud.banner(`JOB COMPLETE — +$${job.reward}`);
      G.hud.toast(`${job.title} complete. +$${job.reward}`);
      this.doneCount += 1;
      this.active = null;
      this.index = Math.min(MISSIONS.length, this.index + 1);
      this.hideMarker();
      if (this.doneCount >= MISSIONS.length) {
        G.hud.dialogue('Mia Torres', 'We did it. The Bay Job is ours — Palmera Bay is yours now. Don\u2019t waste it, Jax.');
        G.showScreen('done');
        G.mode = 'done';
      } else {
        const next = MISSIONS[this.index];
        G.hud.dialogue(next.giver, `Next job when you're ready: ${next.title}. Press N.`);
      }
      this.refreshObjective(G);
      G.saveGame();
    },

    failJob(G, reason) {
      if (!this.active) return;
      const title = this.active.job.title;
      this.active = null;
      this.hideMarker();
      G.hud.banner(`JOB FAILED — ${reason}`);
      G.hud.toast(`${title} failed: ${reason}. Press N to retry.`);
      G.audio.busted();
      this.refreshObjective(G);
    },

    // The player stole a car: clears the steal stage of job one.
    onCarStolen(G) {
      const stage = this.currentStage();
      if (stage && stage.kind === 'steal') this.advance(G);
    },

    // An officer was taken down: counts toward the survive stage.
    onTakedown(G) {
      const stage = this.currentStage();
      if (stage && stage.kind === 'survive') {
        this.kills += 1;
        this.refreshObjective(G);
        if (this.kills >= stage.takedowns) this.advance(G);
      }
    },

    // The cops were lost: clears survive and escape stages.
    onEscape() {
      const stage = this.currentStage();
      if (!stage) return;
      if (stage.kind === 'survive') this.advance(G);
    },
  };
  return M;
}

// Per-frame mission logic: arrival at markers, timed delivery, holding
// the vault, escaping the heat.
export function updateMissions(G, dt) {
  const M = G.missions;
  if (!M.active) return;
  const stage = M.currentStage();
  if (!stage) return;
  const p = G.player;
  const px = p.inCar && p.car ? p.car.pos.x : p.pos.x;
  const pz = p.inCar && p.car ? p.car.pos.z : p.pos.z;

  if (stage.kind === 'deliver') {
    M.timer -= dt;
    M.refreshObjective(G);
    if (M.timer <= 0) {
      M.failJob(G, 'the buyer walked — too slow');
      return;
    }
  }
  if (stage.kind === 'goto' || stage.kind === 'pickup' || stage.kind === 'deliver') {
    const d = Math.hypot(px - stage.x, pz - stage.z);
    if (d <= stage.radius) {
      if (stage.kind === 'pickup') {
        G.hud.toast('Package secured');
        G.audio.pickup();
      }
      M.advance(G);
      return;
    }
  }
  if (stage.kind === 'hold') {
    const d = Math.hypot(px - stage.x, pz - stage.z);
    if (d <= stage.radius) {
      M.holdT += dt;
      M.refreshObjective(G);
      if (M.holdT >= stage.hold) {
        G.hud.toast('Vault cracked — grab the cash!');
        G.audio.cash();
        M.advance(G);
        return;
      }
    } else {
      if (M.holdT > 0) { M.holdT = 0; M.refreshObjective(G); }
    }
  }
  if (stage.kind === 'escape') {
    // The wanted level must be cleared first (police escape), then the
    // player reaches the safehouse marker.
    if (G.police.stars === 0) {
      const d = Math.hypot(px - stage.x, pz - stage.z);
      if (d <= stage.radius) { M.advance(G); return; }
    }
    M.refreshObjective(G);
  }
  if (stage.kind === 'survive') {
    // Survival also completes if the heat is lost; onEscape handles it.
    M.refreshObjective(G);
  }
}

// Start job four's escape stage: three stars, as the spec demands.
export function startEscapeHeat(G) {
  G.police.stars = 3;
  G.police.escapeT = 0;
  if (G.hud) G.hud.setStars(3);
}
