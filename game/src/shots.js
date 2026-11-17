// Staged screenshot scenes behind ?shot=<name>.
// Each one drives the real game into a fixed, readable state and paints it twice,
// then sets window.__shotReady so the screenshot tool knows the frame is done.
// ?shot=start  title screen over the city at golden hour
// ?shot=drive  Jax driving a Comet GT down the Strip, HUD + minimap live
// ?shot=chase  three-star police chase with sirens and a roadblock feel
// ?shot=mission  Job 2 in progress: the package marker, timer and objective on screen
import { MISSIONS } from './config.js';
import { addWanted, spawnPoliceCar } from './police.js';
import { startMission } from './missions.js';

export function stageShot(name, game) {
  const g = game;
  g.screen = 'play';
  g.hud.setScreen('none');
  if (name === 'start') {
    g.screen = 'title';
    g.hud.setScreen('title');
    g.player.x = -40; g.player.z = 60;
    g.player.camYaw = Math.PI * 0.85;
    g.camera.position.set(-40, 26, 120);
    g.camera.lookAt(0, 12, 0);
    return { screen: 'title' };
  }
  // The three play shots share a live, populated street.
  g.player.cash = 2450;
  g.player.health = 86;
  g.player.armor = 40;
  if (name === 'drive') {
    const car = g.cars.find((c) => !c.isTraffic && !c.isPolice);
    if (car) {
      car.x = -90; car.z = 30; car.angle = Math.PI; car.speed = 18;
      g.player.car = car;
      g.player.x = car.x; g.player.z = car.z;
      g.player.mesh.visible = false;
    }
    g.objectiveText = 'Free roam — explore Palmera Bay. Press N to start Job 1: Borrowed Wheels.';
    g.missionTarget = null;
  } else if (name === 'chase') {
    const car = g.cars.find((c) => !c.isTraffic && !c.isPolice);
    if (car) {
      car.x = 30; car.z = -90; car.angle = 0; car.speed = 24;
      g.player.car = car;
      g.player.x = car.x; g.player.z = car.z;
      g.player.mesh.visible = false;
    }
    addWanted(g.wanted, 3, 'shot');
    // Three interceptors in frame on the same road, closing from behind.
    const p1 = spawnPoliceCar(g.scene, g.wanted, 30, -90, { range: () => 0 });
    p1.x = 30; p1.z = -108; p1.angle = 0; p1.speed = 26;
    const p2 = spawnPoliceCar(g.scene, g.wanted, 30, -90, { range: () => 0 });
    p2.x = 26; p2.z = -122; p2.angle = 0.1; p2.speed = 24;
    const p3 = spawnPoliceCar(g.scene, g.wanted, 30, -90, { range: () => 0 });
    p3.x = 34; p3.z = -135; p3.angle = -0.1; p3.speed = 22;
    g.dayTime = 17.5;
    g.objectiveText = 'WANTED ★★★ — lose the Bay PD! Outrun them or break line of sight.';
    g.missionTarget = null;
    g.hud.banner('WANTED — 3 STARS');
  } else if (name === 'mission') {
    // Start Job 2 for real, then jump its first stage forward to the timed delivery.
    g.mission.index = 1;
    startMission(g.mission, g.scene, g.hud);
    g.mission.stage = 1;
    g.mission.timer = 74;
    g.mission.active = true;
    const car = g.cars.find((c) => !c.isTraffic && !c.isPolice);
    if (car) {
      car.x = 90; car.z = -90; car.angle = Math.PI * 0.75; car.speed = 16;
      g.player.car = car;
      g.player.x = car.x; g.player.z = car.z;
      g.player.mesh.visible = false;
    }
    const stage = MISSIONS[1].stages[1];
    if (g.mission.marker) {
      g.mission.marker.position.set(stage.target.x, 0, stage.target.z);
      g.mission.marker.visible = true;
    }
    g.missionTarget = { x: stage.target.x, z: stage.target.z };
    g.objectiveText = `Job 2 — The Package — Deliver the package to Old Town (74s left)`;
    g.hud.say('Mia Torres', 'Mia: "The package is in the trunk. Old Town, 74 seconds — move, Jax!"');
  }
  // Let traffic and pedestrians settle for a few simulated seconds so the street reads busy.
  for (let i = 0; i < 90; i += 1) g.stepWorld(1 / 60, true);
  g.hud.render(g, 0);
  return { screen: 'play' };
}
