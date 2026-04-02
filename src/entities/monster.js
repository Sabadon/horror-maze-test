import * as THREE from 'three'
import { camera, playerObject } from '../core/camera.js'
import { grid, CELL_SIZE } from '../levels/level01.js'
import { audioManager } from '../audio/audioManager.js'
import { getState, setState } from '../core/gameStateManager.js'
import { hud } from '../ui/hud.js'

const _tmpFwd = new THREE.Vector3()
const _tmpDir = new THREE.Vector3()

function _xzDist(a, b) {
  const dx = a.x - b.x, dz = a.z - b.z
  return Math.sqrt(dx * dx + dz * dz)
}

function _rng(min, max) { return min + Math.random() * (max - min) }

function _hasLOS(fromWorld, toWorld) {
  const fromCol = Math.floor(fromWorld.x / CELL_SIZE)
  const fromRow = Math.floor(fromWorld.z / CELL_SIZE)
  const toCol   = Math.floor(toWorld.x   / CELL_SIZE)
  const toRow   = Math.floor(toWorld.z   / CELL_SIZE)
  if (fromCol === toCol && fromRow === toRow) return true
  const dCol = toCol - fromCol, dRow = toRow - fromRow
  const steps = Math.max(Math.abs(dCol), Math.abs(dRow))
  for (let i = 1; i < steps; i++) {
    const cc = Math.round(fromCol + (dCol / steps) * i)
    const cr = Math.round(fromRow + (dRow / steps) * i)
    if (cr < 0 || cr >= grid.length || cc < 0 || cc >= grid[0].length) return false
    if (grid[cr][cc] === 1) return false
  }
  return true
}

function _findCorners(g) {
  const corners = []
  for (let r = 1; r < g.length - 1; r++) {
    for (let c = 1; c < g[0].length - 1; c++) {
      if (g[r][c] !== 0) continue
      const oN = g[r-1][c]===0, oS = g[r+1][c]===0, oE = g[r][c+1]===0, oW = g[r][c-1]===0
      const n = (oN?1:0)+(oS?1:0)+(oE?1:0)+(oW?1:0)
      if (n !== 2 || (oN && oS) || (oE && oW)) continue
      corners.push({ pos: new THREE.Vector3((c+0.5)*CELL_SIZE, 1.5, (r+0.5)*CELL_SIZE) })
    }
  }
  return corners
}

function _findTJunctions(g) {
  const junctions = []
  for (let r = 1; r < g.length - 1; r++) {
    for (let c = 1; c < g[0].length - 1; c++) {
      if (g[r][c] !== 0) continue
      const oN = g[r-1][c]===0, oS = g[r+1][c]===0, oE = g[r][c+1]===0, oW = g[r][c-1]===0
      if ((oN?1:0)+(oS?1:0)+(oE?1:0)+(oW?1:0) !== 3) continue
      const cx = (c+0.5)*CELL_SIZE, cz = (r+0.5)*CELL_SIZE, arm = CELL_SIZE * 1.5
      const dashStart = oE && oW ? new THREE.Vector3(cx+arm,1.5,cz) : new THREE.Vector3(cx,1.5,cz-arm)
      const dashEnd   = oE && oW ? new THREE.Vector3(cx-arm,1.5,cz) : new THREE.Vector3(cx,1.5,cz+arm)
      junctions.push({ pos: new THREE.Vector3(cx,1.5,cz), dashStart, dashEnd, cooldown: 0 })
    }
  }
  return junctions
}

