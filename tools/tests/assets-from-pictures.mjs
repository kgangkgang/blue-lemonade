// 캐릭터 에셋 1.7.6 「이 채팅의 그림 확장 그림을 에셋으로」 (from-pictures.js) + 「에셋 그림 떼기」가 뗀 선택을 숨겨 두기 (strip-chat.js) — 가상 채팅만.
//   에셋 → 떼기(선택 숨김) → 그림 확장이 표식을 제 자리로 → 그림을 에셋으로(숨긴 선택 그대로 · 모델 없음) → 다시 떼면 같은 표식 id 왕복,
//   예전 에셋이 아닌 그림은 새 자리 + 「고르는 중」(메시지마다 고르기 한 번), 그리는 중 · 고를 수 없는 자리는 그대로, 되돌리기는 바이트 그대로.
//   새 자리는 번역기 · 다시 쓰기 · TTS · 메시지 작업 · 본문 모델 글 빼기가 지키는 꼴 그대로.
//   node tools/tests/assets-from-pictures.mjs [테마 뿌리, 기본 .]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const imp = rel => import(pathToFileURL(path.join(root, rel)));
const fp = await imp('src/addons/assets/from-pictures.js');
const strip = await imp('src/addons/assets/strip-chat.js');
const slots = await imp('src/addons/assets/slots.js');
const work = await imp('src/message-work.js');
const rewrite = await imp('src/addons/rewrite/core.js');
let n = 0;
const t = async (name, fn) => { await fn(); n++; console.log(`  PASS  ${name}`); };

const S = id => slots.slotMarkup(id), G = id => slots.goneMarkup(id);
const P = id => `<span class="autopic-image-slot" data-autopic-slot="${id}">[AutoPic 이미지]</span>`;   // 그림 확장이 저장하는 모양
const ids = (() => { let k = 0; return () => `asnew${String(++k).padStart(7, '0')}`; });

// 그림 확장 흉내: 표식 → 제 그림 자리 (assetWas 를 기억) — 실제 확장은 제 기록에 남긴다
function pictureExtension(chat) {
    const was = new Map();
    let k = 0;
    chat.forEach((message, index) => {
        if (typeof message?.mes !== 'string') return;
        const swap = text => text.replace(/<span class="bl-asset-gone" data-asset-was="([\w-]+)"><\/span>/g, (_, id) => { const pid = `ap-${index}-${++k}`; was.set(`${index}:${pid}`, id); return P(pid); });
        message.mes = swap(message.mes);
        if (Array.isArray(message.swipes)) message.swipes[Number(message.swipe_id) || 0] = message.mes;
    });
    return { answer: (index, id) => ({ assetWas: was.get(`${index}:${id}`) ?? '' }), was };
}

const fixture = () => [
    { name: 'User', is_user: true, mes: 'Shall we walk to the harbor?', extra: {} },
    {
        name: 'Mina', is_user: false, swipe_id: 0,
        mes: `The wind rose.\n\n${S('as111111111111')}"Look at the boats."\n\n${S('as222222222222')}"And the lighthouse."`,
        swipes: [`The wind rose.\n\n${S('as111111111111')}"Look at the boats."\n\n${S('as222222222222')}"And the lighthouse."`, `Rain began.\n\n${S('as333333333333')}"Let's go inside."`],
        extra: { api: 'x', bl_asset_slots: { as111111111111: { name: 'mina_smile.png', pending: false }, as222222222222: { name: 'mina_wave.png', pending: false, manual: true } }, model: 'm' },
        swipe_info: [
            { send_date: 'd0', extra: { api: 'x', bl_asset_slots: { as111111111111: { name: 'mina_smile.png', pending: false }, as222222222222: { name: 'mina_wave.png', pending: false, manual: true } } } },
            { send_date: 'd1', extra: { bl_asset_slots: { as333333333333: { name: 'mina_rain.png' } } } },
        ],
    },
    { name: 'Mina', is_user: false, mes: 'She smiled. {{img::mina_laugh.png}} Then she waved.', extra: {} },
];

