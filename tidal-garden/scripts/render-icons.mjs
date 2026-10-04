// Renders the app's icons from scripts/icon.svg into public/: the iOS home-screen icon, the web
// app manifest's icons (plus a maskable one with room around the art), and the favicons.
//
//   node scripts/render-icons.mjs
import { readFileSync, writeFileSync } from 'node:fs'
import { chromium } from '@playwright/test'

const svg = readFileSync(new URL('./icon.svg', import.meta.url), 'utf8')
// The maskable icon keeps its art inside the middle 80%, the safe zone launchers never crop.
const maskable = svg.replace('<g id="art">', '<g id="art" transform="translate(102.4 102.4) scale(.8)">')
const sizes = [
  ['apple-touch-icon.png', 180, svg],
  ['icon-192.png', 192, svg],
  ['icon-512.png', 512, svg],
  ['icon-maskable-512.png', 512, maskable],
  ['favicon-32.png', 32, svg],
]

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {})
const page = await browser.newPage()
for (const [file, size, art] of sizes) {
  await page.setViewportSize({ width: size, height: size })
  await page.setContent(`<style>html,body{margin:0}svg{display:block;width:${size}px;height:${size}px}</style>${art}`)
  writeFileSync(new URL(`../public/${file}`, import.meta.url), await page.screenshot({ type: 'png' }))
  console.log(file, size)
}
await browser.close()
// The SVG favicon is the icon itself, with rounded corners for browser tabs.
writeFileSync(new URL('../public/favicon.svg', import.meta.url), svg.replace('<rect width="1024" height="1024" fill="url(#sky)"/>', '<rect width="1024" height="1024" rx="230" fill="url(#sky)"/>').replace('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024"><clipPath id="round"><rect width="1024" height="1024" rx="230"/></clipPath><g clip-path="url(#round)">').replace('</svg>', '</g></svg>'))
console.log('favicon.svg')
