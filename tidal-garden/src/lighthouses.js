// Lighthouses: some starting land tiles carry a lighthouse with a number, the count of water tiles
// its light reaches looking straight up, down, left and right before land or the board's edge
// stops it. Each lighthouse is { cell: [row, col], sees }.

export const DIRECTIONS = Object.freeze([[-1, 0], [1, 0], [0, -1], [0, 1]])

// What one beam can see so far: `lit` is the water already known to be in reach, `open` is the
// first undecided tile it meets (if any), and `reach` is the most it could see if every undecided
// tile ahead turned out to be water.
export function beam(grid, [row, col], [dr, dc]) {
  const size = grid.length
  const lit = []
  let open = null, reach = 0
  for (let r = row + dr, c = col + dc; r >= 0 && c >= 0 && r < size && c < size; r += dr, c += dc) {
    const value = grid[r][c]
    if (value === 1) break
    if (value === null && !open) open = [r, c]
    if (!open) lit.push([r, c])
    reach++
  }
  return { lit, open, reach }
}

// Each lighthouse as it stands: the water it already sees, the most it could still see, and
// whether every beam is settled at exactly its number.
export function lighthouses(grid, lights = []) {
  return lights.map((light) => {
    const beams = DIRECTIONS.map((direction) => ({ direction, ...beam(grid, light.cell, direction) }))
    const seen = beams.reduce((sum, b) => sum + b.lit.length, 0)
    const most = beams.reduce((sum, b) => sum + b.reach, 0)
    const settled = beams.every((b) => !b.open)
    return { light, beams, seen, most, settled, over: seen > light.sees, short: most < light.sees, complete: settled && seen === light.sees }
  })
}

// Lighthouses that already see too much, or can no longer see enough.
export function lighthouseViolations(grid, lights = []) {
  const broken = new Set()
  for (const state of lighthouses(grid, lights)) {
    if (state.over || state.short) broken.add(`${state.light.cell[0]}:${state.light.cell[1]}`)
  }
  return broken
}

export const lighthousesHold = (grid, lights = []) => lighthouses(grid, lights).every((state) => state.complete)
