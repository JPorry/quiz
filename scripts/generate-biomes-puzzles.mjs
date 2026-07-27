import { writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import {
  analyzeBiomesPuzzle,
  canAppendBiomesRow,
  classifyBiomesDifficulty,
  getBiomesMode,
  getValidBiomesLines,
  isValidBiomesSolution,
  scoreBiomesAnalysis,
  solveBiomesPuzzleDetailed,
} from '../src/biomesLogic.js'

const DEFAULT_COUNT = 1
const DEFAULT_SEED = 20260725

export const BIOMES_GENERATOR_SETTINGS = Object.freeze({
  compact: Object.freeze({
    attempts: 16,
    targetClues: 15,
    minInitialPlacements: 1,
    preferredInitialPlacements: 2,
    minR2Placements: 1,
    preferredE1Min: 1,
    preferredE1Max: 5,
    pureR0SoftLimit: 0.5,
    immediatePlacementRateTarget: 0.5,
    maxDependencyDepth: 8,
    flowClueAllowance: 4,
    preferredAverageAvailablePlacements: 3,
    maxPreferredLowChoiceRun: 5,
    preferredNearbyRevealRate: 0.45,
    clueRemovalWeight: 0.2,
    averageAvailabilityPenaltyWeight: 10,
    lowChoiceRunPenaltyWeight: 4,
    nearbyRevealPenaltyWeight: 18,
    completedBoardNodeLimit: 100_000,
    solverNodeLimit: 250_000,
    solverTimeoutMs: 5_000,
  }),
  standard: Object.freeze({
    attempts: 10,
    targetClues: 30,
    minInitialPlacements: 2,
    preferredInitialPlacements: 3,
    minR2Placements: 2,
    preferredE1Min: 1,
    preferredE1Max: 3,
    pureR0SoftLimit: 0.65,
    immediatePlacementRateTarget: 0.35,
    maxDependencyDepth: 14,
    flowClueAllowance: 6,
    preferredAverageAvailablePlacements: 3,
    maxPreferredLowChoiceRun: 8,
    preferredNearbyRevealRate: 0.4,
    clueRemovalWeight: 0.15,
    averageAvailabilityPenaltyWeight: 12,
    lowChoiceRunPenaltyWeight: 5,
    nearbyRevealPenaltyWeight: 20,
    completedBoardNodeLimit: 300_000,
    solverNodeLimit: 750_000,
    solverTimeoutMs: 8_000,
  }),
})

function createSeededRandom(seed) {
  let state = seed >>> 0

  return () => {
    state += 0x6d2b79f5
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

function shuffle(values, random) {
  const shuffled = [...values]

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1))
    ;[shuffled[index], shuffled[swapIndex]] = [
      shuffled[swapIndex],
      shuffled[index],
    ]
  }

  return shuffled
}

function gridsMatch(left, right) {
  return left.every((row, rowIndex) =>
    row.every((value, columnIndex) => value === right[rowIndex][columnIndex]),
  )
}

function incrementReason(reasons, reason) {
  reasons[reason] = (reasons[reason] ?? 0) + 1
}

export function generateBiomesSolution(
  random = Math.random,
  {
    mode = 'compact',
    nodeLimit = BIOMES_GENERATOR_SETTINGS[mode].completedBoardNodeLimit,
  } = {},
) {
  const config = getBiomesMode(mode)
  const size = config.boardSize
  const validLines = getValidBiomesLines(size)
  let nodes = 0

  function search(rows) {
    nodes += 1
    if (nodes > nodeLimit) return null
    if (rows.length === size) {
      return isValidBiomesSolution(rows) ? rows.map((row) => [...row]) : null
    }

    for (const candidate of shuffle(validLines, random)) {
      if (!canAppendBiomesRow(rows, candidate, size)) continue
      const solution = search([...rows, candidate])
      if (solution) return solution
    }

    return null
  }

  const solution = search([])
  if (
    !solution ||
    solution.flat().length !== size * size ||
    !isValidBiomesSolution(solution)
  ) {
    throw new Error('invalid completed board')
  }
  return solution
}

