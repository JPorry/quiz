import { FIRST_DAY, DAYS } from './days.js'

// Every day has three puzzles: easy, medium and hard. Day 1 is FIRST_DAY, and
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

// Names grow from seaside villages to skylines with the difficulty.
const FIRST_WORDS = {
  easy: ['Pebble', 'Seashell', 'Driftwood', 'Sandy', 'Tidepool', 'Starfish', 'Gull', 'Coral', 'Kelp', 'Sunny', 'Breezy', 'Puffin', 'Clam', 'Seaglass', 'Minnow', 'Sailcloth', 'Buoy', 'Saltwater', 'Pelican', 'Shrimp', 'Otter', 'Daisy', 'Conch', 'Bubble'],
  medium: ['Lagoon', 'Harbor', 'Fisher’s', 'Mariner’s', 'Compass', 'Anchor', 'Ferry', 'Bellbuoy', 'Market', 'Marina', 'Clocktower', 'Canal', 'Seawall', 'Lighthouse', 'Palm', 'Old', 'Boardwalk', 'Riviera', 'Tidegate', 'Halfmoon', 'Lantern', 'Regatta', 'Copper', 'Willow'],
  hard: ['Skyline', 'Glasswater', 'Tower', 'Monorail', 'Neon', 'Aurora', 'Silver', 'Highrise', 'Crystal', 'Starlight', 'Metro', 'Pearl', 'Horizon', 'Orbit', 'Zenith', 'Prism', 'Cloudpiercer', 'Golden', 'Opal', 'Sapphire', 'Chrome', 'Nova', 'Quartz', 'Solar'],
}
const SECOND_WORDS = {
  easy: ['Bay', 'Cove', 'Key', 'Hollow', 'Point', 'Shoals', 'Rock', 'Nook', 'Sands', 'Banks', 'Perch', 'Cay', 'Shore', 'Isle', 'Inlet', 'Dunes'],
  medium: ['Loop', 'Lights', 'Wharf', 'Rest', 'Rose', 'Heights', 'Crossing', 'Quay', 'Gardens', 'Quarter', 'Square', 'Row', 'Promenade', 'Port', 'Harbor', 'Town'],
  hard: ['Shoals', 'City', 'Atoll', 'Keys', 'Waterfront', 'Archipelago', 'Spires', 'Harbor', 'Lagoon', 'Strait', 'Marina', 'Skyline', 'Heights', 'Isles', 'Port', 'Metropolis'],
}

function nameOf(day, tier) {
  let h = (day * 2654435761 + TIERS.indexOf(tier) * 40503) >>> 0
  const first = FIRST_WORDS[tier][h % FIRST_WORDS[tier].length]
  h = Math.floor(h / FIRST_WORDS[tier].length)
  return `${first} ${SECOND_WORDS[tier][(h + day) % SECOND_WORDS[tier].length]}`
}

// A level in the shape the board and the scene use: islands as
// [row, column, number, fog].
export function puzzle(day, tier) {
  const packed = DAYS[day - 1][TIERS.indexOf(tier)]
  const [size, isles] = packed.split(':')
  const burrows = []
  for (let i = 0; i < isles.length; i += 4) {
    const [r, c, v, f] = isles.slice(i, i + 4).split('').map(Number)
    burrows.push(f ? [r, c, v, 1] : [r, c, v])
  }
  return { id: `${day}-${tier}`, day, tier, name: nameOf(day, tier), width: Number(size[0]), height: Number(size[1]), burrows, fog: burrows.some((b) => b[3]) }
}
