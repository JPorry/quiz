// The garden map: one long winding path of stepping-stone islands, from the first garden at the
// bottom to the last at the top, through a region for every chapter. Layout is pure, so it can be
// tested; markup turns a layout into HTML for the map screen.
import { t } from './i18n.js'

export const NODE_GAP = 96
export const CHAPTER_GAP = 170
export const PAD_TOP = 150
export const PAD_BOTTOM = 210

// Each chapter's sea, its ribbon, and the little things that drift past its stretch of path.
export const CHAPTER_STYLE = [
  { sea: ['#8fe0d4', '#6ccfc6'], ribbon: '#2fa39a', art: ['islet', 'fish', 'blossom'] },
  { sea: ['#a6dfb6', '#7dcfa8'], ribbon: '#d8894a', art: ['hut', 'islet', 'hut'] },
  { sea: ['#7fc8e0', '#5fb3d3'], ribbon: '#e0675a', art: ['lighthouse', 'islet', 'fish'] },
  { sea: ['#74c3cf', '#55aebf'], ribbon: '#3d8aa0', art: ['ferry', 'islet', 'ferry'] },
  { sea: ['#b6dcc9', '#8cc8b4'], ribbon: '#c45f84', art: ['shrine', 'lantern', 'islet'] },
  { sea: ['#86bcd2', '#6aa6c4'], ribbon: '#6e7fc6', art: ['ferry', 'shrine', 'lantern'] },
  { sea: ['#8d9fd4', '#6d7fbe'], ribbon: '#7b5fb0', art: ['lighthouse', 'hut', 'ferry', 'shrine'] },
]

const chapterIndex = (chapters, level) => chapters.findLastIndex((chapter) => level >= chapter.start)

// Where every garden, chapter region, banner, and decoration sits on a map `width` pixels wide.
export function mapLayout(chapters, width) {
  const total = chapters.reduce((sum, chapter) => sum + chapter.count, 0)
  const height = PAD_BOTTOM + (total - 1) * NODE_GAP + (chapters.length - 1) * CHAPTER_GAP + PAD_TOP
  const amplitude = Math.min(width * 0.28, 150)
  // The path sways from side to side as it climbs.
  const fromBottom = (level) => PAD_BOTTOM + level * NODE_GAP + chapterIndex(chapters, level) * CHAPTER_GAP
  const nodes = Array.from({ length: total }, (_, level) => ({
    level,
    chapter: chapterIndex(chapters, level),
    x: Math.round(width / 2 + amplitude * Math.sin(level * 0.8)),
    y: Math.round(height - fromBottom(level)),
  }))
  const regions = chapters.map((chapter, index) => {
    const first = nodes[chapter.start], last = nodes[chapter.start + chapter.count - 1]
    const bottom = index === 0 ? height : first.y + CHAPTER_GAP / 2 + NODE_GAP / 2
    const top = index === chapters.length - 1 ? 0 : last.y - CHAPTER_GAP / 2 - NODE_GAP / 2
    return { index, name: chapter.name, start: chapter.start, count: chapter.count, top, bottom }
  })
  // A ribbon names each chapter just below its first garden.
  const banners = regions.map((region) => ({ ...region, y: nodes[region.start].y + (region.index === 0 ? 92 : CHAPTER_GAP / 2 + 6) }))
  // A few illustrations per chapter, always on the side the path has swung away from.
  const decorations = []
  regions.forEach((region) => {
    const art = CHAPTER_STYLE[region.index % CHAPTER_STYLE.length].art
    for (let k = 0; 3 + k * 5 < region.count; k++) {
      const node = nodes[region.start + 3 + k * 5]
      const left = node.x > width / 2
      decorations.push({ kind: art[k % art.length], chapter: region.index, x: Math.round(left ? width * 0.15 : width * 0.85), y: node.y + (k % 2 ? 18 : -10), flip: !left })
    }
  })
  // The path starts a little below the first garden and runs smoothly through every one.
  const points = [{ x: nodes[0].x, y: nodes[0].y + 120 }, ...nodes, { x: nodes.at(-1).x, y: nodes.at(-1).y - 90 }]
  return { width, height, nodes, regions, banners, decorations, path: smoothPath(points) }
}

// A Catmull-Rom curve through the points, as an SVG path of cubic Béziers.
export function smoothPath(points) {
  let d = `M${points[0].x} ${points[0].y}`
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)], p1 = points[i], p2 = points[i + 1], p3 = points[Math.min(points.length - 1, i + 2)]
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 }
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 }
    d += ` C${c1.x.toFixed(1)} ${c1.y.toFixed(1)} ${c2.x.toFixed(1)} ${c2.y.toFixed(1)} ${p2.x} ${p2.y}`
  }
  return d
}

