import { refreshPopupMarks } from './popup-marks.js';
// 아이콘 단추 표식 — CSS :has() 대신 JS 가 .menu_button · 체크 줄 label 에 표식을 단다
// 1) data-bl-icon-text: css/02-controls.css 의 '아이콘만 있는 버튼' 규칙은 `> i` 하나뿐인 .menu_button 을 면 없는 아이콘으로 칠한다.
//    CSS 는 글자 노드를 못 봐서 `<i class="fa-…"></i> 독서 패널 열기` 같은 다른 확장의 글자 버튼도 거기 걸려
//    면 · 여백 없이 글자만 남았다. 아이콘 옆에 맨 글자가 바로 붙은 .menu_button 에만 data-bl-icon-text 를 달아
//    그 규칙에서 뺀다 — 그러면 다른 글자 버튼과 같은 떠 있는 칩. 아이콘만 있는 버튼은 표시가 붙지 않아 그대로다.
// 2) data-bl-icon-only (7.9.9, 속도 P2): 예전엔 CSS 가 `.menu_button:has(> i:only-child)` · `:has(> svg:only-child)` ·
//    `.menu_button_icon:has(> i):not(:has(> span, > b, > strong, > small))` 로 아이콘만 단추를 골랐다. 실리태번 공용 클래스에 걸린 :has 는
//    단추가 수백 개인 화면(빠른 답장 서랍)에서 가장 비싼 갈래라(perf/합본-792), 같은 조건을 여기서 재서 토큰으로 단다:
//      i   = 요소 자식이 <i> 하나뿐   svg = 요소 자식이 <svg> 하나뿐   mbi = .menu_button_icon 이고 바로 아래 <i> 가 있고 span · b · strong · small 이 없음
//    CSS 는 `[data-bl-icon-only~="i"]` 처럼 토큰으로 본다(:only-child 와 같이 글자 노드는 세지 않는다).
// 3) data-bl-row-check (7.9.9, 속도 P2): `label:has(> input[type="checkbox"])` 대신. 바로 아래에 체크박스 input 이 있는 label.
// 4) 메시지 표식 (7.9.9, 속도 P4) — 채팅 · 미리보기(.salty-preview · #salty-nochat)의 .mes 에. 글자가 흘러나올 때마다 조상을 따지던 :has 를 대신한다.
//      data-bl-editing="deep text"  deep = 안에 .edit_textarea 가 있음(`:has(.edit_textarea)`) · text = `> .mes_block > .mes_text > .edit_textarea`
//      data-bl-meta="id timer tok"  `> .mesAvatarWrapper > .mesIDDisplay|.mes_timer|.tokenCounterDisplay:not(:empty)` (주석만 있는 칸은 :empty 와 같이 빈 것으로)
//      data-bl-reasoning-editing    .mes_reasoning_details 안에 .reasoning_edit_textarea 가 있음
// 5) 서랍 줄 표식 (7.9.9, 속도 P3 일부) — 실리태번 서랍의 정적 모양을 :has 로 감지하던 것
//      data-bl-row="neo"    .flex-container 의 요소 자식이 small(첫째) + .neo-range-slider + .neo-range-input 순 (`:has(> small:first-child + .neo-range-slider + .neo-range-input)`)
//      data-bl-row="range"  .range-block 안에 .range-block-title 바로 다음 형제가 .range-block-range-and-counter (`:has(> .range-block-title + .range-block-range-and-counter)`)
//      그 밖의 토큰(ROW_TOKENS 표): sneo · lneo · num · numd · chk · title · slider · idr · soh · odd · api · pmc · copy · sl2 · fplus · sel · logic · subsel · pm · lsel · lsel2 · sel2 ·
//      f1sel · numin · smax · peer · h4 · h4dep · instr · resp · wics · rxp · mui, 자손 신호 dsel(label 안 select) · oai-ctx-unl 등(.range-block 안 생성 설정 칸).
//      표식은 요소 자식이 있는 그릇(div · form · label · span · li …)에 붙고, CSS 는 주어 클래스를 그대로 둔 채 `[data-bl-row~="…"]` 로 고른다.
// 관찰자 콜백은 그리기 전에 돈다 — 새로 붙은 요소가 한 프레임도 다른 모양으로 보이지 않는다.
const MARK = 'data-bl-icon-text';
const ICON_ONLY = 'data-bl-icon-only';
const ROW_CHECK = 'data-bl-row-check';
const EDITING = 'data-bl-editing', META = 'data-bl-meta', R_EDIT = 'data-bl-reasoning-editing';
const ROW = 'data-bl-row';
const TEXTISH = new Set(['span', 'b', 'strong', 'small']);

