import { groupedNumber } from './numbers.js';
import { alignHistory, chatCandidates, labelOf } from './prompt-history-label.js';
// 검사 창 "프롬프트 목록" 줄 다시 짜기
//
// 실리태번은 이름 · 역할 · 토큰을 스팬 하나에 문장으로 넣는다 (PromptManager.js:1441):
//     <span>Name: chatHistory-2, Role: assistant, Tokens: 679</span>
// 한 덩어리 글이라 CSS 로는 순서도 못 바꾸고, 줄이면 맨 뒤의 토큰 수부터 사라진다.
// (실제로 그렇게 만들었다가 정작 봐야 하는 숫자가 잘렸다.)
// 그래서 여기서 문장을 세 조각으로 쪼갠다 — 그러면 CSS 가 숫자를 오른쪽에 정렬하고
// 잘려도 되는 이름만 말줄임할 수 있다.
//
// 한글화 스크립트가 이미 "679 토큰 · assistant · chatHistory-2" 로 바꿔 놓은 경우도 받는다.
// 둘 중 어느 쪽이 먼저 돌아도 결과가 같아야 하므로 두 모양을 다 알아본다.

const ROW = '.completion_prompt_manager_prompt > .inline-drawer-header > span';
const EN = /^Name:\s*(.+?),\s*Role:\s*(\S+?),\s*Tokens:\s*(\d+)\s*$/;
const KO = /^(\d+)\s*토큰\s*·\s*(\S+?)\s*·\s*(.+?)\s*$/;

function parse(text) {
    const t = text.replace(/\s+/g, ' ').trim();
    let m = EN.exec(t);
    if (m) return { name: m[1], role: m[2], tokens: m[3] };
    m = KO.exec(t);
    if (m) return { tokens: m[1], role: m[2], name: m[3] };
    return null;
}

// 역할 이름은 짧게 (칩 하나 폭이라도 아낀다)
const ROLE = { system: '시스템', user: '나', assistant: '답변', tool: '도구' };

function rewrite(span) {
    if (span.dataset.blRow) return;
    const parts = parse(span.textContent || '');
    if (!parts) return;
    span.dataset.blRow = '1';
    span.textContent = '';
    span.classList.add('bl-prow');
    const tok = document.createElement('b');
    tok.className = 'bl-prow-tok';
    tok.textContent = groupedNumber(parts.tokens);
    // 숫자만 노랗게 있으면 그게 뭔지 모른다 (사용자 지적) → 뒤에 작은 t 를 붙여 토큰임을 밝힌다
    const unit = document.createElement('small');
    unit.className = 'bl-prow-t';
    unit.textContent = 't';
    tok.append(unit);
    const role = document.createElement('span');
    role.className = 'bl-prow-role';
    role.dataset.role = parts.role;
    role.textContent = ROLE[parts.role] || parts.role;
    const name = document.createElement('span');
    name.className = 'bl-prow-name';
    // 내부 식별자는 짧게 읽되 원래 이름은 title 에 보존한다.
    const history = /^chatHistory-(\d+)$/.exec(parts.name);
    name.textContent = history ? `대화 ${history[1]}` : parts.name;
    name.title = parts.name;               // 잘렸을 때 전체를 볼 수 있게
    if (history) name.dataset.blHist = history[1];   // 7.0.3 아래 labelHistory 가 원래 채팅 번호 · 「끼운 글」로 바꾼다 (모르면 「대화 N」 그대로)
    span.append(role, name, tok);
}

function sweep(root) {
    root?.querySelectorAll?.(ROW).forEach(rewrite);
    if (root?.matches?.(ROW)) rewrite(root);
    void labelHistory(root);
}

// 7.0.3 「채팅 기록」 줄 이름 = 원래 채팅 번호 (src/prompt-history-label.js). 보낸 글은 프롬프트용 정규식을 거쳤을 수 있어
// 실리태번 정규식 엔진을 그때만 불러 같은 처리를 한 글도 후보로 쓴다 (못 부르면 원문 · 매크로만으로 맞춤)
let engine = null, labeling = null;
function regexEngine() {
    engine ??= import(new URL('../../../../extensions/regex/engine.js', import.meta.url).href).catch(() => null);
    return engine;
}
async function labelHistory(list) {
    const rows = [...(list?.querySelectorAll?.('.bl-prow-name[data-bl-hist]') || [])];
    if (!rows.length || rows.every(row => row.dataset.blHistDone)) return;
    const token = labeling = {};
    const items = rows.map(name => ({
        role: name.parentElement?.querySelector('.bl-prow-role')?.dataset.role || '',
        content: name.closest('.completion_prompt_manager_prompt')?.querySelector('.inline-drawer-content')?.textContent ?? '',
    }));
    const regex = await regexEngine();
    if (token !== labeling) return;
    let labels = [];
    try {
        const ctx = globalThis.SillyTavern?.getContext?.();
        const place = regex?.regex_placement;
        const chat = chatCandidates(ctx?.chat, {
            regexed: regex?.getRegexedString && place ? (text, message, depth) => regex.getRegexedString(text, message.is_user ? place.USER_INPUT : place.AI_OUTPUT, { isPrompt: true, depth }) : null,
            substitute: typeof ctx?.substituteParams === 'function' ? text => ctx.substituteParams(text) : null,
            tail: rows.length,
        });
        labels = alignHistory(items, chat);
    } catch (error) { console.warn('[Blue Lemonade] 채팅 기록 번호', error); }
    rows.forEach((name, i) => {
        name.dataset.blHistDone = '1';
        const text = labelOf(labels[i]);
        if (text && name.isConnected) name.textContent = text;
    });
}

let watcher = null;
export function startPromptList() {
    if (watcher) return;
    const id = 'completion_prompt_manager_popup_entry_form_inspect_list';
    let scope = null, discovery = null;
    watcher = new MutationObserver(() => { sweep(scope); watcher.takeRecords(); });
    const attach = () => {
        const list = document.getElementById(id);
        if (!list || list === scope) return;
        watcher.disconnect(); scope = list;
        watcher.observe(list, {childList:true, subtree:true, characterData:true});
        sweep(list); watcher.takeRecords();
        discovery?.disconnect(); discovery = null;
    };
    attach();
    if (!scope) {
        discovery = new MutationObserver(attach);
        discovery.observe(document.getElementById('completion_prompt_manager') || document.body, {childList:true, subtree:true});
    }
}
