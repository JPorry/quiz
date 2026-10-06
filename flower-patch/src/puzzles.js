import { FIRST_DAY, DAYS } from './days.js'
import { language } from './i18n.js'

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
// Each language has its own words, in the same order, so a garden's name is the
// same idea in every language.
const NAMES = {
  en: {
    first: {
      easy: ['Seedling', 'Buttercup', 'Snail', 'Dewdrop', 'Robin', 'Pebble', 'Clover', 'Bumblebee', 'Ladybird', 'Puddle', 'Sprout', 'Daisy', 'Teacup', 'Mossy', 'Acorn', 'Thimble', 'Bluebell', 'Honeybee', 'Sparrow', 'Primrose', 'Dandelion', 'Pipsqueak', 'Wren', 'Sunny'],
      medium: ['Cottage', 'Hollyhock', 'Potting', 'Birdbath', 'Wicker', 'Herb', 'Rain Barrel', 'Orchard', 'Kitchen', 'Sundial', 'Beehive', 'Trellis', 'Lily', 'Willow', 'Hedgerow', 'Lantern', 'Meadow', 'Foxglove', 'Lavender', 'Bramble', 'Sweet Pea', 'Larkspur', 'Bakery', 'Weathervane'],
      hard: ['Botanical', 'Walled', 'Glasshouse', 'Knot', 'Topiary', 'Rose', 'Moonlight', 'Grand', 'Fountain', 'Secret', 'Wisteria', 'Orangery', 'Labyrinth', 'Peacock', 'Starlit', 'Royal', 'Tapestry', 'Mosaic', 'Kaleidoscope', 'Crystal', 'Marble', 'Golden', 'Silver', 'Emerald'],
    },
    second: {
      easy: ['Row', 'Patch', 'Plot', 'Corner', 'Nook', 'Bed', 'Sill', 'Lane', 'Path', 'Step', 'Box', 'Pot', 'Tub', 'Bench', 'Gate', 'Hollow'],
      medium: ['Border', 'Walk', 'Shed', 'Bower', 'Arch', 'Spiral', 'Edge', 'Garden', 'Lawn', 'Bank', 'Pond', 'Allotment', 'Meadow', 'Green', 'Yard', 'Close'],
      hard: ['Court', 'Garden', 'Dome', 'Terrace', 'Pavilion', 'Parterre', 'Square', 'Cloister', 'Promenade', 'Arbor', 'Conservatory', 'Gardens', 'Maze', 'Estate', 'Grounds', 'Park'],
    },
    // "Seedling Row"
    join: (first, second) => `${first} ${second}`,
  },
  es: {
    first: {
      easy: ['del Brote', 'del Botón de Oro', 'del Caracol', 'del Rocío', 'del Petirrojo', 'del Guijarro', 'del Trébol', 'del Abejorro', 'de la Mariquita', 'del Charco', 'del Retoño', 'de la Margarita', 'de la Taza de Té', 'del Musgo', 'de la Bellota', 'del Dedal', 'de la Campanilla', 'de la Abeja', 'del Gorrión', 'de la Prímula', 'del Diente de León', 'del Ratoncito', 'del Chochín', 'del Sol'],
      medium: ['de la Casita', 'de la Malva Real', 'del Semillero', 'del Bebedero', 'del Mimbre', 'de las Hierbas', 'del Aljibe', 'del Huerto', 'de la Cocina', 'del Reloj de Sol', 'de la Colmena', 'de la Celosía', 'del Lirio', 'del Sauce', 'del Seto', 'del Farolillo', 'de la Pradera', 'de la Dedalera', 'de la Lavanda', 'de la Zarza', 'del Guisante de Olor', 'de la Espuela de Caballero', 'de la Panadería', 'de la Veleta'],
      hard: ['Botánico', 'de los Muros', 'del Invernadero', 'de los Nudos', 'de los Setos Tallados', 'de las Rosas', 'de la Luna', 'Mayor', 'de la Fuente', 'del Secreto', 'de las Glicinias', 'del Naranjal', 'de los Senderos', 'del Pavo Real', 'de las Estrellas', 'Real', 'del Tapiz', 'del Mosaico', 'del Caleidoscopio', 'de Cristal', 'de Mármol', 'de Oro', 'de Plata', 'de Esmeralda'],
    },
    second: {
      easy: ['Hilera', 'Huertito', 'Parcela', 'Rincón', 'Recoveco', 'Bancal', 'Alféizar', 'Senda', 'Sendero', 'Escalón', 'Jardinera', 'Maceta', 'Tina', 'Banco', 'Portillo', 'Hondonada'],
      medium: ['Arriate', 'Paseo', 'Cobertizo', 'Glorieta', 'Arco', 'Espiral', 'Orilla', 'Jardín', 'Césped', 'Ribazo', 'Estanque', 'Huerta', 'Prado', 'Explanada', 'Patio', 'Callejón'],
      hard: ['Patio', 'Jardín', 'Cenador', 'Mirador', 'Pabellón', 'Parterre', 'Claustro', 'Laberinto', 'Paseo', 'Huerto', 'Templete', 'Vergel', 'Recinto', 'Rosal', 'Bosque', 'Parque'],
    },
    // "Hilera del Brote"; the hard gardens' words are all masculine, so «Botánico» fits
    join: (first, second) => `${second} ${first}`,
  },
}

function nameOf(day, tier) {
  const words = NAMES[language()] ?? NAMES.en
  let h = (day * 2654435761 + TIERS.indexOf(tier) * 40503) >>> 0
  const first = words.first[tier][h % words.first[tier].length]
  h = Math.floor(h / words.first[tier].length)
  return words.join(first, words.second[tier][(h + day) % words.second[tier].length])
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
