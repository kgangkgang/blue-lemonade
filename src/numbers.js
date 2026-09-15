// 표시만 쉼표로 묶는다. input의 type/value, min/max/step, 저장 이벤트는 바꾸지 않는다.
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
    function paint(el, text) {
        const rect = el.getBoundingClientRect();
        if (!rect.width || !rect.height || rect.bottom < 0 || rect.top > innerHeight) return;
        const cs = getComputedStyle(el);
        if (cs.visibility !== 'visible' || el.closest('[hidden]')) return;
        const left = parseFloat(cs.paddingLeft) || 0, right = parseFloat(cs.paddingRight) || 0;
        const align = cs.textAlign;
        const anchor = align === 'center' ? 'middle' : /right|end/.test(align) ? 'end' : 'start';
        const x = anchor === 'middle' ? (rect.width + left - right) / 2 : anchor === 'end' ? rect.width - right : left;
        const size = Math.min(parseFloat(cs.fontSize), Math.max(10, (rect.width - left - right) / (text.length * .57)));
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${rect.width}" height="${rect.height}" viewBox="0 0 ${rect.width} ${rect.height}"><text x="${x}" y="50%" dy=".35em" text-anchor="${anchor}" fill="${xml(cs.color)}" font-family="system-ui, sans-serif" font-weight="${xml(cs.fontWeight)}" font-size="${size}">${xml(text)}</text></svg>`;
        decorated.set(el, {image:el.style.getPropertyValue('background-image'), priority:el.style.getPropertyPriority('background-image')});
        el.style.setProperty('background-image', `url("data:image/svg+xml,${encodeURIComponent(svg)}")`, 'important');
        el.classList.add('bl-grouped-number');
    }
    function refresh() {
        pending = false;
        for (const el of decorated.keys()) clear(el);
        if (!document.body.classList.contains('salty') || document.hidden) return;
        for (const el of document.querySelectorAll(INPUTS)) {
            if (el === document.activeElement || !el.value || el.validity.badInput) continue;
            const formatted = groupedNumber(el.value);
            if (formatted !== el.value) paint(el, formatted);
        }
        // 토큰 셀의 경고 아이콘은 그대로 두고, 숫자 텍스트만 별도 표시 칸으로 만든다.
        for (const cell of document.querySelectorAll('.prompt_manager_prompt_tokens')) {
            for (const node of [...cell.childNodes]) {
                if (node.nodeType !== 3 || groupedNumber(node.textContent) === node.textContent.trim()) continue;
                const span = document.createElement('span'); span.className = 'bl-token-number';
                span.style.display = 'inline-block';
                span.style.minWidth = (groupedNumber(node.textContent).length * .62) + 'em';
                node.replaceWith(span); span.append(node);
            }
        }
        for (const el of document.querySelectorAll(TOKENS)) {
            if (el.children.length) continue;
            const raw = el.textContent.trim(), formatted = groupedNumber(raw);
            if (formatted !== raw) paint(el, formatted);
        }
    }
    function schedule() {
        if (!pending) { pending = true; requestAnimationFrame(refresh); }
    }
    // 숫자 칸은 서랍 · 팝업 안에만 있다. 채팅 본문 · 입력줄 안의 변화(답변이 한 글자씩 자라는 것)는 숫자 칸과 무관하므로
    // 거기서 온 변화는 아예 받지 않는다 — 폰에서 답변마다 문서 전체 강제 레이아웃이 돌던 것 (2.5.2)
    const CHAT = '#chat, #send_form, #form_sheld';
    const inChat = (node) => (node?.nodeType === 1 ? node : node?.parentElement)?.closest?.(CHAT);
    const onMutations = (list) => { if (!list.every(m => inChat(m.target))) schedule(); };
    const onScroll = (e) => { if (!inChat(e.target)) schedule(); };
    document.addEventListener('focusin', e => { clear(e.target); schedule(); });
    for (const name of ['input', 'change', 'focusout', 'click']) document.addEventListener(name, (e) => { if (!inChat(e.target)) schedule(); });
    window.addEventListener('resize', schedule);
    document.addEventListener('scroll', onScroll, {capture:true, passive:true});
    // 새 설정칸과 스크립트가 직접 갱신한 표시에도 대응한다.
    new MutationObserver(onMutations).observe(document.body, {childList:true, subtree:true, characterData:true});
    new MutationObserver(onMutations).observe(document.body, {attributes:true, attributeFilter:['class','style']});
    // value 속성만 바뀌면 MutationObserver에 전달되지 않는다. 서랍 · 팝업이 하나도 안 열려 있으면 볼 숫자 칸도 없다
    setInterval(() => { if (!document.hidden && document.querySelector('.openDrawer, dialog.popup[open]')) schedule(); }, 1500);
    schedule();
}
