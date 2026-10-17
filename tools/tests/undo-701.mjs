// 7.0.1 되돌리기 · 테마 확인 창 — ① src/ask.js(ask · attachUndo) ② 다시 쓰기 ↶(rewrite/undo.js + 배선) ③ 메모 「지웠어요 ↶」
//   ④ 브라우저 기본 confirm() · alert() 을 테마 확인 창으로 (메모 · 커스텀 CSS · 한글화 패널 · 번역 프롬프트 · 패널 · 옛 테마 CSS)
//   ⑤ 한글화 패널 「원본 적용」 전 자동 백업 · 원본으로 되돌리기 (prompt/backup.js + 배선)
//   가짜 DOM · 가짜 Popup 만 — 실리태번 · 네트워크 없음. 지어낸 글만.
//   node tools/tests/undo-701.mjs <테마 루트>   (공개 저장소는 '.')
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const atLeast = (v, min) => { const n = s => s.split('.').map(Number).reduce((a, x) => a * 1000 + x, 0); return n(v) >= n(min); };   // 7.0.2
const imp = rel => import(pathToFileURL(path.join(root, rel)).href);
let n = 0;
const t = async (name, fn) => { await fn(); n++; console.log(`  PASS  ${name}`); };

// ── 가짜 DOM (ask · attachUndo 가 쓰는 만큼)
class El {
    constructor(tag) { this.tagName = tag.toUpperCase(); this.children = []; this.attrs = {}; this.style = {}; this.className = ''; this.textContent = ''; this.handlers = {}; this.disabled = false; this.innerHTML = ''; const cls = new Set(); this.classList = { add: (...x) => x.forEach(v => cls.add(v)), has: x => cls.has(x), contains: x => cls.has(x) }; }
    append(...kids) { this.children.push(...kids); }
    setAttribute(k, v) { this.attrs[k] = String(v); }
    addEventListener(type, fn) { (this.handlers[type] ||= []).push(fn); }
    querySelector(sel) { return sel === '.toast-message' ? this.children.find(c => c.className === 'toast-message') ?? null : null; }
    click() { for (const fn of this.handlers.click || []) fn({ preventDefault() {}, stopPropagation() {} }); }
}
globalThis.document = { createElement: tag => new El(tag) };

const ask = await imp('src/ask.js');

await t('① ask: 실리태번 Popup 확인 창 · 단추 이름 · 위험 단추는 붉게 · 글은 textContent(HTML 로 안 읽음) · 확인 = true, 취소 = false', async () => {
    const shown = [];
    let answer = 1;
    class Popup { constructor(content, type, input, opts) { this.content = content; this.type = type; this.opts = opts; this.okButton = new El('div'); shown.push(this); } async show() { return answer; } }
    globalThis.SillyTavern = { getContext: () => ({ Popup, POPUP_TYPE: { CONFIRM: 2 }, POPUP_RESULT: { AFFIRMATIVE: 1, NEGATIVE: 0 } }) };
    assert.equal(await ask.ask('<b>메모</b> 를 지울까요?', { ok: '지우기', cancel: '취소', danger: true }), true);
    const p = shown[0];
    assert.equal(p.type, 2); assert.deepEqual(p.opts, { okButton: '지우기', cancelButton: '취소' });
    assert.ok(p.okButton.classList.has('redWarningBG'));
    assert.equal(p.content.children[0].textContent, '<b>메모</b> 를 지울까요?'); assert.equal(p.content.children[0].innerHTML, '', 'HTML 로 넣지 않는다');
    answer = 0;
    assert.equal(await ask.ask('다시 번역할까요?', { ok: '다시 번역' }), false);
    assert.ok(!shown[1].okButton.classList.has('redWarningBG'));
    answer = null;
    assert.equal(await ask.ask('x'), false, 'Esc · 바깥 누름은 취소');
    globalThis.SillyTavern = undefined;
    globalThis.confirm = () => true;
    assert.equal(await ask.ask('Popup 이 없으면 기본 confirm'), true);
    delete globalThis.confirm;
});

