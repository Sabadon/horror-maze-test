import * as THREE from 'three'
import { renderer } from './core/renderer.js'
import { scene, clock } from './core/scene.js'
import { camera, playerObject, cameraHolder } from './core/camera.js'
import { updatePlayer, setCollisionFn } from './core/playerController.js'
import { buildLevel, isWallAt, getStartPosition, getExitPosition } from './levels/levelBuilder.js'
import { regenerate } from './levels/level01.js'
import { setupAtmosphere } from './core/atmosphereManager.js'
import { audioManager } from './audio/audioManager.js'
import { Monster } from './entities/monster.js'
import { LaserGun } from './entities/laser.js'
import { getState, setState, onChange } from './core/gameStateManager.js'
import { createComposer } from './core/postProcessing.js'
import './ui/styles.css'
import { mainMenu } from './ui/mainMenu.js'
import { hud } from './ui/hud.js'
import { gameOverScreen } from './ui/gameOverScreen.js'
import { escapedScreen } from './ui/escapedScreen.js'

// --- PSX vertex snapping ---
function applyPSXSnap(scene) {
  scene.traverse(obj => {
    if (!obj.isMesh) return
    const mat = obj.material
    if (!mat || mat._psxPatched) return
    mat.onBeforeCompile = shader => {
      shader.vertexShader = shader.vertexShader.replace(
        '#include <project_vertex>',
        `#include <project_vertex>
        float snap = 160.0;
        vec4 snapped = gl_Position;
        snapped.xy = floor(snapped.xy / snapped.w * snap + 0.5) / snap * snapped.w;
        gl_Position = snapped;`
      )
    }
    mat._psxPatched = true
  })
}

// --- Scene state ---
let _levelMeshes  = null
let _atmResult    = null
let _flickerers   = []
let _exitPos      = null

function _buildScene() {
  _levelMeshes = buildLevel(scene)
  _atmResult   = setupAtmosphere()
  _flickerers  = _atmResult.flickerers
  _exitPos     = getExitPosition()
  applyPSXSnap(scene)
}

function _teardownScene() {
  if (_levelMeshes) {
    for (const mesh of Object.values(_levelMeshes)) scene.remove(mesh)
    _levelMeshes = null
  }
  if (_atmResult) {
    for (const obj of _atmResult.sceneObjects)  scene.remove(obj)
    for (const obj of _atmResult.holderObjects) cameraHolder.remove(obj)
    _atmResult = null
  }
}

// --- Initial build ---
setCollisionFn(isWallAt)
scene.add(playerObject)
_buildScene()
playerObject.position.copy(getStartPosition())

// --- Monster (after scene build so PSX snap patches it too) ---
const monster = new Monster(scene)
const laserGun = new LaserGun(scene, _levelMeshes ? [_levelMeshes.wallMesh] : [])

// --- UI ---
const canvas = document.getElementById('game')
let _muted = false

mainMenu.init(
  () => canvas.requestPointerLock(),
  () => {
    _muted = !_muted
    _muted ? audioManager.mute() : audioManager.unmute()
    mainMenu.setMuted(_muted)
  }
)
hud.init()

function _restart() {
  _teardownScene()
  regenerate()
  _buildScene()
  playerObject.position.copy(getStartPosition())
  monster.rebuild()
  monster.reset()
  laserGun._collidables = _levelMeshes ? [_levelMeshes.wallMesh] : []
  canvas.requestPointerLock()
}

gameOverScreen.init(() => { gameOverScreen.hide(); _restart() })
escapedScreen.init(() => { escapedScreen.hide(); _restart() })

// --- State → UI ---
onChange(state => {
  if (state === 'PLAYING') audioManager.init()
  mainMenu.setVisible(state === 'MENU')
  hud.setVisible(state === 'PLAYING' || state === 'PAUSED')
  hud.showPaused(state === 'PAUSED')
  if (state === 'GAME_OVER') gameOverScreen.show()
  if (state === 'ESCAPED')   escapedScreen.show()
})

mainMenu.setVisible(true)

// --- Pointer lock ↔ state ---
document.addEventListener('pointerlockchange', () => {
  const locked = !!document.pointerLockElement
  if (locked  && (getState() === 'MENU' || getState() === 'PAUSED' || getState() === 'GAME_OVER' || getState() === 'ESCAPED')) setState('PLAYING')
  if (!locked && getState() === 'PLAYING') setState('PAUSED')
})

// --- Post-processing ---
const { composer, grainPass } = createComposer(renderer, scene, camera)

// --- Resize ---
function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
}
window.addEventListener('resize', onResize)
onResize()

// --- Game loop ---
const _cameraFwd = new THREE.Vector3()

renderer.setAnimationLoop(() => {
  const delta = clock.getDelta()

  if (getState() === 'PLAYING') {
    camera.getWorldDirection(_cameraFwd)
    updatePlayer(delta)
    monster.update(delta)
    laserGun.update(delta)
    audioManager.update(playerObject.position, _cameraFwd)
    for (const f of _flickerers) f.update(delta, clock.elapsedTime)
    hud.update(delta)
    if (playerObject.position.distanceTo(_exitPos) < 1.5) setState('ESCAPED')
  }

  if (getState() === 'PLAYING') grainPass.uniforms.uTime.value += delta
  composer.render()
})
