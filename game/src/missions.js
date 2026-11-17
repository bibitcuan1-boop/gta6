// Missions and story: the four-job chain, objectives, timers, dialogue and rewards.
// The runner only reads the MISSIONS table from config and the live game state;
// it never touches the renderer directly except through the marker it owns.
import * as THREE from 'three';
import { MISSIONS } from './config.js';

export function createMissionState() {
  return {
    index: 0, // 0-based into MISSIONS; -1 means the story is finished
    stage: 0,
    active: false,
    timer: 0,
    hold: 0,
    takedowns: 0,
    done: false,
    marker: null,
    beacon: null,
    completedCount: 0,
  };
}

export function currentMission(m) {
  if (m.index < 0 || m.index >= MISSIONS.length) return null;
  return MISSIONS[m.index];
}
export function currentStage(m) {
  const mission = currentMission(m);
  if (!mission) return null;
  return mission.stages[m.stage] || null;
}
export function objectiveText(m) {
  const mission = currentMission(m);
  const stage = currentStage(m);
  if (!mission || !stage) return m.done ? 'Story complete — free roam. Earn cash, dodge the law.' : 'Talk to Mia: press N to start the next job.';
  let text = stage.text;
  if (stage.timeLimit) text += ` (${Math.max(0, Math.ceil(m.timer))}s left)`;
  if (stage.kind === 'hold' && m.hold > 0) text += ` (${Math.floor(m.hold)}s / ${stage.holdTime}s)`;
  if (stage.kind === 'survive') text += ` — ${m.takedowns}/${stage.need} officers down`;
  return `${mission.title} — ${text}`;
}

export function makeMarker(scene) {
  const group = new THREE.Group();
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(4, 5.2, 32),
    new THREE.MeshBasicMaterial({ color: 0xffd23e, side: THREE.DoubleSide, transparent: true, opacity: 0.85 }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.25;
  group.add(ring);
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(1.1, 1.1, 42, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffd23e, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false }),
  );
  beam.position.y = 21;
  group.add(beam);
  group.visible = false;
  scene.add(group);
  return group;
}

export function startMission(m, scene, hud) {
  const mission = currentMission(m);
  if (!mission) return false;
  m.active = true;
  m.stage = 0;
  m.timer = 0;
  m.hold = 0;
  m.takedowns = 0;
  if (!m.marker) m.marker = makeMarker(scene);
  hud.say(mission.giver, mission.intro);
  hud.banner(mission.title);
  hud.toast(`New job: ${mission.title} — $${mission.reward}`);
  placeMarker(m);
  return true;
}

export function placeMarker(m) {
  const stage = currentStage(m);
  if (!m.marker) return;
  if (stage && stage.target) {
    m.marker.position.set(stage.target.x, 0, stage.target.z);
    m.marker.visible = true;
  } else {
    m.marker.visible = false;
  }
}

export function advanceStage(m, hud) {
  m.stage += 1;
  m.timer = 0;
  m.hold = 0;
  const stage = currentStage(m);
  if (stage && stage.timeLimit) m.timer = stage.timeLimit;
  placeMarker(m);
  if (!stage) completeMission(m, hud);
}

export function completeMission(m, hud) {
  const mission = currentMission(m);
  if (!mission) return;
  m.completedCount += 1;
  m.active = false;
  m.paidReward = mission.reward;
  if (m.marker) m.marker.visible = false;
  hud.banner(`JOB COMPLETE — +$${mission.reward}`);
  hud.toast(`Job complete! +$${mission.reward}`);
  m.index += 1;
  if (m.index >= MISSIONS.length) {
    m.done = true;
    m.index = -1;
    hud.say('Mia Torres', 'Mia: "We did it, Jax. The Bay Job is ours. Palmera Bay is yours now — don\'t waste it."');
  } else {
    const next = MISSIONS[m.index];
    hud.say(next.giver, `Next job ready: ${next.title}. Press N when you are ready.`);
  }
}

export function failMission(m, hud, reason) {
  m.active = false;
  m.stage = 0;
  m.timer = 0;
  m.hold = 0;
  if (m.marker) m.marker.visible = false;
  hud.banner('JOB FAILED');
  hud.say('Mia Torres', `Mia: "${reason} Press N to try the job again."`);
}

// Called every frame while a mission is active. Returns 'complete' / 'failed' / null
// through the events callbacks, and mutates cash / wanted via the game object.
export function updateMission(m, dt, game, hud, events) {
  const mission = currentMission(m);
  const stage = currentStage(m);
  if (!mission || !stage || !m.active) return;
  const p = game.player;
  if (stage.timeLimit) {
    m.timer -= dt;
    if (m.timer <= 0) {
      failMission(m, hud, 'Too slow — the buyer walked away.');
      return;
    }
  }
  const atTarget = stage.target
    ? Math.hypot(p.x - stage.target.x, p.z - stage.target.z) < (stage.radius || 8)
    : false;
  switch (stage.kind) {
    case 'steal':
      if (p.car) advanceStage(m, hud);
      break;
    case 'goto':
    case 'deliver':
      if (atTarget) advanceStage(m, hud);
      break;
    case 'pickup':
      if (atTarget) advanceStage(m, hud);
      break;
    case 'hold':
      if (atTarget) {
        m.hold += dt;
        if (m.hold >= (stage.holdTime || 5)) advanceStage(m, hud);
      } else {
        m.hold = Math.max(0, m.hold - dt * 2);
      }
      break;
    case 'survive': {
      const escaped = game.wanted.stars === 0 && m.takedowns < (stage.need || 4);
      if (m.takedowns >= (stage.need || 4)) advanceStage(m, hud);
      else if (escaped && game.wanted.stars === 0 && game.missionHeatStarted) advanceStage(m, hud);
      break;
    }
    case 'escape':
      if (game.wanted.stars === 0 && atTarget) advanceStage(m, hud);
      break;
    default:
      break;
  }
  // Mission 3 opens with heat; mission 4 escalates to 3 stars at the vault.
  if (mission.id === 3 && m.stage === 0 && !game.missionHeatStarted) {
    game.missionHeatStarted = true;
    events.setWanted(3);
    hud.say('Dante Cole', 'Dante: "Here they come. Three stars, Jax — make it count."');
  }
  if (mission.id === 4 && m.stage === 2 && game.wanted.stars < 3) {
    events.setWanted(3);
  }
}

export function missionTarget(m) {
  const stage = currentStage(m);
  return stage && stage.target ? { x: stage.target.x, z: stage.target.z } : null;
}