function verifyPuzzleCandidate(
  puzzle,
  solution,
  settings,
  { enforceQuality = true } = {},
) {
  const solveResult = solveBiomesPuzzleDetailed(puzzle, {
    maxSolutions: 2,
    nodeLimit: settings.solverNodeLimit,
    timeoutMs: settings.solverTimeoutMs,
  })

  if (solveResult.limitReached) {
    return { accepted: false, reason: 'solver operation limit' }
  }
  if (solveResult.solutions.length !== 1) {
    return { accepted: false, reason: 'multiple solutions' }
  }
  if (!gridsMatch(solveResult.solutions[0], solution)) {
    return { accepted: false, reason: 'intended solution changed' }
  }

  const analysis = analyzeBiomesPuzzle(puzzle)
  if (!analysis.solved) {
    return { accepted: false, reason: 'unique but not human-solvable' }
  }
  if (
    enforceQuality &&
    analysis.initialAvailablePlacements < settings.minInitialPlacements
  ) {
    return { accepted: false, reason: 'no initial placements' }
  }
  if (
    enforceQuality &&
    analysis.maximumDependencyDepth > settings.maxDependencyDepth
  ) {
    return { accepted: false, reason: 'excessive logical chain length' }
  }

  return { accepted: true, analysis, solveResult }
}

export function carveBiomesPuzzle(
  solution,
  {
    random = Math.random,
    mode = solution.length === 9 ? 'standard' : 'compact',
    targetClues = BIOMES_GENERATOR_SETTINGS[mode].targetClues,
    settings = BIOMES_GENERATOR_SETTINGS[mode],
  } = {},
) {
  if (!isValidBiomesSolution(solution)) {
    throw new Error('Cannot create a puzzle from an invalid Biomes solution')
  }

  const totalCells = solution.length ** 2
  if (!Number.isInteger(targetClues) || targetClues < 1 || targetClues > totalCells) {
    throw new Error(`targetClues must be between 1 and ${totalCells}`)
  }

  const puzzle = solution.map((row) => [...row])
  const positions = shuffle(
    Array.from({ length: totalCells }, (_, index) => index),
    random,
  )
  const rejectionReasons = {}
  const flowCandidates = []
  let clueCount = totalCells

  for (const position of positions) {
    if (clueCount <= targetClues) break

    const row = Math.floor(position / solution.length)
    const column = position % solution.length
    const clue = puzzle[row][column]
    puzzle[row][column] = null

    const verification = verifyPuzzleCandidate(puzzle, solution, settings, {
      enforceQuality: false,
    })
    if (!verification.accepted) {
      puzzle[row][column] = clue
      incrementReason(rejectionReasons, verification.reason)
    } else {
      clueCount -= 1
      if (
        clueCount <= targetClues + settings.flowClueAllowance &&
        verification.analysis.initialAvailablePlacements >=
          settings.minInitialPlacements &&
        verification.analysis.maximumDependencyDepth <=
          settings.maxDependencyDepth
      ) {
        const candidate = {
          puzzle: puzzle.map((puzzleRow) => [...puzzleRow]),
          analysis: verification.analysis,
          clueCount,
          solverNodes: verification.solveResult.nodes,
        }
        flowCandidates.push({
          ...candidate,
          score: getCandidateQuality(candidate, targetClues, settings),
        })
      }
    }
  }

  if (flowCandidates.length === 0) {
    const verification = verifyPuzzleCandidate(puzzle, solution, settings)
    if (!verification.accepted) {
      throw new Error(verification.reason)
    }
    const candidate = {
      puzzle: puzzle.map((puzzleRow) => [...puzzleRow]),
      analysis: verification.analysis,
      clueCount,
      solverNodes: verification.solveResult.nodes,
    }
    flowCandidates.push({
      ...candidate,
      score: getCandidateQuality(candidate, targetClues, settings),
    })
  }

  const selected = flowCandidates.reduce((best, candidate) =>
    !best || candidate.score > best.score ? candidate : best,
  )

  return {
    puzzle: selected.puzzle,
    analysis: selected.analysis,
    clueCount: selected.clueCount,
    rejectionReasons,
    solverNodes: selected.solverNodes,
    flowScore: selected.score,
    restoredForFlow: clueCount === selected.clueCount
      ? 0
      : selected.clueCount - clueCount,
  }
}

