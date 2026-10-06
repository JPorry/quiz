import { FIRST_DAY, DAYS } from './days.js'

// Every day has three gardens: easy, medium and hard. Day 1 is FIRST_DAY, and
// "today" is worked out from the player's own calendar, so a new day's gardens
// appear at their local midnight.

export const TIERS = ['easy', 'medium', 'hard']
export const LAST_DAY = DAYS.length

const DAY = 86400000
const utc = (date) => Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
const [fy, fm, fd] = FIRST_DAY.split('-').map(Number)
const FIRST = Date.UTC(fy, fm - 1, fd)

// the day number of a calendar date, counting FIRST_DAY as day 1
export const dayOf = (date = new Date()) => Math.round((utc(date) - FIRST) / DAY) + 1
// today's day number, never past the last day there are gardens for
export const today = (date = new Date()) => Math.max(1, Math.min(LAST_DAY, dayOf(date)))
export const dateOf = (day) => new Date(FIRST + (day - 1) * DAY)

// Names grow from little cottage plots to grand gardens with the difficulty.
const FIRST_WORDS = {
  easy: ['Seedling', 'Buttercup', 'Snail', 'Dewdrop', 'Robin', 'Pebble', 'Clover', 'Bumblebee', 'Ladybird', 'Puddle', 'Sprout', 'Daisy', 'Teacup', 'Mossy', 'Acorn', 'Thimble', 'Bluebell', 'Honeybee', 'Sparrow', 'Primrose', 'Dandelion', 'Pipsqueak', 'Wren', 'Sunny'],
  medium: ['Cottage', 'Hollyhock', 'Potting', 'Birdbath', 'Wicker', 'Herb', 'Rain Barrel', 'Orchard', 'Kitchen', 'Sundial', 'Beehive', 'Trellis', 'Lily', 'Willow', 'Hedgerow', 'Lantern', 'Meadow', 'Foxglove', 'Lavender', 'Bramble', 'Sweet Pea', 'Larkspur', 'Bakery', 'Weathervane'],
  hard: ['Botanical', 'Walled', 'Glasshouse', 'Knot', 'Topiary', 'Rose', 'Moonlight', 'Grand', 'Fountain', 'Secret', 'Wisteria', 'Orangery', 'Labyrinth', 'Peacock', 'Starlit', 'Royal', 'Tapestry', 'Mosaic', 'Kaleidoscope', 'Crystal', 'Marble', 'Golden', 'Silver', 'Emerald'],
}
const SECOND_WORDS = {
  easy: ['Row', 'Patch', 'Plot', 'Corner', 'Nook', 'Bed', 'Sill', 'Lane', 'Path', 'Step', 'Box', 'Pot', 'Tub', 'Bench', 'Gate', 'Hollow'],
  medium: ['Border', 'Walk', 'Shed', 'Bower', 'Arch', 'Spiral', 'Edge', 'Garden', 'Lawn', 'Bank', 'Pond', 'Allotment', 'Meadow', 'Green', 'Yard', 'Close'],
  hard: ['Court', 'Garden', 'Dome', 'Terrace', 'Pavilion', 'Parterre', 'Square', 'Cloister', 'Promenade', 'Arbor', 'Conservatory', 'Gardens', 'Maze', 'Estate', 'Grounds', 'Park'],
}

function nameOf(day, tier) {
  let h = (day * 2654435761 + TIERS.indexOf(tier) * 40503) >>> 0
  const first = FIRST_WORDS[tier][h % FIRST_WORDS[tier].length]
  h = Math.floor(h / FIRST_WORDS[tier].length)
  return `${first} ${SECOND_WORDS[tier][(h + day) % SECOND_WORDS[tier].length]}`
}

const rows = (text, width) => text.match(new RegExp(`.{${width}}`, 'g'))

// A garden in the shape the board and the scene use.
export function puzzle(day, tier) {
  const [size, beds, givens, solution] = DAYS[day - 1][TIERS.indexOf(tier)].split(':')
  const width = Number(size[0]), height = Number(size[1])
  return {
    id: `${day}-${tier}`, day, tier, name: nameOf(day, tier), width, height,
    beds: rows(beds, width), givens: rows(givens, width), solution: rows(solution, width),
  }
}

// The tutorial's own little garden, made for it alone by
// `node scripts/generate-levels.mjs --tutorial`: 5×5, easy, and shaped so the
// coach finds every lesson in order, starting with a bed of three with one plot
// left. It is unlike any daily garden.
export const TUTORIAL = {
  id: 'tutorial', day: 0, tier: 'easy', name: 'First Seeds', width: 5, height: 5,
  beds: ['AABBC', 'AABBC', 'AADBC', 'EEDDF', 'EEDDF'],
  givens: ['.41..', '16.51', '2....', '..1..', '....1'],
  solution: ['34132', '16251', '25343', '14152', '23241'],
}
