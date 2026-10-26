// 7.9.9 과일의 마음 창 블루레몬에이드 스킨의 글자 대비 계약 — 합성 계산만, DOM · 프리셋 없음.
//  · 창 밤 모드의 포인트 잉크(--salty-accent-ink = 포인트 50% + 흰색)는 내장 팔레트 전부에서 고른 칸 면(포인트 13% 겹침) · 조작부 면 위 4.5 : 1 이상
//  · 실리태번 small { opacity:.7 } 을 창 안에서 끈다(보조 글자색 위에 한 번 더 흐려 4.16 이었다)
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const root = path.resolve(process.argv[2] || '.');
const { PALETTES } = await import(pathToFileURL(path.join(root, 'src/palettes.js')).href);
const text = fs.readFileSync(path.join(root, 'src/scripts/bundled/fruit-style.js'), 'utf8');
const bundled = JSON.parse(text.slice(text.indexOf('export default ') + 15).trim().replace(/;$/, ''));
const marker = 'installFruitStyle(BlueLemonade, ';
const css = JSON.parse(bundled.slice(bundled.lastIndexOf(marker) + marker.length).trim().replace(/\);$/, ''));
let count = 0; const test = (name, fn) => { fn(); console.log('PASS', name); count++; };
const WINDOW = ':is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6)';

const hex = h => { const m = h.replace('#', ''); const s = m.length === 3 ? [...m].map(c => c + c).join('') : m; return [0, 2, 4].map(i => parseInt(s.slice(i, i + 2), 16)); };
const mix = (a, b, p) => a.map((v, i) => Math.round(v * p + b[i] * (1 - p)));   // color-mix(in srgb, a p%, b)
const lum = c => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return .2126 * f(c[0]) + .7152 * f(c[1]) + .0722 * f(c[2]); };
const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };

test('창 밤 모드 포인트 잉크는 포인트 50% + 흰색이에요', () => {
    const night = css.split('}').find(rule => rule.includes('[data-bl-fruit-skin="lemonade"][data-theme="night"]'));
    assert.ok(night, '밤 블록');
    assert.match(night, /--salty-accent-ink:color-mix\(in srgb,var\(--salty-accent\) 50%,#fff\)/);
});
test('내장 팔레트 전부: 밤 모드 포인트 잉크가 고른 칸 면 · 조작부 면 위 4.5 : 1 이상이에요', () => {
    const control0 = hex('#303641'), white = [255, 255, 255];
    for (const [id, pal] of Object.entries(PALETTES)) {
        const accent = hex(pal.accent);
        const control = mix(accent, control0, 0.05), soft = mix(accent, control, 0.13), ink = mix(accent, white, 0.5);
        for (const [name, bg] of [['고른 칸', soft], ['조작부', control]]) {
            const ratio = contrast(ink, bg);
            assert.ok(ratio >= 4.5, `${id} ${pal.accent} ${name} 위 ${ratio.toFixed(2)}`);
        }
    }
});
test('창 안 small 은 실리태번의 opacity .7 을 따르지 않아요', () => {
    const rule = css.replace(/\/\*[\s\S]*?\*\//g, '').split('}').map(r => r.trim()).find(r => r.startsWith(WINDOW + ' small {'));   // 주석 안의 중괄호에 안 끊기게 주석을 먼저 뗀다
    assert.ok(rule, 'small 규칙');
    assert.match(rule, /opacity:1/);
});
console.log(`fruit-skin-contrast: ${count} passed`);
