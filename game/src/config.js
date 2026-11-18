// Palmera Bay — shared constants, city layout, mission data, pickup spots.
// Every number here comes from the design spec: a 7x7 block city on a
// 60 m pitch, roads 14 m wide, half-width 210 m.

export const CFG = {
  seedDefault: 20261118,
  blockSize: 46,
  roadWidth: 14,
  pitch: 60,
  blocks: 7,
  half: 210,
  bound: 240, // city edge plus a 30 m margin for the player
  dayLength: 240, // seconds of play per full in-game day
  startTime: 9.5, // half past nine in the morning
  gravity: 22,
  jumpSpeed: 7.5,
  walkSpeed: 6.5,
  runSpeed: 11,
  carTopSpeed: 34,
  carReverseSpeed: 10,
  carTurnRate: 1.9,
  saveKey: 'palmera-bay-save-v1',
  saveEvery: 15,
  bailCost: 300,
  hospitalCost: 200,
  arrestGrabTime: 2.2,
  escapeRadius: 95,
  escapeTime: 9,
};

// Road centre lines, both axes: -180, -120, -60, 0, 60, 120, 180.
export const ROADS = [-180, -120, -60, 0, 60, 120, 180];

export const DISTRICTS = [
  { name: 'Downtown', x: 0, z: 0 },
  { name: 'Marina', x: -150, z: 150 },
  { name: 'Old Town', x: 150, z: -150 },
  { name: 'Palm Heights', x: 150, z: 150 },
  { name: 'The Strip', x: -150, z: -150 },
  { name: 'Harbor', x: 0, z: 180 },
];

export function districtAt(x, z) {
  let best = DISTRICTS[0];
  let bd = Infinity;
  for (const d of DISTRICTS) {
    const dx = x - d.x;
    const dz = z - d.z;
    const q = dx * dx + dz * dz;
    if (q < bd) { bd = q; best = d; }
  }
  return best.name;
}

export const BUILDING_COLORS = [
  0x8fa3b0, 0x7d94a6, 0xa89a80, 0x9aa78f,
  0x6f8296, 0xb0a58e, 0x87a0a8, 0x93a88f,
];
export const ROOF_COLORS = [0x3a4148, 0x4a3f38, 0x2f3a44, 0x55483a];

export const CAR_COLORS = [
  0xe23b3b, 0xf2a007, 0x2f8fe8, 0x37c978, 0xe86ec2, 0xf5f0e6,
  0x23272e, 0xff7a1a, 0x7a4fd0, 0x18c8c0, 0xc9d11a, 0x9db3c8,
];
export const CAR_NAMES = [
  'Comet GT', 'Sunrise Coupe', 'Bay Runner', 'Palm Cruiser', 'Neon Hatch',
  'Dune Buggy', 'Harbor Sedan', 'Turbo Fox', 'Coast Van', 'Midnight LX',
];

export const SHIRT_COLORS = [
  0xe8e8e8, 0x3b7dd8, 0xd83b3b, 0x37c978, 0xf2a007,
  0x7a4fd0, 0x18a0c8, 0xe86ec2,
];
export const SKIN_TONES = [0xf2c89b, 0xd9a066, 0xb97a4a, 0x8a5a32, 0xf7d7b0];
export const PED_NAMES = ['Tomas', 'Lena', 'Rosa', 'Dee', 'Marcus', 'Priya', 'Sam', 'Ivy'];

export const WEAPONS = {
  fists: { name: 'Fists', damage: 25, range: 2.2, rate: 0.45, mag: Infinity, auto: false },
  pistol: { name: 'P9 Pistol', damage: 34, range: 60, rate: 0.22, mag: 12, auto: false },
  smg: { name: 'VK-9 SMG', damage: 18, range: 45, rate: 0.09, mag: 32, auto: true },
};

// Eight fixed pickup spots around the city.
export const PICKUPS = [
  { kind: 'health', x: -90, z: 90 },
  { kind: 'health', x: 90, z: -30 },
  { kind: 'armor', x: -30, z: -90 },
  { kind: 'armor', x: 120, z: 120 },
  { kind: 'cash', x: -120, z: -30 },
  { kind: 'smg', x: 30, z: 90 },
  { kind: 'ammo', x: 150, z: 30 },
  { kind: 'cash', x: 0, z: -150 },
];

export const PICKUP_STYLE = {
  health: { color: 0x2ecc40, shape: 'box', label: 'Health +50' },
  armor: { color: 0x2f8fe8, shape: 'box', label: 'Armor +50' },
  cash: { color: 0x37c978, shape: 'cyl', label: '+$150' },
  smg: { color: 0xe86ec2, shape: 'flat', label: 'VK-9 SMG' },
  ammo: { color: 0xf2c200, shape: 'box', label: 'Ammo +48' },
};

// The four jobs, chained in order. Each stage is one of: steal, goto,
// pickup, deliver (timed), survive, hold, escape. Positions are x/z in
// metres; radius is how close the player must get to count as arrived.
export const MISSIONS = [
  {
    id: 1, title: 'Borrowed Wheels', giver: 'Mia Torres', reward: 500,
    intro: "Jax, you need wheels. Any car on the street — bring it to my garage. Don't get cute, the cops are watching.",
    stages: [
      { kind: 'steal', text: 'Steal a car — walk up to one and press E' },
      { kind: 'goto', x: -150, z: -150, radius: 9, text: 'Drive the car to Mia\u2019s garage on the Strip' },
    ],
  },
  {
    id: 2, title: 'The Package', giver: 'Mia Torres', reward: 800,
    intro: 'Pick up the package at the Marina docks, then fast to the Old Town drop. The buyer does not like waiting.',
    stages: [
      { kind: 'pickup', x: -150, z: 150, radius: 7, text: 'Pick up the package at the Marina docks' },
      { kind: 'deliver', x: 150, z: -150, radius: 8, time: 90, text: 'Deliver the package to Old Town — fast!' },
    ],
  },
  {
    id: 3, title: 'Heat on the Strip', giver: 'Dante Cole', reward: 1200,
    intro: 'Bay PD raided my stash house. Lose them or put them down — three stars and they bring everything.',
    stages: [
      { kind: 'survive', takedowns: 4, text: 'Survive the heat: take down 4 officers or lose the cops' },
      { kind: 'goto', x: 30, z: 150, radius: 9, text: 'Meet Dante at the Harbor warehouse' },
    ],
  },
  {
    id: 4, title: 'The Bay Job', giver: 'Mia Torres', reward: 2500,
    intro: 'This is the one. Palmera Trust vault, downtown. Grab the cash, hold the vault door, lose a three-star tail and get to my safehouse. Walk away rich — or don\u2019t walk away at all.',
    stages: [
      { kind: 'goto', x: 30, z: -30, radius: 8, text: 'Reach the Palmera Trust vault downtown' },
      { kind: 'hold', x: 30, z: -30, radius: 8, hold: 6, text: 'Hold the vault — crack it open' },
      { kind: 'escape', x: 150, z: 150, radius: 10, text: 'Escape the 3-star heat and reach Mia\u2019s safehouse' },
    ],
  },
];

export const STORY_END =
  'We did it. The Bay Job is ours — Palmera Bay is yours now. Don\u2019t waste it, Jax.';

export const AMBIENT_LINES = [
  'The bay smells like salt and bad decisions.',
  'Neon hums over the Strip tonight.',
  'Somewhere a siren practices its two-note song.',
  'Palm trees sway. Nobody here hurries — except you.',
];
