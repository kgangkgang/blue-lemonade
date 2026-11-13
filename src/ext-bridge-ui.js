// 남의 확장 기능 다리의 설정 칸 (1.2.x) — 미트볼 상태창 설정 칸을 볼 때만 받아요(src/ext-bridge.js 가 그 칸을 누를 때 불러요).
//   두 칸을 그 확장의 설정 칸 안에 넣어요. 그 확장의 요소는 옮기거나 지우거나 고치지 않아요 — 우리 칸만 끼워요.
//     ① 번역 용어집(「번역 지침」 칸이 든 묶음의 맨 끝): 켬끔 둘 · 지금 상태 한 줄 · 지난 요청에 실은 줄 보기
//     ② 모델 직접 고르기(「확장 AI」 모델 칸 아래): 「확장 AI 전체」 + 기능 여섯 갈래, 칸마다 회사 · 모델. 목록은 번역기와 같은 것(src/live-models.js)
//     ③ 번역 탭의 「번역 모델 (연결 프로필)」 아래에 ② 의 「번역」 줄과 같은 칸을 한 번 더(같은 값)
//        그 확장 칸에 연결 프로필이 골라져 있는 칸에는 「그쪽이 먼저」라고 알려요.
//   우리 칸의 입력에는 그 확장의 data-s 표식이 없어서 그 확장의 저장 처리에 걸리지 않아요. 값은 테마 쪽 설정(extension_settings[BRIDGE_KEY])에만 적어요.
//   분류 탭(src/ext-compat.js)이 있으면 끼운 자리의 묶음 번호(data-bl-tab-g)를 물려받아 그 탭과 함께 보이고 숨어요.
//   모양: src/ext-bridge.css(한 번 붙임) + 맞춤 시트(src/ext-status.css)의 설정 줄 규칙을 그대로 받아요. 그림 글자는 쓰지 않아요.
import * as Core from './ext-bridge-core.js';
import * as Providers from './addons/rewrite/providers.js';
import * as Models from './live-models.js';
import { endpointOf } from './settings-ai-connection.js';

const SHEET_ID = 'bl-ext-bridge-css';
const refreshers = new WeakMap();
const context = () => globalThis.SillyTavern?.getContext?.() || {};
const hostSettings = () => context().chatCompletionSettings || {};
const known = provider => typeof provider === 'string' && Object.hasOwn(Providers.PROVIDERS, provider);
const endpoint = () => endpointOf({ customUrl: '' }, hostSettings());   // Custom 은 실리태번에 저장된 주소만
const timeOf = at => { try { return new Date(at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }); } catch { return ''; } };

function el(doc, tag, { cls = '', text = '', attrs = {}, kids = [] } = {}) {
    const node = doc.createElement(tag);
    if (cls) node.className = cls;
    if (text) node.textContent = text;
    for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, value);
    for (const kid of kids) node.append(kid);
    return node;
}
function attachSheet(doc) {
    if (doc.getElementById(SHEET_ID)) return;
    const link = el(doc, 'link', { attrs: { id: SHEET_ID, rel: 'stylesheet', href: new URL('./ext-bridge.css', import.meta.url).href } });
    (doc.head || doc.documentElement).append(link);
}
/** 내용 칸의 바로 아래 자식 가운데 그 설정 칸(data-s)을 품은 것 */
function rowOf(content, key) {
    let node = content.querySelector(`[data-s="${key}"]`);
    while (node && node.parentElement !== content) node = node.parentElement;
    return node || null;
}
/** 그 줄이 든 묶음의 맨 끝 요소(다음 묶음 머리 · 맞춘 판 안내 줄 바로 앞) — 그 확장이 줄 아래에 붙여 둔 설명 · 단추와 줄 사이를 가르지 않게 */
function groupEnd(row) {
    let last = row;
    for (let next = row?.nextElementSibling; next && !next.matches(Core.TARGET.head) && !next.matches('small.bl-ext-compat') && !next.hasAttribute('data-bl-bridge'); next = next.nextElementSibling) last = next;
    return last;
}
/** 끼울 자리 뒤에 넣고, 분류 탭 묶음 표식을 물려받아요. 자리를 못 찾으면 맨 아래(맞춘 판 안내 줄 앞) */
function place(content, block, anchor) {
    const note = anchor ? null : content.querySelector(':scope > small.bl-ext-compat');
    if (anchor) anchor.after(block); else if (note) note.before(block); else content.append(block);
    const from = anchor || block.previousElementSibling;
    if (from && 'blTabG' in from.dataset) { block.dataset.blTabG = from.dataset.blTabG; if ('blTabOff' in from.dataset) block.dataset.blTabOff = ''; }
}

