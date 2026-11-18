// Staged screenshot scenes behind ?shot=start|drive|chase|mission.
// Each drives the real game into a fixed readable state, paints it
// twice, and sets window.__shotReady so a screenshot tool knows the
// frame is done. The three play scenes first let traffic and
// pedestrians settle for ninety simulated 1/60 s steps; before the
// first paint the camera is stepped forward eighty times at 1/60 s so
// it converges on its target instead of showing a wide view from spawn.
import { CFG } from './config.js';
import { snapCamera, updateCamera } from './player.js';

function putPlayerInCar(G, car, x, z, yaw, speed) {
  car.parked = false;
  car.traffic = null;
  car.pos.set(x, 0, z);
  car.yaw = yaw;
  car.speed = speed;
  car.group.rotation.y = yaw;
  G.player.inCar = true;
  G.player.car = car;
  G.player.group.visible = false;
  G.player.pos.set(x, 0, z);
  G.player.yaw = yaw;
}

function settleWorld(G) {
  for (let i = 0; i < 90; i += 1) G.stepWorld(1 / 60, true);
}

function convergeCamera(G) {
  for (let i = 0; i < 80; i += 1) updateCamera(G, 1 / 60);
  snapCamera(G);
}

export function stageShot(G, name) {
  const p = G.player;
  if (name === 'start') {
    // Title screen over the city at golden hour.
    G.timeHours = 17.5;
    p.pos.set(-40, 0, 60);
    p.yaw = Math.PI * 0.75;
    p.inCar = false;
    p.car = null;
    p.group.visible = true;
    G.mode = 'title';
    G.showScreen('title');
    const a = 0.6;
    G.camera.position.set(Math.cos(a) * 150, 62, Math.sin(a) * 150);
    G.camera.lookAt(0, 18, 0);
    return;
  }

  // The three play scenes run the real game.
  G.mode = 'playing';
  G.showScreen(null);
  G.audio.unlock();

  if (name === 'drive') {
    const car = G.cars.parked[0];
    putPlayerInCar(G, car, -90, 30, Math.PI, 18); // facing south
    p.cash = 2450;
    p.health = 86;
    p.armor = 40;
    G.missions.refreshObjective(G);
    settleWorld(G);
    G.timeHours = 9.5;
    convergeCamera(G);
    return;
  }

  if (name === 'chase') {
    const car = G.cars.parked[1];
    putPlayerInCar(G, car, 30, -90, Math.PI, 24); // facing south
    G.timeHours = 17.5;
    G.police.stars = 3;
    G.hud.setStars(3);
    G.missions.refreshObjective(G);
    G.hud.setObjective('WANTED — 3 stars! Lose the Bay PD');
    // Three police interceptors behind on the same road at
    // increasing distances and slightly different angles and speeds.
    // The nearest one sits just behind the player car, in front of
    // the chase camera, so the chase reads in the frame.
    const spots = [
      { dx: 0, dz: -6, speed: 26 },
      { dx: 5, dz: -18, speed: 22 },
      { dx: -5, dz: -30, speed: 19 },
    ];
    spots.forEach((s, i) => {
      const pc = G.policeSpawnCarForShot(30 + s.dx, -90 + s.dz, Math.PI + (i - 1) * 0.08, s.speed);
      void pc;
    });
    settleWorld(G);
    G.timeHours = 17.5;
    convergeCamera(G);
    return;
  }

  if (name === 'mission') {
    // Job two, started for real, first stage jumped to the timed
    // delivery with 74 seconds left.
    G.missions.startJob(G, 1);
    G.missions.stageIdx = 1;
    G.missions.enterStage(G);
    G.missions.timer = 74;
    G.missions.refreshObjective(G);
    const car = G.cars.parked[2];
    putPlayerInCar(G, car, 90, -90, Math.PI, 16); // facing south
    G.hud.dialogue('Mia Torres', 'Package is in the trunk. Old Town, fast — the buyer does not like waiting.');
    settleWorld(G);
    G.timeHours = 9.5;
    convergeCamera(G);
    return;
  }

  // Unknown shot name: fall back to the title scene.
  stageShot(G, 'start');
}
