export const BIOME_SYMBOLS = Object.freeze({
  WATER: 0,
  FIRE: 1,
  NATURE: 2,
})

export const BIOME_SYMBOL_LIST = Object.freeze([
  BIOME_SYMBOLS.WATER,
  BIOME_SYMBOLS.FIRE,
  BIOME_SYMBOLS.NATURE,
])

export const BIOME_TECHNIQUES = Object.freeze({
  SEPARATED_DOMINATORS: 'E1',
  BALANCE: 'R0',
  NO_THREE: 'R1',
  DOMINANCE: 'R2',
  LINE_QUOTA: 'LQ',
  CANDIDATE_ELIMINATION: 'CE',
})

const DEFAULT_SIZE = 6
const DEFAULT_SOLUTION_LIMIT = 2
const DEFAULT_NODE_LIMIT = 250_000
const DEFAULT_TIMEOUT_MS = 5_000
const validLineCache = new Map()
const compatibleLineCache = new Map()

export const BIOMES_MODES = Object.freeze({
  compact: Object.freeze({
    id: 'compact',
    boardSize: 6,
    symbolCount: BIOME_SYMBOL_LIST.length,
    targetPerSymbol: 2,
    experimental: false,
  }),
  standard: Object.freeze({
    id: 'standard',
    boardSize: 9,
    symbolCount: BIOME_SYMBOL_LIST.length,
    targetPerSymbol: 3,
    experimental: true,
  }),
})

export function getBiomesMode(mode = 'compact') {
  const config = typeof mode === 'string' ? BIOMES_MODES[mode] : mode
  if (!config) throw new Error(`Unknown Biomes mode: ${mode}`)

  const boardSize = assertBiomesSize(config.boardSize)
  const symbolCount = BIOME_SYMBOL_LIST.length
  const targetPerSymbol = boardSize / symbolCount

  if (
    config.symbolCount !== symbolCount ||
    config.targetPerSymbol !== targetPerSymbol
  ) {
    throw new Error(`Invalid Biomes mode configuration: ${config.id}`)
  }

  return config
}

export function assertBiomesSize(size) {
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

  const size = assertBiomesSize(grid.length)
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

export function hasDominatedElementTrap(values) {
  return values.some((value, index) => {
    if (index > values.length - 3) return false

    const middle = values[index + 1]
    const right = values[index + 2]
    return (
      (value === BIOME_SYMBOLS.WATER &&
        middle === BIOME_SYMBOLS.FIRE &&
        right === BIOME_SYMBOLS.WATER) ||
      (value === BIOME_SYMBOLS.FIRE &&
        middle === BIOME_SYMBOLS.NATURE &&
        right === BIOME_SYMBOLS.FIRE) ||
      (value === BIOME_SYMBOLS.NATURE &&
        middle === BIOME_SYMBOLS.WATER &&
        right === BIOME_SYMBOLS.NATURE)
    )
  })
}

export function isValidBiomesLine(values) {
  if (!Array.isArray(values) || values.length === 0) return false

  const size = values.length
  try {
    assertBiomesSize(size)
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
    !hasDominatedElementTrap(values)
  )
}

export function getValidBiomesLines(size = DEFAULT_SIZE) {
  assertBiomesSize(size)

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
    !hasDominatedElementTrap(values)
  )
}

function matchesClues(line, clues) {
  return line.every((value, index) => clues[index] === null || clues[index] === value)
}

