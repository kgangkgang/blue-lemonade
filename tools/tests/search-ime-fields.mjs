// 8.2.7 search-ime-more: 「검색은 글자 조합이 끝난 뒤」(src/search-ime.js)를 캐릭터 검색 말고 다른 큰 목록 검색 칸에도 — 가짜 DOM 흉내.
// 맡는 칸: 월드인포(#world_info_search) · 페르소나(#persona_search_bar) · 채팅 파일(#select_chat_search) · 그룹 멤버 추가 · 지금 멤버(#rm_group_filter · #rm_group_members_filter).
// 고치기 전: 캐릭터 검색 칸만 맡아서 월드인포 검색은 조합 중 손이 300ms 멈출 때마다 자모 조각으로 편집기를 다시 그렸어요(항목 1000개 쪽에서 한 번 3.3초).
// 붙여넣기 · 지우기 · 조합 취소 · Enter 에서 마지막 값을 잃지 않는지, 칸끼리 타이머가 섞이지 않는지, 바이바이가 켜지면 캐릭터 칸만 쉬는지도 봐요.
//   node tools/tests/search-ime-fields.mjs <테마 루트>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
const root = path.resolve(process.argv[2] || fileURLToPath(new URL('../..', import.meta.url)));
let n = 0; const t = (name, fn) => { fn(); n++; console.log(`ok ${n} - ${name}`); };
const sleep = ms => new Promise(r => setTimeout(r, ms));

const seen = {};   // 칸 id → 실리태번 핸들러에 닿은 값들
function makeParent() { return { listeners: {}, addEventListener(type, fn, cap) { (this.listeners[type] ??= []).push({ fn, cap }); }, removeEventListener(type, fn, cap) { this.listeners[type] = (this.listeners[type] || []).filter(l => !(l.fn === fn && l.cap === cap)); } }; }
const els = {};
function makeInput(id) {
    const el = { id, parentElement: makeParent(), value: '', dispatchEvent(ev) { deliver(el, ev.type); return true; } };
    els[id] = el; seen[id] = [];
    return el;
}
for (const id of ['character_search_bar', 'world_info_search', 'persona_search_bar', 'select_chat_search', 'rm_group_filter', 'rm_group_members_filter', 'bg-filter']) makeInput(id);
globalThis.document = { getElementById: id => els[id] || null };
/** 캡처 단계 흉내: 부모의 캡처 리스너를 먼저, 멈추지 않았으면 실리태번 핸들러(input 이면 그때 칸 값을 적는다) */
function deliver(el, type, { isComposing = false, key } = {}) {
    let stopped = false;
    const ev = { type, target: el, isComposing, key, stopImmediatePropagation() { stopped = true; } };
    for (const { fn, cap } of [...(el.parentElement.listeners[type] || [])]) if (cap) fn(ev);
    if (!stopped && type === 'input') seen[el.id].push(el.value);
    return stopped;
}
const type = (el, v, isComposing = false) => { el.value = v; return deliver(el, 'input', { isComposing }); };
function compose(el, steps) { deliver(el, 'compositionstart'); for (const v of steps) type(el, v, true); }
const clear = () => { for (const k of Object.keys(seen)) seen[k].length = 0; };

const si = await import(pathToFileURL(path.join(root, 'src/search-ime.js')));
const wi = els.world_info_search, persona = els.persona_search_bar, chats = els.select_chat_search, group = els.rm_group_filter, members = els.rm_group_members_filter, character = els.character_search_bar;
si.syncSearchIme(true);

t('켜면 캐릭터 · 월드인포 · 페르소나 · 채팅 파일 · 그룹 멤버 두 칸의 부모에 캡처 리스너를 걸고, 맡지 않는 칸(배경 검색)은 그대로 (고치기 전: 캐릭터 칸만)', () => {
    for (const el of [character, wi, persona, chats, group, members]) {
        for (const ty of ['input', 'compositionstart', 'compositionend']) assert.equal((el.parentElement.listeners[ty] || []).filter(l => l.cap).length, 1, `${el.id} ${ty}`);
        assert.equal(si._forTest.state(el.id).bound, true, el.id);
    }
    assert.equal(Object.keys(els['bg-filter'].parentElement.listeners).length, 0);
});

// 월드인포: 「하나」 — 조합 중 자모는 멈추고 조합이 끝난 뒤 한 번
compose(wi, ['ㅎ', '하']); deliver(wi, 'compositionend'); compose(wi, ['하ㄴ', '하나']); deliver(wi, 'compositionend');
t('월드인포: 조합 중 자모 input 은 실리태번에 닿지 않아요', () => assert.deepEqual(seen.world_info_search, []));
await sleep(si.DELAY + 80);
t('… 조합이 끝나고 0.3초 뒤 지금 값으로 한 번만', () => assert.deepEqual(seen.world_info_search, ['하나']));

