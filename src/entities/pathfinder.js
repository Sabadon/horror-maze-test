import { grid, CELL_SIZE } from '../levels/level01.js'

const ROWS = grid.length
const COLS = grid[0].length

let _walkableCache = null
let _cacheValid = false

function worldToGrid(x, z) {
  return {
    row: Math.floor(z / CELL_SIZE),
    col: Math.floor(x / CELL_SIZE)
  }
}

function gridToWorld(row, col) {
  return {
    x: (col + 0.5) * CELL_SIZE,
    z: (row + 0.5) * CELL_SIZE
  }
}

function heuristic(a, b) {
  return Math.abs(a.row - b.row) + Math.abs(a.col - b.col)
}

function getNeighbors(node) {
  const neighbors = []
  const { row, col } = node
  const r = row * COLS + col

  if (row > 0 && grid[row - 1][col] === 0) neighbors.push({ row: row - 1, col, key: r - COLS })
  if (row < ROWS - 1 && grid[row + 1][col] === 0) neighbors.push({ row: row + 1, col, key: r + COLS })
  if (col > 0 && grid[row][col - 1] === 0) neighbors.push({ row, col: col - 1, key: r - 1 })
  if (col < COLS - 1 && grid[row][col + 1] === 0) neighbors.push({ row, col: col + 1, key: r + 1 })

  return neighbors
}

class MinHeap {
  constructor() {
    this.heap = []
  }

  push(node) {
    this.heap.push(node)
    this._bubbleUp(this.heap.length - 1)
  }

  pop() {
    if (this.heap.length === 0) return null
    if (this.heap.length === 1) return this.heap.pop()

    const min = this.heap[0]
    this.heap[0] = this.heap.pop()
    this._bubbleDown(0)
    return min
  }

  isEmpty() {
    return this.heap.length === 0
  }

  _bubbleUp(idx) {
    while (idx > 0) {
      const parent = (idx - 1) >> 1
      if (this.heap[parent].f <= this.heap[idx].f) break
      ;[this.heap[parent], this.heap[idx]] = [this.heap[idx], this.heap[parent]]
      idx = parent
    }
  }

  _bubbleDown(idx) {
    const length = this.heap.length
    while (true) {
      const left = (idx << 1) + 1
      const right = left + 1
      let smallest = idx

      if (left < length && this.heap[left].f < this.heap[smallest].f) {
        smallest = left
      }
      if (right < length && this.heap[right].f < this.heap[smallest].f) {
        smallest = right
      }

      if (smallest === idx) break
      ;[this.heap[smallest], this.heap[idx]] = [this.heap[idx], this.heap[smallest]]
      idx = smallest
    }
  }
}

export function invalidateCache() {
  _cacheValid = false
  _walkableCache = null
}

export function findPath(fromX, fromZ, toX, toZ, maxIterations = 1000) {
  const start = worldToGrid(fromX, fromZ)
  const goal = worldToGrid(toX, toZ)

  if (grid[goal.row]?.[goal.col] === 1 || grid[start.row]?.[start.col] === 1) {
    return null
  }

  if (start.row === goal.row && start.col === goal.col) {
    const world = gridToWorld(start.row, start.col)
    return [{ x: world.x, z: world.z }]
  }

  const openSet = new MinHeap()
  const cameFrom = new Int32Array(ROWS * COLS)
  cameFrom.fill(-1)
  const gScore = new Float32Array(ROWS * COLS)
  gScore.fill(Infinity)

  const startKey = start.row * COLS + start.col
  gScore[startKey] = 0
  openSet.push({ row: start.row, col: start.col, f: heuristic(start, goal), key: startKey })

  let iterations = 0

  while (!openSet.isEmpty() && iterations < maxIterations) {
    iterations++
    const current = openSet.pop()
    const currentKey = current.key

    if (current.row === goal.row && current.col === goal.col) {
      const path = []
      let key = currentKey
      while (key !== -1) {
        const row = (key / COLS) | 0
        const col = key % COLS
        const world = gridToWorld(row, col)
        path.unshift({ x: world.x, z: world.z })
        key = cameFrom[key]
      }
      return path
    }

    for (const neighbor of getNeighbors(current)) {
      const neighborKey = neighbor.key
      const tentativeG = gScore[currentKey] + 1

      if (tentativeG < gScore[neighborKey]) {
        cameFrom[neighborKey] = currentKey
        gScore[neighborKey] = tentativeG
        const f = tentativeG + heuristic(neighbor, goal)
        openSet.push({ row: neighbor.row, col: neighbor.col, f, key: neighborKey })
      }
    }
  }

  return null
}

export function getWalkableCells() {
  if (_cacheValid && _walkableCache) {
    return _walkableCache
  }

  const cells = []
  for (let r = 1; r < ROWS - 1; r++) {
    for (let c = 1; c < COLS - 1; c++) {
      if (grid[r][c] === 0) {
        cells.push({ row: r, col: c })
      }
    }
  }

  _walkableCache = cells
  _cacheValid = true
  return cells
}
