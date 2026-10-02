import { chromium } from '@playwright/test'
import { PNG } from 'pngjs'
import { mkdirSync, writeFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import { PUZZLES } from '../src/puzzles.js'
import { findEnclosedRegions, terrainNeighbors, COMPLETION_VARIANTS } from '../src/terrain.js'

const url = process.env.TIDAL_TEST_URL ?? 'http://127.0.0.1:5180'
mkdirSync('test-results', { recursive: true })
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl'] })
const errors = []
const results = []

function assertCross(snapshot, cell) {
  assert.deepEqual(snapshot.activeCell, cell)
  assert.deepEqual(snapshot.guides, Array.from({ length: 100 }, (_, index) => Math.floor(index / 10) === cell.row || index % 10 === cell.col), 'Both complete axes should glow, and no other cells')
}

function countPixels(buffer) {
  const png = PNG.sync.read(buffer)
  let teal = 0, green = 0, variation = new Set()
  for (let i = 0; i < png.data.length; i += 4) {
    const [r, g, b] = png.data.subarray(i, i + 3)
    if (g > r * 1.2 && b > r * 1.15 && g > 65) teal++
    if (g > r * 1.05 && g > b * 1.08) green++
    variation.add(`${Math.floor(r / 16)},${Math.floor(g / 16)},${Math.floor(b / 16)}`)
  }
  return { teal, green, variation: variation.size, total: png.width * png.height }
}

try {
  const viewports = process.env.TIDAL_TEST_REDUCED_ONLY || process.env.TIDAL_TEST_COMPLETIONS_ONLY ? [] : [{ width: 1440, height: 1000 }, { width: 390, height: 844 }, { width: 320, height: 720 }]
  for (const viewport of viewports) {
    console.log(`Checking ${viewport.width}x${viewport.height}`)
    const context = await browser.newContext({ viewport, deviceScaleFactor: 1 })
    context.setDefaultTimeout(15000)
    const page = await context.newPage()
    page.on('pageerror', (error) => errors.push(error.message))
    page.on('console', (message) => {
      if (message.type() === 'error' && /WebGLProgram|Shader Error|VALIDATE_STATUS/.test(message.text())) errors.push(message.text())
    })
    await page.goto(url)
    await page.waitForSelector('#world[data-rendered="true"]')
    await page.waitForFunction(() => window.__tidal?.snapshot.calls > 0)
    await page.waitForTimeout(1000)
    const layout = await page.evaluate(() => ({ overflow: document.documentElement.scrollWidth > innerWidth, canvas: document.querySelector('canvas').getBoundingClientRect().toJSON(), cells: [__tidal.cellPosition(0, 0), __tidal.cellPosition(0, 9), __tidal.cellPosition(9, 0), __tidal.cellPosition(9, 9)] }))
    assert.equal(layout.overflow, false, 'Horizontal overflow')
    layout.cells.forEach((cell) => {
      assert.ok(cell.x > 0 && cell.x < viewport.width && cell.y > 0 && cell.y < viewport.height, 'Board cell outside viewport')
    })
    const baseline = await page.locator('canvas').screenshot()
    const pixels = countPixels(baseline)
    assert.ok(pixels.teal > 1000 && pixels.green > 300 && pixels.variation > 70, `Blank or incomplete 3D scene: ${JSON.stringify(pixels)}`)
    await page.screenshot({ path: `test-results/garden-${viewport.width}.png` })
    const initial = await page.evaluate(() => __tidal.snapshot.filled)
    await page.getByRole('button', { name: 'Place land', exact: true }).click()
    const position = await page.evaluate(() => __tidal.cellPosition(0, 0))
    await page.mouse.move(position.x, position.y)
    const guides = await page.evaluate(() => __tidal.snapshot)
    assert.deepEqual(guides.hover, { row: 0, col: 0 })
    assertCross(guides, { row: 0, col: 0 })
    assert.equal(await page.locator('#coordinate, .journal-note').count(), 0, 'Counting overlays are removed')
    assert.deepEqual(guides.boundary, { segments: 4, color: 0xffffff, opacity: 0.32 })
    assert.equal(guides.targets, 100, 'Only board cells are interactive')
    await page.screenshot({ path: `test-results/hover-${viewport.width}.png` })
    console.log('  Hover and outline checks passed; checking placement')
    await page.mouse.click(position.x, position.y)
    await page.waitForFunction((filled) => __tidal.snapshot.filled === filled + 1, initial)
    console.log('  Placement passed; checking selection persistence')
    const reaction = await page.evaluate(() => __tidal.snapshot)
    assert.deepEqual(reaction.selected, { row: 0, col: 0 })
    await page.mouse.move(2, 2)
    assertCross(await page.evaluate(() => __tidal.snapshot), { row: 0, col: 0 })
    const other = await page.evaluate(() => __tidal.cellPosition(3, 4))
    await page.mouse.move(other.x, other.y)
    assertCross(await page.evaluate(() => __tidal.snapshot), { row: 3, col: 4 })
    await page.getByRole('button', { name: 'Place land', exact: true }).click()
    assertCross(await page.evaluate(() => __tidal.snapshot), { row: 0, col: 0 })
    assert.ok(reaction.terrain[0].mask & 4, 'New land must connect to its southern neighbor')
    assert.ok(reaction.terrain[10].mask & 1, 'Existing land must connect back to new terrain')
    assert.ok(reaction.terrain[10].reactionAt > 0, 'Neighboring terrain should respond to placement')
    assert.ok(reaction.ripples.some((ripple) => ripple[2] > 0), 'Placement should launch a water ripple')
    await page.getByRole('button', { name: 'Undo', exact: true }).click()
    assert.equal(await page.evaluate(() => __tidal.snapshot.filled), initial)
    await page.mouse.click(position.x, position.y)
    await page.reload()
    await page.waitForSelector('#world[data-rendered="true"]')
    assert.equal(await page.evaluate(() => __tidal.snapshot.grid[0][0]), 1)
    await page.getByRole('button', { name: 'Start again', exact: true }).click()
    await page.getByRole('button', { name: 'Keep growing', exact: true }).click()
    assert.equal(await page.evaluate(() => __tidal.snapshot.filled), initial + 1)
    await page.getByRole('button', { name: 'Start again', exact: true }).click()
    await page.locator('#confirm-reset').click()
    assert.equal(await page.evaluate(() => __tidal.snapshot.filled), initial)
    assert.equal(await page.evaluate(() => __tidal.snapshot.guides.some(Boolean)), false, 'Reset clears selection')
    console.log('  Undo, reload, and reset passed')
    const focus = page.getByRole('button', { name: 'Row 1, column 1: undecided', exact: true })
    await focus.focus()
    assertCross(await page.evaluate(() => __tidal.snapshot), { row: 0, col: 0 })
    assert.deepEqual(await page.evaluate(() => __tidal.snapshot.selected), { row: 0, col: 0 }, 'Keyboard selection persists')
    await page.mouse.move(2, 2)
    await page.screenshot({ path: `test-results/focus-${viewport.width}.png` })
    await page.getByRole('button', { name: 'Garden rules', exact: true }).click()
    await page.screenshot({ path: `test-results/rules-${viewport.width}.png` })
    await page.getByRole('button', { name: 'Close', exact: true }).click()
    const before = await page.locator('canvas').screenshot()
    await page.waitForTimeout(800)
    const after = await page.locator('canvas').screenshot()
    const a = PNG.sync.read(before), b = PNG.sync.read(after)
    let changed = 0
    for (let i = 0; i < a.data.length; i += 4) {
      if (Math.abs(a.data[i] - b.data[i]) + Math.abs(a.data[i + 1] - b.data[i + 1]) + Math.abs(a.data[i + 2] - b.data[i + 2]) > 8) changed++
    }
    assert.ok(changed > 100, 'Water animation is static')
    if (viewport.width === 1440) {
      console.log('  Solving full garden')
      for (let row = 0; row < 10; row++) {
        for (let col = 0; col < 10; col++) {
          if (PUZZLES[0].puzzle[row][col] !== null) continue
          await page.getByRole('button', { name: PUZZLES[0].solution[row][col] === 0 ? 'Place water' : 'Place land', exact: true }).click()
          const cell = await page.evaluate(([r, c]) => __tidal.cellPosition(r, c), [row, col])
          await page.mouse.click(cell.x, cell.y)
          assert.equal(await page.evaluate(([r, c]) => __tidal.snapshot.grid[r][c], [row, col]), PUZZLES[0].solution[row][col], `Placement missed row ${row}, col ${col}`)
        }
      }
      assert.equal(await page.evaluate(() => __tidal.snapshot.complete), true)
      const completed = await page.evaluate(() => __tidal.snapshot)
      assert.ok(completed.completionEvents.some((event) => event.value === 0), 'Completing lakes should celebrate')
      assert.ok(completed.completionEvents.some((event) => event.value === 1), 'Completing islands should celebrate')
      assert.ok(completed.completedRegions.every((region) => region.ornaments > 0))
      assert.ok(completed.activeCompletions.length <= 5, 'Effects are bounded')
      await page.getByRole('button', { name: 'Stay a little longer', exact: true }).click()
      await page.waitForTimeout(800)
      await page.screenshot({ path: 'test-results/garden-complete.png' })
    }
    results.push({ viewport, pixels, animatedPixels: changed, layout })
    await context.close()
  }
  if (!process.env.TIDAL_TEST_REDUCED_ONLY) for (const value of [1, 0]) {
    console.log(`Checking ${value ? 'island' : 'lake'} completion and undo`)
    const puzzle = PUZZLES[0]
    const region = findEnclosedRegions(puzzle.solution).find((region) => region.value === value && region.cells.some((cell) => terrainNeighbors(puzzle.solution, cell.row, cell.col).some((neighbor) => neighbor.value !== value && puzzle.puzzle[cell.row + neighbor.row]?.[cell.col + neighbor.col] === null)))
    assert.ok(region, 'Fixture needs an enclosed patch with editable shoreline')
    const closing = region.cells.flatMap((cell) => terrainNeighbors(puzzle.solution, cell.row, cell.col).map((neighbor) => ({ row: cell.row + neighbor.row, col: cell.col + neighbor.col, value: neighbor.value }))).find((cell) => cell.value !== value && puzzle.puzzle[cell.row]?.[cell.col] === null)
    const grid = puzzle.solution.map((row) => [...row])
    grid[closing.row][closing.col] = null
    // Leave a second distant cell unresolved so the end-of-level modal does not obscure the effect.
    const spare = grid.flatMap((row, r) => row.map((_, c) => ({ row: r, col: c }))).find((cell) => puzzle.puzzle[cell.row][cell.col] === null && Math.abs(cell.row - closing.row) + Math.abs(cell.col - closing.col) > 6)
    grid[spare.row][spare.col] = null
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
    context.setDefaultTimeout(15000)
    await context.addInitScript((grid) => {
      if (!localStorage.getItem('tidal-garden.v1')) localStorage.setItem('tidal-garden.v1', JSON.stringify({ version: 1, level: 0, completed: [], grids: { 0: { grid, history: [], seconds: 0 } } }))
    }, grid)
    const page = await context.newPage()
    page.on('pageerror', (error) => errors.push(error.message))
    await page.clock.install()
    await page.goto(url)
    await page.waitForSelector('#world[data-rendered="true"]')
    await page.clock.pauseAt(await page.evaluate(() => Date.now() + 10000))
    assert.ok(!(await page.evaluate(() => __tidal.snapshot.completedRegions)).some((candidate) => candidate.id === region.id))
    await page.getByRole('button', { name: closing.value === 0 ? 'Place water' : 'Place land', exact: true }).click()
    const point = await page.evaluate(([r, c]) => __tidal.cellPosition(r, c), [closing.row, closing.col])
    await page.mouse.click(point.x, point.y)
    const events = await page.evaluate(() => __tidal.snapshot.completionEvents)
    const event = events.find((event) => event.id === region.id)
    assert.ok(COMPLETION_VARIANTS[value].includes(event.variant))
    assert.equal((await page.evaluate(() => __tidal.snapshot.completedRegions)).find((candidate) => candidate.id === region.id).habitat, event.habitat)
    await page.mouse.move(2, 2)
    // Freeze an actual animation frame so slow software rendering cannot outlast the effect.
    await page.clock.fastForward(750)
    assert.ok((await page.evaluate(() => __tidal.snapshot.activeCompletions)).some((effect) => effect.id === region.id))
    await page.screenshot({ path: `test-results/completion-${value ? 'island' : 'lake'}.png` })
    await page.clock.fastForward(3500)
    const settled = (await page.evaluate(() => __tidal.snapshot.completedRegions)).find((candidate) => candidate.id === region.id)
    if (region.cells.length === 1) assert.deepEqual(settled.residents, [], 'Single-cell landmarks stay animal-free')
    else assert.ok(settled.residents.length >= 2 && settled.residents.every((resident) => resident.scale > 0.5), 'Residents remain after the brief flourish')
    await page.clock.fastForward(900)
    const alive = (await page.evaluate(() => __tidal.snapshot.completedRegions)).find((candidate) => candidate.id === region.id)
    if (region.cells.length === 1) assert.deepEqual(alive.residents, [])
    else assert.notDeepEqual(alive.residents, settled.residents, 'The new habitat keeps moving')
    await page.getByRole('button', { name: 'Undo', exact: true }).click()
    assert.ok(!(await page.evaluate(() => __tidal.snapshot.completedRegions)).some((candidate) => candidate.id === region.id))
    assert.ok(!(await page.evaluate(() => __tidal.snapshot.activeCompletions)).some((candidate) => candidate.id === region.id))
    await page.mouse.click(point.x, point.y)
    await page.clock.resume()
    await page.reload()
    await page.waitForSelector('#world[data-rendered="true"]')
    assert.ok((await page.evaluate(() => __tidal.snapshot.completedRegions)).some((candidate) => candidate.id === region.id))
    assert.equal((await page.evaluate(() => __tidal.snapshot.completedRegions)).find((candidate) => candidate.id === region.id).habitat, event.habitat)
    assert.deepEqual(await page.evaluate(() => __tidal.snapshot.completionEvents), [], 'Reload does not replay celebrations')
    assert.deepEqual(await page.evaluate(() => __tidal.snapshot.activeCompletions), [])
    await context.close()
  }
  const quiet = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' })
  quiet.setDefaultTimeout(15000)
  console.log('Checking reduced motion')
  const quietPage = await quiet.newPage()
  await quietPage.goto(url)
  await quietPage.waitForSelector('#world[data-rendered="true"]')
  await quietPage.waitForTimeout(200)
  // A canvas locator screenshot also captures overlaid DOM; exclude the live timer's HUD.
  const stillOptions = { mask: [quietPage.locator('.garden-journal')] }
  const frozen = await quietPage.locator('canvas').screenshot(stillOptions)
  await quietPage.waitForTimeout(600)
  const later = await quietPage.locator('canvas').screenshot(stillOptions)
  writeFileSync('test-results/reduced-before.png', frozen)
  writeFileSync('test-results/reduced-after.png', later)
  const frozenPixels = PNG.sync.read(frozen).data
  const laterPixels = PNG.sync.read(later).data
  let quietChanges = 0
  for (let i = 0; i < frozenPixels.length; i += 4) {
    if (Math.abs(frozenPixels[i] - laterPixels[i]) + Math.abs(frozenPixels[i + 1] - laterPixels[i + 1]) + Math.abs(frozenPixels[i + 2] - laterPixels[i + 2]) > 6) quietChanges++
  }
  assert.ok(quietChanges < 30, `Reduced motion should freeze the ocean: ${quietChanges} changed pixels`)
  await quiet.close()
  assert.deepEqual(errors, [], 'Browser errors')
  if (results.length) writeFileSync('test-results/visual-report.json', JSON.stringify(results, null, 2))
  console.log(JSON.stringify(results.map(({ viewport, pixels, animatedPixels }) => ({ viewport, pixels, animatedPixels })), null, 2))
} finally {
  await browser.close()
}
