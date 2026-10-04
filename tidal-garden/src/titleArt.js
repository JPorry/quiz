// The title screen's illustration: a soft dawn over a calm sea, with the sun low behind a little
// island (a thatched hut, a lighthouse, and a blossom tree), distant isles on the horizon, a ferry
// crossing behind, gulls and long clouds drifting on the breeze, and a fish that leaps now and then.
// Drawn in a 1000×1000 box anchored at the bottom: tall screens crop its sides to fill, wide ones fit
// it whole, with the sky and the sea running on well past its edges.
//
// The breeze blows left to right: clouds, gulls, smoke, petals, and the waves all go with it.

// A band of sea: a gentle sine wave well past both edges (so it can scroll seamlessly by whole
// wavelengths), closed down to the bottom of the picture.
function wave(y, amplitude, length, fill, extra = '') {
  let d = `M-2200 ${y}`
  for (let x = -2200; x < 3400; x += length) d += ` q${length / 4} ${-amplitude} ${length / 2} 0 t${length / 2} 0`
  return `<path d="${d} V1000 H-2200Z" fill="${fill}" ${extra}/>`
}

function crests(y, amplitude, length, extra = '') {
  let d = `M-2200 ${y}`
  for (let x = -2200; x < 3400; x += length) d += ` q${length / 4} ${-amplitude} ${length / 2} 0 t${length / 2} 0`
  return `<path d="${d}" fill="none" stroke="#ffffff" stroke-width="3" stroke-linecap="round" stroke-dasharray="22 80" opacity=".4" ${extra}/>`
}

// Long, low clouds, like brushstrokes across the dawn.
const cloud = (scale) => `<g transform="scale(${scale})" opacity=".8"><rect x="-120" y="0" width="240" height="22" rx="11" fill="#fffaf3"/><rect x="-70" y="-16" width="130" height="24" rx="12" fill="#fffaf3"/><rect x="-150" y="14" width="150" height="14" rx="7" fill="#fbefe6"/></g>`

const sparkle = (x, y, size, delay) => `<path class="title-sparkle" style="animation-delay:${delay}s" d="M${x} ${y - size}Q${x + size * 0.15} ${y - size * 0.15} ${x + size} ${y}Q${x + size * 0.15} ${y + size * 0.15} ${x} ${y + size}Q${x - size * 0.15} ${y + size * 0.15} ${x - size} ${y}Q${x - size * 0.15} ${y - size * 0.15} ${x} ${y - size}Z" fill="#fffdf6"/>`

const gull = `<path d="M-16 0 Q-8 -9 0 0 Q8 -9 16 0" fill="none" stroke="#56717a" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`

