// 캐릭터 에셋 1.7.3 · 1.7.4 「이 채팅의 에셋 그림 떼기」 (strip-chat.js) — 가상 채팅만.
//   여러 메시지 · 스와이프 · 저장된 번역문에 든 자리 · {{img::}} → 뗀 자리마다 위치 표시, 자리 기록은 지움, 그림 파일은 건드리지 않음,
//   되돌리기 = 채팅 JSON 바이트 그대로 (그 사이 바뀐 메시지는 건너뜀). 표시는 번역기 · 다시 쓰기 · TTS · 메시지 작업이 자리처럼 지킨다.
//   node tools/tests/assets-strip-chat.mjs [테마 뿌리, 기본 .]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const imp = rel => import(pathToFileURL(path.join(root, rel)));
const strip = await imp('src/addons/assets/strip-chat.js');
const slots = await imp('src/addons/assets/slots.js');
const work = await imp('src/message-work.js');
const rewrite = await imp('src/addons/rewrite/core.js');
const tts = await imp('src/addons/tts/src/text.js').catch(() => null);
let n = 0;
const t = async (name, fn) => { await fn(); n++; console.log(`  PASS  ${name}`); };

const S = id => slots.slotMarkup(id), G = id => slots.goneMarkup(id);
const fixture = () => [
    { name: 'User', is_user: true, mes: 'Shall we walk to the harbor?', extra: {} },
    {   // 자리 둘 · 스와이프 둘 (지금 = 0) · 번역문에도 자리
        name: 'Mina', is_user: false, swipe_id: 0,
        mes: `The wind rose.\n\n${S('as111111111111')}"Look at the boats."\n\n${S('as222222222222')}"And the lighthouse."`,
        swipes: [`The wind rose.\n\n${S('as111111111111')}"Look at the boats."\n\n${S('as222222222222')}"And the lighthouse."`, `Rain began.\n\n${S('as333333333333')}"Let's go inside."`],
        extra: { api: 'x', bl_asset_slots: { as111111111111: { name: 'mina_smile' }, as222222222222: { name: 'none' } }, display_text: `바람이 일었다.\n\n${S('as111111111111')}"배들 좀 봐."\n\n${S('as222222222222')}"등대도."`, model: 'm' },
        swipe_info: [
            { send_date: 'd0', extra: { api: 'x', bl_asset_slots: { as111111111111: { name: 'mina_smile' }, as222222222222: { name: 'none' } } } },
            { send_date: 'd1', extra: { bl_asset_slots: { as333333333333: { name: 'mina_rain' } }, display_text: `비가 내리기 시작했다.\n\n${S('as333333333333')}"들어가자."` } },
        ],
    },
    { name: 'Mina', is_user: false, mes: 'She smiled. {{img::mina_wave.png}} Then she waved again. {{img:: mina_laugh }}', extra: {} },
    { name: 'Mina', is_user: false, mes: 'No pictures here at all.', extra: { bl_asset_slots: {} } },
];

await t('셈 (확인 창): 그림 5개(지금 글 2 + 다른 스와이프 1 + 태그 2) · 메시지 2개 — 빈 기록만 있는 메시지는 안 셈 · 바꾸지 않음', () => {
    const chat = fixture(), json = JSON.stringify(chat);
    assert.deepEqual(strip.countStrip(chat), { pictures: 5, messages: 2 });
    assert.equal(JSON.stringify(chat), json, '읽기만');
});

await t('떼기: 글 · 모든 스와이프 · 번역문의 자리와 {{img::}} → 위치 표시, 자리 기록 지움, 다른 칸 그대로', () => {
    const chat = fixture();
    const record = strip.stripChat(chat);
    assert.equal(record.pictures, 5); assert.equal(record.messages, 2);
    const m = chat[1];
    assert.equal(m.mes, `The wind rose.\n\n${G('as111111111111')}"Look at the boats."\n\n${G('as222222222222')}"And the lighthouse."`);
    assert.equal(m.swipes[0], m.mes);
    assert.equal(m.swipes[1], `Rain began.\n\n${G('as333333333333')}"Let's go inside."`);
    assert.equal(m.extra.display_text, `바람이 일었다.\n\n${G('as111111111111')}"배들 좀 봐."\n\n${G('as222222222222')}"등대도."`);
    assert.equal(m.swipe_info[1].extra.display_text, `비가 내리기 시작했다.\n\n${G('as333333333333')}"들어가자."`);
    for (const extra of [m.extra, m.swipe_info[0].extra, m.swipe_info[1].extra]) assert.ok(!('bl_asset_slots' in extra), '기록 지움');
    assert.deepEqual(chat[3].extra, { bl_asset_slots: {} }, '빈 기록 · 그림 없는 메시지는 그대로');
    assert.equal(m.extra.api, 'x'); assert.equal(m.extra.model, 'm'); assert.equal(m.swipe_info[0].send_date, 'd0');
    assert.equal(chat[2].mes, `She smiled. ${G('img-1')} Then she waved again. ${G('img-2')}`);
    assert.equal(chat[0].mes, 'Shall we walk to the harbor?');
    assert.equal(strip.countStrip(chat).pictures, 0, '다시 셀 것 없음');
    assert.equal(slots.slotIds(m.mes).length, 0, '자리로 안 읽힘');
});

await t('되돌리기: 채팅 JSON 바이트 그대로 (키 순서까지) · 두 번째는 건너뜀', () => {
    const chat = fixture(), json = JSON.stringify(chat);
    const record = strip.stripChat(chat);
    const result = strip.undoStrip(chat, record);
    assert.deepEqual(result, { restored: 2, skipped: 0, indexes: [1, 2] });
    assert.equal(JSON.stringify(chat), json);
    assert.equal(strip.undoStrip(chat, record).restored, 0, '이미 되돌림 → 건너뜀');
});

