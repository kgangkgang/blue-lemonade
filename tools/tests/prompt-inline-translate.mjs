// 1.5.3 제자리 번역 — 월드인포 · 프리셋 프롬프트 · 봇카드 칸 · 페르소나 설명 옆 번역 단추 (한글화 패널의 저장 · 진행 · 순서를 같이 씀)
//   node tools/tests/prompt-inline-translate.mjs <테마 루트> [jsdom 이 든 node_modules 의 부모 폴더]
//   jsdom 이 없으면 알리고 끝나요(종료 2 — 통과로 치지 않아요). 공개 CI 는 `cd tools && npm ci` 뒤 `. tools`.
// 번역은 가짜 길(스텁)로만 — 실제 요청을 보내지 않아요. 화면은 실리태번 마크업을 줄인 고정 틀(지어낸 글).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const jsdomHome = process.argv[3] || process.env.BL_JSDOM || root;
let JSDOM;
try { ({ JSDOM } = createRequire(path.join(path.resolve(jsdomHome), 'x.js'))('jsdom')); }
catch { console.log(`jsdom 을 못 찾았어요(${jsdomHome}) — 이 시험은 돌지 않았어요`); process.exit(2); }

const FIXTURE = `<!doctype html><html><body>
<div id="WorldInfo" class="drawer-content closedDrawer">
  <select id="world_editor_select"><option value="">--- Pick ---</option><option value="0" selected>Sample Book</option></select>
  <div id="world_popup_entries_list"></div>
</div>
<div id="completion_prompt_manager_popup" class="drawer-content" style="display:none;">
  <div id="completion_prompt_manager_popup_inspect" style="display:none;"><label for="completion_prompt_manager_popup_entry_form_prompt"><span>Prompt</span></label></div>
  <div class="completion_prompt_manager_popup_entry_form_control">
  <div class="flex1"><label for="completion_prompt_manager_popup_entry_form_prompt"><span>Prompt</span></label></div>
  <textarea id="completion_prompt_manager_popup_entry_form_prompt" name="prompt"></textarea>
  </div>
  <a id="completion_prompt_manager_popup_entry_form_save" class="menu_button"></a>
</div>
<div id="right-nav-panel" class="drawer-content openDrawer">
<div id="rm_ch_create_block" style="display:none;">
  <div><span>Description</span><i class="editor_maximize" data-for="description_textarea"></i></div>
  <textarea id="description_textarea" name="description">A calm sample hero.</textarea>
  <div><span>First message</span><i class="editor_maximize" data-for="firstmessage_textarea"></i></div>
  <textarea id="firstmessage_textarea" name="first_mes">Hello there.</textarea>
  <div class="menu_button open_alternate_greetings">Alt</div>
</div>
</div>
<div id="PersonaManagement" class="drawer-content closedDrawer">
  <div><span>Description</span><i class="editor_maximize" data-for="persona_description"></i></div>
  <textarea id="persona_description">A traveler.</textarea>
</div>
</body></html>`;

const dom = new JSDOM(FIXTURE, { pretendToBeVisual: true });
const { window } = dom;
for (const k of ['window', 'document', 'Node', 'Element', 'HTMLElement', 'MutationObserver', 'Event', 'CustomEvent', 'requestAnimationFrame', 'cancelAnimationFrame', 'getComputedStyle'])
    if (!(k in globalThis) || k === 'window' || k === 'document') globalThis[k] = k === 'window' ? window : window[k];
// jsdom 은 배치를 안 해서 getClientRects 가 늘 비어요 — display:none 이 아니면 보이는 것으로
window.HTMLElement.prototype.getClientRects = function () { return this.style.display === 'none' ? [] : [{}]; };
// 원본 칸의 값을 우리가 바꾸면 세요 (실리태번이 그 값을 저장하니까 0 이어야 해요)
const valueDesc = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value');
let valueWrites = 0, allowWrite = false;
Object.defineProperty(window.HTMLTextAreaElement.prototype, 'value', { get() { return valueDesc.get.call(this); }, set(v) { if (!allowWrite) valueWrites++; valueDesc.set.call(this, v); }, configurable: true });
const setValue = (el, v) => { allowWrite = true; el.value = v; allowWrite = false; };

