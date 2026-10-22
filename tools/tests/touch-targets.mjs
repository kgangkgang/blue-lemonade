// 7.0.5 작은 터치 칸(css/86-touch-targets.css) — 손가락 화면에서만 투명한 44×44 상자를 덧대고 보이는 모양은 그대로인지.
//   실제 눌리는 넓이는 격리 실리태번 + 헤드리스 Edge 로 쟀다(../blue-lemonade-audit/touch-targets-20261017). 여기서는 그 결과가 깨지지 않게 CSS 를 지킨다:
//   ① (pointer: coarse) 안에만 ② 상자 계산이 44 이상 ③ 상자를 다는 칸은 기준점(position)이 있음 — static 칸에 달면 상자가 조상 크기로 번져 주변을 덮는다
//   ④ 상자에 쓰는 ::before/::after 를 그 칸이 다른 모듈에서 모양으로 쓰지 않음 ⑤ 글자 · 색 · 자간 같은 보이는 속성은 안 바꿈 ⑥ style.css 에 들어감.
//   node tools/tests/touch-targets.mjs <테마 루트>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.argv[2] || '.');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const css = read('css/86-touch-targets.css');
const body = css.replace(/\/\*[\s\S]*?\*\//g, '');
let n = 0;
const t = (name, fn) => { fn(); n++; console.log(`  PASS  ${name}`); };

// :is( … )::before / ::after 묶음 안의 선택자들
const listBefore = (pseudo) => {
    const lists = [...body.matchAll(new RegExp(String.raw`:is\(((?:(?!::|[{}])[\s\S])*?)\n\s*\)::${pseudo}`, 'g'))].map(m => m[1]);
    return lists.flatMap(l => l.split(/,\s*\n/).map(s => s.trim()).filter(Boolean));
};
// 7.2.4: 기준점 규칙은 두 묶음 — html body :is(테마 자신의 칸), html body.salty :is(실리태번 쪽 칸)
const relativeList = (() => { const m = /html body(?:\.salty)? :is\(([\s\S]*?)\n\s*\)(?:,\n\s*html body(?:\.salty)? :is\(([\s\S]*?)\n\s*\))? \{\n\s*position: relative;/.exec(body); return m ? [m[1], m[2] || ''].join(',\n').split(/,\s*\n/).map(s => s.trim()).filter(Boolean) : []; })();
// 다른 모듈에서 이미 position 이 있는 칸 (그 선언을 실제로 확인한다)
// 7.7.4 증거는 상자와 같은 범위여야 한다: 상자는 html body(테마가 꺼진 「확장만」 모드 포함)에 걸리는데 ? 단추(.bl-word-help) · 예시 단추의 relative 는
//   56 의 body.salty 아래에만 있어 확장만 모드에서 static → 상자가 카드 크기로 번져 성능 보조 「기능 켜기」를 덮었다(누르면 도움말만 뜸, 커뮤니티 제보).
//   그 둘은 86 기준점 목록으로 옮겼고, 남은 증거는 body.salty 없이 걸리는지까지 본다 (tools/tests/perf-help-touch.mjs 가 전체를 낱 선택자로 다시 확인).
const ALREADY_POSITIONED = {
    // 56-control-consistency.css 의 선 그림 단추 묶음(↺ · 미리보기 기본 높이) — html body · .salty-panel 범위라 확장만 모드에서도 relative
    '.salty-panel .bl-setting-reset': /html body \.bl-editor \.bl-setting-reset[^{]*\{\s*position:relative/,
    '.salty-panel .bl-view-resize > button:not(.bl-view-toggle)': /:is\(\.salty-panel, \.bl-ft-dialog\) \.bl-view-resize > button:not\(\.bl-view-toggle\)[^{]*\{\s*position:relative/,
};
// 다른 모듈 (23-preview.gen.css 는 86 의 #chat 규칙을 베낀 것이라 뺀다 · 87-addon-touch.css 는 같은 투명 상자를 애드온 창에 다는 짝 모듈이라 뺀다 — tools/tests/addon-touch-targets.mjs)
const otherCss = fs.readdirSync(path.join(root, 'css')).filter(f => f.endsWith('.css') && f !== '86-touch-targets.css' && f !== '23-preview.gen.css' && f !== '87-addon-touch.css').map(f => read('css/' + f)).join('\n');

t('손가락 화면(pointer: coarse) 안에만 — 마우스 화면은 그대로', () => {
    const open = body.indexOf('@media (pointer: coarse) {');
    assert.ok(open >= 0);
    assert.equal(body.slice(0, open).trim(), '', '미디어 밖 규칙 없음');
    let depth = 0, end = -1;
    for (let i = body.indexOf('{', open); i < body.length; i++) { if (body[i] === '{') depth++; else if (body[i] === '}' && !--depth) { end = i; break; } }
    assert.equal(body.slice(end + 1).trim(), '', '미디어 뒤 규칙 없음');
});

t('상자 계산: 가운데 맞춤 · 너비 · 높이 = max(칸, 44px) — 실측 크기들에서 모두 44 이상, 큰 칸은 그대로', () => {
    assert.match(body, /left: 50%;\s*top: 50%;\s*width: max\(100%, 44px\);\s*height: max\(100%, 44px\);\s*transform: translate\(-50%, -50%\);/);
    const box = (w, h) => [Math.max(w, 44), Math.max(h, 44)];
    // BEFORE 에서 잰 크기들 (「펼쳐서 확대」 25×25, ↺ 32×32, 머리 스위치 40×22, 넓은 칸 346×20, 고르기 칩 73×34)
    for (const [w, h] of [[25, 25], [32, 32], [40, 22], [346, 20], [73, 34]]) { const [bw, bh] = box(w, h); assert.ok(bw >= 44 && bh >= 44 && bw >= w && bh >= h, `${w}x${h}`); }
    assert.match(body, /background: none;\s*border: 0;\s*box-shadow: none;/, '상자는 투명');
});

t('상자를 다는 칸은 모두 기준점이 있음 (여기서 relative 이거나 다른 모듈에서 이미 positioned)', () => {
    const targets = [...listBefore('before'), ...listBefore('after')];
    assert.ok(targets.length >= 20, `상자 칸 ${targets.length}`);
    for (const sel of targets) {
        if (relativeList.includes(sel)) continue;
        const proof = ALREADY_POSITIONED[sel];
        assert.ok(proof, `기준점 없는 칸: ${sel}`);
        const m = proof.exec(otherCss);
        assert.ok(m, `다른 모듈에서 position 을 못 찾음: ${sel}`);
        assert.ok(!/body\.salty(?![\w-])/.test(m[0].split(',')[0]), `증거가 body.salty 아래뿐: ${sel}`);
    }
    assert.ok(relativeList.length >= 15);
});

// 선택자 s 에서 i 자리의 클래스가 붙은 칸 「자신」의 ::pseudo 인지 (자손 ` span::after` · 다른 목록 항목은 아님, `:is(… .x …)::before` 는 자신)
const ownsPseudo = (s, i, len, pseudo) => {
    let d = 0;
    for (let k = 0; k < i; k++) { if (s[k] === '(') d++; else if (s[k] === ')') d--; }
    let at = d;
    for (let k = i + len; k < s.length; k++) {
        const ch = s[k];
        if (d === at && s.startsWith('::' + pseudo, k)) return true;
        if (ch === '(') { d++; continue; }
        if (ch === ')') { d--; if (d < at) at = d; continue; }
        if (d !== at) continue;
        if (ch === ',') {   // 이 항목은 끝 — 감싼 묶음이 닫힐 때까지 건너뜀 (맨 바깥이면 끝)
            if (at === 0) return false;
            for (k++; k < s.length && d >= at; k++) { if (s[k] === '(') d++; else if (s[k] === ')') d--; }
            at = d; k--; continue;
        }
        if (/[>+~]/.test(ch) || (/\s/.test(ch) && !/^\s*[),{]/.test(s.slice(k)))) return false;   // 자손 · 이웃
    }
    return false;
};
const otherSelectors = [...otherCss.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{/g)].map(m => m[1].trim()).filter(s => /::(before|after)/.test(s));
// :not( … ) 안의 클래스는 그 칸이 아님
const insideNot = (s, i) => { let d = 0; for (let k = i - 1; k >= 0; k--) { if (s[k] === ')') d++; else if (s[k] === '(' && !d--) return s.slice(Math.max(0, k - 4), k) === ':not'; } return false; };
const pseudoUsers = (cls, pseudo) => otherSelectors.filter(s => [...s.matchAll(new RegExp(String.raw`\.` + cls.slice(1) + String.raw`(?![\w-])`, 'g'))]
    .some(m => !insideNot(s, m.index) && ownsPseudo(s, m.index, cls.length, pseudo)));

t('상자에 쓰는 가상 요소를 그 칸이 다른 모듈에서 모양으로 쓰지 않음', () => {
    // 찾는 방법이 제대로 도는지: 알려진 모양 가상 요소는 잡고, 자손 것은 안 잡음
    assert.ok(pseudoUsers('.bl-setting-reset', 'before').length, '↺ 의 ::before 선 그림을 찾음');
    assert.ok(pseudoUsers('.bl-editor-group-toggle', 'after').length, '묶음 접기의 ::after 화살표를 찾음');
    assert.equal(pseudoUsers('.salty-switch', 'after').length, 0, '스위치 span::after 는 자손');
    const cls = sel => (sel.match(/\.[\w-]+/g) || []).filter(c => !['.salty-panel', '.mes', '.salty-sec'].includes(c)).pop();
    for (const [pseudo, list] of [['before', listBefore('before')], ['after', listBefore('after')]]) {
        for (const sel of list) {
            const c = cls(sel); if (!c) continue;   // [data-rule-delete] 같은 속성 칸
            const users = pseudoUsers(c, pseudo);
            assert.equal(users.length, 0, `${sel} 의 ::${pseudo} 를 다른 모듈이 씀: ${users[0]?.slice(0, 120)}`);
        }
    }
});

t('보이는 속성은 안 바꿈 (글자 · 색 · 자간 · 칸 여백) — 슬라이더만 높이 · 같은 만큼 빼는 바깥 여백', () => {
    for (const prop of ['letter-spacing', 'font', 'color:', 'padding', 'border-radius', 'opacity', 'display:']) assert.ok(!body.includes(prop), `${prop} 없음`);
    const range = /\.salty-slider > input\[type="range"\] \{\s*height: 44px !important;\s*margin-block: calc\(\(44px - 24px\) \/ -2\) !important;\s*\}/;
    assert.match(body, range);
});

t('확장 서랍 머리 스위치는 기존 ::before(위아래 7px)를 44×44 로 · 왼쪽 서랍의 링크 · 고르기 · 아이콘은 한 층 위 · style.css 에 들어감', () => {
    assert.match(otherCss, /\.bl-hs-switch::before \{ content:''; position:absolute; inset:-7px 0; \}/);
    assert.match(body, /\.bl-hs-switch::before \{\s*inset: auto;/);
    assert.match(body, /#left-nav-panel :is\(a, select, textarea, \.menu_button\):not\(label \*\) \{\s*position: relative;\s*z-index: 1;/);
    const built = read('style.css');
    assert.ok(built.includes('/* css/86-touch-targets.css */'), 'style.css 에 모듈');
    assert.ok(/width:\s*max\(100%,\s*44px\)/.test(built), 'style.css 에 상자');
});

t('실리태번 1.19 의 빠른 프롬프트 편집 「크게 보기」(왼쪽 서랍 .editor_maximize): 기준점 · ::after 상자 · 상자가 걸치는 글 칸은 한 층 위', () => {
    assert.ok(relativeList.includes('#left-nav-panel .editor_maximize'), '기준점');
    assert.ok(listBefore('after').includes('#left-nav-panel .editor_maximize'), '::after 상자');
    // Font Awesome 아이콘은 ::before 로 그린다 — 다른 모듈이 ::after 를 모양으로 쓰지 않아야 상자로 쓸 수 있다
    assert.ok(!/editor_maximize[^{,]*::after/.test(otherCss), '다른 모듈의 ::after 없음');
});

t('7.0.6 가로 넘침 없음: 줄 오른쪽 끝의 스위치는 상자를 오른쪽 끝에 맞춰 왼쪽으로만 넓힌다 · 굴리는 목록은 overflow-x 를 숨기지 않는다', () => {
    // 7.0.5 는 가운데 맞춤 상자(36 → 44)가 오른쪽으로 4px 삐져나가 「설정 선택」 목록(overflow:auto)에 가로 스크롤 줄이 생겼다 (폰 제보)
    const rule = /html body(?:\.salty)? \.salty-panel label\.salty-switch::before \{([^}]*)\}/.exec(body)?.[1];
    assert.ok(rule, '스위치 전용 규칙');
    assert.match(rule, /right: 0;/); assert.match(rule, /left: auto;/);
    assert.match(rule, /transform: translateY\(-50%\);/, '가로로는 옮기지 않음');
    assert.match(rule, /width: max\(100%, 44px\);\s*height: max\(100%, 44px\);/, '44×44 그대로');
    // 오른쪽 끝 = 스위치 오른쪽 끝 → 상자가 스위치보다 오른쪽으로 나가지 않는다 (36 · 40 · 46 폭 모두)
    for (const w of [36, 40, 46]) { const boxW = Math.max(w, 44), boxRight = w, boxLeft = w - boxW; assert.ok(boxRight <= w && boxLeft <= 0 && boxW >= 44, `${w}`); }
    assert.ok(!listBefore('before').concat(listBefore('after')).some(sel => /salty-switch(?!\))/.test(sel)), '가운데 맞춤 목록에 스위치가 없음');
    // 증상만 숨기지 않았는지 — 설정 선택 목록 · 설정 창 본문은 그대로 overflow:auto (가로 줄을 감추는 overflow-x 없음)
    assert.match(otherCss, /\.bl-editor-directory-list \{ min-height:0; overflow:auto;/);
    assert.ok(!/bl-editor-directory-list[^{]*\{[^}]*overflow-x\s*:\s*(hidden|clip)/.test(otherCss + body), 'overflow-x 숨김 없음');
});

console.log(`touch-targets: ${n} passed, 0 failed`);
