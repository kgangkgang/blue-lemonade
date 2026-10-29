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
// 8.2.6 성능: 위 35가지 검사는 모두 「자식 가운데 이 클래스 · 태그 · 아이디를 가진 것이 하나는 있다」를 전제로 해요(검사마다 꼭 필요한 자식 특징을 모은 표).
//   그런 자식이 하나도 없는 요소(프롬프트 목록 줄 · 아이콘 칸처럼 대부분)는 35가지를 돌리지 않고 바로 건너뛰어요 — 결과는 같아요(tools/tests/icon-text-scope.mjs 가 옛 표와 견줘요).
//   토글 한 번에 프롬프트 목록 139줄이 통째로 다시 그려질 때 줄마다 35가지 검사가 돌던 것이 이 감시의 가장 큰 몫이었어요(전수조사 4절 2).
const ROW_CHILD_CLASSES = new Set(['neo-range-slider', 'range-block-title', 'checkbox_label', 'inline-drawer', 'standoutHeader', 'oneline-dropdown', 'api_button', 'prompt_manager_prompt_controls', 'bl-copyright', 'salty-slider', 'menu_button_icon', 'flex-container', 'flex1', 'editor_maximize']);
const ROW_CHILD_TAGS = new Set(['select', 'input', 'h4']);
const ROW_CHILD_IDS = new Set(['instruct_names_behavior', 'bl-response-range', 'world_info_character_strategy', 'regex_presets', 'movingUIModeCheckBlock']);
export function rowCandidate(el) {
    for (const c of el.children) {
        if (ROW_CHILD_TAGS.has(c.localName) || (c.id && ROW_CHILD_IDS.has(c.id))) return true;
        const list = c.classList;
        if (list.length === 0) continue;
        // 자식의 클래스 몇 개만 표에서 찾아요(표 14개를 자식마다 contains 로 묻지 않게). 되풀이할 수 없는 흉내(시험)는 contains 로
        if (typeof list[Symbol.iterator] === 'function') { for (const name of list) if (ROW_CHILD_CLASSES.has(name)) return true; }
        else for (const name of ROW_CHILD_CLASSES) if (list.contains(name)) return true;
    }
    return false;
}
// 10-30 perf-icon: 걸릴 자식이 있는 요소(설정 서랍의 input · select · flex-container 를 품은 줄 수천 개)도 예전에는 35가지 검사를 다 돌렸어요(부팅 폰 4배 0.25~0.33초).
//   검사마다 꼭 필요한 자식 특징은 하나씩 정해져 있어서(ROW_NEED — 위 표의 조건을 하나씩 옮긴 것), 자식을 한 번 훑어 있는 특징을 모으고
//   그 특징이 있는 검사만 돌려요. 특징이 없으면 그 검사는 어차피 거짓이라 결과는 같아요(tools/tests/icon-text-scope.mjs · drawer-marks.mjs 가 옛 표와 견줘요).
const ROW_NEED = {
    neo: '.neo-range-slider', sneo: '.neo-range-slider', lneo: '.neo-range-slider', range: '.range-block-title', num: '.range-block-title', numd: '.range-block-title',
    chk: '.checkbox_label', title: '.range-block-title', slider: '.neo-range-slider', idr: '.inline-drawer', soh: '.standoutHeader', odd: '.oneline-dropdown', api: '.api_button',
    pmc: '.prompt_manager_prompt_controls', copy: '.bl-copyright', sl2: '.salty-slider', fplus: '.menu_button_icon', sel: 'select', logic: 'select', subsel: 'select', pm: 'select',
    lsel: 'select', lsel2: 'select', sel2: '.flex-container', f1sel: '.flex1', numin: 'input', smax: '.editor_maximize', peer: 'input', h4: 'h4', h4dep: 'h4',
    instr: '#instruct_names_behavior', resp: '#bl-response-range', wics: '#world_info_character_strategy', rxp: '#regex_presets', mui: '#movingUIModeCheckBlock',
};
export function rowFeatures(el) {
    const found = new Set();
    for (const c of el.children) {
        if (ROW_CHILD_TAGS.has(c.localName)) found.add(c.localName);
        if (c.id && ROW_CHILD_IDS.has(c.id)) found.add('#' + c.id);
        const list = c.classList;
        if (!list || list.length === 0) continue;
        if (typeof list[Symbol.iterator] === 'function') { for (const name of list) if (ROW_CHILD_CLASSES.has(name)) found.add('.' + name); }
        else for (const name of ROW_CHILD_CLASSES) if (list.contains(name)) found.add('.' + name);
    }
    return found;
}
export function rowTokens(el) {
    const tokens = [];
    const found = rowFeatures(el);
    if (found.size) { const k = [...el.children]; for (const [name, test] of ROW_TOKENS) { const need = ROW_NEED[name]; if ((need === undefined || found.has(need)) && test(k, el)) tokens.push(name); } }   // 표에 없는 검사는 늘 돌려요
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
    if (!node.firstElementChild) { if (node.hasAttribute(ROW) && isRowHost(node) && !inMessage(node)) checkRow(node); return; }
    for (const el of node.getElementsByClassName('menu_button')) check(el);
    for (const el of node.getElementsByTagName('label')) checkLabel(el);
    for (const el of node.getElementsByClassName('mes')) checkMes(el);
    for (const el of node.getElementsByClassName('mes_reasoning_details')) checkReasoning(el);
    scanRows(node);
}
// 8.0.5: 서랍 줄 표식은 채팅 메시지(.mes) 안을 보지 않아요 — 표식을 쓰는 CSS 는 전부 설정 서랍 · 확장 창 쪽이라 메시지 안 요소엔 맞는 규칙이 없고,
//   메시지를 그릴 때마다 모든 자손에 35가지 검사를 돌던 것이 폰 메시지 5개 그리기 감시자를 76 → 1,070ms 로 늘렸어요(성능 판별 10-27).
//   .mes 가지는 통째로 건너뛰어요(그 안의 단추 · 체크 줄 · 메시지 표식은 위에서 따로 봐요).
function inMessage(el) { return !!el.closest('#chat, .mes'); }   // #chat 자체도 — 메시지가 붙을 때마다 #chat 의 모든 자식(메시지 수백 개)에 35가지 검사를 돌았어요
// 10-30 perf-icon: 예전에는 뿌리 아래 모든 요소를 TreeWalker 로 돌며 요소마다 자식을 훑었어요(부팅 때 body 전체 — 폰 4배 0.4초 남짓, 서랍 · 확장 창이 붙을 때마다 또).
//   표식이 바뀔 수 있는 요소는 넷뿐이에요 — ① 걸릴 자식(ROW_CHILD_* 표)이 있는 요소 = 그런 자식의 부모 ② select 를 품은 label(dsel) ③ .range-block(자손 아이디)
//   ④ 이미 표식이 있는 요소(지울지 봐야 함). 그 밖의 요소는 rowTokens 가 늘 '' 이고 표식도 없어 checkRow 가 아무것도 안 해요.
//   그래서 브라우저 선택자로 ①~④ 만 모아 같은 checkRow 를 돌려요 — 범위(뿌리 포함 · #chat · .mes 가지 빼기 · isRowHost)도 같아요(시험 tools/tests/icon-text-hosts.mjs).
const ROW_CHILD_SELECTOR = [...ROW_CHILD_TAGS, ...[...ROW_CHILD_IDS].map(id => '#' + id), ...[...ROW_CHILD_CLASSES].map(c => '.' + c)].join(',');
export function rowHosts(root) {
    const hosts = new Set();
    if (root.localName === 'label' || root.classList.contains('range-block') || root.hasAttribute(ROW) || (root.firstElementChild && rowCandidate(root))) hosts.add(root);
    for (const c of root.querySelectorAll(ROW_CHILD_SELECTOR)) {
        const p = c.parentElement; if (p) hosts.add(p);
        if (c.localName === 'select') for (let a = p; a; a = a === root ? null : a.parentElement) if (a.localName === 'label') hosts.add(a);
    }
    for (const el of root.getElementsByClassName('range-block')) hosts.add(el);
    for (const el of root.querySelectorAll('[' + ROW + ']')) hosts.add(el);
    return hosts;
}
function scanRows(root) {
    if (inMessage(root)) return;
    for (const el of rowHosts(root)) if (isRowHost(el) && !inMessage(el)) checkRow(el);
}

