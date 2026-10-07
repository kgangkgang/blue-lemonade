// 모델 등록 — 설정 화면 (확장 설정 두 번째 칸에 붙는다)
import { callGenericPopup, POPUP_RESULT, POPUP_TYPE } from '../../../../../../popup.js';
import { SOURCES, sourceById } from './sources.js';
import { TITLE, VERSION, modelsOf, movePick, pickOf, setModels, settings } from './state.js';
import { applyOne } from './inject.js';
// 공용 모델 목록 — state.js 는 이것을 불러오면 안 된다 (live-models.js 가 맨 위 await 로 state.js 를 읽음)
import * as LM from '../../live-models.js';

const LAST_SOURCE_KEY = 'model_register_last_source';
const SUGGEST_ID = 'model_register_suggest';
const MAX_SUGGEST = 300;
let root = null, suggestLater = false;
const holder=document.createElement('div');holder.hidden=true;document.body.append(holder);
let currentId = 'vertexai';

function $(selector) {
    return root?.querySelector(selector) ?? null;
}

function toast(kind, message, options = {}) {
    if (typeof toastr !== 'undefined') toastr[kind](message, TITLE, { timeOut: kind === 'success' ? 1800 : 2500, ...options });
}

function textNode(text) {
    const element = document.createElement('div');
    element.textContent = text;
    return element;
}

export function buildPanel() {
    const container = holder;
    if (!container || root) return;

    currentId = localStorage.getItem(LAST_SOURCE_KEY) || firstUsedSource();

    root = document.createElement('div');
    root.id = 'model_register_settings';
    root.className = 'mr-settings';
    root.innerHTML = `
        <div class="inline-drawer">
            <div class="inline-drawer-toggle inline-drawer-header">
                <b><i class="fa-solid fa-list-ul"></i> ${TITLE} <span class="mr-version ext-version">v${VERSION}</span></b>
                <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
            </div>
            <div class="inline-drawer-content">
                <div class="mr-body">
                    <small class="mr-hint">등록한 모델은 그 공급자의 모델 목록 맨 위 “직접 등록한 모델”에 이 순서대로 나와요. 원래 목록에 있던 모델도 이리로 옮겨 와요.</small>
                    <div class="mr-row">
                        <select class="text_pole mr-source"></select>
                    </div>
                    <small class="mr-hint mr-source-note"></small>
                    <div class="mr-row">
                        <input type="text" class="text_pole mr-input" placeholder="모델 이름 (예: gemini-3.8-flash)" autocomplete="off" list="${SUGGEST_ID}">
                        <datalist id="${SUGGEST_ID}"></datalist>
                        <div class="menu_button menu_button_icon mr-add" title="적은 이름을 목록에 넣어요"><i class="fa-solid fa-plus"></i><span>추가</span></div>
                    </div>
                    <div class="mr-list"></div>
                    <small class="mr-count"></small>
                </div>
            </div>
        </div>`;
    container.append(root);

    $('.mr-source').addEventListener('change', event => {
        currentId = event.target.value;
        localStorage.setItem(LAST_SOURCE_KEY, currentId);
        render();
        autoList();
    });
    $('.mr-add').addEventListener('click', onAdd);
    $('.mr-input').addEventListener('keydown', event => {
        if (event.key === 'Enter') { event.preventDefault(); onAdd(); }
    });
    // 미뤄 둔 제안은 입력칸을 누를 때 · 떠날 때 채운다
    $('.mr-input').addEventListener('focus', () => { if (suggestLater) renderSuggest(); });
    $('.mr-input').addEventListener('blur', () => { if (suggestLater) renderSuggest(); });
    // 새 목록을 받으면 (모델 전환 · 번역 · TTS … 어디서 받았든) 지금 공급자의 제안만 다시 — 입력 중이면 칸을 떠날 때
    LM.onChange(({ source }) => {
        if (!root?.isConnected || source !== LM.sourceOf(currentId)) return;
        if (document.activeElement === $('.mr-input')) { suggestLater = true; return; }
        renderSuggest();
    });
    $('.mr-list').addEventListener('click', onListClick);
    startDrag($('.mr-list'));

    render();
}

function firstUsedSource() {
    const used = Object.keys(settings().sources);
    return used.length ? used[0] : 'vertexai';
}