await t('떼기: 뗀 선택을 extra.bl_asset_gone_slots 에 숨겨 둔다 (자리 기록 · {{img::}} 원문, 다른 스와이프는 그 swipe_info) — 되돌리면 숨긴 칸도 없어진다', () => {
    const chat = fixture(), json = JSON.stringify(chat);
    const record = strip.stripChat(chat);
    const m = chat[1];
    assert.deepEqual(m.extra.bl_asset_gone_slots, { as111111111111: { name: 'mina_smile.png', pending: false }, as222222222222: { name: 'mina_wave.png', pending: false, manual: true } });
    assert.deepEqual(m.swipe_info[0].extra.bl_asset_gone_slots, m.extra.bl_asset_gone_slots, '지금 스와이프 거울');
    assert.deepEqual(m.swipe_info[1].extra.bl_asset_gone_slots, { as333333333333: { name: 'mina_rain.png' } }, '다른 스와이프는 그 칸에');
    assert.deepEqual(chat[2].extra.bl_asset_gone_slots, { 'img-1': { tag: '{{img::mina_laugh.png}}' } }, '태그 원문');
    assert.ok(!('bl_asset_slots' in m.extra), '자리 기록은 그대로 지움 (그리지 않음)');
    strip.undoStrip(chat, record);
    assert.equal(JSON.stringify(chat), json, '되돌리기 바이트 그대로');
});

await t('왕복: 에셋 → 떼기 → 그림 확장 자리 → 에셋으로 = 같은 자리 · 같은 선택 · 태그 원문 (모델 호출 0) → 다시 떼면 같은 표식 id', () => {
    const chat = fixture();
    strip.stripChat(chat);
    const ext = pictureExtension(chat);
    assert.equal(chat[1].mes, `The wind rose.\n\n${P('ap-1-1')}"Look at the boats."\n\n${P('ap-1-2')}"And the lighthouse."`);
    const plan = fp.planFromPictures(chat, { answer: ext.answer, canPick: () => { throw new Error('되살릴 때는 묻지 않음'); } });
    assert.deepEqual(plan.counts, { pictures: 3, restore: 3, pick: 0, busy: 0, keep: 0, messages: 2, calls: 0 });
    const record = fp.applyFromPictures(chat, plan, () => { throw new Error('새 id 없음'); });
    const m = chat[1];
    assert.equal(m.mes, `The wind rose.\n\n${S('as111111111111')}"Look at the boats."\n\n${S('as222222222222')}"And the lighthouse."`);
    assert.equal(m.swipes[0], m.mes);
    assert.equal(m.swipes[1], `Rain began.\n\n${G('as333333333333')}"Let's go inside."`, '다른 스와이프는 그대로');
    assert.deepEqual(m.extra.bl_asset_slots, { as111111111111: { name: 'mina_smile.png', pending: false }, as222222222222: { name: 'mina_wave.png', pending: false, manual: true } });
    assert.deepEqual(m.swipe_info[0].extra.bl_asset_slots, m.extra.bl_asset_slots);
    assert.ok(!('bl_asset_gone_slots' in m.extra) && !('bl_asset_gone_slots' in m.swipe_info[0].extra), '되살린 선택은 숨긴 칸에서 빠짐');
    assert.deepEqual(m.swipe_info[1].extra.bl_asset_gone_slots, { as333333333333: { name: 'mina_rain.png' } }, '다른 스와이프의 숨긴 칸은 그대로');
    assert.equal(chat[2].mes, 'She smiled. {{img::mina_laugh.png}} Then she waved.', '태그 원문 그대로');
    assert.deepEqual(record.pairs, [{ index: 1, id: 'ap-1-1', assetId: 'as111111111111' }, { index: 1, id: 'ap-1-2', assetId: 'as222222222222' }, { index: 2, id: 'ap-2-3', assetId: 'img-1' }]);
    assert.deepEqual([record.restored, record.picked, record.picks], [3, 0, []]);
    // 다시 떼면 그림 확장이 숨겨 둔 그림을 찾을 표식 id 가 pairs 의 assetId 와 같다
    strip.stripChat(chat);
    assert.deepEqual(slots.slotIds(chat[1].mes), []);
    assert.deepEqual([...chat[1].mes.matchAll(/data-asset-was="([\w-]+)"/g)].map(x => x[1]), ['as111111111111', 'as222222222222']);
    assert.deepEqual([...chat[2].mes.matchAll(/data-asset-was="([\w-]+)"/g)].map(x => x[1]), ['img-1']);
});

