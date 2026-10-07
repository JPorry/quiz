// Pilgrims: some starting land tiles carry a little shrine with a colored lantern. Shrines come in
// pairs of one color, and each pair must end up on the same island, so a pilgrim can walk from one
// to the other over land, moving up, down, left and right.
// Each pilgrimage is { color, shrines: [[row, col], [row, col]] }.

// Each pair of shrines has its own lantern color, in this order.
export const PILGRIM_COLORS = Object.freeze(['rose', 'mint', 'amber', 'violet'])

const NEIGHBORS = [[-1, 0], [1, 0], [0, -1], [0, 1]]
const isLand = (value) => value === 1
const landOrOpen = (value) => value !== 0

// The shortest walk over land from one shrine to the other, over tiles that pass `open`, as the list
// of tiles the pilgrim steps on, both shrines included; null when there is none. Skips the tile
// `without`, if given.
export function trail(grid, [from, to], open = isLand, without = null) {
  const size = grid.length
  const passable = ([r, c]) => r >= 0 && c >= 0 && r < size && c < size && open(grid[r][c]) && !(without && without[0] === r && without[1] === c)
  if (!passable(from) || !passable(to)) return null
  const previous = new Map([[from[0] * size + from[1], null]])
  const goal = to[0] * size + to[1]
  const queue = [from]
  for (let head = 0; head < queue.length; head++) {
    const [r, c] = queue[head]
    const key = r * size + c
    if (key === goal) {
      const path = []
      for (let at = key; at !== null; at = previous.get(at)) path.unshift([Math.floor(at / size), at % size])
      return path
    }
    for (const [dr, dc] of NEIGHBORS) {
      const next = [r + dr, c + dc]
      const nextKey = next[0] * size + next[1]
      if (previous.has(nextKey) || !passable(next)) continue
      previous.set(nextKey, key)
      queue.push(next)
    }
  }
  return null
}

// Each pilgrimage as it stands: the trail between its shrines (if their island already joins them),
// and whether it can still be joined once the undecided tiles are filled in.
export function pilgrimages(grid, pairs = []) {
  return pairs.map((pair) => {
    const path = trail(grid, pair.shrines)
    const possible = path ?? trail(grid, pair.shrines, landOrOpen)
    return { pair, path, possible, parted: !possible, complete: !!path }
  })
}

// Shrines whose pilgrim can no longer reach its partner, whatever is still undecided.
export function pilgrimViolations(grid, pairs = []) {
  const broken = new Set()
  for (const state of pilgrimages(grid, pairs)) {
    if (state.parted) for (const [r, c] of state.pair.shrines) broken.add(`${r}:${c}`)
  }
  return broken
}

export const pilgrimsHold = (grid, pairs = []) => pilgrimages(grid, pairs).every((state) => state.complete)

// Undecided tiles every remaining walk between a pair of shrines has to cross: water on any of them
// would part the pilgrims, so they must be land. Only tiles on one possible walk can be such a tile,
// so only those are tried.
export function footpaths(grid, pairs = []) {
  const found = []
  for (const state of pilgrimages(grid, pairs)) {
    if (state.complete || state.parted) continue
    for (const cell of state.possible) {
      if (grid[cell[0]][cell[1]] !== null) continue
      if (!trail(grid, state.pair.shrines, landOrOpen, cell)) found.push(cell)
    }
  }
  return found
}