function getCandidateQuality(candidate, targetClues, settings) {
  const analysis = candidate.analysis
  const e1Distance =
    analysis.e1Count < settings.preferredE1Min
      ? settings.preferredE1Min - analysis.e1Count
      : Math.max(0, analysis.e1Count - settings.preferredE1Max)
  const initialMoveBonus =
    Math.min(analysis.initialAvailablePlacements, 6) * 4
  const dominanceBonus =
    Math.min(analysis.r2PlacementCount, 10) * 3 - e1Distance * 3
  const pureR0Penalty =
    analysis.pureBalanceRatio > settings.pureR0SoftLimit
      ? (analysis.pureBalanceRatio - settings.pureR0SoftLimit) * 80
      : 0
  const iprPenalty =
    analysis.immediatePlacementRate < settings.immediatePlacementRateTarget
      ? (settings.immediatePlacementRateTarget -
          analysis.immediatePlacementRate) *
        60
      : 0
  const availabilityPenalty =
    analysis.averageAvailablePlacements <
    settings.preferredAverageAvailablePlacements
      ? (settings.preferredAverageAvailablePlacements -
          analysis.averageAvailablePlacements) *
        settings.averageAvailabilityPenaltyWeight
      : 0
  const lowChoiceRunPenalty =
    Math.max(
      0,
      analysis.longestLowChoiceRun - settings.maxPreferredLowChoiceRun,
    ) * settings.lowChoiceRunPenaltyWeight
  const nearbyRevealPenalty =
    analysis.nearbyRevealRate < settings.preferredNearbyRevealRate
      ? (settings.preferredNearbyRevealRate - analysis.nearbyRevealRate) *
        settings.nearbyRevealPenaltyWeight
      : 0
  const clueRemovalBonus =
    Math.max(
      0,
      targetClues + settings.flowClueAllowance - candidate.clueCount,
    ) * settings.clueRemovalWeight

  return (
    scoreBiomesAnalysis(analysis) +
    initialMoveBonus +
    dominanceBonus -
    pureR0Penalty -
    iprPenalty -
    availabilityPenalty -
    lowChoiceRunPenalty -
    nearbyRevealPenalty +
    clueRemovalBonus
  )
}

export function generateUniqueBiomesPuzzle({
  mode = 'compact',
  attempts = BIOMES_GENERATOR_SETTINGS[mode].attempts,
  seed = DEFAULT_SEED,
  targetClues = BIOMES_GENERATOR_SETTINGS[mode].targetClues,
  strict = false,
} = {}) {
  const config = getBiomesMode(mode)
  const settings = BIOMES_GENERATOR_SETTINGS[config.id]
  if (!Number.isInteger(attempts) || attempts < 1) {
    throw new Error(`attempts must be a positive integer, received ${attempts}`)
  }

  let bestCandidate = null
  const rejectionReasons = {}

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const random = createSeededRandom(seed + attempt * 104729)
    const startedAt = Date.now()

    try {
      const solution = generateBiomesSolution(random, { mode: config.id })
      const carved = carveBiomesPuzzle(solution, {
        random,
        mode: config.id,
        targetClues,
        settings,
      })
      Object.entries(carved.rejectionReasons).forEach(([reason, count]) => {
        rejectionReasons[reason] = (rejectionReasons[reason] ?? 0) + count
      })

      const missesStrictTargets =
        carved.analysis.r2PlacementCount < settings.minR2Placements ||
        carved.analysis.e1Count < settings.preferredE1Min ||
        carved.analysis.e1Count > settings.preferredE1Max ||
        carved.analysis.techniqueDiversity < 3
      if (strict && missesStrictTargets) {
        incrementReason(rejectionReasons, 'poor technique diversity')
        continue
      }

      const candidate = {
        ...carved,
        solution,
        generationMs: Date.now() - startedAt,
        score: getCandidateQuality(carved, targetClues, settings),
      }

      if (!bestCandidate || candidate.score > bestCandidate.score) {
        bestCandidate = candidate
      }
    } catch (error) {
      incrementReason(rejectionReasons, error.message)
    }
  }

  if (!bestCandidate) {
    throw new Error(
      `Could not generate a ${config.boardSize}x${config.boardSize} Elements puzzle: ${JSON.stringify(rejectionReasons)}`,
    )
  }

  return { ...bestCandidate, rejectionReasons }
}

function readIntegerArgument(name, fallback) {
  const prefix = `--${name}=`
  const argument = process.argv.find((value) => value.startsWith(prefix))
  if (!argument) return fallback

  const value = Number(argument.slice(prefix.length))
  if (!Number.isInteger(value)) {
    throw new Error(`--${name} must be an integer`)
  }
  return value
}

function readStringArgument(name) {
  const prefix = `--${name}=`
  const argument = process.argv.find((value) => value.startsWith(prefix))
  return argument?.slice(prefix.length) || null
}

