import { getSettings } from '../../settings.js';
import { ready } from './index.js';
export { ready };
let root, anchor, dialog, owner = null;
function settingsRoot() {
    if (!root) {
        // The extension-order tool may lift this drawer out of its original holder.
        root = document.querySelector('.translation_settings.llmt-settings');
        if (!root) throw Error('번역 설정을 찾지 못했어요. 새로고침해 주세요.');
        anchor = document.createComment('Blue Lemonade translator home');
        root.before(anchor); root.dataset.blTranslator = 'true';
    }
    return root;
}
export function syncVisibility() {
    const node = settingsRoot();
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
    dialog = document.createElement('dialog'); dialog.className = 'bl-translator-dialog';
    dialog.setAttribute('aria-label','LLM 번역 설정');
    dialog.innerHTML = '<header><b>LLM 번역</b><button type="button" aria-label="번역 설정 닫기">×</button></header><div class="bl-translator-dialog-body"></div>';
    document.body.append(dialog);
    const release = take(dialog.querySelector('.bl-translator-dialog-body'));
    dialog.querySelector('button').onclick = () => dialog.close();
    dialog.addEventListener('close', () => { release?.(); dialog.remove(); dialog=null; }, {once:true});
    dialog.showModal();
}
export function mountInline(host) {
    const release = take(host);
    if (release) return release;
    host.innerHTML='<p class="salty-note">번역 설정 창이 열려 있어요. 닫은 뒤 이 탭을 다시 열어 주세요.</p>';
    return () => host.replaceChildren();
}