export function render() {
    if (!root) return;
    const source = sourceById(currentId) ?? SOURCES[0];
    currentId = source.id;

    const picker = $('.mr-source');
    picker.replaceChildren(...SOURCES.map(item => {
        const option = document.createElement('option');
        const count = modelsOf(item.id).length;
        option.value = item.id;
        option.textContent = count ? `${item.label} · ${count}개` : item.label;
        option.selected = item.id === source.id;
        return option;
    }));

    const notes = [];
    if (source.wiped) notes.push('연결할 때마다 실리태번이 이 공급자의 목록을 새로 받아 와요. 등록한 모델은 그때마다 다시 넣어 둬요.');
    if (source.note) notes.push(source.note);
    $('.mr-source-note').textContent = notes.join(' ');

    const models = modelsOf(source.id);
    const pick = pickOf(source.id);
    const list = $('.mr-list');
    if (!models.length) {
        list.innerHTML = '<div class="mr-empty">아직 등록한 모델이 없어요.</div>';
    } else {
        list.replaceChildren(...models.map((model, index) => {
            const row = document.createElement('div');
            row.className = `mr-item${model === pick ? ' is-picked' : ''}`;
            row.dataset.index = String(index);
            row.dataset.name = model;
            row.innerHTML = `
                <button type="button" class="mr-handle" title="끌어서 이동" tabindex="-1" aria-hidden="true">⠿</button>
                <span class="mr-name"></span>
                <span class="mr-item-buttons">
                    <div class="menu_button fa-solid fa-arrow-up" data-act="up" title="위로"></div>
                    <div class="menu_button fa-solid fa-arrow-down" data-act="down" title="아래로"></div>
                    <div class="menu_button fa-solid fa-pen" data-act="rename" title="이름 고치기"></div>
                    <div class="menu_button fa-solid fa-trash" data-act="delete" title="지우기"></div>
                </span>`;
            row.querySelector('.mr-name').textContent = model;
            return row;
        }));
    }

    const total = Object.values(settings().sources).reduce((sum, entries) => sum + entries.length, 0);
    $('.mr-count').textContent = `이 공급자 ${models.length}개 · 전체 ${total}개`;
    renderSuggest();
}

/** 등록할 만한 새 이름 (새것 먼저): 공용 목록(받은 목록 · 테마가 아는 최신 이름) 가운데 실리태번 목록에도 등록한 목록에도 없는 것 */
export function suggestions(sourceId) {
    const have = new Set([...LM.pageModels(sourceId), ...LM.registered(sourceId)]);
    return LM.list(sourceId, { proxy: LM.inheritedProxyUrl(sourceId) }).ids.filter(id => !have.has(id)).slice(0, MAX_SUGGEST);   // 5.7.1 본체가 프록시로 받는 목록
}

/** 입력칸 자동완성 목록 (같은 내용이면 손대지 않음). 창이 숨은 자리에 있으면(페이지를 열 때) 미룬다 */
function renderSuggest() {
    suggestLater = false;
    const list = root?.querySelector(`#${SUGGEST_ID}`);
    if (!list) return;
    if (holder.contains(root)) { suggestLater = true; return; }
    const ids = suggestions(currentId), sig = `${currentId}\n${ids.join('\n')}`;
    if (list.dataset.sig === sig) return;
    list.dataset.sig = sig;
    list.replaceChildren(...ids.map(id => { const option = document.createElement('option'); option.value = id; return option; }));
}

/** 창을 열 때 · 공급자를 바꿀 때: 그 공급자의 목록이 오래됐으면 조용히 다시 (키가 있을 때만 · Custom 은 실리태번 주소) */
function autoList() {
    LM.autoRefresh(currentId).catch(() => {});
}

// 4.5.2: '모델 순서' 애드온을 여기로 합쳤다. 그 애드온에만 있던 것이 ⠿ 끌기뿐이라(나머지는 sources.js 가
// 바이트까지 같고 ↑↓ 정렬은 이미 여기 있었다) 끌기만 옮겨 왔다. 휴대폰에서는 ↑↓ 버튼을 쓰면 된다.
let drag = null;
function startDrag(list) {
    list.addEventListener('pointerdown', (event) => {
        const handle = event.target.closest('.mr-handle');
        if (!handle || event.button !== 0) return;
        event.preventDefault();
        const row = handle.closest('.mr-item');
        drag = { id: currentId, before: [...modelsOf(currentId)], name: row.dataset.name, pointer: event.pointerId, handle };
        try { handle.setPointerCapture(event.pointerId); } catch { /* 캡처를 못 잡아도 끌기는 된다 */ }
        row.classList.add('mr-dragging');
    });
    list.addEventListener('pointermove', (event) => {
        if (!drag || event.pointerId !== drag.pointer) return;
        const target = document.elementFromPoint(event.clientX, event.clientY)?.closest('.mr-item');
        const moving = [...list.children].find(r => r.dataset.name === drag.name);
        if (target && moving && target !== moving && list.contains(target)) {
            const rect = target.getBoundingClientRect();
            list.insertBefore(moving, event.clientY > rect.top + rect.height / 2 ? target.nextSibling : target);
        }
        const rect = list.getBoundingClientRect();
        if (event.clientY < rect.top + 28) list.scrollTop -= 14;
        else if (event.clientY > rect.bottom - 28) list.scrollTop += 14;
    });
    const end = (event, cancel) => {
        if (!drag || event.pointerId !== drag.pointer) return;
        const held = drag;
        const next = [...list.querySelectorAll('.mr-item')].map(r => r.dataset.name);
        drag = null;
        try { held.handle.releasePointerCapture(event.pointerId); } catch { /* 이미 놓았을 수 있다 */ }
        // 끄는 사이에 목록이 바뀌었으면 손대지 않고 그대로 다시 그린다
        if (cancel || JSON.stringify(modelsOf(held.id)) !== JSON.stringify(held.before)) { render(); return; }
        if (JSON.stringify(next) === JSON.stringify(held.before)) { render(); return; }
        save(held.id, next);
    };
    list.addEventListener('pointerup', event => end(event, false));
    list.addEventListener('pointercancel', event => end(event, true));
    list.addEventListener('keydown', (event) => { if (event.key === 'Escape' && drag) { drag = null; render(); } });
}

