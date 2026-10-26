// 7.9.9 프로필 여러 개 — 관리 창 (캐릭터 편집 화면의 단추 · 테마 설정 카드에서 연다)
//   썸네일 격자(원본 카드 + 등록한 사진) · 한 번 누르면 고정(핀) · 순서 · 미리보기 · 지우기 · 여러 장 추가 · 남은 파일 정리 · 큰 그림 보기
//   저장은 테마 설정(saveSettings) 규약을 따르고, 파일은 store.js 가 실리태번 그림 API 로 올리고 지운다. 카드 PNG 는 건드리지 않는다.
import { getSettings, saveSettings, invalidateSettings } from '../settings.js';
import { showThemeModal } from '../modal.js';
import { ask } from '../ask.js';
import { CARD, MAX_FILES, urlOf, hasAny, poolOf } from './pick.js';
import { uploadAvatarImage, deleteImage, cleanupPlan } from './store.js';
import { currentPick, preview, repaint, ensureRunning, syncMultiAvatar } from './index.js';

const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ctx = () => SillyTavern.getContext();
const toast = (kind, text) => globalThis.toastr?.[kind]?.(text, 'Blue Lemonade');
const changed = () => { invalidateSettings(); globalThis.window?.dispatchEvent(new Event('bl:multi-avatar-changed')); };
const cardUrl = avatar => `/thumbnail?type=avatar&file=${encodeURIComponent(avatar)}`;
const pickUrl = (avatar, pick) => pick === CARD ? cardUrl(avatar) : urlOf(pick);
const characterName = avatar => ctx().characters?.find?.(c => c.avatar === avatar)?.name || avatar.replace(/\.[^.]+$/, '');
const ADD_LABEL = '<i class="fa-solid fa-plus" aria-hidden="true"></i> 사진 추가 (여러 장)';
let dialog = null, busy = false;

function record(avatar, create = false) {
    const s = getSettings().multiAvatar;
    if (!s.chars[avatar] && create) s.chars[avatar] = { files: [], pinned: '' };
    return s.chars[avatar] || { files: [], pinned: '' };
}
function persist() { saveSettings(); changed(); const s = getSettings().multiAvatar; syncMultiAvatar(s.on !== false && hasAny(s), s); repaint(); }

/** 지금 편집 중인 캐릭터의 관리 창 */
export function openForCurrent() {
    const c = ctx(), ch = c.characters?.[c.characterId];
    if (c.groupId || !ch?.avatar || ch.avatar === 'none') { toast('info', '캐릭터를 먼저 고르고 저장한 뒤에 프로필을 더할 수 있어요.'); return; }
    openDialog(ch.avatar);
}

export function openDialog(avatar) {
    close();
    dialog = document.createElement('dialog');
    dialog.className = 'bl-tool-dialog bl-mav';
    dialog.setAttribute('aria-labelledby', 'bl-mav-title');
    dialog.dataset.avatar = avatar;
    dialog.innerHTML = `<header class="bl-mav-head"><div><h3 id="bl-mav-title"><i class="fa-solid fa-images" aria-hidden="true"></i> 프로필 여러 개 — ${esc(characterName(avatar))}</h3><p class="bl-mav-sub" data-mav-sub></p></div><button type="button" class="salty-btn bl-mav-icon" data-mav="close" aria-label="닫기"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button></header>
        <div class="bl-mav-grid" data-mav-grid role="list" aria-label="프로필 사진"></div>
        <footer class="bl-mav-foot"><button type="button" class="salty-btn bl-tool-primary" data-mav="add">${ADD_LABEL}</button><input type="file" accept="image/*" multiple hidden data-mav-file><p class="salty-note">사진은 이 서버 계정의 <code>user/images</code> 폴더에 저장되고 카드 PNG 는 바뀌지 않아요. 칸을 한 번 누르면 그 그림으로 <b>고정</b>, 다시 누르면 풀려 랜덤으로 돌아가요. 적용 시점은 테마 설정 › 채팅 › 캐릭터 프로필에서 골라요.</p></footer>`;
    dialog.addEventListener('click', onClick);
    dialog.addEventListener('change', onFile);
    const mine = dialog;
    dialog.addEventListener('close', () => { mine.remove(); if (dialog === mine) dialog = null; });
    document.body.append(dialog);
    render();
    showThemeModal(dialog);
}
export function close() { const d = dialog; dialog = null; if (!d) return; try { d.close(); } catch { /* 이미 닫힘 */ } d.remove(); }

