// Checks every shipped daily garden (or the first --days): it unpacks, a player can solve it by
// always taking the easiest move, its answer is a balanced garden that keeps every clue, and it
// is the difficulty it says it is.
//
//   node scripts/verify-days.mjs [--days=30]
import { parseArgs } from './garden-kit.mjs'
import { checkDay } from '../src/dayCheck.js'
import { LAST_DAY, TIERS } from '../src/daily.js'

const args = parseArgs()
const days = Math.min(LAST_DAY, Number(args.days ?? LAST_DAY))
let problems = 0
for (let day = 1; day <= days; day++) {
  for (const tier of TIERS) {
    for (const problem of checkDay(day, tier)) {
      problems++
      console.error(`Day ${day} ${tier}: ${problem}`)
    }
  }
}
if (problems) {
  console.error(`${problems} problems`)
  process.exit(1)
}
console.log(`All ${days * TIERS.length} gardens of ${days} days check out.`)