// 공백이 아닌 글자 노드가 바로 아래에 있나 (span 같은 요소 속 글자는 CSS 가 이미 가린다)
function bareText(el) {
    for (let node = el.firstChild; node; node = node.nextSibling) {
        if (node.nodeType === 3 && node.nodeValue.trim()) return true;
    }
    return false;
}

// <i> 아이콘 자식이 있나. 제 클래스가 fa-solid 인 버튼은 글자도 아이콘 글꼴로 그려지고
// 실리태번 빠른 답장의 '⁝' 처럼 그 글자가 곧 아이콘이라 보지 않는다.
function hasIcon(el) {
    for (let child = el.firstElementChild; child; child = child.nextElementSibling) {
        if (child.localName === 'i') return true;
    }
    return false;
}

// 아이콘만 단추 토큰 — CSS :has 조건과 하나씩 같다
export function iconOnlyTokens(el) {
    const tokens = [];
    const first = el.firstElementChild;
    if (first && el.childElementCount === 1) {
        if (first.localName === 'i') tokens.push('i');
        else if (first.localName === 'svg') tokens.push('svg');
    }
    if (el.classList.contains('menu_button_icon')) {
        let icon = false, textish = false;
        for (let child = first; child; child = child.nextElementSibling) {
            if (child.localName === 'i') icon = true;
            else if (TEXTISH.has(child.localName)) textish = true;
        }
        if (icon && !textish) tokens.push('mbi');
    }
    return tokens.join(' ');
}

function setAttr(el, name, value) {
    if (value === false || value === '') { if (el.hasAttribute(name)) el.removeAttribute(name); return; }
    if (el.getAttribute(name) !== value) el.setAttribute(name, value);
}

function check(el) {
    const want = bareText(el) && hasIcon(el);
    if (want !== el.hasAttribute(MARK)) { if (want) el.setAttribute(MARK, ''); else el.removeAttribute(MARK); }
    setAttr(el, ICON_ONLY, iconOnlyTokens(el));
}

// label 바로 아래 체크박스 input 이 있나
export function hasCheckChild(label) {
    for (let child = label.firstElementChild; child; child = child.nextElementSibling) {
        if (child.localName === 'input' && child.type === 'checkbox') return true;
    }
    return false;
}
function checkLabel(label) {
    const want = hasCheckChild(label);
    if (want !== label.hasAttribute(ROW_CHECK)) { if (want) label.setAttribute(ROW_CHECK, ''); else label.removeAttribute(ROW_CHECK); }
}

