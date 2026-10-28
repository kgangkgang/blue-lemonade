// 번역기 8.1.3 — 번역 중 미리 보기의 상태창 틀 바꾸기(3.1.4) + 헬퍼 알림(MESSAGE_UPDATED)이 다른 확장의 통째 다시 그리기와 도는 고리.
//   재현(10-28 폰 제보 「번역 진행 줄이 0.5~1초마다 나타났다 사라지고 본문이 위아래로 깜빡, 미리 보기가 안 보임」):
//   미리 보기가 틀을 번역된 코드로 바꾸고 알림 → 알림을 들은 확장이 메시지를 저장된 글(원문)로 통째 다시 그림 → 미리 보기 · 진행 줄이 지워지고
//   틀은 다시 원문 코드 → 다음 그림이 또 틀을 바꾸고 또 알림 … (리그: 25초에 알림 77번 · 본문 통째 다시 쓰기 156번 · 미리 보기 한글 문단 0).
//   고친 뒤: 알림 뒤 미리 보기가 사라졌으면 이번 번역 동안 틀을 더 바꾸지 않고 미리 보기만 다시 그린다 (createFrameSwapGuard).
// 가상 화면 모형으로 고리를 돌려 보고, index.js 가 그 가드를 미리 보기 그림에 쓰는지 본다. node tools/tests/translator-preview-rerender-loop.mjs [테마 뿌리, 기본 .]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.'), dir = path.join(root, 'src/addons/translator');
const { createFrameSwapGuard } = await import(pathToFileURL(path.join(dir, 'preview-frames.js')));
const source = fs.readFileSync(path.join(dir, 'index.js'), 'utf8');

let passed = 0, failed = 0;
function check(name, fn) {
    try { fn(); passed++; console.log('PASS ' + name); }
    catch (error) { failed++; console.error('FAIL ' + name + '\n  ' + (error?.stack || error)); }
}

/**
 * 번역 미리 보기 한 번을 흉내 낸다. 화면: 틀 코드(orig · ko) · 미리 보기가 보이나 · 진행 줄이 붙어 있나.
 * listener: 'none'(헬퍼만 — 틀만 다시 그림) · 'rewrite'(알림을 듣고 메시지를 저장된 원문으로 통째 다시 그림, ST-Prompt-Template 같은 것) ·
 *           'late'(통째 다시 그림이 알림이 끝난 뒤 늦게 — 가드는 미리 보기가 보인다고 본다)
 * chunks: 번역 글 조각이 올 때마다 한 번 그린다.
 */
function simulate({ guard = null, listener = 'none', chunks = 100 } = {}) {
    const view = { code: 'orig', shown: false, badge: true };
    let notified = 0, wipes = 0, badgeGone = 0, lateWipe = false;
    const wipe = () => { view.code = 'orig'; view.shown = false; if (view.badge) { view.badge = false; badgeGone++; } wipes++; };
    const paint = () => {
        if (lateWipe) { lateWipe = false; wipe(); }
        const swap = guard ? guard.allowed() : true;   // index.js: frameGuard.allowed() && canNotifyRerender(index)
        const swapped = swap && view.code !== 'ko';
        if (swapped) view.code = 'ko';
        view.shown = true;
        if (!swapped) return;
        notified++;
        // MESSAGE_UPDATED — 모든 청취자가 끝난 뒤 settled
        if (listener === 'rewrite') wipe();
        if (listener === 'late') lateWipe = true;
        if (guard?.settled({ notified: true, shown: view.shown })) { view.badge = true; paint(); }   // 진행 줄도 제자리에 · 미리 보기 곧바로 다시
    };
    for (let i = 0; i < chunks; i++) { if (!view.badge) view.badge = true; /* 진행 줄 1초 타이머 */ paint(); }
    return { notified, wipes, badgeGone, view };
}

check('고치기 전 모형: 통째 다시 그리는 확장이 있으면 그림마다 알림 · 다시 그리기가 돈다 (제보 재현)', () => {
    const r = simulate({ listener: 'rewrite', chunks: 100 });
    assert.equal(r.notified, 100);
    assert.equal(r.wipes, 100);
    assert.equal(r.view.code, 'orig', '틀은 매번 원문으로 돌아온다');
});

check('가드: 통째 다시 그리기가 한 번 지우면 그 뒤로 틀을 안 바꾸고 미리 보기는 보인다', () => {
    const r = simulate({ guard: createFrameSwapGuard(), listener: 'rewrite', chunks: 100 });
    assert.equal(r.notified, 1, '알림은 한 번만');
    assert.equal(r.wipes, 1, '통째 다시 그리기도 한 번만');
    assert.equal(r.view.shown, true, '미리 보기가 화면에 있다');
    assert.equal(r.view.badge, true, '진행 줄이 붙어 있다');
    assert.equal(r.view.code, 'orig', '번역 중 틀은 원문 코드 그대로 (끝 그림에서 바뀜)');
});

check('가드: 헬퍼만 있으면(통째 다시 그리기 없음) 3.1.4 처럼 번역 중에도 틀이 번역된 코드로 한 번 바뀐다', () => {
    const r = simulate({ guard: createFrameSwapGuard(), listener: 'none', chunks: 100 });
    assert.equal(r.notified, 1);
    assert.equal(r.wipes, 0);
    assert.equal(r.view.code, 'ko');
    assert.equal(r.view.shown, true);
});

check('가드: 알림이 끝난 뒤 늦게 다시 그리는 확장이어도 알림은 한 번역에 8번까지', () => {
    const r = simulate({ guard: createFrameSwapGuard(), listener: 'late', chunks: 100 });
    assert.ok(r.notified <= 8, `알림 ${r.notified}번`);
    const unguarded = simulate({ listener: 'late', chunks: 100 });
    assert.ok(unguarded.notified >= 50, `가드 없으면 ${unguarded.notified}번 (모형 확인)`);
});

check('가드: 알림을 못 보냈으면(헬퍼 없음 · 중첩) 세지 않는다', () => {
    const g = createFrameSwapGuard({ limit: 2 });
    assert.equal(g.settled({ notified: false, shown: false }), false);
    assert.equal(g.allowed(), true);
    assert.equal(g.settled({ notified: true, shown: null }), false, '화면을 못 찾으면 모름 — 끄지 않는다');
    assert.equal(g.settled({ notified: true, shown: true }), false);
    assert.equal(g.allowed(), false, 'limit 에 닿으면 끈다');
    assert.equal(g.sent, 2);
});

check('index.js: 미리 보기마다 가드를 만들고 틀 바꾸기 · 알림 뒤 처리에 쓴다', () => {
    const start = source.indexOf('function translationPreview(');
    assert.ok(start > 0, 'translationPreview 있음');
    const body = source.slice(start, source.indexOf('\n}\n', start));
    assert.match(body, /const frameGuard = createFrameSwapGuard\(\)/);
    assert.match(body, /const swap = frameGuard\.allowed\(\) && typeof canNotifyRerender === 'function' && canNotifyRerender\(index\)/);
    assert.match(body, /Promise\.resolve\(notifyRerender\(index,[\s\S]{0,80}?\)\.then\(notified =>/);
    assert.match(body, /frameGuard\.settled\(\{ notified, shown: view \? previewShown\(view, \{ keep: isProgressBadge \}\) : null \}\)/);
    assert.match(body, /view\.prepend\(badge\)/, '지워진 진행 줄을 곧바로 제자리에');
    assert.match(source, /import \{[^}]*createFrameSwapGuard[^}]*\} from '\.\/preview-frames\.js'/);
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
