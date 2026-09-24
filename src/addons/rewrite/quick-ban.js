// 1.9.0 — 채팅에서 낱말을 고르면(길게 눌러 선택 · 드래그) 그 옆에 작은 금지 칩이 뜬다. 누르면 그 말이 규칙이 된다.
// 설정 창을 열지 않고도 "이 말 그만"을 그 자리에서 — 규칙 이름 · 낱말은 고른 글 그대로, 설명은 core 가 프롬프트에 쓸 한 줄.
// 선택은 브라우저에 맡긴다(폰은 길게 누르면 낱말이 골라진다): 우리는 selectionchange 만 듣고, 칩은 선택 아래에 둔다(안드로이드 선택 메뉴는 위에 뜬다).
const MAX = 40;
let chip = null, timer = 0, current = '', onAdd = null, enabled = true, bound = false;

function selectedText() {
    const selection = document.getSelection();
    if (!selection || selection.isCollapsed || selection.rangeCount !== 1) return null;
    const range = selection.getRangeAt(0);
    const inside = node => (node?.nodeType === 1 ? node : node?.parentElement)?.closest?.('#chat .mes_text');
    if (!inside(range.startContainer) || !inside(range.endContainer)) return null;
    // 앞뒤 따옴표 · 괄호 · 문장부호는 낱말이 아니다 (폰이 길게 눌러 고른 낱말에는 따옴표가 딸려 온다)
    const EDGE = /^[\s"'“”‘’「」『』()\[\]{}<>,.!?…:;~*_-]+|[\s"'“”‘’「」『』()\[\]{}<>,.!?…:;~*_-]+$/g;
    const text = selection.toString().replace(/\s+/g, ' ').trim().replace(EDGE, '');
    if (!text || text.length > MAX || /\n/.test(selection.toString().trim())) return null;
    return { text, rect: range.getBoundingClientRect() };
}

function hide() {
    if (chip) chip.hidden = true;
    current = '';
}

function show({ text, rect }) {
    if (!chip) {
        chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'bwr_quickban';
        chip.innerHTML = '<i class="fa-solid fa-ban" aria-hidden="true"></i><span></span>';
        // pointerdown 에서 막아야 선택이 풀리기 전에 글을 잡는다 (click 은 선택이 이미 사라진 뒤 올 수 있다)
        chip.addEventListener('pointerdown', event => { event.preventDefault(); event.stopPropagation(); });
        chip.addEventListener('click', event => {
            event.preventDefault(); event.stopPropagation();
            if (!enabled || !current) return;
            const word = current;
            hide();
            document.getSelection()?.removeAllRanges();
            onAdd?.(word);
        });
        document.body.append(chip);
    }
    current = text;
    chip.querySelector('span').textContent = text.length > 18 ? text.slice(0, 17) + '…' : text;
    chip.hidden = false;
    // 선택 바로 아래, 화면 안에 — 폭은 그린 뒤에 재야 한다
    const top = Math.min(rect.bottom + 8, window.innerHeight - 48);
    chip.style.top = `${top}px`;
    chip.style.left = '0px';
    const width = chip.offsetWidth;
    chip.style.left = `${Math.max(8, Math.min(rect.left + rect.width / 2 - width / 2, window.innerWidth - width - 8))}px`;
}

function check() {
    if (!enabled) { hide(); return; }
    const found = selectedText();
    if (!found) { hide(); return; }
    // 편집 중인 글이나 입력칸 안의 선택은 아니다 (편집 칸은 .mes_text 가 아니라 textarea 라 위 검사에서 이미 빠진다)
    show(found);
}

/** 켠다. add(text) 는 규칙을 만들고 참/거짓(이미 있음)을 돌려준다. */
export function startQuickBan(add) {
    onAdd = add;
    if (bound) return;
    bound = true;
    document.addEventListener('selectionchange', () => { clearTimeout(timer); if (enabled) timer = setTimeout(check, 250); });
    // 스크롤하면 위치가 어긋나므로 숨긴다 (다시 고르면 다시 뜬다)
    document.getElementById('chat')?.addEventListener('scroll', hide, { passive: true });
    window.addEventListener('resize', hide);
}

export function setQuickBanEnabled(value) {
    enabled = value !== false;
    clearTimeout(timer);
    if (!enabled) hide();
}
