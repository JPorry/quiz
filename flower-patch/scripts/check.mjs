// Checks one level against everything Flower Patch promises about it. Shared by
// `npm run verify:levels` and the tests.
import { buildBoard, conflicts, countSolutions, playerSolve, MAX_SEED } from '../src/logic.js'

// What each pool lets a player need, and the easier set it must go beyond.
export const POOL_RULES = {
  easy: { allow: ['single', 'hidden'], beyond: null },
  medium: { allow: ['single', 'hidden', 'reach', 'subset'], beyond: ['single', 'hidden'] },
  hard: { allow: ['single', 'hidden', 'reach', 'subset', 'trial'], beyond: ['single', 'hidden', 'reach', 'subset'] },
}

export function checkLevel(level, pool) {
  const problems = []
  const { width, height } = level
  for (const key of ['beds', 'givens', 'solution']) {
    if (level[key].length !== height || level[key].some((row) => row.length !== width)) problems.push(`${key} is not ${width} by ${height}`)
  }
  if (problems.length) return problems
  const board = buildBoard(level)
  board.beds.forEach((bed, b) => {
    if (bed.length > MAX_SEED) problems.push(`bed ${b} has ${bed.length} cells`)
    // a bed is one piece, joined edge to edge
    const seen = new Set([bed[0]])
    const queue = [bed[0]]
    while (queue.length) {
      const i = queue.pop()
      for (const j of [i - width, i + width, i % width ? i - 1 : -1, (i + 1) % width ? i + 1 : -1]) {
        if (j >= 0 && j < board.cells && board.bedOf[j] === b && !seen.has(j)) { seen.add(j); queue.push(j) }
      }
    }
    if (seen.size !== bed.length) problems.push(`bed ${b} is in pieces`)
  })
  const solution = board.solution
  if (solution.some((v) => !v) || conflicts(board, solution).size) problems.push('the solution breaks a rule')
  if (board.givens.some((v, i) => v && v !== solution[i])) problems.push('a given seed differs from the solution')
  if (countSolutions(board) !== 1) problems.push('the level does not have exactly one solution')
  const rules = POOL_RULES[pool]
  if (rules) {
    const result = playerSolve(board, board.givens, rules.allow)
    if (!result.solved) problems.push(`a player can't solve it with ${rules.allow.join(', ')}`)
    else if (result.values.some((v, i) => v !== solution[i])) problems.push('the player solve differs from the solution')
    if (rules.beyond && playerSolve(board, board.givens, rules.beyond).solved) problems.push(`it is too easy for ${pool}`)
  }
  return problems
}