function getCompatibleBiomesLines(clues) {
  const key = `${clues.length}:${clues
    .map((value) => (value === null ? '.' : value))
    .join('')}`

  if (!compatibleLineCache.has(key)) {
    if (compatibleLineCache.size >= 20_000) compatibleLineCache.clear()
    compatibleLineCache.set(
      key,
      getValidBiomesLines(clues.length).filter((line) =>
        matchesClues(line, clues),
      ),
    )
  }

  return compatibleLineCache.get(key)
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

export function solveBiomesPuzzleDetailed(
  puzzle,
  {
    maxSolutions = DEFAULT_SOLUTION_LIMIT,
    nodeLimit = DEFAULT_NODE_LIMIT,
    timeoutMs = DEFAULT_TIMEOUT_MS,
  } = {},
) {
  const size = assertBiomesGrid(puzzle, { allowEmpty: true })

  if (!Number.isInteger(maxSolutions) || maxSolutions < 1) {
    throw new Error(`maxSolutions must be a positive integer, received ${maxSolutions}`)
  }
  if (!Number.isInteger(nodeLimit) || nodeLimit < 1) {
    throw new Error(`nodeLimit must be a positive integer, received ${nodeLimit}`)
  }
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new Error(`timeoutMs must be positive, received ${timeoutMs}`)
  }

  const solutions = []
  const startedAt = Date.now()
  let nodes = 0
  let limitReached = false

  function getLineCandidates(grid, orientation, index) {
    const clues =
      orientation === 'row'
        ? grid[index]
        : grid.map((row) => row[index])
    return getCompatibleBiomesLines(clues)
  }

  function propagate(sourceGrid) {
    const grid = sourceGrid.map((row) => [...row])
    let changed = true

    while (changed) {
      changed = false
      const rowCandidates = Array.from({ length: size }, (_, index) =>
        getLineCandidates(grid, 'row', index),
      )
      const columnCandidates = Array.from({ length: size }, (_, index) =>
        getLineCandidates(grid, 'column', index),
      )

      if (
        rowCandidates.some((candidates) => candidates.length === 0) ||
        columnCandidates.some((candidates) => candidates.length === 0)
      ) {
        return null
      }

      for (let row = 0; row < size; row += 1) {
        for (let column = 0; column < size; column += 1) {
          if (grid[row][column] !== null) continue

          const rowValues = new Set(
            rowCandidates[row].map((line) => line[column]),
          )
          const columnValues = new Set(
            columnCandidates[column].map((line) => line[row]),
          )
          const candidates = BIOME_SYMBOL_LIST.filter(
            (symbol) => rowValues.has(symbol) && columnValues.has(symbol),
          )

          if (candidates.length === 0) return null
          if (candidates.length === 1) {
            grid[row][column] = candidates[0]
            changed = true
          }
        }
      }
    }

    return grid
  }

  function search(sourceGrid) {
    if (solutions.length >= maxSolutions || limitReached) return
    if (nodes >= nodeLimit || Date.now() - startedAt >= timeoutMs) {
      limitReached = true
      return
    }

    nodes += 1
    const grid = propagate(sourceGrid)
    if (!grid) return

    let bestCell = null
    let bestCandidates = null

    for (let row = 0; row < size; row += 1) {
      for (let column = 0; column < size; column += 1) {
        if (grid[row][column] !== null) continue

        const candidates = BIOME_SYMBOL_LIST.filter((symbol) => {
          const rowValues = [...grid[row]]
          rowValues[column] = symbol
          const columnValues = grid.map((currentRow, index) =>
            index === row ? symbol : currentRow[column],
          )
          return (
            isValidPartialLine(rowValues, size) &&
            isValidPartialLine(columnValues, size)
          )
        })

        if (candidates.length === 0) return
        if (!bestCandidates || candidates.length < bestCandidates.length) {
          bestCell = { row, column }
          bestCandidates = candidates
        }
      }
    }

    if (!bestCell) {
      if (isValidBiomesSolution(grid)) {
        solutions.push(grid.map((row) => [...row]))
      }
      return
    }

    for (const symbol of bestCandidates) {
      const nextGrid = grid.map((row) => [...row])
      nextGrid[bestCell.row][bestCell.column] = symbol
      search(nextGrid)
      if (solutions.length >= maxSolutions || limitReached) return
    }
  }

  search(puzzle)

  return {
    solutions,
    nodes,
    elapsedMs: Date.now() - startedAt,
    limitReached,
  }
}

export function solveBiomesPuzzle(puzzle, options = {}) {
  return solveBiomesPuzzleDetailed(puzzle, options).solutions
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
        const hasDominatedTrap = hasDominatedElementTrap(trio)

        if (hasTriple || hasDominatedTrap) {
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
    if (hasDominatedElementTrap(values)) {
      rules.add(BIOME_TECHNIQUES.DOMINANCE)
    }
  }

  return rules
}

