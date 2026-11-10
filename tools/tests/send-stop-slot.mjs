// 보내기 단추가 멈춤 단추로 바뀌어도 자리가 그대로인지 봐요 (브라우저 없이 — CSS 규칙에서 읽은 폭으로 오른쪽 묶음을 한 줄로 놓아 봐요).
//   평소(보내기) · 답을 받는 중(실리태번 body[data-generating] 이 보내기 쪽 셋을 display:none) · 다시 쓰기 도는 중(실제 ui-hold.js 를 돌려요)
//   세 상태에서 「오른쪽 끝에서 잰 단추 중심」과 「묶음 폭」이 같아야 해요. 묶음은 margin-left:auto 로 줄 끝에 붙으니 폭이 같으면 왼쪽 단추도 안 움직여요.
//   node tools/tests/send-stop-slot.mjs <테마 루트>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const { createRewriteUiHold, REWRITE_ACTION_SELECTOR, REWRITE_FORM_SELECTOR } = await import(pathToFileURL(path.join(root, 'src/addons/rewrite/ui-hold.js')).href);

let passed = 0;
function check(name, run) { run(); passed++; console.log(`통과 ${passed}: ${name}`); }

// ── CSS 에서 읽는 값 ──
const css = read('css/04-send-form.css');
const body = selector => {
    const at = css.indexOf(selector + ' {');
    assert.ok(at >= 0, `규칙이 없어요: ${selector}`);
    return css.slice(at + selector.length + 2, css.indexOf('}', at));
};
const group = body('body.salty #nonQRFormItems > #rightSendForm');
const stopRule = body('body.salty #rightSendForm > #mes_stop');
const sendRule = body('body.salty #send_but');
const scriptRule = body('body.salty #rightSendForm > .stscript_btn');
const gap = Number(group.match(/\bgap:\s*(\d+)px/)?.[1]);
const circle = Number(stopRule.match(/\bwidth:\s*(\d+)px\s*!important/)?.[1]);