// Small flat illustrations, drawn once and reused along the map.
export const MAP_ART = `<svg class="map-art-defs" aria-hidden="true" width="0" height="0"><defs>
  <symbol id="art-islet" viewBox="0 0 120 80"><ellipse cx="60" cy="62" rx="54" ry="13" fill="#ffffff55"/><ellipse cx="60" cy="58" rx="46" ry="14" fill="#f4dfae"/><ellipse cx="60" cy="52" rx="36" ry="12" fill="#92d46f"/><path d="M66 50 q-2 -22 6 -34" stroke="#a8754c" stroke-width="5" fill="none" stroke-linecap="round"/><path d="M72 16 q-20 -6 -30 6 q16 -2 30 -6z M72 16 q16 -10 30 0 q-16 -2 -30 0z M72 16 q-6 14 -22 18 q12 -12 22 -18z M72 16 q14 6 18 20 q-10 -12 -18 -20z" fill="#5fb35a"/><circle cx="44" cy="52" r="5" fill="#54b25c"/><circle cx="40" cy="50" r="2" fill="#ff9fb2"/></symbol>
  <symbol id="art-fish" viewBox="0 0 120 80"><path d="M20 58 q20 -10 40 0 q20 10 40 0" stroke="#ffffffaa" stroke-width="4" fill="none" stroke-linecap="round"/><g transform="rotate(-24 60 38)"><ellipse cx="60" cy="38" rx="20" ry="11" fill="#ff8f5a"/><path d="M78 38 l16 -10 v20z" fill="#ff8f5a"/><circle cx="48" cy="35" r="3" fill="#fff"/><circle cx="48" cy="35" r="1.5" fill="#2f3a40"/><path d="M58 30 q4 8 0 16" stroke="#fff" stroke-width="3" fill="none"/></g><circle cx="30" cy="24" r="3" fill="#ffffffcc"/><circle cx="24" cy="34" r="2" fill="#ffffffaa"/></symbol>
  <symbol id="art-blossom" viewBox="0 0 120 80"><ellipse cx="60" cy="62" rx="42" ry="11" fill="#ffffff55"/><ellipse cx="60" cy="58" rx="34" ry="11" fill="#f4dfae"/><ellipse cx="60" cy="53" rx="26" ry="9" fill="#92d46f"/><rect x="56" y="30" width="7" height="22" rx="3" fill="#a8754c"/><circle cx="60" cy="26" r="17" fill="#ffb8c8"/><circle cx="52" cy="22" r="6" fill="#ffd3dd"/><circle cx="68" cy="30" r="3" fill="#fff"/></symbol>
  <symbol id="art-hut" viewBox="0 0 120 80"><ellipse cx="60" cy="64" rx="46" ry="11" fill="#ffffff55"/><ellipse cx="60" cy="60" rx="38" ry="11" fill="#92d46f"/><rect x="42" y="36" width="36" height="24" rx="10" fill="#e8c9a0"/><path d="M34 40 L60 10 L86 40 q-26 8 -52 0z" fill="#e3b562"/><path d="M42 30 q18 6 36 0" stroke="#c9963f" stroke-width="3" fill="none"/><rect x="55" y="44" width="11" height="16" rx="5" fill="#8a5d3b"/><circle cx="60" cy="8" r="3" fill="#c9963f"/><circle cx="70" cy="2" r="4" fill="#ffffffaa"/></symbol>
  <symbol id="art-lighthouse" viewBox="0 0 120 90"><ellipse cx="60" cy="78" rx="40" ry="9" fill="#ffffff55"/><ellipse cx="60" cy="74" rx="30" ry="9" fill="#b9c3c4"/><path d="M50 74 L54 26 h12 L70 74z" fill="#fdf8ee"/><path d="M51.5 56 h17 l1 9 h-19z M53 38 h14 l.8 8 h-15.6z" fill="#e0675a"/><rect x="51" y="18" width="18" height="9" rx="3" fill="#ffe7a3"/><path d="M48 18 L60 6 L72 18z" fill="#e0675a"/><path d="M69 22 L112 6 v26z" fill="#fff6c8" opacity=".55"/></symbol>
  <symbol id="art-ferry" viewBox="0 0 120 80"><path d="M14 64 q14 -8 28 0 t28 0 t28 0" stroke="#ffffffaa" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M26 46 h68 q-4 16 -20 16 h-32 q-14 0 -16 -16z" fill="#fdf8ee"/><rect x="26" y="46" width="68" height="5" fill="#f08a7e"/><rect x="40" y="30" width="34" height="17" rx="6" fill="#fff3dc"/><circle cx="49" cy="38" r="3" fill="#6c8e9c"/><circle cx="59" cy="38" r="3" fill="#6c8e9c"/><rect x="38" y="27" width="38" height="5" rx="2" fill="#f08a7e"/><rect x="62" y="14" width="9" height="14" rx="2" fill="#f08a7e"/><circle cx="70" cy="9" r="4" fill="#ffffffcc"/><circle cx="78" cy="4" r="3" fill="#ffffff99"/></symbol>
  <symbol id="art-shrine" viewBox="0 0 120 80"><ellipse cx="60" cy="66" rx="44" ry="10" fill="#ffffff55"/><ellipse cx="60" cy="62" rx="36" ry="10" fill="#92d46f"/><rect x="47" y="38" width="26" height="22" rx="3" fill="#9c6446"/><path d="M36 40 L60 20 L84 40z" fill="#f29bb5"/><rect x="34" y="38" width="52" height="4" rx="2" fill="#4d4040"/><rect x="55" y="46" width="10" height="14" rx="2" fill="#4f4646"/><g fill="#e0583f"><rect x="26" y="40" width="4" height="22" rx="2"/><rect x="40" y="40" width="4" height="22" rx="2"/><rect x="23" y="38" width="24" height="4" rx="2"/></g><circle cx="94" cy="44" r="7" fill="#ffcf8a"/><rect x="92.5" y="50" width="3" height="12" fill="#8a5d3b"/></symbol>
  <symbol id="art-lantern" viewBox="0 0 120 80"><g transform="translate(36 6)"><rect x="12" y="28" width="4" height="36" fill="#8a5d3b"/><ellipse cx="14" cy="22" rx="11" ry="14" fill="#f3a64a"/><rect x="8" y="7" width="12" height="4" rx="2" fill="#4f4646"/><rect x="8" y="33" width="12" height="4" rx="2" fill="#4f4646"/><ellipse cx="14" cy="22" rx="5" ry="8" fill="#ffe2a0"/></g><g transform="translate(64 16)"><rect x="9" y="22" width="3" height="28" fill="#8a5d3b"/><ellipse cx="10.5" cy="16" rx="8" ry="10" fill="#f29bb5"/><ellipse cx="10.5" cy="16" rx="3.5" ry="6" fill="#ffe6ee"/></g></symbol>
</defs></svg>`

