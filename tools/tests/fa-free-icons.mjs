// 7.0.3 테마가 쓰는 Font Awesome 아이콘 이름이 실리태번이 싣는 Free 6.5.2 에 다 있는지 — Pro 전용 이름(예: 북마크의 그림-빗금)은 빈 네모로 보였다.
//   목록 = tools/fa-free-6.5.2.txt (실리태번 public/css/fontawesome.min.css 의 .fa-* 이름). 실리태번이 Font Awesome 판을 올리면 목록도 다시 뽑는다.
//   글 속에 그대로 적힌 이름만 본다(`fa-${x}` 처럼 만들어 붙이는 이름은 못 봄). node tools/tests/fa-free-icons.mjs <테마 루트>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.argv[2] || '.');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const free = new Set(read('tools/fa-free-6.5.2.txt').split('\n').map(s => s.trim()).filter(s => s && !s.startsWith('#')));
// 모양 · 크기 · 움직임 이름(아이콘이 아님) — 목록에 없어도 된다
const MODIFIERS = new Set(['solid', 'regular', 'brands', 'light', 'thin', 'duotone', 'sharp', 'classic', 'fw', 'lg', 'xs', 'sm', 'xl', 'spin', 'pulse', 'stack', 'inverse', 'border']);
const SKIP_DIRS = new Set(['vendor', 'sfx', 'sfx-extra', 'scene-music', 'node_modules']);
const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? (SKIP_DIRS.has(e.name) ? [] : walk(path.join(dir, e.name))) : [path.join(dir, e.name)]);
let n = 0;
const t = (name, fn) => { fn(); n++; console.log(`  PASS  ${name}`); };

t('목록: Free 6.5.2 의 이름이 들어 있고 Pro 전용 그림-빗금은 없다', () => {
    assert.ok(free.size > 1500, `목록이 너무 짧음 ${free.size}`);
    for (const name of ['link-slash', 'image', 'xmark', 'ban', 'circle-exclamation']) assert.ok(free.has(name), name);
    assert.ok(!free.has('image-slash'));
});

t('테마 src · css · index.js 의 fa-* 이름이 모두 Free 에 있다', () => {
    const files = [...walk(path.join(root, 'src')), ...walk(path.join(root, 'css')), path.join(root, 'index.js')]
        .filter(f => /\.(js|mjs|css|html)$/.test(f) && !/build-info\.js$/.test(f));
    const missing = [];
    for (const file of files) {
        const text = fs.readFileSync(file, 'utf8');
        for (const m of text.matchAll(/(?<![\w-])fa-([a-z0-9]+(?:-[a-z0-9]+)*)(?![\w-])/g)) {
            if (MODIFIERS.has(m[1]) || free.has(m[1])) continue;
            missing.push(`${path.relative(root, file).replaceAll('\\', '/')}:${text.slice(0, m.index).split('\n').length} fa-${m[1]}`);
        }
    }
    assert.deepEqual(missing, [], 'Free 에 없는 아이콘(빈 네모로 보임)');
});

t('북마크 1.6.0~: 주소가 잘못된 그림 자리표는 link-slash · 판 JS = CSS · CI', () => {
    const render = read('src/addons/bookmarks/render.js');
    assert.match(render, /aria-label="주소가 잘못된 그림"><i class="fa-solid fa-link-slash" aria-hidden="true"><\/i>/);
    assert.match(read('src/addons/bookmarks/state.js'), /export const VERSION = '1\.7\.5';/);   // 7.2.7 · 7.3.1 그림만 격자
    assert.match(read('src/addons/bookmarks/style.css'), /--cg-css-version: "1\.7\.5";/);
    assert.match(read('.github/workflows/release-check.yml'), /node tools\/tests\/fa-free-icons\.mjs \./);
});

console.log(`fa-free-icons: ${n} passed, 0 failed`);
