# Horror Game — Development Plan

First-person horror game built with Three.js + Vite. Hosted as static files on GitHub Pages.

---

## Known Bugs / Backlog

- **Wall corner bleed-through** — at corridor corners where two displaced wall faces meet at 90°, protruding brick vertices from one face poke through the adjacent face. Fix: add a thin solid block (BoxGeometry) filling each interior corner, or clamp displacement near face edges, or cap `displacementScale` low enough that no vertex crosses the adjacent plane.
- **Floor displacement missing** — floor slabs are flat geometry with no displacement map. Should receive the same height-map treatment as walls (slab faces raised, grout recessed). Needs subdivided `PlaneGeometry` + `makeFloorDisplacementMap()` derived from the slab height field.
- **Ceiling displacement missing** — ceiling is flat. Should match the rough-stone height variation already encoded in `makeCeilTexture`, giving damp uneven stone overhead.
- **Movement after death** — when the player dies (GAME_OVER state), movement and shooting still work. Player input should be frozen until restart.
- **Momentum on pause** — if the player is walking when Escape is pressed (PAUSED state), movement continues until a key is released. Held keys should be cleared on pause.

---

## Game Concept
You are trapped in an endless stone maze. Something is hunting you. You must find the exit before it finds you.

**Visual style: PSX / retro horror**
- Render internally at **320×240**, upscaled with nearest-neighbor (hard pixelation)
- Low-res textures (64×64 or 128×128), `NearestFilter` — no anti-aliasing
- Vertex position snapping (world-space snap to ~0.05 grid) via custom vertex shader — causes the characteristic PSX "wobble"
- Affine texture distortion via custom shader (optional, can add later)
- Short exponential fog to hide draw distance and create dread
- Deliberately low polygon count — chunky walls, blocky geometry

**Level structure: maze**
- Fixed test maze for Phase 3 (hardcoded 2D grid)
- Phase 8+: recursive backtracker random maze generation
- Grid of cells, each cell tracks which of its 4 walls (N/S/E/W) are present
- `levelBuilder.js` reads the grid and emits wall/floor/ceiling geometry per cell

## Tech Stack
- **Three.js** (0.165.0) via npm — tree-shaken, ~600 KB bundle
- **Vite** — dev server with HMR, `dist/` output for GH Pages
- **Web Audio API** — no library, raw positional audio
- **GitHub Pages** — configured in Phase 8 (test locally until then)

## Local Dev
```bash
npm install
npm run dev     # http://localhost:5173
npm run build   # outputs dist/
```

---

## Phase 1 — Project Setup [DONE]
- [x] Vite + Three.js scaffold
- [x] `index.html` with fullscreen `<canvas id="game">`
- [x] `src/main.js` — minimal Three.js hello-world
- [x] Directory skeleton created
- [x] Boilerplate removed

---

## Phase 2 — Core Engine
Player can walk through an empty scene in first-person at 60 fps.

- [x] `src/core/renderer.js` — WebGLRenderer, PCFSoftShadowMap, pixel ratio ≤ 2
- [x] `src/core/scene.js` — shared THREE.Scene + THREE.Clock
- [x] `src/core/camera.js` — PerspectiveCamera(75) in yaw/pitch hierarchy (`playerObject` → `cameraHolder`)
- [x] `src/core/input.js` — WASD + Shift; Pointer Lock API; accumulate movementX/Y, clamp pitch ±85°
- [x] `src/core/playerController.js` — apply yaw/pitch, WASD movement vector in camera-local space
- [x] `src/main.js` — `renderer.setAnimationLoop(tick)` wiring
- [x] Temp floor + 4 walls for movement testing

---

## Phase 3 — Maze Level Geometry
Procedural maze generation with special rooms.

**Maze data format** (`src/levels/level01.js`):
- 15×15 cells → 31×31 binary grid, CELL_SIZE = 2 units
- Exports: `grid`, `START_CELL`, `exits[]`, `deadEndRooms[]`, `openRooms[]`
- Player starts at center, exits distributed at varying distances

**Features:**
- [x] `src/levels/mazeGenerator.js` — recursive backtracker DFS with braiding, dead-end rooms, open rooms
- [x] `src/levels/level01.js` — exports all maze data, `regenerate()` for new mazes
- [x] `src/levels/levelBuilder.js` — wall/floor/ceiling geometry + room geometry + exit markers
- [x] AABB collision in `playerController.js` — per-axis check with player radius 0.35
- [x] PSX resolution: renderer fixed at 320×240, `image-rendering: pixelated`, `antialias: false`
- [x] Procedural 64×64 textures in `src/core/textureGenerator.js` — wall, floor, ceiling, room variants
- [x] Multiple exit markers with unique glow colors

*Can develop Phase 5 (audio) in parallel once Phase 2 is stable.*

---

## Phase 4 — Lighting & Atmosphere
Dark, oppressive, PSX-era feel — no real-time shadows (too expensive and not PSX-authentic).

- [x] `scene.background = black`, `FogExp2(0x000000, 0.12)`
- [x] `AmbientLight(0x111111, 0.8)` — near-black baseline
- [x] Auto-placed PointLights at corridor junctions (`0xff8822`, intensity 1.2, distance 7, decay 2) — no shadows
- [x] `src/core/lightFlicker.js` — NORMAL (multi-freq sine noise) + STUTTER (random on/off sequence) state machine, 3–8 s intervals, independent per light
- [x] Player torch: PointLight on `cameraHolder`, intensity 0.9, distance 6, `0xffddaa`, also flickering
- [x] `src/core/atmosphereManager.js` — wires fog, ambient, auto-placed corridor lights, player torch; returns flickerer array

