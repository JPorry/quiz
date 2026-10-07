// Words for naming the daily gardens, per language and difficulty. Each list holds the same ideas in
// the same order in every language, so a garden's name means the same in each: "Pebble Cove" is
// "Cala de Guijarros". English puts the first word before the place; Spanish puts the place first.
// Easy gardens are quiet coves and pools, medium ones harbors and villages, hard ones far reefs
// and archipelagos.
export const GARDEN_WORDS = {
  en: {
    easy: {
      first: ['Pebble', 'Shell', 'Seagrass', 'Clover', 'Pearl', 'Minnow', 'Daisy', 'Starfish', 'Lily', 'Puffin', 'Moss', 'Dewdrop', 'Sandpiper', 'Honeybee', 'Buttercup', 'Driftwood', 'Snail', 'Fern', 'Tadpole', 'Firefly'],
      second: ['Nook', 'Cove', 'Pool', 'Bay', 'Shore', 'Garden', 'Isle', 'Spring', 'Meadow', 'Beach', 'Corner', 'Lagoon'],
      join: (a, b) => `${a} ${b}`,
    },
    medium: {
      first: ['Lantern', 'Gull', 'Reed', 'Willow', 'Heron', 'Bell', 'Sail', 'Rope', 'Oar', 'Kite', 'Otter', 'Tide', 'Salt', 'Cockle', 'Lighthouse', 'Ferry', 'Pilgrim', 'Netmaker', 'Orchard', 'Beehive'],
      second: ['Harbor', 'Village', 'Landing', 'Crossing', 'Point', 'Marsh', 'Inlet', 'Quay', 'Haven', 'Lane', 'Terrace', 'Isles'],
      join: (a, b) => `${a} ${b}`,
    },
    hard: {
      first: ['Storm', 'Star', 'Whale', 'Thunder', 'Coral', 'Beacon', 'Shipwreck', 'Current', 'Moon', 'Albatross', 'Voyager', 'Compass', 'Mariner', 'Kraken', 'Tempest', 'Sapphire', 'Comet', 'Monsoon', 'Lantern Fleet', 'Dragon Kite'],
      second: ['Archipelago', 'Reef', 'Strait', 'Atoll', 'Maze', 'Cape', 'Channels', 'Gulf', 'Sea', 'Fjord', 'Shoals', 'Expanse'],
      join: (a, b) => `${a} ${b}`,
    },
  },
  es: {
    easy: {
      first: ['Guijarros', 'Conchas', 'Algas', 'Tréboles', 'Perlas', 'Pececillos', 'Margaritas', 'Estrellas de Mar', 'Nenúfares', 'Frailecillos', 'Musgo', 'Rocío', 'Correlimos', 'Abejas', 'Botones de Oro', 'Madera a la Deriva', 'Caracoles', 'Helechos', 'Renacuajos', 'Luciérnagas'],
      second: ['Rincón', 'Cala', 'Poza', 'Bahía', 'Orilla', 'Jardín', 'Isla', 'Fuente', 'Prado', 'Playa', 'Esquina', 'Laguna'],
      join: (a, b) => `${b} de ${a}`,
    },
    medium: {
      first: ['Farolillos', 'Gaviotas', 'Juncos', 'Sauces', 'Garzas', 'Campanas', 'Velas', 'Cabos', 'Remos', 'Cometas', 'Nutrias', 'Mareas', 'Sal', 'Berberechos', 'Faros', 'Barcas', 'Peregrinos', 'Redes', 'Huertos', 'Colmenas'],
      second: ['Puerto', 'Aldea', 'Embarcadero', 'Paso', 'Punta', 'Marisma', 'Ensenada', 'Muelle', 'Refugio', 'Senda', 'Terraza', 'Islas'],
      join: (a, b) => `${b} de ${a}`,
    },
    hard: {
      first: ['Tormentas', 'Estrellas', 'Ballenas', 'Truenos', 'Corales', 'Almenaras', 'Naufragios', 'Corrientes', 'Lunas', 'Albatros', 'Viajeros', 'Brújulas', 'Marineros', 'Krakens', 'Tempestades', 'Zafiros', 'Cometas', 'Monzones', 'Flotas de Faroles', 'Cometas Dragón'],
      second: ['Archipiélago', 'Arrecife', 'Estrecho', 'Atolón', 'Laberinto', 'Cabo', 'Canales', 'Golfo', 'Mar', 'Fiordo', 'Bajíos', 'Confín'],
      join: (a, b) => `${b} de ${a}`,
    },
  },
}