function render() {
    if (!dialog) return;
    const avatar = dialog.dataset.avatar, s = getSettings().multiAvatar, rec = record(avatar), now = currentPick(avatar);
    const pool = poolOf(rec, true);
    const label = i => i === 0 ? '원본 카드' : `${i}번`;
    const pinnedIndex = rec.pinned ? pool.indexOf(rec.pinned) : -1, nowIndex = pool.indexOf(now);
    dialog.querySelector('[data-mav-sub]').textContent = `등록 ${rec.files.length}장 (최대 ${MAX_FILES}) · 지금 보이는 그림: ${nowIndex >= 0 ? label(nowIndex) : '원본 카드'}` + (rec.pinned ? ` · 고정: ${pinnedIndex >= 0 ? label(pinnedIndex) : '사라진 사진 → 원본'}` : s.when === 'off' ? ' · 랜덤 끔' : '');
    dialog.querySelector('[data-mav-grid]').innerHTML = pool.map((pick, i) => {
        const pinned = rec.pinned === pick, isNow = now === pick, file = pick !== CARD;
        return `<div class="bl-mav-tile${pinned ? ' is-pinned' : ''}${isNow ? ' is-current' : ''}" role="listitem" data-pick="${esc(pick)}">
            <button type="button" class="bl-mav-pic" data-mav="pin" aria-pressed="${pinned}" aria-label="${esc(label(i))}${pinned ? ' · 고정됨, 누르면 풀기' : ' · 누르면 이 그림으로 고정'}"><img src="${esc(pickUrl(avatar, pick))}" alt="" loading="lazy" decoding="async"><span class="bl-mav-pin" aria-hidden="true"><i class="fa-solid fa-thumbtack"></i></span>${isNow ? '<span class="bl-mav-now" aria-hidden="true">지금</span>' : ''}</button>
            <div class="bl-mav-tools"><span class="bl-mav-label">${esc(label(i))}</span>
                ${file ? `<button type="button" class="salty-btn bl-mav-icon" data-mav="left" aria-label="앞으로" ${i <= 1 ? 'disabled' : ''}><i class="fa-solid fa-chevron-left" aria-hidden="true"></i></button><button type="button" class="salty-btn bl-mav-icon" data-mav="right" aria-label="뒤로" ${i >= pool.length - 1 ? 'disabled' : ''}><i class="fa-solid fa-chevron-right" aria-hidden="true"></i></button>` : ''}
                <button type="button" class="salty-btn bl-mav-icon" data-mav="preview" aria-label="이 프로필로 미리보기"><i class="fa-solid fa-eye" aria-hidden="true"></i></button>
                <button type="button" class="salty-btn bl-mav-icon" data-mav="view" aria-label="크게 보기"><i class="fa-solid fa-magnifying-glass-plus" aria-hidden="true"></i></button>
                ${file ? '<button type="button" class="salty-btn bl-mav-icon bl-mav-danger" data-mav="delete" aria-label="지우기"><i class="fa-solid fa-trash-can" aria-hidden="true"></i></button>' : ''}
            </div></div>`;
    }).join('');
    dialog.querySelector('[data-mav="add"]').disabled = busy || rec.files.length >= MAX_FILES;
}