await t('예전 에셋이 아닌 그림: 새 자리 + 「고르는 중」 · 고르기는 메시지마다 한 번 · 그리는 중 · 고를 수 없는 자리는 그대로 · 번역문도 같은 자리', () => {
    const chat = [
        { name: 'Mina', is_user: false, mes: `A.\n\n${P('p1')}"B."\n\n${P('p2')}"C."`, swipes: [`A.\n\n${P('p1')}"B."\n\n${P('p2')}"C."`], swipe_id: 0,
            extra: { display_text: `가.\n\n${P('p1')}"나."\n\n${P('p2')}"다."` }, swipe_info: [{ extra: {} }] },
        { name: 'Ren', is_user: false, mes: `D.\n\n${P('p3')}"E."`, extra: {} },
        { name: 'Ren', is_user: false, mes: `F.\n\n${P('p4')}"G."\n\n${P('p5')}"H."`, extra: {} },
        { name: 'Mina', is_user: false, mes: `I.\n\n${P('p6')}`, extra: { bl_asset_gone_slots: { asold: { name: '', pending: true } } } },
    ];
    const answer = (index, id) => ({ p4: { busy: true }, p6: { assetWas: 'asold' } }[id] ?? {});
    const canPick = message => message.name === 'Mina' || message.mes.startsWith('F.');
    const plan = fp.planFromPictures(chat, { answer, canPick });
    assert.deepEqual(plan.counts, { pictures: 6, restore: 0, pick: 4, busy: 1, keep: 1, messages: 3, calls: 3 }, '고르던 중이던 숨긴 기록(asold)은 새로 고름');
    const make = ids();
    const json3 = JSON.stringify(chat[1]);
    const record = fp.applyFromPictures(chat, plan, make);
    assert.equal(chat[0].mes, `A.\n\n${S('asnew0000001')}"B."\n\n${S('asnew0000002')}"C."`);
    assert.equal(chat[0].swipes[0], chat[0].mes);
    assert.equal(chat[0].extra.display_text, `가.\n\n${S('asnew0000001')}"나."\n\n${S('asnew0000002')}"다."`, '번역문도 같은 자리');
    assert.deepEqual(chat[0].extra.bl_asset_slots, { asnew0000001: { name: '', pending: true }, asnew0000002: { name: '', pending: true } });
    assert.deepEqual(chat[0].swipe_info[0].extra.bl_asset_slots, chat[0].extra.bl_asset_slots, '스와이프 거울');
    assert.equal(JSON.stringify(chat[1]), json3, '고를 수 없는 메시지는 그대로');
    assert.equal(chat[2].mes, `F.\n\n${P('p4')}"G."\n\n${S('asnew0000003')}"H."`, '그리는 중인 자리는 그대로');
    assert.deepEqual(record.picks, [{ index: 0, swipe: 0, ids: ['asnew0000001', 'asnew0000002'] }, { index: 2, swipe: 0, ids: ['asnew0000003'] }, { index: 3, swipe: 0, ids: ['asnew0000004'] }]);
    assert.deepEqual([record.restored, record.picked, record.messages], [0, 4, 3]);
    assert.ok(!('bl_asset_gone_slots' in chat[3].extra) || !chat[3].extra.bl_asset_gone_slots.asnew0000004, '새 자리는 숨긴 칸에 없음');
});