const url = rel => pathToFileURL(path.join(root, rel)).href;
const { installInlineTargets, inlineCounts } = await import(url('src/addons/prompt/inline-targets.js'));
const doc = window.document, $ = sel => doc.querySelector(sel), $$ = sel => [...doc.querySelectorAll(sel)];
const frame = () => new Promise(r => window.requestAnimationFrame(() => setTimeout(r, 0)));
const settle = async () => { for (let i = 0; i < 6; i++) await new Promise(r => setTimeout(r, 0)); };
let passed = 0;
const test = async (name, fn) => { await fn(); passed++; console.log(`PASS ${name}`); };

// ── 가짜 한글화 패널 길: 캐시 = Map(ns|id → { text, src }) · translate 는 진행 요소를 state.prog 에 두고 붙잡아 둘 수 있어요
const cache = new Map(), calls = [];
let hold = null, failNext = null;
const nsOf = (kind, target) => `pt-${kind}::${target}`;
const api = {
    available: true,
    currentPreset: () => 'Sample Preset',
    async block(kind, target, id, live) { return { ns: nsOf(kind, target), block: { id, content: live }, kind }; },
    view({ ns, block }) { const hit = cache.get(`${ns}|${block.id}`); return hit ? { text: hit.text, stale: hit.src !== block.content.trim() } : null; },
    async translate(found, ui) {
        calls.push(`${found.ns}|${found.block.id}`);
        const prog = doc.createElement('div'); prog.className = 'pt-progress-wrap visible'; prog.textContent = '월드인포 · 본문 · 0/1 처리 — 번역 중';
        ui.state.prog = prog; ui.paint();
        if (hold) await hold.promise;
        if (failNext) { const e = failNext; failNext = null; throw e; }
        const text = `[ko] ${found.block.content}`;
        cache.set(`${found.ns}|${found.block.id}`, { text, src: found.block.content.trim() });
        return text;
    },
};
const holdOn = () => { let release; const promise = new Promise(r => { release = r; }); hold = { promise, release }; };
let avatar = '', persona = '';
const inline = installInlineTargets(api, { doc, host: { currentCharacter: () => avatar, currentPersona: () => persona } });

function addEntry(uid, text, list = $('#world_popup_entries_list')) {
    const entry = doc.createElement('div');
    entry.className = 'world_entry'; entry.setAttribute('uid', String(uid));
    entry.innerHTML = `<div class="inline-drawer"><div class="inline-drawer-toggle inline-drawer-header"><span>Entry ${uid}</span></div><div class="inline-drawer-content"></div></div>`;
    list.append(entry);
    return entry;
}
function expand(entry, text) {   // 실리태번처럼 펼칠 때 편집 틀을 붙여요
    const form = doc.createElement('div');
    form.className = 'world_entry_edit';
    form.innerHTML = `<div class="world_entry_form_control"><label for="content "><small><span><span>Content</span><i class="editor_maximize fa-solid fa-maximize right_menu_button"></i></span></small></label><textarea class="text_pole" name="content" rows="8"></textarea></div>`;
    entry.querySelector('.inline-drawer-content').append(form);
    const ta = form.querySelector('textarea');
    setValue(ta, text);
    ta.addEventListener('input', () => { saved.push(ta.value); });   // 실리태번: 칸 값을 그대로 저장
    return ta;
}
const saved = [];
const openDrawer = (id, on) => { const el = doc.getElementById(id); el.classList.toggle('openDrawer', on); el.classList.toggle('closedDrawer', !on); };
const click = el => el.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
// 실리태번처럼 그 서랍 안 무언가를 누른 뒤에 그려요(서랍 머리 · 쪽 넘김 · 펼치기 단추를 누른 셈)
const poke = id => click(doc.getElementById(id));
const idle = () => new Promise(r => setTimeout(r, 900));   // 0.25 · 0.8초 뒤 다시 훑기까지 끝나게

