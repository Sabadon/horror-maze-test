import * as THREE from 'three'
import { camera, playerObject } from '../core/camera.js'
import { isPointerLocked } from '../core/input.js'
import { getState } from '../core/gameStateManager.js'

// ---- Audio ----
function _playLaserFire(ctx, master) {
  const now = ctx.currentTime

  // Energy charge whip: quick high sweep
  const sweep = ctx.createOscillator()
  sweep.type = 'sawtooth'
  sweep.frequency.setValueAtTime(200, now)
  sweep.frequency.exponentialRampToValueAtTime(3200, now + 0.08)
  sweep.frequency.exponentialRampToValueAtTime(800, now + 0.18)
  const sweepGain = ctx.createGain()
  sweepGain.gain.setValueAtTime(0.5, now)
  sweepGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22)
  const sweepDist = ctx.createWaveShaper()
  sweepDist.curve = _distCurve(80)
  sweep.connect(sweepDist); sweepDist.connect(sweepGain); sweepGain.connect(master)
  sweep.start(now); sweep.stop(now + 0.25)

  // Snap of electricity
  const noise = ctx.createBufferSource()
  noise.buffer = _noiseBuffer(ctx, 0.12)
  const snapFilt = ctx.createBiquadFilter()
  snapFilt.type = 'bandpass'; snapFilt.frequency.value = 4800; snapFilt.Q.value = 1.5
  const snapGain = ctx.createGain()
  snapGain.gain.setValueAtTime(0.7, now)
  snapGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12)
  noise.connect(snapFilt); snapFilt.connect(snapGain); snapGain.connect(master)
  noise.start(now)

  // Sub thump kick
  const thump = ctx.createOscillator()
  thump.type = 'sine'
  thump.frequency.setValueAtTime(180, now)
  thump.frequency.exponentialRampToValueAtTime(30, now + 0.15)
  const thumpGain = ctx.createGain()
  thumpGain.gain.setValueAtTime(1.2, now)
  thumpGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18)
  thump.connect(thumpGain); thumpGain.connect(master)
  thump.start(now); thump.stop(now + 0.2)
}

function _playExplosion(ctx, master) {
  const now = ctx.currentTime

  // Big low boom
  const boom = ctx.createOscillator()
  boom.type = 'sine'
  boom.frequency.setValueAtTime(90, now)
  boom.frequency.exponentialRampToValueAtTime(18, now + 0.6)
  const boomGain = ctx.createGain()
  boomGain.gain.setValueAtTime(2.0, now)
  boomGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.7)
  boom.connect(boomGain); boomGain.connect(master)
  boom.start(now); boom.stop(now + 0.75)

  // Rumble noise body
  const rumble = ctx.createBufferSource()
  rumble.buffer = _noiseBuffer(ctx, 0.9)
  const rumbleLp = ctx.createBiquadFilter()
  rumbleLp.type = 'lowpass'; rumbleLp.frequency.value = 350
  const rumbleGain = ctx.createGain()
  rumbleGain.gain.setValueAtTime(1.4, now)
  rumbleGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.85)
  rumble.connect(rumbleLp); rumbleLp.connect(rumbleGain); rumbleGain.connect(master)
  rumble.start(now)

  // Mid crack
  const crack = ctx.createBufferSource()
  crack.buffer = _noiseBuffer(ctx, 0.2)
  const crackBp = ctx.createBiquadFilter()
  crackBp.type = 'bandpass'; crackBp.frequency.value = 1800; crackBp.Q.value = 2
  const crackGain = ctx.createGain()
  crackGain.gain.setValueAtTime(1.8, now)
  crackGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2)
  crack.connect(crackBp); crackBp.connect(crackGain); crackGain.connect(master)
  crack.start(now)

  // High sizzle tail
  const sizzle = ctx.createBufferSource()
  sizzle.buffer = _noiseBuffer(ctx, 1.2)
  const sizzleHp = ctx.createBiquadFilter()
  sizzleHp.type = 'highpass'; sizzleHp.frequency.value = 3500
  const sizzleGain = ctx.createGain()
  sizzleGain.gain.setValueAtTime(0.4, now + 0.05)
  sizzleGain.gain.exponentialRampToValueAtTime(0.0001, now + 1.1)
  sizzle.connect(sizzleHp); sizzleHp.connect(sizzleGain); sizzleGain.connect(master)
  sizzle.start(now + 0.05)
}

