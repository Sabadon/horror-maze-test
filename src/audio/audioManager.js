// All audio is procedural Web Audio API — no external files required.
//
// Sounds:
//   Ambient  — layered detuned oscillators + brown noise + random drip plinks
//   Footstep — decaying noise burst through bandpass filter, pitch-varied
//   Sting    — low thump + high bandpass noise screech (jump-scare trigger)
//   Growl    — positional filtered noise, ready for Phase 6 monster
//
// AudioContext is created on first user gesture (init()) to satisfy
// browser autoplay policy.  Safe to call init() multiple times.

const FOOTSTEP_DIST = 0.65   // world units between stone footstep sounds

class AudioManager {
  constructor() {
    this._ctx      = null
    this._master   = null
    this._ready    = false

    // Footstep tracking (plain numbers — no THREE dependency)
    this._prevX      = 0
    this._prevZ      = 0
    this._prevSet    = false
    this._distAccum  = 0
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  /** Call once from a user-gesture handler (e.g. canvas click). */
  init() {
    if (this._ctx) { this._ctx.resume(); return }

    this._ctx = new (window.AudioContext || window.webkitAudioContext)()

    this._master = this._ctx.createGain()
    this._master.gain.value = 1.0
    this._master.connect(this._ctx.destination)

    this._startAmbient()
    this._scheduleDrip()
    this._ready = true
  }

  mute()   { if (this._master) this._master.gain.setTargetAtTime(0, this._ctx.currentTime, 0.1) }
  unmute() { if (this._master) this._master.gain.setTargetAtTime(1, this._ctx.currentTime, 0.1) }

  /**
   * Call every frame.
   * playerPos  — THREE.Vector3  (world position)
   * cameraFwd  — THREE.Vector3  (normalised world-space forward from camera)
   */
  update(playerPos, cameraFwd) {
    if (!this._ready) return

    // 3D listener — keeps positional audio in sync with the camera
    const L  = this._ctx.listener
    const px = playerPos.x, py = playerPos.y + 1.7, pz = playerPos.z
    const fx = cameraFwd.x, fy = cameraFwd.y,       fz = cameraFwd.z

    if (L.positionX !== undefined) {
      // Modern API
      L.positionX.value = px; L.positionY.value = py; L.positionZ.value = pz
      L.forwardX.value  = fx; L.forwardY.value  = fy; L.forwardZ.value  = fz
      L.upX.value = 0;        L.upY.value = 1;         L.upZ.value = 0
    } else {
      // Legacy fallback
      L.setPosition(px, py, pz)
      L.setOrientation(fx, fy, fz, 0, 1, 0)
    }

    // Footstep accumulator
    if (!this._prevSet) {
      this._prevX   = playerPos.x
      this._prevZ   = playerPos.z
      this._prevSet = true
      return
    }

    const dx = playerPos.x - this._prevX
    const dz = playerPos.z - this._prevZ
    const moved = Math.sqrt(dx * dx + dz * dz)
    this._prevX = playerPos.x
    this._prevZ = playerPos.z

    if (moved > 0.001) {
      this._distAccum += moved
      while (this._distAccum >= FOOTSTEP_DIST) {
        this._distAccum -= FOOTSTEP_DIST
        this._playFootstep()
      }
    }
  }

  /** Short sharp burst — call when monster first spots the player. */
  playSting() {
    if (!this._ready) return
    const ctx = this._ctx, now = ctx.currentTime

    // Low-frequency impact thump
    const thump = ctx.createOscillator()
    thump.type = 'sine'
    thump.frequency.setValueAtTime(75, now)
    thump.frequency.exponentialRampToValueAtTime(22, now + 0.35)
    const thumpGain = ctx.createGain()
    thumpGain.gain.setValueAtTime(1.1, now)
    thumpGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.4)
    thump.connect(thumpGain)
    thumpGain.connect(this._master)
    thump.start(now); thump.stop(now + 0.45)

    // High-frequency noise screech
    const src = ctx.createBufferSource()
    src.buffer = this._noiseBuffer(1.6)
    const filt = ctx.createBiquadFilter()
    filt.type = 'bandpass'
    filt.frequency.value = 2600
    filt.Q.value = 6
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.9, now)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.6)
    src.connect(filt); filt.connect(gain); gain.connect(this._master)
    src.start(now)
  }

  /**
   * Non-positional ragged breathing — plays whenever the monster appears,
   * even if it's behind the player.  Two-phase inhale/exhale with low moan.
   */
  playBreathing() {
    if (!this._ready) return
    const ctx = this._ctx, now = ctx.currentTime

    // --- Inhale (0 – 1 s): bandpass noise at chest resonance + high rasp ---
    const inhaleNoise = ctx.createBufferSource()
    inhaleNoise.buffer = this._noiseBuffer(1.2)

    const inhaleFilt = ctx.createBiquadFilter()
    inhaleFilt.type = 'bandpass'
    inhaleFilt.frequency.value = 420
    inhaleFilt.Q.value = 3.5

    const inhaleGain = ctx.createGain()
    inhaleGain.gain.setValueAtTime(0, now)
    inhaleGain.gain.linearRampToValueAtTime(0.38, now + 0.5)
    inhaleGain.gain.linearRampToValueAtTime(0, now + 1.0)

    // Raspy hiss layer on top of inhale
    const raspFilt = ctx.createBiquadFilter()
    raspFilt.type = 'bandpass'
    raspFilt.frequency.value = 2400
    raspFilt.Q.value = 9

    const raspGain = ctx.createGain()
    raspGain.gain.setValueAtTime(0, now)
    raspGain.gain.linearRampToValueAtTime(0.13, now + 0.45)
    raspGain.gain.linearRampToValueAtTime(0, now + 1.0)

    inhaleNoise.connect(inhaleFilt); inhaleFilt.connect(inhaleGain); inhaleGain.connect(this._master)
    inhaleNoise.connect(raspFilt);   raspFilt.connect(raspGain);     raspGain.connect(this._master)
    inhaleNoise.start(now)

    // --- Exhale (1.0 – 2.3 s): lower, wetter, heavier ---
    const exhaleNoise = ctx.createBufferSource()
    exhaleNoise.buffer = this._noiseBuffer(1.5)

    const exhaleFilt = ctx.createBiquadFilter()
    exhaleFilt.type = 'bandpass'
    exhaleFilt.frequency.value = 270
    exhaleFilt.Q.value = 4.5

    const exhaleGain = ctx.createGain()
    exhaleGain.gain.setValueAtTime(0, now + 1.0)
    exhaleGain.gain.linearRampToValueAtTime(0.48, now + 1.5)
    exhaleGain.gain.exponentialRampToValueAtTime(0.0001, now + 2.35)

    exhaleNoise.connect(exhaleFilt); exhaleFilt.connect(exhaleGain); exhaleGain.connect(this._master)
    exhaleNoise.start(now + 1.0)

    // --- Low moan undertone that pulses with the breath ---
    const moan = ctx.createOscillator()
    moan.type = 'sine'
    moan.frequency.setValueAtTime(74, now)
    moan.frequency.linearRampToValueAtTime(68, now + 2.4)

    const moanGain = ctx.createGain()
    moanGain.gain.setValueAtTime(0, now)
    moanGain.gain.linearRampToValueAtTime(0.09, now + 0.5)
    moanGain.gain.linearRampToValueAtTime(0.05, now + 1.0)
    moanGain.gain.linearRampToValueAtTime(0.12, now + 1.8)
    moanGain.gain.exponentialRampToValueAtTime(0.0001, now + 2.45)

    moan.connect(moanGain); moanGain.connect(this._master)
    moan.start(now); moan.stop(now + 2.5)
  }

  /**
   * Positional monster growl — stub ready for Phase 6.
   * worldPos — THREE.Vector3
   */
  playGrowl(worldPos) {
    if (!this._ready) return
    const ctx = this._ctx, now = ctx.currentTime
    const dur = 1.0 + Math.random() * 0.8

    const src = ctx.createBufferSource()
    src.buffer = this._noiseBuffer(dur + 0.3)

    // Formant filter gives guttural texture
    const filt = ctx.createBiquadFilter()
    filt.type = 'bandpass'
    filt.frequency.setValueAtTime(130, now)
    filt.frequency.linearRampToValueAtTime(80, now + dur)
    filt.Q.value = 9

    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0, now)
    gain.gain.linearRampToValueAtTime(0.65, now + 0.08)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + dur)

    // HRTF panner for 3D positioning
    const panner = ctx.createPanner()
    panner.panningModel  = 'HRTF'
    panner.distanceModel = 'inverse'
    panner.refDistance   = 1
    panner.maxDistance   = 24
    panner.rolloffFactor = 1.2
    if (panner.positionX !== undefined) {
      panner.positionX.value = worldPos.x
      panner.positionY.value = worldPos.y + 1.0
      panner.positionZ.value = worldPos.z
    } else {
      panner.setPosition(worldPos.x, worldPos.y + 1.0, worldPos.z)
    }

    src.connect(filt); filt.connect(gain)
    gain.connect(panner); panner.connect(this._master)
    src.start(now)
  }

  // -------------------------------------------------------------------------
  // Private — ambient
  // -------------------------------------------------------------------------

  _startAmbient() {
    const ctx = this._ctx

    // Ambient submix with slow breathing LFO
    const ambGain = ctx.createGain()
    ambGain.gain.value = 0.78
    ambGain.connect(this._master)

    const breathLfo = ctx.createOscillator()
    breathLfo.frequency.value = 0.07
    const breathDepth = ctx.createGain()
    breathDepth.gain.value = 0.16     // base ± 0.16 → [0.62 , 0.94]
    breathLfo.connect(breathDepth)
    breathDepth.connect(ambGain.gain)
    breathLfo.start()

    // Detuned sawtooth drone (sewer machinery hum)
    ;[43, 47, 53, 68].forEach((freq, i) => {
      const osc = ctx.createOscillator()
      osc.type = 'sawtooth'
      osc.frequency.value = freq

      // Individual slow pitch drift
      const drift = ctx.createOscillator()
      drift.frequency.value = 0.04 + i * 0.03
      const driftDepth = ctx.createGain()
      driftDepth.gain.value = 0.5
      drift.connect(driftDepth)
      driftDepth.connect(osc.frequency)
      drift.start()

      const filt = ctx.createBiquadFilter()
      filt.type = 'lowpass'
      filt.frequency.value = 190
      filt.Q.value = 2

      const gain = ctx.createGain()
      gain.gain.value = 0.04

      osc.connect(filt); filt.connect(gain); gain.connect(ambGain)
      osc.start()
    })

    // Brown noise layer (distant water rushing / ventilation)
    const noiseSrc = ctx.createBufferSource()
    noiseSrc.buffer = this._brownNoiseBuffer(5)
    noiseSrc.loop = true

    const noiseHp = ctx.createBiquadFilter()
    noiseHp.type = 'highpass'
    noiseHp.frequency.value = 60

    const noiseGain = ctx.createGain()
    noiseGain.gain.value = 0.07

    noiseSrc.connect(noiseHp); noiseHp.connect(noiseGain); noiseGain.connect(ambGain)
    noiseSrc.start()
  }

  // -------------------------------------------------------------------------
  // Private — drips
  // -------------------------------------------------------------------------

  _scheduleDrip() {
    const delay = 1800 + Math.random() * 7000
    setTimeout(() => {
      if (this._ready) this._playDrip()
      this._scheduleDrip()
    }, delay)
  }

  _playDrip() {
    const ctx = this._ctx, now = ctx.currentTime
    const baseFreq = 650 + Math.random() * 700

    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(baseFreq, now)
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.55, now + 0.06)

    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0, now)
    gain.gain.linearRampToValueAtTime(0.1 + Math.random() * 0.06, now + 0.004)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.45)

    osc.connect(gain); gain.connect(this._master)
    osc.start(now); osc.stop(now + 0.5)
  }

  // -------------------------------------------------------------------------
  // Private — footstep
  // -------------------------------------------------------------------------

  _playFootstep() {
    const ctx = this._ctx, now = ctx.currentTime

    // Decaying noise burst — stone floor
    const dur    = 0.06 + Math.random() * 0.04
    const len    = Math.floor(ctx.sampleRate * dur)
    const buf    = ctx.createBuffer(1, len, ctx.sampleRate)
    const d      = buf.getChannelData(0)
    const decay  = ctx.sampleRate * (0.015 + Math.random() * 0.02)
    for (let i = 0; i < len; i++) {
      d[i] = (Math.random() * 2 - 1) * Math.exp(-i / decay)
    }

    const src = ctx.createBufferSource()
    src.buffer = buf
    src.playbackRate.value = 0.7 + Math.random() * 0.6   // pitch variety

    const filt = ctx.createBiquadFilter()
    filt.type = 'bandpass'
    filt.frequency.value = 110 + Math.random() * 130
    filt.Q.value = 1.4

    const gain = ctx.createGain()
    gain.gain.value = 0.5

    src.connect(filt); filt.connect(gain); gain.connect(this._master)
    src.start(now)
  }

  // -------------------------------------------------------------------------
  // Private — buffer helpers
  // -------------------------------------------------------------------------

  /** White noise buffer */
  _noiseBuffer(seconds) {
    const ctx = this._ctx
    const len = Math.floor(ctx.sampleRate * seconds)
    const buf = ctx.createBuffer(1, len, ctx.sampleRate)
    const d   = buf.getChannelData(0)
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
    return buf
  }

  /** Brown noise buffer (integrated white noise — more low-frequency rumble) */
  _brownNoiseBuffer(seconds) {
    const ctx = this._ctx
    const len = Math.floor(ctx.sampleRate * seconds)
    const buf = ctx.createBuffer(1, len, ctx.sampleRate)
    const d   = buf.getChannelData(0)
    let last  = 0
    for (let i = 0; i < len; i++) {
      const white = (Math.random() * 2 - 1) * 0.1
      last = (last + 0.02 * white) / 1.02
      d[i] = last * 3.5   // normalise amplitude
    }
    return buf
  }
}

export const audioManager = new AudioManager()
