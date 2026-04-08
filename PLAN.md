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
Fixed test maze; random generation deferred to later.

**Maze data format** (`src/levels/level01.js`):
- 2D array of cell objects: `{ n, s, e, w }` booleans (true = wall present)
- Cell size: 3 units × 3 units, wall height: 3 units
- Player starts at cell (1,1), exit at opposite corner

**Todos:**
- [x] `src/levels/level01.js` — hardcoded 11×11 maze grid, start (1,1) + exit (9,9)
- [x] `src/levels/levelBuilder.js` — wall quads per cell edge, merged geometry, exports `isWallAt` + `getStartPosition`
- [x] AABB collision in `playerController.js` — per-axis check with player radius 0.35
- [x] PSX resolution: renderer fixed at 320×240, `image-rendering: pixelated`, `antialias: false`
- [x] Procedural 64×64 textures in `src/core/textureGenerator.js` — seeded RNG, `NearestFilter`, `RepeatWrapping`; sewer aesthetic (moss, water stains, slime drips, mold, cracks)
- [x] Visible exit marker (emissive green pillar at exit cell)

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
Psychological horror — glimpsed, never hunted.

- [x] `src/entities/monster.js` — B&W billboard sprite, procedural scary face texture
- [x] Corner peek: appears in peripheral vision (15–80°) when player turns, vanishes when looked at directly
- [x] T-junction dash: sprints across corridor intersections in 0.35 s when player approaches
- [x] DDA grid line-of-sight check for both behaviors
- [x] Audio: non-positional ragged breathing (inhale + exhale + moan undertone) on every appearance

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

### Skipped (by choice)
- GitHub Pages deployment — not needed
- Random maze generation — deferred

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
