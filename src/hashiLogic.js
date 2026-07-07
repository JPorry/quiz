const MAX_SOLUTIONS = 2

export function edgeId(from, to) {
  return [from, to].sort((a, b) => a - b).join('-')
}

function cellKey(row, column) {
  return `${row},${column}`
}

export function getHashiEdges(level) {
  const islandByCell = new Map(
    level.islands.map((island, index) => [cellKey(island.row, island.column), index]),
  )
  const edges = []

  level.islands.forEach((island, from) => {
    for (const [rowDelta, columnDelta] of [
      [0, 1],
      [1, 0],
    ]) {
      let row = island.row + rowDelta
      let column = island.column + columnDelta

      while (
        row >= 0 &&
        row < level.height &&
        column >= 0 &&
        column < level.width
      ) {
        const to = islandByCell.get(cellKey(row, column))
        if (to !== undefined) {
          edges.push({
            id: edgeId(from, to),
            from,
            to,
            horizontal: island.row === level.islands[to].row,
          })
          break
        }

        row += rowDelta
        column += columnDelta
      }
    }
  })

  return edges
}

export function doHashiEdgesCross(edgeA, edgeB, islands) {
  const a1 = islands[edgeA.from]
  const a2 = islands[edgeA.to]
  const b1 = islands[edgeB.from]
  const b2 = islands[edgeB.to]
  const aHorizontal = a1.row === a2.row
  const bHorizontal = b1.row === b2.row

  if (aHorizontal === bHorizontal) return false

  const horizontal = aHorizontal ? [a1, a2] : [b1, b2]
  const vertical = aHorizontal ? [b1, b2] : [a1, a2]
  const horizontalRow = horizontal[0].row
  const verticalColumn = vertical[0].column
  const horizontalColumns = horizontal
    .map((island) => island.column)
    .sort((left, right) => left - right)
  const verticalRows = vertical
    .map((island) => island.row)
    .sort((left, right) => left - right)

  return (
    verticalColumn > horizontalColumns[0] &&
    verticalColumn < horizontalColumns[1] &&
    horizontalRow > verticalRows[0] &&
    horizontalRow < verticalRows[1]
  )
}

export function getHashiDegrees(level, bridgeCounts) {
  const degrees = level.islands.map(() => 0)

  getHashiEdges(level).forEach((edge) => {
    const count = bridgeCounts.get(edge.id) ?? 0
    degrees[edge.from] += count
    degrees[edge.to] += count
  })

  return degrees
}

export function hasCrossingBridge(level, bridgeCounts) {
  const edges = getHashiEdges(level)

  return edges.some((edge, index) =>
    edges.some(
      (candidate, candidateIndex) =>
        candidateIndex > index &&
        (bridgeCounts.get(edge.id) ?? 0) > 0 &&
        (bridgeCounts.get(candidate.id) ?? 0) > 0 &&
        doHashiEdgesCross(edge, candidate, level.islands),
    ),
  )
}

export function isHashiConnected(level, bridgeCounts) {
  const graph = level.islands.map(() => [])

  getHashiEdges(level).forEach((edge) => {
    if ((bridgeCounts.get(edge.id) ?? 0) === 0) return
    graph[edge.from].push(edge.to)
    graph[edge.to].push(edge.from)
  })

  const visited = new Set([0])
  const stack = [0]

  while (stack.length) {
    const current = stack.pop()
    graph[current].forEach((next) => {
      if (!visited.has(next)) {
        visited.add(next)
        stack.push(next)
      }
    })
  }

  return visited.size === level.islands.length
}

export function isHashiComplete(level, bridgeCounts) {
  const degrees = getHashiDegrees(level, bridgeCounts)

  return (
    degrees.every((degree, islandIndex) => degree === level.islands[islandIndex].value) &&
    !hasCrossingBridge(level, bridgeCounts) &&
    isHashiConnected(level, bridgeCounts)
  )
}

export function countHashiSolutions(level) {
  const edges = getHashiEdges(level)
  const remainingCapacity = level.islands.map(() => 0)
  const crossingEdgeIndexes = edges.map(() => [])
  let solutions = 0

  edges.forEach((edge) => {
    remainingCapacity[edge.from] += 2
    remainingCapacity[edge.to] += 2
  })

  edges.forEach((edge, index) => {
    for (let candidateIndex = index + 1; candidateIndex < edges.length; candidateIndex += 1) {
      if (doHashiEdgesCross(edge, edges[candidateIndex], level.islands)) {
        crossingEdgeIndexes[index].push(candidateIndex)
        crossingEdgeIndexes[candidateIndex].push(index)
      }
    }
  })

  function search(index, degrees, remaining, assignments) {
    if (solutions >= MAX_SOLUTIONS) return
    if (degrees.some((degree, islandIndex) => degree > level.islands[islandIndex].value)) return
    if (
      degrees.some(
        (degree, islandIndex) =>
          degree + remaining[islandIndex] < level.islands[islandIndex].value,
      )
    ) {
      return
    }

    if (index === edges.length) {
      const bridgeCounts = new Map(
        edges.map((edge, edgeIndex) => [edge.id, assignments[edgeIndex] ?? 0]),
      )

      if (
        degrees.every(
          (degree, islandIndex) => degree === level.islands[islandIndex].value,
        ) &&
        isHashiConnected(level, bridgeCounts)
      ) {
        solutions += 1
      }
      return
    }

    const edge = edges[index]
    const hasCrossing = crossingEdgeIndexes[index].some(
      (crossingIndex) => assignments[crossingIndex] > 0,
    )
    const options = hasCrossing ? [0] : [0, 1, 2]

    options.forEach((count) => {
      const nextDegrees = [...degrees]
      const nextRemaining = [...remaining]
      const nextAssignments = [...assignments]

      nextRemaining[edge.from] -= 2
      nextRemaining[edge.to] -= 2
      nextDegrees[edge.from] += count
      nextDegrees[edge.to] += count
      nextAssignments[index] = count

      search(index + 1, nextDegrees, nextRemaining, nextAssignments)
    })
  }

  search(0, level.islands.map(() => 0), remainingCapacity, [])
  return solutions
}
