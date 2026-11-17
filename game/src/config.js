// Palmera Bay — shared constants, city layout and mission data.
// One job per file: this file only holds numbers, names and tables. No scene code lives here.

export const SAVE_KEY = 'palmera-bay-save-v1';
export const BEST_KEY = 'palmera-bay-best-v1';

// City grid: blocks of BLOCK metres, roads ROAD wide between them, N blocks a side.
export const BLOCK = 46;
export const ROAD = 14;
export const GRID = 7;
export const PITCH = BLOCK + ROAD;
export const CITY_HALF = (GRID * PITCH) / 2;
export const SEA_LEVEL = 0;

// Road centre lines, e.g. -180, -120, -60, 0, 60, 120, 180 for GRID 7.
export function roadCentres() {
  const out = [];
  for (let i = 0; i <= GRID; i += 1) out.push(-CITY_HALF + i * PITCH);
  return out;
}
export function nearestRoad(v) {
  const centres = roadCentres();
  let best = centres[0];
  for (const c of centres) if (Math.abs(v - c) < Math.abs(v - best)) best = c;
  return best;
}
export function clampCity(v) {
  return Math.max(-CITY_HALF - 30, Math.min(CITY_HALF + 30, v));
}

export const PLAYER = {
  walkSpeed: 6.5,
  runSpeed: 11,
  radius: 0.55,
  height: 1.8,
  maxHealth: 100,
  jumpSpeed: 7.5,
  punchDamage: 25,
  punchRange: 2.2,
};

export const CAR = {
  maxSpeed: 34,
  accel: 16,
  brake: 30,
  reverseSpeed: 10,
  turnRate: 1.9,
  trafficSpeed: 9,
};

export const POLICE = {
  chaseSpeed: 30,
  arrestRange: 3.2,
  arrestTime: 2.2,
  loseDistance: 95,
  loseTime: 9,
  maxStars: 5,
};

export const WEAPONS = {
  fists: { name: 'Fists', damage: 25, range: 2.2, rate: 0.45, auto: false },
  pistol: { name: 'P9 Pistol', damage: 34, range: 60, rate: 0.22, auto: false, mag: 12 },
  smg: { name: 'VK-9 SMG', damage: 18, range: 45, rate: 0.09, auto: true, mag: 32 },
};

export const CAR_COLORS = [
  0xd7263d, 0x1b9aaa, 0xf4d35e, 0x2ec4b6, 0xff7b00, 0x8e44ad,
  0xe8e8e8, 0x222831, 0x386641, 0xef476f, 0x118ab2, 0x06d6a0,
];
export const CAR_NAMES = [
  'Comet GT', 'Sunrise Coupe', 'Bay Runner', 'Palm Cruiser', 'Neon Hatch',
  'Dune Buggy', 'Harbor Sedan', 'Turbo Fox', 'Coast Van', 'Midnight LX',
];
export const PED_NAMES = ['Tomas', 'Lena', 'Rosa', 'Dee', 'Marcus', 'Priya', 'Sam', 'Ivy'];

export const DISTRICTS = [
  { name: 'Downtown', cx: 0, cz: 0 },
  { name: 'Marina', cx: -150, cz: 150 },
  { name: 'Old Town', cx: 150, cz: -150 },
  { name: 'Palm Heights', cx: 150, cz: 150 },
  { name: 'The Strip', cx: -150, cz: -150 },
  { name: 'Harbor', cx: 0, cz: 180 },
];
export function districtAt(x, z) {
  let best = DISTRICTS[0];
  let bd = Infinity;
  for (const d of DISTRICTS) {
    const dd = (x - d.cx) ** 2 + (z - d.cz) ** 2;
    if (dd < bd) { bd = dd; best = d; }
  }
  return best.name;
}

// Four story jobs. Each stage is an objective with a target point and a kind the
// mission runner understands: goto, steal, pickup, deliver, survive, hold, escape.
export const MISSIONS = [
  {
    id: 1, title: 'Job 1 — Borrowed Wheels', giver: 'Mia Torres',
    intro: 'Mia: "Jax, you need wheels. Any car on the street — take it, bring it to my garage on the Strip. Don\'t get cute, the cops are watching."',
    reward: 500,
    stages: [
      { kind: 'steal', text: 'Steal a car (walk up to one and press E)', target: null },
      { kind: 'goto', text: 'Drive the car to Mia\'s garage', target: { x: -150, z: -150 }, radius: 9 },
    ],
  },
  {
    id: 2, title: 'Job 2 — The Package', giver: 'Mia Torres',
    intro: 'Mia: "A package is waiting at the Marina docks. Pick it up, then get it to the Old Town drop — fast. The buyer does not like waiting."',
    reward: 800,
    stages: [
      { kind: 'goto', text: 'Pick up the package at the Marina docks', target: { x: -150, z: 150 }, radius: 7 },
      { kind: 'deliver', text: 'Deliver the package to Old Town — 90 seconds!', target: { x: 150, z: -150 }, radius: 8, timeLimit: 90 },
    ],
  },
  {
    id: 3, title: 'Job 3 — Heat on the Strip', giver: 'Dante Cole',
    intro: 'Dante: "The Bay PD raided my stash house. Lose them — or put them down. Three stars and they bring everything. Survive it, Jax."',
    reward: 1200,
    stages: [
      { kind: 'survive', text: 'Survive the heat: lose the cops or take down 4 officers', target: null, need: 4 },
      { kind: 'goto', text: 'Meet Dante at the Harbor warehouse', target: { x: 30, z: 150 }, radius: 9 },
    ],
  },
  {
    id: 4, title: 'Job 4 — The Bay Job', giver: 'Mia Torres',
    intro: 'Mia: "This is the one. The Palmera Trust vault, downtown. Grab the cash, hold the vault door, then lose a three-star tail and get to my safehouse. We walk away rich — or we don\'t walk away."',
    reward: 2500,
    stages: [
      { kind: 'goto', text: 'Reach the Palmera Trust vault, Downtown', target: { x: 30, z: -30 }, radius: 8 },
      { kind: 'hold', text: 'Crack the vault — stay inside the marker', target: { x: 30, z: -30 }, radius: 8, holdTime: 6 },
      { kind: 'escape', text: 'Escape the 3-star wanted level and reach Mia\'s safehouse', target: { x: 150, z: 150 }, radius: 10 },
    ],
  },
];

export const PICKUPS = [
  { kind: 'health', x: -90, z: 90 }, { kind: 'health', x: 90, z: -90 },
  { kind: 'armor', x: 90, z: 90 }, { kind: 'armor', x: -90, z: -90 },
  { kind: 'cash', x: 30, z: 90 }, { kind: 'cash', x: -90, z: 30 },
  { kind: 'smg', x: 90, z: 150 }, { kind: 'ammo', x: -90, z: -150 },
];

export const AMBIENT_LINES = [
  'Pedestrian: "Beautiful day in the Bay, huh?"',
  'Pedestrian: "Did you see the game last night?"',
  'Pedestrian: "I love this city. Most days."',
  'Radio: "...and the Palmera Bay Waves take the series!"',
];