// :empty 와 같은 판정 — 주석 · 처리 지시 말고 자식이 하나라도 있으면 비어 있지 않다(공백 글자도 자식)
function nonEmpty(el) {
    for (let n = el.firstChild; n; n = n.nextSibling) if (n.nodeType !== 8 && n.nodeType !== 7) return true;
    return false;
}
export function editingTokens(mes) {
    const tokens = [];
    if (mes.getElementsByClassName('edit_textarea').length) tokens.push('deep');
    let text = false;
    for (const block of mes.children) {
        if (!block.classList.contains('mes_block')) continue;
        for (const mt of block.children) {
            if (!mt.classList.contains('mes_text')) continue;
            for (const e of mt.children) if (e.classList.contains('edit_textarea')) text = true;
        }
    }
    if (text) tokens.push('text');
    return tokens.join(' ');
}
export function metaTokens(mes) {
    let id = false, timer = false, tok = false;
    for (const wrap of mes.children) {
        if (!wrap.classList.contains('mesAvatarWrapper')) continue;
        for (const c of wrap.children) {
            if (!nonEmpty(c)) continue;
            if (c.classList.contains('mesIDDisplay')) id = true;
            else if (c.classList.contains('mes_timer')) timer = true;
            else if (c.classList.contains('tokenCounterDisplay')) tok = true;
        }
    }
    return [id && 'id', timer && 'timer', tok && 'tok'].filter(Boolean).join(' ');
}
// 서랍 줄 표식 표 — 이름 · 조건(요소 자식 순서). CSS 의 옛 :has 조건과 하나씩 같다(토큰 이름은 src/icon-text.js 머리 주석 5) 참고)
const has = (el, c) => el.classList.contains(c);
const tag = (el, t) => el.localName === t;
const numOnly = w => w.childElementCount === 1 && tag(w.firstElementChild, 'input') && w.firstElementChild.type === 'number';
const ROW_TOKENS = [
    ['neo', k => k.length >= 3 && tag(k[0], 'small') && has(k[1], 'neo-range-slider') && has(k[2], 'neo-range-input')],
    ['sneo', k => k.length >= 3 && (tag(k[0], 'small') || tag(k[0], 'label')) && has(k[1], 'neo-range-slider') && has(k[2], 'neo-range-input')],
    ['lneo', k => k.some((c, i) => tag(c, 'label') && k[i + 1] && has(k[i + 1], 'neo-range-slider') && k[i + 2] && has(k[i + 2], 'neo-range-input'))],
    ['range', k => k.some((c, i) => has(c, 'range-block-title') && k[i + 1] && has(k[i + 1], 'range-block-range-and-counter'))],
    ['num', k => k.some((c, i) => has(c, 'range-block-title') && k[i + 1] && has(k[i + 1], 'wide100p') && numOnly(k[i + 1]))],
    ['numd', k => k.some((c, i) => has(c, 'range-block-title') && k[i + 1] && has(k[i + 1], 'toggle-description') && k[i + 2] && has(k[i + 2], 'wide100p') && numOnly(k[i + 2]))],
    ['chk', k => !!k[0] && tag(k[0], 'label') && has(k[0], 'checkbox_label')],
    ['title', k => k.some(c => has(c, 'range-block-title'))],
    ['slider', k => k.some(c => has(c, 'neo-range-slider'))],
    ['idr', k => k.some(c => has(c, 'inline-drawer'))],
    ['soh', k => k.some(c => has(c, 'standoutHeader'))],
    ['odd', k => k.some(c => has(c, 'oneline-dropdown'))],
    ['api', k => k.some(c => has(c, 'api_button'))],
    ['pmc', k => k.some(c => has(c, 'prompt_manager_prompt_controls'))],
    ['copy', k => k.some(c => has(c, 'bl-copyright'))],
    ['sl2', k => k.some((c, i) => has(c, 'salty-slider') && k[i + 1] && has(k[i + 1], 'salty-slider'))],
    ['fplus', k => k.some(c => has(c, 'menu_button_icon') && [...c.children].some(g => has(g, 'fa-folder-plus')))],
    ['sel', k => k.some(c => tag(c, 'select'))],
    ['logic', k => k.some(c => tag(c, 'select') && c.name === 'entryLogicType')],
    ['subsel', k => k.some(c => tag(c, 'select') && c.name === 'substitute_regex')],
    ['pm', k => k.some(c => tag(c, 'select') && c.hasAttribute('data-preset-manager-for'))],
    ['lsel', k => k.some((c, i) => (tag(c, 'span') || tag(c, 'label')) && k[i + 1] && tag(k[i + 1], 'select'))],
    ['lsel2', k => k.some((c, i) => tag(c, 'label') && k[i + 1] && tag(k[i + 1], 'select'))],
    ['sel2', k => k.some((c, i) => tag(c, 'label') && k[i + 1] && has(k[i + 1], 'flex-container') && [...k[i + 1].children].some(g => tag(g, 'select')))],
    ['f1sel', k => k.some(c => has(c, 'flex1') && !!c.querySelector('select'))],
    ['numin', k => k.some(c => tag(c, 'input') && c.type === 'number')],
    ['smax', k => k.some((c, i) => tag(c, 'small') && k[i + 1] && has(k[i + 1], 'editor_maximize'))],
    ['peer', k => k.some((c, i) => tag(c, 'input') && c.type === 'checkbox' && has(c, 'peer') && has(c, 'sr-only') && k[i + 1] && tag(k[i + 1], 'label'))],
    ['h4', k => k.some(c => tag(c, 'h4'))],
    ['h4dep', k => k.some(c => tag(c, 'h4') && [...c.children].some(g => g.getAttribute('data-i18n') === '(DEPRECATED)'))],
    ['instr', k => k.some(c => c.id === 'instruct_names_behavior')],
    ['resp', k => k.some(c => c.id === 'bl-response-range')],
    ['wics', k => k.some(c => c.id === 'world_info_character_strategy')],
    ['rxp', k => k.some(c => c.id === 'regex_presets')],
    ['mui', k => k.some(c => c.id === 'movingUIModeCheckBlock')],
];
// 자손을 보는 신호 — label 안 select, .range-block 안 생성 설정 칸(아이디)
const DEEP_IDS = [['oai-ctx-unl', 'oai_max_context_unlocked'], ['stream', 'stream_toggle'], ['oai-ctx', 'openai_max_context'], ['oai-tok', 'openai_max_tokens'], ['n-openai', 'n_openai'], ['seed', 'seed_openai']];
export function rowTokens(el) {
    const k = [...el.children]; const tokens = [];
    for (const [name, test] of ROW_TOKENS) if (test(k, el)) tokens.push(name);
    if (tag(el, 'label') && el.querySelector('select')) tokens.push('dsel');
    if (has(el, 'range-block')) for (const [name, id] of DEEP_IDS) if (el.querySelector('#' + id)) tokens.push(name);
    return tokens.join(' ');
}
// 표식이 붙을 수 있는 요소 — 자식 줄 모양을 보는 그릇. CSS 주어가 div · form · label · span · li 등 여러 태그라 요소 자식이 있는 요소면 다 본다(글자 · 그림 · 입력 요소와 svg 안은 뺌)
const NOT_HOST = new Set(['script', 'style', 'template', 'svg', 'path', 'g', 'use', 'select', 'option', 'optgroup', 'textarea', 'input', 'img', 'video', 'canvas', 'iframe', 'br', 'hr', 'i']);
function isRowHost(el) { return !NOT_HOST.has(el.localName) && !el.closest('svg'); }
function checkRow(el) { setAttr(el, ROW, rowTokens(el)); }
function checkMes(mes) { setAttr(mes, EDITING, editingTokens(mes)); setAttr(mes, META, metaTokens(mes)); }
function checkReasoning(details) {
    const want = details.getElementsByClassName('reasoning_edit_textarea').length > 0;
    if (want !== details.hasAttribute(R_EDIT)) { if (want) details.setAttribute(R_EDIT, ''); else details.removeAttribute(R_EDIT); }
}

