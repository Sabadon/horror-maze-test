// LightFlicker — two-state machine per light
//
// NORMAL:   subtle multi-frequency noise keeps the light feeling alive
// STUTTER:  occasional rapid on/off sequence (the fixture dying briefly)
//           triggered randomly every 3–8 s, independent per instance

export class LightFlicker {
  constructor(light, baseIntensity) {
    this.light = light
    this.base  = baseIntensity

    this._state       = 'NORMAL'
    this._idleTimer   = 0
    this._nextStutter = _randInterval()

    // Stutter playback
    this._seq     = []   // [{intensity, duration}]
    this._seqIdx  = 0
    this._seqTime = 0
  }

  update(delta, elapsed) {
    if (this._state === 'NORMAL') {
      // Multi-frequency sine noise + a touch of white noise
      const noise = Math.sin(elapsed * 17.3) * 0.07
                  + Math.sin(elapsed * 31.7) * 0.03
                  + (Math.random() - 0.5)   * 0.04
      this.light.intensity = Math.max(0, this.base * (1 + noise))

      this._idleTimer += delta
      if (this._idleTimer >= this._nextStutter) {
        this._idleTimer   = 0
        this._nextStutter = _randInterval()
        this._beginStutter()
      }
    } else {
      // Advance through the stutter sequence
      this._seqTime += delta
      const step = this._seq[this._seqIdx]
      this.light.intensity = this.base * step.intensity

      if (this._seqTime >= step.duration) {
        this._seqTime -= step.duration
        this._seqIdx++
        if (this._seqIdx >= this._seq.length) {
          this._state = 'NORMAL'
          this.light.intensity = this.base
        }
      }
    }
  }

  _beginStutter() {
    this._state   = 'STUTTER'
    this._seqIdx  = 0
    this._seqTime = 0

    // Build a randomised on/off sequence
    const seq = []
    const flashes = 2 + Math.floor(Math.random() * 4)
    for (let i = 0; i < flashes; i++) {
      seq.push({ intensity: 0,   duration: 0.04 + Math.random() * 0.07 })
      seq.push({ intensity: 1,   duration: 0.03 + Math.random() * 0.08 })
    }
    seq.push({ intensity: 0,   duration: 0.06 })   // final dark beat
    this._seq = seq
  }
}

function _randInterval() {
  return 3 + Math.random() * 5   // 3–8 s between stutters
}