// ── ① 번역 용어집 ─────────────────────────────────────
function lastText(last) {
    const parts = [];
    if (last?.ext?.lines?.length) parts.push(`확장 AI 요청 · ${Core.slotLabel(last.ext.slot) || '기능 모름'} · ${timeOf(last.ext.at)} · ${last.ext.lines.length}줄\n${last.ext.lines.join('\n')}`);
    if (last?.main?.lines?.length) parts.push(`본편 요청 · ${timeOf(last.main.at)} · ${last.main.lines.length}줄\n${last.main.lines.join('\n')}`);
    return parts.join('\n\n') || '아직 실은 요청이 없어요. 용어집의 이름이 요청 글에 나오면 여기에 보여요.';
}
function buildGlossary(doc, bridge) {
    const flag = (key, label) => el(doc, 'label', { cls: 'checkbox_label', attrs: { 'data-bl-cost': 'tok' }, kids: [el(doc, 'input', { attrs: { type: 'checkbox', 'data-bl-bridge-flag': key } }), el(doc, 'span', { text: label })] });   // 비용 표시는 맞춤 시트(src/ext-status.css)의 같은 표식 — 이름 줄만큼 요청 글이 길어져요
    const note = el(doc, 'small', { attrs: { 'data-bl-bridge-note': '', role: 'status' } });
    const lines = el(doc, 'pre', { attrs: { 'data-bl-bridge-lines': '' } });
    const block = el(doc, 'div', { cls: 'bl-ext-bridge', attrs: { 'data-bl-bridge': 'glossary' }, kids: [
        el(doc, 'b', { cls: 'bl-ext-bridge-h', text: '블루레몬에이드 · 번역 용어집' }),
        el(doc, 'small', { text: '번역 설정의 용어집에 적어 둔 이름을 상태창도 같은 표기로 쓰게, AI 에 보내는 글에 그 이름 줄을 덧붙여요.' }),
        flag('glossary', '확장 AI 요청에 용어집 이름 싣기'),
        flag('glossaryMain', '본편 답의 상태 줄에도 싣기'),
        note,
        el(doc, 'details', { cls: 'bl-ext-bridge-more', kids: [el(doc, 'summary', { text: '지난 요청에 실은 줄 보기' }), lines] }),
    ] });
    const refresh = () => {
        const config = bridge.config(), status = bridge.status();
        for (const input of block.querySelectorAll('[data-bl-bridge-flag]')) input.checked = config[input.dataset.blBridgeFlag] !== false;
        note.textContent = config.glossary || config.glossaryMain ? Core.glossaryNote(status) : '꺼 두었어요. 요청 글은 그 확장이 만든 그대로 가요.';
        lines.textContent = lastText(status.last);
    };
    block.addEventListener('change', event => {
        const key = event.target?.dataset?.blBridgeFlag;
        if (!key) return;
        bridge.update(config => { config[key] = !!event.target.checked; });
        refresh();
    });
    block.addEventListener('toggle', () => refresh(), true);   // 펼칠 때 지난 줄을 다시 읽어요
    refreshers.set(block, refresh);
    return block;
}

