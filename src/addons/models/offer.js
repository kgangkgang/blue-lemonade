// 모델 등록 1.1.6 — 업데이트로 테마가 새 모델을 알게 되면 한 번 「새 모델을 추가할까요?」 팝업
// 테마가 아는 최신(live-models KNOWN) 가운데 실리태번 메뉴에도 · 등록한 목록에도 없는 이름을 공급자별로 보여 주고,
// 체크해 둔 채 「추가」를 누른 것만 등록한다 — 그러면 그 공급자 메뉴 맨 위 묶음에 나온다 (inject.js).
// 한 번 보여 준 이름은 settings().offered 에 적어 다시 묻지 않는다 (추가 · 안 함 · 닫기 모두). 나중에는 이 창 입력칸 자동완성으로 넣으면 된다.
import { callGenericPopup, POPUP_RESULT, POPUP_TYPE } from '../../../../../../popup.js';
// state.js 는 live-models.js 를 불러오면 안 된다 (panel.js 머리말 참고) — 그래서 여기서 읽는다
import * as LM from '../../live-models.js';
import { SOURCES } from './sources.js';
import { TITLE, modelsOf, saveSettings, setModels, settings } from './state.js';
import { applyOne } from './inject.js';
import { pickNew, pruneStep, withAdded, withOffered } from './offer-core.js';

let asking = false;

let builtIn = null;

/**
 * 1.1.7 실리태번 기본 목록: index.html 원본의 공급자 select option 값 { [공급자]: Set }. 한 번만 받는다 · 못 받으면 null (다음에 다시).
 * 화면 select 는 다른 확장이 넣은 묶음 · 연결하면 채워지는 계정 목록(OpenAI External · Google Other)이 섞여 있어 쓰지 않는다.
 */
export function builtInLists() {
    builtIn ??= fetch(new URL('index.html', document.baseURI), { cache: 'force-cache' })
        .then(res => (res.ok ? res.text() : Promise.reject(new Error(`index.html ${res.status}`))))
        .then((html) => {
            const page = new DOMParser().parseFromString(html, 'text/html');
            const lists = {};
            for (const source of SOURCES) {
                if (source.kind !== 'select' || source.wiped) continue;
                const select = page.querySelector(source.selector);
                if (select) lists[source.id] = new Set([...select.querySelectorAll('option')].map(option => option.value).filter(Boolean));
            }
            return lists;
        })
        .catch((error) => { builtIn = null; console.warn('[모델 등록] 실리태번 기본 목록을 읽지 못했어요', error); return null; });
    return builtIn;
}

/**
 * 1.1.7 실리태번 기본 목록에 들어온 등록은 뺀다 — 그 모델은 실리태번 메뉴의 제자리에 그대로 나온다. 바뀐 [{ source, gone, back }]
 * 고정 목록 select 공급자만: 받아 오는 목록(wiped) · Custom 은 계정 · 연결마다 달라 등록이 유일한 길일 수 있다.
 */
export async function pruneNative(lists = null) {
    const builtins = lists ?? await builtInLists();
    if (!builtins) return [];
    const store = settings();
    const changed = [];
    for (const source of SOURCES) {
        if (source.kind !== 'select' || source.wiped) continue;
        const step = pruneStep(modelsOf(source.id), builtins[source.id], store.pruned?.[source.id]);
        store.pruned ??= {};
        if (step.memo.length) store.pruned[source.id] = step.memo;
        else delete store.pruned[source.id];
        if (!step.gone.length && !step.back.length) continue;
        setModels(source.id, step.keep);
        applyOne(source.id);
        changed.push({ source: source.id, gone: step.gone, back: step.back });
    }
    saveSettings();
    const names = changed.flatMap(item => item.gone);
    if (names.length && typeof toastr !== 'undefined') toastr.info(`실리태번 목록에 들어온 모델은 등록에서 뺐어요: ${names.join(', ')}`, TITLE, { timeOut: 6000 });
    return changed;
}

/** 아직 안 물어본 새 모델 [{ source, label, models }] */
export function newModels() {
    const offered = settings().offered ?? {};
    return pickNew(SOURCES, id => ({ known: LM.KNOWN?.[id], page: LM.pageModels(id), registered: modelsOf(id), offered: offered[id] }));
}

function groupNode(group, boxes) {
    const node = document.createElement('div');
    node.className = 'mr-offer-group';
    const head = document.createElement('div');
    head.className = 'mr-offer-source';
    head.textContent = group.label;
    node.append(head);
    for (const model of group.models) {
        const row = document.createElement('label');
        row.className = 'checkbox_label mr-offer-row';
        const box = document.createElement('input');
        box.type = 'checkbox';
        box.checked = true;
        box.value = model;
        const name = document.createElement('span');
        name.textContent = model;
        row.append(box, name);
        node.append(row);
        boxes.push({ source: group.source, box });
    }
    return node;
}

/** 새 모델이 있으면 묻는다. 추가한 [{ source, models }] 를 돌려준다 (없거나 안 함이면 []) */
export async function offerNewModels() {
    if (asking) return [];
    const groups = newModels();
    if (!groups.length) return [];
    asking = true;
    try {
        const boxes = [];
        const content = document.createElement('div');
        content.className = 'mr-offer';
        const title = document.createElement('b');
        title.className = 'mr-offer-title';
        title.textContent = '새 모델을 추가할까요?';
        content.append(title, ...groups.map(group => groupNode(group, boxes)));
        const answer = await callGenericPopup(content, POPUP_TYPE.CONFIRM, '', {
            okButton: '추가', cancelButton: '안 함', allowVerticalScrolling: true,
            onOpen: popup => popup?.dlg?.classList.add('bl-roomy-dialog'),
        });
        const store = settings();
        store.offered = withOffered(store.offered, groups);
        saveSettings();
        if (answer !== POPUP_RESULT.AFFIRMATIVE) return [];
        const added = [];
        for (const group of groups) {
            const models = boxes.filter(item => item.source === group.source && item.box.checked).map(item => item.box.value);
            if (!models.length) continue;
            setModels(group.source, withAdded(modelsOf(group.source), models));
            applyOne(group.source);
            added.push({ source: group.source, models });
        }
        const count = added.reduce((sum, item) => sum + item.models.length, 0);
        if (count && typeof toastr !== 'undefined') toastr.success(`새 모델 ${count}개를 추가했어요.`, TITLE, { timeOut: 2500 });
        return added;
    } finally {
        asking = false;
    }
}
