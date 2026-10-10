import { getSettings } from '../../settings.js';
import { addonsEnabled } from '../../usage-mode.js';
import { verifyAddonCss } from '../../addon-files-check.js';
const VERSION = '1.0.1';
const HELPER_VERSION = '1.0.0';
const API = '/api/plugins/blue-lemonade-zip';
const views = new Set();
const state = { connection: null, busy: false, message: '', plan: null, preview: null, result: null, backups: null, folder: '', choice: '', restore: null };
let dialog;
const esc = text => String(text ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
const mb = n => Number(n || 0) < 1024 ? `${n || 0} B` : Number(n) < 1024 ** 2 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1024 ** 2).toFixed(2)} MB`;
const help = (id, title) => `<button type="button" class="blzi-help" data-help="${id}" aria-label="${title} 도움말">?</button>`;
const explanations = {
    start: ['ZIP 설치', '제작자에게 받은 ZIP을 고르면 새 확장을 설치하거나 기존 확장을 업데이트해요. ZIP 안에 폴더가 한 겹 더 있어도 괜찮아요. 압축은 서버에서 풀고, 설치할 이름·버전·폴더를 보여줘요. 믿을 수 있는 제작자의 확장만 골라 주세요.'],
    setup: ['처음 한 번 준비', '웹 화면만으로는 서버 폴더에 파일을 쓸 수 없어 서버용 도우미가 필요해요. 서버를 실행하는 PC나 Termux에서 안내 명령을 한 번 실행하고 실리태번 서버를 다시 켜 주세요. 이후에는 PC·모바일 파일 선택기로 설치할 수 있어요. 서버 관리자 계정에서만 사용할 수 있어요.'],
    target: ['어느 폴더에 설치하나요?', '현재 접속한 서버의 내 계정 확장 폴더에 설치해요. 같은 이름·GitHub 저장소·폴더 이름의 확장이 있으면 추천해요. 개인 개조판은 원본과 이름이 다를 수 있으니 기존 폴더를 직접 골라도 돼요. 다른 확장에 덮어쓰지 않도록 이름을 확인하세요. 공용 설치는 지원하지 않아요.'],
    backup: ['업데이트와 백업', '덮어쓰기 전에 기존 확장 폴더 전체를 백업해요. ZIP에 없는 파일은 그대로 남기므로 확장 안의 데이터와 .git도 유지돼요. 채팅과 실리태번 설정은 건드리지 않아요. 이전 버전 복원은 확장 폴더를 당시 상태로 바꾸며 현재 상태도 다시 백업해요. 채팅·외부 DB·별도 설정은 복원 범위에 포함되지 않아요. 백업은 자동으로 지우지 않으므로 저장 공간을 사용해요.'],
    apply: ['언제 적용되나요?', '설치 후 새로고침하면 새 코드가 불러와져요. 대화 생성이나 편집을 먼저 마친 뒤 눌러 주세요. 꺼져 있던 확장은 설치해도 꺼진 상태를 유지해요. 링크 설치용 Git 업데이트와 ZIP 업데이트는 별개이며 인터넷에서 새 버전을 자동으로 받아오지는 않아요.'],
};
async function showHelp(id) {
    const [title, text] = explanations[id]; const ctx = SillyTavern.getContext();
    await ctx.callGenericPopup(`<h3>${esc(title)}</h3><p style="text-align:left;line-height:1.8">${esc(text)}</p>`, ctx.POPUP_TYPE.TEXT);
}
async function request(route, body, file) {
    const headers = { ...SillyTavern.getContext().getRequestHeaders(), 'X-BL-Zip': '1' };
    if (file) headers['Content-Type'] = 'application/zip';
    let response;
    try { response = await fetch(API + route, { method: file || body ? 'POST' : 'GET', headers, body: file || (body ? JSON.stringify(body) : undefined) }); }
    catch { throw Error('서버 연결이 끊겼어요. 다시 연결한 뒤 설치 상태를 확인해 주세요.'); }
    let data; try { data = await response.json(); } catch { data = null; }
    if (!response.ok) { const e = Error(data?.error || (response.status === 404 ? '서버 도우미를 먼저 준비해 주세요.' : `서버 요청을 마치지 못했어요 (${response.status}).`)); e.status = response.status; throw e; }
    return data;
}
async function work(task) {
    if (state.busy) return;
    const focusRoot = document.activeElement?.closest('.blzi'), action = document.activeElement?.dataset.action;
    state.busy = true; state.message = '확인 중…'; renderAll();
    try { await task(); } catch (e) { state.message = e.message; }
    finally {
        state.busy = false; renderAll();
        const next = state.result && ['install', 'restore'].includes(action) ? 'reload' : state.preview && action === 'preview' ? 'install' : action;
        if (focusRoot?.isConnected && next) focusRoot.querySelector(`[data-action="${next}"]`)?.focus({ preventScroll: true });
    }
}
const check = () => work(async () => {
    try { const status = await request('/status'); if (status.version !== HELPER_VERSION) throw Error('서버 도우미 버전이 달라요. 새 준비 명령을 실행하고 서버를 다시 켜 주세요.'); state.connection = true; state.message = '준비됐어요. ZIP을 골라 주세요.'; }
    catch (e) { state.connection = e.status === 403 ? 'denied' : false; throw e; }
});
async function choose(file) {
    if (!file || state.busy) return;
    if (!/\.zip$/i.test(file.name)) { state.message = '.zip 파일을 골라 주세요.'; renderAll(); return; }
    if (file.size > 64 * 1024 ** 2) { state.message = 'ZIP은 64MB까지 넣을 수 있어요.'; renderAll(); return; }
    await work(async () => {
        state.plan = null; state.preview = null; state.result = null; state.restore = null;
        state.plan = await request(`/inspect?name=${encodeURIComponent(file.name)}`, null, file);
        const p = state.plan; state.choice = p.matches.length === 1 ? p.matches[0].folder : p.matches.length > 1 ? '' : '@new';
        state.folder = p.suggested; state.message = '설치할 확장과 폴더를 확인해 주세요.';
        if (state.choice) state.preview = await request('/preview', { token: p.token, folder: state.choice === '@new' ? state.folder : state.choice });
    });
}
function markup() {
    const disabled = state.busy ? 'disabled' : '', p = state.plan, preview = state.preview;
    const setup = `<section class="blzi-card"><h3>처음 한 번, 서버 도우미 준비 ${help('setup', '서버 도우미')}</h3><p><b>PC:</b> 서버를 끄고 테마 폴더 안의 <code>server-plugin/setup-windows.cmd</code>를 두 번 누른 뒤 서버를 다시 켜요.</p><details><summary>Termux · 명령으로 준비하기</summary><p>실리태번 서버를 종료한 뒤, 아래 순서대로 진행해요.</p><h4>1. 먼저 이 두 줄을 통째로 실행해요</h4><p>홈 폴더에 SillyTavern을 기본 이름으로 설치한 경우예요.</p><pre><code>cd ~/SillyTavern &&