await test('열기 전 비용 0: 단추 없음 · 감시자 0 · 서랍을 안 만지면 목록이 바뀌어도 훑기 0', async () => {
    assert.equal($$('.bl-kt-btn').length, 0);
    const before = inlineCounts.scans;
    expand(addEntry(1), 'The old tower stands alone.');
    await frame();
    assert.equal(inlineCounts.scans, before, 'nothing runs while the drawer is untouched');
    assert.doesNotMatch(fs.readFileSync(path.join(root, 'src/addons/prompt/inline-targets.js'), 'utf8').replace(/\/\/.*$/gm, ''), /new MutationObserver/, 'no observer site (theme observer budget stays at v1.5.1)');
    assert.equal($$('.bl-kt-btn').length, 0);
});

let ta1;
await test('월드인포를 열면(서랍 누름): 펼친 항목 내용 칸에 단추 하나(크게 보기 옆) · 상자는 아직 없음', async () => {
    openDrawer('WorldInfo', true); poke('WorldInfo');
    await settle(); await frame();
    ta1 = $('#world_popup_entries_list textarea[name="content"]');
    const btn = ta1.parentElement.querySelector('.bl-kt-btn');
    assert.ok(btn, 'button attached');
    assert.equal(btn.previousElementSibling?.classList.contains('editor_maximize') || btn.parentElement.querySelector('.editor_maximize').nextElementSibling === btn, true, 'right after the expand icon');
    assert.equal(ta1.previousElementSibling?.classList.contains('bl-kt') ?? false, false, 'no hidden box laid down before the first press (layout cost)');
    assert.equal(btn.dataset.tr, ['wi', 'Sample Book', 'Sample Book::1'].join('␟'));
    assert.equal(btn.getAttribute('aria-expanded'), 'false');
    assert.ok(btn.querySelector('svg.jj-tr-svg path[fill="currentColor"]'), 'same language shape as the panel / direction button, drawn as SVG so the ink sits in the middle');
});

await test('누르면 번역(가짜 길) · 진행 중: 스피너 · 패널 진행 부품이 상자 안에 · 끝나면 번역본 위 · 원문 칸은 그대로(값 쓰기 0 · 숨기지 않음)', async () => {
    holdOn();
    const btn = ta1.parentElement.querySelector('.bl-kt-btn');
    click(btn);
    await settle();
    const box = ta1.previousElementSibling;
    assert.ok(box.classList.contains('bl-kt'), 'box right above the original, made on first press');
    assert.equal(btn.getAttribute('aria-busy'), 'true');
    assert.match(btn.innerHTML, /fa-spinner/);
    assert.equal(box.hidden, false);
    assert.equal(box.querySelector('.jj-tr-prog').hidden, false, 'progress slot shown');
    assert.match(box.querySelector('.jj-tr-prog').textContent, /0\/1 처리/, 'the panel progress element itself');
    assert.equal(box.querySelector('.jj-tr-text').textContent, '번역하는 중…');
    hold.release(); hold = null;
    await settle();
    assert.deepEqual(calls, ['pt-wi::Sample Book|Sample Book::1']);
    assert.equal(box.querySelector('.jj-tr-text').textContent, '[ko] The old tower stands alone.');
    assert.equal(btn.getAttribute('aria-expanded'), 'true');
    assert.ok(btn.classList.contains('is-on'));
    assert.equal(ta1.value, 'The old tower stands alone.', 'original untouched');
    assert.notEqual(ta1.style.display, 'none');
    assert.equal(valueWrites, 0, 'inline code never writes textarea.value');
});

await test('안전: 번역 보기를 켠 채 저장(실리태번 input 저장) → 저장되는 글은 원문 그대로', async () => {
    ta1.dispatchEvent(new window.Event('input', { bubbles: true }));
    assert.deepEqual(saved, ['The old tower stands alone.']);
    assert.ok(!saved.some(s => s.includes('[ko]')));
});

