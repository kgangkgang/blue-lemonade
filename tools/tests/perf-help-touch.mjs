// 7.7.4 성능 보조 「기능 켜기」를 손가락으로 누르면 도움말(성능 보조는 무슨 일을 하나요?)만 뜨던 문제 (커뮤니티 제보).
//   원인: 「확장만」 사용 모드(body 에 .salty 없음)에서 성능 보조 카드의 ? 단추(.bl-word-help)가 position: static 인데
//   86-touch-targets.css 가 그 단추에 44×44 투명 상자(::before, absolute · width/height max(100%, 44px) · 가운데 맞춤)를 달았다.
//   기준점이 없어 상자의 100% 가 가장 가까운 positioned 조상(카드 · 설정 창) 크기로 번져, 카드 위쪽의 「기능 켜기」까지 덮었다 —
//   DOM 에서 뒤에 오는 ? 상자가 위에 깔려 누름을 받아 도움말만 떴다. 마우스 화면 · 「테마 + 확장」(56 이 body.salty 아래에서 relative) 은 정상.
//   지키는 것:
//   ① 상자를 다는 칸마다, 상자와 같은 범위(테마가 꺼져도 = body.salty 없이)에서 기준점(position)이 있다 — 다른 모듈의 증거가 body.salty 아래뿐이면 안 됨
//   ② ? 단추 · 예시 단추는 86 의 기준점 목록에 있다 (확장만 모드에서도 relative)
//   ③ 성능 보조 카드 마크업: 「기능 켜기」 label 안에는 글자와 체크칸만, ? 단추는 label 밖 「별 두 개 메뉴」 줄 · 도움말은 ? 단추 click 에만 묶임
//   ④ 「기능 켜기」 change 처리는 도움말을 부르지 않는다
//   node tools/tests/perf-help-touch.mjs <테마 루트>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.argv[2] || '.');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const strip = text => text.replace(/\/\*[\s\S]*?\*\//g, '');
let n = 0;
const t = (name, fn) => { fn(); n++; console.log(`  PASS  ${name}`); };

const touch = strip(read('css/86-touch-targets.css'));   // 87-addon-touch.css 는 상자 칸이 모두 같은 파일의 기준점 목록에 있는지 addon-touch-targets.mjs 가 이미 엄격히 본다
const others = fs.readdirSync(path.join(root, 'css')).filter(f => f.endsWith('.css') && !['86-touch-targets.css', '23-preview.gen.css', '87-addon-touch.css'].includes(f))
    .map(f => strip(read('css/' + f))).join('\n');
