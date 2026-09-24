// 4.7.1 남은 영어 찾기: 실리태번 서랍 · 안쪽 접이식 패널을 잠깐 열어 화면에 남은 라틴 글자 UI 를 모은다.
// 결과를 붙여 보내면 한글화 사전에 넣을 수 있다 — 사용자가 어디서 영어를 봤는지 일일이 알려 주지 않아도 되게.
// 채팅 본문 · 캐릭터 · 페르소나 · 배경 목록 · 프롬프트 목록 · 태그 · 입력칸(사용자 글)은 보지 않는다.
const SKIP = '#pt-panel, .pt-help-dialog, #chat, .cg-root, #rm_print_characters_block, #user_avatar_block, #bg_menu_content, #completion_prompt_manager, .tag, #qr--bar, .llmt-gl-list, script, style, noscript, textarea, input, code, pre, #character_popup_text, .mes_text, #salty-drawer, .salty-panel, .bl-scripts, #version_display';
const TOP = ['#leftNavDrawerIcon', '#ai-config-button', '#advanced-formatting-button', '#WI-SP-button', '#user-settings-button', '#backgrounds-button', '#extensions-settings-button', '#persona-management-button', '#rightNavDrawerIcon'];
const sleep = ms => new Promise(r => setTimeout(r, ms));
const vis = el => { if (!el || !el.getClientRects().length) return false; const cs = getComputedStyle(el); return cs.visibility !== 'hidden' && cs.opacity !== '0'; };
const latin = s => /[A-Za-z]{2,}/.test(s) && !/[ㄱ-힝]/.test(s);
// 모델 · 파일 이름 · 주소 같은 것은 번역 대상이 아니다
const NOISE = /^(?:[\w.\-/:]+|https?:\S+|e\.g\.?.*|\d[\d.,:% x×]*)$|\.(?:png|jpg|webp|json|js|css)\b|^v?\d+\.\d/i;

function collect(seen) {
    const path = el => { const parts = []; for (let e = el, n = 0; e && e !== document.body && n < 3; e = e.parentElement, n++) parts.unshift(e.id ? '#' + e.id : e.tagName.toLowerCase()); return parts.join('>'); };
    const add = (text, kind, el) => {
        const t = String(text || '').replace(/\s+/g, ' ').trim();
        if (t.length < 2 || t.length > 300 || !latin(t) || NOISE.test(t)) return;
        const key = kind + '\t' + t;
        if (!seen.has(key)) seen.set(key, { text: t, kind, where: path(el) });
    };
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let node; (node = walker.nextNode());) { const el = node.parentElement; if (!el || el.closest(SKIP) || !vis(el)) continue; add(node.nodeValue, '글', el); }
    for (const el of document.body.querySelectorAll('[placeholder], [title], [aria-label], select')) {
        if (el.closest(SKIP)) continue;
        if (el.tagName === 'SELECT') { if (vis(el)) for (const o of el.options) if (o.hasAttribute('data-i18n')) add(o.textContent, '옵션', el); continue; }
        if (!vis(el)) continue;
        if (el.placeholder) add(el.placeholder, '안내', el);
        if (el.title) add(el.title, '툴팁', el);
        const label = el.getAttribute('aria-label'); if (label) add(label, '이름', el);
    }
}

const click = el => { el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'mouse' })); el.click(); };

/** 서랍을 차례로 열어 모으고, 연 것은 도로 닫는다. 돌아오는 값: { count, text } */
export async function scanEnglish(onProgress = () => {}) {
    const seen = new Map();
    collect(seen);
    for (const id of TOP) {
        const toggle = document.querySelector(`${id} .drawer-toggle`) || document.querySelector(id);
        if (!toggle) continue;
        onProgress(id);
        click(toggle); await sleep(450);
        // 안쪽 접이식 패널: 닫혀 있던 것만 열고 기억해 둔다
        const opened = [];
        for (const t of document.querySelectorAll('.drawer-content .inline-drawer-toggle, .drawer-content .inline-drawer-header')) {
            const content = t.closest('.inline-drawer')?.querySelector(':scope > .inline-drawer-content');
            if (content && vis(t) && getComputedStyle(content).display === 'none') { t.click(); opened.push(t); }
        }
        if (opened.length) await sleep(450);
        collect(seen);
        for (const t of opened.reverse()) t.click();
        click(toggle); await sleep(250);
    }
    // 메시지 ··· 메뉴 · 옵션 메뉴 · 요술봉 메뉴
    for (const [open, close] of [['#chat .mes:last-child .extraMesButtonsHint', '#chat .mes:last-child .extraMesButtonsHint'], ['#options_button', '#options_button'], ['#extensionsMenuButton', '#extensionsMenuButton']]) {
        const a = document.querySelector(open); if (!a) continue;
        click(a); await sleep(350); collect(seen);
        const b = document.querySelector(close); if (b) click(b); await sleep(150);
    }
    const items = [...seen.values()].sort((a, b) => a.kind.localeCompare(b.kind) || a.text.localeCompare(b.text));
    const text = items.length ? items.map(i => `${i.kind} | ${i.text} | ${i.where}`).join('\n') : '남은 영어를 못 찾았어요.';
    return { count: items.length, text: `남은 영어 ${items.length}개 · ${new Date().toISOString().slice(0, 16).replace('T', ' ')}\n${text}` };
}
