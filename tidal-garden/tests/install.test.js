import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const png = (path) => {
  const data = readFileSync(new URL(`../public/${path}`, import.meta.url))
  return { width: data.readUInt32BE(16), height: data.readUInt32BE(20) }
}

test('the page can be added to a home screen as an app, with its own icon', () => {
  const html = read('index.html')
  for (const tag of ['rel="apple-touch-icon" href="./apple-touch-icon.png"', 'rel="manifest" href="./manifest.webmanifest"', 'name="apple-mobile-web-app-capable" content="yes"', 'name="apple-mobile-web-app-title" content="Tidal Garden"', 'viewport-fit=cover', 'rel="icon" type="image/svg+xml" href="./favicon.svg"']) {
    assert.ok(html.includes(tag), `index.html has ${tag}`)
  }
  assert.deepEqual(png('apple-touch-icon.png'), { width: 180, height: 180 })
})

test('the manifest opens full screen and every icon it lists is there at its size', () => {
  const manifest = JSON.parse(read('public/manifest.webmanifest'))
  assert.equal(manifest.display, 'standalone')
  assert.equal(manifest.start_url, './')
  assert.ok(manifest.icons.some((icon) => icon.purpose === 'maskable'))
  for (const icon of manifest.icons) {
    assert.ok(existsSync(new URL(`../public/${icon.src}`, import.meta.url)), icon.src)
    const [width, height] = icon.sizes.split('x').map(Number)
    assert.deepEqual(png(icon.src), { width, height })
  }
})