function summarizeAnalysis(analysis, clueCount) {
  return {
    classification: classifyBiomesDifficulty(analysis),
    clueCount,
    totalPlacements: analysis.totalPlacements,
    totalHumanSteps: analysis.totalHumanSteps,
    immediatePlacements: analysis.immediatePlacements,
    candidateEliminations: analysis.candidateEliminations,
    initialAvailablePlacements: analysis.initialAvailablePlacements,
    maxAvailablePlacements: analysis.maxAvailablePlacements,
    averageAvailablePlacements: Number(
      analysis.averageAvailablePlacements.toFixed(2),
    ),
    minimumAvailablePlacements: analysis.minimumAvailablePlacements,
    lowChoiceSteps: analysis.lowChoiceSteps,
    lowChoiceRatio: Number(analysis.lowChoiceRatio.toFixed(3)),
    longestLowChoiceRun: analysis.longestLowChoiceRun,
    stallCount: analysis.stallCount,
    nearbyRevealRate: Number(analysis.nearbyRevealRate.toFixed(3)),
    averageNewlyAvailableMoves: Number(
      analysis.averageNewlyAvailableMoves.toFixed(2),
    ),
    continuationProximityRate: Number(
      analysis.continuationProximityRate.toFixed(3),
    ),
    averageNextMoveDistance: Number(
      analysis.averageNextMoveDistance.toFixed(2),
    ),
    techniqueConcentration: Number(
      analysis.techniqueConcentration.toFixed(3),
    ),
    immediatePlacementRate: Number(
      analysis.immediatePlacementRate.toFixed(3),
    ),
    e1Count: analysis.e1Count,
    r2PlacementCount: analysis.r2PlacementCount,
    pureR0PlacementCount: analysis.pureR0PlacementCount,
    pureBalanceRatio: Number(analysis.pureBalanceRatio.toFixed(3)),
    techniqueUsage: analysis.techniqueUsage,
    techniqueDiversity: analysis.techniqueDiversity,
    maximumDependencyDepth: analysis.maximumDependencyDepth,
    propagationRounds: analysis.propagationRounds,
    phaseActivity: analysis.phaseActivity,
    solvedLogically: analysis.solved,
    hasUniqueSolution: true,
  }
}

function compareDifficulty(left, right) {
  const order = { easy: 0, medium: 1, hard: 2 }
  return (
    order[left.difficulty.classification] -
      order[right.difficulty.classification] ||
    left.difficulty.maximumDependencyDepth -
      right.difficulty.maximumDependencyDepth ||
    right.difficulty.averageAvailablePlacements -
      left.difficulty.averageAvailablePlacements ||
    right.difficulty.clueCount - left.difficulty.clueCount
  )
}

function average(values) {
  return values.length === 0
    ? 0
    : values.reduce((sum, value) => sum + value, 0) / values.length
}

export function generatePuzzleBatch({
  mode = 'standard',
  difficulty = 'medium',
  count = 100,
  seed = DEFAULT_SEED,
  attempts = BIOMES_GENERATOR_SETTINGS[mode].attempts,
  targetClues = BIOMES_GENERATOR_SETTINGS[mode].targetClues,
  strict = false,
} = {}) {
  getBiomesMode(mode)
  const levels = []
  const rejectionReasons = {}
  const techniqueDistribution = {}
  let attempted = 0

  for (let index = 0; index < count; index += 1) {
    attempted += attempts
    try {
      const generated = generateUniqueBiomesPuzzle({
        mode,
        attempts,
        seed: seed + index * 1009,
        targetClues,
        strict,
      })
      levels.push(generated)
      Object.entries(generated.rejectionReasons).forEach(([reason, value]) => {
        rejectionReasons[reason] = (rejectionReasons[reason] ?? 0) + value
      })
      Object.entries(generated.analysis.techniqueCounts).forEach(
        ([technique, value]) => {
          techniqueDistribution[technique] =
            (techniqueDistribution[technique] ?? 0) + value
        },
      )
    } catch (error) {
      incrementReason(rejectionReasons, error.message)
    }
  }

  return {
    levels,
    summary: {
      mode,
      requestedDifficulty: difficulty,
      attempted,
      generated: levels.length,
      rejected: Math.max(0, count - levels.length),
      rejectionReasons,
      averageClues: Number(
        average(levels.map((level) => level.clueCount)).toFixed(2),
      ),
      averageIPR: Number(
        average(
          levels.map((level) => level.analysis.immediatePlacementRate),
        ).toFixed(3),
      ),
      averageInitialPlacements: Number(
        average(
          levels.map((level) => level.analysis.initialAvailablePlacements),
        ).toFixed(2),
      ),
      averageE1Count: Number(
        average(levels.map((level) => level.analysis.e1Count)).toFixed(2),
      ),
      averageR2Placements: Number(
        average(
          levels.map((level) => level.analysis.r2PlacementCount),
        ).toFixed(2),
      ),
      averageDependencyDepth: Number(
        average(
          levels.map((level) => level.analysis.maximumDependencyDepth),
        ).toFixed(2),
      ),
      averageGenerationTime: Number(
        average(levels.map((level) => level.generationMs)).toFixed(2),
      ),
      averageAvailablePlacements: Number(
        average(
          levels.map((level) => level.analysis.averageAvailablePlacements),
        ).toFixed(2),
      ),
      averageLowChoiceRatio: Number(
        average(levels.map((level) => level.analysis.lowChoiceRatio)).toFixed(3),
      ),
      averageLongestLowChoiceRun: Number(
        average(
          levels.map((level) => level.analysis.longestLowChoiceRun),
        ).toFixed(2),
      ),
      averageNearbyRevealRate: Number(
        average(
          levels.map((level) => level.analysis.nearbyRevealRate),
        ).toFixed(3),
      ),
      averageNextMoveDistance: Number(
        average(
          levels.map((level) => level.analysis.averageNextMoveDistance),
        ).toFixed(2),
      ),
      averageTechniqueConcentration: Number(
        average(
          levels.map((level) => level.analysis.techniqueConcentration),
        ).toFixed(3),
      ),
      restoredCluesForFlow: levels.reduce(
        (sum, level) => sum + level.restoredForFlow,
        0,
      ),
      techniqueDistribution,
    },
  }
}