// 페르소나: 마지막 음절을 조합 중인 채로 멈춤 (8.2.4 검토와 같은 규칙)
clear(); compose(persona, ['ㄱ', '가']);
await sleep(si.COMPOSING_DELAY + 80);
t('페르소나: 마지막 음절을 조합 중인 채로 손을 멈춰도 잠시 뒤 그 값으로 찾아요', () => assert.deepEqual(seen.persona_search_bar, ['가']));
deliver(persona, 'compositionend'); await sleep(si.DELAY + 80);
t('… 그 뒤 compositionend 는 같은 값을 또 보내지 않아요', () => assert.deepEqual(seen.persona_search_bar, ['가']));

// 칸끼리 섞이지 않음: 월드인포에 치다가 바로 페르소나로
clear(); compose(wi, ['ㄷ', '다']); deliver(wi, 'compositionend'); compose(persona, ['ㄹ', '라']); deliver(persona, 'compositionend');
await sleep(si.DELAY + 80);
t('두 칸에 이어 치면 칸마다 따로 자기 값으로 한 번씩 (한 칸의 타이머가 다른 칸을 지우지 않아요)', () => {
    assert.deepEqual(seen.world_info_search, ['다']); assert.deepEqual(seen.persona_search_bar, ['라']);
});

// 붙여넣기 · 지우기 · 조합 취소
clear(); type(wi, '다붙여넣은말');
t('붙여넣기(조합 아닌 input)도 0.3초 모았다가', () => assert.deepEqual(seen.world_info_search, []));
await sleep(si.DELAY + 80);
t('… 붙여넣은 값 그대로 한 번', () => assert.deepEqual(seen.world_info_search, ['다붙여넣은말']));
clear(); type(wi, '다붙여'); type(wi, '다붙'); type(wi, '');
await sleep(si.DELAY + 80);
t('지우기를 이어 하면 마지막(빈 칸) 값으로 한 번', () => assert.deepEqual(seen.world_info_search, ['']));
clear(); compose(chats, ['ㅅ']); type(chats, '', true); deliver(chats, 'compositionend');
await sleep(si.DELAY + 80);
t('채팅 파일: 조합 취소로 칸이 비면 빈 값으로 한 번 (마지막 값을 잃지 않아요)', () => assert.deepEqual(seen.select_chat_search, ['']));

// Enter
clear(); type(wi, '바람');
deliver(wi, 'keydown', { key: 'Enter' });
t('Enter 는 기다리지 않고 지금 값으로 바로 보내요', () => assert.deepEqual(seen.world_info_search, ['바람']));
await sleep(si.DELAY + 80);
t('… 타이머가 남아 같은 값을 또 보내지 않아요', () => assert.deepEqual(seen.world_info_search, ['바람']));
clear(); compose(persona, ['ㅂ', '바']);
deliver(persona, 'keydown', { key: 'Enter', isComposing: true });
t('조합을 끝내는 Enter(isComposing)는 보내지 않고 compositionend 를 기다려요', () => assert.deepEqual(seen.persona_search_bar, []));
deliver(persona, 'compositionend'); deliver(persona, 'keydown', { key: 'Enter' });
t('… 조합이 끝난 뒤 오는 Enter 에서 완성된 값으로 바로', () => assert.deepEqual(seen.persona_search_bar, ['바']));
clear(); deliver(wi, 'keydown', { key: 'Enter' }); deliver(wi, 'keydown', { key: 'a' });
t('멈춰 둔 입력이 없으면 Enter 도 아무것도 보내지 않아요', () => assert.deepEqual(seen.world_info_search, []));

// 그룹 멤버 칸: 실리태번이 디바운스 없이 글자마다 거르는 칸 — 조합 아닌 입력은 예전처럼 바로
clear();
t('그룹 멤버 추가: 조합 아닌 입력(영문 · 지우기 · 붙여넣기)은 멈추지 않고 그대로 실리태번에', () => {
    assert.equal(type(group, 'a'), false); assert.equal(type(members, 'ab'), false);
    assert.deepEqual(seen.rm_group_filter, ['a']); assert.deepEqual(seen.rm_group_members_filter, ['ab']);
    assert.equal(si._forTest.state('rm_group_filter').waiting, false);
});
clear(); compose(group, ['ㅁ', '마']);
t('… 조합 중 자모는 멈춰요', () => assert.deepEqual(seen.rm_group_filter, []));
deliver(group, 'compositionend'); type(group, '마');   // 조합 끝 뒤 input 이 한 번 더 오는 브라우저
t('… 조합 끝 뒤 오는 조합 아닌 input 은 바로 지나가고 타이머는 지워요', () => { assert.deepEqual(seen.rm_group_filter, ['마']); assert.equal(si._forTest.state('rm_group_filter').waiting, false); });
await sleep(si.DELAY + 80);
t('… 같은 값을 또 보내지 않아요', () => assert.deepEqual(seen.rm_group_filter, ['마']));
clear(); compose(members, ['ㅂ', '바']); deliver(members, 'compositionend');
await sleep(si.DELAY + 80);
t('지금 멤버: 조합 끝 뒤 input 이 안 오는 브라우저에서도 0.3초 뒤 한 번', () => assert.deepEqual(seen.rm_group_members_filter, ['바']));

