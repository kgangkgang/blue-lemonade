// 모델 등록 — 등록한 모델을 실리태번 목록에 넣고, 실리태번이 목록을 새로 채워도 다시 넣는다.
//
// 알아 둘 점 (실리태번 1.18 소스에서 확인)
// - 연결(Connect)하면 saveModelList()가 16개 공급자의 select를 비우고 다시 채운다. 그 사이에 낄 수 있는 이벤트가 없어서
//   각 컨트롤을 MutationObserver로 지켜보다가 다시 넣는 방법만 확실하다.
// - 목록을 새로 채운 뒤 실리태번은 스스로 change를 쏜다. 그 값은 사용자가 고른 것이 아니므로 기억에 반영하면 안 된다.
//   (1.0.3) 그 change는 목록을 갈아 끼운 바로 그 순간에 난다. 그래서 목록이 바뀌지 않았는데 난 change는 모두
//   일부러 고른 것으로 본다 — 블루 레몬에이드의 고르기 팝업, /model 명령, 프리셋 전환은 isTrusted가 거짓이라
//   예전에는 기억되지 않고 60ms 뒤 예전 선택으로 되돌아갔다.
// - 실리태번은 목록에 없는 이름이면 선택을 비우거나 다른 모델로 바꿔 놓는다. 그래서 우리가 기억한 선택이 있으면
//   화면 값이 그것과 다를 때 되돌린다. 사용자가 직접 다른 모델을 고르면 그때 기억이 지워지므로 서로 부딪히지 않는다.
// - 가장 중요한 것: 화면에 보이는 모델과 실리태번이 실제로 들고 있는 값(oai_settings)은 따로 논다.
//   option을 넣거나 값을 코드로 바꿀 때는 change가 나지 않아서, 화면만 바뀌고 실리태번은 예전 값(또는 빈 값)을 그대로 쓴다.
//   그 상태로 연결하면 모델 이름이 비어서 실패한다. 그래서 손을 댄 뒤에는 반드시 두 값을 맞춰 준다.
import { getContext } from '../../../../../../extensions.js';
import { SOURCES, sourceById } from './sources.js';
import { modelsOf, pickOf, rememberPick } from './state.js';

const GROUP_LABEL = '직접 등록한 모델';
const observers = new Map();
const timers = new Map();
/** 공급자별로 실리태번에 밀어 넣어 본 값. 안 받아 주는 공급자에 같은 값을 끝없이 다시 밀지 않으려고 둔다. */
const pushed = new Map();
/** syncStore가 change를 쏘는 동안 참. 우리가 쏜 change를 사용자의 선택으로 적지 않으려고 둔다 (처리기는 그 자리에서 돈다). */
let pushing = false;

function ownGroupOf(control) {
    return control.querySelector(':scope > optgroup[data-model-register]');
}

function optionValues(control, except = null) {
    return [...control.querySelectorAll('option')].filter(option => !except || !except.contains(option)).map(option => option.value);
}

/** 실리태번이 지금 들고 있는 모델 이름. 읽을 수 없으면 null (그때는 건드리지 않는다). */
function storedModel(source) {
    if (!source.key) return null;
    try {
        const settings = getContext?.()?.chatCompletionSettings;
        if (!settings || !(source.key in settings)) return null;
        return String(settings[source.key] ?? '');
    } catch {
        return null;
    }
}

/**
 * 컨트롤 하나에 우리 목록을 넣는다.
 * 실리태번이 이미 갖고 있는 이름은 뺀다 (같은 값이 둘이면 마지막 것이 선택되어 엉뚱한 자리로 튄다).
 * 목록을 다시 만들면 브라우저가 선택을 첫 항목으로 옮기므로, 원래 값이 아직 있으면 조용히 돌려놓는다.
 */
function fillControl(control, models) {
    const group = ownGroupOf(control);
    const taken = new Set(optionValues(control, group));
    const wanted = models.filter(model => !taken.has(model));
    const before = control.value;

    if (!wanted.length) {
        if (group) {
            group.remove();
            keepValue(control, before);
        }
        return;
    }

    const current = group ? [...group.children].map(option => option.value) : null;
    const sameList = current && current.length === wanted.length && current.every((value, index) => value === wanted[index]);
    if (sameList && control.firstElementChild === group) return;

    const next = group ?? document.createElement('optgroup');
    next.dataset.modelRegister = '';
    next.label = GROUP_LABEL;
    if (!sameList) {
        next.replaceChildren(...wanted.map(model => {
            const option = document.createElement('option');
            option.value = model;
            option.textContent = model;
            return option;
        }));
    }
    // 맨 위에 둔다. 실리태번이 목록을 다시 채우면 우리 묶음은 사라지므로 매번 확인한다.
    if (control.firstElementChild !== next) control.prepend(next);
    keepValue(control, before);
}

/** 목록을 건드리며 선택이 밀렸으면, 그 값이 아직 있을 때만 되돌린다 (실리태번에는 여기서 알리지 않는다). */
function keepValue(control, before) {
    if (!before || control.value === before) return;
    if (!optionValues(control).includes(before)) return;
    control.value = before;
}

