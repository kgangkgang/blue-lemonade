// 테마 6.2.5 캐릭터 에셋 — 답장의 그림 자리를 꾹 눌러 「이 자리만」 다른 그림으로 넘기기 · 빼기.
// slots.js(실리태번을 부르지 않음)의 고를 그림 목록 · 사용자가 정한 자리 기록 · 다시 고르기 대상을 그대로 시험하고,
// hold.js · viewer.js · after-reply.js · render.js · style.css 는 원문으로 연결을 본다 (폰 탭: touchend 를 막지 않음 · 채팅의 자리에서만 · 그 자리만 저장).
//   node tools/tests/assets-slot-pick.mjs .
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const theme = path.resolve(process.argv[2] || path.join(path.dirname(fileURLToPath(import.meta.url)), '../..'));
const read = rel => fs.readFileSync(path.join(theme, rel), 'utf8');
const S = await import(pathToFileURL(path.join(theme, 'src/addons/assets/slots.js')).href);

let passed = 0, failed = 0;
async function test(name, fn) { try { await fn(); passed++; console.log('PASS ' + name); } catch (e) { failed++; console.error('FAIL ' + name + '\n' + e.stack); } }

const asset = (file, folder = 'Mina') => ({ file, base: file.replace(/\.[^.]+$/, ''), folder });
const names = list => list.map(a => a.file);

// ---------- 고를 그림 목록
await test('slotChoices: same character only (Name_ prefix), expressions grouped with the un-numbered file first, start = the picture in the slot', () => {
    const all = ['Mina_smile-2.png', 'Rook_smile.png', 'Mina_angry.png', 'Mina_smile.png', 'Mina_smile-1.png', 'Rook_cry.png', 'Mina_sad.webp'].map(f => asset(f));
    const current = all[4];   // Mina_smile-1
    const { items, start } = S.slotChoices(all, current);
    assert.deepEqual(names(items), ['Mina_angry.png', 'Mina_sad.webp', 'Mina_smile.png', 'Mina_smile-1.png', 'Mina_smile-2.png']);
    assert.equal(items[start], current);
    assert.ok(items.includes(current), 'the same object (the viewer renames and deletes by identity)');
});
await test('slotChoices: pictures already in this reply and switched-off pictures are skipped, the slot picture itself always stays', () => {
    const all = ['Mina_smile.png', 'Mina_angry.png', 'Mina_surprised.png', 'Mina_sad.png'].map(f => asset(f));
    const current = all[2];
    const { items } = S.slotChoices(all, current, { shown: ['MINA_ANGRY.PNG', 'Mina_surprised.png'], off: a => a.file === 'Mina_sad.png' || a === current });
    assert.deepEqual(names(items), ['Mina_smile.png', 'Mina_surprised.png'], 'a repeat of another slot (case-insensitive) and an off picture are gone; the current one stays even if off or shown');
});
await test('slotChoices: no owner prefix or nobody else of that character → the whole list; a same-named file from another folder is not offered twice', () => {
    const flat = ['smile.png', 'angry.png', 'cry.png'].map(f => asset(f, 'Solo'));
    assert.deepEqual(names(S.slotChoices(flat, flat[0]).items), ['angry.png', 'cry.png', 'smile.png'], 'lower-case names are not characters (strict split)');
    const lonely = [asset('Mina_smile.png'), asset('Rook_cry.png'), asset('Rook_smile.png')];
    assert.deepEqual(names(S.slotChoices(lonely, lonely[0]).items), ['Mina_smile.png', 'Rook_cry.png', 'Rook_smile.png'], 'Mina has nothing else → all');
    const hidden = asset('Mina_smile.png', 'Mina/preset');   // a preset copy hidden behind the merged list's own file
    const merged = [asset('Mina_smile.png'), asset('Mina_angry.png')];
    const { items, start } = S.slotChoices(merged, hidden);
    assert.deepEqual(items.map(a => `${a.folder}/${a.file}`), ['Mina/Mina_angry.png', 'Mina/preset/Mina_smile.png']);
    assert.equal(items[start], hidden, 'the slot picture is added even when it is not in the merged list');
    assert.deepEqual(S.slotChoices([], null), { items: [], start: 0 });
});