await test('다시 누르면 접혀 원문만 · 또 누르면 캐시에서 바로(요청 없음)', async () => {
    const btn = ta1.parentElement.querySelector('.bl-kt-btn'), box = ta1.previousElementSibling;
    click(btn); await settle();
    assert.equal(box.hidden, true);
    assert.equal(btn.getAttribute('aria-expanded'), 'false');
    click(btn); await settle();
    assert.equal(box.hidden, false);
    assert.equal(calls.length, 1, 'no new request');
});

await test('원문을 고치면 「원문이 바뀌었어요 · 다시 번역」 · 다시 번역은 새 원문으로', async () => {
    const box = ta1.previousElementSibling;
    setValue(ta1, 'The old tower stands alone at dusk.');
    ta1.dispatchEvent(new window.Event('input', { bubbles: true }));
    assert.equal(box.querySelector('.jj-tr-stale').hidden, false);
    assert.equal(box.querySelector('.jj-tr-redo').hidden, false);
    click(box.querySelector('.jj-tr-redo')); await settle();
    assert.equal(calls.length, 2);
    assert.equal(box.querySelector('.jj-tr-text').textContent, '[ko] The old tower stands alone at dusk.');
    assert.equal(box.querySelector('.jj-tr-stale').hidden, true);
});

await test('목록을 다시 그려도(쪽 넘김 · 접기/펴기) 단추가 사라지거나 둘이 되지 않음 · 펼친 상태는 새 줄에 이어짐', async () => {
    const list = $('#world_popup_entries_list');
    list.replaceChildren();
    const ta = expand(addEntry(1), 'The old tower stands alone at dusk.');
    expand(addEntry(2), 'A river runs east.');
    poke('world_popup_entries_list');
    await frame(); await settle();
    assert.equal(list.querySelectorAll('.bl-kt-btn').length, 2);
    assert.equal(list.querySelectorAll('.jj-tr.bl-kt').length, 1, 'box only for the opened entry');
    inline.scanWorld(); inline.scanWorld();
    assert.equal(list.querySelectorAll('.bl-kt-btn').length, 2, 'scanning again adds nothing');
    assert.equal(ta.previousElementSibling.hidden, false, 'open state survives the redraw');
    assert.equal(ta.previousElementSibling.querySelector('.jj-tr-text').textContent, '[ko] The old tower stands alone at dusk.');
    ta1 = ta;
});

await test('패널에서 먼저 번역한 것: 요청 없이 바로 보임 · 패널이 적어 둔 원문과 다르면 낡음 표시', async () => {
    cache.set('pt-wi::Sample Book|Sample Book::2', { text: '[ko] 강이 동쪽으로 흘러요(옛 원문)', src: 'A river runs west.' });
    const ta2 = $$('#world_popup_entries_list textarea[name="content"]')[1];
    click(ta2.parentElement.querySelector('.bl-kt-btn')); await settle();
    const box = ta2.previousElementSibling;
    assert.ok(box.classList.contains('bl-kt'));
    assert.equal(calls.length, 2, 'cache hit, no request');
    assert.equal(box.querySelector('.jj-tr-text').textContent, '[ko] 강이 동쪽으로 흘러요(옛 원문)');
    assert.equal(box.querySelector('.jj-tr-stale').hidden, false, 'stale (panel source differs)');
    assert.equal(box.querySelector('.jj-tr-redo').hidden, false);
    click(box.querySelector('.jj-tr-redo')); await settle();
    assert.equal(calls.length, 3, 'redo of a stale panel translation sends a request');
    assert.equal(box.querySelector('.jj-tr-stale').hidden, true);
});

await test('패널에서 번역이 끝나면(bl-kt:changed) 펼쳐 둔 칸이 캐시를 다시 읽음 · 요청 없음', async () => {
    cache.set('pt-wi::Sample Book|Sample Book::1', { text: '[ko] 패널에서 고친 번역', src: 'The old tower stands alone at dusk.' });
    doc.dispatchEvent(new window.CustomEvent('bl-kt:changed', { detail: { ns: 'pt-wi::Sample Book' } }));
    await settle();
    assert.equal(ta1.previousElementSibling.querySelector('.jj-tr-text').textContent, '[ko] 패널에서 고친 번역');
    assert.equal(calls.length, 3);
});

