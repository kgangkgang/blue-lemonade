// 7.2.4 애드온 창 · 첫 실행 안내 · 설정 창 작은 칸의 눌리는 넓이(css/87-addon-touch.css) — 손가락 화면에서만 44×44 상자를 덧대고 보이는 모양은 그대로인지.
//   ① (pointer: coarse) 안에만 ② 상자 계산이 44 이상 ③ 상자를 다는 칸은 기준점(position) 묶음에 있음
//   ④ 상자에 쓰는 ::before/::after 를 그 칸이 다른 CSS(애드온 style.css · 테마 모듈)에서 모양으로 쓰지 않음 ⑤ 글자 · 색 같은 보이는 속성은 안 바꿈 ⑥ style.css 에 들어감
//   node tools/tests/addon-touch-targets.mjs <테마 루트>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.argv[2] || '.');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const css = read('css/87-addon-touch.css');
const body = css.replace(/\/\*[\s\S]*?\*\//g, '');
let n = 0;
const t = (name, fn) => { fn(); n++; console.log(`  PASS  ${name}`); };
const rules = [...body.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(m => ({ selector: m[1].trim(), body: m[2] }));
const splitList = text => text.split(/,(?![^()]*\))/).map(s => s.trim()).filter(Boolean);
const innerOf = (text, pseudo) => { // ')::pseudo' 마다 짝이 맞는 ':is(' 를 거슬러 찾아 그 안 목록 (안쪽 :is( ) 는 괄호 세기로 건너뛴다)
    const out = []; const mark = ')::' + pseudo; let at = text.indexOf(mark);
    while (at >= 0) { let depth = 0, i = at; for (; i >= 0; i--) { if (text[i] === ')') depth++; else if (text[i] === '(') { depth--; if (!depth) break; } } if (i >= 3 && text.slice(i - 3, i) === ':is') out.push(...splitList(text.slice(i + 1, at))); at = text.indexOf(mark, at + 1); }
    return out; };

t('손가락 화면(pointer: coarse) 안에만 — 마우스 화면은 그대로', () => {
    const open = body.indexOf('@media (pointer: coarse) {');
    assert.ok(open >= 0);
    assert.equal(body.slice(0, open).trim(), '', '미디어 밖 규칙 없음');
    let depth = 0, end = -1;
    for (let i = body.indexOf('{', open); i < body.length; i++) { if (body[i] === '{') depth++; else if (body[i] === '}' && !--depth) { end = i; break; } }
    assert.equal(body.slice(end + 1).trim(), '', '미디어 뒤 규칙 없음');
});

const box = rules.find(r => /::after,\s*$|::before\s*$/.test(r.selector) && /content:\s*''/.test(r.body));
t('상자: 가운데 맞춤 · max(100%, 44px) · 투명', () => {
    assert.ok(box, '상자 규칙');
    for (const prop of ["content: ''", 'position: absolute', 'width: max(100%, 44px)', 'height: max(100%, 44px)', 'transform: translate(-50%, -50%)', 'background: none', 'border: 0', 'box-shadow: none']) assert.ok(box.body.includes(prop), prop);
});

const afterList = innerOf(box.selector, 'after'), beforeList = innerOf(box.selector, 'before');
const relativeRule = rules.find(r => r.selector.startsWith(':where(') && /position:\s*relative/.test(r.body));
const relativeList = splitList(relativeRule.selector.replace(/^:where\(/, '').replace(/\)\s*$/, ''));
t('상자를 다는 칸은 모두 기준점(position: relative, :where 로 다른 모듈의 position 을 존중) 묶음에 있음', () => {
    assert.ok(afterList.length >= 30 && beforeList.length >= 4, `after ${afterList.length} · before ${beforeList.length}`);
    const normalize = s => s.replace(/:not\([^)]*\)$/, '').replace(/\s+/g, ' ').trim();
    const rel = new Set(relativeList.map(normalize));
    for (const sel of [...afterList, ...beforeList]) {
        const key = normalize(sel);
        const covered = rel.has(key) || [...rel].some(r => key.endsWith(r) || key.startsWith(r.replace(/^:is\(/, ':is('))) || /summary$/.test(key) && [...rel].some(r => /summary$/.test(r)) || /header > button$/.test(key) && [...rel].some(r => /header > button$/.test(r));
        assert.ok(covered, '기준점 없음: ' + key);
    }
});

// 다른 CSS 가 같은 칸의 같은 가짜 요소로 모양을 그리면 상자가 그 모양을 덮어쓴다
const others = [
    ...fs.readdirSync(path.join(root, 'css')).filter(f => f.endsWith('.css') && f !== '87-addon-touch.css' && f !== '23-preview.gen.css').map(f => 'css/' + f),
    ...fs.readdirSync(path.join(root, 'src/addons')).map(d => `src/addons/${d}/style.css`).filter(f => fs.existsSync(path.join(root, f))),
].map(f => ({ f, text: read(f).replace(/\/\*[\s\S]*?\*\//g, '') }));
const classesOf = sel => [...sel.matchAll(/\.([A-Za-z0-9_-]+)/g)].map(m => m[1]).filter(c => !/^(bl-roomy-dialog|bl-notes-dialog|bl-assets-dialog|bl-direction-dialog|bl-ctsi-dialog|bl-mermaid-dialog|blpt-dialog|blzi-dialog|bl-translator-dialog|salty-panel|bl-embedded-settings|po-dialog|pa-hub|rl-root|bwr_settings|pt-help-dialog|jj-settings-body|bl-first-run|menu_button|text_pole|eh-size|rl-msg|eh-guide)$/.test(c));
t('상자에 쓰는 ::after/::before 를 그 칸이 다른 CSS 에서 모양으로 쓰지 않음', () => {
    const check = (list, pseudo) => {
        for (const sel of list) {
            const classes = classesOf(sel);
            if (!classes.length) continue;
            for (const { f, text } of others) {
                for (const c of classes) {
                    const re = new RegExp(String.raw`\.${c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\w-])[^,{]*::?${pseudo}\b`);
                    const hit = re.exec(text);
                    assert.ok(!hit, `${f}: .${c} 가 ::${pseudo} 를 모양에 씀 — 상자는 다른 가짜 요소로 (${hit && hit[0].slice(0, 60)})`);
                }
            }
        }
    };
    check(afterList, 'after'); check(beforeList, 'before');
});

t('보이는 속성은 안 바꿈 (글자 · 색 · 여백 · 테두리 · 그림자 없음), 글자 칸은 높이만', () => {
    for (const r of rules) {
        if (r === box) continue;
        assert.ok(!/(^|;)\s*(color|font|margin|padding|border(?!:\s*0)|box-shadow|background)\s*:/.test(r.body), r.selector.slice(0, 60) + ' => ' + r.body.trim().slice(0, 60));
    }
    const field = rules.find(r => /min-height:\s*44px/.test(r.body));
    assert.ok(field && /input\.text_pole/.test(field.selector) && /data-num/.test(field.selector), '글자 · 숫자 칸 높이 44');
    assert.ok(!/height:\s*\d/.test(field.body.replace(/min-height:\s*44px;?/, '')), '고정 높이 없음');
});

t('style.css 에 들어감 (build-css 가 모듈 순서대로 이어 붙임 · 99-lazy-panel 앞)', () => {
    const built = read('style.css');
    const at = built.indexOf('css/87-addon-touch.css');
    assert.ok(at > 0, '모듈 표시');
    assert.ok(at < built.indexOf('css/99-lazy-panel.css'), '게으른 칸보다 앞');
    assert.ok(built.includes('.po-move') && built.includes('.bl-fr-icon') && built.includes('.ms-pull'), '규칙이 들어감');
});

console.log(`PASS addon touch targets (${n} checks)`);
