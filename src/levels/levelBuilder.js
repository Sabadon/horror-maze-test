import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { grid, CELL_SIZE, WALL_HEIGHT, START_CELL, exits, deadEndRooms, openRooms } from './level01.js'
import { makeWallTexture, makeWallNormalMap, makeWallDisplacementMap, makeFloorTexture, makeCeilTexture, makeRoomFloorTexture, makeRoomCeilTexture } from '../core/textureGenerator.js'

const C = CELL_SIZE
const H = WALL_HEIGHT

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

export function getExitPositions() {
  return exits.map(e => new THREE.Vector3(
    (e.col + 0.5) * C,
    0,
    (e.row + 0.5) * C
  ))
}

const WALL_SEGS = 12

function wallFace(cx, cz, rotY) {
  const g = new THREE.PlaneGeometry(C, H, WALL_SEGS, WALL_SEGS)
  g.translate(0, H / 2, 0)
  if (rotY !== 0) g.rotateY(rotY)
  g.translate(cx, 0, cz)
  return g
}

function roomFloor(cx, cz, size) {
  const g = new THREE.PlaneGeometry(size * C, size * C)
  g.rotateX(-Math.PI / 2)
  g.translate(cx, 0, cz)
  return g
}

function roomCeiling(cx, cz, size) {
  const g = new THREE.PlaneGeometry(size * C, size * C)
  g.rotateX(Math.PI / 2)
  g.translate(cx, H, cz)
  return g
}

export function buildLevel(scene) {
  const rows = grid.length
  const cols = grid[0].length

  const wallGeos     = []
  const floorGeos    = []
  const ceilGeos     = []
  const roomFloorGeos = []
  const roomCeilGeos  = []

  // Track cells that are part of special rooms
  const deadEndCells = new Set()
  for (const r of deadEndRooms) {
    deadEndCells.add(`${r.row},${r.col}`)
    if (r.dir) {
      deadEndCells.add(`${r.row + r.dir[0]},${r.col + r.dir[1]}`)
      deadEndCells.add(`${r.row + r.dir[0] * 2},${r.col + r.dir[1] * 2}`)
    }
  }
  const openRoomCells = new Set()
  for (const r of openRooms) {
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        openRoomCells.add(`${r.row + dr},${r.col + dc}`)
      }
    }
  }

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (grid[r][c] === 1) continue

      const cx = (c + 0.5) * C
      const cz = (r + 0.5) * C
      const isRoom = deadEndCells.has(`${r},${c}`) || openRoomCells.has(`${r},${c}`)

      // Floor/ceiling - use room textures for special areas
      if (openRoomCells.has(`${r},${c}`)) {
        roomFloorGeos.push(roomFloor(cx, cz, 1))
        roomCeilGeos.push(roomCeiling(cx, cz, 1))
      } else if (deadEndCells.has(`${r},${c}`)) {
        roomFloorGeos.push(roomFloor(cx, cz, 1))
        roomCeilGeos.push(roomCeiling(cx, cz, 1))
      } else {
        const fg = new THREE.PlaneGeometry(C, C)
        fg.rotateX(-Math.PI / 2)
        fg.translate(cx, 0, cz)
        floorGeos.push(fg)

        const cg = new THREE.PlaneGeometry(C, C)
        cg.rotateX(Math.PI / 2)
        cg.translate(cx, H, cz)
        ceilGeos.push(cg)
      }

      // Walls - skip if in open room interior
      if (!openRoomCells.has(`${r},${c}`)) {
        if (r === 0 || grid[r - 1][c] === 1)
          wallGeos.push(wallFace(cx, cz - C / 2, 0))
        if (r === rows - 1 || grid[r + 1][c] === 1)
          wallGeos.push(wallFace(cx, cz + C / 2, Math.PI))
        if (c === 0 || grid[r][c - 1] === 1)
          wallGeos.push(wallFace(cx - C / 2, cz, Math.PI / 2))
        if (c === cols - 1 || grid[r][c + 1] === 1)
          wallGeos.push(wallFace(cx + C / 2, cz, -Math.PI / 2))
      }
    }
  }

  // Textures
  const wallTex    = makeWallTexture()
  const wallNorm   = makeWallNormalMap()
  const wallDisp   = makeWallDisplacementMap()
  const floorTex   = makeFloorTexture()
  const ceilTex    = makeCeilTexture()
  const roomFloorTex = makeRoomFloorTexture()
  const roomCeilTex  = makeRoomCeilTexture()

  const wallMat    = new THREE.MeshPhongMaterial({
    map:             wallTex,
    normalMap:       wallNorm,
    normalScale:     new THREE.Vector2(1.5, 1.5),
    displacementMap: wallDisp,
    displacementScale: 0.10,
    displacementBias:  0,
    shininess:       8,
    specular:        new THREE.Color(0x111111),
  })
  const floorMat   = new THREE.MeshLambertMaterial({ map: floorTex })
  const ceilMat    = new THREE.MeshLambertMaterial({ map: ceilTex })
  const roomFloorMat = new THREE.MeshLambertMaterial({ map: roomFloorTex })
  const roomCeilMat  = new THREE.MeshLambertMaterial({ map: roomCeilTex })

  const wallMesh     = new THREE.Mesh(mergeGeometries(wallGeos), wallMat)
  const floorMesh    = new THREE.Mesh(mergeGeometries(floorGeos), floorMat)
  const ceilMesh     = new THREE.Mesh(mergeGeometries(ceilGeos), ceilMat)
  const roomFloorMesh = floorGeos.length > 0 && roomFloorGeos.length > 0
    ? new THREE.Mesh(mergeGeometries(roomFloorGeos), roomFloorMat)
    : null
  const roomCeilMesh = ceilGeos.length > 0 && roomCeilGeos.length > 0
    ? new THREE.Mesh(mergeGeometries(roomCeilGeos), roomCeilMat)
    : null

  const meshes = [wallMesh, floorMesh, ceilMesh]
  if (roomFloorMesh) meshes.push(roomFloorMesh)
  if (roomCeilMesh) meshes.push(roomCeilMesh)
  for (const m of meshes) scene.add(m)

  // Exit markers - glowing pillars (different colors for variety)
  const exitColors = [0x00ff66, 0x00ccff, 0xffcc00]
  const exitMeshes = exits.map((e, i) => {
    const color = exitColors[i % exitColors.length]
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.6, H * 0.85, 0.6),
      new THREE.MeshLambertMaterial({
        color: color,
        emissive: new THREE.Color(color),
        emissiveIntensity: 0.8,
      })
    )
    mesh.position.set((e.col + 0.5) * C, H * 0.425, (e.row + 0.5) * C)
    scene.add(mesh)
    return mesh
  })

  // Dim lights at open rooms
  for (const r of openRooms) {
    const light = new THREE.PointLight(0xffaa44, 0.6, 8, 2)
    light.position.set((r.col + 0.5) * C, H * 0.7, (r.row + 0.5) * C)
    scene.add(light)
    exitMeshes.push(light)
  }

  return {
    wallMesh,
    floorMesh,
    ceilMesh,
    roomFloorMesh,
    roomCeilMesh,
    exitMeshes,
  }
}
