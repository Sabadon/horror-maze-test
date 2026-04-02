import * as THREE from 'three'

// Deterministic LCG — same seed always produces the same texture
function seededRng(seed) {
  let s = seed
  return () => {
    s = Math.imul(1664525, s) + 1013904223 | 0
    return (s >>> 0) / 0xFFFFFFFF
  }
}

function makeTexture(drawFn, seed = 0) {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 64
  const ctx = canvas.getContext('2d')
  drawFn(ctx, seededRng(seed))
  const tex = new THREE.CanvasTexture(canvas)
  tex.magFilter = THREE.NearestFilter
  tex.minFilter = THREE.NearestFilter
  tex.wrapS    = tex.wrapT = THREE.RepeatWrapping
  return tex
}

// ---------------------------------------------------------------------------
// Shared brick height field — single source of truth used by both the
// normal map and the displacement map so lighting and geometry always agree.
//
// Returns Float32Array (S×S), values 0–1:
//   grout = 0 | bevel ramp (BEVEL px wide) = 0→1 | brick face = 1
// ---------------------------------------------------------------------------
const BRICK = { S: 64, BW: 30, BH: 14, G: 2, BEVEL: 3 }

function buildBrickHeightField() {
  const { S, BW, BH, G, BEVEL } = BRICK
  const field = new Float32Array(S * S)

  for (let y = 0; y < S; y++) {
    const row    = Math.floor(y / (BH + G))
    const brickY = y % (BH + G)
    const off    = (row % 2) * 16
    const inGY   = brickY >= BH

    for (let x = 0; x < S; x++) {
      const lx     = ((x + off) % S + S) % S
      const brickX = lx % (BW + G)

      if (inGY || brickX >= BW) { field[y * S + x] = 0; continue }

      const distX = Math.min(brickX, BW - 1 - brickX)
      const distY = Math.min(brickY, BH - 1 - brickY)
      field[y * S + x] = Math.min(distX, distY) >= BEVEL ? 1.0
                        : Math.min(distX, distY) / BEVEL
    }
  }
  return field
}

function heightFieldTexture(field) {
  const S = BRICK.S
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = S
  const tex = new THREE.CanvasTexture(canvas)
  tex.magFilter = THREE.NearestFilter
  tex.minFilter = THREE.NearestFilter
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  return { canvas, tex, field }
}

// ---------------------------------------------------------------------------
// Wall displacement map — grayscale (R=G=B=height*255), used to physically
// move vertices outward so brick geometry actually protrudes.
// ---------------------------------------------------------------------------
export function makeWallDisplacementMap() {
  const { S } = BRICK
  const field  = buildBrickHeightField()
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = S
  const ctx  = canvas.getContext('2d')
  const img  = ctx.createImageData(S, S)
  const data = img.data

  for (let i = 0; i < field.length; i++) {
    const v = Math.round(field[i] * 255)
    data[i * 4]     = v
    data[i * 4 + 1] = v
    data[i * 4 + 2] = v
    data[i * 4 + 3] = 255
  }

  ctx.putImageData(img, 0, 0)
  const tex = new THREE.CanvasTexture(canvas)
  tex.magFilter = THREE.NearestFilter
  tex.minFilter = THREE.NearestFilter
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  return tex
}

// ---------------------------------------------------------------------------
// Wall normal map — derived from the same height field via central differences.
// STRENGTH controls bevel steepness; ~3 ≈ 45° at the sharpest edge.
// ---------------------------------------------------------------------------
export function makeWallNormalMap() {
  const { S } = BRICK
  const STRENGTH = 3
  const field    = buildBrickHeightField()
  const getH     = (x, y) => field[((y + S) % S) * S + ((x + S) % S)]

  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = S
  const ctx  = canvas.getContext('2d')
  const img  = ctx.createImageData(S, S)
  const data = img.data

  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const ddx = (getH(x + 1, y) - getH(x - 1, y)) * STRENGTH
      const ddy = (getH(x, y + 1) - getH(x, y - 1)) * STRENGTH

      let nx = -ddx, ny = -ddy, nz = 1.0
      const len = Math.sqrt(nx * nx + ny * ny + nz * nz)
      nx /= len; ny /= len; nz /= len

      const i = (y * S + x) * 4
      data[i]     = Math.round((nx * 0.5 + 0.5) * 255)
      data[i + 1] = Math.round((ny * 0.5 + 0.5) * 255)
      data[i + 2] = Math.round((nz * 0.5 + 0.5) * 255)
      data[i + 3] = 255
    }
  }

  ctx.putImageData(img, 0, 0)
  const tex = new THREE.CanvasTexture(canvas)
  tex.magFilter = THREE.NearestFilter
  tex.minFilter = THREE.NearestFilter
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  return tex
}

