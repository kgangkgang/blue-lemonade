// 7.3.1 (북마크 1.7.1) — 그림만 격자를 읽는 차례대로: 왼쪽 → 오른쪽, 위 → 아래로 읽은 차례가 정렬 차례(처음부터 · 최근부터)와 같다.
//   1.7.0 의 CSS columns 는 세로 먼저 차서 #3 #14 / #7 #15 / #13 처럼 보였다 (사용자 폰 화면). 비율은 그대로 · lazy · 2:3 자리 · 크게 보기 넘기는 차례 유지.
//   node tools/tests/bookmark-masonry-731.mjs [테마 뿌리, 기본 .]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const { tileColumns, placeTiles, readingOrder } = await import(pathToFileURL(path.join(root, 'src/addons/bookmarks/tile-masonry.js')));
let pass = 0, fail = 0;
async function test(name, fn) {
    try { await fn(); pass++; console.log('  ok  ' + name); }
    catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + String(e.stack || e.message || e).split('\n').slice(0, 6).join('\n       ')); }
}

// 사용자 화면과 같은 꼴: 메시지 번호 3 · 7 · 13 · 14 · 15 … 에 붙은 그림, 비율은 세로 · 가로 · 정사각 · 아주 긴 그림이 섞임
const RATIOS = [1.5, 0.66, 1, 1.78, 1.33, 0.56, 1.5, 2.4, 0.75, 1, 1.5, 1.25, 0.6, 1.5, 3, 1.1, 0.8, 1.5, 1.4, 0.7];
const INDEX = [3, 7, 13, 14, 15, 18, 22, 25, 31, 33, 40, 41, 47, 52, 58, 60, 66, 71, 72, 80];
// 칸 높이 = 그림(줄 너비 × 비율, 받기 전엔 2:3) + 테두리 2px
const layout = (width, wide, ratios) => {
    const columns = tileColumns(width, wide), gap = wide ? 12 : 10;
    const colWidth = (width - gap * (columns - 1)) / columns;
    return { columns, colWidth, ...placeTiles(ratios.map(r => Math.round(colWidth * r) + 2), columns, colWidth, gap) };
};

await test('줄 수: 폰 375 = 2줄, 좁은 폰 280 = 1줄, PC 1440 창 = 4줄 (1.7.0 CSS columns 와 같은 규칙)', () => {
    assert.equal(tileColumns(375 - 32, false), 2);
    assert.equal(tileColumns(140, false), 1);
    assert.equal(tileColumns(1100, true), 4);
    assert.equal(tileColumns(500, true), 2);
    assert.equal(tileColumns(0, false), 1);
});

await test('사용자 화면: 「처음부터」 #3 #7 #13 #14 #15 → 첫 줄 #3 #7, 그다음 #13 … (예전: 왼쪽 줄 3 · 7 · 13, 오른쪽 14 · 15)', () => {
    const { places } = layout(343, false, RATIOS.slice(0, 5));
    assert.deepEqual(places.slice(0, 2).map(p => [p.col, p.top]), [[0, 0], [1, 0]], 'the first two sit side by side at the top');
    assert.deepEqual(readingOrder(places), [0, 1, 2, 3, 4]);
});

for (const [width, wide, label] of [[343, false, '375 폰'], [1100, true, '1440 PC']]) {
    for (const [sort, list] of [['처음부터', INDEX.map((index, i) => ({ index, ratio: RATIOS[i] }))], ['최근부터', INDEX.map((index, i) => ({ index, ratio: RATIOS[i] })).reverse()]]) {
        await test(`${label} · ${sort}: 섞인 비율 20장 — 위 → 아래, 왼쪽 → 오른쪽으로 읽은 차례 = 정렬 차례`, () => {
            const { places, columns } = layout(width, wide, list.map(x => x.ratio));
            assert.equal(columns, wide ? 4 : 2);
            const order = readingOrder(places).map(i => list[i].index);
            assert.deepEqual(order, list.map(x => x.index));
            // 놓이는 높이는 차례가 갈수록 내려가기만 한다 (같은 높이면 오른쪽으로)
            for (let i = 1; i < places.length; i++) assert.ok(places[i].top > places[i - 1].top || (places[i].top === places[i - 1].top && places[i].left > places[i - 1].left), `tile ${i}`);
            // 줄끼리 겹치지 않음
            for (let c = 0; c < columns; c++) {
                const col = places.map((p, i) => ({ ...p, h: Math.round(((width - (wide ? 12 : 10) * (columns - 1)) / columns) * list[i].ratio) + 2 })).filter(p => p.col === c);
                for (let k = 1; k < col.length; k++) assert.ok(col[k].top >= col[k - 1].top + col[k - 1].h, 'no overlap');
            }
        });
    }
}

await test('받기 전 자리(모두 2:3)도 같은 규칙 — 행 먼저 · 줄 높이가 고르게', () => {
    const { places } = layout(343, false, new Array(7).fill(1.5));
    assert.deepEqual(places.map(p => p.col), [0, 1, 0, 1, 0, 1, 0]);
    assert.deepEqual(readingOrder(places), [0, 1, 2, 3, 4, 5, 6]);
});

await test('연결: panel.js 가 격자를 그린 뒤 놓고, 그림이 실리면 다시 놓는다 · 넘기는 차례는 view.tiles 그대로 · lazy · 2:3 자리 유지 · CSS columns 없음', () => {
    const panel = read('src/addons/bookmarks/panel.js');
    assert.match(panel, /import \{ tileLayouter \} from '\.\/tile-masonry\.js';/);
    assert.match(panel, /markLoadedImages\(list\);\n\s*tileLayout\.observe\(list\.querySelector\('\.cg-tiles'\)\);/);
    assert.match(panel, /root\.addEventListener\('load', event => \{ if \(event\.target\?\.closest\?\.\('\.cg-tile'\)\) tileLayout\.schedule\(\); \}, true\);/);
    assert.match(panel, /openImageViewer\(view\.tiles\.map\(tile => \(\{ src: tile\.image\.src, prompt: tile\.image\.prompt, label: tileLabel\(record, tile\) \}\)\), at\);/);
    assert.match(panel, /data-tile-open="\$\{at\}"[^`]*<img src="\$\{escapeHtml\(src\)\}" alt="" loading="lazy" decoding="async">/);
    const css = read('src/addons/bookmarks/style.css');
    const block = css.slice(css.indexOf('/* ── 7.2.7 (1.7.0) 그림만'), css.indexOf('/* ── 7.2.7 (1.7.0) 그림 크게 보기')).replace(/\/\*[\s\S]*?\*\//g, '');
    assert.ok(!/(?:^|[\s;{])columns\s*:/.test(block) && !/break-inside/.test(block), 'no CSS columns');
    assert.match(block, /\.cg-root \.cg-tile-open img \{[^}]*width: 100%; height: auto; aspect-ratio: auto 2 \/ 3;/);
    assert.match(block, /\.cg-root \.cg-tiles\.is-masonry > \.cg-tile \{ position: absolute; \}/);
    assert.match(read('src/addons/bookmarks/state.js'), /export const VERSION = '1\.7\.4';/);
    assert.match(css, /--cg-css-version: "1\.7\.4";/);
    assert.match(read('.github/workflows/release-check.yml'), /node tools\/tests\/bookmark-masonry-731\.mjs \./);
});

console.log(`bookmark-masonry-731: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
