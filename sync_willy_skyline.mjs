import fs from 'fs';
import path from 'path';

async function main() {
  console.log('Fetching live GitHub contributions for WillyEverGreen...');
  const res = await fetch('https://github-contributions-api.jogruber.de/v4/WillyEverGreen?y=last');
  const json = await res.json();
  const rawDays = json.contributions;

  let total = 0;
  let best = { count: 0, date: '' };
  let currentStreak = 0;
  let longestStreak = 0;
  let tempStreak = 0;
  let longestStart = '';
  let longestEnd = '';
  let tempStart = '';

  for (const c of rawDays) {
    total += c.count;
    if (c.count > best.count) {
      best = { count: c.count, date: c.date };
    }
    if (c.count > 0) {
      if (tempStreak === 0) tempStart = c.date;
      tempStreak++;
      if (tempStreak > longestStreak) {
        longestStreak = tempStreak;
        longestStart = tempStart;
        longestEnd = c.date;
      }
    } else {
      tempStreak = 0;
    }
  }

  for (let i = rawDays.length - 1; i >= 0; i--) {
    if (rawDays[i].count > 0) currentStreak++;
    else if (currentStreak > 0) break;
  }

  const avgPerDay = (total / Math.max(1, rawDays.length)).toFixed(2);
  const firstDate = rawDays[0]?.date || '';
  const lastDate = rawDays[rawDays.length - 1]?.date || '';

  const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function fmtDate(dStr) {
    if (!dStr) return '';
    const d = new Date(dStr);
    return `${MONTH_NAMES[d.getUTCMonth()]} ${d.getUTCDate()}`;
  }

  // Build 52-week grid ending on lastDate
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

  // Month labels generator
  const monthLabels = [];
  let prevMonth = -1;
  for (let w = 0; w < 52; w++) {
    const c = cells[w * 7];
    if (!c) break;
    const m = +c.date.slice(5, 7);
    if (m !== prevMonth) {
      monthLabels.push({ week: w, label: MONTH_NAMES[m - 1] });
      prevMonth = m;
    }
  }
  if (monthLabels.length > 1 && monthLabels[1].week - monthLabels[0].week < 3) {
    monthLabels.shift();
  }

  // Palette (Clean GitHub White Theme)
  const PALETTE = {
    bg: '#ffffff',
    border: '#d0d7de',
    cardBg: '#ffffff',
    cardBorder: '#d0d7de',
    textPrimary: '#1f2328',
    textSecondary: '#656d76',
    accentGreen: '#1a7f37',
    levels: [
      { top: '#ebedf0', left: '#d0d7de', right: '#afb8c1', stroke: '#d0d7de' },
      { top: '#9be9a8', left: '#7bc96f', right: '#57a84e', stroke: '#7bc96f' },
      { top: '#40c463', left: '#30a14e', right: '#238636', stroke: '#30a14e' },
      { top: '#30a14e', left: '#238636', right: '#196c2e', stroke: '#238636' },
      { top: '#216e39', left: '#196127', right: '#11441a', stroke: '#196127' }
    ]
  };

  const SVG_W = 900;
  const SVG_H = 580;

  // 1. GENERATE 3D SKYLINE WITH MONTHS ON OPPOSITE (FRONT) SIDE
  const YAW = Math.PI / 4;
  const ELEV = (34 * Math.PI) / 180;
  const cs = Math.cos(YAW);
  const sn = Math.sin(YAW);
  const se = Math.sin(ELEV);
  const ce = Math.cos(ELEV);

  const scale = 14.2;
  const ox = 150;
  const oy = 210;

  const px = (x, y) => ox + (x * cs - y * sn) * scale;
  const py = (x, y, z) => oy + ((x * sn + y * cs) * se - z * ce) * scale;

  const sorted = [...cells].sort((a, b) => {
    const da = (a.week + 0.5) * sn + (a.day + 0.5) * cs;
    const db = (b.week + 0.5) * sn + (b.day + 0.5) * cs;
    return da - db;
  });

  const w = 0.82;
  let bars3DSVG = '';

  for (const c of sorted) {
    const maxH = best.count || 1;
    const h = c.count > 0 ? 0.4 + Math.pow(c.count / maxH, 0.85) * 7.2 : 0.2;
    const pal = PALETTE.levels[c.level];

    const x0 = c.week;
    const y0 = c.day;
    const x1 = x0 + w;
    const y1 = y0 + w;

    const p00 = [px(x0, y0), py(x0, y0, h)];
    const p10 = [px(x1, y0), py(x1, y0, h)];
    const p11 = [px(x1, y1), py(x1, y1, h)];
    const p01 = [px(x0, y1), py(x0, y1, h)];

    const b01 = [px(x0, y1), py(x0, y1, 0)];
    const b11 = [px(x1, y1), py(x1, y1, 0)];
    const b10 = [px(x1, y0), py(x1, y0, 0)];

    let sides = '';
    if (h > 0.25) {
      sides += `<polygon points="${p01[0].toFixed(1)},${p01[1].toFixed(1)} ${p11[0].toFixed(1)},${p11[1].toFixed(1)} ${b11[0].toFixed(1)},${b11[1].toFixed(1)} ${b01[0].toFixed(1)},${b01[1].toFixed(1)}" fill="${pal.left}" />`;
      sides += `<polygon points="${p10[0].toFixed(1)},${p10[1].toFixed(1)} ${p11[0].toFixed(1)},${p11[1].toFixed(1)} ${b11[0].toFixed(1)},${b11[1].toFixed(1)} ${b10[0].toFixed(1)},${b10[1].toFixed(1)}" fill="${pal.right}" />`;
    }

    const top = `<polygon points="${p00[0].toFixed(1)},${p00[1].toFixed(1)} ${p10[0].toFixed(1)},${p10[1].toFixed(1)} ${p11[0].toFixed(1)},${p11[1].toFixed(1)} ${p01[0].toFixed(1)},${p01[1].toFixed(1)}" fill="${pal.top}" stroke="${pal.stroke}" stroke-width="0.35" />`;

    bars3DSVG += `${sides}${top}\n`;
  }

  // Month Labels on the OPPOSITE (FRONT) SIDE of 3D Ribbon: day = 7.4
  let months3DSVG = '';
  for (const m of monthLabels) {
    const mx = px(m.week + 0.5, 7.4);
    const my = py(m.week + 0.5, 7.4, 0) + 14;
    months3DSVG += `<text x="${mx.toFixed(1)}" y="${my.toFixed(1)}" font-family="-apple-system, sans-serif" font-size="11" font-weight="600" fill="#656d76" text-anchor="middle">${m.label}</text>\n`;
  }

  // 2. GENERATE 2D FLAT HEATMAP WITH MONTH LABELS & WEEKDAYS
  const scale2D = 12.8;
  const ox2D = 120;
  const oy2D = 230;

  let cells2DSVG = '';
  for (const c of cells) {
    const cx = ox2D + c.week * scale2D;
    const cy = oy2D + c.day * scale2D;
    const pal = PALETTE.levels[c.level];
    cells2DSVG += `<rect x="${cx.toFixed(1)}" y="${cy.toFixed(1)}" width="10.8" height="10.8" rx="2" fill="${pal.top}" stroke="${pal.stroke}" stroke-width="0.5" />\n`;
  }

  // 2D Month Labels along top
  let months2DSVG = '';
  for (const m of monthLabels) {
    const mx = ox2D + m.week * scale2D;
    months2DSVG += `<text x="${mx.toFixed(1)}" y="${(oy2D - 8)}" font-family="-apple-system, sans-serif" font-size="11" font-weight="600" fill="#656d76">${m.label}</text>\n`;
  }

  // 2D Weekday labels along left
  const weekdays2DSVG = `
    <text x="${(ox2D - 8)}" y="${(oy2D + 1 * scale2D + 9)}" text-anchor="end" font-family="-apple-system, sans-serif" font-size="10" fill="#656d76">Mon</text>
    <text x="${(ox2D - 8)}" y="${(oy2D + 3 * scale2D + 9)}" text-anchor="end" font-family="-apple-system, sans-serif" font-size="10" fill="#656d76">Wed</text>
    <text x="${(ox2D - 8)}" y="${(oy2D + 5 * scale2D + 9)}" text-anchor="end" font-family="-apple-system, sans-serif" font-size="10" fill="#656d76">Fri</text>
  `;

  function buildSVG(is3D) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SVG_W} ${SVG_H}" width="100%" height="100%">
  <defs>
    <filter id="card-shadow" x="-4%" y="-4%" width="108%" height="110%">
      <feDropShadow dx="0" dy="2" stdDeviation="4" flood-color="#000000" flood-opacity="0.06" />
    </filter>
  </defs>

  <style>
    .font-title { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 17px; font-weight: 500; fill: #1f2328; }
    .font-title-bold { font-weight: 700; }
    .card-heading { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 14px; font-weight: 600; fill: #1f2328; }
    .big-num { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 28px; font-weight: 700; fill: #1a7f37; font-feature-settings: 'tnum'; }
    .big-unit { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 15px; font-weight: 500; fill: #1f2328; }
    .label-txt { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 13px; font-weight: 600; fill: #1f2328; }
    .sub-txt { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 12px; fill: #656d76; }
    .legend-lbl { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 12px; fill: #656d76; }
  </style>

  <!-- PURE WHITE Background -->
  <rect x="0" y="0" width="${SVG_W}" height="${SVG_H}" rx="12" fill="#ffffff" stroke="#d0d7de" stroke-width="1" />

  <!-- TOP BAR: Left Title & Right View Toggle -->
  <g transform="translate(32, 34)">
    <text x="0" y="0" class="font-title"><tspan class="font-title-bold">${total.toLocaleString()}</tspan> contributions in the last year</text>
  </g>

  <!-- Top Right Status Badge -->
  <g transform="translate(${SVG_W - 122}, 20)">
    <rect x="0" y="0" width="90" height="26" rx="6" fill="#f6f8fa" stroke="#d0d7de" stroke-width="1" />
    <circle cx="15" cy="13" r="3.5" fill="#1a7f37" />
    <text x="26" y="17" font-family="-apple-system, sans-serif" font-size="11" font-weight="600" fill="#1f2328">3D Skyline</text>
  </g>

  <!-- CHART CONTENT -->
  ${is3D ? `
  <g id="skyline-bars">${bars3DSVG}</g>
  <g id="skyline-months">${months3DSVG}</g>
  ` : `
  <g id="heatmap-cells">${cells2DSVG}</g>
  <g id="heatmap-months">${months2DSVG}</g>
  <g id="heatmap-weekdays">${weekdays2DSVG}</g>
  `}

  <!-- UPPER RIGHT: "Contributions" Card -->
  <g transform="translate(${SVG_W - 270}, 80)">
    <text x="0" y="0" class="card-heading">Contributions</text>
    <g transform="translate(0, 10)">
      <rect x="0" y="0" width="238" height="84" rx="10" fill="#ffffff" stroke="#d0d7de" stroke-width="1" filter="url(#card-shadow)" />
      <g transform="translate(18, 16)">
        <text x="0" y="22" class="big-num">${total.toLocaleString()}</text>
        <text x="0" y="42" class="label-txt">Total</text>
        <text x="0" y="58" class="sub-txt">${fmtDate(firstDate)} → ${fmtDate(lastDate)}</text>
      </g>
      <g transform="translate(136, 16)">
        <text x="0" y="22" class="big-num">${best.count}</text>
        <text x="0" y="42" class="label-txt">Best day</text>
        <text x="0" y="58" class="sub-txt">${fmtDate(best.date)}</text>
      </g>
    </g>
    <text x="238" y="112" text-anchor="end" class="sub-txt">Average: <tspan font-weight="600" fill="#1a7f37">${avgPerDay}</tspan> / day</text>
  </g>

  <!-- LOWER LEFT: "Streaks" Card -->
  <g transform="translate(32, ${SVG_H - 180})">
    <text x="0" y="0" class="card-heading">Streaks</text>
    <g transform="translate(0, 10)">
      <rect x="0" y="0" width="254" height="84" rx="10" fill="#ffffff" stroke="#d0d7de" stroke-width="1" filter="url(#card-shadow)" />
      <g transform="translate(18, 16)">
        <text x="0" y="22"><tspan class="big-num">${longestStreak}</tspan> <tspan class="big-unit">days</tspan></text>
        <text x="0" y="42" class="label-txt">Longest</text>
        <text x="0" y="58" class="sub-txt">${fmtDate(longestStart)} → ${fmtDate(longestEnd)}</text>
      </g>
      <g transform="translate(136, 16)">
        <text x="0" y="22"><tspan class="big-num">${currentStreak}</tspan> <tspan class="big-unit">days</tspan></text>
        <text x="0" y="42" class="label-txt">Current</text>
        <text x="0" y="58" class="sub-txt">${currentStreak > 0 ? fmtDate(cells[cells.length - currentStreak]?.date) + ' → Today' : 'None'}</text>
      </g>
    </g>
  </g>

  <!-- BOTTOM FOOTER: Legend on Right ONLY (No 'Learn how we count' link) -->
  <g transform="translate(32, ${SVG_H - 26})">
    <g transform="translate(${SVG_W - 200}, -10)">
      <text x="0" y="10" class="legend-lbl">Less</text>
      <rect x="32" y="0" width="11" height="11" rx="2" fill="#ebedf0" stroke="#d0d7de" stroke-width="0.5" />
      <rect x="47" y="0" width="11" height="11" rx="2" fill="#9be9a8" stroke="#7bc96f" stroke-width="0.5" />
      <rect x="62" y="0" width="11" height="11" rx="2" fill="#40c463" stroke="#30a14e" stroke-width="0.5" />
      <rect x="77" y="0" width="11" height="11" rx="2" fill="#30a14e" stroke="#238636" stroke-width="0.5" />
      <rect x="92" y="0" width="11" height="11" rx="2" fill="#216e39" stroke="#196127" stroke-width="0.5" />
      <text x="110" y="10" class="legend-lbl">More</text>
    </g>
  </g>
</svg>`;
  }

  const outDir = path.resolve('C:/Users/advdi/.gemini/antigravity-ide/scratch/willyevergreen-profile');

  const svg3D = buildSVG(true);
  const svg2D = buildSVG(false);

  fs.writeFileSync(path.join(outDir, 'skyline-willyevergreen-3d.svg'), svg3D, 'utf-8');
  fs.writeFileSync(path.join(outDir, 'skyline-willyevergreen-2d.svg'), svg2D, 'utf-8');
  fs.writeFileSync(path.join(outDir, 'skyline-willyevergreen.svg'), svg3D, 'utf-8');
  fs.writeFileSync(path.join(outDir, 'skyline-github-light.svg'), svg3D, 'utf-8');
  fs.writeFileSync(path.join(outDir, 'skyline-github-dark.svg'), svg3D, 'utf-8');

  console.log('Successfully generated 3D SVG with months on opposite front side & 2D SVG!');
}

main().catch(console.error);
