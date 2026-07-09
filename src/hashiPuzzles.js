const HASHI_BASE_PUZZLES = [
  {
    id: 'hashi-01',
    name: 'Level 1',
    width: 7,
    height: 7,
    islands: [
      { row: 0, column: 0, value: 1 },
      { row: 0, column: 2, value: 2 },
      { row: 0, column: 3, value: 2 },
      { row: 0, column: 5, value: 1 },
      { row: 1, column: 0, value: 3 },
      { row: 1, column: 2, value: 2 },
      { row: 3, column: 0, value: 2 },
      { row: 3, column: 5, value: 2 },
      { row: 6, column: 5, value: 1 },
    ],
  },
  {
    id: 'hashi-02',
    name: 'Level 2',
    width: 7,
    height: 7,
    islands: [
      { row: 1, column: 0, value: 2 },
      { row: 1, column: 2, value: 2 },
      { row: 2, column: 0, value: 1 },
      { row: 2, column: 2, value: 4 },
      { row: 2, column: 5, value: 3 },
      { row: 4, column: 1, value: 1 },
      { row: 4, column: 2, value: 3 },
      { row: 5, column: 2, value: 2 },
      { row: 5, column: 5, value: 2 },
    ],
  },
  {
    id: 'hashi-03',
    name: 'Level 3',
    width: 7,
    height: 7,
    islands: [
      { row: 0, column: 2, value: 3 },
      { row: 0, column: 3, value: 1 },
      { row: 1, column: 0, value: 2 },
      { row: 1, column: 2, value: 4 },
      { row: 2, column: 2, value: 3 },
      { row: 2, column: 3, value: 3 },
      { row: 2, column: 6, value: 2 },
      { row: 5, column: 0, value: 2 },
      { row: 5, column: 2, value: 2 },
    ],
  },
  {
    id: 'hashi-04',
    name: 'Level 4',
    width: 7,
    height: 7,
    islands: [
      { row: 2, column: 0, value: 2 },
      { row: 2, column: 1, value: 3 },
      { row: 2, column: 4, value: 2 },
      { row: 2, column: 5, value: 1 },
      { row: 3, column: 5, value: 1 },
      { row: 4, column: 0, value: 2 },
      { row: 4, column: 1, value: 5 },
      { row: 4, column: 5, value: 3 },
      { row: 6, column: 1, value: 1 },
    ],
  },
  {
    id: 'hashi-05',
    name: 'Level 5',
    width: 7,
    height: 7,
    islands: [
      { row: 0, column: 6, value: 1 },
      { row: 2, column: 0, value: 1 },
      { row: 3, column: 0, value: 2 },
      { row: 3, column: 5, value: 2 },
      { row: 3, column: 6, value: 2 },
      { row: 4, column: 0, value: 5 },
      { row: 4, column: 5, value: 5 },
      { row: 5, column: 0, value: 2 },
      { row: 5, column: 5, value: 2 },
    ],
  },
  {
    id: 'hashi-06',
    name: 'Level 6',
    width: 7,
    height: 7,
    islands: [
      { row: 0, column: 2, value: 3 },
      { row: 0, column: 6, value: 3 },
      { row: 1, column: 2, value: 5 },
      { row: 1, column: 4, value: 4 },
      { row: 1, column: 6, value: 4 },
      { row: 3, column: 2, value: 4 },
      { row: 3, column: 4, value: 6 },
      { row: 3, column: 5, value: 2 },
      { row: 4, column: 4, value: 1 },
    ],
  },
  {
    id: 'hashi-07',
    name: 'Level 7',
    width: 7,
    height: 7,
    islands: [
      { row: 0, column: 0, value: 2 },
      { row: 0, column: 1, value: 2 },
      { row: 0, column: 6, value: 2 },
      { row: 1, column: 0, value: 2 },
      { row: 1, column: 6, value: 2 },
      { row: 4, column: 0, value: 1 },
      { row: 4, column: 4, value: 2 },
      { row: 4, column: 6, value: 4 },
      { row: 5, column: 6, value: 1 },
    ],
  },
  {
    id: 'hashi-08',
    name: 'Level 8',
    width: 7,
    height: 7,
    islands: [
      { row: 0, column: 2, value: 2 },
      { row: 0, column: 4, value: 2 },
      { row: 2, column: 3, value: 3 },
      { row: 2, column: 4, value: 4 },
      { row: 2, column: 6, value: 2 },
      { row: 3, column: 2, value: 3 },
      { row: 3, column: 3, value: 4 },
      { row: 4, column: 4, value: 1 },
      { row: 4, column: 6, value: 1 },
    ],
  },
  {
    id: 'hashi-09',
    name: 'Level 9',
    width: 7,
    height: 7,
    islands: [
      { row: 1, column: 3, value: 2 },
      { row: 4, column: 0, value: 2 },
      { row: 4, column: 1, value: 2 },
      { row: 4, column: 3, value: 5 },
      { row: 4, column: 5, value: 2 },
      { row: 6, column: 0, value: 2 },
      { row: 6, column: 3, value: 2 },
      { row: 6, column: 4, value: 1 },
      { row: 6, column: 5, value: 2 },
    ],
  },
  {
    id: 'hashi-10',
    name: 'Level 10',
    width: 7,
    height: 7,
    islands: [
      { row: 0, column: 0, value: 2 },
      { row: 0, column: 2, value: 2 },
      { row: 0, column: 6, value: 3 },
      { row: 3, column: 0, value: 3 },
      { row: 3, column: 5, value: 1 },
      { row: 5, column: 0, value: 3 },
      { row: 5, column: 2, value: 1 },
      { row: 6, column: 0, value: 1 },
      { row: 6, column: 6, value: 2 },
    ],
  },
]

const HASHI_EXTRA_TRANSFORMS = [
  (level, island) => ({ row: island.row, column: level.width - 1 - island.column }),
  (level, island) => ({ row: level.height - 1 - island.row, column: island.column }),
  (level, island) => ({
    row: level.height - 1 - island.row,
    column: level.width - 1 - island.column,
  }),
  (level, island) => ({ row: island.column, column: island.row }),
  (level, island) => ({
    row: level.width - 1 - island.column,
    column: level.height - 1 - island.row,
  }),
  (level, island) => ({ row: island.row, column: level.width - 1 - island.column }),
  (level, island) => ({ row: level.height - 1 - island.row, column: island.column }),
  (level, island) => ({
    row: level.height - 1 - island.row,
    column: level.width - 1 - island.column,
  }),
  (level, island) => ({ row: island.column, column: island.row }),
  (level, island) => ({
    row: level.width - 1 - island.column,
    column: level.height - 1 - island.row,
  }),
]

function transformHashiLevel(level, index) {
  const transform = HASHI_EXTRA_TRANSFORMS[index]
  const levelNumber = HASHI_BASE_PUZZLES.length + index + 1

  return {
    ...level,
    id: `hashi-${String(levelNumber).padStart(2, '0')}`,
    name: `Level ${levelNumber}`,
    islands: level.islands
      .map((island) => ({
        ...transform(level, island),
        value: island.value,
      }))
      .sort((first, second) => first.row - second.row || first.column - second.column),
  }
}

export const HASHI_PUZZLES = [
  ...HASHI_BASE_PUZZLES,
  ...HASHI_BASE_PUZZLES.map(transformHashiLevel),
]