function main() {
  const modeName = readStringArgument('mode') ?? 'compact'
  const config = getBiomesMode(modeName)
  const settings = BIOMES_GENERATOR_SETTINGS[config.id]
  const attempts = readIntegerArgument('attempts', settings.attempts)
  const count = readIntegerArgument('count', DEFAULT_COUNT)
  const seed = readIntegerArgument('seed', DEFAULT_SEED)
  const targetClues = readIntegerArgument('clues', settings.targetClues)
  const outputPath = readStringArgument('output')
  const progressive = process.argv.includes('--progressive')
  const verifyOnly = process.argv.includes('--verify')
  const batch = process.argv.includes('--batch')
  const strict = process.argv.includes('--strict')

  if (batch) {
    const result = generatePuzzleBatch({
      mode: config.id,
      count,
      seed,
      attempts,
      targetClues,
      strict,
    })
    console.log(JSON.stringify(result.summary, null, 2))
    return
  }

  const generatedLevels = Array.from({ length: count }, (_, index) => {
    const progress = count <= 1 ? 0 : index / (count - 1)
    const clueSpread = config.boardSize === 9 ? 6 : 5
    const levelTargetClues = progressive
      ? targetClues +
        Math.round(clueSpread * 0.5 - progress * clueSpread)
      : targetClues
    const generated = generateUniqueBiomesPuzzle({
      mode: config.id,
      attempts,
      seed: seed + index * 1009,
      targetClues: levelTargetClues,
      strict,
    })
    const verification = verifyPuzzleCandidate(
      generated.puzzle,
      generated.solution,
      settings,
    )

    if (!verification.accepted) {
      throw new Error(
        `Generated Elements puzzle ${index + 1} failed verification: ${verification.reason}`,
      )
    }

    return {
      puzzle: generated.puzzle,
      solution: generated.solution,
      difficulty: summarizeAnalysis(
        generated.analysis,
        generated.clueCount,
      ),
      score: Number(generated.score.toFixed(2)),
    }
  })
  if (progressive) generatedLevels.sort(compareDifficulty)

  const idPrefix = config.boardSize === 9 ? 'biomes-9x9' : 'biomes'
  const levels = generatedLevels.map((level, index) => ({
    id: `${idPrefix}-${String(index + 1).padStart(2, '0')}`,
    name: `Level ${index + 1}`,
    ...level,
  }))

  if (verifyOnly) {
    const e1Total = levels.reduce(
      (sum, level) => sum + level.difficulty.e1Count,
      0,
    )
    console.log(
      `✓ Generated ${levels.length} ${config.boardSize}x${config.boardSize} Elements puzzle(s), unique and logical, with ${e1Total} E1 placement(s)`,
    )
    return
  }

  if (outputPath) {
    const exportName =
      config.boardSize === 9 ? 'BIOMES_9X9_PUZZLES' : 'BIOMES_PUZZLES'
    writeFileSync(
      outputPath,
      `export const ${exportName} = ${JSON.stringify(levels, null, 2)}\n`,
    )
    console.log(`✓ Wrote ${levels.length} Elements puzzle(s) to ${outputPath}`)
    return
  }

  console.log(JSON.stringify(levels, null, 2))
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
}
