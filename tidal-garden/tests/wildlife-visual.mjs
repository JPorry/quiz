import { chromium } from '@playwright/test'
import { PNG } from 'pngjs'
import { mkdirSync } from 'node:fs'
import assert from 'node:assert/strict'
import { puzzle as dailyGarden, today } from '../src/daily.js'

// ?play opens today's easy garden, so the fixtures are that garden.
const FIXTURE = dailyGarden(today(), 'easy')
import { HABITATS } from '../src/wildlife.js'

// ?play skips the title and the menus and opens straight into today's easy garden.
const url = `${process.env.TIDAL_TEST_URL ?? 'http://127.0.0.1:5180'}/?play`
mkdirSync('test-results', { recursive: true })
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl'] })
const errors = []
const grid = FIXTURE.solution.map((row) => [...row])
grid[0][0] = null

try {
  for (const width of [1440, 390, 320]) {
    console.log(`Checking thriving garden at ${width}px`)
    const context = await browser.newContext({ viewport: { width, height: width === 1440 ? 1000 : width === 390 ? 844 : 720 } })
    context.setDefaultTimeout(20000)
    await context.addInitScript(({ grid, id }) => {
      localStorage.setItem('tidal-garden.daily', JSON.stringify({ version: 1, done: {}, grids: { [id]: { grid, history: [], seconds: 0 } } }))
    }, { grid, id: FIXTURE.id })
    const page = await context.newPage()
    page.on('pageerror', (error) => errors.push(error.message))
    page.on('console', (message) => {
      if (message.type() === 'error' && /WebGLProgram|Shader Error|VALIDATE_STATUS/.test(message.text())) errors.push(message.text())
    })
    await page.clock.install()
    await page.goto(url)
    await page.waitForSelector('#world[data-rendered="true"]')
    await page.clock.pauseAt(await page.evaluate(() => Date.now() + 10000))
    const initial = await page.evaluate(() => __tidal.snapshot.completedRegions)
    assert.ok(initial.some((region) => region.cells.length === 1), 'Fixture includes single-cell landmarks')
    assert.ok(initial.some((region) => region.cells.length > 1), 'Fixture includes larger habitats')
    for (const region of initial) {
      if (region.cells.length === 1) {
        assert.equal(region.habitat, null)
        assert.deepEqual(region.residents, [])
        assert.ok(region.ornaments > 0, 'Small landmarks retain decorations')
      } else {
        assert.ok(HABITATS[region.value].includes(region.habitat))
        assert.ok(region.residents.length >= 2)
      }
    }
    for (const region of initial) for (const resident of region.residents) {
      assert.ok(resident.position.every(Number.isFinite))
      const col = Math.round(resident.position[0] + 4.5), row = Math.round(resident.position[2] + 4.5)
      assert.ok(region.cells.some((cell) => cell.row === row && cell.col === col), 'Resident must remain in its own habitat')
      assert.ok(resident.scale >= 0.65)
    }
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
    const pixels = PNG.sync.read(await page.locator('canvas').screenshot())
    const colors = new Set()
    for (let i = 0; i < pixels.data.length; i += 32) colors.add(`${pixels.data[i] >> 4}:${pixels.data[i + 1] >> 4}:${pixels.data[i + 2] >> 4}`)
    assert.ok(colors.size > 100, 'Scene must render nonblank, varied terrain and residents')
    await page.screenshot({ path: `test-results/wildlife-${width}.png` })
    await page.clock.fastForward(1800)
    const later = await page.evaluate(() => __tidal.snapshot.completedRegions)
    for (const region of later) {
      if (region.cells.length === 1) assert.deepEqual(region.residents, [])
      else assert.notDeepEqual(region.residents, initial.find((candidate) => candidate.id === region.id).residents, `${region.habitat} should remain alive`)
    }
    if (width === 1440) {
      await page.clock.fastForward(100)
      const { x, y } = await page.evaluate(() => __tidal.cellPosition(4, 4))
      await page.screenshot({ path: 'test-results/wildlife-detail.png', clip: { x: x - 220, y: y - 220, width: 440, height: 440 } })
    }
    await context.close()
  }
  const quiet = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' })
  await quiet.addInitScript(({ grid, id }) => localStorage.setItem('tidal-garden.daily', JSON.stringify({ version: 1, done: {}, grids: { [id]: { grid, history: [], seconds: 0 } } })), { grid, id: FIXTURE.id })
  const page = await quiet.newPage()
  await page.clock.install()
  await page.goto(url)
  await page.waitForSelector('#world[data-rendered="true"]')
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 10000))
  const before = await page.evaluate(() => __tidal.snapshot.completedRegions)
  await page.clock.fastForward(3000)
  assert.deepEqual(await page.evaluate(() => __tidal.snapshot.completedRegions), before, 'Reduced motion freezes resident poses')
  await quiet.close()
  assert.deepEqual(errors, [], 'No browser or shader errors')
  console.log('Single-cell landmarks stay animal-free; larger habitats animate across desktop/mobile; reduced motion passes.')
} finally {
  await browser.close()
}
