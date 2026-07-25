export const BIOME_SYMBOLS = Object.freeze({
  PLANT: 0,
  WORM: 1,
  BIRD: 2,
})

export const BIOME_SYMBOL_LIST = Object.freeze([
  BIOME_SYMBOLS.PLANT,
  BIOME_SYMBOLS.WORM,
  BIOME_SYMBOLS.BIRD,
])

export const BIOME_TECHNIQUES = Object.freeze({
  SEPARATED_PREDATORS: 'E1',
  BALANCE: 'R0',
  NO_THREE: 'R1',
  FOOD_CHAIN: 'R2',
})

const DEFAULT_SIZE = 6
const DEFAULT_SOLUTION_LIMIT = 2
const validLineCache = new Map()

function assertSize(size) {
  if (!Number.isInteger(size) || size <= 0 || size % BIOME_SYMBOL_LIST.length !== 0) {
    throw new Error(
      `Biomes puzzle size must be a positive multiple of ${BIOME_SYMBOL_LIST.length}, received ${size}`,
    )
  }

  return size
}

function assertBiomesGrid(grid, { allowEmpty }) {
  if (!Array.isArray(grid) || grid.length === 0) {
    throw new Error('Biomes puzzles must be non-empty square grids')
  }

  const size = assertSize(grid.length)
  const allowedValues = allowEmpty
    ? [null, ...BIOME_SYMBOL_LIST]
    : BIOME_SYMBOL_LIST

  if (
    grid.some(
      (row) =>
        !Array.isArray(row) ||
        row.length !== size ||
        row.some((value) => !allowedValues.includes(value)),
    )
  ) {
    throw new Error('Biomes grid contains an invalid row or symbol')
  }

  return size
}

export function hasBiomesTriple(values) {
  return values.some(
    (value, index) =>
      value !== null &&
      index <= values.length - 3 &&
      value === values[index + 1] &&
      value === values[index + 2],
  )
}

export function hasTrappedBiomesPrey(values) {
  return values.some((value, index) => {
    if (index > values.length - 3) return false

    const middle = values[index + 1]
    const right = values[index + 2]
    return (
      (value === BIOME_SYMBOLS.WORM &&
        middle === BIOME_SYMBOLS.PLANT &&
        right === BIOME_SYMBOLS.WORM) ||
      (value === BIOME_SYMBOLS.BIRD &&
        middle === BIOME_SYMBOLS.WORM &&
        right === BIOME_SYMBOLS.BIRD)
    )
  })
}

export function isValidBiomesLine(values) {
  if (!Array.isArray(values) || values.length === 0) return false

  const size = values.length
  try {
    assertSize(size)
  } catch {
    return false
  }

  const targetCount = size / BIOME_SYMBOL_LIST.length
  return (
    values.every((value) => BIOME_SYMBOL_LIST.includes(value)) &&
    BIOME_SYMBOL_LIST.every(
      (symbol) => values.filter((value) => value === symbol).length === targetCount,
    ) &&
    !hasBiomesTriple(values) &&
    !hasTrappedBiomesPrey(values)
  )
}

export function getValidBiomesLines(size = DEFAULT_SIZE) {
  assertSize(size)

  if (!validLineCache.has(size)) {
    const lineCount = BIOME_SYMBOL_LIST.length ** size
    const lines = Array.from({ length: lineCount }, (_, number) => {
      let remainder = number
      const line = Array(size)

      for (let index = size - 1; index >= 0; index -= 1) {
        line[index] = remainder % BIOME_SYMBOL_LIST.length
        remainder = Math.floor(remainder / BIOME_SYMBOL_LIST.length)
      }

      return line
    }).filter(isValidBiomesLine)

    validLineCache.set(size, lines)
  }

  return validLineCache.get(size)
}

function isValidPartialLine(values, size) {
  const targetCount = size / BIOME_SYMBOL_LIST.length
  return (
    BIOME_SYMBOL_LIST.every(
      (symbol) => values.filter((value) => value === symbol).length <= targetCount,
    ) &&
    !hasBiomesTriple(values) &&
    !hasTrappedBiomesPrey(values)
  )
}

function matchesClues(line, clues) {
  return line.every((value, index) => clues[index] === null || clues[index] === value)
}

export function canAppendBiomesRow(rows, candidate, size = candidate.length) {
  return candidate.every((_, column) => {
    const values = [...rows.map((row) => row[column]), candidate[column]]
    return isValidPartialLine(values, size)
  })
}

