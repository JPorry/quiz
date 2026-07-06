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
  [1, null, 0, 0, 1, null, null, 1, null, 0],
  [1, null, 0, 1, null, 0, 1, null, null, 1],
  [null, 1, 1, 0, 1, 1, null, 0, 1, null],
  [0, 1, 0, null, 1, null, 0, 1, null, null],
  [1, 0, null, 1, 0, null, 1, 0, 0, null],
  [1, null, 1, 0, null, 1, 0, null, null, 1],
  [null, 1, 1, 0, 1, 0, null, 1, 0, null],
  [0, null, 0, 1, null, 1, 1, 0, 0, 1],
  [1, 0, null, 0, 1, 0, null, 1, 1, 0],
  [0, null, 1, 1, 0, 1, 1, null, 0, 1],
]

function rotateGrid(grid) {
  return grid[0].map((_, column) =>
    grid.map((row) => row[column]).reverse(),
  )
}

function invertGrid(grid) {
  return grid.map((row) =>
    row.map((value) => (value === null ? null : value === 0 ? 1 : 0)),
  )
}

const rotatedSolution = rotateGrid(BASE_SOLUTION)
const rotatedPuzzle = rotateGrid(BASE_PUZZLE)

export const PUZZLES = [
  { name: 'Apricot', solution: BASE_SOLUTION, puzzle: BASE_PUZZLE },
  {
    name: 'Lagoon',
    solution: invertGrid(rotatedSolution),
    puzzle: invertGrid(rotatedPuzzle),
  },
  {
    name: 'Mulberry',
    solution: rotateGrid(rotatedSolution),
    puzzle: rotateGrid(rotatedPuzzle),
  },
]