await test('실패: 이유 · 실패 표시 · 「다시 시도」 → 다시 누르면 성공', async () => {
    const ta3 = expand(addEntry(3), 'Snow falls.');
    poke('world_popup_entries_list');
    await frame(); await settle();
    failNext = Object.assign(new Error('번역하지 못했어요 — 예시 오류'), { userMessage: true });
    const btn = ta3.parentElement.querySelector('.bl-kt-btn');
    click(btn); await settle();
    const box = ta3.previousElementSibling;
    assert.equal(box.querySelector('.jj-tr-text').textContent, '번역하지 못했어요 — 예시 오류');
    assert.ok(btn.classList.contains('is-failed'));
    assert.equal(box.querySelector('.jj-tr-redo span').textContent, '다시 시도');
    click(box.querySelector('.jj-tr-redo')); await settle();
    assert.equal(box.querySelector('.jj-tr-text').textContent, '[ko] Snow falls.');
    assert.ok(!btn.classList.contains('is-failed'));
});

await test('열어 둔 채 가만히 있으면 훑기 0 · 우리 단추를 눌러도 훑지 않음 · 같은 칸을 다시 훑어도 칠하지 않음', async () => {
    await idle();
    const m0 = inlineCounts.mutations, s0 = inlineCounts.scans;
    for (let i = 0; i < 6; i++) await frame();
    assert.equal(inlineCounts.scans, s0, 'no scans while idle');
    click(ta1.__blKtButton); click(ta1.__blKtButton); await settle();
    assert.equal(inlineCounts.mutations, m0, 'own button presses do not trigger scans');
    const btn = ta1.__blKtButton, icon = btn.firstElementChild;
    inline.scanWorld(); await frame(); await settle();
    assert.equal(btn.firstElementChild, icon, 'icon element kept (no innerHTML rewrite)');
    assert.equal(inlineCounts.mutations, m0, 'rescan touches nothing');
});

await test('월드인포를 닫은 뒤: 서랍을 눌러도 닫힌 창은 훑지 않음(단추 안 붙음)', async () => {
    openDrawer('WorldInfo', false); poke('WorldInfo');
    const ta9 = expand(addEntry(9), 'Closed.');
    await frame(); await settle();
    assert.equal(ta9.__blKtButton, undefined);
});

await test('프리셋 프롬프트 편집 창: 열면 단추 하나 · 다른 프롬프트를 열면 같은 단추의 열쇠만 바뀜 · 마커(비활성 칸)는 숨김', async () => {
    const pop = $('#completion_prompt_manager_popup'), input = $('#completion_prompt_manager_popup_entry_form_prompt'), save = $('#completion_prompt_manager_popup_entry_form_save');
    save.dataset.pmPrompt = 'main'; setValue(input, 'Write vividly.');
    pop.style.display = 'flex'; pop.classList.add('openDrawer'); poke('completion_prompt_manager_popup');
    await settle(); await frame();
    const btn = $('.completion_prompt_manager_popup_entry_form_control label[for="completion_prompt_manager_popup_entry_form_prompt"] > .bl-kt-btn');
    assert.equal(btn?.previousElementSibling?.textContent, 'Prompt', 'inside the label, right after its text (same line)');
    assert.equal($('#completion_prompt_manager_popup_inspect .bl-kt-btn'), null, 'not on the hidden inspect label (same for= twice)');
    assert.ok(btn?.classList.contains('bl-kt-btn'));
    assert.equal(btn.dataset.tr, ['preset', 'Sample Preset', 'main'].join('␟'));
    click(btn); await settle();
    assert.equal(input.previousElementSibling.querySelector('.jj-tr-text').textContent, '[ko] Write vividly.');
    pop.style.display = 'none'; pop.classList.remove('openDrawer'); await settle();
    save.dataset.pmPrompt = 'nsfw'; setValue(input, 'Keep it mild.');
    pop.style.display = 'flex'; pop.classList.add('openDrawer'); poke('completion_prompt_manager_popup'); await settle(); await frame();
    assert.equal($$('#completion_prompt_manager_popup .bl-kt-btn').length, 1);
    assert.equal(btn.dataset.tr, ['preset', 'Sample Preset', 'nsfw'].join('␟'));
    assert.equal(input.previousElementSibling.hidden, true, 'new prompt starts closed');
    pop.style.display = 'none'; pop.classList.remove('openDrawer'); await settle();
    save.dataset.pmPrompt = 'chatHistory'; setValue(input, ''); input.disabled = true;
    pop.style.display = 'flex'; pop.classList.add('openDrawer'); poke('completion_prompt_manager_popup'); await settle(); await frame();
    assert.equal(btn.hidden, true, 'marker prompt has no button');
    input.disabled = false;
});