function save(sourceId, models) {
    setModels(sourceId, models);
    applyOne(sourceId);
    render();
}

function onAdd() {
    const input = $('.mr-input');
    const name = String(input.value ?? '').trim();
    if (!name) {
        toast('warning', '모델 이름을 적어 주세요.');
        return;
    }
    const models = modelsOf(currentId);
    if (models.includes(name)) {
        toast('info', '이미 등록된 이름이에요.');
        return;
    }
    save(currentId, [...models, name]);
    input.value = '';
    toast('success', `${name}을(를) 등록했어요.`);
}

async function onListClick(event) {
    const button = event.target.closest('[data-act]');
    if (!button) return;
    const row = button.closest('.mr-item');
    if (!row) return;
    // 확인창을 띄운 사이에 목록이나 공급자가 바뀔 수 있으니, 순서가 아니라 이름으로 다시 찾는다.
    const sourceId = currentId;
    const name = row.dataset.name ?? '';
    const act = button.dataset.act;

    const indexNow = () => modelsOf(sourceId).indexOf(name);
    if (indexNow() < 0) return;

    if (act === 'delete') {
        const ok = await callGenericPopup(textNode(`'${name}'을(를) 목록에서 지울까요?`), POPUP_TYPE.CONFIRM);
        if (ok !== POPUP_RESULT.AFFIRMATIVE) return;
        const models = [...modelsOf(sourceId)];
        const index = models.indexOf(name);
        if (index < 0) return;
        models.splice(index, 1);
        save(sourceId, models);
        return;
    }

    if (act === 'rename') {
        const answer = await callGenericPopup(textNode('새 모델 이름'), POPUP_TYPE.INPUT, name);
        // 취소는 false, 닫기는 null/undefined로 온다. 그대로 글자로 바꾸면 'false'라는 이름이 생긴다.
        if (typeof answer !== 'string') return;
        const next = answer.trim();
        if (!next || next === name) return;
        const models = [...modelsOf(sourceId)];
        const index = models.indexOf(name);
        if (index < 0) return;
        if (models.includes(next)) {
            toast('info', '이미 등록된 이름이에요.');
            return;
        }
        models[index] = next;
        movePick(sourceId, name, next); // 고른 모델의 이름을 바꿨으면 기억도 따라간다
        save(sourceId, models);
        return;
    }

    const models = [...modelsOf(sourceId)];
    const index = models.indexOf(name);
    const to = act === 'up' ? index - 1 : index + 1;
    if (to < 0 || to >= models.length) return;
    [models[index], models[to]] = [models[to], models[index]];
    save(sourceId, models);
}

let opening=false;
export async function openPanel(){
 if(inlineHost?.isConnected&&inlineHost.offsetParent){root.scrollIntoView({block:'nearest'});return;}
 if(opening)return;opening=true;buildPanel();render();autoList();
 root.querySelector('.inline-drawer-content').style.display='block';
 try{await callGenericPopup(root,POPUP_TYPE.TEXT,'',{okButton:'닫기',wide:true,allowVerticalScrolling:true,onOpen: popup => { popup?.dlg?.classList.add('bl-roomy-dialog'); renderSuggest(); }});}
 finally{(inlineHost?.isConnected?inlineHost:holder).replaceChildren(root);opening=false;}
}

let inlineHost=null;
export function mountInline(host) {
    buildPanel();render();autoList();
    inlineHost=host;if(opening)host.textContent='열린 설정창을 닫으면 여기에 표시돼요.';else{host.replaceChildren(root);renderSuggest();}root.classList.add('bl-embedded-settings');
    const content=root.querySelector('.inline-drawer-content');if(content)content.style.display='block';
    return ()=>{if(inlineHost!==host)return;inlineHost=null;root.classList.remove('bl-embedded-settings');if(!opening)holder.append(root);};
}
