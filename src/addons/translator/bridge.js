import { showThemeModal } from '../../modal.js';
import { getSettings } from '../../settings.js';
import { ready, duplicate } from './index.js';
export { ready, duplicate };
let root, anchor, dialog, owner = null;
function findRoot() {
    if (!root) {
        // The extension-order tool may lift this drawer out of its original holder.
        const node = document.querySelector('.translation_settings.llmt-settings');
        if (!node) return null; // index.html 을 못 받았을 때 (2.1.3 부터 치명적이지 않다)
        root = node; anchor = document.createComment('Blue Lemonade translator home');
        root.before(anchor); root.dataset.blTranslator = 'true';
    }
    return root;
}
function settingsRoot() {
    const node = findRoot();
    if (!node) throw Error('번역 설정을 찾지 못했어요. 새로고침해 주세요.');
    return node;
}
export function syncVisibility() {
    const node = findRoot();
    if (!node) return;
    node.hidden = !owner && getSettings().addonUI.translatorDrawer === false;
}
function take(host) {
    const node = settingsRoot();
    if (owner) return null;
    owner = host; node.hidden = false; host.append(node);
    node.classList.add('bl-translator-mounted');
    return () => {
        if (owner !== host) return;
        node.classList.remove('bl-translator-mounted');
        anchor.after(node); owner = null; syncVisibility();
    };
}
export async function openPanel() {
    await ready;
    if (dialog?.open) return;
    if (owner) { owner.scrollIntoView({block:'nearest'}); return; }
    if (!findRoot()) { globalThis.toastr?.error('번역 설정을 찾지 못했어요. 새로고침해 주세요.', 'LLM 번역'); return; }
    dialog = document.createElement('dialog'); dialog.className = 'bl-translator-dialog';
    dialog.setAttribute('aria-label','LLM 번역 설정');
    dialog.innerHTML = '<header><b><i class="fa-solid fa-language" aria-hidden="true"></i> LLM 번역 <span class="ext-version" hidden></span></b><button type="button" aria-label="번역 설정 닫기">×</button></header><div class="bl-translator-dialog-body"></div>';
    // 7.0.3 창 머리 통일: 다른 확장 창처럼 판 알약 — 판은 manifest 에만 있다
    fetch(new URL('./manifest.json', import.meta.url)).then(r => r.ok ? r.json() : null).then(m => { const v = dialog.querySelector('header .ext-version'); if (v && m?.version) { v.textContent = `v${m.version}`; v.hidden = false; } }).catch(() => {});
    document.body.append(dialog);
    const release = take(dialog.querySelector('.bl-translator-dialog-body'));
    dialog.querySelector('button').onclick = () => dialog.close();
    dialog.addEventListener('close', () => { release?.(); dialog.remove(); dialog=null; }, {once:true});
    showThemeModal(dialog);
}
export function mountInline(host) {
    const release = take(host);
    if (release) return release;
    host.innerHTML='<p class="salty-note">번역 설정 창이 열려 있어요. 닫은 뒤 이 탭을 다시 열어 주세요.</p>';
    return () => host.replaceChildren();
}
