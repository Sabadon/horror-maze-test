import * as THREE from 'three'

const canvas = document.getElementById('game')

export const renderer = new THREE.WebGLRenderer({ canvas, antialias: false })

// PSX-style: fixed 320×240 internal resolution, CSS upscales with nearest-neighbor
renderer.setSize(320, 240, false)   // false = don't touch CSS size
renderer.setPixelRatio(1)
renderer.shadowMap.enabled = false  // no shadows — authentic PSX look

canvas.style.imageRendering = 'pixelated'
