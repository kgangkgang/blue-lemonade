import { showThemeModal } from './modal.js';

const PAGE = 48;
const fold = text => String(text || '').normalize('NFKC').toLocaleLowerCase();
export function cardChoices(context) {
    return (Array.isArray(context?.characters) ? context.characters : [])
        .filter(c => c && typeof c.name === 'string' && c.name.trim() && typeof c.avatar === 'string' && c.avatar)
        .map(c => ({ name: c.name.trim(), avatar: c.avatar }))
        .sort((a, b) => a.name.localeCompare(b.name, 'ko') || a.avatar.localeCompare(b.avatar));
}
export function filterCards(cards, query) {
    const words = fold(query).trim().split(/\s+/).filter(Boolean);
    return cards.filter(c => words.every(word => fold(c.name).includes(word)));
}

/** Names retain the existing matching contract; selecting a card never opens its chat.
 *  6.7.5 selected(아바타 파일 목록)를 주면 여러 장 고르기 — 누를 때마다 넣고 빼고, 닫을 때 onPick(아바타 목록)으로 돌려준다 (고른 카드가 위로). */
export function openPromptCardPicker({ current = '', selected = null, context = globalThis.SillyTavern?.getContext?.(), onPick, opener } = {}) {
    const doc = opener?.ownerDocument || document;
    const previous = doc.querySelector('.bl-prompt-card-picker');
    if (previous?.open) { previous.querySelector('input')?.focus(); return previous; }
    const multi = Array.isArray(selected), chosen = new Set(multi ? selected : []);
    const cards = cardChoices(context), duplicates = new Map();
    if (multi) cards.sort((a, b) => chosen.has(b.avatar) - chosen.has(a.avatar));
    for (const card of cards) duplicates.set(card.name, (duplicates.get(card.name) || 0) + 1);
    const dialog = doc.createElement('dialog');
    dialog.className = 'bl-tool-dialog bl-prompt-card-picker';
    dialog.setAttribute('aria-label', '연동할 캐릭터 카드 선택');
    dialog.innerHTML = `<header><h3>캐릭터 선택</h3><button type="button" data-card-close aria-label="닫기"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button></header><input type="search" data-card-search placeholder="캐릭터 검색" aria-label="캐릭터 검색" autocomplete="off"><div class="bl-prompt-card-list" aria-label="캐릭터 카드 목록"></div><footer><small role="status" aria-live="polite"></small><span class="bl-prompt-card-actions"><button type="button" data-card-clear>선택 해제</button>${multi ? '<button type="button" data-card-done>완료</button>' : ''}</span></footer>`;
    const search = dialog.querySelector('input'), list = dialog.querySelector('.bl-prompt-card-list'), status = dialog.querySelector('[role="status"]');
    let shown = PAGE;
    const isOn = card => (multi ? chosen.has(card.avatar) : card.name === current);
    const pick = card => {
        if (multi) {
            if (!card) chosen.clear(); else if (chosen.has(card.avatar)) chosen.delete(card.avatar); else chosen.add(card.avatar);
            const at = [...list.querySelectorAll('.bl-prompt-card-choice')].indexOf(doc.activeElement);
            render(); if (at >= 0) list.querySelectorAll('.bl-prompt-card-choice')[at]?.focus({ preventScroll: true });
            return;
        }
        dialog.close();
        onPick?.(card ? Array.from(card.name).slice(0, 80).join('') : '');
    };
    function render() {
        const hits = filterCards(cards, search.value);
        const fragment = doc.createDocumentFragment();
        for (const card of hits.slice(0, shown)) {
            const row = doc.createElement('button');
            row.type = 'button'; row.className = 'bl-prompt-card-choice';
            row.setAttribute('aria-pressed', String(isOn(card)));
            const image = doc.createElement('img');
            image.src = `/thumbnail?type=avatar&file=${encodeURIComponent(card.avatar)}`;
            image.alt = ''; image.width = image.height = 40; image.loading = 'lazy';
            image.addEventListener('error', () => { image.hidden = true; }, { once: true });
            const copy = doc.createElement('span'), name = doc.createElement('b');
            name.textContent = card.name; copy.append(name);
            if (duplicates.get(card.name) > 1) {
                const detail = doc.createElement('small'); detail.textContent = card.avatar; copy.append(detail);
            }
            const check = doc.createElement('i');check.className = 'fa-solid fa-check';check.setAttribute('aria-hidden', 'true');
            check.hidden = !isOn(card);
            row.append(image, copy, check); row.addEventListener('click', () => pick(card)); fragment.append(row);
        }
        if (!hits.length) { const empty = doc.createElement('p'); empty.textContent = cards.length ? '검색 결과가 없어요.' : '선택할 캐릭터 카드가 없어요.'; fragment.append(empty); }
        if (hits.length > shown) { const more = doc.createElement('button'); more.type = 'button'; more.className = 'bl-prompt-card-more'; more.textContent = '더 보기'; more.addEventListener('click', () => { const at=shown;shown+=PAGE;render();list.querySelectorAll('.bl-prompt-card-choice')[at]?.focus({preventScroll:true}); }); fragment.append(more); }
        list.replaceChildren(fragment);
        status.textContent = multi ? `${hits.length}개 · ${chosen.size}장 골랐어요` : `${hits.length}개`;
    }
    search.addEventListener('input', () => { shown = PAGE; list.scrollTop = 0; render(); });
    search.addEventListener('keydown', e => { if(e.key === 'ArrowDown'){e.preventDefault();list.querySelector('button')?.focus();} });
    dialog.querySelector('[data-card-close]').addEventListener('click', () => dialog.close());
    dialog.querySelector('[data-card-clear]').addEventListener('click', () => pick(null));
    dialog.querySelector('[data-card-done]')?.addEventListener('click', () => dialog.close());
    if (multi) dialog.addEventListener('close', () => onPick?.([...chosen]), { once: true });
    let backdrop = false;
    const outside = e => {const r=dialog.getBoundingClientRect();return e.target===dialog&&(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom);};
    dialog.addEventListener('pointerdown',e=>{backdrop=outside(e);});
    dialog.addEventListener('click',e=>{if(backdrop&&outside(e))dialog.close();backdrop=false;});
    dialog.addEventListener('close', () => { dialog.remove(); if(opener?.isConnected)opener.focus({preventScroll:true}); }, { once:true });
    render();doc.body.append(dialog);showThemeModal(dialog);search.focus();return dialog;
}