await test('봇카드 칸 · 페르소나 설명: 고른 캐릭터 없으면 숨김 · 고르면 크게 보기 옆 · 캐릭터를 바꾸면 열쇠가 바뀜', async () => {
    const block = $('#rm_ch_create_block');
    block.style.display = 'flex'; poke('rm_ch_create_block'); await settle(); await frame();
    assert.equal($$('#rm_ch_create_block .bl-kt-btn').filter(b => !b.hidden).length, 0, 'no character → hidden');
    avatar = 'sample.png'; inline.refresh(); await settle();
    const desc = $('.editor_maximize[data-for="description_textarea"]').nextElementSibling;
    assert.equal(desc.dataset.tr, ['char', 'sample.png', 'description'].join('␟'));
    assert.equal($$('#rm_ch_create_block .bl-kt-btn').length, 2);
    avatar = 'other.png'; inline.refresh(); await settle();
    assert.equal(desc.dataset.tr, ['char', 'other.png', 'description'].join('␟'));
    assert.equal($$('#rm_ch_create_block .bl-kt-btn').length, 2, 'still one per field');
    await idle();
    const scans = inlineCounts.scans;
    openDrawer('right-nav-panel', false); openDrawer('right-nav-panel', true); poke('right-nav-panel'); await settle(); await frame();
    assert.ok(inlineCounts.scans > scans, 'reopening the right drawer (editor already shown) rescans');
    persona = 'me.png'; openDrawer('PersonaManagement', true); poke('PersonaManagement'); await settle(); await frame();
    const pbtn = $('.editor_maximize[data-for="persona_description"]').nextElementSibling;
    assert.equal(pbtn.dataset.tr, ['persona', 'me.png', 'description'].join('␟'));
    click(pbtn); await settle();
    assert.equal($('#persona_description').previousElementSibling.querySelector('.jj-tr-text').textContent, '[ko] A traveler.');
    assert.equal(valueWrites, 0);
});

