import { grid, CELL_SIZE } from '../levels/level01.js'
import { playerObject } from '../core/camera.js'
import { exits } from '../levels/level01.js'

const ROWS = grid.length
const COLS = grid[0].length
const MAP_SIZE = 180
const CELL_PX = MAP_SIZE / Math.max(ROWS, COLS)
const OFFSET_X = (MAP_SIZE - COLS * CELL_PX) / 2
const OFFSET_Y = (MAP_SIZE - ROWS * CELL_PX) / 2

let canvas = null
let ctx = null
let visible = false

export const minimap = {
  init() {
    canvas = document.createElement('canvas')
    canvas.id = 'minimap'
    canvas.width = MAP_SIZE
    canvas.height = MAP_SIZE
    canvas.style.position = 'fixed'
    canvas.style.bottom = '10px'
    canvas.style.right = '10px'
    canvas.style.width = MAP_SIZE + 'px'
    canvas.style.height = MAP_SIZE + 'px'
    canvas.style.border = '2px solid #444'
    canvas.style.background = 'rgba(0,0,0,0.8)'
    canvas.style.borderRadius = '4px'
    canvas.style.zIndex = '1000'
    canvas.style.imageRendering = 'pixelated'
    canvas.style.display = 'none'

    document.body.appendChild(canvas)
    ctx = canvas.getContext('2d')
    ctx.imageSmoothingEnabled = false

    document.addEventListener('keydown', (e) => {
      if (e.key.toLowerCase() === 'm') {
        visible = !visible
        canvas.style.display = visible ? 'block' : 'none'
      }
    })
  },

  update(monsterX, monsterZ) {
    if (!ctx || !visible) return

    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, MAP_SIZE, MAP_SIZE)

    ctx.fillStyle = '#1a1a1a'
    ctx.fillRect(OFFSET_X, OFFSET_Y, COLS * CELL_PX, ROWS * CELL_PX)

    ctx.fillStyle = '#333'
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (grid[r][c] === 1) {
          const x = OFFSET_X + c * CELL_PX
          const y = OFFSET_Y + r * CELL_PX
          ctx.fillRect(Math.floor(x), Math.floor(y), Math.ceil(CELL_PX), Math.ceil(CELL_PX))
        }
      }
    }

    ctx.fillStyle = '#0066ff'
    for (const exit of exits) {
      const ex = OFFSET_X + exit.col * CELL_PX
      const ey = OFFSET_Y + exit.row * CELL_PX
      ctx.fillRect(Math.floor(ex), Math.floor(ey), Math.ceil(CELL_PX), Math.ceil(CELL_PX))
    }

    if (monsterX !== undefined && monsterZ !== undefined) {
      const mx = OFFSET_X + (monsterX / CELL_SIZE) * CELL_PX
      const my = OFFSET_Y + (monsterZ / CELL_SIZE) * CELL_PX
      ctx.fillStyle = '#ff0000'
      ctx.beginPath()
      ctx.arc(Math.floor(mx), Math.floor(my), 3, 0, Math.PI * 2)
      ctx.fill()
    }

    const px = OFFSET_X + (playerObject.position.x / CELL_SIZE) * CELL_PX
    const py = OFFSET_Y + (playerObject.position.z / CELL_SIZE) * CELL_PX
    ctx.fillStyle = '#00ff00'
    ctx.beginPath()
    ctx.arc(Math.floor(px), Math.floor(py), 3, 0, Math.PI * 2)
    ctx.fill()
  },

  setVisible(v) {
    visible = v
    if (canvas) {
      canvas.style.display = visible ? 'block' : 'none'
    }
  }
}
