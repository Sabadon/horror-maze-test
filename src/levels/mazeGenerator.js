// Recursive backtracker DFS + braiding + special rooms.
// Produces a binary grid: 0 = corridor, 1 = wall
// Grid size: (2*CELLS+1) × (2*CELLS+1)  →  31×31 when CELLS=15

const CELLS       = 15   // → 31×31 binary grid
const BRAID       = 0.6  // fraction of dead-ends to braid (more loops)
const ROOM_CHANCE = 0.3  // fraction of dead-ends turned into rooms
const OPEN_ROOMS  = 6    // number of random open rooms to carve

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
  const deadEnds = []
  for (let r = 1; r < SIZE - 1; r += 2) {
    for (let c = 1; c < SIZE - 1; c += 2) {
      const open = [[0,1],[0,-1],[1,0],[-1,0]]
        .filter(([dr, dc]) => grid[r + dr][c + dc] === 0).length
      if (open === 1) deadEnds.push([r, c])
    }
  }
  // Shuffle dead-ends
  for (let i = deadEnds.length - 1; i > 0; i--) {
    const j = rngInt(i + 1);
    [deadEnds[i], deadEnds[j]] = [deadEnds[j], deadEnds[i]]
  }
  const braidCount = Math.floor(deadEnds.length * BRAID)
  for (let i = 0; i < braidCount; i++) {
    const [r, c] = deadEnds[i]
    const candidates = [[0,2],[0,-2],[2,0],[-2,0]]
      .filter(([dr, dc]) => {
        const wr = r + dr / 2, wc = c + dc / 2
        const nr = r + dr,     nc = c + dc
        return nr > 0 && nr < SIZE - 1 && nc > 0 && nc < SIZE - 1
          && grid[wr][wc] === 1
      })
    if (!candidates.length) continue
    const [dr, dc] = candidates[rngInt(candidates.length)]
    grid[r + dr / 2][c + dc / 2] = 0
    grid[r + dr][c + dc] = 0
  }

  // --- Dead-end rooms: 2×2 chambers at dead-ends ---
  const deadEndRooms = []
  const roomCount = Math.floor(deadEnds.length * ROOM_CHANCE)
  for (let i = braidCount; i < braidCount + roomCount && i < deadEnds.length; i++) {
    const [r, c] = deadEnds[i]
    // Find which direction is the corridor (open side)
    const openDir = [[0,1],[0,-1],[1,0],[-1,0]]
      .find(([dr, dc]) => grid[r + dr][c + dc] === 0)
    if (!openDir) continue
    
    const [dr, dc] = openDir
    // Carve a 2×2 room opening toward the corridor
    const roomCells = [
      [r, c],
      [r + dr, c + dc],
      [r + dr * 2, c + dc * 2]
    ]
    for (const [rr, cc] of roomCells) {
      if (rr > 0 && rr < SIZE - 1 && cc > 0 && cc < SIZE - 1) {
        grid[rr][cc] = 0
      }
    }
    deadEndRooms.push({ row: r, col: c, dir: [dr, dc] })
  }

  // --- Open rooms: random 3×3 clearings ---
  const openRooms = []
  const corridors = []
  for (let r = 2; r < SIZE - 2; r += 2) {
    for (let c = 2; c < SIZE - 2; c += 2) {
      if (grid[r][c] === 0) corridors.push([r, c])
    }
  }
  // Shuffle and pick random positions for open rooms
  for (let i = corridors.length - 1; i > 0; i--) {
    const j = rngInt(i + 1);
    [corridors[i], corridors[j]] = [corridors[j], corridors[i]]
  }
  
  for (let i = 0; i < OPEN_ROOMS && i < corridors.length; i++) {
    const [cr, cc] = corridors[i]
    // Check if area is clear enough (mostly walls around)
    let canPlace = true
    for (let dr = -2; dr <= 2; dr++) {
      for (let dc = -2; dc <= 2; dc++) {
        const nr = cr + dr, nc = cc + dc
        if (nr < 0 || nr >= SIZE || nc < 0 || nc >= SIZE) {
          canPlace = false
        } else if (grid[nr][nc] === 0 && (Math.abs(dr) === 2 || Math.abs(dc) === 2)) {
          canPlace = false // Don't carve into existing corridors too much
        }
      }
    }
    
    if (canPlace) {
      // Carve 3×3 open room
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const nr = cr + dr, nc = cc + dc
          if (nr > 0 && nr < SIZE - 1 && nc > 0 && nc < SIZE - 1) {
            grid[nr][nc] = 0
          }
        }
      }
      openRooms.push({ row: cr, col: cc, size: 3 })
    }
  }

  // --- BFS from start to find multiple exits (farthest cells) ---
  const startRow = startCellR * 2 + 1
  const startCol = startCellC * 2 + 1
  const dist = Array.from({ length: SIZE }, () => new Array(SIZE).fill(-1))
  const queue = [[startRow, startCol]]
  dist[startRow][startCol] = 0
  const exits = []

  while (queue.length) {
    const [r, c] = queue.shift()
    for (const [dr, dc] of [[0,1],[0,-1],[1,0],[-1,0]]) {
      const nr = r + dr, nc = c + dc
      if (nr < 0 || nr >= SIZE || nc < 0 || nc >= SIZE) continue
      if (grid[nr][nc] === 1 || dist[nr][nc] !== -1) continue
      dist[nr][nc] = dist[r][c] + 1
      queue.push([nr, nc])
    }
  }

  // Find all corridor cells, sort by distance, take top 3
  const corridorCells = []
  for (let r = 1; r < SIZE - 1; r++) {
    for (let c = 1; c < SIZE - 1; c++) {
      if (grid[r][c] === 0 && dist[r][c] > 0) {
        corridorCells.push({ row: r, col: c, distance: dist[r][c] })
      }
    }
  }
  corridorCells.sort((a, b) => b.distance - a.distance)
  
  // Take 3 exits at different distances (far, medium, near-ish)
  const exitDistances = []
  for (const cell of corridorCells) {
    if (exitDistances.length >= 3) break
    // Space out exits by at least 20 cells distance
    const tooClose = exitDistances.some(d => Math.abs(d - cell.distance) < 20)
    if (!tooClose) {
      exitDistances.push(cell.distance)
      exits.push({ row: cell.row, col: cell.col, distance: cell.distance })
    }
  }
  // Ensure we have at least 2 exits
  while (exits.length < 2 && corridorCells.length > exits.length) {
    for (const cell of corridorCells) {
      if (!exits.some(e => e.row === cell.row && e.col === cell.col)) {
        exits.push({ row: cell.row, col: cell.col, distance: cell.distance })
        break
      }
    }
  }

  return {
    grid,
    startCell: { row: startRow, col: startCol },
    exits,
    deadEndRooms,
    openRooms,
  }
}
