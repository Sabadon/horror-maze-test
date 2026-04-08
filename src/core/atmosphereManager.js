import * as THREE from 'three'
import { scene } from './scene.js'
import { cameraHolder } from './camera.js'
import { LightFlicker } from './lightFlicker.js'
import { grid, CELL_SIZE, WALL_HEIGHT } from '../levels/level01.js'

const C = CELL_SIZE
const H = WALL_HEIGHT

function findLightCells(g, minSpacing = 5) {
  const rows = g.length, cols = g[0].length
  const gridMarks = new Uint8Array(rows * cols)
  const placed = []

  function markArea(r, c) {
    for (let dr = -minSpacing; dr <= minSpacing; dr++) {
      for (let dc = -minSpacing; dc <= minSpacing; dc++) {
        const nr = r + dr, nc = c + dc
        if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
          gridMarks[nr * cols + nc] = 1
        }
      }
    }
  }

  for (let r = 1; r < rows - 1; r++) {
    for (let c = 1; c < cols - 1; c++) {
      if (g[r][c] === 1) continue
      if (gridMarks[r * cols + c]) continue

      const openNeighbours = [[-1,0],[1,0],[0,-1],[0,1]]
        .filter(([dr, dc]) => g[r + dr][c + dc] === 0).length

      if (openNeighbours >= 3) {
        placed.push([r, c])
        markArea(r, c)
      }
    }
  }
  return placed
}

export function setupAtmosphere() {
  scene.background = new THREE.Color(0x000000)
  scene.fog = new THREE.FogExp2(0x000000, 0.06)

  const flickerers    = []
  const sceneObjects  = []
  const holderObjects = []

  const ambient = new THREE.AmbientLight(0x222233, 4.0)
  scene.add(ambient)
  sceneObjects.push(ambient)

  for (const [r, c] of findLightCells(grid)) {
    const light = new THREE.PointLight(0xff8822, 2.5, 12, 2)
    light.position.set((c + 0.5) * C, H - 0.35, (r + 0.5) * C)
    scene.add(light)
    sceneObjects.push(light)
    flickerers.push(new LightFlicker(light, 2.5))
  }

  const torch = new THREE.PointLight(0xffddaa, 1.8, 8, 2)
  cameraHolder.add(torch)
  holderObjects.push(torch)
  flickerers.push(new LightFlicker(torch, 2.0))

  return { flickerers, sceneObjects, holderObjects }
}