await test('추가 인사말 창: 누르면 뜨는 창의 인사말마다 단추 하나 · 새로 더한 인사말에도 · 번역 보기 켠 채 저장(input) → 원문 그대로 · 창을 닫으면 감시 끊음', async () => {
    avatar = 'sample.png';
    const greetings = ['Good morning, traveler.'];
    let dialog = null;
    const block = i => {
        const b = doc.createElement('div'); b.className = 'alternate_greeting'; b.setAttribute('data-index', String(i));
        b.innerHTML = '<details open><summary><div class="title_restorable"><div class="flex-container"><strong>Alternate Greeting #' + (i + 1) + '</strong><i class="editor_maximize fa-solid fa-maximize right_menu_button"></i></div></div></summary><textarea class="text_pole alternate_greeting_text"></textarea></details>';
        const ta = b.querySelector('textarea'); setValue(ta, greetings[i]); ta.addEventListener('input', () => { greetings[i] = ta.value; });
        return b;
    };
    $('.open_alternate_greetings').addEventListener('click', () => {   // 실리태번처럼 창을 새로 지어 붙여요
        dialog = doc.createElement('dialog'); dialog.innerHTML = '<div class="alternate_grettings"><div class="alternate_greetings_list"></div></div>';
        dialog.setAttribute('open', ''); doc.body.append(dialog); dialog.querySelector('.alternate_greetings_list').append(block(0));
    });
    click($('.open_alternate_greetings'));
    for (let i = 0; i < 4; i++) await frame();
    const list = dialog.querySelector('.alternate_greetings_list');
    assert.equal(list.querySelectorAll('.bl-kt-btn').length, 1);
    const btn = list.querySelector('.editor_maximize').nextElementSibling;
    assert.equal(btn.dataset.tr, ['char', 'sample.png', 'alt_greeting_0'].join('␟'), 'same key as the panel (alt_greeting_N)');
    click(btn); await settle();
    const ta = list.querySelector('textarea');
    assert.equal(ta.previousElementSibling.querySelector('.jj-tr-text').textContent, '[ko] Good morning, traveler.');
    ta.dispatchEvent(new window.Event('input', { bubbles: true }));
    assert.deepEqual(greetings, ['Good morning, traveler.'], 'saved greeting is the original');
    greetings.push('See you tonight.'); list.append(block(1)); click(list);   // 창 안 「더하기」를 누른 셈
    for (let i = 0; i < 2; i++) await frame();
    assert.equal(list.querySelectorAll('.bl-kt-btn').length, 2, 'new greeting gets one too');
    dialog.removeAttribute('open'); dialog.dispatchEvent(new window.Event('close'));
    list.append(block(1)); poke('rm_ch_create_block'); await settle(); await frame();
    assert.equal(list.querySelectorAll('.bl-kt-btn').length, 2, 'closed dialog is not scanned any more');
    assert.equal(valueWrites, 0);
});