check('오른쪽 묶음은 한 줄 · 줄 끝 붙임 · 간격 고정이에요', () => {
    assert.match(group, /flex-wrap:\s*nowrap\s*!important/);
    assert.match(group, /margin-left:\s*auto/);
    assert.ok(gap >= 0 && Number.isFinite(gap));
});
check('보내기 칸은 --bottomFormBlockSize 고정 폭이에요', () => {
    assert.match(sendRule, /flex:\s*0 0 var\(--bottomFormBlockSize\)/);
    assert.match(sendRule, /width:\s*var\(--bottomFormBlockSize\)\s*!important/);
});
check('멈춤 · 명령 단추는 보내기와 같은 폭의 칸 가운데에 놓여요', () => {
    assert.ok(circle > 0);
    for (const rule of [stopRule, scriptRule]) {
        assert.equal(Number(rule.match(/\bwidth:\s*(\d+)px\s*!important/)?.[1]), circle);
        const m = rule.match(/margin-inline:\s*calc\(\(var\(--bottomFormBlockSize\) - (\d+)px\) \/ 2\)\s*!important/);
        assert.ok(m, '양옆 여백 = (칸 폭 − 동그라미) / 2');
        assert.equal(Number(m[1]), circle, '여백 식의 동그라미 크기가 실제 폭과 같아요');
    }
});
check('연결 전 · 명령 실행 중의 보내기 숨김은 칸까지 접어요', () => {
    assert.match(css, /body\.salty #send_but\.displayNone,\s*body\.salty #form_sheld\.isExecutingCommandsFromChatInput :is\(#send_but, #mes_continue\) \{\s*display: none !important;/);
});

// ── 한 줄 놓기 ──
function element(id, { width, margin = 0, display = '' }) {
    const values = new Map(display ? [['display', [display, '']]] : []);
    return { id, width, margin, base: 'flex', style: {
        getPropertyValue: key => values.get(key)?.[0] ?? '',
        getPropertyPriority: key => values.get(key)?.[1] ?? '',
        setProperty: (key, value, priority = '') => values.set(key, [value, priority]),
        removeProperty: key => values.delete(key),
    } };
}
/** 실리태번 rightSendForm 의 순서: (order 0) 다른 확장 단추 → (1) 대신 쓰기 · 이어 쓰기 → (2) 멈춤 · 보내기 */
function form(blockSize, { quick = false, extra = false } = {}) {
    const slot = (blockSize - circle) / 2;
    const list = [];
    if (extra) list.push(element('extra', { width: blockSize }));
    list.push(element('mes_impersonate', { width: blockSize, display: quick ? '' : 'none' }));
    list.push(element('mes_continue', { width: blockSize, display: quick ? '' : 'none' }));
    list.push(element('mes_stop', { width: circle, margin: slot, display: 'none' }));
    list.push(element('send_but', { width: blockSize }));
    return list;
}
const shown = (el, generating) => {
    const inline = el.style.getPropertyValue('display');
    if (inline) return inline !== 'none';
    // 실리태번 style.css: body[data-generating="true"] :is(#send_but, #mes_continue, #mes_impersonate, …) { display: none }
    if (generating && ['send_but', 'mes_continue', 'mes_impersonate'].includes(el.id)) return false;
    return true;
};
/** 오른쪽 끝에서 잰 각 단추의 중심과 묶음 폭. visibility:hidden 은 칸을 차지해요. */
function layout(list, { generating = false } = {}) {
    const boxes = list.filter(el => shown(el, generating));
    let x = 0; const centers = {};
    for (const el of [...boxes].reverse()) {
        x += el.margin; centers[el.id] = x + el.width / 2; x += el.width + el.margin + gap;
    }
    return { centers, width: boxes.length ? x - gap : 0, visible: boxes.filter(el => el.style.getPropertyValue('visibility') !== 'hidden').map(el => el.id) };
}
function holdOn(list) {
    const state = { send: false };
    const pick = selector => { const ids = selector.split(',').map(part => part.trim()).filter(part => /^#\w+$/.test(part)).map(part => part.slice(1)); return list.filter(el => ids.includes(el.id)); };
    const doc = { body: { dataset: {} }, querySelectorAll: pick, getElementById: id => list.find(el => el.id === id) ?? null };
    return createRewriteUiHold({ document: doc, getSendLocked: () => state.send, setSendLocked: value => { state.send = value; }, hideSwipes() {}, showSwipes() {} })();
}
const near = (a, b, what) => assert.ok(Math.abs(a - b) < 1e-9, `${what}: ${a} ≠ ${b}`);

// 글자 크기 80% · 100%(34.5px) · 120% · 150% 일 때의 칸 폭
for (const blockSize of [27.6, 34.5, 41.4, 51.75]) for (const quick of [false, true]) for (const extra of [false, true]) {
    const label = `칸 ${blockSize}px${quick ? ' · 빠른 이어 쓰기 단추' : ''}${extra ? ' · 다른 확장 단추' : ''}`;
    check(`${label}: 답을 받는 중의 멈춤이 보내기 자리에 그대로 서요`, () => {
        const list = form(blockSize, { quick, extra }), idle = layout(list);
        list.find(el => el.id === 'mes_stop').style.setProperty('display', 'flex');   // showStopButton()
        const busy = layout(list, { generating: true });
        near(busy.centers.mes_stop, idle.centers.send_but, '멈춤 중심');
        if (!quick) near(busy.width, idle.width, '묶음 폭');
        if (extra && !quick) near(busy.centers.extra, idle.centers.extra, '옆 단추 중심');
    });
    check(`${label}: 다시 쓰기 도는 중의 멈춤도 같은 자리에 서고, 끝나면 돌아와요`, () => {
        const list = form(blockSize, { quick, extra }), idle = layout(list);
        const release = holdOn(list), busy = layout(list);
        assert.deepEqual(busy.visible, extra ? ['extra', 'mes_stop'] : ['mes_stop']);
        near(busy.centers.mes_stop, idle.centers.send_but, '멈춤 중심');
        // 답을 받는 중과 한 px 도 다르지 않아요 — 받는 중에서 다시 쓰기로 넘어갈 때도 안 튀어요
        const generating = form(blockSize, { quick, extra });
        generating.find(el => el.id === 'mes_stop').style.setProperty('display', 'flex');
        assert.deepEqual(busy.centers, layout(generating, { generating: true }).centers);
        release();
        assert.deepEqual(layout(list), idle);
        for (const el of list) assert.equal(el.style.getPropertyValue('visibility'), '');
    });
}

check('입력판 단추만 접고 채팅 쪽 조작부는 칸을 남겨요', () => {
    const form = REWRITE_FORM_SELECTOR.split(',').map(part => part.trim());
    assert.deepEqual(form, ['#send_but', '#mes_continue', '#mes_impersonate']);
    const all = REWRITE_ACTION_SELECTOR.split(',').map(part => part.trim());
    for (const id of form) assert.ok(all.includes(id), `${id} 는 누름 막기 목록에도 있어요`);
    assert.ok(form.every(part => !part.includes('#chat')));
});
check('CI 에 등록돼 있어요', () => {
    assert.match(read('.github/workflows/release-check.yml'), /node tools\/tests\/send-stop-slot\.mjs \./);
});
console.log(`보내기 · 멈춤 단추 자리 ${passed}개를 통과했어요.`);
