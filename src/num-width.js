// 7.7.9 숫자칸 유동 폭 — 애드온 창 · 팝업 · 확장 서랍의 input[type=number] 에 값 길이(최소 3자)를 --bl-num-ch 로 넣는다 (css/95-fields-i2.css 가 폭으로 씀).
// 값이 바뀔 때(input · change)와 창이 열릴 때(dialog 추가 · 창 안 다시 그리기 · 확장 서랍 펼침) 한 번. 채팅(#chat)은 보지 않는다.
const ROOTS = 'dialog, #extensions_settings, #extensions_settings2, #pt-panel';
let bodyObserver = null;
const dialogObservers = new WeakMap();

export function fitNumberInput(el) {
    if (!(el instanceof HTMLInputElement) || el.type !== 'number') return;
    const len = String(el.value ?? '').length || String(el.placeholder ?? '').length;
    const width=String(Math.max(3, Math.min(len, 12)));
    if(el.style.getPropertyValue('--bl-num-ch')!==width)el.style.setProperty('--bl-num-ch',width);
}
function fitIn(root) {
    if (!root?.querySelectorAll) return;
    for (const el of root.querySelectorAll('input[type="number"]')) fitNumberInput(el);
}
function watchDialog(dlg) {
    if (!(dlg instanceof Element) || dialogObservers.has(dlg)) return;
    fitIn(dlg);
    let t = 0;const pending=new Set();
    const ob = new MutationObserver(records => {
        for(const record of records)for(const node of record.addedNodes){
            if(!(node instanceof Element))continue;
            if(node.matches('input[type="number"]'))pending.add(node);
            for(const input of node.querySelectorAll('input[type="number"]'))pending.add(input);
        }
        if(!pending.size||t)return;
        t=setTimeout(()=>{t=0;for(const input of pending)if(input.isConnected)fitNumberInput(input);pending.clear();},30);
    });
    ob.observe(dlg, { childList: true, subtree: true });
    dialogObservers.set(dlg, ob);
    // 닫혀서 떨어져 나가면 그만
    const done = new MutationObserver(() => { if (!dlg.isConnected) { clearTimeout(t);pending.clear();ob.disconnect(); done.disconnect(); dialogObservers.delete(dlg); } });
    done.observe(document.body, { childList: true });
}

export function startNumberWidth() {
    if (bodyObserver) return;
    const onEdit = e => { const el = e.target; if (el instanceof HTMLInputElement && el.type === 'number') fitNumberInput(el); };
    document.addEventListener('input', onEdit, true);
    document.addEventListener('change', onEdit, true);
    // 확장 서랍 · 창 안 탭은 누를 때 한 번 (그려진 뒤)
    document.addEventListener('click', e => {
        const head = e.target instanceof Element ? e.target.closest('.inline-drawer-toggle, .inline-drawer-header, [data-bl-addon-open], .pa-hub-tab, .lv-tab, .llmt-tab, .rl-tab') : null;
        if (!head) return;
        setTimeout(() => fitIn(head.closest(ROOTS) || head.closest('.inline-drawer') || document.getElementById('extensions_settings')), 60);
    }, true);
    bodyObserver = new MutationObserver(records => {
        for (const r of records) for (const node of r.addedNodes) {
            if (!(node instanceof Element)) continue;
            if (node.matches('dialog')) watchDialog(node);
            else for (const d of node.querySelectorAll?.('dialog') || []) watchDialog(d);
        }
    });
    bodyObserver.observe(document.body, { childList: true, subtree: false });
    for (const d of document.querySelectorAll('dialog[open]')) watchDialog(d);
    fitIn(document.getElementById('extensions_settings'));
    fitIn(document.getElementById('extensions_settings2'));
}
