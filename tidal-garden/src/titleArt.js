// The title screen's illustration: a pastel sky with a smiling sun, drifting clouds, and gulls, and a
// happy little island bobbing on rolling waves, with a straw hut, a lighthouse, a blossom tree, a
// ferry chugging past, and a fish that leaps now and then. Drawn in a 1000×1000 box anchored at the
// bottom: tall screens crop its sides to fill, wide ones fit it whole, with the sky and the sea
// running on well past its edges.

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
  return `<path d="${d}" fill="none" stroke="#ffffff" stroke-width="4" stroke-linecap="round" stroke-dasharray="26 70" opacity=".55" ${extra}/>`
}

const cloud = (scale) => `<g transform="scale(${scale})"><ellipse cx="0" cy="18" rx="92" ry="26" fill="#ffffff"/><circle cx="-38" cy="4" r="32" fill="#ffffff"/><circle cx="10" cy="-12" r="44" fill="#ffffff"/><circle cx="52" cy="6" r="30" fill="#ffffff"/><ellipse cx="0" cy="30" rx="80" ry="12" fill="#e4f3fa"/></g>`

const sparkle = (x, y, size, delay) => `<path class="title-sparkle" style="animation-delay:${delay}s" d="M${x} ${y - size}Q${x + size * 0.18} ${y - size * 0.18} ${x + size} ${y}Q${x + size * 0.18} ${y + size * 0.18} ${x} ${y + size}Q${x - size * 0.18} ${y + size * 0.18} ${x - size} ${y}Q${x - size * 0.18} ${y - size * 0.18} ${x} ${y - size}Z" fill="#ffffff"/>`

const gull = `<path d="M-22 0 Q-11 -12 0 0 Q11 -12 22 0" fill="none" stroke="#2f5d6b" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>`

// A smiling sun with rosy cheeks, peeking in from the top corner on every screen.
const SUN = `<svg class="title-sun-corner" viewBox="640 20 300 300" aria-hidden="true">
  <g class="title-sun">
    <circle cx="790" cy="170" r="150" fill="url(#title-sun-glow)"/>
    <g class="title-rays">${Array.from({ length: 12 }, (_, i) => `<rect x="786" y="62" width="8" height="26" rx="4" fill="#ffd36e" transform="rotate(${i * 30} 790 170)"/>`).join('')}</g>
    <circle cx="790" cy="170" r="66" fill="#ffd56e"/>
    <circle cx="790" cy="170" r="66" fill="none" stroke="#ffc24f" stroke-width="5"/>
    <ellipse cx="768" cy="160" rx="7" ry="9" fill="#5a4038"/><ellipse cx="812" cy="160" rx="7" ry="9" fill="#5a4038"/>
    <circle cx="770" cy="157" r="2.5" fill="#fff"/><circle cx="814" cy="157" r="2.5" fill="#fff"/>
    <path d="M774 184 Q790 198 806 184" fill="none" stroke="#5a4038" stroke-width="5" stroke-linecap="round"/>
    <ellipse cx="752" cy="182" rx="11" ry="7" fill="#ff9d8a" opacity=".7"/><ellipse cx="828" cy="182" rx="11" ry="7" fill="#ff9d8a" opacity=".7"/>
  </g>

</svg>`

