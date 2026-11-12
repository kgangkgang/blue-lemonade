// 여러 개 고르는 목록(select[multiple])에는 ▾ 가 없어요 — 정적 시험. (size>1 목록은 실리태번 · 테마 어디에도 없어요)
// 사용자 제보(폰 · 나이트 · 월드 인포 「모든 채팅에 켤 월드 인포」 #world_info): 네 줄 목록 가운데 오른쪽에 ▾ 가 떠 있었어요.
// 테마 ▾ 규칙은 multiple 을 빼 두었지만 실리태번 원래 select 규칙(background-image: url(/img/down-arrow.svg))이 남아 있었어요.
//   ① css/02-controls.css 의 여러 개 고르기 규칙이 그림을 지운다(!important — 실리태번 원래 select 규칙보다 무겁다)
//   ② 그 규칙은 그림(background-image)만 지운다 — 면 색 · background 통째 칠하기는 건드리지 않는다(안쪽 여백은 원래 있던 것)
//   ③ 진짜 펼치는 칸(한 줄 고르기)의 테마 ▾ 규칙은 그대로 — 둥근 꺾쇠(--bl-select-arrow · round 선끝)도 그대로
//   ④ css/ 어디에서도 여러 개 고르기에 ▾ 그림을 다시 주지 않는다
//   ⑤ 생성물(style.css 또는 src/style-lazy.gen.css)에 같은 규칙이 들어 있다
//   node tools/tests/select-multi-no-arrow.mjs [테마 뿌리, 기본 .]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.argv[2] || '.');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
let n = 0;
const t = (name, fn) => { fn(); n++; console.log(`  PASS  ${name}`); };

const stripComments = s => s.replace(/\/\*[\s\S]*?\*\//g, '');
// 아주 단순한 규칙 나누기: @media 같은 감싸기는 풀고 { } 한 쌍씩 본다
function rules(css) {
    const out = [];
    const text = stripComments(css);
    const re = /([^{}]+)\{([^{}]*)\}/g;
    let m;
    while ((m = re.exec(text))) out.push({ sel: m[1].trim().replace(/^@[^{]*$/, ''), body: m[2] });
    return out;
}

const controls = read('css/02-controls.css');
const cr = rules(controls);
const isMultiRule = r => /^body\.salty select\[multiple\]:where\(:not\(\.salty-panel \*\)\)/.test(r.sel) && !/option/.test(r.sel) && /background-image:\s*none\s*!important/.test(r.body);

t('① 여러 개 고르기 규칙이 ▾ 그림을 지운다(!important)', () => {
    const hit = cr.filter(isMultiRule);
    assert.equal(hit.length, 1, '규칙 하나');
});

t('② 그림만 지운다 — 면 색 · background 통째 칠하기는 그대로', () => {
    const body = cr.find(isMultiRule).body;
    const props = [...body.matchAll(/([\w-]+)\s*:/g)].map(m => m[1]);
    assert.deepEqual(props.sort(), ['background-image', 'padding']);
});

t('③ 한 줄 고르기의 테마 ▾ 는 그대로(둥근 꺾쇠 · multiple 빼기)', () => {
    assert.match(controls, /--bl-select-arrow: url\("data:image\/svg\+xml,[^"]*stroke-linecap='round'[^"]*"\)/, '둥근 꺾쇠 그림');
    const single = cr.filter(r => /^body\.salty select:not\(\[multiple\]\)$/.test(r.sel) || r.sel.startsWith('html body.salty select:not([multiple], [size]:not([size="1"])'));
    assert.equal(single.length, 2, '한 줄 고르기 ▾ 규칙 둘');
    for (const r of single) assert.match(r.body, /background-image:\s*var\(--bl-select-arrow\)\s*!important/);
});

t('④ css/ 어디에서도 여러 개 고르기에 ▾ 그림을 다시 주지 않는다', () => {
    const bad = [];
    for (const f of fs.readdirSync(path.join(root, 'css')).filter(x => x.endsWith('.css'))) {
        for (const r of rules(read(`css/${f}`))) {
            if (!/(background-image|background)\s*:[^;]*(--bl-select-arrow|arrow[^;]*\.svg)/.test(r.body)) continue;
            for (const sel of r.sel.split(/,(?![^()]*\))/).map(s => s.trim())) {
                const multiTarget = /select\[multiple\]|#world_info(?![\w-])|\[size\]:not\(\[size="1"\]\)(?![^(]*\))/.test(sel.replace(/:not\([^()]*(\([^()]*\))*[^()]*\)/g, ''));
                if (multiTarget) bad.push(`${f}: ${sel}`);
            }
        }
    }
    assert.deepEqual(bad, [], '여러 개 고르기에 ▾ 를 주는 규칙 없음');
});

t('⑤ 생성물(style.css · src/style-lazy.gen.css)에도 같은 규칙', () => {
    for (const rel of ['style.css', 'src/style-lazy.gen.css']) {
        const css = read(rel);
        assert.ok(rules(css).some(isMultiRule), `${rel} 에 여러 개 고르기 ▾ 지우기 규칙`);
    }
});

console.log(`select-multi-no-arrow: ${n}개 통과`);