await t('새 자리 · 되살린 태그는 지키는 꼴 그대로: 번역기 보호 · 본문 모델 글에서 빠짐 · 메시지 작업 · 다시 쓰기 · TTS · 고르는 모델 글에서 빠짐', () => {
    const reset = re => { re.lastIndex = 0; return re; };
    const slot = S('asnew0000001');
    assert.ok(reset(slots.PROTECT_RE).test(slot));
    assert.equal(slots.stripSlotsForPrompt(`A\n\n${slot}\nB`), 'A\nB');
    assert.ok(reset(work.ASSET_SLOT).test(slot));
    assert.ok(reset(rewrite.SLOT_RE).test(slot));
    assert.ok(read('src/addons/tts/src/text.js').includes(`export const SLOT_RE = /${rewrite.SLOT_RE.source}/g;`), 'TTS 와 같은 식');
    assert.equal(slots.stripSlots(`A\n\n${slot}\n\nB`), 'A\n\nB');
    assert.ok(reset(rewrite.SLOT_RE).test(P('p1')), '바꾸기 전 그림 자리도 지킴 (바뀌는 동안)');
    assert.deepEqual(fp.pictureIds(`${P('a-1')} x ${P('b_2')} <span class="autopic-image-slot">[AutoPic 이미지]</span>`), ['a-1', 'b_2'], '번호 없는 껍데기는 그림 자리 아님');
});

await t('되돌리기: 바이트 그대로 (키 순서까지) · 되살릴 그림 자리 목록 · 그 사이 바뀐 메시지는 건너뜀 · 두 번째는 건너뜀', () => {
    const chat = fixture();
    strip.stripChat(chat);
    const ext = pictureExtension(chat);
    chat.push({ name: 'Mina', is_user: false, mes: `New.\n\n${P('fresh')}"Hi."`, extra: { api: 'y' } });
    const json = JSON.stringify(chat);
    const plan = fp.planFromPictures(chat, { answer: ext.answer, canPick: () => true });
    assert.equal(plan.counts.calls, 1);
    const record = fp.applyFromPictures(chat, plan, ids());
    let result = fp.undoFromPictures(chat, record);
    assert.deepEqual([result.restored, result.skipped, result.indexes], [3, 0, [1, 2, 3]]);
    assert.deepEqual(result.pictures, [{ index: 1, id: 'ap-1-1' }, { index: 1, id: 'ap-1-2' }, { index: 2, id: 'ap-2-3' }, { index: 3, id: 'fresh' }]);
    assert.equal(JSON.stringify(chat), json);
    assert.equal(fp.undoFromPictures(chat, record).restored, 0, '이미 되돌림');
    const again = JSON.parse(json), rec2 = fp.applyFromPictures(again, fp.planFromPictures(again, { answer: ext.answer, canPick: () => true }), ids());
    again[3].mes += ' (edited)';
    result = fp.undoFromPictures(again, rec2);
    assert.deepEqual([result.restored, result.skipped], [2, 1], '편집한 메시지만 그대로');
    assert.ok(again[3].mes.includes('data-asset-slot'));
});

