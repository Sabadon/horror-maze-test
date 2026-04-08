import * as THREE from 'three'
import { camera, playerObject } from '../core/camera.js'
import { grid, CELL_SIZE } from '../levels/level01.js'
import { audioManager } from '../audio/audioManager.js'
import { getState, setState } from '../core/gameStateManager.js'
import { hud } from '../ui/hud.js'
import { findPath, getWalkableCells } from './pathfinder.js'

const BASE_URL = import.meta.env.BASE_URL || '/'

const VIEW_DISTANCE = 10
const VIEW_ANGLE = 90
const CHASE_SPEED = 5.0
const PATROL_SPEED = 2.5
const SEARCH_SPEED = 2.0
const MEMORY_TIME = 10
const PATH_RECALC_TIME = 0.5
const CATCH_DISTANCE_SQ = 1.3 * 1.3
const VIEW_DIST_SQ = (VIEW_DISTANCE * CELL_SIZE) * (VIEW_DISTANCE * CELL_SIZE)
const CELL_HALF_SQ = (CELL_SIZE * 0.5) * (CELL_SIZE * 0.5)

const _tmpToPlayer = new THREE.Vector3()
const _patrolTarget = new THREE.Vector3()

function hasLOS(fromX, fromZ, toX, toZ) {
  const fromCol = Math.floor(fromX / CELL_SIZE)
  const fromRow = Math.floor(fromZ / CELL_SIZE)
  const toCol = Math.floor(toX / CELL_SIZE)
  const toRow = Math.floor(toZ / CELL_SIZE)

  if (fromCol === toCol && fromRow === toRow) return true

  const dCol = toCol - fromCol
  const dRow = toRow - fromRow
  const steps = Math.max(Math.abs(dCol), Math.abs(dRow))

  if (steps === 0) return true

  for (let i = 1; i <= steps; i++) {
    const cc = Math.round(fromCol + (dCol / steps) * i)
    const cr = Math.round(fromRow + (dRow / steps) * i)
    if (cr < 0 || cr >= grid.length || cc < 0 || cc >= grid[0].length) return false
    if (grid[cr][cc] === 1) return false
  }
  return true
}

function canSeePlayer(monsterX, monsterZ, playerX, playerZ, monsterYaw) {
  const dx = playerX - monsterX
  const dz = playerZ - monsterZ
  const distSq = dx * dx + dz * dz

  if (distSq > VIEW_DIST_SQ) return false
  if (distSq < CELL_HALF_SQ) return true

  if (!hasLOS(monsterX, monsterZ, playerX, playerZ)) return false

  const angleToPlayer = Math.atan2(dx, dz) * (180 / Math.PI)
  let angleDiff = angleToPlayer - monsterYaw
  while (angleDiff > 180) angleDiff -= 360
  while (angleDiff < -180) angleDiff += 360

  return Math.abs(angleDiff) <= VIEW_ANGLE / 2
}

function isValidPosition(x, z) {
  const col = Math.floor(x / CELL_SIZE)
  const row = Math.floor(z / CELL_SIZE)
  return row >= 0 && row < grid.length && col >= 0 && col < grid[0].length && grid[row][col] === 0
}

