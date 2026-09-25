// 5.2.2: 줄을 넘는 대사 색칠. 실리태번은 따옴표 대사를 `(".*?")|(“.*?”)` 처럼 한 줄 안에서만 <q> 로 감싼다(script.js messageFormatting,
// `.` 이 줄바꿈을 안 넘음). 그래서 “ 로 열고 한두 줄 아래에서 ” 로 닫는 대사는 서술 색 그대로였다 (커뮤니티 제보: 큰따옴표 색이 가끔 안 먹음).
// 여기서는 그려진 뒤의 글 노드를 훑어, 같은 노드 안에서 닫히지 않은 여는 따옴표를 찾고 뒤 노드에서 닫는 따옴표를 찾으면
// 그 사이 글 조각마다 <q class="bl-q-span"> 을 씌운다 (조각마다 하나 — 줄바꿈 · 문단 구조는 그대로). 저장된 본문은 건드리지 않는다.
const PAIRS = { '“': '”', '"': '"', '「': '」', '『': '』', '«': '»', '＂': '＂' };
const OPENERS = Object.keys(PAIRS);
const SKIP = 'q, pre, code, script, style, textarea, .bl-quote-lead, details[class*="custom-dem-card"], .custom-dem-track';
const created = new Set();
const MAX_SPAN_NODES = 40; // 이만큼 뒤까지만 닫는 따옴표를 찾는다 (메시지 전체를 대사로 잘못 칠하지 않게)
const MAX_STRAIGHT_NODES = 6; // 곧은따옴표는 여닫음이 같은 글자라 짝 잃은 것 하나가 멀리까지 칠할 수 있어 짧게만

function textNodes(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
        acceptNode: node => (!node.data.trim() || node.parentElement?.closest(SKIP)) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT, // 공백만 있는 노드(문단 사이 \n)는 감싸면 '채우기' 스타일에서 빈 줄이 생긴다
    });
    const out = [];
    for (let node = walker.nextNode(); node; node = walker.nextNode()) out.push(node);
    return out;
}

/** 노드 안에서 닫히지 않은 마지막 여는 따옴표 위치 (없으면 -1) */
function unclosedOpener(text) {
    let open = null, at = -1;
    for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (open) { if (c === PAIRS[open] && (open !== '"' || closesStraight(text, i))) { open = null; at = -1; } continue; }
        if (OPENERS.includes(c) && (c !== '"' || opensStraight(text, i))) { open = c; at = i; }
    }
    return open ? { open, at } : null;
}
// 곧은따옴표는 여닫음이 같은 글자라 자리로 가른다: 앞이 처음 · 공백 · 여는 괄호면 여는 것, 뒤가 끝 · 공백 · 문장부호면 닫는 것
const opensStraight = (text, i) => i === 0 || /[\s([{【〈《「『—-]/.test(text[i - 1]);
const closesStraight = (text, i) => i === text.length - 1 || /[\s)\]}】〉》」』.,!?;:…—-]/.test(text[i + 1]);

function wrap(node) {
    const q = document.createElement('q');
    q.className = 'bl-q-span';
    node.replaceWith(q);
    q.append(node);
    created.add(q);
    return q;
}

export function wrapSpanningQuotes(root) {
    if (!root?.querySelectorAll) return;
    for (const box of root.matches?.('.mes_text, .salty-sample') ? [root] : root.querySelectorAll('.mes_text, .salty-sample')) {
        let guard = 0;
        // 한 번 감싸면 노드 목록이 바뀌므로 다시 훑는다 (감싼 조각은 q 안이라 다음 훑기에서 빠진다)
        while (guard++ < 30) {
            const nodes = textNodes(box);
            let done = false;
            for (let i = 0; i < nodes.length && !done; i++) {
                const found = unclosedOpener(nodes[i].data);
                if (!found) continue;
                const closer = PAIRS[found.open];
                const reach = closer === '"' ? MAX_STRAIGHT_NODES : MAX_SPAN_NODES;
                for (let j = i + 1; j < nodes.length && j <= i + reach; j++) {
                    // 같은 메시지 안에서만 (북마크 미리보기 등 다른 상자로 넘어가지 않게)
                    const text = nodes[j].data;
                    let end = -1;
                    for (let k = 0; k < text.length; k++) {
                        const c = text[k];
                        if (c === closer && (closer !== '"' || closesStraight(text, k))) { end = k; break; }
                        if (c === found.open && (closer !== '"' || opensStraight(text, k))) { end = -2; break; } // 닫기 전에 같은 따옴표가 또 열림 — 짝이 안 맞는 글, 건너뜀
                    }
                    if (end === -2) break;
                    if (end < 0) continue;
                    // 찾았다: i 의 꼬리, i+1..j-1 통째, j 의 머리
                    const tail = nodes[i].splitText(found.at);
                    wrap(tail);
                    for (let m = i + 1; m < j; m++) wrap(nodes[m]);
                    nodes[j].splitText(end + 1);
                    wrap(nodes[j]);
                    done = true;
                    break;
                }
            }
            if (!done) break;
        }
    }
    for (const q of created) if (!q.isConnected) created.delete(q);
}

export function resetSpanningQuotes() {
    for (const q of created) if (q.isConnected) q.replaceWith(...q.childNodes);
    created.clear();
}
