// Recursive backtracker DFS + braiding (extra wall removal).
// Produces a binary grid: 0 = corridor, 1 = wall
// Grid size: (2*CELLS+1) × (2*CELLS+1)  →  13×13 when CELLS=6

const CELLS = 6   // → 13×13 binary grid
const BRAID = 0.5 // fraction of dead-ends to braid (0=perfect maze, 1=full loops)

export function generateMaze(seed) {
  const SIZE = 2 * CELLS + 1

  // Seeded xorshift32
  let s = (seed !== undefined ? seed >>> 0 : (Math.random() * 0xffffffff) >>> 0) || 1
  function rng() {
    s ^= s << 13; s ^= s >> 17; s ^= s << 5
    return (s >>> 0) / 0x100000000
  }
  function rngInt(n) { return Math.floor(rng() * n) }

  // --- Init: all walls ---
  const grid    = Array.from({ length: SIZE }, () => new Array(SIZE).fill(1))
  const visited = Array.from({ length: CELLS }, () => new Array(CELLS).fill(false))

  // --- Recursive backtracker DFS ---
  function carve(cr, cc) {
    visited[cr][cc] = true
    grid[cr * 2 + 1][cc * 2 + 1] = 0

    const dirs = [[0,1],[0,-1],[1,0],[-1,0]]
    for (let i = dirs.length - 1; i > 0; i--) {
      const j = rngInt(i + 1);
      [dirs[i], dirs[j]] = [dirs[j], dirs[i]]
    }
    for (const [dr, dc] of dirs) {
      const nr = cr + dr, nc = cc + dc
      if (nr < 0 || nr >= CELLS || nc < 0 || nc >= CELLS || visited[nr][nc]) continue
      grid[cr * 2 + 1 + dr][cc * 2 + 1 + dc] = 0
      carve(nr, nc)
    }
  }

  const startCellR = Math.floor(CELLS / 2)
  const startCellC = Math.floor(CELLS / 2)
  carve(startCellR, startCellC)

  // --- Braiding: remove walls at dead-ends to create loops ---
  // A dead-end cell has exactly 1 open neighbour in the binary grid
  const deadEnds = []
  for (let r = 1; r < SIZE - 1; r += 2) {
    for (let c = 1; c < SIZE - 1; c += 2) {
      const open = [[0,1],[0,-1],[1,0],[-1,0]]
        .filter(([dr, dc]) => grid[r + dr][c + dc] === 0).length
      if (open === 1) deadEnds.push([r, c])
    }
  }
  // Shuffle dead-ends, braid a fraction of them
  for (let i = deadEnds.length - 1; i > 0; i--) {
    const j = rngInt(i + 1);
    [deadEnds[i], deadEnds[j]] = [deadEnds[j], deadEnds[i]]
  }
  const braidCount = Math.floor(deadEnds.length * BRAID)
  for (let i = 0; i < braidCount; i++) {
    const [r, c] = deadEnds[i]
    // Collect walls we could knock down (neighbour wall → closed cell beyond)
    const candidates = [[0,2],[0,-2],[2,0],[-2,0]]
      .filter(([dr, dc]) => {
        const wr = r + dr / 2, wc = c + dc / 2
        const nr = r + dr,     nc = c + dc
        return nr > 0 && nr < SIZE - 1 && nc > 0 && nc < SIZE - 1
          && grid[wr][wc] === 1  // wall between
      })
    if (!candidates.length) continue
    const [dr, dc] = candidates[rngInt(candidates.length)]
    grid[r + dr / 2][c + dc / 2] = 0  // knock down wall
    grid[r + dr][c + dc] = 0          // open target cell (may already be open)
  }

  // --- BFS from start to find farthest cell (exit) ---
  const startRow = startCellR * 2 + 1
  const startCol = startCellC * 2 + 1
  const dist = Array.from({ length: SIZE }, () => new Array(SIZE).fill(-1))
  const queue = [[startRow, startCol]]
  dist[startRow][startCol] = 0
  let exitRow = startRow, exitCol = startCol

  while (queue.length) {
    const [r, c] = queue.shift()
    for (const [dr, dc] of [[0,1],[0,-1],[1,0],[-1,0]]) {
      const nr = r + dr, nc = c + dc
      if (nr < 0 || nr >= SIZE || nc < 0 || nc >= SIZE) continue
      if (grid[nr][nc] === 1 || dist[nr][nc] !== -1) continue
      dist[nr][nc] = dist[r][c] + 1
      queue.push([nr, nc])
      if (dist[nr][nc] > dist[exitRow][exitCol]) { exitRow = nr; exitCol = nc }
    }
  }

  return {
    grid,
    startCell: { row: startRow, col: startCol },
    exitCell:  { row: exitRow,  col: exitCol  },
  }
}
