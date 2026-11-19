// 1.9.0 미트볼 변화 그래프 범례 — 점선인 사람의 색 점은 점선 테두리 동그라미 (사용자 11-19 「걍 점선 프로필이 낫지 않냐」)
//   그 확장(2.9.1 부터 스스로 그리는 그래프)은 점선인 사람의 범례 점에만 줄무늬 그림을 인라인으로 붙여요. 테마는 그 꼴은 두고 꾸밈만 바꿔요(src/ext-status.css).
//   ① 규칙이 점선인 사람의 점만 골라요(실선인 사람 · 다른 요소는 안 건드려요)
//   ② 줄무늬를 걷고(인라인을 이기게 !important) 그 사람 색은 그대로 둬요(색을 새로 정하지 않아요)
//   ③ 고리 가림(mask): 안은 비고 · 점선은 세 마디 이상 · 마디 길이가 둘레에 딱 맞아요(이음매에서 긴 마디 · 붙은 마디가 안 생겨요) · 선의 6 : 4 비
//   ④ 작은 크기(14 ~ 18px)이고 자리는 그 확장 점 10px 그대로(줄 높이 · 글 자리가 안 밀려요)
//   ⑤ 원작에 맡긴 동안에도 살아 있어요(「변화 그래프 다시 그리기」 묶음 밖) · 생성 시트에도 들어 있어요
//   node tools/tests/mb-trend-legend-dash.mjs [저장소 뿌리]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(process.argv[2] || path.join(path.dirname(fileURLToPath(import.meta.url)), '../..'));
let n = 0; const ok = (name, fn) => { fn(); n++; console.log('ok', name); };
const css = fs.readFileSync(path.join(root, 'src/ext-status.css'), 'utf8').replace(/\r\n/g, '\n');
const MARK = 'i:is([style*="repeating-linear-gradient"], [data-bl-dash])';   // 원작이 붙인 줄무늬 · 테마가 인물 색을 입히며 다시 가린 점선 표식
const at = css.indexOf(MARK);
assert.ok(at > 0, '범례 점선 규칙이 있어요');
const start = css.lastIndexOf('\n', at) + 1, open = css.indexOf('{', at), close = css.indexOf('}', open);
const selector = css.slice(start, open).trim(), body = css.slice(open + 1, close);
const prop = name => { const m = new RegExp(`(?:^|[;\\s])${name}\\s*:\\s*([^;]+);`).exec(body); return m ? m[1].trim() : ''; };
const svg = decodeURIComponent((/url\("data:image\/svg\+xml,([^"]+)"\)/.exec(body) || [])[1] || '');
const attr = name => (new RegExp(`\\b${name}='([^']*)'`).exec(svg) || [])[1] ?? '';

ok('① 점선인 사람의 범례 점만 골라요', () => {
    assert.equal(css.split(MARK).length - 1, 1, '규칙은 한 곳');
    assert.ok(selector.endsWith('.ss-trend-legend > span > ' + MARK));
    assert.match(selector, /^body\.salty:not\(\[data-bl-ext-raw\]\) /, '맞춤을 끈 화면(원작 그대로)은 안 건드려요');
    // 그 확장이 붙이는 꼴을 지어낸 글로 흉내: 점선인 사람만 줄무늬 그림이 있어요
    const dashed = 'background:hsl(140 62% 48%);background-image:repeating-linear-gradient(90deg,transparent 0 3px,#fff 3px 5px)', solid = 'background:hsl(12 62% 48%)';
    assert.ok(dashed.includes('repeating-linear-gradient') && !solid.includes('repeating-linear-gradient'));
});

ok('② 줄무늬를 걷고 그 사람 색은 그대로', () => {
    assert.equal(prop('background-image'), 'none !important', '인라인 줄무늬를 이겨요');
    assert.ok(!/(?:^|[;\s])background(?:-color)?\s*:/.test(body), '색은 새로 정하지 않아요(인라인 색 그대로)');
    assert.ok(!/border/.test(body), '테두리 색을 따로 박지 않아요');
});

ok('③ 고리 가림: 안은 비고 점선 세 마디 이상 · 둘레에 딱 맞음', () => {
    assert.ok(svg.includes('<circle'), '고리 그림');
    assert.match(prop('mask'), /^var\(--bl-tr-ring\) center \/ 100% 100% no-repeat$/);
    assert.equal(prop('-webkit-mask'), prop('mask'), '옛 웹뷰 이름도 같이');
    assert.equal(attr('fill'), 'none', '안은 비워요');
    const r = Number(attr('r')), sw = Number(attr('stroke-width')), [on, off] = attr('stroke-dasharray').split(/\s+/).map(Number);
    const box = Number((/viewBox='0 0 (\d+(?:\.\d+)?) /.exec(svg) || [])[1]);
    assert.ok(r + sw / 2 <= box / 2, '고리가 상자 밖으로 안 나가요');
    const round = 2 * Math.PI * r, count = round / (on + off);
    assert.ok(count >= 3, `점선 마디 ${count.toFixed(2)}개(셋 이상)`);
    assert.ok(Math.abs(count - Math.round(count)) < 0.02, `마디 수가 정수예요(${count.toFixed(3)})`);
    assert.ok(Math.abs(on / off - 6 / 4) < 0.05, '선의 점선(6 4)과 같은 비');
    assert.ok(on >= 2 && off >= 2 && sw >= 1.5, '1배 화면에서도 마디 · 틈이 2px 이상');
});

ok('④ 작은 크기 · 자리는 10px 그대로', () => {
    const w = parseFloat(prop('width')), h = parseFloat(prop('height')), m = parseFloat(prop('margin'));
    assert.equal(w, h);
    assert.ok(w >= 14 && w <= 18, `크기 ${w}px`);
    assert.equal(w + 2 * m, 10, '바깥 여백으로 그 확장 점 자리(10px)를 지켜요');
});

ok('⑤ 원작에 맡긴 동안에도 살아 있어요 · 생성 시트', () => {
    const marks = [...css.slice(0, at).matchAll(/^\/\* @mb ([a-z|]+) \*\/$/gm)];
    const key = marks.at(-1)?.[1] || '';
    assert.ok(key && !key.split('|').includes('trend'), `묶음 ${key} — 「변화 그래프 다시 그리기」 묶음은 원작에 맡기면 꺼져요`);
    const gen = path.join(root, 'src/ext-status.gen.css');
    if (fs.existsSync(gen)) {
        const g = fs.readFileSync(gen, 'utf8');
        if (g.includes('bl-tr-ring')) assert.ok(g.includes("stroke-dasharray='4.15 2.76'"), '생성 시트에 같은 규칙');
        else console.log('   (생성 시트는 아직 옛 것 — tools/build-css.cjs 를 돌리면 들어가요)');
    }
});
console.log(`mb-trend-legend-dash: ${n}개 통과`);
