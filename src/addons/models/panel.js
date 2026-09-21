// 모델 등록 — 설정 화면 (확장 설정 두 번째 칸에 붙는다)
import { callGenericPopup, POPUP_RESULT, POPUP_TYPE } from '../../../../../../popup.js';
import { SOURCES, sourceById } from './sources.js';
import { TITLE, VERSION, modelsOf, movePick, pickOf, setModels, settings } from './state.js';
import { applyOne } from './inject.js';

const LAST_SOURCE_KEY = 'model_register_last_source';
let root = null;
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
                    <small class="mr-hint">모델 목록에 없는 이름을 직접 넣어 두면, 그 공급자의 모델 목록 맨 위 “직접 등록한 모델”에 나와요.</small>
                    <div class="mr-row">
                        <select class="text_pole mr-source"></select>
                    </div>
                    <small class="mr-hint mr-source-note"></small>
                    <div class="mr-row">
                        <input type="text" class="text_pole mr-input" placeholder="모델 이름 (예: gemini-3.8-flash)" autocomplete="off">
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
    });
    $('.mr-add').addEventListener('click', onAdd);
    $('.mr-input').addEventListener('keydown', event => {
        if (event.key === 'Enter') { event.preventDefault(); onAdd(); }
    });
    $('.mr-list').addEventListener('click', onListClick);

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
 if(opening)return;opening=true;buildPanel();render();
 root.querySelector('.inline-drawer-content').style.display='block';
 try{await callGenericPopup(root,POPUP_TYPE.TEXT,'',{okButton:'닫기',wide:true,allowVerticalScrolling:true,onOpen: popup => popup?.dlg?.classList.add('bl-roomy-dialog')});}
 finally{(inlineHost?.isConnected?inlineHost:holder).replaceChildren(root);opening=false;}
}

let inlineHost=null;
export function mountInline(host) {
    buildPanel();render();
    inlineHost=host;if(opening)host.textContent='열린 설정창을 닫으면 여기에 표시돼요.';else host.replaceChildren(root);root.classList.add('bl-embedded-settings');
    const content=root.querySelector('.inline-drawer-content');if(content)content.style.display='block';
    return ()=>{if(inlineHost!==host)return;inlineHost=null;root.classList.remove('bl-embedded-settings');if(!opening)holder.append(root);};
}
