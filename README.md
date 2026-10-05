# Apex Drive — 3D Car Racing Game

A browser-based 3D racing game built with [Three.js](https://threejs.org/). Six
levels of escalating difficulty, realistic arcade car physics, lap timing, and
progress that is saved and restored across sessions.

## How to run

The game uses ES modules and an import map, so it must be served over HTTP
(opening `index.html` directly from the file system will not work).

A tiny zero-dependency server is included:

```powershell
node server.js
```

Then open **http://localhost:8123** in your browser (Chrome, Edge, or Firefox).

> Requires an internet connection the first time, because Three.js is loaded
> from a CDN (unpkg). After the browser caches it, it works offline.

To stop the server, press `Ctrl+C` in the terminal.

## Controls

| Action        | Keys                     |
|---------------|--------------------------|
| Accelerate    | `W` or `↑`               |
| Reverse       | `S` or `↓`               |
| Steer         | `A` / `D` or `←` / `→`   |
| Brake         | `Space`                  |
| Reset car     | `R`                      |
| Pause         | `Esc` or `P`             |

## Gameplay

- **Countdown** at the start of each race (3 · 2 · 1 · GO!).
- Drive through the checkpoints in order and complete the required number of
  **laps** to finish. A **WRONG WAY** warning appears if you turn around.
- Driving off the road onto the grass/sand slows you down.
- Finishing a level **unlocks the next one** and records your **best time**.

### Levels

1. **Sunset Circuit** — Easy, 2 laps
2. **Canyon Run** — Easy, 3 laps
3. **Neon City** — Medium, 3 laps (night, neon skyline)
4. **Alpine Pass** — Medium, 3 laps (snowy)
5. **Desert Storm** — Hard, 4 laps
6. **Apex Grand Prix** — Hard, 4 laps (night finale)

## Saving / loading

Progress is stored in the browser's `localStorage` under the key
`apex-drive-save-v1`. It persists automatically — quit the browser, come back
later, press **Continue / Play**, and you resume on your last level with all
unlocks and best times intact. **Reset Progress** on the main menu clears it.

What is saved:
- Highest unlocked level
- Last played level (for the Continue button)
- Best lap time per level
- Total races completed

## Project structure

```
index.html          Entry point, menus + HUD markup, Three.js import map
server.js           Minimal static file server (node, no dependencies)
css/style.css       Menu, HUD, and layout styling
js/
  main.js           UI flow: menus, level select, pause, level-complete
  game.js           Core loop, state machine, laps, checkpoints, camera
  car.js            3D car model + bicycle-model physics (grip/slip/drag)
  track.js          Spline road builder, kerbs, checkpoints, start gate
  environment.js    Sky, fog, lighting, themed scenery (nature / neon city)
  levels.js         The six level definitions (points, laps, themes)
  input.js          Keyboard -> normalized driving controls
  hud.js            On-screen HUD updates + time formatting
  saveSystem.js     localStorage save/load persistence
```

## Notes on the physics

The car uses a simplified **bicycle model**: engine force vs. speed, braking,
aerodynamic + rolling drag, speed-sensitive steering, and grip-limited lateral
slip so the car can oversteer and slide near the limit. Body roll and pitch are
applied visually for feel. Values are tuned for an arcade-realistic balance
rather than a strict simulator.
