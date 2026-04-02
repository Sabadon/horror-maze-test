import * as THREE from 'three'
import { scene } from './scene.js'
import { cameraHolder } from './camera.js'
import { LightFlicker } from './lightFlicker.js'
import { grid, CELL_SIZE, WALL_HEIGHT } from '../levels/level01.js'

const C = CELL_SIZE
const H = WALL_HEIGHT

function findLightCells(g, minSpacing = 3) {
  const rows = g.length, cols = g[0].length
  const placed = []

  for (let r = 1; r < rows - 1; r++) {
    for (let c = 1; c < cols - 1; c++) {
      if (g[r][c] === 1) continue

      const tooClose = placed.some(
        ([pr, pc]) => Math.abs(r - pr) + Math.abs(c - pc) < minSpacing
      )
      if (tooClose) continue

      const openNeighbours = [[-1,0],[1,0],[0,-1],[0,1]]
        .filter(([dr, dc]) => g[r + dr][c + dc] === 0).length

      if (openNeighbours >= 2) placed.push([r, c])
    }
  }
  return placed
}

// Returns { flickerers, sceneObjects, holderObjects } for cleanup on rebuild
export function setupAtmosphere() {
  scene.background = new THREE.Color(0x000000)
  scene.fog = new THREE.FogExp2(0x000000, 0.12)

  const flickerers    = []
  const sceneObjects  = []
  const holderObjects = []

  const ambient = new THREE.AmbientLight(0x222233, 5.0)
  scene.add(ambient)
  sceneObjects.push(ambient)

  for (const [r, c] of findLightCells(grid)) {
    const light = new THREE.PointLight(0xff8822, 3.5, 14, 2)
    light.position.set((c + 0.5) * C, H - 0.35, (r + 0.5) * C)
    scene.add(light)
    sceneObjects.push(light)
    flickerers.push(new LightFlicker(light, 2.5))
  }

  const torch = new THREE.PointLight(0xffddaa, 2.0, 10, 2)
  cameraHolder.add(torch)
  holderObjects.push(torch)
  flickerers.push(new LightFlicker(torch, 2.0))

  return { flickerers, sceneObjects, holderObjects }
}
