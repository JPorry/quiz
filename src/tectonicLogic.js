const MAX_SOLUTIONS = 2

const NEIGHBORS_8 = [
  [-1, -1],
  [-1, 0],
  [-1, 1],
  [0, -1],
  [0, 1],
  [1, -1],
  [1, 0],
  [1, 1],
]

export function cellKey(row, column) {
  return `${row}-${column}`
}

function cellIndex(level, row, column) {
  return row * level.width + column
}

function rowFromIndex(level, index) {
  return Math.floor(index / level.width)
}

function columnFromIndex(level, index) {
  return index % level.width
}

export function getTectonicRegions(level) {
  const regions = []

  level.regionGrid.forEach((row, rowIndex) => {
    row.forEach((regionIndex, columnIndex) => {
      if (!regions[regionIndex]) regions[regionIndex] = []
      regions[regionIndex].push([rowIndex, columnIndex])
    })
  })

  return regions
}

export function getTectonicRegionSizes(level) {
  return getTectonicRegions(level).map((region) => region.length)
}

export function getTectonicMaxValue(level) {
  return Math.max(...getTectonicRegionSizes(level))
}

export function findTectonicViolations(level, grid) {
  const invalid = new Set()
  const add = (row, column) => invalid.add(cellKey(row, column))
  const regionSizes = getTectonicRegionSizes(level)

  grid.forEach((row, rowIndex) => {
    row.forEach((value, columnIndex) => {
      if (value === null) return

      const regionSize = regionSizes[level.regionGrid[rowIndex][columnIndex]]
      if (value < 1 || value > regionSize) {
        add(rowIndex, columnIndex)
      }

      NEIGHBORS_8.forEach(([rowDelta, columnDelta]) => {
        const nextRow = rowIndex + rowDelta
        const nextColumn = columnIndex + columnDelta

        if (
          nextRow >= 0 &&
          nextRow < level.height &&
          nextColumn >= 0 &&
          nextColumn < level.width &&
          grid[nextRow][nextColumn] === value
        ) {
          add(rowIndex, columnIndex)
          add(nextRow, nextColumn)
        }
      })
    })
  })

  getTectonicRegions(level).forEach((region) => {
    const seen = new Map()

    region.forEach(([rowIndex, columnIndex]) => {
      const value = grid[rowIndex][columnIndex]
      if (value === null) return

      if (!seen.has(value)) {
        seen.set(value, [])
      }
      seen.get(value).push([rowIndex, columnIndex])
    })

    seen.forEach((cells) => {
      if (cells.length <= 1) return
      cells.forEach(([rowIndex, columnIndex]) => add(rowIndex, columnIndex))
    })
  })

  return invalid
}

export function isTectonicComplete(level, grid) {
  return (
    grid.every((row) => row.every((value) => value !== null)) &&
    findTectonicViolations(level, grid).size === 0 &&
    grid.every((row, rowIndex) =>
      row.every((value, columnIndex) => value === level.solution[rowIndex][columnIndex]),
    )
  )
}

export function countTectonicSolutions(level) {
  const regionCells = getTectonicRegions(level).map((region) =>
    region.map(([row, column]) => cellIndex(level, row, column)),
  )
  const regionByCell = new Map()
  regionCells.forEach((region, regionIndex) => {
    region.forEach((cell) => regionByCell.set(cell, regionIndex))
  })

  const values = Array(level.width * level.height).fill(null)
  const givens = Array(level.width * level.height).fill(null)
  let solutions = 0

  level.puzzle.forEach((row, rowIndex) => {
    row.forEach((value, columnIndex) => {
      const index = cellIndex(level, rowIndex, columnIndex)
      if (value !== null) {
        givens[index] = value
        values[index] = value
      }
    })
  })

  function allowed(cell, value) {
    const regionIndex = regionByCell.get(cell)
    const regionSize = regionCells[regionIndex].length
    if (value < 1 || value > regionSize) return false
    if (givens[cell] !== null && givens[cell] !== value) return false

    if (regionCells[regionIndex].some((other) => other !== cell && values[other] === value)) {
      return false
    }

    const row = rowFromIndex(level, cell)
    const column = columnFromIndex(level, cell)
    return NEIGHBORS_8.every(([rowDelta, columnDelta]) => {
      const nextRow = row + rowDelta
      const nextColumn = column + columnDelta

      return (
        nextRow < 0 ||
        nextRow >= level.height ||
        nextColumn < 0 ||
        nextColumn >= level.width ||
        values[cellIndex(level, nextRow, nextColumn)] !== value
      )
    })
  }

  function candidatesFor(cell) {
    const regionSize = regionCells[regionByCell.get(cell)].length
    const candidates = []

    for (let value = 1; value <= regionSize; value += 1) {
      if (allowed(cell, value)) candidates.push(value)
    }

    return candidates
  }

  function search() {
    if (solutions >= MAX_SOLUTIONS) return

    let bestCell = null
    let bestCandidates = null

    for (let cell = 0; cell < values.length; cell += 1) {
      if (values[cell] !== null) continue

      const candidates = candidatesFor(cell)
      if (!candidates.length) return

      if (bestCandidates === null || candidates.length < bestCandidates.length) {
        bestCell = cell
        bestCandidates = candidates
      }
    }

    if (bestCell === null) {
      solutions += 1
      return
    }

    bestCandidates.forEach((value) => {
      values[bestCell] = value
      search()
      values[bestCell] = null
    })
  }

  if (values.every((value, index) => value === null || allowed(index, value))) {
    search()
  }

  return solutions
}