export const TITLE_ART = `<svg class="title-art" viewBox="0 0 1000 1000" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
  <defs>
    <linearGradient id="title-sky" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="700">
      <stop offset="0" stop-color="#b3d5dc"/><stop offset=".5" stop-color="#d9e6e2"/><stop offset=".8" stop-color="#f3e3d2"/><stop offset="1" stop-color="#f4d3bd"/>
    </linearGradient>
    <radialGradient id="title-sun-glow"><stop offset="0" stop-color="#fff1d6" stop-opacity=".95"/><stop offset=".45" stop-color="#fbe2c2" stop-opacity=".5"/><stop offset="1" stop-color="#fbe2c2" stop-opacity="0"/></radialGradient>
    <radialGradient id="title-lamp-glow"><stop offset="0" stop-color="#fff1c4" stop-opacity=".9"/><stop offset="1" stop-color="#fff1c4" stop-opacity="0"/></radialGradient>
    <linearGradient id="title-grass" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b2d494"/><stop offset="1" stop-color="#8dbb78"/></linearGradient>
    <linearGradient id="title-sand" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f1dcb4"/><stop offset="1" stop-color="#e0bf91"/></linearGradient>
  </defs>
  <rect x="-2400" y="-2400" width="5800" height="3600" fill="url(#title-sky)"/>

  <!-- The sun, low in the sky behind the island. -->
  <g class="title-sun">
    <circle class="title-sun-glow" cx="556" cy="492" r="230" fill="url(#title-sun-glow)"/>
    <circle cx="556" cy="492" r="54" fill="#fff0d2"/>
  </g>

  <!-- Clouds and gulls on the breeze. -->
  <g class="title-cloud" style="--y:150px;--speed:120s;--delay:-30s">${cloud(1)}</g>
  <g class="title-cloud" style="--y:290px;--speed:160s;--delay:-95s">${cloud(0.7)}</g>
  <g class="title-cloud" style="--y:410px;--speed:140s;--delay:-60s">${cloud(0.5)}</g>
  <g class="title-gull" style="--y:330px;--speed:46s;--delay:-8s"><g class="title-flap">${gull}</g></g>
  <g class="title-gull" style="--y:362px;--speed:52s;--delay:-14s"><g class="title-flap" style="animation-delay:-.4s">${gull}</g></g>

  <!-- Distant isles and the far sea. -->
  <path d="M-400 692 Q-220 650 -60 676 Q60 660 170 692Z M780 692 Q870 664 960 680 Q1080 650 1400 692Z" fill="#bccfcd"/>
  <g class="title-wave" style="--speed:30s;--shift:960px">${wave(690, 8, 240, '#b4dad4')}</g>

  <!-- A little ferry crossing back and forth behind the island. -->
  <g class="title-ferry">
    <g class="title-ferry-turn">
      <g class="title-bob">
        <circle class="title-puff" cx="-2" cy="-58" r="8" fill="#ffffff"/>
        <circle class="title-puff" cx="-2" cy="-58" r="8" fill="#ffffff" style="animation-delay:-1.1s"/>
        <path d="M-44 -14 H46 Q40 8 22 10 H-30 Q-42 8 -44 -14Z" fill="#fbf6ec"/>
        <rect x="-44" y="-14" width="90" height="6" fill="#d98a7c"/>
        <rect x="-18" y="-36" width="46" height="23" rx="8" fill="#f4ebda"/>
        <circle cx="-4" cy="-25" r="4" fill="#7c97a0"/><circle cx="12" cy="-25" r="4" fill="#7c97a0"/>
        <rect x="-22" y="-40" width="54" height="6" rx="3" fill="#d98a7c"/>
        <rect x="-8" y="-55" width="12" height="17" rx="3" fill="#d98a7c"/><rect x="-8" y="-57" width="12" height="4" rx="2" fill="#56656c"/>
      </g>
    </g>
  </g>

  <!-- The island, bobbing gently. -->
  <g class="title-island">
    <ellipse cx="500" cy="742" rx="215" ry="18" fill="#4f9ea3" opacity=".3"/>
    <path d="M318 652 Q322 742 500 748 Q678 742 682 652 Z" fill="url(#title-sand)"/>
    <path d="M330 700 Q360 744 500 746 Q640 744 670 700 Q640 736 500 738 Q360 736 330 700Z" fill="#d5ac78" opacity=".45"/>
    <path d="M400 704 Q420 700 438 706 M560 712 Q584 706 604 714" fill="none" stroke="#d5b07f" stroke-width="3" stroke-linecap="round" opacity=".7"/>
    <ellipse cx="500" cy="652" rx="182" ry="50" fill="url(#title-grass)"/>
    <ellipse cx="470" cy="638" rx="120" ry="22" fill="#c4e0a6" opacity=".5"/>
    <!-- Flowers in the grass. -->
    ${[[372, 664, '#f4c6cf'], [398, 677, '#fffaf0'], [614, 668, '#f6dc9a'], [636, 654, '#f4c6cf'], [522, 681, '#fffaf0'], [454, 679, '#f6dc9a'], [560, 688, '#f4c6cf']].map(([x, y, c]) => `<circle cx="${x}" cy="${y}" r="4" fill="${c}"/>`).join('')}
    <!-- A blossom tree. -->
    <g class="title-sway" style="transform-origin:505px 640px">
      <rect x="500" y="590" width="10" height="52" rx="5" fill="#9c7458"/>
      <circle cx="505" cy="578" r="40" fill="#f2c4cd"/><circle cx="484" cy="566" r="22" fill="#f7d7dd"/><circle cx="530" cy="590" r="24" fill="#e9b3bf"/>
    </g>
    <!-- A thatched hut, smoke curling from its crown. -->
    <g>
      <circle class="title-smoke" cx="408" cy="550" r="10" fill="#fffaf3"/>
      <circle class="title-smoke" cx="408" cy="550" r="10" fill="#ffffff" style="animation-delay:-1.4s"/>
      <circle class="title-smoke" cx="408" cy="550" r="10" fill="#ffffff" style="animation-delay:-2.8s"/>
      <rect x="370" y="604" width="76" height="52" rx="20" fill="#ecdcc2"/>
      <path d="M356 612 L408 548 L460 612 Q408 626 356 612Z" fill="#dcb072"/>
      <path d="M368 596 Q408 607 448 596 M380 580 Q408 587 436 580" fill="none" stroke="#c49a5b" stroke-width="3" stroke-linecap="round"/>
      <rect x="398" y="626" width="20" height="30" rx="10" fill="#8f6c52"/>
    </g>
    <!-- A lighthouse, its lamp glowing softly. -->
    <g>
      <circle class="title-lamp-glow" cx="608" cy="512" r="56" fill="url(#title-lamp-glow)"/>
      <path d="M588 650 L594 528 H622 L628 650Z" fill="#fbf6ec"/>
      <path d="M590.5 600 H625.5 L627 622 H589Z M592.5 556 H623.5 L624.6 576 H591.4Z" fill="#d9867a"/>
      <rect x="591" y="509" width="34" height="20" rx="6" fill="#ffecbc"/>
      <rect x="586" y="527" width="44" height="6" rx="3" fill="#56656c"/>
      <path d="M585 510 L608 488 L631 510Z" fill="#d9867a"/>
      <rect x="601" y="628" width="14" height="22" rx="7" fill="#7c97a0"/>
    </g>
  </g>

  <!-- The near sea, with a few glints and a leaping fish (its head leads, to the right). -->
  <g class="title-wave" style="--speed:22s;--shift:1000px">${wave(745, 10, 200, '#97d0ca')}${crests(745, 10, 200)}</g>
  <g class="title-fish">
    <ellipse cx="0" cy="0" rx="17" ry="9" fill="#efa587"/><path d="M-14 0 L-28 -9 V9Z" fill="#efa587"/>
    <circle cx="8" cy="-2" r="2" fill="#4a5359"/>
  </g>
  <g class="title-splash"><ellipse cx="0" cy="0" rx="22" ry="6" fill="none" stroke="#fff" stroke-width="3"/></g>
  <g class="title-wave" style="--speed:17s;--shift:1040px">${wave(812, 12, 260, '#7ebfbd')}${crests(812, 12, 260, 'style="opacity:.3"')}</g>
  ${sparkle(250, 772, 6, 0)}${sparkle(720, 792, 8, 1.2)}${sparkle(860, 852, 6, 2.1)}${sparkle(380, 846, 5, 2.6)}
  <g class="title-wave" style="--speed:13s;--shift:900px">${wave(905, 10, 300, '#67abae')}</g>
</svg>
<div class="title-petals" aria-hidden="true">${Array.from({ length: 6 }, (_, i) => `<i style="--x:${(i * 17.3 + 4) % 100}%;--delay:${-i * 3.1}s;--speed:${17 + (i % 3) * 4}s;--drift:${40 + (i % 3) * 30}px"></i>`).join('')}</div>`