// ── ② 모델 직접 고르기 ────────────────────────────────
function fillProviders(select, slotId, saved) {
    const items = [['', slotId === 'base' ? '고르지 않음 · 미트볼 설정대로' : '「확장 AI 전체」와 같게']];
    for (const [id, provider] of Object.entries(Providers.PROVIDERS)) items.push([id, Models.keyState(provider.source) === 'no' ? `${provider.label} · 키 없음` : provider.label]);
    if (saved && !known(saved)) items.push([saved, `${saved} · 지금은 고를 수 없는 회사`]);
    const sig = JSON.stringify([items, saved]);
    if (select.dataset.blBridgeSig === sig) return;
    select.replaceChildren(...items.map(([value, label]) => { const option = el(select.ownerDocument, 'option', { text: label, attrs: { value } }); option.selected = value === saved; return option; }));
    select.dataset.blBridgeSig = sig;
}
function paintRow(row, slot, owned) {
    const doc = row.ownerDocument;
    const provider = row.querySelector('[data-bl-bridge-provider]'), model = row.querySelector('[data-bl-bridge-model]'), name = row.querySelector('[data-bl-bridge-name]'), hint = row.querySelector('[data-bl-bridge-hint]');
    fillProviders(provider, row.dataset.blBridgeSlot, slot.provider);
    const ok = known(slot.provider), typed = ok && slot.model === 'custom';
    model.hidden = !ok;
    if (ok) {
        const choices = Providers.modelChoices(slot.provider, typed ? '' : slot.model, endpoint());
        Models.fillSelect(model, choices.ids, {
            saved: typed ? '' : slot.model, placeholder: '모델을 골라 주세요', customValue: 'custom', customLabel: '모델 이름 직접 입력', customSelected: typed,
            missingSuffix: slot.provider === 'custom' && choices.ids.length ? ' (이 주소 목록에 없음)' : ' (저장한 모델)',
        });
    }
    name.hidden = !typed;
    if (typed && doc.activeElement !== name) name.value = slot.name;
    // 그 확장 칸에 연결 프로필이 골라져 있으면 그쪽이 먼저예요 — 여기서 고른 모델은 그 칸을 「메인 연결 그대로」로 돌려야 쓰여요
    hint.hidden = !(owned && slot.provider);
}
function slotRow(doc, id, label, covers) {
    return el(doc, 'label', { attrs: { 'data-bl-bridge-slot': id }, kids: [
        el(doc, 'span', { text: label, kids: covers ? [el(doc, 'small', { text: ` ${covers}` })] : [] }),
        el(doc, 'div', { cls: 'bl-ext-bridge-pick', kids: [
            el(doc, 'select', { cls: 'text_pole', attrs: { 'data-bl-bridge-provider': '', 'aria-label': `${label} 회사` } }),
            el(doc, 'select', { cls: 'text_pole', attrs: { 'data-bl-bridge-model': '', 'aria-label': `${label} 모델` } }),
        ] }),
        el(doc, 'input', { cls: 'text_pole', attrs: { type: 'text', 'data-bl-bridge-name': '', 'aria-label': `${label} 모델 이름`, placeholder: '보낼 모델 이름을 적어 주세요', maxlength: '200' } }),
        el(doc, 'small', { text: '위 미트볼 칸에 연결 프로필이 골라져 있어 그쪽이 먼저예요. 여기서 고른 모델을 쓰려면 그 칸을 「메인 연결 그대로」로 돌려 주세요.', attrs: { 'data-bl-bridge-hint': '' } }),
    ] });
}
/** 모델 칸 하나가 바뀌었을 때 저장해요 — 확장 AI 탭의 줄과 번역 탭의 같은 칸이 같은 값을 써요. 바뀐 칸이 없으면 false */
function changeSlot(bridge, target, listOptions) {
    const id = target?.closest?.('[data-bl-bridge-slot]')?.dataset.blBridgeSlot;
    if (!id) return false;
    if (target.matches('[data-bl-bridge-provider]')) {
        bridge.update(config => { config.models[id] = { provider: target.value, model: '', name: '' }; });
        if (known(target.value)) Providers.autoFetchModelList(target.value, listOptions());   // 목록이 없거나 하루 지났을 때만 조용히
    } else if (target.matches('[data-bl-bridge-model]')) bridge.update(config => { config.models[id].model = target.value; if (target.value !== 'custom') config.models[id].name = ''; });
    else if (target.matches('[data-bl-bridge-name]')) bridge.update(config => { config.models[id].name = target.value; });
    else return false;
    return true;
}
const listOptions = () => ({ endpoint: endpoint(), includeHeaders: hostSettings().custom_include_headers || '', headers: () => context().getRequestHeaders?.() || {} });
/** 그 설정 칸 안 우리 칸을 모두 다시 그려요(한쪽에서 바꾼 번역 모델이 다른 쪽에도 보이게) */
function refreshAll(content) {
    for (const block of content?.querySelectorAll?.('[data-bl-bridge]') || []) refreshers.get(block)?.();
}
function modelNote(status, message) {
    if (message) return message;
    const last = status.last?.model;
    if (!last) return '';
    const where = Core.slotLabel(last.slot) || '기능 모름';
    return last.ok ? `지난 요청: ${where} → ${last.label} (${timeOf(last.at)})` : `지난 요청: ${where} → ${last.label} 실패 — ${last.note} (${timeOf(last.at)})`;
}
function buildModels(doc, bridge) {
    const [base, ...rest] = Core.SLOTS;
    const note = el(doc, 'small', { attrs: { 'data-bl-bridge-note': '', role: 'status', 'aria-live': 'polite' } });
    const button = el(doc, 'button', { cls: 'menu_button', text: '모델 목록 새로고침', attrs: { type: 'button', 'data-bl-bridge-refresh': '' } });
    const block = el(doc, 'div', { cls: 'bl-ext-bridge', attrs: { 'data-bl-bridge': 'models' }, kids: [
        el(doc, 'b', { cls: 'bl-ext-bridge-h', text: '블루레몬에이드 · 모델 직접 고르기' }),
        el(doc, 'small', { text: '연결 프로필 없이 회사와 모델을 바로 골라요. 키는 실리태번에 저장된 것을 그대로 써요.' }),
        slotRow(doc, base[0], base[1], base[2]),
        el(doc, 'details', { cls: 'bl-ext-bridge-more', kids: [
            el(doc, 'summary', { text: '기능마다 따로 고르기', attrs: { 'data-bl-bridge-changed': '' } }),
            el(doc, 'small', { text: '비워 두면 「확장 AI 전체」에서 고른 모델을 써요.' }),
            ...rest.map(([id, label, covers]) => slotRow(doc, id, label, covers)),
        ] }),
        el(doc, 'div', { cls: 'bl-ext-bridge-acts', kids: [button] }),
        note,
        el(doc, 'details', { cls: 'bl-ext-bridge-more', kids: [el(doc, 'summary', { text: '보내지 못했을 때 · 기록에 남는 이름' }), el(doc, 'small', { cls: 'bl-ext-bridge-foot', text: '위 미트볼 칸에는 실리태번 연결 프로필만 떠요. 고른 모델로 보내지 못하면 미트볼의 「실패하면 메인 연결로 다시 보내기」 설정을 따라요(기다리다 끊긴 요청은 두 번 청구되지 않게 다시 보내지 않아요). 생각하는 모델은 생각을 짧게 두고 출력 한도를 8192 아래로 내리지 않아요. 미트볼 「기록」과 오류 보고문에는 메인 모델 이름으로 적히니, 미트볼 쪽에 문제를 알릴 때는 이 칸을 쓰는 중이라고 함께 적어 주세요.' })] }),
    ] });
    let message = '', pending = false;
    const rows = () => [...block.querySelectorAll('[data-bl-bridge-slot]')];
    const refresh = () => {
        const config = bridge.config(), status = bridge.status();
        for (const row of rows()) paintRow(row, config.models[row.dataset.blBridgeSlot], !!status.owner?.[row.dataset.blBridgeSlot]);
        // 접힌 줄에 바꾼 기능만 보여요 — 비워 둔 기능은 「확장 AI 전체」와 같아요
        const changed = rest.filter(([id]) => config.models[id]?.provider).map(([, label]) => label);
        const head = block.querySelector('[data-bl-bridge-changed]');
        if (head) head.textContent = changed.length ? `기능마다 따로 고르기 · 바꾼 것 ${changed.length}(${changed.join(' · ')})` : '기능마다 따로 고르기 · 모두 「확장 AI 전체」와 같아요';
        const fetchable = Object.values(config.models).some(slot => known(slot.provider) && Providers.canFetch(slot.provider));
        button.disabled = pending || !fetchable;
        button.textContent = pending ? '목록을 불러오는 중…' : '모델 목록 새로고침';
        note.textContent = modelNote(status, message);
    };
    block.addEventListener('change', event => {
        if (!changeSlot(bridge, event.target, listOptions)) return;
        message = '';
        if (block.parentElement) refreshAll(block.parentElement); else refresh();
    });
    block.addEventListener('click', async event => {
        if (!event.target?.closest?.('[data-bl-bridge-refresh]') || pending) return;
        event.preventDefault();
        const providers = [...new Set(Object.values(bridge.config().models).map(slot => slot.provider).filter(provider => known(provider) && Providers.canFetch(provider)))];
        if (!providers.length) return;
        pending = true; message = ''; refresh();
        let got = 0, failed = 0;
        for (const provider of providers) {
            try { got += (await Providers.fetchModelList(provider, listOptions())).length; } catch { failed += 1; }
        }
        pending = false;
        message = failed ? `모델 목록을 불러오지 못한 회사가 ${failed}곳 있어요. 실리태번의 API 연결을 확인해 주세요.` : `모델 ${got}개를 불러왔어요.`;
        if (block.isConnected) refresh();
    });
    // 목록이 새로 오면 모델 칸만 다시 채워요(쓰는 중인 이름 칸 · 초점은 그대로) — 칸이 사라졌으면 듣기를 그만둬요
    const stop = Models.onChange(() => { if (block.isConnected) refresh(); else stop(); });
    refreshers.set(block, refresh);
    return block;
}

