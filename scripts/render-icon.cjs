const { app, BrowserWindow } = require("electron");
const fs = require("fs");
const path = require("path");

const SIZE = 1024;
const BG = "#0a0c10";
const MINT = "#94efc3";

const PRESETS = {
  bold: { t: 44, w: 122, xh: 180, asc: 262, gap: 34, rise: 58, D: 116, k: 0.72, out: "ledger" },
};
const presetName = process.argv.find((a) => PRESETS[a]) || "bold";
const P = PRESETS[presetName];

const t = P.t;
const c = t / 2;
const w = P.w;
const xh = P.xh;
const asc = P.asc;
const gap = P.gap;
const rise = P.rise;
const pitch = w + gap;

const L = c;
const R = w - c;
const B = -c;
const T = -(xh - c);
const M = (T + B) / 2;
const A = -(asc - c);
const D = P.D;

const glyphs = {
  l: [],
  e: [[[L, M], [R, M], [R, T], [L, T], [L, B]]],
  d: [[[R, A], [R, B]], [[R, T], [L, T], [L, B]]],
  g: [[[L, B], [L, T], [R, T], [R, D], [w / 2 + 4, D]]],
  r: [[[L, B], [L, T], [R, T], [R, T + 30]]],
};

const word = "ledger";

function buildPaths() {
  const lines = [];
  word.split("").forEach((ch, i) => {
    const ox = i * pitch;
    const oy = -i * rise;
    for (const pl of glyphs[ch]) lines.push(pl.map(([x, y]) => [x + ox, y + oy]));
  });

  const stair = [[L, A], [L, B]];
  for (let i = 0; i < word.length - 1; i++) {
    const nx = (i + 1) * pitch + L;
    stair.push([nx, -i * rise + B], [nx, -(i + 1) * rise + B]);
  }
  lines.push(stair);
  return lines;
}

function svg() {
  const lines = buildPaths();
  const minX = 0;
  const maxX = (word.length - 1) * pitch + w;
  const minY = -(word.length - 1) * rise - xh;
  const maxY = 0;
  const k = P.k;
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const d = lines
    .map((pl) => "M" + pl.map(([x, y]) => `${x} ${y}`).join(" L"))
    .join(" ");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">
  <rect x="48" y="48" width="928" height="928" rx="200" fill="${BG}"/>
  <circle cx="512" cy="512" r="404" fill="${MINT}"/>
  <g transform="translate(512 536) scale(${k}) translate(${-cx} ${-cy})">
    <path d="${d}" fill="none" stroke="${BG}" stroke-width="${t}" stroke-linejoin="miter" stroke-linecap="square" stroke-miterlimit="8"/>
  </g>
</svg>`;
}

const outDir = path.join(__dirname, "..", "assets");
const svgText = svg();
fs.writeFileSync(path.join(outDir, `${P.out}.svg`), svgText, "utf8");

app.disableHardwareAcceleration();
app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: SIZE,
    height: SIZE,
    show: false,
    transparent: true,
    frame: false,
    webPreferences: { offscreen: true },
  });
  let frames = 0;
  win.webContents.on("paint", (_e, _dirty, image) => {
    frames += 1;
    if (frames < 3 || image.isEmpty()) return;
    fs.writeFileSync(path.join(outDir, `${P.out}.png`), image.toPNG());
    app.quit();
  });
  win.webContents.setFrameRate(30);
  const html = `<html><body style="margin:0;background:transparent;overflow:hidden">${svgText}</body></html>`;
  await win.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(html));
  win.webContents.invalidate();
});