await t('배선: 머리 줄 「에셋으로」 단추(숨김 · 그림 확장이 답할 때만) · 묻고 나서 · 모델 호출 수 · 저장 · ↶ · 그림 확장 알림 · 그림 확장 쪽 단추가 부르는 길 · 판 1.7.6', () => {
    const panel = read('src/addons/assets/panel.js');
    assert.match(panel, /<button type="button" class="eh-icon-btn eh-icon-btn--labeled" data-act="from-pictures" title="이 채팅의 그림 확장 그림을 에셋으로" aria-label="이 채팅의 그림 확장 그림을 에셋으로" hidden><i class="fa-solid fa-right-left" aria-hidden="true"><\/i><span class="eh-icon-btn-label" aria-hidden="true">에셋으로<\/span><\/button>/);
    assert.match(panel, /에셋 떼기<\/span><\/button>\n\s+<button type="button" class="eh-icon-btn eh-icon-btn--labeled" data-act="from-pictures"/, '「에셋 떼기」 바로 옆');
    assert.match(read('src/addons/assets/style.css'), /#char_assets_settings \.eh-icon-btn\[hidden\] \{ display: none !important; \}/);
    const fn = panel.slice(panel.indexOf('export async function picturesToAssets()'), panel.indexOf('\nconst mbText'));
    assert.match(fn, /if \(!reply\.supported\)/);
    assert.match(fn, /모두 \$\{c\.calls\}번 불러요/);
    assert.match(fn, /const ok = await ask\(lines\.join\('\\n'\), \{ ok: c\.pick \? `바꾸기 · 모델 \$\{c\.calls\}번` : '바꾸기'/);
    assert.ok(fn.indexOf('await ask(') < fn.indexOf('applyFromPictures(chat, plan)') && fn.indexOf('applyFromPictures(chat, plan)') < fn.indexOf('pickSlots(record.picks'), '묻기 → 바꾸기 → 고르기');
    assert.match(fn, /if \(plan\.counts\.calls > c\.calls\)/, '물은 수보다 모델을 더 부르지 않음');
    assert.equal((fn.match(/await saveChatConditional\(\)/g) || []).length, 2, '바꾸기 한 번 · 되돌리기 한 번');
    assert.match(fn, /tellPictures\(PICTURE_EVENTS\.replaced, chat, record\.pairs\);[^\n]*\n\s+redrawMessages/, '저장 · 다시 그리기 전에 알림');
    assert.match(fn, /tellPictures\(PICTURE_EVENTS\.restored, now\.chat, result\.pictures\)/);
    assert.match(panel, /case 'from-pictures':\n\s+await picturesToAssets\(\);/);
    assert.match(panel, /document\.addEventListener\(PICTURE_EVENTS\.hello, syncPictureButton\)/);
    const after = read('src/addons/assets/after-reply.js');
    const ps = after.slice(after.indexOf('export async function pickSlots('), after.indexOf('/** 고른 뒤 다시 그리기'));
    assert.match(ps, /for \(const \{ index, swipe, ids \} of list\) \{[\s\S]*await fill\(index, message, alive, swipe\);/, '메시지마다 차례로 한 번');
    assert.match(read('src/addons/assets/index.js'), /document\.addEventListener\(PICTURE_EVENTS\.open, event => \{\n\s+if \(event\.detail && typeof event\.detail === 'object'\) event\.detail\.handled = true;/);
    assert.deepEqual(fp.PICTURE_EVENTS, { query: 'bl-asset-pictures:query', replaced: 'bl-asset-pictures:replaced', restored: 'bl-asset-pictures:restored', open: 'bl-asset-pictures:open', hello: 'bl-asset-pictures:hello', changed: 'bl-asset-pictures:changed' });
    const stripFn = panel.slice(panel.indexOf('async function stripThisChat()'), panel.indexOf('\n}', panel.indexOf('async function stripThisChat()')));
    assert.equal((stripFn.match(/tellChanged\((?:now\.)?chat\);/g) || []).length, 2, '떼기 · 되돌리기 뒤 그림 확장에 알림');
    const src = read('src/addons/assets/from-pictures.js');
    assert.ok(!/import[^\n]*(script\.js|extensions\.js|assets\.js|store\.js)|fetch\(|deleteAsset|\/api\//.test(src), '실리태번 · 파일 · 서버 길 없음');
    assert.match(read('.github/workflows/release-check.yml'), /node tools\/tests\/assets-from-pictures\.mjs \./);
});

console.log(`assets-from-pictures: ${n} passed, 0 failed`);