// ── ③ 번역 탭의 번역 모델 직접 고르기 ─────────────────
//   그 확장 「번역 모델 · 언어」 펼침 안, 「번역 모델 (연결 프로필)」 줄 바로 아래. 값은 ② 의 「번역」 줄과 같아요(같은 설정 칸 · 바꾸면 둘 다 다시 그려요).
//   번역 담당이 「실리 기본 번역」이면 이 모델로 갈 요청이 없어 흐리게 두고 한 줄로 알려요.
const TR_ID = 'translate';
function buildTranslate(doc, bridge) {
    const [, , covers] = Core.SLOTS.find(([id]) => id === TR_ID);
    const row = slotRow(doc, TR_ID, '번역 모델 직접 고르기', '');
    const note = el(doc, 'small', { attrs: { 'data-bl-bridge-note': '', role: 'status' } });
    const block = el(doc, 'div', { cls: 'bl-ext-bridge bl-ext-bridge-inline', attrs: { 'data-bl-bridge': 'translate' }, kids: [row, note] });
    row.querySelector('span')?.append(el(doc, 'small', { text: ' 블루레몬에이드' }));
    const refresh = () => {
        const config = bridge.config(), status = bridge.status();
        // 바로 위 그 확장 줄의 탭 · 접힘 표식을 그대로 따라요(정리한 보기가 그 줄을 「번역 모델 · 언어」 갈래로 접으면 이 칸도 같이 접혀요)
        const above = block.previousElementSibling;
        if (above) for (const key of ['blTabG', 'blTabOff', 'blFold', 'blFoldOff']) { if (key in above.dataset) block.dataset[key] = above.dataset[key]; else delete block.dataset[key]; }
        paintRow(row, config.models[TR_ID], !!status.owner?.[TR_ID]);
        const off = status.engine === 'st';
        if (off) block.dataset.blOff = ''; else delete block.dataset.blOff;
        for (const select of row.querySelectorAll('select')) select.disabled = off;
        note.textContent = off ? '번역 담당을 「번역 모델 (LLM)」로 바꾸면 써요.' : `회사 · 모델을 바로 골라요(키는 실리태번에 저장된 것 그대로). 비우면 「확장 AI 전체」와 같아요 — 「확장 AI」 탭의 「번역」 줄과 같은 칸이에요. ${covers}.`;
    };
    block.addEventListener('change', event => { if (changeSlot(bridge, event.target, listOptions)) refreshAll(block.closest?.(Core.TARGET.root) || block.parentElement); });
    refreshers.set(block, refresh);
    return block;
}
const watched = new WeakSet();

