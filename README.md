# Palmera Bay — Open World Crime

[![make.fun](https://make.fun/badge/gta6-01.svg)](https://make.fun/c/gta6-01)
[![rank](https://make.fun/badge/gta6-01/bibitcuan1-boop/gta6/rank.svg)](https://make.fun/c/gta6-01)
[![reward](https://make.fun/badge/gta6-01/bibitcuan1-boop/gta6/reward.svg)](https://make.fun/c/gta6-01)

An original open-world crime game built for the make.fun **gta6-01** bounty —
100% hand-written, no Rockstar names, art, music, maps or characters. Everything
is original: the city of **Palmera Bay**, its people, its cars, its story.

## The story

You are **Jax Carter**, fresh out of county jail and broke in Palmera Bay — a
sun-soaked port city of neon, palm trees and bad decisions. **Mia Torres** has
work for you, if you can stay out of the cuffs. Run four jobs, from stealing
your first set of wheels to the vault heist the whole city is talking about —
**The Bay Job** — and take the city for yourself.

## What is in the game

- **A real city to explore** — a 7×7-block grid with roads, sidewalks, towers,
  palm trees, a marina, a beach and the sea, built in three.js (vendored locally).
- **On foot and driving** — third-person on-foot controls with run and jump,
  plus drivable cars with steering, braking and reverse.
- **Traffic and pedestrians** — 14 traffic cars that follow the road grid and
  26 pedestrians who stroll the sidewalks and flee when trouble starts.
- **Steal cars** — walk up to any parked car and press E. Carjack a moving car
  and the driver runs — and the cops notice.
- **Wanted level and police** — 0–5 stars. Bay PD interceptors chase and ram
  you, officers chase you on foot and try to arrest you. Lose them by breaking
  line of sight, or take them down and watch the heat rise. Get caught and you
  are **BUSTED**; get flatlined and you are **WASTED** — both cost you bail money.
- **Missions and story** — 4 jobs with dialogue, objectives, timers, a vault
  hold-out and a getaway, paying $500 / $800 / $1,200 / $2,500.
- **Combat** — pistol and SMG with tracers, reloads and ammo, plus punching.
- **HUD and minimap** — health and armor bars, cash, wanted stars, a live
  clock, district name, mission objective tracker, speedometer, weapon readout
  and a round top-down minimap with the mission marker, traffic and police.
- **Start screen, pause, save** — progress saves to localStorage automatically
  and can be continued from the title screen.
- **Sound** — fully synthesized WebAudio: engine hum, two-tone sirens,
  gunshots, pickups and mission jingles. No audio files, no network.
- **Staged screenshots** — `?shot=start|drive|chase|mission` stages a
  deterministic scene for screenshots and sets `window.__shotReady`.

## Controls

| Key | Action |
| --- | --- |
| WASD | Move / drive |
| Mouse | Look (click the game to capture the mouse) |
| SHIFT | Run |
| SPACE | Jump |
| E | Enter / steal / exit car |
| CLICK | Shoot |
| F | Punch |
| R | Reload |
| 1 / 2 | Fists / pistol |
| N | Start next job |
| C | Change camera |
| M | Mute |
| P / Esc | Pause |
| H | Hide HUD |

## Play it

```sh
node serve.ts
# open http://localhost:8080
```

Static files only — `game/index.html` opens in desktop Chrome from any static
server, with zero network requests at runtime. three.js is vendored under
`game/vendor/three.min.js`.

## Files

- `game/index.html` — page shell, HUD and menus
- `game/src/main.js` — boot, game loop, save/load, wiring
- `game/src/city.js` — the city, buildings, roads, palms, colliders
- `game/src/vehicles.js` — cars, driving, traffic AI, carjacking
- `game/src/people.js` — pedestrians and police officers on foot
- `game/src/police.js` — wanted level, chases, arrests, escape
- `game/src/missions.js` — the four-job story chain
- `game/src/combat.js` — shooting, punching, tracers, pickups
- `game/src/hud.js` — HUD and minimap rendering
- `game/src/player.js` — on-foot movement and cameras
- `game/src/audio.js` — synthesized WebAudio sound
- `game/src/config.js` — constants, city layout, mission data
- `game/src/input.js` — keyboard and mouse input
- `game/src/shots.js` — staged screenshot scenes
- `main.ts` — the entrypoint: copies `game/` and `screenshots/` to `/output`
  and writes `dossier.json`

## License

MIT — see [LICENSE](LICENSE).