---

## Phase 5 — Audio
*(parallel with Phase 3)*

- [x] `src/audio/audioManager.js` — fully procedural Web Audio API (no external files)
- [x] AudioContext init on first canvas click (`{ once: true }`) — satisfies browser autoplay policy
- [x] Ambient: 4 detuned sawtooth oscillators + brown noise layer + breathing LFO, slow per-osc pitch drift
- [x] Random water drips: sine plink with freq glide, fires every 1.8–8.8 s
- [x] Footsteps: decaying noise burst through bandpass, pitch-randomised, triggered every 0.65 m walked
- [x] `playSting()` — low thump (sine sweep 75→22 Hz) + high bandpass noise screech
- [x] `playGrowl(worldPos)` — HRTF PannerNode positional growl, ready for Phase 6
- [x] Master gain + `mute()` / `unmute()`
- [x] Listener position + orientation updated every frame for 3D audio

---

## Phase 6 — Enemy / Monster [DONE]
Active pursuit AI with patrol and chase behaviors.

- [x] `src/entities/monster.js` — Full AI state machine with PATROL/ALERT/CHASE/SEARCH/LOST states
- [x] `src/entities/pathfinder.js` — A* pathfinding with MinHeap for efficient navigation
- [x] **Patrol** — Wanders maze randomly using pathfinding, slow movement
- [x] **Alert** — First sees player → pause, play alert sound, then chase
- [x] **Chase** — Pursues player via A*, faster movement, periodic chase sounds
- [x] **Search** — Lost sight → go to last known position, search area
- [x] **Lost** — Give up after 10s → return to patrol
- [x] Vision cone: 90° FOV, 10 cells range, LOS check
- [x] Sprite size: 2.0 × 5.5 (taller, more imposing)
- [x] Audio: alert growl, chase breathing, monster footsteps

---

## Phase 7 — Game Loop & States [DONE]
Complete play-through from menu to death.

- [x] `src/core/gameStateManager.js` — MENU / PLAYING / PAUSED / GAME_OVER / ESCAPED
- [x] `src/ui/mainMenu.js` — "New Game" (resumes AudioContext), "Mute"
- [x] `src/ui/hud.js` — CSS vignette (opacity ↑ as monster closes in), crosshair
- [x] Pause: Escape → PAUSED, releases pointer lock
- [x] `src/ui/gameOverScreen.js` — red flash, "You Died", Retry (no page reload)
- [x] `src/ui/escapedScreen.js` — "You Escaped", play again

---

## Phase 8 — Polish [DONE]

### PSX Visual Effects
- [x] **Low-res upscale** — canvas at 320×240 with CSS `image-rendering: pixelated`
- [x] **Vertex snapping shader** — inline `onBeforeCompile` in `main.js`, snaps clip-space XY to 160-unit grid
- [x] `src/core/postProcessing.js` — EffectComposer + UnrealBloomPass (threshold 0.9, strength 0.2) + custom grain pass
- [x] Dark vignette overlay via CSS radial-gradient

### Fun Maze Generation [DONE]
- [x] **Large maze** — 15×15 cells = 31×31 binary grid, CELL_SIZE = 2 (58×58 unit playable area)
- [x] **Multiple exits** — 2-3 exits at varying distances from start, each with unique glow color (green/cyan/gold)
- [x] **Dead-end rooms** — ~30% of dead-ends converted to 2×2 chambers with walls on 3 sides
- [x] **Open rooms** — 6 scattered 3×3 clearings with dim amber point lights
- [x] **More loops** — 60% braiding for interesting navigation paths
- [x] **Unique room textures** — separate floor/ceiling textures for special areas
- [x] **Multiple exit detection** — win when reaching any exit

### Skipped (by choice)
- GitHub Pages deployment — not needed

---

## File Tree (target)

```
horror-game/
├── index.html
├── vite.config.js
├── package.json
├── PLAN.md
├── README.md
├── LICENSE
├── .github/workflows/deploy.yml
├── public/
│   ├── 404.html
│   └── assets/
│       ├── textures/
│       ├── sounds/
│       └── models/
└── src/
    ├── main.js
    ├── core/
    │   ├── renderer.js
    │   ├── scene.js
    │   ├── camera.js
    │   ├── input.js
    │   ├── playerController.js
    │   ├── lightFlicker.js
    │   ├── atmosphereManager.js
    │   ├── gameStateManager.js
    │   ├── assetLoader.js
    │   └── postProcessing.js
    ├── levels/
    │   ├── level01.js
    │   └── levelBuilder.js
    ├── entities/
    │   ├── monster.js
    │   └── monsterAI.js
    ├── audio/
    │   └── audioManager.js
    ├── ui/
    │   ├── styles.css
    │   ├── loadingScreen.js
    │   ├── mainMenu.js
    │   ├── hud.js
    │   └── gameOverScreen.js
    └── shaders/
        ├── psxVertex.glsl
        ├── vignette.vert
        └── vignette.frag
```

## Build Order

```
Phase 1 (setup) ✓
    └─> Phase 2 (engine)
            └─> Phase 3 (level geometry)     Phase 5 (audio)
                    └─> Phase 4 (lighting)         │
                            └─> Phase 6 (enemy) <──┘
                                    └─> Phase 7 (states)
                                            └─> Phase 8 (polish + deploy)
```