/** 그 확장의 설정 칸에 우리 칸 둘을 넣어요(이미 있으면 안내 줄 · 목록만 다시). 기능을 안 쓰는 모드면 넣지 않고, 있던 칸은 치워요 */
export function mountBridgeUi(doc, bridge) {
    const content = doc.querySelector(`${Core.TARGET.root} .inline-drawer-content`);
    if (!content || !bridge) return false;
    const blocks = () => [...content.querySelectorAll('[data-bl-bridge]')];
    if (!bridge.status().features) { for (const block of blocks()) block.remove(); return false; }
    attachSheet(doc);
    if (!content.querySelector(':scope > [data-bl-bridge="glossary"]')) place(content, buildGlossary(doc, bridge), groupEnd(rowOf(content, 'trRules')));
    if (!content.querySelector(':scope > [data-bl-bridge="models"]')) place(content, buildModels(doc, bridge), rowOf(content, 'profContact') || rowOf(content, 'aiProfile'));
    // 번역 탭: 「번역 모델 (연결 프로필)」 줄 바로 아래(펼침 안이면 그 안) — 그 줄이 없는 판이면 넣지 않아요
    const trRow = content.querySelector('[data-s="trProfile"]')?.closest?.('label');
    if (trRow && !content.querySelector('[data-bl-bridge="translate"]')) trRow.after(buildTranslate(doc, bridge));
    // 번역 담당 · 번역 프로필을 바꾸면 흐림 · 안내를 다시(그 확장 칸의 바뀜을 듣기만 해요)
    if (!watched.has(content)) {
        watched.add(content);
        content.addEventListener('change', event => { const key = event.target?.getAttribute?.('data-s'); if (key === 'trEngine' || key === 'trProfile') { refreshAll(content); setTimeout(() => refreshAll(content), 0); } });   // 그 확장이 값을 저장한 뒤에 한 번 더(저장 처리가 문서 쪽에서 늦게 돌아요)
    }
    refreshAll(content);
    return true;
}