export function isValidBiomesSolution(grid) {
  let size

  try {
    size = assertBiomesGrid(grid, { allowEmpty: false })
  } catch {
    return false
  }

  const columns = Array.from({ length: size }, (_, column) =>
    grid.map((row) => row[column]),
  )

  return grid.every(isValidBiomesLine) && columns.every(isValidBiomesLine)
}

export function solveBiomesPuzzle(
  puzzle,
  { maxSolutions = DEFAULT_SOLUTION_LIMIT } = {},
) {
  const size = assertBiomesGrid(puzzle, { allowEmpty: true })

  if (!Number.isInteger(maxSolutions) || maxSolutions < 1) {
    throw new Error(`maxSolutions must be a positive integer, received ${maxSolutions}`)
  }

  const validLines = getValidBiomesLines(size)
  const rowCandidates = puzzle.map((clues) =>
    validLines.filter((line) => matchesClues(line, clues)),
  )
  const solutions = []

  function search(rows) {
    if (solutions.length >= maxSolutions) return

    if (rows.length === size) {
      if (isValidBiomesSolution(rows)) {
        solutions.push(rows.map((row) => [...row]))
      }
      return
    }

    for (const candidate of rowCandidates[rows.length]) {
      if (canAppendBiomesRow(rows, candidate, size)) {
        search([...rows, candidate])
      }
    }
  }

  search([])
  return solutions
}

export function countBiomesSolutions(
  puzzle,
  maxSolutions = DEFAULT_SOLUTION_LIMIT,
) {
  return solveBiomesPuzzle(puzzle, { maxSolutions }).length
}

export function findBiomesViolations(grid) {
  const size = assertBiomesGrid(grid, { allowEmpty: true })
  const targetCount = size / BIOME_SYMBOL_LIST.length
  const invalid = new Set()
  const add = (row, column) => invalid.add(`${row}-${column}`)

  for (let index = 0; index < size; index += 1) {
    const row = grid[index]
    const column = grid.map((currentRow) => currentRow[index])

    for (const [values, isColumn] of [
      [row, false],
      [column, true],
    ]) {
      for (const symbol of BIOME_SYMBOL_LIST) {
        if (values.filter((value) => value === symbol).length > targetCount) {
          values.forEach((value, position) => {
            if (value !== symbol) return
            if (isColumn) add(position, index)
            else add(index, position)
          })
        }
      }

      for (let start = 0; start <= size - 3; start += 1) {
        const trio = values.slice(start, start + 3)
        const hasTriple =
          trio[0] !== null && trio.every((value) => value === trio[0])
        const hasTrappedPrey =
          (trio[0] === BIOME_SYMBOLS.WORM &&
            trio[1] === BIOME_SYMBOLS.PLANT &&
            trio[2] === BIOME_SYMBOLS.WORM) ||
          (trio[0] === BIOME_SYMBOLS.BIRD &&
            trio[1] === BIOME_SYMBOLS.WORM &&
            trio[2] === BIOME_SYMBOLS.BIRD)

        if (hasTriple || hasTrappedPrey) {
          trio.forEach((_, offset) => {
            if (isColumn) add(start + offset, index)
            else add(index, start + offset)
          })
        }
      }
    }
  }

  return invalid
}

function getLine(grid, row, column, orientation) {
  return orientation === 'row'
    ? grid[row]
    : grid.map((currentRow) => currentRow[column])
}

function getRuleEliminations(grid, row, column, symbol) {
  const size = grid.length
  const targetCount = size / BIOME_SYMBOL_LIST.length
  const rules = new Set()

  for (const orientation of ['row', 'column']) {
    const values = [...getLine(grid, row, column, orientation)]
    const position = orientation === 'row' ? column : row
    values[position] = symbol

    if (values.filter((value) => value === symbol).length > targetCount) {
      rules.add(BIOME_TECHNIQUES.BALANCE)
    }
    if (hasBiomesTriple(values)) {
      rules.add(BIOME_TECHNIQUES.NO_THREE)
    }
    if (hasTrappedBiomesPrey(values)) {
      rules.add(BIOME_TECHNIQUES.FOOD_CHAIN)
    }
  }

  return rules
}

function findSeparatedPredatorPlacement(grid, row, column) {
  const patterns = [
    [BIOME_SYMBOLS.BIRD, BIOME_SYMBOLS.PLANT],
    [BIOME_SYMBOLS.WORM, BIOME_SYMBOLS.BIRD],
  ]

  for (const orientation of ['row', 'column']) {
    const values = getLine(grid, row, column, orientation)
    const position = orientation === 'row' ? column : row

    for (const [predator, placement] of patterns) {
      if (
        position > 0 &&
        position < values.length - 1 &&
        values[position - 1] === predator &&
        values[position + 1] === predator
      ) {
        return placement
      }
    }
  }

  return null
}

