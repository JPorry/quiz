export const SIZE = 10

const BASE_SOLUTION = [
  [1, 1, 0, 0, 1, 0, 0, 1, 1, 0],
  [1, 0, 0, 1, 0, 0, 1, 1, 0, 1],
  [0, 1, 1, 0, 1, 1, 0, 0, 1, 0],
  [0, 1, 0, 1, 1, 0, 0, 1, 1, 0],
  [1, 0, 0, 1, 0, 1, 1, 0, 0, 1],
  [1, 0, 1, 0, 0, 1, 0, 0, 1, 1],
  [0, 1, 1, 0, 1, 0, 1, 1, 0, 0],
  [0, 1, 0, 1, 0, 1, 1, 0, 0, 1],
  [1, 0, 1, 0, 1, 0, 0, 1, 1, 0],
  [0, 0, 1, 1, 0, 1, 1, 0, 0, 1],
]

const BASE_PUZZLE = [
  [null, null, null, 0, null, null, null, 1, null, null],
  [1, null, null, null, null, null, 1, null, null, null],
  [null, null, null, null, 1, 1, null, 0, 1, null],
  [null, null, null, null, null, null, 0, null, null, null],
  [null, 0, null, null, 0, null, 1, 0, 0, null],
  [null, null, 1, null, null, null, 0, null, null, 1],
  [null, 1, 1, null, null, null, null, null, 0, null],
  [null, null, 0, null, null, 1, null, 0, 0, null],
  [1, 0, null, 0, 1, null, null, null, 1, 0],
  [null, null, 1, null, null, 1, null, null, 0, 1],
]

function rotateGrid(grid) {
  return grid[0].map((_, column) =>
    grid.map((row) => row[column]).reverse(),
  )
}

function flipRows(grid) {
  return [...grid].reverse().map((row) => [...row])
}

function flipColumns(grid) {
  return grid.map((row) => [...row].reverse())
}

function invertGrid(grid) {
  return grid.map((row) =>
    row.map((value) => (value === null ? null : value === 0 ? 1 : 0)),
  )
}

function rotateTimes(grid, times) {
  return Array.from({ length: times }).reduce((currentGrid) => rotateGrid(currentGrid), grid)
}

function transformLevel({ solution, puzzle }, transform) {
  const transformedSolution = transform(solution)
  const transformedPuzzle = transform(puzzle)

  return {
    solution: transformedSolution,
    puzzle: transformedPuzzle,
  }
}

const LEVEL_DEFINITIONS = [
  ['level-01', 'Level 1', (grid) => grid],
  ['level-02', 'Level 2', (grid) => invertGrid(grid)],
  ['level-03', 'Level 3', (grid) => rotateTimes(grid, 1)],
  ['level-04', 'Level 4', (grid) => invertGrid(rotateTimes(grid, 1))],
  ['level-05', 'Level 5', (grid) => rotateTimes(grid, 2)],
  ['level-06', 'Level 6', (grid) => invertGrid(rotateTimes(grid, 2))],
  ['level-07', 'Level 7', (grid) => rotateTimes(grid, 3)],
  ['level-08', 'Level 8', (grid) => invertGrid(rotateTimes(grid, 3))],
  ['level-09', 'Level 9', (grid) => flipRows(grid)],
  ['level-10', 'Level 10', (grid) => invertGrid(flipColumns(grid))],
]

export const PUZZLES = LEVEL_DEFINITIONS.map(([id, name, transform]) => ({
  id,
  name,
  ...transformLevel(
    { solution: BASE_SOLUTION, puzzle: BASE_PUZZLE },
    transform,
  ),
}))
