// Checks every shipped habitat: exactly one solution, and solvable by a player
// without blind guessing.
//   node scripts/verify-levels.mjs
import { buildBoard, solve, playerSolve } from '../src/logic.js'
import { DAYS } from '../src/days.js'
import { TIERS, puzzle } from '../src/puzzles.js'

let bad = 0
for (let day = 1; day <= DAYS.length; day++) {
  for (const tier of TIERS) {
    const board = buildBoard(puzzle(day, tier))
    const found = solve(board, { limit: 2 }).length
    const player = playerSolve(board, { maxTrials: 30 })
    if (found !== 1 || !player.solved) { bad++; console.error(`day ${day} ${tier}: ${found} solutions, player ${player.solved ? 'solves it' : 'is stuck'}`) }
  }
}
console.log(`${DAYS.length * TIERS.length} habitats checked, ${bad} with problems`)
process.exit(bad ? 1 : 0)