export class Monster {
  constructor(scene) {
    const texture = new THREE.TextureLoader().load('/assets/textures/ebaka.png')
    texture.magFilter = THREE.NearestFilter
    texture.minFilter = THREE.NearestFilter
    this._sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false, depthWrite: false })
    )
    this._sprite.scale.set(2.5, 4.0, 1)
    this._sprite.renderOrder = 999
    this._sprite.visible = false
    scene.add(this._sprite)

    this._corners   = _findCorners(grid)
    this._junctions = _findTJunctions(grid)

    this._state        = 'HIDDEN'
    this._stateTimer   = 0
    this._peekCooldown = 5.0
    this._lastYaw      = playerObject.rotation.y
    this._dashJunction = null
    this._dashProgress = 0
    this._dashDuration = 0.65
  }

  get spriteVisible() { return this._sprite.visible }

  _hide() {
    this._sprite.visible = false
    this._state = 'HIDDEN'
  }

  _tryStartPeek(cameraFwd) {
    const playerPos = playerObject.position
    let best = null, bestDist = Infinity
    for (const corner of this._corners) {
      const dist = _xzDist(playerPos, corner.pos)
      if (dist > 14 || dist < 2 || !_hasLOS(playerPos, corner.pos)) continue
      _tmpDir.set(corner.pos.x-playerPos.x, 0, corner.pos.z-playerPos.z).normalize()
      const angle = Math.acos(Math.max(-1,Math.min(1, cameraFwd.x*_tmpDir.x+cameraFwd.z*_tmpDir.z))) * (180/Math.PI)
      if (angle < 15 || angle > 80) continue
      if (dist < bestDist) { bestDist = dist; best = corner }
    }
    if (!best) return
    this._sprite.position.copy(best.pos)
    this._sprite.visible = true
    this._state = 'PEEK'; this._stateTimer = _rng(2.5, 4.5); this._peekCooldown = _rng(10, 20)
    audioManager.playBreathing(); hud.scare()
  }

  _updatePeek(delta, cameraFwd) {
    this._stateTimer -= delta
    const playerPos = playerObject.position
    _tmpDir.set(this._sprite.position.x-playerPos.x, 0, this._sprite.position.z-playerPos.z).normalize()
    const angle = Math.acos(Math.max(-1,Math.min(1, cameraFwd.x*_tmpDir.x+cameraFwd.z*_tmpDir.z))) * (180/Math.PI)
    if (angle < 18 || this._stateTimer <= 0) this._hide()
  }

  _startDash(junction) {
    this._sprite.position.copy(junction.dashStart)
    this._sprite.visible = true
    this._dashJunction = junction; this._dashProgress = 0
    this._state = 'DASH'
    junction.cooldown = _rng(18, 35)
    audioManager.playBreathing(); hud.scare()
  }

  _updateDash(delta) {
    this._dashProgress += delta / this._dashDuration
    this._sprite.position.lerpVectors(this._dashJunction.dashStart, this._dashJunction.dashEnd, Math.min(this._dashProgress, 1))
    this._sprite.position.y = 1.5
    if (this._dashProgress >= 1) this._hide()
  }

  rebuild() {
    this._corners   = _findCorners(grid)
    this._junctions = _findTJunctions(grid)
  }

  reset() {
    this._hide()
    this._peekCooldown = 5.0
    for (const j of this._junctions) j.cooldown = 0
    this._lastYaw = playerObject.rotation.y
  }

  update(delta) {
    if (this._sprite.visible && getState() === 'PLAYING') {
      if (_xzDist(playerObject.position, this._sprite.position) < 2.0) {
        this._hide(); setState('GAME_OVER'); return
      }
    }

    camera.getWorldDirection(_tmpFwd)
    _tmpFwd.y = 0; _tmpFwd.normalize()

    const yawDelta  = playerObject.rotation.y - this._lastYaw
    this._lastYaw   = playerObject.rotation.y
    const playerPos = playerObject.position

    this._peekCooldown -= delta
    for (const j of this._junctions) j.cooldown -= delta

    switch (this._state) {
      case 'HIDDEN': {
        let dashed = false
        for (const j of this._junctions) {
          if (j.cooldown <= 0 && _xzDist(playerPos, j.pos) < 15 && _hasLOS(playerPos, j.pos)) {
            this._startDash(j); dashed = true; break
          }
        }
        if (!dashed && this._peekCooldown <= 0 && Math.abs(yawDelta) > 0.005)
          this._tryStartPeek(_tmpFwd)
        break
      }
      case 'PEEK': this._updatePeek(delta, _tmpFwd); break
      case 'DASH': this._updateDash(delta);           break
    }
  }
}