function _noiseBuffer(ctx, seconds) {
  const len = Math.floor(ctx.sampleRate * seconds)
  const buf = ctx.createBuffer(1, len, ctx.sampleRate)
  const d   = buf.getChannelData(0)
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
  return buf
}

function _distCurve(amount) {
  const n = 256, curve = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / n - 1
    curve[i] = ((Math.PI + amount) * x) / (Math.PI + amount * Math.abs(x))
  }
  return curve
}

// ---- Explosion particles ----
class Explosion {
  constructor(scene, pos) {
    this._scene    = scene
    this._elapsed  = 0
    this._life     = 0.55
    this._particles = []

    const count = 18
    for (let i = 0; i < count; i++) {
      const speed = 4 + Math.random() * 10
      const vel   = new THREE.Vector3(
        (Math.random() - 0.5) * 2,
        (Math.random() - 0.5) * 2,
        (Math.random() - 0.5) * 2
      ).normalize().multiplyScalar(speed)

      const size = 0.04 + Math.random() * 0.1
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(size, 4, 3),
        new THREE.MeshBasicMaterial({
          color: i < 6 ? 0xffffff : i < 12 ? 0x00ffff : 0x0044ff,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          transparent: true,
        })
      )
      mesh.position.copy(pos)
      mesh.renderOrder = 1002
      scene.add(mesh)
      this._particles.push({ mesh, vel })
    }

    // Flash sphere
    this._flash = new THREE.Mesh(
      new THREE.SphereGeometry(0.5, 8, 6),
      new THREE.MeshBasicMaterial({
        color: 0x88ffff, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 1
      })
    )
    this._flash.position.copy(pos)
    this._flash.renderOrder = 1003
    scene.add(this._flash)
  }

  update(delta) {
    this._elapsed += delta
    const t    = this._elapsed / this._life
    const fade = 1 - t

    this._flash.material.opacity = Math.max(0, 1 - t * 6)
    this._flash.scale.setScalar(1 + t * 3)

    for (const { mesh, vel } of this._particles) {
      mesh.position.addScaledVector(vel, delta)
      vel.multiplyScalar(0.88) // drag
      mesh.material.opacity = fade
    }

    return this._elapsed >= this._life
  }

  destroy() {
    for (const { mesh } of this._particles) {
      this._scene.remove(mesh)
      mesh.geometry.dispose()
      mesh.material.dispose()
    }
    this._scene.remove(this._flash)
    this._flash.geometry.dispose()
    this._flash.material.dispose()
  }
}

// ---- Beam ----
const _up = new THREE.Vector3(0, 1, 0)

function _beamQuat(dir) {
  const q = new THREE.Quaternion()
  if (Math.abs(dir.y) > 0.999) {
    q.setFromAxisAngle(new THREE.Vector3(1, 0, 0), dir.y > 0 ? 0 : Math.PI)
  } else {
    q.setFromUnitVectors(_up, dir)
  }
  return q
}

class Beam {
  constructor(scene, origin, dir, hitPoint) {
    const length = hitPoint
      ? origin.distanceTo(hitPoint)
      : 40
    const mid = origin.clone().addScaledVector(dir, length / 2)
    const q   = _beamQuat(dir)

    function makeCyl(rTop, rBot, len, segs, color, opacity) {
      const mesh = new THREE.Mesh(
        new THREE.CylinderGeometry(rTop, rBot, len, segs, 1),
        new THREE.MeshBasicMaterial({
          color, transparent: true, opacity,
          blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
        })
      )
      mesh.position.copy(mid)
      mesh.quaternion.copy(q)
      mesh.renderOrder = 1000
      return mesh
    }

    this._core  = makeCyl(0.015, 0.015, length, 5, 0xeeffff, 1.0)
    this._mid   = makeCyl(0.07,  0.07,  length, 6, 0x00ffff, 0.35)
    this._outer = makeCyl(0.30,  0.30,  length, 6, 0x0044ff, 0.12)

    this._flash = new THREE.Mesh(
      new THREE.SphereGeometry(0.06, 6, 4),
      new THREE.MeshBasicMaterial({ color: 0xffffff, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 1 })
    )
    this._flash.position.copy(origin)
    this._flash.renderOrder = 1001

    scene.add(this._core, this._mid, this._outer, this._flash)
    this._scene   = scene
    this._life    = 0.12
    this._elapsed = 0
  }