await t('① attachUndo: 알림 글 칸 끝에 ↶ 아이콘 단추(aria-label · 툴팁 없음) · 누르면 한 번만 부르고 알림을 닫는다', async () => {
    const toast = new El('div'), msg = new El('div'); msg.className = 'toast-message'; toast.append(msg);
    const cleared = [];
    globalThis.toastr = { clear: x => cleared.push(x) };
    let calls = 0;
    const button = ask.attachUndo([toast], () => { calls++; });
    assert.equal(msg.children[0], button);
    assert.equal(button.attrs['aria-label'], '되돌리기'); assert.equal(button.attrs.title, undefined);
    assert.match(button.innerHTML, /fa-rotate-left/);
    button.click(); button.click();
    await new Promise(r => setTimeout(r, 0));
    assert.equal(calls, 1); assert.equal(button.disabled, true); assert.deepEqual(cleared, [[toast]]);
    assert.equal(ask.attachUndo(null, () => {}), null, '알림이 없으면 아무것도');
});

// ── ② 다시 쓰기 ↶
const { createRewriteUndo } = await imp('src/addons/rewrite/undo.js');
await t('② 다시 쓰기 되돌리기 기록: 채팅마다 마지막 하나 · 메시지 · 스와이프 · 채팅이 바뀌었으면 안 됨 · 되돌리면 글 · 스와이프 · 토큰 수가 그대로', () => {
    const u = createRewriteUndo();
    const msg = { mes: '고친 글', swipe_id: 1, swipes: ['다른 스와이프', '고친 글'], extra: { token_count: 9 } };
    const chat = [{}, msg];
    const rec = u.remember({ chatId: 'c1', messageId: 1, message: msg, before: '원래 글', after: '고친 글', beforeSwipe: '원래 글', swipeId: 1, tokenBefore: 12 });
    assert.equal(u.check(rec, { chatId: 'c2', chat }), 'chat');
    msg.mes = '사람이 또 고친 글';
    assert.equal(u.check(rec, { chatId: 'c1', chat }), 'changed');
    msg.mes = '고친 글'; msg.swipe_id = 0;
    assert.equal(u.check(rec, { chatId: 'c1', chat }), 'changed', '다른 스와이프로 넘김');
    msg.swipe_id = 1;
    assert.equal(u.check(rec, { chatId: 'c1', chat: [{}, { ...msg }] }), 'changed', '다른 메시지 객체');
    assert.equal(u.check(rec, { chatId: 'c1', chat }), 'ok');
    u.restore(rec);
    assert.deepEqual([msg.mes, msg.swipes, msg.extra.token_count], ['원래 글', ['다른 스와이프', '원래 글'], 12]);
    assert.equal(u.check(rec, { chatId: 'c1', chat }), 'gone', '한 번만');
    const a = u.remember({ chatId: 'c1', messageId: 1, message: msg, before: 'x', after: '원래 글', swipeId: 1 });
    u.remember({ chatId: 'c1', messageId: 1, message: msg, before: 'y', after: '원래 글', swipeId: 1 });
    assert.equal(u.check(a, { chatId: 'c1', chat }), 'gone', '더 최근 고침이 있으면 옛 것은 안 됨');
    const other = u.remember({ chatId: 'c9', messageId: 0, message: { mes: 'z', extra: { token_count: 3 } }, before: 'w', after: 'z', swipeId: 0 });
    assert.equal(u.size, 2, '채팅마다 하나');
    u.restore(other); assert.equal(other.message.extra.token_count, undefined, '고치기 전 토큰 수가 없었으면 지운다');
});