node "data/default-user/extensions/blue-lemonade/server-plugin/setup.mjs"</code></pre><p><b>“ZIP 도우미를 준비했어요”</b>가 나오면 준비 끝이에요. 서버를 다시 켜고 <b>연결 확인</b>을 눌러요.</p><h4>2. 폴더·파일을 못 찾는다고 나오면</h4><p>아래 명령으로 실제 설치 경로를 찾아요.</p><pre><code>find "$HOME" -type f -path '*/extensions/*/server-plugin/setup.mjs' 2&gt;/dev/null</code></pre><p>검색 결과로 나온 <b>setup.mjs까지의 전체 경로</b>를 복사해요. 위 node 명령의 따옴표 안 경로를 그 결과로 바꿔 실행해요. 예를 들어 <code>node "찾은 전체 경로"</code>처럼 입력하되, <b>‘찾은 전체 경로’라는 글자는 실제 결과로 바꿔요.</b> 따옴표는 남겨 두세요. 전체 경로를 쓰면 현재 폴더가 어디든 괜찮아요.</p><p class="blzi-muted">여러 경로가 나오면 지금 사용하는 실리태번의 테마를 골라요. 아무것도 나오지 않으면 테마를 최신 버전으로 업데이트한 뒤 다시 찾아요. 다른 서버 플러그인이 있으면 먼저 확인하도록 안내해요.</p></details><div class="blzi-actions"><a href="${new URL('../../../server-plugin/README.md', import.meta.url).href}" target="_blank" rel="noopener">자세한 준비 안내</a></div></section>`;
    return `<h3><i class="fa-solid fa-file-zipper" aria-hidden="true"></i> ZIP으로 간편 설치 ${help('start', 'ZIP 설치')}</h3><p class="blzi-muted">파일 고르기 → 설치 내용 확인 → 적용</p><div class="blzi-status" role="status" aria-live="polite">${esc(state.message || '서버 도우미 연결을 확인해 주세요.')}</div>
        ${state.connection !== true ? `${state.connection === false ? setup : ''}<button type="button" data-action="check" ${disabled}>연결 확인</button>` : ''}
        ${state.connection === true ? `<section class="blzi-card blzi-drop ${p ? 'blzi-drop-small' : ''}" data-drop>${p ? '<span>다른 파일을 고르려면</span>' : '<h3>확장 ZIP을 여기에</h3><p class="blzi-muted">PC에서는 끌어 놓아도 돼요 · 최대 64MB</p>'}<input type="file" accept=".zip,application/zip" hidden data-file><button type="button" class="blzi-primary" data-action="pick" ${disabled}>ZIP 고르기</button></section>` : ''}
        ${p ? `<section class="blzi-card"><h3>${esc(p.manifest.display_name)}</h3><p>v${esc(p.manifest.version)} · 파일 ${p.count}개 · ${mb(p.bytes)}</p><label>설치할 폴더 ${help('target', '설치 폴더')}<select data-choice ${disabled}><option value="" ${!state.choice ? 'selected' : ''}>폴더를 골라 주세요</option>${p.installed.map(m => `<option value="${esc(m.folder)}" ${m.folder === state.choice ? 'selected' : ''}>${p.matches.some(x => x.folder === m.folder) ? '추천 · ' : ''}${esc(m.display_name)} · ${esc(m.folder)}</option>`).join('')}<option value="@new" ${state.choice === '@new' ? 'selected' : ''}>새 폴더에 설치</option></select></label>${state.choice === '@new' ? `<label>새 폴더 이름<input type="text" data-folder value="${esc(state.folder)}" maxlength="100" autocomplete="off" spellcheck="false" ${disabled}></label>` : ''}<button type="button" data-action="preview" ${disabled || (!state.choice ? 'disabled' : '')}>설치 내용 확인</button>
        ${preview ? `<div class="blzi-card"><h3>${preview.current ? '기존 확장 업데이트' : '새 확장 설치'} ${help('backup', '업데이트와 백업')}</h3><dl><dt>폴더</dt><dd>${esc(preview.folder)}</dd><dt>버전</dt><dd>${preview.current ? `v${esc(preview.current.version)} → ` : ''}v${esc(preview.incoming.version)}</dd><dt>파일</dt><dd>교체 ${preview.replaced}개 · 추가 ${preview.files - preview.replaced}개 · 유지 ${preview.kept}개</dd>${preview.current ? `<dt>자동 백업</dt><dd>${mb(preview.backupBytes)}</dd>` : ''}</dl>${preview.current && preview.current.display_name !== preview.incoming.display_name ? `<p>이름이 달라요: ${esc(preview.current.display_name)} → ${esc(preview.incoming.display_name)}. 같은 확장의 개조판인지 확인해 주세요.</p>` : ''}<p class="blzi-muted">믿을 수 있는 제작자의 파일인지 확인해 주세요.</p><button type="button" class="blzi-primary" data-action="install" ${disabled}>${preview.current ? '백업하고 업데이트' : '설치'}</button></div>` : ''}</section>` : ''}
        ${state.result ? `<section class="blzi-card"><h3>파일 적용을 마쳤어요 ${help('apply', '새로고침')}</h3><p>${esc(state.result.folder)}${state.result.backup ? ' · 이전 파일을 백업했어요.' : ''}</p><p class="blzi-muted">진행 중인 대화를 마친 뒤 새로고침해 주세요.</p><button type="button" class="blzi-primary" data-action="reload" ${disabled}>새로고침해서 적용</button></section>` : ''}
        ${state.connection === true ? `<section class="blzi-card"><h3>이전 버전 복원 ${help('backup', '백업 복원')}</h3><button type="button" data-action="backups" ${disabled}>백업 목록 보기</button>${state.backups ? `<p class="blzi-muted">${state.backups.length}개 · ${mb(state.backups.reduce((n,b) => n+b.bytes,0))} · 자동 삭제하지 않아요</p>${state.backups.map(b => `<div class="blzi-backup"><b>${esc(b.manifest?.display_name || b.folder)}</b><p>v${esc(b.manifest?.version || '?')} · ${esc(new Date(b.date).toLocaleString())}</p><small>${esc(b.folder)} · ${mb(b.bytes)}</small><div class="blzi-actions"><button type="button" data-restore="${b.id}" ${disabled}>이 버전 선택</button></div></div>`).join('') || '<p>아직 백업이 없어요.</p>'}` : ''}${state.restore ? `<div class="blzi-card"><p><b>${esc(state.restore.folder)}</b>를 v${esc(state.restore.manifest?.version || '?')} 상태로 되돌려요. 현재 폴더도 먼저 백업해요.</p><div class="blzi-actions"><button type="button" class="blzi-primary" data-action="restore" ${disabled}>백업하고 복원</button><button type="button" data-action="cancel-restore" ${disabled}>취소</button></div></div>` : ''}</section>` : ''}`;
}
function render(root) {
    root.innerHTML = markup(); root.setAttribute('aria-busy', String(state.busy));
    root.querySelectorAll('[data-help]').forEach(b => b.addEventListener('click', () => showHelp(b.dataset.help)));
    root.querySelector('[data-file]')?.addEventListener('change', e => choose(e.target.files?.[0]));
    root.querySelector('[data-choice]')?.addEventListener('change', e => { state.choice = e.target.value; state.preview = null; renderAll(); });
    root.querySelector('[data-folder]')?.addEventListener('input', e => { state.folder = e.target.value; if (state.preview) { state.preview = null; for (const view of views) if (view !== root) render(view); root.querySelector('[data-action="install"]')?.closest('.blzi-card')?.remove(); } });
    root.querySelectorAll('[data-restore]').forEach(b => b.addEventListener('click', () => { state.restore = state.backups.find(x => x.id === b.dataset.restore); renderAll(); }));
    root.querySelectorAll('[data-action]').forEach(b => b.addEventListener('click', () => {
        const action = b.dataset.action;
        if (action === 'check') return check();
        if (action === 'pick') return root.querySelector('[data-file]').click();
        if (action === 'reload') return location.reload();
        if (action === 'cancel-restore') { state.restore = null; renderAll(); return; }
        return work(async () => {
            if (action === 'preview') { state.preview = null; state.preview = await request('/preview', { token: state.plan.token, folder: state.choice === '@new' ? state.folder.trim() : state.choice }); state.message = '아래 내용을 확인한 뒤 설치해 주세요.'; }
            if (action === 'install') { state.result = await request('/install', { token: state.plan.token }); state.plan = null; state.preview = null; state.backups = null; state.message = '설치했어요. 새로고침하면 적용돼요.'; }
            if (action === 'backups') { state.backups = await request('/backups'); state.message = '보관한 백업을 불러왔어요.'; }
            if (action === 'restore') { state.result = await request('/restore', { id: state.restore.id }); state.restore = null; state.plan = null; state.preview = null; state.backups = null; state.message = '복원했어요. 새로고침하면 적용돼요.'; }
        });
    }));
    const drop = root.querySelector('[data-drop]');
    drop?.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('blzi-over'); });
    drop?.addEventListener('dragleave', () => drop.classList.remove('blzi-over'));
    drop?.addEventListener('drop', e => { e.preventDefault(); e.stopPropagation(); drop.classList.remove('blzi-over'); if (e.dataTransfer.files.length !== 1) { state.message = 'ZIP을 하나씩 넣어 주세요.'; renderAll(); return; } choose(e.dataTransfer.files[0]); });
}
function renderAll() { for (const root of views) render(root); }
export function mountInline(host) {
    const root = document.createElement('div'); root.className = 'blzi'; host.append(root); views.add(root); render(root);
    if (state.connection === null && !state.busy) check();
    return () => { views.delete(root); root.remove(); };
}
export function openPanel() {
    if (dialog?.open) { dialog.focus(); return; }
    const previous = document.activeElement;
    dialog = document.createElement('dialog'); dialog.className = 'blzi-dialog'; dialog.setAttribute('aria-label', 'ZIP 설치');
    dialog.innerHTML = '<header><i class="fa-solid fa-file-zipper" aria-hidden="true"></i><strong>ZIP 설치</strong><button type="button" aria-label="닫기">✕</button></header><div data-content></div>';
    document.body.append(dialog); const cleanup = mountInline(dialog.querySelector('[data-content]'));
    dialog.querySelector('header button').addEventListener('click', () => dialog.close());
    dialog.addEventListener('close', () => { cleanup(); dialog.remove(); dialog = null; if (previous?.isConnected) previous.focus(); }, { once: true });
    dialog.showModal();
}
export function syncMenu() {
    const s = getSettings(), id = 'bl-zip-install-menu', old = document.getElementById(id);
    if (!addonsEnabled(s) || !s.addons.zipinstall) { old?.remove(); return; }
    if (old) return;
    const container = document.getElementById('data_bank_wand_container') || document.getElementById('extensionsMenu'); if (!container) return;
    const item = document.createElement('div'); item.id = id; item.className = 'list-group-item flex-container flexGap5 interactable'; item.tabIndex = 0; item.setAttribute('role', 'button');
    item.innerHTML = '<i class="fa-solid fa-file-zipper extensionsMenuExtensionButton" aria-hidden="true"></i><span>ZIP 설치</span>';
    item.addEventListener('click', openPanel); item.addEventListener('keydown', e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); openPanel(); } }); container.append(item);
}
syncMenu();
verifyAddonCss({ folder: 'zipinstall', name: '--blzi-css-version', version: VERSION, title: 'ZIP 설치', selector: '.blzi' });
