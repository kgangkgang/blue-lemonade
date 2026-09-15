import { groupedNumber } from './numbers.js';
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
    span.append(role, name, tok);
}

function sweep(root) {
    root?.querySelectorAll?.(ROW).forEach(rewrite);
    if (root?.matches?.(ROW)) rewrite(root);
}

let watcher = null;
export function startPromptList() {
    if (watcher) return;
    // 목록은 팝업이 열릴 때 만들어지고 그 안에서 다시 그려진다 → 문서 전체를 얕게 지켜본다.
    // 줄이 한 번 바뀌면 data-bl-row 로 표시해 두므로 같은 줄을 두 번 건드리지 않는다
    watcher = new MutationObserver((list) => {
        for (const m of list) {
            // 프롬프트 목록은 채팅 본문 안에 없다 — 답변이 자라며 오는 변화는 건너뜀 (2.5.2)
            const target = m.target.nodeType === 1 ? m.target : m.target.parentElement;
            if (target?.closest?.('#chat, #send_form')) continue;
            m.addedNodes.forEach((n) => {
                if (n.nodeType !== 1) return;
                if (n.matches?.('.completion_prompt_manager_prompt') || n.querySelector?.('.completion_prompt_manager_prompt')) sweep(n);
                else if (n.matches?.(ROW)) rewrite(n);
            });
            if (m.type === 'characterData' && m.target.parentElement?.matches?.(ROW)) rewrite(m.target.parentElement);
        }
    });
    watcher.observe(document.body, { childList: true, subtree: true, characterData: true });
    sweep(document.body);
}