async function onClick(event) {
    const button = event.target.closest('[data-mav]');
    if (!button || !dialog) return;
    const act = button.dataset.mav, avatar = dialog.dataset.avatar, tile = button.closest('[data-pick]'), pick = tile?.dataset.pick;
    if (act === 'close') { close(); return; }
    if (act === 'add') { dialog.querySelector('[data-mav-file]').click(); return; }
    if (act === 'view') { openViewer(pickUrl(avatar, pick), characterName(avatar)); return; }
    if (act === 'preview') { preview(avatar, pick); render(); return; }
    if (act === 'pin') {
        const rec = record(avatar, true);
        rec.pinned = rec.pinned === pick ? '' : pick;
        const pinnedNow = !!rec.pinned;
        if (!rec.files.length && !rec.pinned) delete getSettings().multiAvatar.chars[avatar];
        persist(); render();
        toast('info', pinnedNow ? '이 그림으로 고정했어요. 다시 누르면 풀려요.' : '고정을 풀었어요. 다시 랜덤으로 바뀌어요.');
        return;
    }
    if (act === 'left' || act === 'right') {
        const rec = record(avatar), i = rec.files.indexOf(pick), j = act === 'left' ? i - 1 : i + 1;
        if (i < 0 || j < 0 || j >= rec.files.length) return;
        [rec.files[i], rec.files[j]] = [rec.files[j], rec.files[i]];
        persist(); render();
        return;
    }
    if (act === 'delete') {
        if (busy || !pick || pick === CARD) return;
        if (!await ask('이 사진을 서버에서 지울까요?\n되돌릴 수 없어요. 카드 원본 그림은 그대로예요.', { ok: '지우기', cancel: '취소', danger: true, title: '프로필 사진 지우기' })) return;
        busy = true; render();
        try {
            await deleteImage(pick);
            const rec = record(avatar);
            rec.files = rec.files.filter(p => p !== pick);
            if (rec.pinned === pick) rec.pinned = '';
            if (!rec.files.length && !rec.pinned) delete getSettings().multiAvatar.chars[avatar];
            persist();
        } catch (error) { toast('error', error?.message || String(error)); }
        finally { busy = false; render(); }
    }
}
async function onFile(event) {
    const input = event.target;
    if (!input.matches?.('[data-mav-file]') || !dialog) return;
    const files = [...(input.files || [])]; input.value = '';
    if (!files.length || busy) return;
    const avatar = dialog.dataset.avatar, add = dialog.querySelector('[data-mav="add"]');
    busy = true; add.disabled = true;
    let done = 0;
    try {
        for (const [i, file] of files.entries()) {
            if (record(avatar).files.length >= MAX_FILES) { toast('warning', `사진은 ${MAX_FILES}장까지 등록할 수 있어요.`); break; }
            add.innerHTML = `<i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i> 올리는 중 ${i + 1}/${files.length}`;
            try {
                const path = await uploadAvatarImage(avatar, file);
                record(avatar, true).files.push(path); done++;
                saveSettings(); render();
            } catch (error) { toast('error', `${file.name}: ${error?.message || error}`); }
        }
        if (done) { persist(); ensureRunning(); toast('success', `사진 ${done}장을 더했어요.`); }
    } finally { busy = false; if (dialog) { add.innerHTML = ADD_LABEL; render(); } }
}

/** 큰 그림 보기 — 누르면 닫힘 (실리태번 확대 창은 우리 주소를 못 읽는다) */
export function openViewer(url, label = '') {
    const viewer = document.createElement('dialog');
    viewer.className = 'bl-mav-viewer';
    viewer.setAttribute('aria-label', label ? `${label} 프로필 크게 보기` : '프로필 크게 보기');
    viewer.innerHTML = `<img src="${esc(url)}" alt="${esc(label)}"><button type="button" class="salty-btn bl-mav-icon" data-mav-viewer-close aria-label="닫기"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button>`;
    viewer.addEventListener('click', () => { try { viewer.close(); } catch { /* 닫힘 */ } });
    viewer.addEventListener('close', () => viewer.remove());
    document.body.append(viewer);
    showThemeModal(viewer);
}

/** 설정 카드 「남은 파일 정리」 — 계획을 보여 주고 확인한 뒤에만 지운다 (캐릭터를 지워도 자동으로는 안 지운다) */
export async function openCleanup() {
    const s = getSettings().multiAvatar, avatars = (ctx().characters || []).map(c => c?.avatar).filter(a => typeof a === 'string' && a && a !== 'none');
    let plan;
    try { plan = await cleanupPlan(s.chars, avatars); }
    catch (error) { toast('error', `정리할 파일을 살피지 못했어요. ${error?.message || error}`); return; }
    if (!plan.total && !plan.gone.length) { toast('info', '남은 파일이 없어요. 깨끗해요.'); return; }
    const lines = [plan.gone.length ? `지운 캐릭터 ${plan.gone.length}명의 항목 · 사진 ${plan.goneFiles.length}장` : '', plan.orphanFiles.length ? `어느 캐릭터에도 안 적힌 사진 ${plan.orphanFiles.length}장` : ''].filter(Boolean).join('\n');
    if (!await ask(`${lines}\n\n서버에서 지울까요? 되돌릴 수 없어요. 지금 쓰는 캐릭터의 사진은 건드리지 않아요.`, { ok: plan.total ? `${plan.total}장 지우기` : '항목 정리', cancel: '취소', danger: true, title: '남은 파일 정리' })) return;
    let removed = 0, failed = 0;
    for (const path of [...plan.goneFiles, ...plan.orphanFiles]) { try { await deleteImage(path); removed++; } catch { failed++; } }
    for (const avatar of plan.gone) delete s.chars[avatar];
    persist();
    toast(failed ? 'warning' : 'success', `사진 ${removed}장을 지웠어요.${failed ? ` ${failed}장은 지우지 못했어요.` : ''}${plan.gone.length ? ` 지운 캐릭터 ${plan.gone.length}명의 항목도 정리했어요.` : ''}`);
}
