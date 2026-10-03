// The island census: some starting land tiles carry a wooden sign with a number, the count of
// land tiles in the island that tile belongs to. Each sign is { cell: [row, col], size }.

const NEIGHBORS = [[1, 0], [-1, 0], [0, 1], [0, -1]]

// The land connected to a tile, and the undecided tiles it could still grow into.
export function islandAt(grid, row, col) {
  const size = grid.length
  const cells = [], frontier = new Map()
  const seen = new Set([row * size + col])
  const queue = [[row, col]]
  while (queue.length) {
    const [r, c] = queue.shift()
    cells.push([r, c])
    for (const [dr, dc] of NEIGHBORS) {
      const nr = r + dr, nc = c + dc
      if (nr < 0 || nc < 0 || nr >= size || nc >= size) continue
      const key = nr * size + nc
      if (grid[nr][nc] === null) frontier.set(key, [nr, nc])
      if (grid[nr][nc] !== 1 || seen.has(key)) continue
      seen.add(key)
      queue.push([nr, nc])
    }
  }
  return { cells, keys: seen, frontier: [...frontier.values()], sealed: frontier.size === 0 }
}

// Each sign's island as it stands: how big it is, whether water has closed it in, and whether
// it already holds the right number of tiles. Signs on undecided or water tiles have no island.
export function villages(grid, signs = []) {
  return signs.map((sign) => {
    const [row, col] = sign.cell
    if (grid[row][col] !== 1) return { sign, cells: [], keys: new Set(), frontier: [], sealed: false, over: false, short: false, complete: false }
    const island = islandAt(grid, row, col)
    const others = signs.filter((other) => other !== sign && island.keys.has(other.cell[0] * grid.length + other.cell[1]))
    const over = island.cells.length > sign.size || others.some((other) => other.size !== sign.size)
    const short = island.sealed && island.cells.length < sign.size
    return { sign, ...island, over, short, complete: island.sealed && island.cells.length === sign.size && !over }
  })
}

// Tiles of islands that have outgrown their sign, or were closed in before reaching it.
export function censusViolations(grid, signs = []) {
  const broken = new Set()
  for (const village of villages(grid, signs)) {
    if (!village.over && !village.short) continue
    for (const [r, c] of village.cells) broken.add(`${r}:${c}`)
  }
  return broken
}

// A finished garden keeps every sign: each island holds exactly the number it shows.
export const censusHolds = (grid, signs = []) => villages(grid, signs).every((village) => village.complete)
