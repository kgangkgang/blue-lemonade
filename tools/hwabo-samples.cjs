// 화보 틀 견본 사진(SVG) — 세로 832x1216 12장 · 가로 1216x832 2장. 사람 실루엣 + 색 그라데이션, 구석에 「SAMPLE nn」.
// node tools/hwabo-samples.cjs mart/data/sample/hwabo
const fs = require('fs');
const path = require('path');
const out = process.argv[2];
if (!out) throw new Error('내보낼 폴더를 알려 주세요');
fs.mkdirSync(out, { recursive: true });
// [위 색, 아래 색, 해 색, 실루엣 색]
const P = [
  ['#f6d9c4', '#c98b7a', '#fff3e4', '#5b3a3a'],
  ['#cfe3f2', '#7f9fc4', '#f4fbff', '#2d3c57'],
  ['#e6e0f4', '#9b8ac2', '#fbf7ff', '#3d3157'],
  ['#d8efe4', '#79b49b', '#f3fff8', '#26473b'],
  ['#f4e8c8', '#c9a45c', '#fffaf0', '#4f3d1e'],
  ['#2b2f45', '#121421', '#c9d3ff', '#05060c'],
  ['#f3d1d9', '#c77790', '#fff1f5', '#4f2433'],
  ['#dde4e8', '#8a979f', '#ffffff', '#262d33'],
  ['#ffe0b8', '#e08a5a', '#fff4e0', '#5a2c1a'],
  ['#c9ece9', '#5aa9b0', '#effffe', '#173c40'],
  ['#3a2430', '#16101a', '#ffb3c7', '#060407'],
  ['#e9efd6', '#a2b46f', '#fbfff0', '#33401c'],
];
const portrait = (i, [a, b, s, f]) => {
  const n = String(i + 1).padStart(2, '0');
  const sx = [300, 560, 420, 250, 600, 416][i % 6], sy = [330, 280, 360, 300, 380, 260][i % 6];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="832" height="1216" viewBox="0 0 832 1216"><defs><linearGradient id="g" x1="0" y1="0" x2=".3" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient><radialGradient id="s"><stop offset="0" stop-color="${s}" stop-opacity=".95"/><stop offset="1" stop-color="${s}" stop-opacity="0"/></radialGradient></defs><rect width="832" height="1216" fill="url(#g)"/><circle cx="${sx}" cy="${sy}" r="300" fill="url(#s)"/><path d="M0 1010 C200 960 330 1000 470 990 S720 950 832 980 V1216 H0Z" fill="${f}" opacity=".18"/><g fill="${f}" opacity=".88"><circle cx="416" cy="560" r="118"/><path d="M416 690c-170 0-292 96-322 270-12 70-14 160-14 256h672c0-96-2-186-14-256-30-174-152-270-322-270z"/></g><text x="48" y="1170" font-family="ui-monospace,Menlo,Consolas,monospace" font-size="30" letter-spacing="6" fill="#ffffff" opacity=".7">SAMPLE ${n}</text></svg>`;
};
const landscape = (i, [a, b, s, f]) => {
  const n = String(i + 13).padStart(2, '0');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1216" height="832" viewBox="0 0 1216 832"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient><radialGradient id="s"><stop offset="0" stop-color="${s}" stop-opacity=".95"/><stop offset="1" stop-color="${s}" stop-opacity="0"/></radialGradient></defs><rect width="1216" height="832" fill="url(#g)"/><circle cx="${i ? 300 : 900}" cy="260" r="280" fill="url(#s)"/><path d="M0 600 C260 520 420 590 640 560 S980 500 1216 560 V832 H0Z" fill="${f}" opacity=".22"/><g fill="${f}" opacity=".88"><circle cx="${i ? 760 : 470}" cy="430" r="92"/><path d="M${i ? 760 : 470} 532c-136 0-232 76-256 214-8 40-10 60-10 86h532c0-26-2-46-10-86-24-138-120-214-256-214z"/></g><text x="44" y="790" font-family="ui-monospace,Menlo,Consolas,monospace" font-size="28" letter-spacing="6" fill="#ffffff" opacity=".7">SAMPLE ${n}</text></svg>`;
};
P.forEach((c, i) => fs.writeFileSync(path.join(out, `p${String(i + 1).padStart(2, '0')}.svg`), portrait(i, c)));
[P[1], P[8]].forEach((c, i) => fs.writeFileSync(path.join(out, `l${i + 1}.svg`), landscape(i, c)));
console.log('견본 14장 →', out);
