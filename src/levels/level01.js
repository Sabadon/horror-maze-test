import { generateMaze } from './mazeGenerator.js'

export const CELL_SIZE   = 2
export const WALL_HEIGHT = 3

const _initial = generateMaze()

// Mutable in-place — consumers hold a reference to these objects
export const grid         = _initial.grid
export const START_CELL   = { row: _initial.startCell.row, col: _initial.startCell.col }
export const exits        = _initial.exits.map(e => ({ row: e.row, col: e.col, distance: e.distance }))
export const deadEndRooms = _initial.deadEndRooms.map(r => ({ row: r.row, col: r.col, dir: r.dir }))
export const openRooms    = _initial.openRooms.map(r => ({ row: r.row, col: r.col, size: r.size }))

export function regenerate() {
  const result = generateMaze()
  grid.length = 0
  for (const row of result.grid) grid.push(row)
  START_CELL.row = result.startCell.row; START_CELL.col = result.startCell.col
  exits.length = 0
  for (const e of result.exits) exits.push({ row: e.row, col: e.col, distance: e.distance })
  deadEndRooms.length = 0
  for (const r of result.deadEndRooms) deadEndRooms.push({ row: r.row, col: r.col, dir: r.dir })
  openRooms.length = 0
  for (const r of result.openRooms) openRooms.push({ row: r.row, col: r.col, size: r.size })
}
