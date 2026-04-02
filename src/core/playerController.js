import * as THREE from 'three'
import { playerObject, cameraHolder } from './camera.js'
import { getKeys, consumeMouseDelta } from './input.js'

const MOUSE_SENSITIVITY = 0.002
const MOVE_SPEED        = 4.0
const SPRINT_MULTIPLIER = 1.8
const PITCH_LIMIT       = Math.PI / 2 - 0.05
const PLAYER_RADIUS     = 0.35  // collision footprint half-size

let yaw   = 0
let pitch = 0

const _forward = new THREE.Vector3()
const _right   = new THREE.Vector3()
const _moveDir = new THREE.Vector3()

// Injected by main.js after the level is built
let _isWall = () => false
export function setCollisionFn(fn) { _isWall = fn }

function blocked(x, z) {
  const R = PLAYER_RADIUS
  return (
    _isWall(x + R, z + R) ||
    _isWall(x + R, z - R) ||
    _isWall(x - R, z + R) ||
    _isWall(x - R, z - R)
  )
}

export function updatePlayer(delta) {
  // --- Mouse look ---
  const { dx, dy } = consumeMouseDelta()
  yaw   -= dx * MOUSE_SENSITIVITY
  pitch -= dy * MOUSE_SENSITIVITY
  pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, pitch))

  playerObject.rotation.set(0, yaw, 0)
  cameraHolder.rotation.set(pitch, 0, 0)

  // --- WASD movement ---
  const keys    = getKeys()
  const sprinting = keys['ShiftLeft'] || keys['ShiftRight']
  const speed   = MOVE_SPEED * (sprinting ? SPRINT_MULTIPLIER : 1)

  _forward.set(0, 0, -1).applyEuler(playerObject.rotation)
  _forward.y = 0
  _forward.normalize()

  _right.set(1, 0, 0).applyEuler(playerObject.rotation)
  _right.y = 0
  _right.normalize()

  _moveDir.set(0, 0, 0)
  if (keys['KeyW'] || keys['ArrowUp'])    _moveDir.addScaledVector(_forward,  1)
  if (keys['KeyS'] || keys['ArrowDown'])  _moveDir.addScaledVector(_forward, -1)
  if (keys['KeyA'] || keys['ArrowLeft'])  _moveDir.addScaledVector(_right,   -1)
  if (keys['KeyD'] || keys['ArrowRight']) _moveDir.addScaledVector(_right,    1)

  if (_moveDir.lengthSq() === 0) return
  _moveDir.normalize()

  const pos = playerObject.position
  const dx2 = _moveDir.x * speed * delta
  const dz  = _moveDir.z * speed * delta

  // Try X axis independently
  if (!blocked(pos.x + dx2, pos.z)) pos.x += dx2

  // Try Z axis independently
  if (!blocked(pos.x, pos.z + dz)) pos.z += dz
}
