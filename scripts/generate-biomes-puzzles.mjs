import { writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import {
  analyzeBiomesPuzzle,
  canAppendBiomesRow,
  countBiomesSolutions,
  getValidBiomesLines,
  isValidBiomesSolution,
  scoreBiomesAnalysis,
} from '../src/biomesLogic.js'

const DEFAULT_ATTEMPTS = 16
const DEFAULT_COUNT = 1
const DEFAULT_SEED = 20260725
const DEFAULT_TARGET_CLUES = 15
const SIZE = 6

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

export function generateBiomesSolution(random = Math.random) {
  const validLines = getValidBiomesLines(SIZE)

  function search(rows) {
    if (rows.length === SIZE) {
      return isValidBiomesSolution(rows) ? rows.map((row) => [...row]) : null
    }

    for (const candidate of shuffle(validLines, random)) {
      if (!canAppendBiomesRow(rows, candidate, SIZE)) continue

      const solution = search([...rows, candidate])
      if (solution) return solution
    }

    return null
  }

  const solution = search([])
  if (!solution) throw new Error('Could not generate a valid Biomes solution')
  return solution
}

export function carveBiomesPuzzle(
  solution,
  { random = Math.random, targetClues = DEFAULT_TARGET_CLUES } = {},
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
  let clueCount = totalCells

  for (const position of positions) {
    if (clueCount <= targetClues) break

    const row = Math.floor(position / solution.length)
    const column = position % solution.length
    const clue = puzzle[row][column]
    puzzle[row][column] = null

    const isUnique = countBiomesSolutions(puzzle, 2) === 1
    const analysis = isUnique ? analyzeBiomesPuzzle(puzzle) : null

    if (!isUnique || !analysis.solved) {
      puzzle[row][column] = clue
    } else {
      clueCount -= 1
    }
  }

  const analysis = analyzeBiomesPuzzle(puzzle)
  if (countBiomesSolutions(puzzle, 2) !== 1 || !analysis.solved) {
    throw new Error('Generated Biomes puzzle is not uniquely and logically solvable')
  }

  return { puzzle, analysis, clueCount }
}

function getCandidateQuality(candidate, targetClues) {
  const e1Count = candidate.analysis.techniqueCounts.E1 ?? 0
  const cluePenalty = Math.max(0, candidate.clueCount - targetClues)

  return (
    scoreBiomesAnalysis(candidate.analysis) +
    Math.min(e1Count, 5) * 3 -
    cluePenalty * 1.5
  )
}

export function generateUniqueBiomesPuzzle({
  attempts = DEFAULT_ATTEMPTS,
  seed = DEFAULT_SEED,
  targetClues = DEFAULT_TARGET_CLUES,
} = {}) {
  if (!Number.isInteger(attempts) || attempts < 1) {
    throw new Error(`attempts must be a positive integer, received ${attempts}`)
  }

  let bestCandidate = null

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const random = createSeededRandom(seed + attempt * 104729)
    const solution = generateBiomesSolution(random)
    const carved = carveBiomesPuzzle(solution, { random, targetClues })
    const candidate = {
      ...carved,
      solution,
      score: getCandidateQuality(carved, targetClues),
    }

    if (!bestCandidate || candidate.score > bestCandidate.score) {
      bestCandidate = candidate
    }
  }

  return bestCandidate
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
    clueCount,
    logicalSteps: analysis.steps.length,
    techniqueCounts: analysis.techniqueCounts,
    techniqueDiversity: analysis.techniqueDiversity,
    pureBalanceRatio: Number(analysis.pureBalanceRatio.toFixed(3)),
    averageAvailablePlacements: Number(
      analysis.averageAvailablePlacements.toFixed(2),
    ),
    dependencyRatio: Number(analysis.dependencyRatio.toFixed(3)),
    longestSinglePath: analysis.longestSinglePath,
  }
}

function compareDifficulty(left, right) {
  return (
    left.difficulty.logicalSteps - right.difficulty.logicalSteps ||
    left.difficulty.longestSinglePath -
      right.difficulty.longestSinglePath ||
    left.difficulty.dependencyRatio - right.difficulty.dependencyRatio ||
    right.difficulty.averageAvailablePlacements -
      left.difficulty.averageAvailablePlacements
  )
}

function main() {
  const attempts = readIntegerArgument('attempts', DEFAULT_ATTEMPTS)
  const count = readIntegerArgument('count', DEFAULT_COUNT)
  const seed = readIntegerArgument('seed', DEFAULT_SEED)
  const targetClues = readIntegerArgument('clues', DEFAULT_TARGET_CLUES)
  const outputPath = readStringArgument('output')
  const progressive = process.argv.includes('--progressive')
  const verifyOnly = process.argv.includes('--verify')

  const generatedLevels = Array.from({ length: count }, (_, index) => {
    const progress = count <= 1 ? 0 : index / (count - 1)
    const levelTargetClues = progressive
      ? targetClues + Math.round(3 - progress * 5)
      : targetClues
    const generated = generateUniqueBiomesPuzzle({
      attempts,
      seed: seed + index * 1009,
      targetClues: levelTargetClues,
    })
    const solutionCount = countBiomesSolutions(generated.puzzle, 2)

    if (solutionCount !== 1 || !generated.analysis.solved) {
      throw new Error(
        `Generated Biomes puzzle ${index + 1} failed verification`,
      )
    }

    return {
      puzzle: generated.puzzle,
      solution: generated.solution,
      difficulty: summarizeAnalysis(generated.analysis, generated.clueCount),
      score: Number(generated.score.toFixed(2)),
    }
  })
  if (progressive) generatedLevels.sort(compareDifficulty)

  const levels = generatedLevels.map((level, index) => ({
    id: `biomes-${String(index + 1).padStart(2, '0')}`,
    name: `Level ${index + 1}`,
    ...level,
  }))

  if (verifyOnly) {
    const e1Total = levels.reduce(
      (sum, level) => sum + (level.difficulty.techniqueCounts.E1 ?? 0),
      0,
    )
    console.log(
      `✓ Generated ${levels.length} Biomes puzzle(s), unique and logical, with ${e1Total} E1 placement(s)`,
    )
    return
  }

  if (outputPath) {
    writeFileSync(
      outputPath,
      `export const BIOMES_PUZZLES = ${JSON.stringify(levels, null, 2)}\n`,
    )
    console.log(`✓ Wrote ${levels.length} Biomes puzzle(s) to ${outputPath}`)
    return
  }

  console.log(JSON.stringify(levels, null, 2))
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
}