  update(delta) {
    this._elapsed += delta
    const fade = 1 - Math.min(this._elapsed / this._life, 1)
    this._core.material.opacity  = fade
    this._mid.material.opacity   = 0.35 * fade
    this._outer.material.opacity = 0.12 * fade
    this._flash.material.opacity = Math.max(0, 1 - this._elapsed / (this._life * 0.3))
    return this._elapsed >= this._life
  }

  destroy() {
    this._scene.remove(this._core, this._mid, this._outer, this._flash)
    ;[this._core, this._mid, this._outer, this._flash].forEach(m => {
      m.geometry.dispose(); m.material.dispose()
    })
  }
}

// ---- Raycaster ----
const _raycaster = new THREE.Raycaster()
const _rayOrigin = new THREE.Vector3()
const _rayDir    = new THREE.Vector3()

// ---- Gun offset (lower-right, gun barrel feel) ----
const _right = new THREE.Vector3()
const _camUp = new THREE.Vector3()

function _gunOrigin(camPos, camDir) {
  // Right vector from camera
  _right.crossVectors(camDir, new THREE.Vector3(0, 1, 0)).normalize()
  _camUp.crossVectors(_right, camDir).normalize()

  return camPos.clone()
    .addScaledVector(_right,  0.28)   // shift right
    .addScaledVector(_camUp, -0.22)   // shift down
    .addScaledVector(camDir,  0.5)    // push forward
}

// ---- LaserGun ----
export class LaserGun {
  constructor(scene, collidables) {
    this._scene      = scene
    this._collidables = collidables  // array of THREE.Mesh for raycast
    this._beams      = []
    this._explosions = []
    this._cooldown   = 0
    this._audioCtx   = null
    this._master     = null

    document.addEventListener('mousedown', e => {
      if (e.button !== 0) return
      if (!isPointerLocked || getState() !== 'PLAYING') return
      this._fire()
    })
  }

  _ensureAudio() {
    if (this._audioCtx) return
    // Piggyback on existing AudioContext if possible
    try {
      this._audioCtx = new (window.AudioContext || window.webkitAudioContext)()
      this._master = this._audioCtx.createGain()
      this._master.gain.value = 1.0
      this._master.connect(this._audioCtx.destination)
    } catch(e) {}
  }

  _fire() {
    if (this._cooldown > 0) return
    this._cooldown = 0.15
    this._ensureAudio()

    const camPos = new THREE.Vector3()
    const camDir = new THREE.Vector3()
    camera.getWorldPosition(camPos)
    camera.getWorldDirection(camDir)

    const origin = _gunOrigin(camPos, camDir)

    // Raycast from screen center for accuracy, but beam renders from gun
    _raycaster.set(camPos, camDir)
    _raycaster.far = 40
    let hitPoint = null
    if (this._collidables.length) {
      const hits = _raycaster.intersectObjects(this._collidables, false)
      if (hits.length) hitPoint = hits[0].point
    }

    if (this._audioCtx) _playLaserFire(this._audioCtx, this._master)

    this._beams.push(new Beam(this._scene, origin, camDir, hitPoint))

    if (hitPoint) {
      this._explosions.push(new Explosion(this._scene, hitPoint))
      if (this._audioCtx) {
        setTimeout(() => _playExplosion(this._audioCtx, this._master), 30)
      }
    }
  }

  update(delta) {
    this._cooldown = Math.max(0, this._cooldown - delta)

    this._beams = this._beams.filter(b => {
      const done = b.update(delta)
      if (done) b.destroy()
      return !done
    })
    this._explosions = this._explosions.filter(e => {
      const done = e.update(delta)
      if (done) e.destroy()
      return !done
    })
  }
}
