// Ferries: some starting land tiles carry a little dock with a colored roof. Docks come in pairs of
// one color, and each pair must end up joined by water: a ferry has to be able to sail from the
// water beside one dock to the water beside the other, moving up, down, left and right.
// Each route is { color, docks: [[row, col], [row, col]] }.

const NEIGHBORS = [[-1, 0], [1, 0], [0, -1], [0, 1]]

const around = (grid, [row, col]) => NEIGHBORS
  .map(([dr, dc]) => [row + dr, col + dc])
  .filter(([r, c]) => r >= 0 && c >= 0 && r < grid.length && c < grid.length)

// The shortest way by water from one dock to the other, over tiles that pass `open`, as the list of
// tiles the ferry crosses; null when there is none. Skips the tile `without`, if given.
export function passage(grid, [from, to], open = (value) => value === 0, without = null) {
  const size = grid.length
  const passable = ([r, c]) => open(grid[r][c]) && !(without && without[0] === r && without[1] === c)
  const goal = new Set(around(grid, to).filter(passable).map(([r, c]) => r * size + c))
  if (!goal.size) return null
  const previous = new Map()
  const queue = []
  for (const cell of around(grid, from).filter(passable)) {
    const key = cell[0] * size + cell[1]
    if (previous.has(key)) continue
    previous.set(key, null)
    queue.push(cell)
  }
  for (let head = 0; head < queue.length; head++) {
    const [r, c] = queue[head]
    const key = r * size + c
    if (goal.has(key)) {
      const path = []
      for (let at = key; at !== null; at = previous.get(at)) path.unshift([Math.floor(at / size), at % size])
      return path
    }
    for (const next of around(grid, [r, c])) {
      const nextKey = next[0] * size + next[1]
      if (previous.has(nextKey) || !passable(next)) continue
      previous.set(nextKey, key)
      queue.push(next)
    }
  }
  return null
}

const waterOrOpen = (value) => value !== 1

// Each ferry route as it stands: the water passage it sails (if it is open yet), and whether it
// can still open at all once the undecided tiles are filled in.
export function ferries(grid, routes = []) {
  return routes.map((route) => {
    const path = passage(grid, route.docks)
    const possible = path ?? passage(grid, route.docks, waterOrOpen)
    return { route, path, possible, stranded: !possible, complete: !!path }
  })
}

// Docks whose ferry can no longer reach its partner, whatever is still undecided.
export function ferryViolations(grid, routes = []) {
  const broken = new Set()
  for (const state of ferries(grid, routes)) {
    if (state.stranded) for (const [r, c] of state.route.docks) broken.add(`${r}:${c}`)
  }
  return broken
}

export const ferriesHold = (grid, routes = []) => ferries(grid, routes).every((state) => state.complete)

// Undecided tiles every remaining way between a pair of docks has to cross: land on any of them
// would strand the ferry, so they must be water. Only tiles on one possible passage can be such a
// tile, so only those are tried.
export function channels(grid, routes = []) {
  const found = []
  for (const state of ferries(grid, routes)) {
    if (state.complete || state.stranded) continue
    for (const cell of state.possible) {
      if (grid[cell[0]][cell[1]] !== null) continue
      if (!passage(grid, state.route.docks, waterOrOpen, cell)) found.push(cell)
    }
  }
  return found
}