const split = text => { const out = []; let d = 0, s = 0; for (let i = 0; i < text.length; i++) { const c = text[i]; if (c === '(') d++; else if (c === ')') d--; else if (c === ',' && !d) { out.push(text.slice(s, i).trim()); s = i + 1; } } out.push(text.slice(s).trim()); return out.filter(Boolean); };
// 선택자 하나를 :is( … ) · :where( … ) 를 풀어 낱 선택자들로 (html body.salty :is(a, b) → html body.salty a · html body.salty b)
const expand = sel => {
    const m = /:(is|where)\(/.exec(sel);
    if (!m) return [sel.trim()];
    const at = m.index, open = at + m[0].length - 1;
    let d = 0, end = -1;
    for (let i = open; i < sel.length; i++) { if (sel[i] === '(') d++; else if (sel[i] === ')' && !--d) { end = i; break; } }
    const head = sel.slice(0, at), tail = sel.slice(end + 1);
    return split(sel.slice(open + 1, end)).flatMap(item => expand(`${head}${item}${tail}`)).map(s => s.replace(/\s+/g, ' ').trim());
};
const rulesOf = css => { const out = []; let depth = 0, start = 0; for (let i = 0; i < css.length; i++) { const c = css[i]; if (c === '{') { const sel = css.slice(start, i).trim(); const close = css.indexOf('}', i); const body = css.slice(i + 1, close); if (!/^@/.test(sel) && !body.includes('{')) { out.push({ sel, body }); i = close; start = i + 1; continue; } depth++; start = i + 1; } else if (c === '}') { depth--; start = i + 1; } } return out; };
const touchRules = rulesOf(touch), otherRules = rulesOf(others);
const scoped = s => /body\.salty(?![\w-])/.test(s);
// 상자 규칙: content '' · absolute · max(100%, 44px)
const boxRules = touchRules.filter(r => /content:\s*''/.test(r.body) && /width:\s*max\(100%,\s*44px\)/.test(r.body) && /left:\s*50%/.test(r.body));
const boxes = boxRules.flatMap(r => split(r.sel).flatMap(expand)).filter(s => /::(before|after)$/.test(s)).map(s => ({ full: s, owner: s.replace(/::(before|after)$/, '') }));
// 칸의 열쇠: 맨 끝 겹선택자 (끝이 태그뿐이면 `.bl-preview-samples > button` 처럼 앞 칸까지) — 범위 머리(html body · .salty-panel · .bl-editor)는 견주지 않는다
const keyOf = s => { const tokens = s.replace(/\s*>\s*/g, ' > ').trim().split(/\s+/); const last = tokens.at(-1); return /^[a-z]+$/.test(last) ? tokens.slice(-3).join(' ') : last; };
const anchors = [...touchRules, ...otherRules].filter(r => /(^|;|\s)position:\s*(relative|absolute|fixed|sticky)/.test(r.body) && !/::(before|after)/.test(r.sel))
    .flatMap(r => split(r.sel).flatMap(expand).map(s => ({ s, scoped: scoped(s) })));

t('상자 규칙을 찾음 (테마 자신의 칸 · 실리태번 쪽 칸)', () => {
    assert.ok(boxes.length >= 20, `상자 칸 ${boxes.length}`);
    assert.ok(boxes.some(b => b.owner.includes('.bl-word-help')), '? 단추 상자');
    assert.ok(boxes.some(b => !scoped(b.full)) && boxes.some(b => scoped(b.full)), '두 범위');
});

t('상자를 다는 칸마다 같은 범위에서 기준점이 있음 — body.salty 아래에만 있는 증거는 「확장만」 모드에서 빠진다', () => {
    const missing = [];
    for (const box of boxes) {
        const want = keyOf(box.owner);
        const proof = anchors.filter(a => keyOf(a.s) === want);
        // 상자가 body.salty 없이 걸리면 기준점도 body.salty 없이 걸려야 한다
        const ok = proof.some(a => scoped(box.full) || !a.scoped);
        if (!ok) missing.push(`${box.full}  (증거: ${proof.map(a => a.s).join(' | ') || '없음'})`);
    }
    assert.deepEqual(missing, [], '기준점 없는 상자');
});

t('? 단추 · 예시 단추는 86 기준점 목록(테마가 꺼져도 걸리는 html body 묶음)에 있음', () => {
    const rel = touchRules.find(r => /position:\s*relative/.test(r.body) && r.sel.includes('.salty-panel .salty-btn'));
    assert.ok(rel, '기준점 규칙');
    const list = split(rel.sel).flatMap(expand).filter(s => !scoped(s));
    for (const sel of ['.salty-panel .bl-word-help', '.salty-panel .bl-preview-samples > button']) assert.ok(list.includes(`html body ${sel}`), sel);
});

const addons = read('src/addons.js');
t('성능 보조 카드: 「기능 켜기」 label 안은 글자 · 체크칸만, ? 단추는 label 밖', () => {
    const header = /const header=`([\s\S]*?)`;/.exec(addons)?.[1] || '';
    const power = /<label class="bl-addon-power">([\s\S]*?)<\/label>/.exec(header)?.[1];
    assert.ok(power, '기능 켜기 label');
    assert.match(power, /<span>기능 켜기<\/span><input type="checkbox" data-addon-toggle=/);
    assert.ok(!/<button|data-perf-help/.test(power), 'label 안에 단추 없음');
    const perf = /const perf=id==='perf'\?`([\s\S]*?)`:'';/.exec(addons)?.[1] || '';
    assert.match(perf, /^<div class="bl-tool-label"><b>별 두 개 메뉴<\/b><button type="button" class="bl-word-help" data-perf-help/);
    assert.ok(!/<label[^>]*>(?:(?!<\/label>)[\s\S])*data-perf-help/.test(perf), '? 단추를 감싼 label 없음');
});

t('도움말은 ? 단추 click 에만 · 「기능 켜기」 change 는 도움말을 부르지 않음', () => {
    const helpBinds = [...addons.matchAll(/showPerfHelp/g)].length;
    assert.equal(helpBinds, 1, '도움말을 부르는 곳 하나');
    assert.match(addons, /root\.querySelector\('\[data-perf-help\]'\)\?\.addEventListener\('click',async\(\)=>\{\(await import\('\.\/addons\/perf\/help\.js'\)\)\.showPerfHelp\(\);\}\);/);
    const toggle = /root\.querySelectorAll\('\[data-addon-toggle\]'\)\.forEach\(input=>input\.addEventListener\('change',async\(\)=>\{([\s\S]*?)\}\)\);/.exec(addons)?.[1];
    assert.ok(toggle, '기능 켜기 change 처리');
    assert.ok(!/help/i.test(toggle), '도움말 없음');
});

console.log(`perf-help-touch: ${n} passed, 0 failed`);