// The map screen's scrolling content: seas, path, banners, decorations, and garden stops.
export function mapMarkup(layout, chapters, { completed, isUnlocked, frontier, names }) {
  const done = new Set(completed)
  const regions = layout.regions.map((region) => {
    const [top, bottom] = CHAPTER_STYLE[region.index % CHAPTER_STYLE.length].sea
    // Neighboring seas overlap and fade into each other; the map's two ends run to its edges.
    const first = region.index === 0, last = region.index === layout.regions.length - 1
    const from = last ? region.top : region.top - 90, to = first ? region.bottom : region.bottom + 90
    return `<div class="map-sea${first ? ' bottom' : ''}${last ? ' top' : ''}" style="top:${from}px;height:${to - from}px;--sea-top:${top};--sea-bottom:${bottom}"></div>`
  }).join('')
  const banners = layout.banners.map((banner) => {
    const style = CHAPTER_STYLE[banner.index % CHAPTER_STYLE.length]
    return `<div class="map-banner" style="top:${banner.y}px;--ribbon:${style.ribbon}"><strong>${banner.name}</strong><small>${t('map.banner', { from: banner.start + 1, to: banner.start + banner.count })}</small></div>`
  }).join('')
  const art = layout.decorations.map((item, i) => `<svg class="map-deco${item.flip ? ' flip' : ''}" style="left:${item.x}px;top:${item.y}px;--sway:${(i % 5) * 0.7}s" aria-hidden="true"><use href="#art-${item.kind}"/></svg>`).join('')
  // The player's marker stands on the newest garden open to play.
  const walked = layout.nodes[Math.max(0, frontier)]
  const nodes = layout.nodes.map(({ level, x, y, chapter }) => {
    const state = done.has(level) ? 'done' : isUnlocked(level) ? 'open' : 'locked'
    const label = t(state === 'done' ? 'map.nodeDone' : state === 'locked' ? 'map.nodeLocked' : 'map.node', { n: level + 1, name: names[level] })
    return `<button class="map-node ${state}${level === frontier ? ' frontier' : ''}" style="left:${x}px;top:${y}px" data-level="${level}" data-chapter="${chapter}" aria-label="${label}"${state === 'locked' ? ' aria-disabled="true"' : ''}><span class="node-top">${state === 'locked' ? '<i data-lucide="lock" aria-hidden="true"></i>' : `<b>${level + 1}</b>`}</span>${state === 'done' ? '<span class="node-badge"><i data-lucide="check" aria-hidden="true"></i></span>' : ''}</button>`
  }).join('')
  return `${regions}<svg class="map-path" width="${layout.width}" height="${layout.height}" viewBox="0 0 ${layout.width} ${layout.height}" aria-hidden="true"><path class="path-shadow" d="${layout.path}"/><path class="path-sand" d="${layout.path}"/><path class="path-dash" d="${layout.path}"/></svg>${art}${banners}${nodes}<div class="map-marker" style="left:${walked.x}px;top:${walked.y}px" aria-hidden="true"><span><i data-lucide="sprout"></i></span></div>`
}
