// Checks every shipped level: shapes, rules, one solution, and that its pool fits.
import { POOLS } from '../src/levels.js'
import { checkLevel } from './check.mjs'

let bad = 0, total = 0
for (const [pool, levels] of Object.entries(POOLS)) {
  for (const level of levels) {
    total++
    const problems = checkLevel(level, pool)
    if (problems.length) { bad++; console.error(`${level.id}: ${problems.join('; ')}`) }
  }
}
if (bad) { console.error(`${bad} of ${total} levels have problems`); process.exit(1) }
console.log(`All ${total} levels check out.`)