await t('되돌리기: 그 사이 바뀐 메시지(편집 · 새 자리 기록)는 그대로, 나머지만', () => {
    const chat = fixture();
    const record = strip.stripChat(chat);
    chat[2].mes += ' (edited)';
    let result = strip.undoStrip(chat, record);
    assert.deepEqual([result.restored, result.skipped, result.indexes], [1, 1, [1]], '편집한 메시지만 건너뜀');
    assert.ok(chat[2].mes.endsWith(' (edited)') && chat[2].mes.includes(G('img-1')));
    const again = fixture(), rec2 = strip.stripChat(again);
    again[1].swipe_info[1].extra.bl_asset_slots = { asnew0000000000: { name: 'x' } };   // 뗀 뒤 새 자리 기록이 생김
    result = strip.undoStrip(again, rec2);
    assert.deepEqual([result.restored, result.skipped], [1, 1], '새 기록이 생긴 메시지는 그대로');
    assert.deepEqual(again[1].swipe_info[1].extra.bl_asset_slots, { asnew0000000000: { name: 'x' } });
});

await t('위치 표시는 자리처럼 지켜진다: 번역기 보호 규칙 · 본문 모델 글에서 빠짐 · 메시지 작업 · 다시 쓰기 · TTS', () => {
    const marker = G('as111111111111');
    assert.equal(marker, '<span class="bl-asset-gone" data-asset-was="as111111111111"></span>', '그림 확장이 찾을 모양');
    const reset = re => { re.lastIndex = 0; return re; };
    assert.ok(reset(slots.PROTECT_RE).test(marker) && reset(slots.PROTECT_RE).test(S('as1')), '번역기 보호 (자리 · 표시)');
    assert.equal(slots.stripSlotsForPrompt(`A\n\n${marker}\nB`), 'A\nB');
    assert.equal(slots.stripSlotsForPrompt(`A ${marker}B`), 'A B');
    assert.ok(reset(work.ASSET_SLOT).test(marker));
    assert.ok(reset(rewrite.SLOT_RE).test(marker), '다시 쓰기');
    if (tts) assert.equal(tts.SLOT_RE.source, rewrite.SLOT_RE.source, 'TTS 와 같은 식');
    else assert.ok(read('src/addons/tts/src/text.js').includes(`export const SLOT_RE = /${rewrite.SLOT_RE.source}/g;`));
    assert.match(read('src/addons/assets/style.css'), /#chat \.mes_text \[data-asset-was\] \{ display: none; \}/);
    assert.match(read('src/addons/assets/render.js'), /markGoneOnly\(text\);\n\s+fillSlots\(text, mes\);/);
});

await t('그림 파일은 건드리지 않음 · 배선 (창 머리 단추 「에셋 떼기」 글자 · 확인 창 · 한 번 저장 · ↶) · 판 1.7.5', () => {
    const src = read('src/addons/assets/strip-chat.js');
    assert.ok(!/import[^\n]*(assets\.js|store\.js|fetch|deleteAsset)/.test(src) && !/fetch\(|deleteAsset|\/api\//.test(src), '파일 · 서버 길 없음');
    const panel = read('src/addons/assets/panel.js');
    assert.match(panel, /class="eh-icon-btn eh-icon-btn--labeled" data-act="strip-chat" title="이 채팅의 에셋 그림 떼기" aria-label="이 채팅의 에셋 그림 떼기"><i class="fa-solid fa-eraser" aria-hidden="true"><\/i><span class="eh-icon-btn-label" aria-hidden="true">에셋 떼기<\/span><\/button>/);
    // 1.7.4 글자 단추: 높이는 아이콘 단추 그대로(폭만 글자만큼) · 머리 줄은 400 아래에서 이름 · 장 수를 아래 줄로
    const css = read('src/addons/assets/style.css');
    assert.match(css, /\.eh-icon-btn--labeled \{ display: inline-flex; gap: 5px; width: auto !important;/);
    assert.ok(!/\.eh-icon-btn--labeled[^{]*\{[^}]*height/.test(css), '높이는 그대로');
    assert.match(css, /@container eh-hero \(width < 400px\) \{\s*#char_assets_settings \.eh-hero:has\(\.eh-icon-btn--labeled\) \.eh-hero-text \{ order: 1; flex: 1 1 100%; \}/);
    const fn = panel.slice(panel.indexOf('async function stripThisChat()'), panel.indexOf('\n}', panel.indexOf('async function stripThisChat()')));
    assert.match(fn, /await ask\(`이 채팅의 메시지 \$\{messages\}개에서 에셋 그림 \$\{pictures\}개를 떼요/);
    assert.equal((fn.match(/await saveChatConditional\(\)/g) || []).length, 2, '떼기 한 번 · 되돌리기 한 번');
    assert.match(fn, /attachUndo\(done, async \(\) => \{/);
    assert.match(fn, /getCurrentChatId\?\.\(\) \?\? ''\) !== chatId\) \{ toast\('info', '채팅을 바꿔서 되돌리지 않았어요\.'\)/);
    assert.match(read('src/addons/assets/state.js'), /VERSION = '1\.7\.5'/);
    assert.match(read('src/addons/assets/style.css'), /--eh-css-version: "1\.7\.5"/);
});

console.log(`assets-strip-chat: ${n} passed, 0 failed`);