await t('② 배선: 고칠 때 기록 → 알림에 ↶ · 되돌리기 차례(작업 기록 → 다시 쓰기 표시 → 글 → 그리기 → MESSAGE_UPDATED → 저장) · 판', () => {
    const src = read('src/addons/rewrite/index.js');
    assert.match(src, /undo = rewriteUndo\.remember\(\{ chatId: getContext\(\)\.getCurrentChatId\?\.\(\) \?\? '', messageId, message, before: message\.mes, after: replacement,/);
    assert.ok(src.indexOf('undo = rewriteUndo.remember(') < src.indexOf("messageWork().noteWrite(message, { by: 'rewrite', before: message.mes, after: replacement });"));
    assert.match(src, /report\(result, spans\.length, manual, undo\);/);
    assert.equal((src.match(/if \(undo && fixed > 0\) attachUndo\(toast, \(\) => undoRewrite\(undo\)\);/g) || []).length, 2, '고친 알림 · 일부 실패 알림');
    const body = src.slice(src.indexOf('async function undoRewrite(rec) {'), src.indexOf('\nfunction showReport('));
    const order = ['rewriteUndo.check(', 'messageWork().noteWrite(', 'markRewrite(message, rec.after, rec.before);', 'rewriteUndo.restore(rec);', 'updateMessageBlock(messageId, message)', 'await notifyTextChanged(messageId);', 'await saveChatConditional();'].map(x => body.indexOf(x));
    assert.ok(order.every((v, i) => v > 0 && (i === 0 || v > order[i - 1])), order.join(','));
    { const v = src.match(/const VERSION = '([\d.]+)';/)[1]; assert.ok(atLeast(v, '2.1.4'), v); assert.ok(read('src/addons/rewrite/style.css').includes(`--bwr-css-version: "${v}";`)); }   // 7.0.2 판 고정 대신 「이상」
});

// ── ③ 메모 「지웠어요 ↶」
await t('③ 메모 되살리기: 마지막 하나만 · 그 자리에 · 비어 없어진 폴더는 밖으로 · 지운 기록(gone)에서 뺌 · 300개면 안 됨', () => {
    const src = read('src/addons/notes/index.js');
    const at = src.indexOf('let lastRemoved = null;');
    const end = src.indexOf('export function removeNote(id) {', at);
    const code = src.slice(at, end).replace(/export function /g, 'function ');
    const env = { list: [], st: { gone: {} }, folders: new Set(['f1']), saved: 0, synced: 0 };
    const make = new Function('env', `const MAX_NOTES = 3; const notes = () => env.list; const store = () => env.st; const folderById = id => (env.folders.has(id) ? { id } : null);
        const save = () => { env.saved++; }; const syncLinkViews = () => { env.synced++; };\n${code}\nreturn { rememberRemoved, restoreRemoved };`);
    const N = make(env);
    env.list.push({ id: 'a', title: '첫 메모' }, { id: 'c', title: '셋째' });
    const rec = N.rememberRemoved({ id: 'b', title: '둘째', body: '본문', folder: 'f1', updated: 1 }, 1);
    env.st.gone.b = 123;
    assert.equal(N.restoreRemoved(rec), 'ok');
    assert.deepEqual(env.list.map(x => x.id), ['a', 'b', 'c']);
    assert.equal(env.list[1].folder, 'f1'); assert.ok(env.list[1].updated > 1); assert.equal(env.st.gone.b, undefined);
    assert.equal(env.saved, 1); assert.equal(env.synced, 1);
    assert.equal(N.restoreRemoved(rec), 'gone', '한 번만');
    env.list.splice(1, 1);
    const older = N.rememberRemoved({ id: 'x', title: '옛 것', folder: 'gone-folder' }, 0);
    const newer = N.rememberRemoved({ id: 'y', title: '새 것', folder: 'gone-folder' }, 0);
    assert.equal(N.restoreRemoved(older), 'gone', '더 최근에 지운 것이 있으면');
    env.list.push({ id: 'p' });
    assert.equal(N.restoreRemoved(newer), 'full', '300개(시험은 3개) 이면');
    env.list.pop();
    assert.equal(N.restoreRemoved(newer), 'ok'); assert.equal(env.list[0].folder, undefined, '폴더가 없어졌으면 밖으로');
});

await t('③ 배선: 지우기는 묻지 않고 지운 뒤 「지웠어요 ↶」(빈 메모는 알림 없음) · 판 1.3.5', () => {
    const src = read('src/addons/notes/index.js');
    const del = src.slice(src.indexOf("    else if (act === 'del') {"), src.indexOf('/** 목록 머리 버튼 누름'));
    assert.doesNotMatch(del, /confirm\(/);
    assert.match(del, /const rec = note && \(note\.title \|\| note\.body\) \? rememberRemoved\(note, index\) : null;/);
    assert.ok(del.indexOf('removeNote(id)') < del.indexOf('attachUndo(toast'), '지운 뒤에 알림');
    assert.match(del, /지웠어요\./);
    assert.ok(atLeast(read('src/addons/notes/version.js').match(/NOTES_VERSION = '([\d.]+)'/)[1], '1.3.5'));
    assert.match(read('src/modal.js'), /fixToastrForDialogs\(\)/, '메모 창(모달)이 열려 있어도 알림이 창 안에 떠서 ↶ 를 누를 수 있다');
});

// ── ④ 기본 확인 창 → 테마 확인 창
await t('④ 기본 confirm() · alert() 이 남지 않음 (패널 「처음 설정으로」는 Popup 이 없을 때만 쓰는 예비 길) · 각 자리는 ask + 하는 일 단추', () => {
    const files = ['src/addons/notes/index.js', 'src/addons/customstyle/index.js', 'src/addons/prompt/index.js', 'src/addons/prompt/localization-ui.js', 'src/addons/translator/index.js', 'src/checks.js', 'src/panel.js'];
    for (const f of files) {
        const src = read(f).split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');
        const left = [...src.matchAll(/(?<![\w.])(confirm|alert)\(/g)].map(m => src.slice(Math.max(0, m.index - 30), m.index + 40));
        const allowed = f === 'src/panel.js' ? left.filter(x => !/else ok = confirm\('테마 설정을 처음 상태로/.test(x)) : left;
        assert.deepEqual(allowed, [], f);
        assert.doesNotMatch(src, /defaultView\.confirm\(/, f);
    }
    const prompt = read('src/addons/prompt/index.js');
    assert.match(prompt, /await ask\('캐릭터 카드에 임베디드 월드북\(character_book\)이 있으면 JSON 에 함께 넣을까요\?[^']*', \{ ok: '포함', cancel: '제외' \}\)/);
    assert.match(prompt, /\{ ok: '적용', cancel: '취소', danger: true \}/, '원본 적용은 붉은 단추');
    assert.match(read('src/addons/translator/index.js'), /async deleteSelectedPrompt\(\) \{[\s\S]*?toastr\.warning\('기본 프롬프트는 지울 수 없어요\.'\)[\s\S]*?await ask\(`「\$\{selectedPrompt\.name \|\| '이 프롬프트'\}」를 지울까요\?`, \{ ok: '지우기', cancel: '취소', danger: true \}\)/);
    assert.equal((read('src/panel.js').match(/await askConfirm\(/g) || []).length, 4);
    assert.match(read('src/checks.js'), /run: async \(\) => \{\s*if \(await ask\(/);
    assert.match(read('src/addons/customstyle/index.js'), /async insertDefaultCSS\(\) \{\s*if \(!await ask\(/);
});

// ── ⑤ 한글화 패널 원본 백업
const B = await imp('src/addons/prompt/backup.js');
await t('⑤ 백업 파일 이름 · 기록: 자료마다 하나(같은 이름 → 같은 파일) · 이름에 쓸 수 없는 글자 안전 · 종류 · 이름이 맞을 때만 씀', () => {
    const a = B.backupFileName('preset', '내 프리셋 / v2'), b = B.backupFileName('preset', '내 프리셋 / v2');
    assert.equal(a, b); assert.match(a, /^pt-backup-preset-[0-9a-f]{8}\.json$/);
    assert.notEqual(B.backupFileName('wi', '내 프리셋 / v2'), a.replace('preset', 'wi').replace(/-[0-9a-f]{8}/, '-00000000'));
    assert.throws(() => B.backupFileName('nope', 'x'));
    const r = B.backupRecord('wi', 'Book', 'Book', { entries: {} }, 1760000000000);
    assert.equal(B.validBackup(r, 'wi', 'Book'), true);
    assert.equal(B.validBackup(r, 'wi', 'Other'), false); assert.equal(B.validBackup(r, 'preset', 'Book'), false); assert.equal(B.validBackup(null, 'wi', 'Book'), false);
    assert.match(B.backupWhen(new Date(2026, 9, 17, 15, 5).getTime()), /^10월 17일 오후 3:05$/);
});

await t('⑤ 봇카드 백업은 이번에 바뀌는 필드만 (V1 · V2 둘 다) — 첫 인사 목록은 배열째, 캐릭터 노트는 깊이 · 역할까지', () => {
    const char = { avatar: 'mina.png', description: 'old v1', data: { description: 'old desc', first_mes: 'hi', alternate_greetings: ['g1', 'g2'], extensions: { depth_prompt: { prompt: 'note', depth: 4, role: 'system' } }, personality: 'kind' } };
    const update = { avatar: 'mina.png', description: '새 설명', data: { description: '새 설명', alternate_greetings: ['새 g1', 'g2'], extensions: { depth_prompt: { prompt: '새 노트', depth: 4, role: 'system' } } }, alternate_greetings: ['새 g1', 'g2'] };
    const back = B.characterBackup(char, update);
    assert.deepEqual(back, { avatar: 'mina.png', description: 'old desc', alternate_greetings: ['g1', 'g2'], data: { description: 'old desc', alternate_greetings: ['g1', 'g2'], extensions: { depth_prompt: { prompt: 'note', depth: 4, role: 'system' } } } });
    assert.ok(!('personality' in back) && !('first_mes' in back.data), '안 바뀌는 필드는 담지 않는다');
    back.data.alternate_greetings.push('x'); assert.deepEqual(char.data.alternate_greetings, ['g1', 'g2'], '사본');
});

await t('⑤ 배선: 확인 → 백업(실패하면 적용 안 함) → 적용 → 알림 ↶ · 더보기 「원본으로 되돌리기」 · 되돌리기도 같은 쓰기 길 · 도움말 · 판 1.2.8', () => {
    const src = read('src/addons/prompt/index.js');
    const flow = src.slice(src.indexOf("page.querySelector(`#${idPfx}-apply`)"), src.indexOf("page.querySelector(`#${idPfx}-restore`)"));
    const order = ["const ok = await ask(", 'backup = await saveOriginalBackup(kind, srcVal, checkedIds, label);', 'await applyPresetLive(srcVal, titlesOnly);', 'attachUndo(doneToast, () => restoreOriginal(backup)'].map(x => flow.indexOf(x));
    assert.ok(order.every((v, i) => v > 0 && (i === 0 || v > order[i - 1])), order.join(','));
    assert.match(flow, /원본 백업을 만들지 못해 적용하지 않았어요[^\n]*\n\s*return;/);
    assert.equal((flow.match(/doneToast = toastr\.success\(/g) || []).length, 3);
    assert.match(src, /id="\$\{idPfx\}-restore" title="원본으로 되돌리기"/);
    assert.match(src, /await writePresetBody\(targetName, presetBody, isCurrent\);/);
    assert.match(src, /await writeWorldInfo\(worldName, wi\);/);
    assert.match(src, /const \{ idx, char, update, applied \} = await characterUpdate\(charIdRaw, selectedIds\);[\s\S]*?const isCurrent = await writeCharacterUpdate\(idx, char, update\);/);
    const restore = src.slice(src.indexOf('async function restoreOriginal(record) {'), src.indexOf('/** 7.0.1 봇카드에 쓸 필드'));
    for (const call of ['await writePresetBody(record.name,', 'await writeWorldInfo(record.name,', 'await writeCharacterUpdate(idx, characters[idx],']) assert.ok(restore.includes(call), call);
    assert.match(restore, /await ask\(`「\$\{label\}」을\(를\) 원본 적용 전으로 되돌릴까요\?/);
    assert.doesNotMatch(src, /되돌리는 단추가 없으니/); assert.doesNotMatch(read('src/addons/prompt/guide.js'), /별도로 내보내 백업하세요/);
    assert.ok(atLeast(read('src/addons/prompt/manifest.json').match(/"version": "([\d.]+)"/)[1], '1.2.8'));
});

await t('판 · CI: 커스텀 CSS 0.1.1 · 번역 2.7.5 · 이 시험 등록', () => {
    assert.match(read('src/addons/customstyle/manifest.json'), /"version": "0\.1\.1"/);
    assert.ok(atLeast(read('src/addons/translator/manifest.json').match(/"version": "([\d.]+)"/)[1], '2.7.5'));
    assert.match(read('.github/workflows/release-check.yml'), /node tools\/tests\/undo-701\.mjs \./);
});

console.log(`undo-701: ${n} passed, 0 failed`);
