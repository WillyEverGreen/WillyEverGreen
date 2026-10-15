import fs from 'fs';
import path from 'path';

async function main() {
  console.log('Fetching live GitHub data for caterpillar grid...');
  const res = await fetch('https://github-contributions-api.jogruber.de/v4/WillyEverGreen?y=last');
  const json = await res.json();
  const rawDays = json.contributions;

  const lastDate = rawDays[rawDays.length - 1]?.date || '2026-10-15';
  const DAY_MS = 86400000;
  const endMs = new Date(lastDate).getTime();
  const countsMap = new Map();
  for (const d of rawDays) countsMap.set(d.date, d.count);

  let startMs = endMs - 364 * DAY_MS;
  startMs -= ((new Date(startMs).getUTCDay() + 7) % 7) * DAY_MS;

  const cells = [];
  for (let ms = startMs, i = 0; ms <= endMs; ms += DAY_MS, i++) {
    const date = new Date(ms).toISOString().slice(0, 10);
    const count = countsMap.get(date) || 0;
    cells.push({ date, count, week: Math.floor(i / 7), day: i % 7 });
  }

  const nz = cells.map(c => c.count).filter(c => c > 0).sort((a, b) => a - b);
  const busy = nz.length ? nz[Math.floor(0.95 * (nz.length - 1))] : 0;
  for (const c of cells) {
    c.level = c.count <= 0 ? 0 : busy <= 0 ? 4 : 1 + Math.min(3, Math.floor((c.count / busy) * 4));
  }

  const CELL_SIZE = 11;
  const GAP = 3;
  const STEP = CELL_SIZE + GAP; // 14
  const PADDING_LEFT = 35;
  const PADDING_TOP = 25;

  const SVG_W = PADDING_LEFT + 53 * STEP + 18; // ~795
  const SVG_H = PADDING_TOP + 7 * STEP + 22;   // ~145

  // Month names and positions
  const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthLabels = [];
  let prevM = -1;
  for (let w = 0; w < 53; w++) {
    const c = cells[w * 7];
    if (!c) break;
    const m = +c.date.slice(5, 7);
    if (m !== prevM) {
      monthLabels.push({ label: MONTH_NAMES[m - 1], week: w });
      prevM = m;
    }
  }

  // Waypoints for caterpillar navigation (grid units: week, day)
  const waypoints = [
    [0, 1], [5, 1], [5, 4], [10, 4], [10, 1], [16, 1],
    [16, 5], [22, 5], [22, 2], [27, 2], [27, 6],
    [33, 6], [33, 3], [38, 3], [38, 0], [43, 0],
    [43, 4], [47, 4], [47, 1], [51, 1], [51, 5],
    [52, 5], [52, 6], [49, 6], [49, 2],
    [41, 2], [41, 5], [31, 5], [31, 1],
    [19, 1], [19, 4], [12, 4], [12, 6],
    [2, 6], [2, 3], [0, 3], [0, 1]
  ];

  const ptX = (w) => (PADDING_LEFT + w * STEP + CELL_SIZE / 2).toFixed(1);
  const ptY = (d) => (PADDING_TOP + d * STEP + CELL_SIZE / 2).toFixed(1);

  let pathD = `M ${ptX(waypoints[0][0])} ${ptY(waypoints[0][1])}`;
  for (let i = 1; i < waypoints.length; i++) {
    pathD += ` L ${ptX(waypoints[i][0])} ${ptY(waypoints[i][1])}`;
  }
  pathD += ' Z';

  function buildCaterpillarSVG(isDark) {
    const bg = isDark ? '#0d1117' : '#ffffff';
    const border = isDark ? '#30363d' : '#d0d7de';
    const textFill = isDark ? '#7d8590' : '#656d76';
    const colors = isDark
      ? ['#161b22', '#0e4429', '#006d32', '#26a641', '#39d353']
      : ['#ebedf0', '#9be9a8', '#40c463', '#30a14e', '#216e39'];

    let gridRects = '';
    cells.forEach((c) => {
      const x = PADDING_LEFT + c.week * STEP;
      const y = PADDING_TOP + c.day * STEP;
      const fill = colors[c.level];
      gridRects += `<rect x="${x}" y="${y}" width="${CELL_SIZE}" height="${CELL_SIZE}" rx="2" fill="${fill}" />\n`;
    });

    let monthsSVG = '';
    for (const m of monthLabels) {
      const mx = PADDING_LEFT + m.week * STEP;
      monthsSVG += `<text x="${mx}" y="${PADDING_TOP - 9}" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" font-size="10" font-weight="600" fill="${textFill}">${m.label}</text>\n`;
    }

    const weekdaysSVG = `
      <text x="${PADDING_LEFT - 8}" y="${PADDING_TOP + 1 * STEP + 9}" text-anchor="end" font-family="-apple-system, sans-serif" font-size="9" fill="${textFill}">Mon</text>
      <text x="${PADDING_LEFT - 8}" y="${PADDING_TOP + 3 * STEP + 9}" text-anchor="end" font-family="-apple-system, sans-serif" font-size="9" fill="${textFill}">Wed</text>
      <text x="${PADDING_LEFT - 8}" y="${PADDING_TOP + 5 * STEP + 9}" text-anchor="end" font-family="-apple-system, sans-serif" font-size="9" fill="${textFill}">Fri</text>
    `;

    const dur = '28s';

    // Caterpillar theme colors (Evergreen / Lime / Forest)
    const headFill = isDark ? '#4ade80' : '#22c55e';
    const headStroke = isDark ? '#22c55e' : '#16a34a';
    const antennaStem = isDark ? '#86efac' : '#15803d';
    const antennaBulb = isDark ? '#facc15' : '#a3e635';
    const cheekFill = isDark ? '#fb7185' : '#f472b6';
    const eyePupil = isDark ? '#0f172a' : '#1e293b';

    const seg1Fill = isDark ? '#34d399' : '#4ade80';
    const seg2Fill = isDark ? '#22c55e' : '#22c55e';
    const seg3Fill = isDark ? '#16a34a' : '#16a34a';
    const seg4Fill = isDark ? '#15803d' : '#15803d';
    const seg5Fill = isDark ? '#166534' : '#166534';
    const seg6Fill = isDark ? '#14532d' : '#14532d';

    const footFill = isDark ? '#14532d' : '#166534';

    return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${SVG_W} ${SVG_H}" width="100%" height="100%">
  <!-- Card Background -->
  <rect x="0" y="0" width="${SVG_W}" height="${SVG_H}" rx="8" fill="${bg}" stroke="${border}" stroke-width="1" />

  <!-- Month & Day Labels -->
  ${monthsSVG}
  ${weekdaysSVG}

  <!-- Contribution Grid Cells -->
  <g id="contribution-grid">
    ${gridRects}
  </g>

  <!-- Caterpillar Crawling Track -->
  <path id="caterpillar-track" d="${pathD}" fill="none" stroke="none" />

  <!-- Animated Caterpillar (Head FIRST, Segments Lagging Behind) -->
  <g id="caterpillar-creature">

    <!-- Segment 6 (Tail) — Lagging behind at begin="0s" -->
    <g>
      <animateMotion dur="${dur}" repeatCount="indefinite" begin="0s" rotate="auto">
        <mpath href="#caterpillar-track" xlink:href="#caterpillar-track" />
      </animateMotion>
      <circle cx="-0.8" cy="-3.6" r="1.1" fill="${footFill}" />
      <circle cx="-0.8" cy="3.6" r="1.1" fill="${footFill}" />
      <circle cx="0" cy="0" r="3.6" fill="${seg6Fill}" stroke="${headStroke}" stroke-width="0.8" />
      <circle cx="0" cy="0" r="1.2" fill="#86efac" opacity="0.8" />
    </g>

    <!-- Segment 5 — Lagging behind at begin="-0.113s" -->
    <g>
      <animateMotion dur="${dur}" repeatCount="indefinite" begin="-0.113s" rotate="auto">
        <mpath href="#caterpillar-track" xlink:href="#caterpillar-track" />
      </animateMotion>
      <circle cx="-1" cy="-4.2" r="1.2" fill="${footFill}" />
      <circle cx="-1" cy="4.2" r="1.2" fill="${footFill}" />
      <circle cx="0" cy="0" r="4.2" fill="${seg5Fill}" stroke="${headStroke}" stroke-width="0.8" />
      <circle cx="0" cy="0" r="1.5" fill="#86efac" opacity="0.85" />
    </g>

    <!-- Segment 4 — begin="-0.226s" -->
    <g>
      <animateMotion dur="${dur}" repeatCount="indefinite" begin="-0.226s" rotate="auto">
        <mpath href="#caterpillar-track" xlink:href="#caterpillar-track" />
      </animateMotion>
      <circle cx="-1" cy="-4.7" r="1.3" fill="${footFill}" />
      <circle cx="-1" cy="4.7" r="1.3" fill="${footFill}" />
      <circle cx="0" cy="0" r="4.8" fill="${seg4Fill}" stroke="${headStroke}" stroke-width="0.9" />
      <circle cx="0" cy="0" r="1.8" fill="#86efac" opacity="0.85" />
    </g>

    <!-- Segment 3 — begin="-0.339s" -->
    <g>
      <animateMotion dur="${dur}" repeatCount="indefinite" begin="-0.339s" rotate="auto">
        <mpath href="#caterpillar-track" xlink:href="#caterpillar-track" />
      </animateMotion>
      <circle cx="-1" cy="-5.2" r="1.4" fill="${footFill}" />
      <circle cx="-1" cy="5.2" r="1.4" fill="${footFill}" />
      <circle cx="0" cy="0" r="5.3" fill="${seg3Fill}" stroke="${headStroke}" stroke-width="0.9" />
      <circle cx="0" cy="0" r="2.1" fill="#86efac" opacity="0.9" />
    </g>

    <!-- Segment 2 — begin="-0.452s" -->
    <g>
      <animateMotion dur="${dur}" repeatCount="indefinite" begin="-0.452s" rotate="auto">
        <mpath href="#caterpillar-track" xlink:href="#caterpillar-track" />
      </animateMotion>
      <circle cx="-1" cy="-5.6" r="1.5" fill="${footFill}" />
      <circle cx="-1" cy="5.6" r="1.5" fill="${footFill}" />
      <circle cx="0" cy="0" r="5.8" fill="${seg2Fill}" stroke="${headStroke}" stroke-width="1.0" />
      <circle cx="0" cy="0" r="2.4" fill="#a7f3d0" opacity="0.9" />
    </g>

    <!-- Segment 1 (Chest) — begin="-0.565s" -->
    <g>
      <animateMotion dur="${dur}" repeatCount="indefinite" begin="-0.565s" rotate="auto">
        <mpath href="#caterpillar-track" xlink:href="#caterpillar-track" />
      </animateMotion>
      <circle cx="-1" cy="-6" r="1.5" fill="${footFill}" />
      <circle cx="-1" cy="6" r="1.5" fill="${footFill}" />
      <circle cx="0" cy="0" r="6.2" fill="${seg1Fill}" stroke="${headStroke}" stroke-width="1.0" />
      <circle cx="0" cy="0" r="2.6" fill="#bbf7d0" opacity="0.95" />
    </g>

    <!-- Caterpillar HEAD — IN THE FRONT at begin="-0.678s" -->
    <g>
      <animateMotion dur="${dur}" repeatCount="indefinite" begin="-0.678s" rotate="auto">
        <mpath href="#caterpillar-track" xlink:href="#caterpillar-track" />
      </animateMotion>

      <!-- Antennae (Pointing forward-left and forward-right) -->
      <path d="M 2 -4 Q 5 -9 8 -8.5" stroke="${antennaStem}" stroke-width="1.3" stroke-linecap="round" fill="none" />
      <circle cx="8" cy="-8.5" r="1.9" fill="${antennaBulb}" stroke="${antennaStem}" stroke-width="0.7" />

      <path d="M 2 4 Q 5 9 8 8.5" stroke="${antennaStem}" stroke-width="1.3" stroke-linecap="round" fill="none" />
      <circle cx="8" cy="8.5" r="1.9" fill="${antennaBulb}" stroke="${antennaStem}" stroke-width="0.7" />

      <!-- Head Orb -->
      <circle cx="0" cy="0" r="6.6" fill="${headFill}" stroke="${headStroke}" stroke-width="1.2" />

      <!-- Cute Blushing Cheeks -->
      <circle cx="0.5" cy="-4.8" r="1.3" fill="${cheekFill}" opacity="0.85" />
      <circle cx="0.5" cy="4.8" r="1.3" fill="${cheekFill}" opacity="0.85" />

      <!-- Big Kawaii Eyes Looking Forward (+X) -->
      <!-- Left Eye -->
      <ellipse cx="2.8" cy="-2.6" rx="2.2" ry="1.9" fill="#ffffff" stroke="${headStroke}" stroke-width="0.5" />
      <circle cx="3.5" cy="-2.6" r="1.2" fill="${eyePupil}" />
      <circle cx="3.9" cy="-3.1" r="0.5" fill="#ffffff" />

      <!-- Right Eye -->
      <ellipse cx="2.8" cy="2.6" rx="2.2" ry="1.9" fill="#ffffff" stroke="${headStroke}" stroke-width="0.5" />
      <circle cx="3.5" cy="2.6" r="1.2" fill="${eyePupil}" />
      <circle cx="3.9" cy="2.1" r="0.5" fill="#ffffff" />

      <!-- Cheerful Smile -->
      <path d="M 4.2 -1 Q 5.6 0 4.2 1" stroke="${antennaStem}" stroke-width="1" stroke-linecap="round" fill="none" />
    </g>

  </g>
</svg>`;
  }

  const outDir = path.resolve('C:/Users/advdi/.gemini/antigravity-ide/scratch/willyevergreen-profile');
  const lightSVG = buildCaterpillarSVG(false);
  const darkSVG = buildCaterpillarSVG(true);

  // Write caterpillar SVGs
  fs.writeFileSync(path.join(outDir, 'github-contribution-grid-caterpillar.svg'), lightSVG, 'utf-8');
  fs.writeFileSync(path.join(outDir, 'github-contribution-grid-caterpillar-dark.svg'), darkSVG, 'utf-8');

  // Also write to snake names for seamless compatibility
  fs.writeFileSync(path.join(outDir, 'github-contribution-grid-snake.svg'), lightSVG, 'utf-8');
  fs.writeFileSync(path.join(outDir, 'github-contribution-grid-snake-dark.svg'), darkSVG, 'utf-8');

  console.log('Successfully generated Caterpillar contribution grids (light & dark)!');
}

main().catch(console.error);