// ── 패널 쪽 길(index.js): 같은 캐시 열쇠 · 같은 runTranslation · 칸 값은 읽기만 ──
const src = fs.readFileSync(path.join(root, 'src/addons/prompt/index.js'), 'utf8');
await test('패널 길: 같은 ns(pt-wi · presetNs · pt-char · pt-persona) · 같은 runTranslation(본문 · 강제 아님) · 같은 진행 부품 · 패널 목록도 갱신 · 끝나면 알림', () => {
    assert.match(src, /const INLINE_NS = \{ wi: name => `pt-wi::\$\{name\}`, preset: name => presetNs\(name\), char: id => `pt-char::\$\{id\}`, persona: id => `pt-persona::\$\{id\}` \};/);
    assert.match(src, /await runTranslation\(\{ items: \[block\], list, ns, pBar: prog\.bar, pLabel: prog\.label, pWrap: prog\.wrap, pStatus: prog\.status, btnStop: null,\s*forceRetranslate: false, mode: 'body', targetIds: \[block\.id\] \}\)/);
    assert.match(src, /if \(isBusy\) throw Object\.assign\(new Error\('한글화 패널에서 다른 번역이 진행 중이에요/);
    assert.match(src, /announceChange\(ns\);/);
    assert.match(src, /PAGE_VIEWS\.add\(\{ ns: \(\) => ns, list, items: \(\) => items \}\)/);
    for (const rel of ['src/addons/prompt/inline-targets.js', 'src/inline-translate.js']) {
        const code = fs.readFileSync(path.join(root, rel), 'utf8');
        assert.doesNotMatch(code, /\.value\s*=[^=]/, `${rel} never assigns .value`);
        assert.doesNotMatch(code, /fetch\(|runCompletion|translateText\(/, `${rel} has no translation path of its own`);
        assert.doesNotMatch(code, /observe\(doc(ument)?(\.body)?,/, `${rel} never observes the whole document`);
    }
});

await test('보이는 글 고르기(inlineView): 제목 줄 · 월드인포 키워드 머리줄 떼기 · 주석만 있으면 아직 · 원문 기록과 다르면 낡음', () => {
    const section = (start, end) => { const a = src.indexOf(start), b = src.indexOf(end, a); assert(a >= 0 && b > a, start); return src.slice(a, b); };
    const store = new Map(), sources = new Map();
    const ctx = { getCached: (ns, id) => store.get(id) ?? null, getSource: (ns, id) => sources.get(id) ?? null, KEYS_MARKER: '**Keys:**', FILTERS_MARKER: '**Filters:**' };
    vm.createContext(ctx);
    vm.runInContext(section('const NOTE_LABEL =', '// ── Translation ─') + section('function splitTitleAndBody(', '// Helper used by JSON exporters')
        + section('function splitKeysAndBody(', '// Compact, display-only metadata') + section('function inlineView(', 'function inlineProgress(') + ';globalThis.inlineView=inlineView;', ctx);
    const wiBlock = { id: 'B::1', content: '**Keys:** tower\n\nThe old tower.' };
    store.set('B::1', '### 옛 탑\n\n**Keys:** 탑\n\n오래된 탑이에요.');
    assert.deepEqual({ ...ctx.inlineView({ ns: 'pt-wi::B', block: wiBlock, kind: 'wi' }) }, { text: '오래된 탑이에요.', stale: false });
    sources.set('B::1', '**Keys:** tower\n\nThe new tower.');
    assert.equal(ctx.inlineView({ ns: 'pt-wi::B', block: wiBlock, kind: 'wi' }).stale, true);
    store.set('p', 'Write vividly.\n{{// ========\n[내용 번역]\n\n생생하게 써요.\n\n========}}');
    assert.equal(ctx.inlineView({ ns: 'pt-preset::P', block: { id: 'p', content: 'Write vividly.' }, kind: 'preset' }), null, 'note-only translation → not yet');
    assert.equal(ctx.inlineView({ ns: 'pt-preset::P', block: { id: 'none', content: 'x' }, kind: 'preset' }), null);
});

await test('칸을 패널 항목 꼴로(inlineBlock): 월드인포는 키워드 · 필터 머리줄 + 지금 칸 글 · 우리 주석은 떼어 둠 · 제목 전용 · 없는 항목은 null', async () => {
    const section = (start, end) => { const a = src.indexOf(start), b = src.indexOf(end, a); assert(a >= 0 && b > a, start); return src.slice(a, b); };
    const ctx = { duplicate: false, KEYS_MARKER: '**Keys:**', FILTERS_MARKER: '**Filters:**', presetNs: n => `pt-preset::${n || 'Cur'}`,
        readWorldInfo: async () => [{ id: 'B::1', name: 'Tower', content: '**Keys:** tower, spire\n**Filters:** night\n\nOld text.' }],
        readPresetBlocks: () => [{ id: 'main', content: 'Saved.' }, { id: '__pp_regex__::x', content: '', titleOnly: true }],
        readCharCard: async () => [{ id: 'description', content: 'Saved desc.' }], readPersonaFields: () => [] };
    vm.createContext(ctx);
    vm.runInContext(section('const NOTE_LABEL =', '// ── Translation ─') + section('function splitKeysAndBody(', '// Compact, display-only metadata')
        + section('const INLINE_NS =', '/** 캐시의 번역을 칸 위에') + ';globalThis.inlineBlock=inlineBlock;', ctx);
    const wi = await ctx.inlineBlock('wi', 'B', 'B::1', 'Edited text.');
    assert.equal(wi.ns, 'pt-wi::B');
    assert.equal(wi.block.content, '**Keys:** tower, spire\n**Filters:** night\n\nEdited text.', 'same shape the panel translates and records as ::src');
    const noted = await ctx.inlineBlock('preset', 'P', 'main', 'Write.\n{{// ========\n[내용 번역]\n\n써요.\n\n========}}');
    assert.equal(noted.block.content, 'Write.');
    assert.equal(noted.block.injectedNote, '써요.');
    assert.equal(await ctx.inlineBlock('preset', 'P', '__pp_regex__::x', ''), null, 'title-only rows have no body to show');
    assert.equal(await ctx.inlineBlock('char', 'a.png', 'nope', 'x'), null);
    assert.equal((await ctx.inlineBlock('char', 'a.png', 'description', 'Live desc.')).block.content, 'Live desc.');
    ctx.duplicate = true;
    assert.equal(await ctx.inlineBlock('char', 'a.png', 'description', 'x'), null, 'standalone panel owns the cache → off');
});

inline.stop();
console.log(`prompt-inline-translate: ${passed} passed`);