export const TITLE_ART = `<svg class="title-art" viewBox="0 0 1000 1000" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
  <defs>
    <linearGradient id="title-sky" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="760">
      <stop offset="0" stop-color="#8fd3f0"/><stop offset=".55" stop-color="#c3eaf2"/><stop offset=".78" stop-color="#ffe6d2"/><stop offset="1" stop-color="#ffd9c4"/>
    </linearGradient>
    <radialGradient id="title-sun-glow"><stop offset="0" stop-color="#fff2b8" stop-opacity=".9"/><stop offset="1" stop-color="#fff2b8" stop-opacity="0"/></radialGradient>
    <radialGradient id="title-lamp-glow"><stop offset="0" stop-color="#fff3b0" stop-opacity=".95"/><stop offset="1" stop-color="#fff3b0" stop-opacity="0"/></radialGradient>
    <linearGradient id="title-grass" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a8e27f"/><stop offset="1" stop-color="#7fca62"/></linearGradient>
    <linearGradient id="title-sand" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f7dfa8"/><stop offset="1" stop-color="#ebc27e"/></linearGradient>
  </defs>
  <rect x="-2400" y="-2400" width="5800" height="3600" fill="url(#title-sky)"/>

  <!-- Clouds drifting by, and gulls flapping across. -->
  <g class="title-cloud" style="--y:120px;--speed:95s;--delay:-20s">${cloud(1)}</g>
  <g class="title-cloud" style="--y:250px;--speed:130s;--delay:-75s">${cloud(0.75)}</g>
  <g class="title-cloud" style="--y:360px;--speed:110s;--delay:-45s;opacity:.85">${cloud(0.55)}</g>
  <g class="title-gull" style="--y:290px;--speed:38s;--delay:-6s"><g class="title-flap">${gull}</g></g>
  <g class="title-gull" style="--y:330px;--speed:44s;--delay:-12s"><g class="title-flap" style="animation-delay:-.3s">${gull}</g></g>

  <!-- The far sea. -->
  <g class="title-wave" style="--speed:26s;--shift:-960px">${wave(690, 10, 240, '#a6e6dc')}</g>

  <!-- A little ferry chugging back and forth behind the island. -->
  <g class="title-ferry">
    <g class="title-ferry-turn">
      <g class="title-bob">
        <circle class="title-puff" cx="16" cy="-62" r="9" fill="#ffffff"/>
        <circle class="title-puff" cx="16" cy="-62" r="9" fill="#ffffff" style="animation-delay:-1.1s"/>
        <path d="M-46 -14 H46 Q42 8 24 10 H-30 Q-44 8 -46 -14Z" fill="#fffaf0"/>
        <rect x="-46" y="-14" width="92" height="7" fill="#f08a7e"/>
        <rect x="-26" y="-38" width="46" height="25" rx="9" fill="#fff3dc"/>
        <circle cx="-14" cy="-26" r="4.5" fill="#6c8e9c"/><circle cx="2" cy="-26" r="4.5" fill="#6c8e9c"/>
        <rect x="-30" y="-42" width="54" height="7" rx="3.5" fill="#f08a7e"/>
        <rect x="10" y="-58" width="12" height="18" rx="3" fill="#f08a7e"/><rect x="10" y="-60" width="12" height="5" rx="2" fill="#4f5d66"/>
      </g>
    </g>
  </g>

  <!-- The happy island, bobbing gently. -->
  <g class="title-island">
    <ellipse cx="500" cy="742" rx="215" ry="20" fill="#3aa3ac" opacity=".45"/>
    <path d="M318 652 Q322 742 500 748 Q678 742 682 652 Z" fill="url(#title-sand)"/>
    <path d="M330 700 Q360 744 500 746 Q640 744 670 700 Q640 736 500 738 Q360 736 330 700Z" fill="#e2b06c" opacity=".55"/>
    <ellipse cx="500" cy="652" rx="182" ry="50" fill="url(#title-grass)"/>
    <ellipse cx="470" cy="638" rx="120" ry="24" fill="#bdeb92" opacity=".55"/>
    <!-- Its face. -->
    <ellipse cx="465" cy="702" rx="8.5" ry="10.5" fill="#4a3a33"/><ellipse cx="535" cy="702" rx="8.5" ry="10.5" fill="#4a3a33"/>
    <circle cx="467.5" cy="698.5" r="3" fill="#fff"/><circle cx="537.5" cy="698.5" r="3" fill="#fff"/>
    <path d="M486 716 Q500 728 514 716" fill="none" stroke="#4a3a33" stroke-width="5" stroke-linecap="round"/>
    <ellipse cx="440" cy="716" rx="14" ry="8" fill="#ff9d8a" opacity=".65"/><ellipse cx="560" cy="716" rx="14" ry="8" fill="#ff9d8a" opacity=".65"/>
    <!-- Flowers in the grass. -->
    ${[[372, 662, '#ff9fb2'], [398, 676, '#fff'], [612, 668, '#ffe07a'], [636, 652, '#ff9fb2'], [520, 680, '#fff'], [452, 678, '#ffe07a'], [560, 688, '#ff9fb2']].map(([x, y, c]) => `<circle cx="${x}" cy="${y}" r="5" fill="${c}"/><circle cx="${x}" cy="${y}" r="1.8" fill="#f3b84a"/>`).join('')}
    <!-- A blossom tree. -->
    <g class="title-sway" style="transform-origin:505px 640px">
      <rect x="499" y="590" width="12" height="52" rx="5" fill="#a8754c"/>
      <circle cx="505" cy="578" r="40" fill="#ffb8c8"/><circle cx="483" cy="566" r="22" fill="#ffd0dc"/><circle cx="530" cy="590" r="24" fill="#ffa7bb"/>
      <circle cx="492" cy="560" r="5" fill="#fff"/><circle cx="526" cy="572" r="4" fill="#fff"/>
    </g>
    <!-- A straw hut, smoke curling from its crown. -->
    <g>
      <circle class="title-smoke" cx="408" cy="550" r="11" fill="#ffffff"/>
      <circle class="title-smoke" cx="408" cy="550" r="11" fill="#ffffff" style="animation-delay:-1.4s"/>
      <circle class="title-smoke" cx="408" cy="550" r="11" fill="#ffffff" style="animation-delay:-2.8s"/>
      <rect x="370" y="604" width="76" height="52" rx="22" fill="#f0d0a3"/>
      <path d="M356 612 L408 548 L460 612 Q408 628 356 612Z" fill="#ecba5c"/>
      <path d="M368 596 Q408 608 448 596 M380 580 Q408 588 436 580" fill="none" stroke="#d29c3f" stroke-width="4" stroke-linecap="round"/>
      <rect x="397" y="624" width="22" height="32" rx="11" fill="#9a6a45"/>
      <circle cx="408" cy="548" r="5" fill="#d29c3f"/>
    </g>
    <!-- A lighthouse, its lamp blinking softly. -->
    <g>
      <circle class="title-lamp-glow" cx="608" cy="512" r="60" fill="url(#title-lamp-glow)"/>
      <path d="M588 650 L594 528 H622 L628 650Z" fill="#fdf8ee"/>
      <path d="M590.5 600 H625.5 L627 622 H589Z M592.5 556 H623.5 L624.6 576 H591.4Z" fill="#e8665a"/>
      <rect x="590" y="508" width="36" height="22" rx="6" fill="#ffe7a3" class="title-lamp"/>
      <rect x="586" y="527" width="44" height="7" rx="3.5" fill="#4f5d66"/>
      <path d="M584 510 L608 486 L632 510Z" fill="#e8665a"/>
      <circle cx="608" cy="484" r="5" fill="#4f5d66"/>
      <rect x="600" y="626" width="16" height="24" rx="8" fill="#6c8e9c"/>
    </g>
  </g>

  <!-- The near sea, with sparkles and a leaping fish. -->
  <g class="title-wave" style="--speed:19s;--shift:-1000px">${wave(745, 12, 200, '#7fd8d2')}${crests(745, 12, 200)}</g>
  <g class="title-fish">
    <g transform="rotate(-20)">
      <ellipse cx="0" cy="0" rx="22" ry="12" fill="#ff9a62"/><path d="M18 0 L36 -12 V12Z" fill="#ff9a62"/>
      <circle cx="-10" cy="-3" r="3.6" fill="#fff"/><circle cx="-10" cy="-3" r="1.8" fill="#2f3a40"/>
      <path d="M-2 -10 Q4 0 -2 10" stroke="#ffd2b0" stroke-width="3" fill="none"/>
    </g>
  </g>
  <g class="title-splash"><ellipse cx="0" cy="0" rx="26" ry="7" fill="none" stroke="#fff" stroke-width="4"/></g>
  <g class="title-wave" style="--speed:14s;--shift:-1040px">${wave(812, 14, 260, '#5cc4c6')}${crests(812, 14, 260, 'style="opacity:.4"')}</g>
  ${sparkle(250, 772, 9, 0)}${sparkle(720, 790, 11, 1.2)}${sparkle(860, 850, 8, 2.1)}${sparkle(160, 870, 10, 0.6)}${sparkle(560, 900, 9, 1.7)}${sparkle(380, 845, 7, 2.6)}
  <g class="title-wave" style="--speed:10s;--shift:-900px">${wave(905, 12, 300, '#45b3b9')}</g>
</svg>
${SUN}
<div class="title-petals" aria-hidden="true">${Array.from({ length: 9 }, (_, i) => `<i style="--x:${(i * 11.3 + 4) % 100}%;--delay:${-i * 2.3}s;--speed:${14 + (i % 4) * 3}s;--drift:${i % 2 ? 60 : -40}px"></i>`).join('')}</div>`

// The logo's letters, each bobbing a moment after the one before.
export const titleLetters = (text) => [...text].map((letter, i) => (letter === ' ' ? '<span class="gap"> </span>' : `<span style="--i:${i}">${letter}</span>`)).join('')
