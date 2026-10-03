import { chromium } from '@playwright/test'
import { PNG } from 'pngjs'
import assert from 'node:assert/strict'
import { mkdirSync } from 'node:fs'

// ?play skips the title and map and opens straight into the garden.
const url = `${process.env.TIDAL_TEST_URL ?? 'http://127.0.0.1:5180'}/?play`
mkdirSync('test-results', { recursive: true })
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl'] })
try {
  for (const width of [390, 320, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: width === 1440 ? 1000 : width === 390 ? 844 : 720 }, deviceScaleFactor: 3, isMobile: width < 700, hasTouch: width < 700 })
    const page = await context.newPage()
    const errors = []
    page.on('pageerror', (error) => errors.push(error.message))
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text())
    })
    await page.clock.install()
    await page.goto(url)
    await page.waitForSelector('#world[data-rendered="true"]')
    await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000))
    const before = await page.evaluate(() => __tidal.snapshot.rendering)
    const waterBefore = await page.evaluate(() => __tidal.snapshot.water)
    const mobile = width < 700
    assert.equal(before.pixelRatio, mobile ? 1.25 : 1.5)
    assert.equal(before.maxFps, mobile ? 30 : 45)
    assert.equal(before.shadowSize, mobile ? 1024 : 2048)
    assert.equal(before.buffer[0], Math.floor(width * before.pixelRatio))
    await page.clock.runFor(1000)
    const after = await page.evaluate(() => __tidal.snapshot.rendering)
    const waterAfter = await page.evaluate(() => __tidal.snapshot.water)
    assert.ok(waterAfter.clock > waterBefore.clock, 'Foam and wave marks keep moving')
    const frames = after.frames - before.frames
    assert.ok(frames >= before.maxFps - 2 && frames <= before.maxFps + 1, `Frame budget: ${frames}`)
    const pixels = PNG.sync.read(await page.locator('canvas').screenshot())
    const colors = new Set()
    for (let i = 0; i < pixels.data.length; i += 32) colors.add(pixels.data.subarray(i, i + 3).map((value) => value >> 4).join(','))
    assert.ok(colors.size > 70, 'Water and islands render with distinct visible colors')
    await page.screenshot({ path: `test-results/diorama-${width}.png` })
    const sunBefore = waterAfter.sun
    await page.getByRole('button', { name: 'Place water', exact: true }).click()
    const position = await page.evaluate(() => __tidal.cellPosition(0, 0))
    if (mobile) await page.touchscreen.tap(position.x, position.y)
    else await page.mouse.click(position.x, position.y)
    await page.clock.runFor(400)
    const interaction = await page.evaluate(() => __tidal.snapshot.waterInteraction)
    assert.notDeepEqual((await page.evaluate(() => __tidal.snapshot.water)).sun, sunBefore, 'Filling a tile moves the sun along its path')
    assert.ok(interaction.activeRipples > 0 && interaction.rippleVisible, 'Placement makes visible water ripple rings')
    assert.ok(interaction.rippleVertices < 3000, 'Ripple detail remains a small single mesh')
    await page.screenshot({ path: `test-results/water-interaction-${width}.png` })
    await page.getByRole('button', { name: 'Undo', exact: true }).click()
    await page.evaluate(() => Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }))
    const hiddenStart = await page.evaluate(() => __tidal.snapshot.rendering.frames)
    await page.clock.runFor(1000)
    assert.equal(await page.evaluate(() => __tidal.snapshot.rendering.frames), hiddenStart, 'Hidden scene skips GPU rendering')
    assert.deepEqual(errors, [])
    console.log(`${width}px: ${frames} frames, ${before.pixelRatio}x density; hidden rendering pauses`)
    await context.close()
  }
} finally {
  await browser.close()
}
