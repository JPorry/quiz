// Checks every shipped daily garden: shapes, rules, one solution, and that its
// difficulty fits. `--days=N` checks only the first N days.
import { DAYS } from '../src/days.js'
import { TIERS, puzzle } from '../src/puzzles.js'
import { checkLevel } from './check.mjs'

const limit = Number(process.argv.find((a) => a.startsWith('--days='))?.slice(7)) || DAYS.length
let bad = 0, total = 0
for (let day = 1; day <= limit; day++) {
  for (const tier of TIERS) {
    total++
    const level = puzzle(day, tier)
    const problems = checkLevel(level, tier)
    if (problems.length) { bad++; console.error(`${level.id}: ${problems.join('; ')}`) }
  }
}
if (bad) { console.error(`${bad} of ${total} gardens have problems`); process.exit(1) }
console.log(`All ${total} gardens check out.`)
