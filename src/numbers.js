// 표시만 쉼표로 묶는다. input의 type/value, min/max/step, 저장 이벤트는 바꾸지 않는다.
import { uiOpenKnown, quickOpen } from './lite.js';
export function groupedNumber(value) {
    const raw = String(value).trim();
    if (!/^[+-]?\d+(?:\.\d+)?$/.test(raw)) return raw;
    const [whole, fraction] = raw.split('.');
    if (whole.replace(/^[+-]/, '').length < 4) return raw;
    return whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (fraction === undefined ? '' : `.${fraction}`);
}
const xml = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const INPUTS = 'input[type="number"]';
// 실리태번의 표시 전용 토큰 셀. 원문 textContent는 계산/접근성을 위해 보존한다.
const TOKENS = '.prompt_manager_prompt_tokens, [data-token-counter], .bl-token-number';
export function startNumberDisplay() {
    const decorated = new Map();
    let pending = false;
    function clear(el) {
        const old = decorated.get(el);
        if (!old) return;
        el.classList.remove('bl-grouped-number');
        if (old.image) el.style.setProperty('background-image', old.image, old.priority);
        else el.style.removeProperty('background-image');
        decorated.delete(el);
    }
    // 그릴 그림(SVG 주소)만 계산한다 — 여기서는 읽기만 (못 그리는 상태면 '')
    function measure(el, text) {
        const rect = el.getBoundingClientRect();
        if (!rect.width || !rect.height) return '';
        const cs = getComputedStyle(el);
        if (cs.visibility !== 'visible' || el.closest('[hidden]')) return '';
        const left = parseFloat(cs.paddingLeft) || 0, right = parseFloat(cs.paddingRight) || 0;
        const align = cs.textAlign;
        const anchor = align === 'center' ? 'middle' : /right|end/.test(align) ? 'end' : 'start';
        const x = anchor === 'middle' ? (rect.width + left - right) / 2 : anchor === 'end' ? rect.width - right : left;
        const size = Math.min(parseFloat(cs.fontSize), Math.max(10, (rect.width - left - right) / (text.length * .57)));
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${rect.width}" height="${rect.height}" viewBox="0 0 ${rect.width} ${rect.height}"><text x="${x}" y="50%" dy=".35em" text-anchor="${anchor}" fill="${xml(cs.color)}" font-family="system-ui, sans-serif" font-weight="${xml(cs.fontWeight)}" font-size="${size}">${xml(text)}</text></svg>`;
        return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
    }
    function paint(el, url) {
        const old = decorated.get(el);
        // 같은 그림이 그대로 붙어 있으면 손대지 않음 (스타일을 건드리면 다시 계산이 돈다) — 다른 코드가 style 을 갈아엎었으면 다시 칠함
        if (old?.url === url && el.classList.contains('bl-grouped-number') && el.style.getPropertyValue('background-image') === old.css) return;
        const saved = old || {image:el.style.getPropertyValue('background-image'), priority:el.style.getPropertyPriority('background-image')};
        el.style.setProperty('background-image', url, 'important');
        el.classList.add('bl-grouped-number');
        decorated.set(el, {image: saved.image, priority: saved.priority, url, css: el.style.getPropertyValue('background-image')});
    }
    // 2.9.2: 예전에는 부를 때마다 표시를 전부 지우고 칸마다 [잰다 → 칠한다] 를 번갈아 했다. 칠할 때마다 스타일이 바뀌어
    // 다음 칸을 잴 때 문서 전체의 강제 재계산이 돌았고(서랍이 열려 있으면 한 번에 수십 ms), 이 함수는 서랍 스크롤 한 프레임마다 ·
    // 서랍이 열려 있는 동안 1.5초마다 불린다 — 측정: 프리셋 서랍을 150프레임 굴리는 데 13초, 그중 11초가 여기, 가만히 둬도 6초에 0.6초.
    // 이제 먼저 전부 재고(읽기만), 바뀐 칸만 칠하거나 지운다(쓰기만). 바뀐 게 없으면 아무것도 쓰지 않는다.
    function refresh() {
        pending = false;
        // 3.6.1: 서랍 · 팝업이 하나도 안 열려 있으면 숫자 칸이 다 가려져 있다 — 재지도 지우지도 않고 둔다 (열 때 클릭 · 1.5초 확인으로 다시 맞춤).
        // 답변 중 서랍 밖 변화(프롬프트 목록 다시 그리기 등)마다 숨은 숫자 칸 전부를 다시 재던 것 (폰 리그 답변 한 번 0.1초)
        if (document.body.classList.contains('salty') && !anyOpen()) return;
        const want = new Map();
        if (document.body.classList.contains('salty') && !document.hidden) {
            // 토큰 셀의 경고 아이콘은 그대로 두고, 숫자 텍스트만 별도 표시 칸으로 만든다. (DOM 쓰기라 재기 전에)
            for (const cell of document.querySelectorAll('.prompt_manager_prompt_tokens')) {
                for (const node of [...cell.childNodes]) {
                    if (node.nodeType !== 3 || groupedNumber(node.textContent) === node.textContent.trim()) continue;
                    const span = document.createElement('span'); span.className = 'bl-token-number';
                    span.style.display = 'inline-block';
                    span.style.minWidth = (groupedNumber(node.textContent).length * .62) + 'em';
                    node.replaceWith(span); span.append(node);
                }
            }
            for (const el of document.querySelectorAll(INPUTS)) {
                if (el === document.activeElement || !el.value || el.validity.badInput) continue;
                const formatted = groupedNumber(el.value);
                if (formatted === el.value) continue;
                const url = measure(el, formatted);
                if (url) want.set(el, url);
            }
            for (const el of document.querySelectorAll(TOKENS)) {
                if (el.children.length) continue;
                const raw = el.textContent.trim(), formatted = groupedNumber(raw);
                if (formatted === raw) continue;
                const url = measure(el, formatted);
                if (url) want.set(el, url);
            }
        }
        for (const el of [...decorated.keys()]) if (!want.has(el)) clear(el);
        for (const [el, url] of want) paint(el, url);
    }
    function schedule() {
        if (!pending) { pending = true; requestAnimationFrame(refresh); }
    }
    // 숫자 칸은 서랍 · 팝업 안에만 있다. 채팅 본문 · 입력줄 안의 변화(답변이 한 글자씩 자라는 것)는 숫자 칸과 무관하므로
    // 거기서 온 변화는 아예 받지 않는다 — 폰에서 답변마다 문서 전체 강제 레이아웃이 돌던 것 (2.5.2)
    const CHAT = '#chat, #send_form, #form_sheld';
    // 2.9.4: 문서에서 이미 떨어져 나간 노드의 변화도 관찰자에게 온다 (스트리밍 중 페이드 인 조각 · 그림 태그 자리를 갈아 끼울 때).
    // 그런 노드는 closest 로 #chat 을 못 찾아 '채팅 밖 변화'로 쳐져서, 답변 뒷부분 내내 0.8초마다 숫자 칸 전체를 다시 쟀다
    // (강제 레이아웃 포함, 4배 느린 CPU 에서 한 번에 25ms). 떨어져 나간 노드는 숫자 칸 표시와 상관없으니 채팅 쪽과 같이 넘긴다.
    const inChat = (node) => !node?.isConnected || (node?.nodeType === 1 ? node : node?.parentElement)?.closest?.(CHAT);
    const onMutations = (list) => { if (!list.every(m => inChat(m.target))) schedule(); };
    // 3.6.1: 서랍 · 팝업이 열려 있나 — lite.js 가 게으른 칸을 켜고 끄려고 이미 지켜보는 값을 쓴다 (못 쓰면 예전처럼 문서에서 찾기).
    // 예전엔 1.5초마다 문서 전체를 querySelector 로 훑었는데, 아무것도 안 열려 있으면 끝까지 훑어 폰 리그 답변 한 번에 0.1초였다
    // 4.1.2: 실리태번의 로딩 화면은 투명한 팝업(dialog.transparent_dialogue_popup)이라 '열린 팝업'으로 쳐졌다 — 시작하는 동안 프레임마다
    // 숨은 숫자 칸 168개를 전부 다시 쟀다 (폰 리그 시작 한 번에 0.78초, 강제 레이아웃 포함). 그림 크게 보기도 같은 투명 팝업이고 숫자 칸이 없다.
    const LOADER = 'transparent_dialogue_popup';
    const anyOpen = () => {
        const known = uiOpenKnown();
        if (known === false) return false;
        // 로딩 화면이 덮고 있는 동안은 보이는 숫자 칸이 없다 — 걷히면 그 변화로 다시 불린다
        for (const el of document.body.children) if (el.tagName === 'DIALOG' && el.open && el.classList.contains(LOADER)) return false;
        if (quickOpen(LOADER)) return true;
        // 옛 팝업(dialog 가 아닌 것)은 lite.js 만 안다
        return known === true || !!document.querySelector(`.openDrawer, dialog.popup[open]:not(.${LOADER})`);
    };
    // 굴리는 동안 프레임마다 다시 잴 필요는 없다 (이제 화면 밖 칸도 같이 재 둔다) — 멈춘 뒤 한 번 (2.9.2)
    let scrollTimer = 0;
    const onScroll = (e) => { if (!inChat(e.target)) { clearTimeout(scrollTimer); scrollTimer = setTimeout(schedule, 150); } };
    document.addEventListener('focusin', e => { clear(e.target); schedule(); });
    for (const name of ['input', 'change', 'focusout', 'click']) document.addEventListener(name, (e) => { if (!inChat(e.target)) schedule(); });
    window.addEventListener('resize', schedule);
    document.addEventListener('scroll', onScroll, {capture:true, passive:true});
    // 새 설정칸과 스크립트가 직접 갱신한 표시에도 대응한다.
    new MutationObserver(onMutations).observe(document.body, {childList:true, subtree:true, characterData:true});
    new MutationObserver(onMutations).observe(document.body, {attributes:true, attributeFilter:['class','style']});
    // value 속성만 바뀌면 MutationObserver에 전달되지 않는다. 서랍 · 팝업이 하나도 안 열려 있으면 볼 숫자 칸도 없다
    setInterval(() => { if (!document.hidden && anyOpen()) schedule(); }, 1500);
    schedule();
}