// ---------- 기록 · 다시 고르기
await test('manual records: a pick shows the file, a removal shows nothing; both are marked manual', () => {
    assert.deepEqual(S.manualRecord('Mina_sad.png'), { name: 'Mina_sad.png', pending: false, manual: true });
    assert.deepEqual(S.manualRecord(''), { name: '', pending: false, manual: true });
    assert.deepEqual(S.slotView(S.manualRecord('Mina_sad.png')), { state: 'img', name: 'Mina_sad.png' });
    assert.deepEqual(S.slotView(S.manualRecord('')), { state: 'none' }, 'removed → no retry button either');
    assert.equal(S.isManual(S.manualRecord('')), true);
    assert.equal(S.isManual({ name: 'x.png', pending: false }), false);
    assert.equal(S.isManual(null), false);
});
await test('retryTargets: the pressed slot + empty/failed/interrupted ones, never a slot the user set (even when emptied) or one still running', () => {
    const map = { a: { name: '', pending: false, error: 'missing' }, b: S.manualRecord(''), c: { name: 'x.png', pending: false }, d: { name: '', pending: true }, e: { name: '', pending: true }, f: S.manualRecord('y.png') };
    const running = new Set(['e']);
    assert.deepEqual(S.retryTargets(['a', 'b', 'c', 'd', 'e', 'f'], map, running, 'a'), ['a', 'd']);
    assert.deepEqual(S.retryTargets(['a', 'b'], map, running, 'b'), ['a', 'b'], 'the pressed slot is always asked (the retry button only shows on failed slots)');
    assert.deepEqual(S.retryTargets(['z'], undefined, null, ''), [], 'no records');
});
await test('freezeOthers: the other automatic slots that show a picture become manual with the file on screen; the set slot, manual, pending and empty slots are left', () => {
    const map = { a: { name: 'Mina_smile.png', pending: false }, b: { name: 'Mina_smile.png', pending: false }, c: S.manualRecord('Mina_cry.png'), d: { name: '', pending: true }, e: { name: '', pending: false, error: 'missing' } };
    const shown = { a: 'Mina_smile-1.png', b: 'Mina_smile.png', c: 'Mina_cry.png', d: '', f: 'Mina_sad.png' };
    assert.deepEqual(S.freezeOthers(map, shown, 'a'), { b: S.manualRecord('Mina_smile.png') }, 'b keeps the variant it shows; c already manual, d pending, e empty, f unknown slot');
    assert.deepEqual(S.freezeOthers(map, shown, 'b'), { a: S.manualRecord('Mina_smile-1.png') });
    assert.deepEqual(S.freezeOthers(undefined, undefined, 'a'), {});
});
await test('writing one manual slot changes only that slot of that swipe (extra and its swipe_info mirror); other slots and swipes stay', () => {
    const text = `A\n\n${S.slotMarkup('s1')}\n\n「hi」\n\n${S.slotMarkup('s2')}\n\n“yo”`;
    const other = { s9: { name: 'Mina_cry.png', pending: false } };
    const mes = { mes: text, swipe_id: 1, swipes: ['old', text], swipe_info: [{ extra: { [S.RECORD_KEY]: other } }, { extra: { [S.RECORD_KEY]: { s1: { name: 'Mina_smile.png', pending: false }, s2: { name: 'Mina_angry.png', pending: false } } } }],
        extra: { [S.RECORD_KEY]: { s1: { name: 'Mina_smile.png', pending: false }, s2: { name: 'Mina_angry.png', pending: false } } } };
    S.writeRecords(mes, S.swipeOf(mes), { s1: S.manualRecord('Mina_sad.png') });
    assert.deepEqual(mes.extra[S.RECORD_KEY], { s1: { name: 'Mina_sad.png', pending: false, manual: true }, s2: { name: 'Mina_angry.png', pending: false } });
    assert.deepEqual(mes.swipe_info[1].extra[S.RECORD_KEY], mes.extra[S.RECORD_KEY]);
    assert.deepEqual(mes.swipe_info[0].extra[S.RECORD_KEY], other, 'another swipe is untouched');
    assert.equal(mes.mes, text, 'the message text never changes');
});

