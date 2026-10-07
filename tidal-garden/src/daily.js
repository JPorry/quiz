// Tidal Garden's daily gardens. Every day brings three: easy, medium and hard. Day 1 is FIRST_DAY,
// and "today" is worked out from the player's own calendar, so a new day's gardens appear at their
// local midnight. Each garden is packed small in src/days.js; this unpacks it into the shape the
// game and the scene use, and works out its answer the way a player would.
import { FIRST_DAY, DAYS } from './days.js'
import { solveLikeAPlayer } from './solver.js'
import { FERRY_COLORS } from './ferries.js'
import { PILGRIM_COLORS } from './pilgrims.js'
import { language } from './i18n.js'
import { GARDEN_WORDS } from './gardenNames.js'

export const TIERS = ['easy', 'medium', 'hard']
export const LAST_DAY = DAYS.length
const SIZE = 10

const DAY = 86400000
const utc = (date) => Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
const [fy, fm, fd] = FIRST_DAY.split('-').map(Number)
const FIRST = Date.UTC(fy, fm - 1, fd)

// The day number of a calendar date, counting FIRST_DAY as day 1.
export const dayOf = (date = new Date()) => Math.round((utc(date) - FIRST) / DAY) + 1
// Today's day number, never before the first day or past the last one there are gardens for.
export const today = (date = new Date()) => Math.max(1, Math.min(LAST_DAY, dayOf(date)))
export const dateOf = (day) => new Date(FIRST + (day - 1) * DAY)

const cells = (text) => (text ? text.split(' ').map((group) => [...group].map(Number)) : [])

// A garden's name grows from a quiet cove to a far-flung archipelago with its difficulty. The word
// lists come in every language in the same order, so a garden has the same name in each.
export function gardenName(day, tier, code = language()) {
  const words = GARDEN_WORDS[code] ?? GARDEN_WORDS.en
  const { first, second, join } = words[tier]
  let h = (day * 2654435761 + TIERS.indexOf(tier) * 40503) >>> 0
  const a = h % first.length
  h = Math.floor(h / first.length)
  const b = (h + day) % second.length
  return join(first[a], second[b])
}

const solved = new Map()

// A day's garden, in the shape the game uses: its starting tiles, its answer, its clues, and the
// kinds of clue it carries.
export function puzzle(day, tier) {
  const packed = DAYS[day - 1][TIERS.indexOf(tier)]
  const grid = []
  for (let row = 0; row < SIZE; row++) grid.push([...packed.t.slice(row * SIZE, row * SIZE + SIZE)].map((ch) => (ch === '.' ? null : Number(ch))))
  const signs = cells(packed.v).map(([r, c, size]) => ({ cell: [r, c], size }))
  const lights = cells(packed.l).map(([r, c, sees]) => ({ cell: [r, c], sees }))
  const ferries = cells(packed.f).map(([r1, c1, r2, c2], i) => ({ color: FERRY_COLORS[i], docks: [[r1, c1], [r2, c2]] }))
  const pilgrims = cells(packed.p).map(([r1, c1, r2, c2], i) => ({ color: PILGRIM_COLORS[i], shrines: [[r1, c1], [r2, c2]] }))
  const id = `${day}-${tier}`
  if (!solved.has(id)) solved.set(id, solveLikeAPlayer(grid, undefined, { signs, lights, ferries, pilgrims }).grid)
  const kinds = [signs.length && 'villages', lights.length && 'lighthouses', ferries.length && 'ferries', pilgrims.length && 'pilgrims'].filter(Boolean)
  return { id, day, tier, get name() { return gardenName(day, tier) }, puzzle: grid, solution: solved.get(id).map((row) => [...row]), signs, lights, ferries, pilgrims, kinds }
}