/** 우리가 넣은 표시가 붙은 option인지. dataset 값은 빈 문자열이라 참/거짓으로 보면 안 된다 (1.0.4 고침). */
function isOwn(option) {
    return option.hasAttribute('data-model-register');
}

/**
 * 자유 입력칸용 자동완성 목록(datalist)은 optgroup을 쓰지 않는다.
 * 1.0.3까지는 우리 option을 실리태번 것으로 잘못 세어(dataset 값이 ''이라 거짓) wanted가 비었고,
 * 그래서 부를 때마다 지웠다 넣었다를 되풀이했다 — 연결 뒤 자동완성이 깜빡이던 원인.
 */
function fillDatalist(datalist, models) {
    const own = [...datalist.querySelectorAll('option[data-model-register]')];
    const taken = new Set([...datalist.querySelectorAll('option')].filter(option => !isOwn(option)).map(option => option.value));
    const wanted = models.filter(model => !taken.has(model));
    const current = own.map(option => option.value);
    if (current.length === wanted.length && current.every((value, index) => value === wanted[index])) return;

    own.forEach(option => option.remove());
    datalist.prepend(...wanted.map(model => {
        const option = document.createElement('option');
        option.value = model;
        option.dataset.modelRegister = '';
        return option;
    }));
}

/**
 * 기억해 둔 선택을 되살린다. 실리태번은 모르는 이름을 만나면 선택을 비우거나(빈 값) 자기가 아는 모델로 바꿔 놓는데,
 * 둘 다 사용자의 뜻이 아니다. 사용자가 직접 고른 순간에만 기억이 바뀌므로 여기서는 늘 기억을 따른다.
 * 실리태번에 알리는 일은 syncStore가 맡는다.
 */
function restorePick(source, control) {
    const pick = pickOf(source.id);
    if (!pick || !modelsOf(source.id).includes(pick)) return;
    if (control.value === pick) return;
    if (!optionValues(control).includes(pick)) return;
    control.value = pick;
}

/**
 * 화면에 우리 모델이 골라져 있는데 실리태번이 다른 값을 들고 있으면 알려 준다.
 *
 * 이게 없으면: 우리가 optgroup을 맨 위에 끼워 넣는 순간 브라우저가 첫 항목을 선택해 버리는데,
 * 코드로 일어난 선택이라 change가 나지 않는다. 그래서 화면에는 등록한 모델이 보이는데
 * 실리태번은 빈 값을 들고 있고, 그대로 연결하면 모델 이름 없이 요청이 나가 실패한다.
 * (사용자 눈에는 "처음엔 무조건 연결이 안 되고, 다른 모델로 갔다가 돌아오면 된다"로 보인다.)
 *
 * 우리 목록에 있는 이름일 때만 나선다. 실리태번이 자기 목록을 갈아 끼우는 도중의 값까지 밀어 넣으면
 * 멀쩡한 설정을 덮어쓸 수 있다.
 */
function syncStore(source, control) {
    const value = control.value;
    if (!value || !modelsOf(source.id).includes(value)) return;

    const stored = storedModel(source);
    if (stored === null || stored === value) {
        pushed.delete(source.id); // 맞춰졌다 — 다음에 또 어긋나면 다시 밀 수 있게 표시를 지운다
        return;
    }
    // 공급자에 따라 실리태번이 우리 값을 받지 않는다(빈 값 무시, 목록 미로딩 등).
    // 그때 계속 밀면 서로 끝없이 주고받으므로 같은 값은 한 번만 민다.
    if (pushed.get(source.id) === value) return;
    pushed.set(source.id, value);
    // 네이티브 이벤트라야 실리태번의 jQuery 처리기가 값을 저장한다.
    pushing = true;
    try {
        control.dispatchEvent(new Event('change', { bubbles: true }));
    } finally {
        pushing = false;
    }
}

/**
 * 선택이 비어 있던 select에 우리 묶음을 넣으면 브라우저가 첫 항목(우리 첫 모델)을 조용히 고른다.
 * 실리태번이 아직 목록에 없는 모델(연결해야 받아 오는 모델)을 들고 있을 때 그대로 두면, syncStore가 우리 첫 모델을
 * 밀어 넣어 저장해 둔 모델을 덮어쓴다. Custom은 공급자를 바꿀 때 실리태번이 보조 select 값을 custom_model로
 * 옮겨 적어서, 직접 쳐 둔 모델 이름이 우리 첫 모델로 바뀐다. 그래서 실리태번이 보던 대로 선택을 다시 비워 둔다.
 * 실리태번 값이 이미 비었으면(버텍스는 불러올 때 스스로 빈 값을 저장한다) 예전처럼 둔다 — 1.0.2의 첫 연결 실패 고침.
 */
function undoAutoSelect(source, control, hadSelection) {
    if (hadSelection || control.selectedIndex === -1) return;
    if (source.kind === 'custom') {
        control.selectedIndex = -1;
        return;
    }
    const stored = storedModel(source);
    if (!stored) return;
    if (optionValues(control).includes(stored)) control.value = stored;
    else control.selectedIndex = -1;
}

