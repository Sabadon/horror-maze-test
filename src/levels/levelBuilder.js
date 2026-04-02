import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { grid, CELL_SIZE, WALL_HEIGHT, START_CELL, EXIT_CELL } from './level01.js'
import { makeWallTexture, makeWallNormalMap, makeWallDisplacementMap, makeFloorTexture, makeCeilTexture } from '../core/textureGenerator.js'

const C = CELL_SIZE
const H = WALL_HEIGHT

// --- Collision ---

export function isWallAt(worldX, worldZ) {
  const col = Math.floor(worldX / C)
  const row = Math.floor(worldZ / C)
  if (row < 0 || row >= grid.length || col < 0 || col >= grid[0].length) return true
  return grid[row][col] === 1
}

export function getStartPosition() {
  return new THREE.Vector3(
    (START_CELL.col + 0.5) * C,
    0,
    (START_CELL.row + 0.5) * C
  )
}

export function getExitPosition() {
  return new THREE.Vector3(
    (EXIT_CELL.col + 0.5) * C,
    0,
    (EXIT_CELL.row + 0.5) * C
  )
}

// --- Geometry helpers ---

// 20 segments per side: each segment ≈ 0.15 m, bevel ramp ≈ 0.14 m → ~1 segment wide.
// More segments = smoother bevel but higher vertex count; 20 is a good balance.
const WALL_SEGS = 20

function wallFace(cx, cz, rotY) {
  const g = new THREE.PlaneGeometry(C, H, WALL_SEGS, WALL_SEGS)
  g.translate(0, H / 2, 0)
  if (rotY !== 0) g.rotateY(rotY)
  g.translate(cx, 0, cz)
  return g
}

// --- Level builder ---

export function buildLevel(scene) {
  const rows = grid.length
  const cols = grid[0].length

  const wallGeos  = []
  const floorGeos = []
  const ceilGeos  = []

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (grid[r][c] === 1) continue

      const cx = (c + 0.5) * C
      const cz = (r + 0.5) * C

      // Floor
      const fg = new THREE.PlaneGeometry(C, C)
      fg.rotateX(-Math.PI / 2)
      fg.translate(cx, 0, cz)
      floorGeos.push(fg)

      // Ceiling
      const cg = new THREE.PlaneGeometry(C, C)
      cg.rotateX(Math.PI / 2)
      cg.translate(cx, H, cz)
      ceilGeos.push(cg)

      // North wall (facing +Z into corridor)
      if (r === 0 || grid[r - 1][c] === 1)
        wallGeos.push(wallFace(cx, cz - C / 2, 0))

      // South wall (facing -Z into corridor)
      if (r === rows - 1 || grid[r + 1][c] === 1)
        wallGeos.push(wallFace(cx, cz + C / 2, Math.PI))

      // West wall (facing +X into corridor)
      if (c === 0 || grid[r][c - 1] === 1)
        wallGeos.push(wallFace(cx - C / 2, cz, Math.PI / 2))

      // East wall (facing -X into corridor)
      if (c === cols - 1 || grid[r][c + 1] === 1)
        wallGeos.push(wallFace(cx + C / 2, cz, -Math.PI / 2))
    }
  }

  // Textures — 64×64 procedural, NearestFilter for PSX look
  const wallTex  = makeWallTexture()
  const wallNorm = makeWallNormalMap()
  const wallDisp = makeWallDisplacementMap()
  const floorTex = makeFloorTexture()
  const ceilTex  = makeCeilTexture()

  // displacementScale: bricks protrude 0.12 m from the mortar plane toward the player.
  // displacementBias:  0 → mortar stays on the original wall plane (no recession).
  // normalMap stays in sync because both are derived from buildBrickHeightField().
  const wallMat  = new THREE.MeshPhongMaterial({
    map:               wallTex,
    normalMap:         wallNorm,
    normalScale:       new THREE.Vector2(1.5, 1.5),
    displacementMap:   wallDisp,
    displacementScale: 0.12,
    displacementBias:  0,
    shininess:         8,
    specular:          new THREE.Color(0x111111),
  })
  const floorMat = new THREE.MeshLambertMaterial({ map: floorTex })
  const ceilMat  = new THREE.MeshLambertMaterial({ map: ceilTex })

  const wallMesh  = new THREE.Mesh(mergeGeometries(wallGeos),  wallMat)
  const floorMesh = new THREE.Mesh(mergeGeometries(floorGeos), floorMat)
  const ceilMesh  = new THREE.Mesh(mergeGeometries(ceilGeos),  ceilMat)

  scene.add(wallMesh, floorMesh, ceilMesh)

  // Exit marker — glowing pillar
  const exitPos = getExitPosition()
  const exitMesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.6, H * 0.85, 0.6),
    new THREE.MeshLambertMaterial({ color: 0x00ff66, emissive: new THREE.Color(0x00ff66) })
  )
  exitMesh.position.set(exitPos.x, H * 0.425, exitPos.z)
  scene.add(exitMesh)

  return { wallMesh, floorMesh, ceilMesh, exitMesh }
}