// 바뀐 요소들 — .menu_button 이면 단추 표식, label 이면 체크 줄 표식, input 이 바뀌었으면 그 부모 label
// 10-30 perf-icon: 메시지 · 줄 표식은 콜백 하나에서 요소마다 한 번만 다시 재요 — 예전에는 바뀐 요소마다 그 메시지의 checkMes(자손 전체를 훑는 edit_textarea 찾기)를
//   다시 불러, 메시지 하나 안에서 수십 곳이 바뀌면 같은 메시지를 수십 번 쟀어요. 재는 값은 DOM 만 보고 표식 쓰기와 서로 엮이지 않아 한 번 잰 결과와 같아요.
export function touchedAll(targets) {
    const mesSet = new Set(), detailsSet = new Set(), rows = new Set();
    for (const el of targets) {
        if (el.classList.contains('menu_button')) check(el);
        else if (el.localName === 'label') checkLabel(el);
        else if (el.localName === 'input' && el.parentElement?.localName === 'label') checkLabel(el.parentElement);
        // 메시지 안이 바뀌면(편집칸 넣고 빼기 · 타이머 · 토큰 글자) 그 메시지 표식을 다시
        const mes = el.closest('.mes'); if (mes) mesSet.add(mes);
        const details = el.closest('.mes_reasoning_details'); if (details) detailsSet.add(details);
        if (mes || inMessage(el)) continue;   // 채팅 · 메시지 안은 줄 표식을 보지 않아요(scanRows 와 같은 범위)
        // 자식 줄이 바뀐 .flex-container · .range-block 과, 클래스가 바뀐 자식의 부모
        if (isRowHost(el)) rows.add(el);
        const p = el.parentElement; if (p && isRowHost(p)) rows.add(p);
        const lab = el.closest('label'); if (lab && lab !== el) rows.add(lab);
        const rb = el.closest('.range-block'); if (rb && rb !== el && rb !== p) rows.add(rb);
    }
    for (const mes of mesSet) checkMes(mes);
    for (const details of detailsSet) checkReasoning(details);
    for (const el of rows) checkRow(el);
}

