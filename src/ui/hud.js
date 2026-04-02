let _wrapper, _vignette, _pauseEl
let _intensity = 0

export const hud = {
  init() {
    _wrapper = document.createElement('div')
    _wrapper.style.cssText = 'position:absolute;inset:0;pointer-events:none;display:none;'

    _vignette = document.createElement('div')
    _vignette.id = 'vignette'
    _vignette.style.opacity = '0.45'

    const crosshair = document.createElement('div')
    crosshair.id = 'crosshair'

    _pauseEl = document.createElement('div')
    _pauseEl.id = 'paused-text'
    _pauseEl.textContent = 'PAUSED — CLICK TO RESUME'

    _wrapper.append(_vignette, crosshair, _pauseEl)
    document.getElementById('ui').appendChild(_wrapper)
  },

  setVisible(v)  { _wrapper.style.display = v ? 'block' : 'none' },
  showPaused(v)  { _pauseEl.style.display = v ? 'block' : 'none' },
  scare()        { _intensity = 1.0 },

  update(delta) {
    _intensity = Math.max(0, _intensity - delta * 0.3)
    _vignette.style.opacity = String(0.45 + _intensity * 0.45)
  },
}
