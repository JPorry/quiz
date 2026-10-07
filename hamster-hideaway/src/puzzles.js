import { FIRST_DAY, DAYS } from './days.js'

// Every day has three habitats: easy, medium and hard. Day 1 is FIRST_DAY, and
// "today" is worked out from the player's own calendar, so a new day's puzzles
// appear at their local midnight.

export const TIERS = ['easy', 'medium', 'hard']
export const TIER_NAMES = { easy: 'Easy', medium: 'Medium', hard: 'Hard' }
export const LAST_DAY = DAYS.length

const DAY = 86400000
const utc = (date) => Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
const [fy, fm, fd] = FIRST_DAY.split('-').map(Number)
const FIRST = Date.UTC(fy, fm - 1, fd)

// the day number of a calendar date, counting FIRST_DAY as day 1
export const dayOf = (date = new Date()) => Math.round((utc(date) - FIRST) / DAY) + 1
// today's day number, never past the last day there are puzzles for
export const today = (date = new Date()) => Math.max(1, Math.min(LAST_DAY, dayOf(date)))
export const dateOf = (day) => new Date(FIRST + (day - 1) * DAY)

export function dayLabel(day, now = today()) {
  if (day === now) return 'Today'
  if (day === now - 1) return 'Yesterday'
  return dateOf(day).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })
}

// Habitat names grow from a cosy corner to a grand burrow with the difficulty.
const FIRST_WORDS = {
  easy: ['Acorn', 'Clover', 'Buttercup', 'Peanut', 'Biscuit', 'Daisy', 'Honey', 'Pebble', 'Button', 'Muffin', 'Sunny', 'Toffee', 'Oat', 'Cosy', 'Snug', 'Whisker', 'Bramble', 'Hazel', 'Puffball', 'Crumb', 'Fluff', 'Tiny', 'Sesame', 'Marigold'],
  medium: ['Sunflower', 'Hazelnut', 'Cinnamon', 'Maple', 'Thistle', 'Pumpkin', 'Chestnut', 'Bluebell', 'Meadow', 'Hayloft', 'Cobble', 'Willow', 'Barley', 'Juniper', 'Nutmeg', 'Saffron', 'Hollyhock', 'Primrose', 'Gingersnap', 'Raspberry', 'Walnut', 'Poppy', 'Fennel', 'Mallow'],
  hard: ['Grand', 'Royal', 'Great', 'Twisty', 'Rambling', 'Old Oak', 'Burrowdeep', 'Labyrinth', 'Lofty', 'Tumbleweed', 'Moonlit', 'Starlit', 'Snowdrop', 'Thunder', 'Whirligig', 'Clockwork', 'Velvet', 'Marble', 'Copper', 'Emerald', 'Silver', 'Golden', 'Hidden', 'Wandering'],
}
const SECOND_WORDS = {
  easy: ['Nook', 'Corner', 'Den', 'Nest', 'Hutch', 'Cubby', 'Hollow', 'Pouch', 'Patch', 'Tuck', 'Cosy', 'Snuggery', 'Pocket', 'Basket', 'Box', 'Crate'],
  medium: ['Burrow', 'Lodge', 'Cottage', 'Loft', 'Warren', 'Hideout', 'Retreat', 'Lane', 'Rows', 'Court', 'Gardens', 'Terrace', 'Hall', 'Hamlet', 'Mews', 'Crescent'],
  hard: ['Warren', 'Manor', 'Maze', 'Tunnels', 'Castle', 'Labyrinth', 'Underworks', 'Estate', 'Palace', 'Citadel', 'Hideaway', 'Mansion', 'Catacombs', 'Network', 'Fortress', 'Village'],
}

function nameOf(day, tier) {
  let h = (day * 2654435761 + TIERS.indexOf(tier) * 40503) >>> 0
  const first = FIRST_WORDS[tier][h % FIRST_WORDS[tier].length]
  h = Math.floor(h / FIRST_WORDS[tier].length)
  let second = SECOND_WORDS[tier][(h + day) % SECOND_WORDS[tier].length]
  if (second === first) second = SECOND_WORDS[tier][(h + day + 1) % SECOND_WORDS[tier].length]
  return `${first} ${second}`
}

// Every hamster has a name, so the game can talk about them.
export const HAMSTER_NAMES = ['Pip', 'Nibbles', 'Mochi', 'Peanut', 'Biscuit', 'Hazel', 'Clover', 'Bean', 'Poppy', 'Muffin', 'Sesame', 'Toffee', 'Bramble', 'Dot', 'Waffles', 'Pudding', 'Maple', 'Crumpet', 'Button', 'Fudge', 'Juniper', 'Tater', 'Noodle', 'Pickle', 'Cinnamon', 'Nutmeg', 'Pebble', 'Squeak', 'Honey', 'Dumpling', 'Sprout', 'Truffle']

// A level in the shape the board and the scene use: rooms as [row, column,
// number], and a name for each room's hamster.
export function puzzle(day, tier) {
  const packed = DAYS[day - 1][TIERS.indexOf(tier)]
  const [size, list] = packed.split(':')
  const rooms = []
  for (let i = 0; i < list.length; i += 3) rooms.push(list.slice(i, i + 3).split('').map(Number))
  const start = (day * 7 + TIERS.indexOf(tier) * 11) % HAMSTER_NAMES.length
  const names = rooms.map((_, k) => HAMSTER_NAMES[(start + k * 5) % HAMSTER_NAMES.length])
  return { id: `${day}-${tier}`, day, tier, name: nameOf(day, tier), width: Number(size[0]), height: Number(size[1]), rooms, names }
}

// The guided first habitat: small, with every rule showing up early.
export const TUTORIAL = {
  id: 'tutorial', day: 0, tier: 'easy', name: 'Welcome Nook', width: 4, height: 4,
  rooms: [[0, 0, 2], [1, 3, 2], [3, 0, 2], [3, 3, 1]],
  names: ['Pip', 'Mochi', 'Hazel', 'Bean'],
}