// 바이바이(캐릭터 검색만 같은 일을 한다) — 캐릭터 칸만 쉬고 나머지는 그대로
clear(); type(character, 'x');
si.syncSearchIme(true, { skip: [si.INPUT_ID] });
t('캐릭터 칸을 skip 하면 그 칸만 떼고, 멈춰 둔 입력은 그 자리에서 보내요 · 다른 칸은 그대로 맡아요', () => {
    assert.deepEqual(seen.character_search_bar, ['x']);
    assert.equal(si._forTest.state(si.INPUT_ID).bound, false);
    assert.equal((character.parentElement.listeners.input || []).length, 0);
    for (const el of [wi, persona, chats, group, members]) assert.equal(si._forTest.state(el.id).bound, true, el.id);
    assert.equal(type(character, 'xy'), false); assert.deepEqual(seen.character_search_bar, ['x', 'xy']);
    assert.equal(type(wi, '가'), true);
});
si.syncSearchIme(true);
t('바이바이가 꺼지면 캐릭터 칸을 다시 맡고, 그사이 다른 칸에 멈춰 둔 입력은 잃지 않아요', () => {
    assert.equal(si._forTest.state(si.INPUT_ID).bound, true); assert.equal(si._forTest.state('world_info_search').dirty, true);
});
await sleep(si.DELAY + 80);
t('… 월드인포 값은 제때 한 번', () => assert.deepEqual(seen.world_info_search, ['가']));

// 칸이 다른 요소로 바뀜(실리태번 판 차이 · 다시 만듦)
clear(); type(wi, '나무');
const oldWi = wi, newWi = makeInput('world_info_search');   // 같은 id 의 새 요소 · 새 부모
si.syncSearchIme(true);
t('칸이 다른 요소로 바뀌면 옛 칸에 멈춰 둔 입력을 먼저 보내고 옛 부모 리스너는 떼요', () => {
    assert.deepEqual(seen.world_info_search, ['나무']);
    assert.equal((oldWi.parentElement.listeners.input || []).length, 0);
    assert.equal((newWi.parentElement.listeners.input || []).filter(l => l.cap).length, 1);
    assert.equal(si._forTest.state('world_info_search').bound, true);
});

// 끄기
clear(); type(persona, '끝'); compose(chats, ['ㄲ']);
si.syncSearchIme(false);
t('끄면 모든 칸의 리스너를 떼고 멈춰 둔 입력은 칸마다 그 자리에서 한 번 보내요', () => {
    assert.deepEqual(seen.persona_search_bar, ['끝']); assert.deepEqual(seen.select_chat_search, ['ㄲ']);
    assert.equal(si._forTest.hosts(), 0);
    for (const el of [character, newWi, persona, chats, group, members]) assert.equal((el.parentElement.listeners.input || []).length, 0, el.id);
    assert.equal(si.flush(), false);
});

// ---- 연결
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
t('설정 줄은 하나 그대로(chat.searchIme) · 설명 · 검색 표가 새 칸을 말해요 · 바이바이 안내는 캐릭터 칸만 · CI 등록', () => {
    const panel = read('src/panel.js');
    assert.ok(panel.includes('캐릭터 · 월드인포 · 페르소나 · 채팅 파일 · 그룹 멤버 검색 칸에 한글을 조합하는 동안은 찾지 않고'));
    assert.ok(panel.includes("restNote('searchIme', '캐릭터 검색 칸은 ')") && /function restNote\(feature, part = ''\)/.test(panel));
    assert.match(read('src/settings-search.js'), /'검색은 글자 조합이 끝난 뒤','[^']*월드인포[^']*페르소나[^']*','', 'chat\.searchIme'\]/);
    assert.match(read('src/features.js'), /syncSearchIme\(searchIme, \{ skip: restingFor\('searchIme'\) \? \[m\.INPUT_ID\] : \[\] \}\)/);
    assert.match(read('.github/workflows/release-check.yml'), /node tools\/tests\/search-ime-fields\.mjs \./);
});

console.log(`PASS search-ime-fields: ${n} checks`);
