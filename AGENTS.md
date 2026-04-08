# Agent Guidelines — Horror Game

First-person PSX-style horror maze built with Three.js + Vite. Procedural audio via Web Audio API.

---

## Project Commands

```bash
npm install      # Install dependencies (three, vite)
npm run dev      # Dev server: http://localhost:5173
npm run build    # Production build → dist/
npm run preview  # Preview built output locally
```

No test framework or linter is currently configured.

---

## Tech Stack

- **Runtime**: Vanilla JS with ES modules (`.js` extension in imports)
- **3D Engine**: Three.js 0.165.0
- **Bundler**: Vite 8
- **Audio**: Web Audio API (no library)
- **Deployment**: Static files → GitHub Pages

---

## Directory Structure

```
src/
├── main.js              # Entry point, game loop, PSX snap shader
├── core/                # Engine fundamentals
│   ├── renderer.js      # THREE.WebGLRenderer, 320×240 PSX resolution
│   ├── scene.js         # Shared THREE.Scene + THREE.Clock
│   ├── camera.js        # First-person camera hierarchy
│   ├── input.js         # Keyboard/mouse/pointer lock handling
│   ├── playerController.js  # WASD movement + collision
│   ├── lightFlicker.js  # STUTTER/NORMAL flicker states
│   ├── atmosphereManager.js  # Fog, lights, torch setup
│   ├── gameStateManager.js   # State machine (MENU/PLAYING/PAUSED/etc)
│   ├── textureGenerator.js   # Procedural 64×64 textures
│   └── postProcessing.js     # Bloom + grain passes
├── levels/
│   ├── level01.js       # Hardcoded maze grid + start/exit cells
│   ├── levelBuilder.js # Builds wall/floor/ceiling geometry from grid
│   └── mazeGenerator.js
├── entities/
│   ├── monster.js       # Corner-peek + T-junction dash behaviors
│   └── laser.js         # Player weapon
├── audio/
│   └── audioManager.js # All procedural audio (class + singleton export)
└── ui/
    ├── mainMenu.js      # UI module pattern (object literal)
    ├── hud.js
    ├── gameOverScreen.js
    ├── escapedScreen.js
    └── styles.css       # Monospace horror aesthetic
```

---

## Code Style Conventions

### Naming

| Element | Convention | Example |
|---------|-----------|---------|
| Classes | PascalCase | `class Monster`, `class AudioManager` |
| Functions/variables | camelCase | `updatePlayer`, `setCollisionFn` |
| Constants | UPPER_SNAKE | `MOUSE_SENSITIVITY`, `CELL_SIZE` |
| Private module-level | `_prefix` | `_buildScene`, `_xzDist` |
| Private instance fields | `_prefix` | `this._ctx`, `this._state` |
| UI module objects | camelCase | `mainMenu`, `hud`, `escapedScreen` |

### Imports

```javascript
// Always include .js extension in imports (ES module requirement)
import * as THREE from 'three'
import { renderer } from './core/renderer.js'
import { scene, clock } from './core/scene.js'

// Relative to src/ with explicit extension
import { Monster } from './entities/monster.js'
```

### Module Patterns

**Singleton exports** (shared state):
```javascript
// Named export for the singleton instance
export const audioManager = new AudioManager()
export const renderer = new THREE.WebGLRenderer({ canvas, antialias: false })
```

**UI modules** (object literal pattern):
```javascript
export const mainMenu = {
  init(onNewGame, onMuteToggle) { /* ... */ },
  setVisible(v) { /* ... */ },
  setMuted(muted) { /* ... */ },
}
```

**State with subscribers**:
```javascript
const _listeners = []
export function onChange(fn) { _listeners.push(fn) }
export function setState(s) {
  _state = s
  for (const fn of _listeners) fn(s)
}
```

### Constants

Define magic numbers as named constants at the top of files:
```javascript
const MOUSE_SENSITIVITY = 0.002
const MOVE_SPEED        = 4.0
const PLAYER_RADIUS     = 0.35
```

### Three.js Conventions

- Use `THREE.Vector3`, `THREE.Color`, etc. for all 3D math
- Pre-allocate temporary vectors at module level (reuse across frames):
  ```javascript
  const _tmpFwd = new THREE.Vector3()
  const _tmpDir = new THREE.Vector3()
  ```
- Mesh materials: `MeshPhongMaterial` for walls (shininess 8, low specular), `MeshLambertMaterial` for floors/ceilings
- PSX look: `NearestFilter` on all textures, `antialias: false`, `image-rendering: pixelated`

### Error Handling

- No try/catch patterns in current codebase
- Browser APIs: check for null/undefined before use (e.g., `if (L.positionX !== undefined)`)
- AudioContext: guard with `if (this._ready) return` for pre-init calls

### GLSL / Shaders

- PSX vertex snapping via `onBeforeCompile` in main.js
- Format: inline GLSL string replacement using `shader.vertexShader.replace()`
- Snap grid: 160 units in clip space

---

## Game State Machine

States: `'MENU'` | `'PLAYING'` | `'PAUSED'` | `'GAME_OVER'` | `'ESCAPED'`

Use `getState()`, `setState()`, `onChange(fn)` from `core/gameStateManager.js`.

---

## Known Bugs (from PLAN.md)

- Wall corner bleed-through at 90° corners (displacement vertex protrusion)
- Floor/ceiling displacement missing (flat geometry)
- Player can move/shoot after death (GAME_OVER state)
- Momentum on pause (held keys not cleared)

---

## Audio Notes

- AudioContext created on first user gesture (canvas click) to satisfy autoplay policy
- All audio is procedural — no external sound files
- Master gain at `audioManager._master` for global mute/unmute
- Listener position updated every frame for 3D positional audio

---

## Build Output

- `dist/` folder for production builds
- Vite config: `base: '/horror-maze-test/'` (GitHub Pages subdirectory)
- Change `base` to `'/'` for root deployment

---

## Style Reminders

- **No trailing commas** in object literals (this codebase style)
- **No semicolons** ( ASI style, consistent with codebase)
- **Single quotes** for strings
- **No TypeScript** — pure JavaScript
- **No JSDoc comments** unless explaining complex PSX effects
- **CSS**: monospace font, uppercase text, letter-spacing for horror aesthetic