function findSeparatedDominatorPlacement(grid, row, column) {
  const patterns = [
    [BIOME_SYMBOLS.WATER, BIOME_SYMBOLS.NATURE],
    [BIOME_SYMBOLS.FIRE, BIOME_SYMBOLS.WATER],
    [BIOME_SYMBOLS.NATURE, BIOME_SYMBOLS.FIRE],
  ]

  for (const orientation of ['row', 'column']) {
    const values = getLine(grid, row, column, orientation)
    const position = orientation === 'row' ? column : row

    for (const [dominator, placement] of patterns) {
      if (
        position > 0 &&
        position < values.length - 1 &&
        values[position - 1] === dominator &&
        values[position + 1] === dominator
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
    BIOME_TECHNIQUES.DOMINANCE,
  ]
  return order.filter((rule) => rules.has(rule)).join('+')
}

function findLineQuotaPlacement(grid, row, column) {
  const possibleValues = []

  for (const orientation of ['row', 'column']) {
    const values = getLine(grid, row, column, orientation)
    const position = orientation === 'row' ? column : row
    const compatibleLines = getCompatibleBiomesLines(values)
    const candidates = new Set(compatibleLines.map((line) => line[position]))
    if (candidates.size === 1) possibleValues.push([...candidates][0])
  }

  if (
    possibleValues.length === 0 ||
    possibleValues.some((value) => value !== possibleValues[0])
  ) {
    return null
  }

  return possibleValues[0]
}

export function findBiomesLogicalPlacements(grid) {
  const size = assertBiomesGrid(grid, { allowEmpty: true })
  const placements = []
  const lineQuotaPlacements = []

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
      const separatedDominatorValue =
        findSeparatedDominatorPlacement(grid, row, column)

      if (separatedDominatorValue === value) {
        placements.push({
          row,
          column,
          value,
          technique: BIOME_TECHNIQUES.SEPARATED_DOMINATORS,
          rules: [BIOME_TECHNIQUES.NO_THREE, BIOME_TECHNIQUES.DOMINANCE],
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

  if (placements.length > 0) return placements

  for (let row = 0; row < size; row += 1) {
    for (let column = 0; column < size; column += 1) {
      if (grid[row][column] !== null) continue
      const value = findLineQuotaPlacement(grid, row, column)
      if (value === null) continue

      lineQuotaPlacements.push({
        row,
        column,
        value,
        technique: BIOME_TECHNIQUES.LINE_QUOTA,
        rules: [BIOME_TECHNIQUES.BALANCE],
      })
    }
  }

  return lineQuotaPlacements
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
  const e1Count =
    techniqueCounts[BIOME_TECHNIQUES.SEPARATED_DOMINATORS] ?? 0
  const r2PlacementCount = steps.filter(
    (step) =>
      step.technique === BIOME_TECHNIQUES.SEPARATED_DOMINATORS ||
      step.rules.includes(BIOME_TECHNIQUES.DOMINANCE),
  ).length
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
  const phaseActivity = getBiomesPhaseActivity(availability)
  const totalHumanSteps = steps.length
  const immediatePlacements = steps.length

  return {
    solved,
    grid,
    steps,
    availability,
    techniqueCounts,
    techniqueUsage: {
      [BIOME_TECHNIQUES.CANDIDATE_ELIMINATION]: 0,
      [BIOME_TECHNIQUES.LINE_QUOTA]:
        techniqueCounts[BIOME_TECHNIQUES.LINE_QUOTA] ?? 0,
      ...techniqueCounts,
    },
    techniqueDiversity: techniques.length,
    clueCount: puzzle.flat().filter((value) => value !== null).length,
    totalPlacements: steps.length,
    totalHumanSteps,
    immediatePlacements,
    candidateEliminations: 0,
    immediatePlacementRate:
      totalHumanSteps === 0 ? 0 : immediatePlacements / totalHumanSteps,
    initialAvailablePlacements: availability[0] ?? 0,
    maxAvailablePlacements:
      availability.length === 0 ? 0 : Math.max(...availability),
    e1Count,
    r2PlacementCount,
    pureR0PlacementCount: pureBalanceSteps,
    pureBalanceRatio: steps.length === 0 ? 0 : pureBalanceSteps / steps.length,
    averageAvailablePlacements,
    dependencyRatio:
      availability.length === 0
        ? 0
        : availability.filter((count) => count === 1).length /
          availability.length,
    longestSinglePath,
    maximumDependencyDepth: longestSinglePath,
    propagationRounds: availability.length,
    phaseActivity,
    minimumAvailablePlacements:
      availability.length === 0 ? 0 : Math.min(...availability),
    unresolvedCells: grid.flat().filter((value) => value === null).length,
  }
}

function getBiomesPhaseActivity(availability) {
  const length = availability.length
  const openingEnd = Math.ceil(length * 0.25)
  const middleEnd = Math.ceil(length * 0.75)
  const summarize = (values) => ({
    steps: values.length,
    averageAvailable:
      values.length === 0
        ? 0
        : values.reduce((sum, value) => sum + value, 0) / values.length,
    singlePathSteps: values.filter((value) => value === 1).length,
  })

  return {
    opening: summarize(availability.slice(0, openingEnd)),
    middle: summarize(availability.slice(openingEnd, middleEnd)),
    ending: summarize(availability.slice(middleEnd)),
  }
}

export const BIOMES_DIFFICULTY_THRESHOLDS = Object.freeze({
  easy: Object.freeze({
    maxPressure: 5,
    minInitialPlacements: 3,
    minImmediatePlacementRate: 0.55,
  }),
  medium: Object.freeze({
    maxPressure: 12,
    minInitialPlacements: 2,
  }),
})

export function classifyBiomesDifficulty(
  analysis,
  thresholds = BIOMES_DIFFICULTY_THRESHOLDS,
) {
  if (!analysis.solved) return 'unsolved'

  const pressure =
    analysis.maximumDependencyDepth * 1.5 +
    analysis.dependencyRatio * 8 +
    Math.max(0, 3 - analysis.initialAvailablePlacements) * 2 +
    Math.max(0, 4 - analysis.techniqueDiversity)

  if (
    pressure <= thresholds.easy.maxPressure &&
    analysis.initialAvailablePlacements >=
      thresholds.easy.minInitialPlacements &&
    analysis.immediatePlacementRate >=
      thresholds.easy.minImmediatePlacementRate
  ) {
    return 'easy'
  }
  if (
    pressure <= thresholds.medium.maxPressure &&
    analysis.initialAvailablePlacements >=
      thresholds.medium.minInitialPlacements
  ) {
    return 'medium'
  }
  return 'hard'
}

export const DEFAULT_BIOMES_QUALITY_WEIGHTS = Object.freeze({
  logicalStep: 1.5,
  e1: 8,
  techniqueDiversity: 7,
  combinedDiversity: 10,
  availability: 2,
  initialPlacement: 4,
  r2Placement: 4,
  immediatePlacementRate: 12,
  pureR0Dominance: 45,
  dependencyDepth: 1.5,
  stalledPhase: 8,
})

export function scoreBiomesAnalysis(
  analysis,
  weights = DEFAULT_BIOMES_QUALITY_WEIGHTS,
) {
  if (!analysis.solved) return Number.NEGATIVE_INFINITY

  const e1Count =
    analysis.techniqueCounts[BIOME_TECHNIQUES.SEPARATED_DOMINATORS] ?? 0
  const desiredCombinedTechniques = ['R0+R1', 'R0+R2', 'R0+R1+R2']
  const combinedDiversity = desiredCombinedTechniques.filter(
    (technique) => analysis.techniqueCounts[technique],
  ).length
  const smoothness = Math.min(analysis.averageAvailablePlacements, 8)
  const r2TechniqueTypes = Object.keys(analysis.techniqueCounts).filter(
    (technique) => technique === 'E1' || technique.includes('R2'),
  ).length
  const stalledPhases = Object.values(analysis.phaseActivity).filter(
    (phase) => phase.steps > 0 && phase.averageAvailable < 1.5,
  ).length
  const pureR0Penalty =
    analysis.pureBalanceRatio > 0.65
      ? (analysis.pureBalanceRatio - 0.65) * weights.pureR0Dominance
      : analysis.pureBalanceRatio * weights.pureR0Dominance * 0.35

  return (
    analysis.steps.length * weights.logicalStep +
    Math.min(e1Count, 5) * weights.e1 +
    analysis.techniqueDiversity * weights.techniqueDiversity +
    combinedDiversity * weights.combinedDiversity +
    smoothness * weights.availability +
    Math.min(analysis.initialAvailablePlacements, 5) *
      weights.initialPlacement +
    Math.min(analysis.r2PlacementCount, 8) * weights.r2Placement +
    r2TechniqueTypes * weights.techniqueDiversity +
    analysis.immediatePlacementRate * weights.immediatePlacementRate -
    pureR0Penalty -
    analysis.maximumDependencyDepth * weights.dependencyDepth -
    stalledPhases * weights.stalledPhase
  )
}