function scan(node) {
    if (node.classList?.contains('menu_button')) check(node);
    else if (node.localName === 'label') checkLabel(node);
    if (node.classList?.contains('mes')) checkMes(node);
    if (node.classList?.contains('mes_reasoning_details')) checkReasoning(node);
    if ((node.firstElementChild || node.hasAttribute(ROW)) && isRowHost(node)) checkRow(node);
    if (!node.firstElementChild) return;
    for (const el of node.getElementsByClassName('menu_button')) check(el);
    for (const el of node.getElementsByTagName('label')) checkLabel(el);
    for (const el of node.getElementsByClassName('mes')) checkMes(el);
    for (const el of node.getElementsByClassName('mes_reasoning_details')) checkReasoning(el);
    for (const el of node.getElementsByTagName('*')) if ((el.firstElementChild || el.hasAttribute(ROW)) && isRowHost(el)) checkRow(el);
}

// 바뀐 요소 하나 — .menu_button 이면 단추 표식, label 이면 체크 줄 표식, input 이 바뀌었으면 그 부모 label
function touched(el) {
    if (el.classList.contains('menu_button')) check(el);
    else if (el.localName === 'label') checkLabel(el);
    else if (el.localName === 'input' && el.parentElement?.localName === 'label') checkLabel(el.parentElement);
    // 메시지 안이 바뀌면(편집칸 넣고 빼기 · 타이머 · 토큰 글자) 그 메시지 표식을 다시
    const mes = el.closest('.mes'); if (mes) checkMes(mes);
    const details = el.closest('.mes_reasoning_details'); if (details) checkReasoning(details);
    // 자식 줄이 바뀐 .flex-container · .range-block 과, 클래스가 바뀐 자식의 부모
    if (isRowHost(el)) checkRow(el);
    const p = el.parentElement; if (p && isRowHost(p)) checkRow(p);
    const lab = el.closest('label'); if (lab && lab !== el) checkRow(lab);
    const rb = el.closest('.range-block'); if (rb && rb !== el && rb !== p) checkRow(rb);
}

// 같은 콜백 안의 반복 기록은 마지막 DOM 상태 한 번으로 모아요.
// 붙인 부모를 훑으면 그 안 자식도 함께 확인하므로, 중첩해서 붙인 자식을 또 훑지 않아요.
export function mutationWork(records) {
    const targets = new Set(), added = new Set();
    for (const record of records) {
        const target = record.target.nodeType === 1 ? record.target : record.target.parentElement;
        if (target && target.isConnected !== false) targets.add(target);
        for (const node of record.addedNodes || []) if (node.nodeType === 1 && node.isConnected !== false) added.add(node);
    }
    const roots = [...added].filter(node => {
        for (let p = node.parentElement; p; p = p.parentElement) if (added.has(p)) return false;
        return true;
    });
    const rootSet = new Set(roots);
    const remaining = [...targets].filter(node => {
        for (let p = node; p; p = p.parentElement) if (rootSet.has(p)) return false;
        return true;
    });
    return { roots, targets: remaining };
}

let started = false;
export function startIconTextMark() {
    if (started || !document.body) return;
    started = true;
    scan(document.body);
    refreshPopupMarks(null, document.body);
    // 붙은 요소 속 .menu_button · label · .mes 와, 자식(글자 · 아이콘 · 편집칸 · 타이머 글자)이 바뀐 요소, 클래스(menu_button_icon) · type 이 바뀐 요소만 본다.
    new MutationObserver((records) => {
        const work = mutationWork(records);
        for (const node of work.roots) scan(node);
        for (const target of work.targets) touched(target);
        refreshPopupMarks(records);
    }).observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['class', 'type', 'id'] });
}
