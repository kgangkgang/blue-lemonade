// 10-30 perf-icon: 네모 단추 판정(src/squared-buttons.js isRoundTextButton)이 글자 읽기(innerText — 자손 배치를 보고 글자를 모음)를
//   모서리 · 칠 · 누를 수 있음 판정 뒤로 미뤄, 둥글지 않은 후보에서는 글자를 읽지 않는지 · 답은 예전 순서와 같은지 봐요(가짜 요소, 브라우저 없음)
//   node tools/tests/squared-text-last.mjs <테마 루트>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const root = path.resolve(process.argv[2] || '.');
const { isRoundTextButton } = await import(pathToFileURL(path.join(root, 'src/squared-buttons.js')));
let pass = 0; const test = (name, fn) => { fn(); pass++; console.log('  PASS  ' + name); };
let textReads = 0;
class El {
    constructor(o) { Object.assign(this, { tag: 'BUTTON', text: '저장', w: 80, h: 32, radius: '16px', bg: 'rgb(1, 2, 3)', border: '0px', image: 'none', shadow: 'none', cursor: 'pointer', display: 'block', visibility: 'visible', cls: '' }, o); this.className = this.cls; this.id = ''; }
    get innerText() { textReads++; return this.text; }
    hasAttribute() { return false; }
    matches(s) { return s.startsWith('button') ? this.tag === 'BUTTON' : false; }
    closest() { return null; }
    getBoundingClientRect() { return { width: this.w, height: this.h }; }
}
const view = { HTMLElement: El, getComputedStyle: el => ({ display: el.display, visibility: el.visibility, borderTopLeftRadius: el.radius, backgroundColor: el.bg, borderTopWidth: el.border, backgroundImage: el.image, boxShadow: el.shadow, cursor: el.cursor }) };
// 예전 순서(글자 먼저) 그대로 — 기준
const alpha = c => { if (!c || c === 'transparent') return 0; const m = /rgba?\(([^)]+)\)/.exec(c); if (!m) return 1; const p = m[1].split(/[\s,/]+/).filter(Boolean); return p.length > 3 ? parseFloat(p[3]) : 1; };
function oldRound(el) {
    const rect = el.getBoundingClientRect(); if (rect.height < 24 || rect.width < 24) return false;
    if ([...(el.text || '').trim()].length < 2) return false;
    const s = view.getComputedStyle(el); if (s.display === 'none' || s.visibility === 'hidden') return false;
    const raw = s.borderTopLeftRadius; const radius = raw.endsWith('%') ? parseFloat(raw) * Math.min(rect.width, rect.height) / 100 : parseFloat(raw);
    if (!(radius > 10 && radius >= rect.height / 2 - 2)) return false;
    if (!(alpha(s.backgroundColor) > 0.03 || parseFloat(s.borderTopWidth) > 0 || s.backgroundImage !== 'none' || s.boxShadow !== 'none')) return false;
    return el.matches('button,a,summary,[role="button"],[role="tab"],.menu_button') || s.cursor === 'pointer';
}

test('모서리가 둥글지 않은 후보 100개는 글자를 한 번도 읽지 않아요(고치기 전: 100번)', () => {
    textReads = 0;
    for (let i = 0; i < 100; i++) assert.equal(isRoundTextButton(new El({ radius: '4px' }), view), false);
    assert.equal(textReads, 0, `innerText ${textReads}번`);
});
test('답은 예전 순서와 같아요(조건 조합 전부)', () => {
    const opts = { text: ['저장', '✕', ''], w: [80, 20], h: [32, 20], radius: ['16px', '4px', '50%'], bg: ['rgb(1, 2, 3)', 'rgba(0, 0, 0, 0)', 'transparent'], border: ['0px', '1px'], cursor: ['pointer', 'auto'], tag: ['BUTTON', 'DIV'], display: ['block', 'none'], visibility: ['visible', 'hidden'] };
    const keys = Object.keys(opts); let n = 0, yes = 0;
    const rec = (i, o) => {
        if (i === keys.length) { const el = new El(o); const want = oldRound(el); assert.equal(isRoundTextButton(el, view), want, JSON.stringify(o)); n++; if (want) yes++; return; }
        for (const v of opts[keys[i]]) rec(i + 1, { ...o, [keys[i]]: v });
    };
    rec(0, {});
    assert.ok(n > 1000 && yes > 0, `조합 ${n} · 참 ${yes}`);
});
assert.ok(fs.readFileSync(path.join(root, '.github/workflows/release-check.yml'), 'utf8').includes('node tools/tests/squared-text-last.mjs .'), 'release-check.yml 에 등록');
console.log(`squared-text-last: ${pass}개 통과`);