// ---------- 연결 (원문)
await test('hold.js: the slot is taken at press time from #chat only, passed on timer and long-press menu; no touch event is cancelled', () => {
    const hold = read('src/addons/assets/hold.js');
    assert.match(hold, /slot: slotAt\(img\)/, 'remembered at pointerdown (the image may be redrawn during the 0.5 s)');
    assert.match(hold, /const \{ id, src, slot \} = press;[\s\S]*?open\(src, slot\);/);
    assert.match(hold, /open\(src, slotAt\(img\)\);/, 'phone long-press menu / PC right click');
    assert.match(hold, /closest\?\.\('#chat \.mes\[mesid\]'\)/, 'bookmark cards and notes outside the chat keep the plain viewer');
    assert.match(hold, /\(slot && slotItems\(src, slot\)\) \|\| viewerItems\(src\)/, 'falls back to the plain viewer when the slot has no picked picture');
    assert.match(hold, /if \(!home\?\.record\?\.name\) return null;/);
    assert.ok(!/touchend|touchstart/.test(hold), 'pointer events only — a cancelled touchend would kill the phone click (6.1.9 review)');
    assert.ok(!/preventDefault\(\)[^\n]*pointer(down|up)/.test(hold));
});
await test('viewer.js: the 「이 자리」 row exists only when opened from a slot; ✓ is disabled on the picture already there; one click handler, no tooltips', () => {
    const viewer = read('src/addons/assets/viewer.js');
    assert.match(viewer, /export function openViewer\(\{ items, start = 0, slot = null \}\)/);
    assert.match(viewer, /const slotRow = slot \? `/);
    assert.match(viewer, /data-act="slot-use"[^\n]*<span>이 자리에<\/span>/);
    assert.match(viewer, /data-act="slot-clear"[^\n]*<span>빼기<\/span>/);
    assert.match(viewer, /if \(slotUse\) slotUse\.disabled = inSlot\(asset\);/);
    assert.match(viewer, /else if \(action === 'slot-use'\) \{ if \(!inSlot\(current\(\)\)\) onSlot\(current\(\)\.file\); \}/);
    assert.match(viewer, /else if \(action === 'slot-clear'\) onSlot\(''\);/);
    assert.match(viewer, /if \(ok\) closeViewer\(\);/);
    const row = viewer.slice(viewer.indexOf('const slotRow'), viewer.indexOf("` : '';", viewer.indexOf('const slotRow')));
    assert.ok(!/title=/.test(row), 'no tooltip');
    assert.ok(!/touchend/.test(viewer));
});
await test('after-reply.js: only that slot of that message is written, saved and redrawn; retry skips user-set slots', () => {
    const ar = read('src/addons/assets/after-reply.js');
    const body = ar.slice(ar.indexOf('export async function setSlotPick'), ar.indexOf('\n}\n', ar.indexOf('export async function setSlotPick')));
    assert.match(body, /writeRecords\(message, swipe, \{ \.\.\.freezeOthers\(map, shownSlotFiles\(id\), slotId\), \[slotId\]: manualRecord\(name\) \}\);/, 'the other slots of that reply are frozen to what they show');
    assert.match(body, /redraw\(id, message, swipe\);/);
    assert.match(body, /await saveChatConditional\(\);/);
    assert.match(body, /slotRunning\.has\(slotId\)\) return false;/, 'not while the other model is still picking');
    assert.ok(!/updateMessageBlock|toastr/.test(body), 'redraw() decides (slot element on screen → just that message)');
    assert.match(ar, /const ids = retryTargets\(slotIds\(message\.mes\), map, slotRunning, slotId\);/);
    assert.match(ar, /chat\[i\]\.mes\.includes\(slotId\) && slotIds\(chat\[i\]\.mes\)\.includes\(slotId\)/, 'found by slot id if messages before it were deleted');
});
await test('render.js: a user-set slot picture is drawn as that exact file and group randomising leaves it alone without shifting the others', () => {
    const render = read('src/addons/assets/render.js');
    assert.match(render, /const exact = isManual\(records\[id\]\);/);
    assert.match(render, /\$\{exact \? '\|m' : ''\}`;/, 'auto → manual with the same file still redraws (gets the exact mark)');
    assert.match(render, /if \(exact\) img\.dataset\.ehExact = '';/);
    const fix = render.slice(render.indexOf('function fixImages'), render.indexOf('export function redrawNow'));
    assert.ok(fix.indexOf('blockIndex++') < fix.indexOf("!img.hasAttribute('data-eh-exact')"), 'block counting happens first, so other pictures keep their picks');
    assert.match(fix, /if \(random && !img\.hasAttribute\('data-eh-exact'\)\) \{/);
});
await test('fixImages (real code): after one slot is set by hand and the others are frozen, no other slot changes its picture and nothing is shown twice', () => {
    // the group picker of render.js, run on fake <img>s — the same scenario the 6.2.5 review reproduced (two slots from one numbered group)
    const src = read('src/addons/assets/render.js');
    const grab = name => {
        const start = src.indexOf(`function ${name}(`);
        let i = name === 'fixImages' ? src.indexOf(') {', start) + 2 : src.indexOf('{', start + `function ${name}(`.length), depth = 0;
        for (let j = i; j < src.length; j++) { if (src[j] === '{') depth++; else if (src[j] === '}') { depth--; if (!depth) return src.slice(start, j + 1); } }
    };
    const code = ['fixImages', 'hashText', 'topBlockOf', 'imageVersion', 'parseCharacterUrl'].map(grab).join('\n');
    globalThis.location = { href: 'http://localhost:8000/' };
    const groupKeyOf = n => String(n).replace(/\.[^.]+$/, '').replace(/[-_.]\d+$/, '').toLowerCase();
    const files = ['Mina_smile.png', 'Mina_smile-1.png', 'Mina_smile-2.png', 'Mina_smile-3.png', 'Mina_angry.png'];
    const assets = files.map(file => ({ file, folder: 'Mina', url: `/characters/Mina/${file}`, group: groupKeyOf(file) }));
    const index = { folders: new Set(['Mina']), groups: new Map(), byName: new Map(assets.map(a => [a.file.toLowerCase(), a])) };
    for (const a of assets) { if (!index.groups.has(a.group)) index.groups.set(a.group, []); index.groups.get(a.group).push(a); }
    const make = new Function('index', 'generation', 'settings', 'messageSeed', 'lookup', 'groupKeyOf', `${code}; return fixImages;`);
    const fixImages = make(index, 1, () => ({ randomGroups: true }), () => '1730000000000|0', f => index.byName.get(f.toLowerCase()) ?? null, groupKeyOf);
    const img = (file, exact = false) => {
        const attrs = new Map([['src', `/characters/Mina/${file}`]]);
        if (exact) attrs.set('data-eh-exact', '');
        const el = { dataset: { ehSrc: `/characters/Mina/${file}` }, getAttribute: k => attrs.get(k) ?? null, hasAttribute: k => attrs.has(k), closest: () => null };
        Object.defineProperty(el, 'src', { get: () => attrs.get('src'), set: v => attrs.set('src', v) });
        return el;
    };
    const shownFile = el => el.dataset.ehFile || el.getAttribute('src').split('/').pop();
    // two automatic slots of the same numbered group
    const A = img('Mina_smile.png'), B = img('Mina_smile.png');
    fixImages({}, {}, [A, B]);
    const a0 = shownFile(A), b0 = shownFile(B);
    assert.notEqual(a0, b0, 'the picker spreads a group over the slots');
    // the user sets A to another picture → B is frozen to the file it showed (freezeOthers) and redrawn as an exact picture
    for (const pick of ['Mina_angry.png', ...files.filter(f => f.startsWith('Mina_smile') && f !== b0)]) {
        const A2 = img(pick, true), B2 = img(b0, true);
        fixImages({}, {}, [A2, B2]);
        assert.equal(shownFile(B2), b0, `B unchanged after A was set to ${pick}`);
        assert.equal(shownFile(A2), pick, 'A shows exactly the picked file');
    }
    // a slot picked later (automatic) never lands on the picture a user already set in that reply
    const seen = new Set();
    for (const pick of files.filter(f => f.startsWith('Mina_smile'))) {
        const A3 = img(pick, true), C3 = img('Mina_smile.png');
        fixImages({}, {}, [A3, C3]);
        assert.notEqual(shownFile(C3), pick, 'automatic slot avoids the user-set picture');
        seen.add(shownFile(C3));
    }
    assert.ok(seen.size >= 1);
});
await test('style.css: compact one-line slot row (412px rule), disabled ✓ dims; the theme only tints the ✓ icon', () => {
    const css = read('src/addons/assets/style.css');
    assert.match(css, /\.eh-viewer-slot \{ display: flex; justify-content: center; gap: 8px; padding: 10px 12px 0; \}/);
    assert.match(css, /@media \(max-width: 480px\) \{\s*\.eh-viewer-nav \{[^}]*\}\s*\.eh-viewer-slot \{ gap: 6px; padding: 8px 8px 0; \}/);
    assert.match(css, /\.eh-vbtn:disabled \{ opacity: \.4; cursor: default; \}/);
    assert.match(read('css/19-extwindows.css'), /html body\.salty \.eh-vbtn--accent > i \{ color:var\(--salty-accent-ink,var\(--salty-accent\)\); \}/);
});

console.log(JSON.stringify({ passed, failed }, null, 2));
process.exitCode = failed ? 1 : 0;
