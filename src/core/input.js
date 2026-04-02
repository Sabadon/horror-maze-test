const keys = {}
let _dx = 0
let _dy = 0
export let isPointerLocked = false

document.addEventListener('keydown', e => { keys[e.code] = true })
document.addEventListener('keyup',   e => { keys[e.code] = false })

document.addEventListener('pointerlockchange', () => {
  isPointerLocked = document.pointerLockElement === document.getElementById('game')
})

document.addEventListener('mousemove', e => {
  if (!isPointerLocked) return
  _dx += e.movementX
  _dy += e.movementY
})

document.getElementById('game').addEventListener('click', () => {
  document.getElementById('game').requestPointerLock()
})

export function getKeys() {
  return keys
}

// Consume accumulated mouse delta — call once per frame
export function consumeMouseDelta() {
  const dx = _dx
  const dy = _dy
  _dx = 0
  _dy = 0
  return { dx, dy }
}
