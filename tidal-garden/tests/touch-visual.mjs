import assert from 'node:assert/strict'
import { chromium } from 'playwright'

// ?play skips the title and map and opens straight into the garden.
const url = `${process.env.TIDAL_TEST_URL ?? 'http://127.0.0.1:5180'}/?play`
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
try {
  for (const viewport of [{ width: 390, height: 844 }, { width: 320, height: 720 }]) {
    const context = await browser.newContext({ viewport, isMobile: true, hasTouch: true })
    const page = await context.newPage()
    await page.goto(url)
    await page.waitForSelector('#world[data-rendered="true"]')
    const cdp = await context.newCDPSession(page)
    const touch = (type, points) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points.map(([x, y], id) => ({ x, y, id })) })
    const snapshot = () => page.evaluate(() => __tidal.snapshot)
    const center = (row, col) => page.evaluate(([r, c]) => __tidal.cellPosition(r, c), [row, col])

    const width = (await center(0, 9)).x - (await center(0, 0)).x
    assert.ok(width / 9 >= 27, `Phone cells are finger-sized: ${(width / 9).toFixed(1)}px`)

    const empties = (await snapshot()).grid.flatMap((row, r) => row.map((value, c) => value === null ? [r, c] : null)).filter(Boolean)
    const [startRow, startCol] = empties[Math.floor(empties.length / 2)]
    const target = empties.find(([r, c]) => r === startRow && c !== startCol)
    const from = await center(startRow, startCol), to = await center(...target)
    const history = (await snapshot()).history

    await touch('touchStart', [[from.x, from.y]])
    for (let i = 1; i <= 6; i++) await touch('touchMove', [[from.x + (to.x - from.x) * i / 6, from.y + (to.y - from.y) * i / 6]])
    await page.waitForTimeout(200)
    let state = await snapshot()
    assert.deepEqual(state.aim, { row: target[0], col: target[1] }, 'Sliding re-aims the cell')
    assert.equal(state.history, history, 'Nothing is placed while aiming')
    assert.equal(state.touchMode, true)
    assert.equal(state.hover, null, 'Touch shows no hover outline')
    assert.ok(!state.guides.some(Boolean), 'Touch shows no row or column guides')
    await touch('touchEnd', [])
    await page.waitForTimeout(150)
    state = await snapshot()
    assert.equal(state.history, history + 1, 'Lifting places the tile')
    assert.notEqual(state.grid[target[0]][target[1]], null)
    assert.equal(state.selected, null, 'A placed tile leaves no selection outline behind')
    assert.ok(!state.guides.some(Boolean))

    const edge = await center(5, 0)
    await touch('touchStart', [[Math.max(1, edge.x - width / 9 * 0.6), edge.y]])
    assert.deepEqual((await snapshot()).aim, { row: 5, col: 0 }, 'Touches just past the board edge snap to the edge cell')
    await touch('touchEnd', [])

    const camera = (await snapshot()).camera
    const before = (await snapshot()).history
    await touch('touchStart', [[150, 400], [230, 420]])
    for (let i = 1; i <= 5; i++) await touch('touchMove', [[150 + i * 8, 400 + i * 10], [230 + i * 8, 420 + i * 10]])
    await touch('touchEnd', [[190, 450]])
    await touch('touchEnd', [])
    await page.waitForTimeout(300)
    state = await snapshot()
    assert.deepEqual(state.camera, camera, 'The diorama camera stays put')
    assert.equal(state.history, before, 'A two-finger gesture never places a tile')
    console.log(`${viewport.width}px: ${(width / 9).toFixed(1)}px cells, aim-and-lift without hover UI, edge snapping, fixed camera`)
    await context.close()
  }
} finally {
  await browser.close()
}