// ---------------------------------------------------------------------------
// Wall — mossy stone brickwork with water stains and slime drips
// Bricks: 4 rows × 2 cols (30×14 px per brick, 2 px grout)
// Tiles seamlessly: total 64×64 px
// ---------------------------------------------------------------------------
export function makeWallTexture() {
  return makeTexture((ctx, rng) => {
    const S = 64, BW = 30, BH = 14, G = 2

    // Mortar background — dark brown-grey
    ctx.fillStyle = '#1e1b15'
    ctx.fillRect(0, 0, S, S)

    // Stone blocks
    for (let row = 0; row < 4; row++) {
      const y   = row * (BH + G)
      const off = (row % 2) * 16   // half-brick stagger (BW/2+1 = 16)

      for (let col = -1; col <= 2; col++) {
        const x  = col * (BW + G) - off
        const v  = rng() * 22
        const rC = Math.round(58 + v), gC = Math.round(60 + v), bC = Math.round(53 + v)

        // Face
        ctx.fillStyle = `rgb(${rC},${gC},${bC})`
        ctx.fillRect(x, y, BW, BH)

        // Top-left inner shadow
        ctx.fillStyle = 'rgba(0,0,0,0.35)'
        ctx.fillRect(x,     y,     BW, 1)
        ctx.fillRect(x,     y,     1,  BH)

        // Bottom highlight (damp sheen)
        ctx.fillStyle = 'rgba(255,255,255,0.06)'
        ctx.fillRect(x + 2, y + BH - 2, BW - 3, 1)
      }
    }

    // Moss / algae blobs
    for (let i = 0; i < 10; i++) {
      const mx = rng() * S, my = rng() * S
      const rx = 2 + rng() * 7,  ry = 1 + rng() * 4
      const g  = Math.round(72 + rng() * 58)
      ctx.fillStyle = `rgba(12,${g},10,${0.55 + rng() * 0.4})`
      ctx.beginPath()
      ctx.ellipse(mx, my, rx, ry, rng() * Math.PI, 0, Math.PI * 2)
      ctx.fill()
    }

    // Water stain streaks (thin vertical)
    for (let i = 0; i < 7; i++) {
      const sx = Math.floor(rng() * S)
      const sy = Math.floor(rng() * S * 0.55)
      const len = 8 + rng() * 28
      ctx.fillStyle = `rgba(16,32,46,${0.28 + rng() * 0.38})`
      ctx.fillRect(sx, sy, 1, len)
    }

    // Slime drips from grout lines
    for (let i = 0; i < 5; i++) {
      const dx   = Math.floor(rng() * (S - 3)) + 1
      const groutRow = Math.floor(rng() * 4)
      const sy   = groutRow * (BH + G) + BH
      const len  = 4 + Math.floor(rng() * 14)
      const g    = Math.round(80 + rng() * 45)
      ctx.fillStyle = `rgba(18,${g},12,0.88)`
      ctx.fillRect(dx, sy, 1, len)
      ctx.fillRect(dx - 1, sy + len - 1, 3, 2)  // bulge at drip tip
    }
  }, 42)
}