function classifyRules(rules) {
  const order = [
    BIOME_TECHNIQUES.BALANCE,
    BIOME_TECHNIQUES.NO_THREE,
    BIOME_TECHNIQUES.FOOD_CHAIN,
  ]
  return order.filter((rule) => rules.has(rule)).join('+')
}

export function findBiomesLogicalPlacements(grid) {
  const size = assertBiomesGrid(grid, { allowEmpty: true })
  const placements = []

  for (let row = 0; row < size; row += 1) {
    for (let column = 0; column < size; column += 1) {
      if (grid[row][column] !== null) continue

      const allowed = []
      const eliminatedBy = new Map()

      for (const symbol of BIOME_SYMBOL_LIST) {
        const rules = getRuleEliminations(grid, row, column, symbol)
        if (rules.size === 0) allowed.push(symbol)
        else eliminatedBy.set(symbol, rules)
      }

      if (allowed.length !== 1) continue

      const value = allowed[0]
      const separatedPredatorValue = findSeparatedPredatorPlacement(grid, row, column)

      if (separatedPredatorValue === value) {
        placements.push({
          row,
          column,
          value,
          technique: BIOME_TECHNIQUES.SEPARATED_PREDATORS,
          rules: [BIOME_TECHNIQUES.NO_THREE, BIOME_TECHNIQUES.FOOD_CHAIN],
        })
        continue
      }

      const combinedRules = new Set()
      eliminatedBy.forEach((rules) => {
        rules.forEach((rule) => combinedRules.add(rule))
      })

      placements.push({
        row,
        column,
        value,
        technique: classifyRules(combinedRules),
        rules: [...combinedRules],
      })
    }
  }

  return placements
}

export function analyzeBiomesPuzzle(puzzle) {
  assertBiomesGrid(puzzle, { allowEmpty: true })
  const grid = puzzle.map((row) => [...row])
  const steps = []
  const availability = []

  while (grid.some((row) => row.includes(null))) {
    const placements = findBiomesLogicalPlacements(grid)
    availability.push(placements.length)
    if (placements.length === 0) break

    const placement = placements[0]
    grid[placement.row][placement.column] = placement.value
    steps.push(placement)
  }

  const solved = isValidBiomesSolution(grid)
  const techniqueCounts = steps.reduce((counts, step) => {
    counts[step.technique] = (counts[step.technique] ?? 0) + 1
    return counts
  }, {})
  const techniques = Object.keys(techniqueCounts)
  const pureBalanceSteps = techniqueCounts[BIOME_TECHNIQUES.BALANCE] ?? 0
  const averageAvailablePlacements =
    availability.length === 0
      ? 0
      : availability.reduce((sum, count) => sum + count, 0) / availability.length
  const longestSinglePath = availability.reduce(
    (state, count) => {
      const current = count === 1 ? state.current + 1 : 0
      return {
        current,
        longest: Math.max(state.longest, current),
      }
    },
    { current: 0, longest: 0 },
  ).longest

  return {
    solved,
    grid,
    steps,
    techniqueCounts,
    techniqueDiversity: techniques.length,
    pureBalanceRatio: steps.length === 0 ? 0 : pureBalanceSteps / steps.length,
    averageAvailablePlacements,
    dependencyRatio:
      availability.length === 0
        ? 0
        : availability.filter((count) => count === 1).length /
          availability.length,
    longestSinglePath,
    minimumAvailablePlacements:
      availability.length === 0 ? 0 : Math.min(...availability),
    unresolvedCells: grid.flat().filter((value) => value === null).length,
  }
}

export function scoreBiomesAnalysis(analysis) {
  if (!analysis.solved) return Number.NEGATIVE_INFINITY

  const e1Count =
    analysis.techniqueCounts[BIOME_TECHNIQUES.SEPARATED_PREDATORS] ?? 0
  const desiredCombinedTechniques = ['R0+R1', 'R0+R2', 'R0+R1+R2']
  const combinedDiversity = desiredCombinedTechniques.filter(
    (technique) => analysis.techniqueCounts[technique],
  ).length
  const smoothness = Math.min(analysis.averageAvailablePlacements, 8)

  return (
    analysis.steps.length * 1.5 +
    e1Count * 8 +
    analysis.techniqueDiversity * 7 +
    combinedDiversity * 10 +
    smoothness * 2 -
    analysis.pureBalanceRatio * 45 -
    analysis.longestSinglePath * 1.5
  )
}
