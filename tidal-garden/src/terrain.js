export const CARDINAL_DIRECTIONS = Object.freeze([
  { name: 'north', row: -1, col: 0 },
  { name: 'east', row: 0, col: 1 },
  { name: 'south', row: 1, col: 0 },
  { name: 'west', row: 0, col: -1 },
])

export const COMPLETION_VARIANTS = Object.freeze({
  1: ['island-bloom', 'island-fireflies', 'island-meadow'],
  0: ['lake-lotus', 'lake-fountain', 'lake-ripples'],
})

export function chooseCompletionVariant(value, previous, random = Math.random) {
  const choices = COMPLETION_VARIANTS[value].filter((variant) => variant !== previous)
  return choices[Math.min(choices.length - 1, Math.floor(random() * choices.length))]
}

export function terrainNeighbors(grid, row, col) {
  return CARDINAL_DIRECTIONS.map((direction) => ({
    ...direction,
    value: grid[row + direction.row]?.[col + direction.col],
  }))
}

export function connectedTerrain(grid, row, col) {
  const value = grid[row]?.[col]
  if (value === null || value === undefined) return []
  const visited = new Set([`${row}:${col}`])
  const cells = [{ row, col }]
  for (let i = 0; i < cells.length; i++) {
    for (const direction of CARDINAL_DIRECTIONS) {
      const next = { row: cells[i].row + direction.row, col: cells[i].col + direction.col }
      const key = `${next.row}:${next.col}`
      if (grid[next.row]?.[next.col] !== value || visited.has(key)) continue
      visited.add(key)
      cells.push(next)
    }
  }
  return cells
}

export function findEnclosedRegions(grid, maxCells = 16) {
  const visited = new Set()
  const regions = []
  for (let row = 0; row < grid.length; row++) for (let col = 0; col < grid[row].length; col++) {
    const value = grid[row][col]
    if ((value !== 0 && value !== 1) || visited.has(`${row}:${col}`)) continue
    const cells = connectedTerrain(grid, row, col)
    cells.forEach((cell) => visited.add(`${cell.row}:${cell.col}`))
    // The edge of the puzzle is not a completed shoreline; unresolved neighbors are not water or land.
    const enclosed = cells.length <= maxCells && cells.every((cell) => terrainNeighbors(grid, cell.row, cell.col)
      .every((neighbor) => neighbor.value === value || neighbor.value === 1 - value))
    if (!enclosed) continue
    cells.sort((a, b) => a.row - b.row || a.col - b.col)
    regions.push({ id: `${value}:${cells.map((cell) => `${cell.row},${cell.col}`).join(';')}`, value, cells })
  }
  return regions
}

// Eight neighbor bits — four sides, then four diagonals — decide how a land tile joins its neighbors.
const MASK_OFFSETS = Object.freeze([[-1, 0], [0, 1], [1, 0], [0, -1], [-1, 1], [1, 1], [1, -1], [-1, -1]])

export function landMask(grid, row, col) {
  return MASK_OFFSETS.reduce((mask, [dr, dc], bit) => grid[row + dr]?.[col + dc] === 1 ? mask | 1 << bit : mask, 0)
}

// Outline of one land tile in plan view (x east, y north), counter-clockwise from the northeast.
// Sides facing water pull in by `inset` and round off; sides facing land reach the tile edge so
// neighbors meet seamlessly, and inner corners get a matching concave fillet.
export function landOutline(mask, inset, radius, steps = 5) {
  const has = (bit) => (mask >> bit & 1) === 1
  const corners = [
    { sx: 1, sy: 1, side: 1, vertical: 0, diagonal: 4, firstIsX: true },
    { sx: -1, sy: 1, side: 3, vertical: 0, diagonal: 7, firstIsX: false },
    { sx: -1, sy: -1, side: 3, vertical: 2, diagonal: 6, firstIsX: true },
    { sx: 1, sy: -1, side: 1, vertical: 2, diagonal: 5, firstIsX: false },
  ]
  const points = []
  const arc = (cx, cy, r, start, end) => {
    let sweep = end - start
    while (sweep > Math.PI) sweep -= Math.PI * 2
    while (sweep <= -Math.PI) sweep += Math.PI * 2
    for (let i = 0; i <= steps; i++) {
      const angle = start + sweep * i / steps
      points.push([cx + Math.cos(angle) * r, cy + Math.sin(angle) * r])
    }
  }
  for (const { sx, sy, side, vertical, diagonal, firstIsX } of corners) {
    const h = has(side), v = has(vertical)
    const ex = h ? 0.5 : 0.5 - inset, ey = v ? 0.5 : 0.5 - inset
    const alongX = Math.atan2(0, sx), alongY = Math.atan2(sy, 0)
    if (!h && !v) {
      const [start, end] = firstIsX ? [alongX, alongY] : [alongY, alongX]
      arc(sx * (ex - radius), sy * (ey - radius), radius, start, end)
    } else if (h && v && !has(diagonal)) {
      const inwardX = Math.atan2(0, -sx), inwardY = Math.atan2(-sy, 0)
      const [start, end] = firstIsX ? [inwardY, inwardX] : [inwardX, inwardY]
      arc(sx * 0.5, sy * 0.5, inset, start, end)
    } else {
      points.push([sx * ex, sy * ey])
    }
  }
  return points
}