export class Monster {
  constructor(scene) {
    const texture = new THREE.TextureLoader().load(`${BASE_URL}assets/textures/ebaka.png`)
    texture.magFilter = THREE.NearestFilter
    texture.minFilter = THREE.NearestFilter

    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
    })

    this._sprite = new THREE.Sprite(material)
    this._sprite.scale.set(2.0, 5.5, 1)
    this._sprite.visible = false
    scene.add(this._sprite)

    this._position = new THREE.Vector3(0, 2.75, 0)
    this._yaw = 0
    this._state = 'PATROL'
    this._path = []
    this._pathIndex = 0
    this._pathTimer = 0
    this._memoryTimer = 0
    this._alertTimer = 0
    this._lostTimer = 0
    this._lastKnownPlayer = new THREE.Vector3()
    this._soundTimer = 2
    this._stepTimer = 0
    this._walkTarget = new THREE.Vector3()
    this._stuckCounter = 0

    this._walkableCells = []
    this._scene = scene
    this._initialized = false
    this._aliveTimer = 0
    this._canSee = false
  }

  _initPosition() {
    this._walkableCells = getWalkableCells()
    if (this._walkableCells.length === 0) return

    let validStart = null
    const playerCol = Math.floor(playerObject.position.x / CELL_SIZE)
    const playerRow = Math.floor(playerObject.position.z / CELL_SIZE)

    for (const cell of this._walkableCells) {
      const dx = cell.col - playerCol
      const dz = cell.row - playerRow
      const distSq = dx * dx + dz * dz
      if (distSq > 64) {
        validStart = cell
        break
      }
    }

    if (!validStart) {
      validStart = this._walkableCells[Math.floor(Math.random() * this._walkableCells.length)]
    }

    this._position.set(
      (validStart.col + 0.5) * CELL_SIZE,
      2.75,
      (validStart.row + 0.5) * CELL_SIZE
    )

    this._pickNewWalkTarget()
    this._initialized = true
  }

  _pickNewWalkTarget() {
    if (this._walkableCells.length === 0) return

    const cell = this._walkableCells[Math.floor(Math.random() * this._walkableCells.length)]
    this._walkTarget.set(
      (cell.col + 0.5) * CELL_SIZE,
      2.75,
      (cell.row + 0.5) * CELL_SIZE
    )
    this._stuckCounter = 0
  }

  _updatePatrol(delta) {
    const dx = this._walkTarget.x - this._position.x
    const dz = this._walkTarget.z - this._position.z
    const distSq = dx * dx + dz * dz

    if (distSq < 0.5) {
      this._pickNewWalkTarget()
      return
    }

    const dist = Math.sqrt(distSq)
    const moveX = (dx / dist) * PATROL_SPEED * delta
    const moveZ = (dz / dist) * PATROL_SPEED * delta

    const newX = this._position.x + moveX
    const newZ = this._position.z + moveZ

    if (isValidPosition(newX, newZ)) {
      this._position.x = newX
      this._position.z = newZ
      this._yaw = Math.atan2(dx, dz)
    } else {
      this._stuckCounter++
      if (this._stuckCounter > 5) {
        this._pickNewWalkTarget()
      }
    }

    if (this._stepTimer <= 0) {
      audioManager.playMonsterStep(this._position.x, this._position.z)
      this._stepTimer = 0.5
    }
    this._stepTimer -= delta
  }

  _updateAlert(delta) {
    this._alertTimer -= delta
    if (this._alertTimer <= 1.5) {
      audioManager.startMonsterChase(this._position.x, this._position.z)
    }
    if (this._alertTimer <= 0) {
      this._state = 'CHASE'
      this._memoryTimer = MEMORY_TIME
    }
  }

  _updateChase(delta) {
    this._pathTimer -= delta
    if (this._pathTimer <= 0) {
      const path = findPath(this._position.x, this._position.z, playerObject.position.x, playerObject.position.z, 2000)
      if (path && path.length > 1) {
        this._path = path.slice(1)
        this._pathIndex = 0
      }
      this._pathTimer = PATH_RECALC_TIME
    }

    if (this._canSee) {
      this._lastKnownPlayer.copy(playerObject.position)
      this._memoryTimer = MEMORY_TIME
    } else {
      this._memoryTimer -= delta
      if (this._memoryTimer <= 0) {
        this._state = 'SEARCH'
        this._lostTimer = 8
        const path = findPath(this._position.x, this._position.z, this._lastKnownPlayer.x, this._lastKnownPlayer.z, 2000)
        if (path && path.length > 1) {
          this._path = path.slice(1)
          this._pathIndex = 0
        }
        return
      }
    }

    if (this._path.length > 0 && this._pathIndex < this._path.length) {
      const waypoint = this._path[this._pathIndex]
      const wdx = waypoint.x - this._position.x
      const wdz = waypoint.z - this._position.z
      const wdistSq = wdx * wdx + wdz * wdz

      if (wdistSq < 0.3) {
        this._pathIndex++
      } else {
        const wdist = Math.sqrt(wdistSq)
        const newX = this._position.x + (wdx / wdist) * CHASE_SPEED * delta
        const newZ = this._position.z + (wdz / wdist) * CHASE_SPEED * delta
        if (isValidPosition(newX, newZ)) {
          this._position.x = newX
          this._position.z = newZ
        }
      }
    } else {
      const path = findPath(this._position.x, this._position.z, playerObject.position.x, playerObject.position.z, 2000)
      if (path && path.length > 1) {
        this._path = path.slice(1)
        this._pathIndex = 0
      }
    }

    if (this._soundTimer <= 0) {
      audioManager.playMonsterChase(this._position.x, this._position.z)
      this._soundTimer = 3 + Math.random() * 4
    }
    this._soundTimer -= delta
  }

  _updateSearch(delta) {
    this._lostTimer -= delta

    if (this._path.length > 0 && this._pathIndex < this._path.length) {
      const waypoint = this._path[this._pathIndex]
      const wdx = waypoint.x - this._position.x
      const wdz = waypoint.z - this._position.z
      const wdistSq = wdx * wdx + wdz * wdz

      if (wdistSq < 0.3) {
        this._pathIndex++
      } else {
        const wdist = Math.sqrt(wdistSq)
        const newX = this._position.x + (wdx / wdist) * SEARCH_SPEED * delta
        const newZ = this._position.z + (wdz / wdist) * SEARCH_SPEED * delta
        if (isValidPosition(newX, newZ)) {
          this._position.x = newX
          this._position.z = newZ
        }
      }
    }

    if (this._lostTimer <= 0) {
      this._state = 'LOST'
      this._lostTimer = 5
    }
  }

  _updateLost(delta) {
    this._lostTimer -= delta
    this._updatePatrol(delta)

    if (this._lostTimer <= 0) {
      this._state = 'PATROL'
    }
  }

  rebuild() {
    this._walkableCells = getWalkableCells()
  }

  reset() {
    this._state = 'PATROL'
    this._path = []
    this._pathIndex = 0
    this._pathTimer = 0
    this._memoryTimer = 0
    this._alertTimer = 0
    this._lostTimer = 0
    this._soundTimer = 2
    this._stepTimer = 0
    this._stuckCounter = 0
    this._initialized = false
    this._aliveTimer = 0
    this._canSee = false

    this._walkableCells = getWalkableCells()
    if (this._walkableCells.length > 0) {
      let validStart = null
      const playerCol = Math.floor(playerObject.position.x / CELL_SIZE)
      const playerRow = Math.floor(playerObject.position.z / CELL_SIZE)

      for (const cell of this._walkableCells) {
        const dx = cell.col - playerCol
        const dz = cell.row - playerRow
        const distSq = dx * dx + dz * dz
        if (distSq > 64) {
          validStart = cell
          break
        }
      }

      if (!validStart) {
        validStart = this._walkableCells[Math.floor(Math.random() * this._walkableCells.length)]
      }

      this._position.set(
        (validStart.col + 0.5) * CELL_SIZE,
        2.75,
        (validStart.row + 0.5) * CELL_SIZE
      )

      this._pickNewWalkTarget()
      this._initialized = true
    }

    this._sprite.visible = false
  }

  update(delta) {
    if (getState() !== 'PLAYING') {
      audioManager.stopMonsterChase()
      return
    }

    if (!this._initialized) {
      this._initPosition()
      return
    }

    this._aliveTimer += delta

    this._canSee = canSeePlayer(
      this._position.x, this._position.z,
      playerObject.position.x, playerObject.position.z,
      this._yaw * (180 / Math.PI)
    )

    const dx = playerObject.position.x - this._position.x
    const dz = playerObject.position.z - this._position.z
    if (this._aliveTimer > 3 && dx * dx + dz * dz < CATCH_DISTANCE_SQ) {
      audioManager.stopMonsterChase()
      audioManager.playSting()
      setState('GAME_OVER')
      return
    }

    this._sprite.visible = true

    switch (this._state) {
      case 'PATROL':
        audioManager.stopMonsterChase()
        if (this._canSee) {
          this._state = 'ALERT'
          this._alertTimer = 0.8
          this._lastKnownPlayer.copy(playerObject.position)
          audioManager.playMonsterAlert(this._position.x, this._position.z)
          hud.scare()
        } else {
          this._updatePatrol(delta)
        }
        break

      case 'ALERT':
        this._updateAlert(delta)
        if (this._alertTimer <= 0 && this._state === 'CHASE') {
          audioManager.startMonsterChase(this._position.x, this._position.z)
        }
        break

      case 'CHASE':
        audioManager.updateChasePosition(this._position.x, this._position.z)
        this._updateChase(delta)
        break

      case 'SEARCH':
        audioManager.stopMonsterChase()
        this._updateSearch(delta)
        if (this._canSee) {
          this._state = 'CHASE'
          this._memoryTimer = MEMORY_TIME
          audioManager.playMonsterAlert(this._position.x, this._position.z)
        }
        break

      case 'LOST':
        audioManager.stopMonsterChase()
        this._updateLost(delta)
        if (this._canSee) {
          this._state = 'ALERT'
          this._alertTimer = 0.8
          this._lastKnownPlayer.copy(playerObject.position)
          audioManager.playMonsterAlert(this._position.x, this._position.z)
          hud.scare()
        }
        break
    }

    this._sprite.position.copy(this._position)

    if (this._state !== 'PATROL' && this._state !== 'LOST') {
      const lenSq = dx * dx + dz * dz
      if (lenSq > 0.01) {
        this._yaw = Math.atan2(dx, dz)
      }
    }
  }
}
