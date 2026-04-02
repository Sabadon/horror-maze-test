// States: 'MENU' | 'PLAYING' | 'PAUSED' | 'GAME_OVER' | 'ESCAPED'

const _listeners = []
let _state = 'MENU'

export function getState() { return _state }

export function setState(s) {
  if (_state === s) return
  _state = s
  for (const fn of _listeners) fn(s)
}

export function onChange(fn) { _listeners.push(fn) }