// ---------------------------------------------------------------------------
// Floor — wet stone slabs with algae and standing water
// Large slabs: 2×2 grid (29×29 px per slab, 3 px grout)
// ---------------------------------------------------------------------------
export function makeFloorTexture() {
  return makeTexture((ctx, rng) => {
    const S = 64, SW = 29, SH = 29, SG = 3

    // Dark wet base
    ctx.fillStyle = '#151410'
    ctx.fillRect(0, 0, S, S)

    // Stone slabs
    for (let row = 0; row < 2; row++) {
      const y   = row * (SH + SG) + 1
      const off = (row % 2) * 16

      for (let col = -1; col <= 2; col++) {
        const x  = col * (SW + SG) - off
        const v  = rng() * 16
        const lum = Math.round(36 + v)
        ctx.fillStyle = `rgb(${lum},${lum + 1},${lum - 2})`
        ctx.fillRect(x, y, SW, SH)

        // Subtle wet-sheen centre highlight
        ctx.fillStyle = 'rgba(90,115,125,0.1)'
        ctx.fillRect(x + 5, y + 5, SW - 10, SH - 10)

        // Edge shadows
        ctx.fillStyle = 'rgba(0,0,0,0.38)'
        ctx.fillRect(x,     y,     SW, 1)
        ctx.fillRect(x,     y,     1,  SH)
        ctx.fillRect(x,     y + SH - 1, SW, 1)
      }
    }

    // Grout lines — dark & grimy
    ctx.fillStyle = 'rgba(8,10,6,0.75)'
    for (let row = 0; row <= 2; row++) {
      const gy = row * (SH + SG)
      ctx.fillRect(0, gy, S, SG)
    }

    // Algae / slime patches
    for (let i = 0; i < 12; i++) {
      const ax = rng() * S, ay = rng() * S
      const ar = 1 + rng() * 5
      const g  = Math.round(58 + rng() * 55)
      ctx.fillStyle = `rgba(8,${g},6,${0.45 + rng() * 0.5})`
      ctx.beginPath()
      ctx.ellipse(ax, ay, ar, ar * 0.55, rng() * Math.PI, 0, Math.PI * 2)
      ctx.fill()
    }

    // Dark standing-water pools
    for (let i = 0; i < 3; i++) {
      const wx = rng() * S, wy = rng() * S
      const wr = 4 + rng() * 9
      ctx.fillStyle = `rgba(8,18,28,${0.55 + rng() * 0.3})`
      ctx.beginPath()
      ctx.ellipse(wx, wy, wr, wr * 0.45, 0, 0, Math.PI * 2)
      ctx.fill()
    }

    // Crack lines
    for (let i = 0; i < 2; i++) {
      const cx0 = rng() * S, cy0 = rng() * S
      ctx.strokeStyle = 'rgba(5,5,4,0.65)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(cx0, cy0)
      let cx = cx0, cy = cy0
      for (let j = 0; j < 4; j++) {
        cx += (rng() - 0.5) * 12
        cy += rng() * 7
        ctx.lineTo(cx, cy)
      }
      ctx.stroke()
    }
  }, 99)
}

// ---------------------------------------------------------------------------
// Ceiling — damp rough stone with mold, water stain rings and hairline cracks
// ---------------------------------------------------------------------------
export function makeCeilTexture() {
  return makeTexture((ctx, rng) => {
    const S = 64

    // Very dark base
    ctx.fillStyle = '#111009'
    ctx.fillRect(0, 0, S, S)

    // Irregular stone patches (rough-hewn, no clean block pattern)
    for (let i = 0; i < 18; i++) {
      const px = rng() * S, py = rng() * S
      const pw = 6 + rng() * 18, ph = 5 + rng() * 12
      const v   = rng() * 18
      const lum = Math.round(25 + v)
      ctx.fillStyle = `rgb(${lum},${lum},${lum - 2})`
      ctx.fillRect(px, py, pw, ph)
    }

    // Water stain rings — concentric ellipses, brownish
    for (let i = 0; i < 6; i++) {
      const cx = rng() * S, cy = rng() * S
      const maxR = 5 + rng() * 14
      for (let r = maxR; r > 1; r -= 2.5) {
        const brown = Math.round(45 + rng() * 28)
        ctx.strokeStyle = `rgba(${brown},${brown - 14},${brown - 22},${0.35 + rng() * 0.35})`
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.ellipse(cx, cy, r, r * 0.65, rng() * 0.5, 0, Math.PI * 2)
        ctx.stroke()
      }
    }

    // Black mold spots
    for (let i = 0; i < 14; i++) {
      const mx = rng() * S, my = rng() * S
      const mr = 0.8 + rng() * 2.8
      ctx.fillStyle = `rgba(4,4,3,${0.6 + rng() * 0.38})`
      ctx.beginPath()
      ctx.arc(mx, my, mr, 0, Math.PI * 2)
      ctx.fill()
    }

    // Hairline cracks
    for (let i = 0; i < 4; i++) {
      const cx0 = rng() * S, cy0 = rng() * S
      ctx.strokeStyle = 'rgba(4,4,3,0.72)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(cx0, cy0)
      let cx = cx0, cy = cy0
      for (let j = 0; j < 6; j++) {
        cx += (rng() - 0.5) * 8
        cy += (rng() - 0.5) * 8
        ctx.lineTo(cx, cy)
      }
      ctx.stroke()
    }

    // Subtle moss tinge near edges
    for (let i = 0; i < 5; i++) {
      const ex = (rng() < 0.5 ? 0 : S - 4), ey = rng() * S
      const g  = Math.round(55 + rng() * 40)
      ctx.fillStyle = `rgba(10,${g},8,${0.25 + rng() * 0.3})`
      ctx.fillRect(ex, ey, 4, 4 + rng() * 8)
    }
  }, 7)
}