// 8.2.6 성능: 글자 칸(characterData) 변화가 바꿀 수 있는 표식은 .menu_button 바로 아래 맨 글자(bareText)뿐이에요 —
//   체크 줄 · 메시지 표식(편집칸 · 번호 · 타이머 · 토큰 칸의 비어 있음) · 서랍 줄 표식은 요소 · 속성만 보고, 글 노드의 글자가 바뀌어도 노드는 그대로라 :empty 판정도 같아요.
//   그래서 부모가 .menu_button 이 아닌 글자 변화(토큰 수 · 타이머 · 서랍 안 숫자 글자)는 콜백에서 버려요. 팝업 표식(refreshPopupMarks)도 글자 변화는 원래 건너뛰어요.
// 10-30 perf-icon: 속성을 같은 값으로 다시 쓴 기록(oldValue 가 지금 값과 같음)도 버려요 — 표식은 DOM 상태만 보니 바뀔 것이 없어요.
//   실리태번 refreshSwipeButtons 가 메시지가 붙을 때마다 메시지 전부에 없는 클래스를 classList.remove 해(기록만 남) 메시지마다 checkMes 가 돌았어요.
//   한 콜백에 같은 요소의 기록이 여럿이면 하나라도 값이 달라졌으면 남아요.
const sameAttr = r => r.type === 'attributes' && r.oldValue !== undefined && typeof r.target?.getAttribute === 'function' && r.oldValue === r.target.getAttribute(r.attributeName);
export function relevantRecords(records) {
    let keep = null;
    for (let i = 0; i < records.length; i++) {
        const r = records[i];
        const drop = (r.type === 'characterData' && !r.target.parentElement?.classList?.contains('menu_button')) || sameAttr(r);
        if (drop && !keep) keep = records.slice(0, i);
        else if (!drop && keep) keep.push(r);
    }
    return keep || records;
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
    // 10-30 perf-icon: 조상 오르기는 한 번 지나간 조상의 답을 적어 두고 다음 요소는 거기서 멈춰요(메시지 수백 개를 붙일 때 요소마다 문서 꼭대기까지 오르던 것)
    const addedMemo = new Map();
    const roots = [...added].filter(node => !underSet(node.parentElement, added, addedMemo));
    const rootSet = new Set(roots), memo = new Map();
    const remaining = [...targets].filter(node => !underSet(node, rootSet, memo));
    return { roots, targets: remaining };
}
// start 자신이나 조상이 set 에 있나 — 지나간 요소의 답은 memo 에(같은 set 끼리만 나눠 써요)
function underSet(start, set, memo) {
    const path = []; let hit = false;
    for (let p = start; p; p = p.parentElement) {
        const known = memo.get(p); if (known !== undefined) { hit = known; break; }
        if (set.has(p)) { hit = true; break; }
        path.push(p);
    }
    for (const p of path) memo.set(p, hit);
    return hit;
}

let started = false;
export function startIconTextMark() {
    if (started || !document.body) return;
    started = true;
    scan(document.body);
    refreshPopupMarks(null, document.body);
    // 붙은 요소 속 .menu_button · label · .mes 와, 자식(글자 · 아이콘 · 편집칸 · 타이머 글자)이 바뀐 요소, 클래스(menu_button_icon) · type 이 바뀐 요소만 본다.
    new MutationObserver((all) => {
        const records = relevantRecords(all);
        if (!records.length) return;
        const work = mutationWork(records);
        for (const node of work.roots) scan(node);
        touchedAll(work.targets);
        refreshPopupMarks(records);
    }).observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeOldValue: true, attributeFilter: ['class', 'type', 'id'] });
}