/** Custom 공급자는 자유 입력칸이 값의 주인이다. 보조 select만 조용히 맞춰 둔다. */
function syncCustomSelect(source, select) {
    const input = source.input ? document.querySelector(source.input) : null;
    const value = String(input?.value ?? '').trim();
    if (!value || select.value === value) return;
    if (!optionValues(select).includes(value)) return;
    select.value = value;
}

function applySource(source) {
    const models = modelsOf(source.id);
    const select = document.querySelector(source.selector);
    const datalist = source.datalist ? document.querySelector(source.datalist) : null;
    if (datalist) {
        fillDatalist(datalist, models);
        watch(source, datalist);
    }
    if (!select) return;
    const hadSelection = select.selectedIndex !== -1;
    fillControl(select, models);
    undoAutoSelect(source, select, hadSelection);
    if (source.kind === 'custom') {
        syncCustomSelect(source, select);
    } else {
        restorePick(source, select);
        syncStore(source, select);
    }
    watch(source, select);
}

export function applyAll() {
    for (const source of SOURCES) {
        try {
            applySource(source);
        } catch (error) {
            console.error(`[모델 등록] ${source.id} 목록을 넣지 못했어요`, error);
        }
    }
}

export function applyOne(sourceId) {
    const source = sourceById(sourceId);
    if (!source) return;
    try {
        applySource(source);
    } catch (error) {
        console.error(`[모델 등록] ${source.id} 목록을 넣지 못했어요`, error);
    }
}

// 우리가 넣은 것 때문에 감시가 다시 울려도, 같은 상태면 applySource가 아무것도 바꾸지 않아 조용히 멎는다.
function schedule(source) {
    if (timers.has(source.id)) return;
    timers.set(source.id, setTimeout(() => {
        timers.delete(source.id);
        applyOne(source.id);
    }, 60));
}

/**
 * 이벤트에서 부를 때는 바로 넣지 않고 잠깐 미룬다. 실리태번의 onModelChange가 CHATCOMPLETION_MODEL_CHANGED를 쏘는 순간은
 * 우리 change 처리기가 새 선택을 기억하기 전이라, 그 자리에서 되살리면 방금 고른 모델을 예전 선택으로 되돌린다.
 */
export function scheduleAll() {
    for (const source of SOURCES) schedule(source);
}

function watch(source, element) {
    if (observers.has(element)) return;
    const observer = new MutationObserver(() => schedule(source));
    // subtree: OpenAI · Google은 select 안의 묶음(#openai_external_category · #google_other_models)만 갈아 끼운다.
    observer.observe(element, { childList: true, subtree: true });
    observers.set(element, observer);
}

/**
 * 이 change가 실리태번이 목록을 갈아 끼우면서 쏜 것인지.
 * saveModelList는 비우기 · 채우기 · change를 한 번에 이어서 하므로, 그 순간에는 아직 배달되지 않은 DOM 변경 기록이 남아 있다.
 * 기록을 꺼내 가면 감시 콜백이 울리지 않으니 호출하는 쪽에서 schedule을 불러 둔다.
 */
function isRefill(control) {
    return (observers.get(control)?.takeRecords().length ?? 0) > 0;
}

/**
 * 고른 모델을 기억한다.
 * - 네이티브 change: 사람이 고르면 isTrusted가 참이다.
 * - 목록이 그대로인데 난 change: 블루 레몬에이드 고르기 팝업 · /model · 다른 확장이 일부러 바꾼 것 (isTrusted는 거짓).
 *   목록을 갈아 끼우며 난 change(실리태번이 스스로 고른 값)와 우리가 쏜 change만 뺀다.
 * - select2:select: 데스크톱에서 다섯 공급자는 select2로 감싸여 사람의 선택이 가짜 change로 들어온다. 그래서 따로 받는다.
 * - 프리셋 전환: 실리태번이 모델을 input 이벤트({ source: 'preset' })로 바꾼다.
 *
 * 누가 바꿨든 change가 났으면 두 값이 어긋났을 수 있으니 한 번 더 살펴본다.
 */
export function watchPicks() {
    const jq = globalThis.jQuery;
    for (const source of SOURCES) {
        if (source.kind !== 'select') continue;
        const control = document.querySelector(source.selector);
        if (!control) continue;
        const remember = value => rememberPick(source.id, value, { fromUser: true });
        const onChange = trusted => {
            schedule(source);
            const refill = isRefill(control);
            if (pushing) return;
            if (trusted || !refill) remember(control.value);
        };
        if (jq) {
            jq(control).off('.modelRegister');
            jq(control).on('change.modelRegister', event => onChange(event.originalEvent?.isTrusted === true));
            jq(control).on('select2:select.modelRegister', event => {
                remember(event?.params?.data?.id ?? control.value);
            });
            jq(control).on('input.modelRegister', (event, data) => {
                if (data?.source === 'preset') remember(control.value);
            });
        } else {
            control.addEventListener('change', event => onChange(event.isTrusted));
        }
    }
}

export function stopAll() {
    for (const observer of observers.values()) observer.disconnect();
    observers.clear();
    for (const timer of timers.values()) clearTimeout(timer);
    timers.clear();
    pushed.clear();
}
