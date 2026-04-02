import { generateMaze } from './mazeGenerator.js'

export const CELL_SIZE   = 3
export const WALL_HEIGHT = 3

const _initial = generateMaze()

// Mutable in-place — consumers hold a reference to these objects
export const grid       = _initial.grid
export const START_CELL = { row: _initial.startCell.row, col: _initial.startCell.col }
export const EXIT_CELL  = { row: _initial.exitCell.row,  col: _initial.exitCell.col  }

export function regenerate() {
  const { grid: newGrid, startCell, exitCell } = generateMaze()
  grid.length = 0
  for (const row of newGrid) grid.push(row)
  START_CELL.row = startCell.row; START_CELL.col = startCell.col
  EXIT_CELL.row  = exitCell.row;  EXIT_CELL.col  = exitCell.col
}
