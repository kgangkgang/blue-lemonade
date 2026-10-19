// 캐릭터 에셋 — 그림 크게 보기 (넘기기, 확대, 켜기/끄기, 태그 복사, 이름 바꾸기, 지우기)
// <dialog>의 맨 위 층(top layer)에 띄워서, 폰에서 html에 transform이 걸려 있어도 화면 밖으로 밀리지 않는다.
import { fixToastrForDialogs } from '../../../../../../popup.js';
import { disabledSet, setDisabled, forgetOptimized, copyOptimized } from './state.js';
import { deleteAsset, renameAsset, sanitizeBase, sameBaseSiblings, baseOf } from './assets.js';
import { toast, confirmDialog, inputDialog, copyText, applyThemeVars } from './ui.js';
import { runtime, reload, recompute, sourceByKey } from './store.js';
import { attachZoom } from '../../image-zoom.js';   // 7.2.7 확대 손짓은 북마크 그림 보기와 같이 쓴다

let dialog = null;

/** 창을 닫고 바로 치운다. 실리태번이 toast 컨테이너를 dialog 안으로 옮겨 두므로, 치우기 전에 body로 되돌린다. */
function dispose(element) {
    if (dialog === element) dialog = null;
    element._cleanup?.(); // 5.4.3: 창 위 Esc 가로채기 풀기 · 확대 감시(크기 변화) 풀기
    if (element.open) element.close();
    fixToastrForDialogs();
    element.remove();
}

export function closeViewer() {
    if (dialog) dispose(dialog);
}

/**
 * @param {{ items: import('./assets.js').Asset[], start?: number, slot?: { current: import('./assets.js').Asset, apply: (name: string) => Promise<boolean> } | null }} options
 *   items는 보이는 순서의 파일 목록. slot = 채팅 답장의 그림 자리에서 열었을 때(hold.js) — 아래에 「이 자리」 줄:
 *   ✓ 지금 보는 그림을 그 자리에 · ⊘ 그 자리에서 빼기 (그 메시지의 그 자리만). 그 자리에 이미 있는 그림이면 ✓ 는 흐리게
 */
export function openViewer({ items, start = 0, slot = null }) {
    closeViewer();
    if (!items.length) return;
    let list = [...items];
    let cursor = Math.min(Math.max(0, start), list.length - 1);
    let working = false;
    const slotRow = slot ? `
        <div class="eh-viewer-slot">
            <button type="button" class="eh-vbtn eh-vbtn--accent" data-act="slot-use"><i class="fa-solid fa-check"></i><span>이 자리에</span></button>
            <button type="button" class="eh-vbtn" data-act="slot-clear"><i class="fa-solid fa-ban"></i><span>빼기</span></button>
        </div>` : '';

    dialog = document.createElement('dialog');
    dialog.className = 'eh-root eh-viewer';
    applyThemeVars(dialog);
    dialog.innerHTML = `
        <div class="eh-viewer-top">
            <div class="eh-viewer-title">
                <b class="eh-viewer-name"></b>
                <span class="eh-viewer-meta">
                    <span class="eh-viewer-count"></span>
                    <span class="eh-viewer-state" hidden><i class="fa-solid fa-eye-slash"></i> 꺼짐 · AI에게 알려 주지 않아요</span>
                </span>
            </div>
            <button type="button" class="eh-icon-btn eh-icon-btn--light" data-act="close" aria-label="닫기"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <div class="eh-viewer-stage">
            <button type="button" class="eh-viewer-nav eh-viewer-nav--prev" data-act="prev" aria-label="이전"><i class="fa-solid fa-chevron-left"></i></button>
            <img class="eh-viewer-img" alt="">
            <button type="button" class="eh-viewer-nav eh-viewer-nav--next" data-act="next" aria-label="다음"><i class="fa-solid fa-chevron-right"></i></button>
        </div>${slotRow}
        <div class="eh-viewer-actions">
            <button type="button" class="eh-vbtn" data-act="toggle"><i class="fa-solid fa-eye-slash"></i><span>끄기</span></button>
            <button type="button" class="eh-vbtn" data-act="copy"><i class="fa-solid fa-tag"></i><span>태그 복사</span></button>
            <button type="button" class="eh-vbtn" data-act="rename"><i class="fa-solid fa-pen"></i><span>이름 바꾸기</span></button>
            <button type="button" class="eh-vbtn eh-vbtn--danger" data-act="delete"><i class="fa-solid fa-trash"></i><span>지우기</span></button>
        </div>`;

    const element = dialog;
    const img = element.querySelector('.eh-viewer-img');
    const name = element.querySelector('.eh-viewer-name');
    const count = element.querySelector('.eh-viewer-count');
    const state = element.querySelector('.eh-viewer-state');
    const prev = element.querySelector('[data-act="prev"]');
    const next = element.querySelector('[data-act="next"]');
    const toggle = element.querySelector('[data-act="toggle"]');
    const rename = element.querySelector('[data-act="rename"]');
    const remove = element.querySelector('[data-act="delete"]');
    const slotUse = element.querySelector('[data-act="slot-use"]');

    const current = () => list[cursor];
    /** 이 그림이 지금 그 자리에 있는 그림인가 (폴더 · 파일) */
    const inSlot = asset => !!slot?.current && asset.folder === slot.current.folder && asset.file === slot.current.file;
    /** 이름 바꾸기 · 지우기가 되는 파일인지 — 이 캐릭터의 폴더(원본 · 프리셋)만. 불러온 남의 폴더는 설정 칸처럼 그 캐릭터에서만 (panel.js ownActive) */
    const ownFile = asset => sourceByKey(asset.folder)?.own === true;

    // 확대 · 옮기기 · 쓸어 넘기기 (attachZoom). 쓸어 넘기기는 확대하지 않았을 때만 온다.
    const stage = element.querySelector('.eh-viewer-stage');
    const zoom = attachZoom({ element, stage, img, onSwipe: delta => step(delta) });
    /** 지금 띄운 그림 주소 — 다른 그림으로 바뀔 때만 원래 크기로 돌린다 (끄기 · 켜기로 다시 그릴 때는 그대로) */
    let shownUrl = '';

    function show() {
        const asset = current();
        if (!asset) {
            closeViewer();
            return;
        }
        if (asset.url !== shownUrl) {
            shownUrl = asset.url;
            zoom.clear();
        }
        img.src = asset.url;
        img.alt = asset.file;
        name.textContent = asset.file;
        count.textContent = `${cursor + 1} / ${list.length}`;
        prev.hidden = list.length < 2;
        next.hidden = list.length < 2;
        const off = disabledSet(asset.folder).has(asset.file);
        // 버튼에는 '누르면 하는 일'을, 상태는 이름 옆 표시와 흐린 그림으로 보여 준다.
        element.classList.toggle('is-off', off);
        state.hidden = !off;
        toggle.querySelector('i').className = `fa-solid ${off ? 'fa-eye' : 'fa-eye-slash'}`;
        toggle.querySelector('span').textContent = off ? '켜기' : '끄기';
        toggle.setAttribute('aria-pressed', String(off));
        rename.hidden = !ownFile(asset);
        remove.hidden = !ownFile(asset);
        if (slotUse) slotUse.disabled = inSlot(asset);
    }

    function step(delta) {
        if (list.length < 2) return;
        cursor = (cursor + delta + list.length) % list.length;
        show();
    }

    function onToggle() {
        const asset = current();
        const off = !disabledSet(asset.folder).has(asset.file);
        setDisabled(asset.folder, asset.file, off);
        recompute();
        show();
    }

    async function onCopy() {
        const tag = `{{img::${current().file}}}`;
        const ok = await copyText(tag);
        toast(ok ? 'success' : 'error', ok ? `${tag} 복사했어요.` : '복사하지 못했어요.');
    }

    async function onRename() {
        const asset = current();
        if (!ownFile(asset)) return;
        const input = await inputDialog(`새 이름을 적어 주세요. (확장자 .${asset.ext}는 그대로예요)\n번호 묶음으로 만들려면 이름 뒤에 -1, -2처럼 번호를 붙여요.`, asset.base, { ok: '바꾸기' });
        if (input === null) return;
        const newBase = sanitizeBase(input);
        if (!newBase) {
            toast('warning', '이름이 비어 있어요.');
            return;
        }
        if (newBase === asset.base) return;
        if (newBase.toLowerCase() === asset.base.toLowerCase()) {
            toast('warning', '대소문자만 다른 이름으로는 바꿀 수 없어요.');
            return;
        }
        // 같은 폴더(프리셋) 안에서만 겹침을 본다 — 다른 프리셋에 같은 이름이 있는 건 일부러 그런 것
        // 1.3.2: 합친 목록(runtime.assets)이 아니라 그 폴더의 목록을 본다. 합친 목록에는 꺼 둔 프리셋의 그림과 위 폴더에 가려진
        //        같은 이름이 없어서, 그런 폴더에서는 묻지도 않고 있던 파일을 덮어썼다.
        const inFolder = runtime.sources.find(source => source.key === asset.folder)?.assets ?? [];
        const takenAll = inFolder.filter(other => other !== asset && other.base.toLowerCase() === newBase.toLowerCase());
        const taken = takenAll[0] ?? null;
        if (taken && !(await confirmDialog(`'${takenAll.map(item => item.file).join(', ')}'이(가) 이미 있어요. 그 파일을 덮어쓸까요?`, { ok: '덮어쓰기' }))) return;
        // 1.3.2: 서버는 예전 이름을 지울 때 확장자만 다른 같은 이름(이름.jpg 등)도 함께 지운다. 지우기처럼 먼저 알린다.
        const siblings = sameBaseSiblings(inFolder, asset);
        if (siblings.length && !(await confirmDialog(`같은 이름의 ${siblings.map(item => item.file).join(', ')}도 함께 지워져요. 이 파일만 따로 이름을 바꿀 수는 없어요.\n계속할까요?`, { ok: '바꾸기' }))) return;

        working = true;
        const wasOff = disabledSet(asset.folder).has(asset.file);
        const newFile = `${newBase}.${asset.ext}`;
        let partial = false;
        try {
            await renameAsset(asset, newBase, {
                taken,
                // 새 파일이 생기자마자 꺼짐 상태를 옮겨서, 예전 파일 지우기가 실패해도 숨긴 그림이 AI에게 새지 않게 한다.
                afterUpload: () => {
                    copyOptimized(asset.folder, asset.file, asset.folder, newFile);
                    // 2026-10-06: 덮어쓴 같은 이름의 꺼짐은 지우고 새 파일은 제 상태를 가진다 (꺼 둔 이름으로 바꾸면 켜진 그림이 꺼지던 것).
                    //             올리기가 지우는 건 이름이 똑같은 파일뿐 — 대소문자만 다른 이름의 꺼짐은 pruneDisabled 가 알아서 버린다.
                    for (const name of disabledSet(asset.folder)) if (name !== newFile && baseOf(name) === newBase) setDisabled(asset.folder, name, false);
                    setDisabled(asset.folder, newFile, wasOff);
                },
            });
        } catch (error) {
            console.error('[캐릭터 에셋] 이름 바꾸기 실패', error);
            if (!error?.partial) {
                toast('error', `이름을 바꾸지 못했어요. ${error?.message ?? ''}`);
                working = false;
                return;
            }
            partial = true;
            toast('warning', error.message, { timeOut: 10000 });
        }
        try {
            if (!partial) {
                setDisabled(asset.folder, asset.file, false);
                forgetOptimized(asset.folder, [asset.file, ...siblings.map(item => item.file)]);
            }
            await reload();
            const fresh = runtime.sources.find(source => source.key === asset.folder)?.assets.find(other => other.file.toLowerCase() === newFile.toLowerCase()) ?? null;
            // 덮어쓴 파일과 함께 지워진 같은 이름 파일은 넘겨 보기 목록에서도 뺀다
            for (const gone of [...takenAll, ...(partial ? [] : siblings)]) {
                const removed = list.findIndex((item, i) => i !== cursor && item.folder === gone.folder && item.file === gone.file);
                if (removed >= 0) {
                    list.splice(removed, 1);
                    if (removed < cursor) cursor--;
                }
            }
            if (partial) {
                // 예전 파일이 남아 있으니 그대로 보여 주고, 새 파일은 목록 뒤에 붙인다.
                if (fresh && !list.includes(fresh)) list.push(fresh);
            } else if (fresh) {
                list[cursor] = fresh;
                toast('success', `'${asset.file}' → '${newFile}'`);
            } else {
                list.splice(cursor, 1);
            }
            if (!list.length) {
                closeViewer();
                return;
            }
            cursor = Math.min(cursor, list.length - 1);
            show();
        } finally {
            working = false;
        }
    }

    async function onDelete() {
        const asset = current();
        if (!ownFile(asset)) return;
        // 서버는 확장자만 다른 같은 이름의 파일도 함께 지운다.
        const siblings = sameBaseSiblings(runtime.sources.find(source => source.key === asset.folder)?.assets ?? [], asset);
        const extra = siblings.length ? `\n같은 이름의 ${siblings.map(item => item.file).join(', ')}도 함께 지워져요.` : '';
        if (!(await confirmDialog(`'${asset.file}' 그림을 지울까요?${extra}\n파일이 지워지고 되돌릴 수 없어요.`, { ok: '지우기' }))) return;
        working = true;
        try {
            await deleteAsset(asset.folder, asset.base);
            const gone = new Set([asset, ...siblings].map(item => item.file));
            for (const file of gone) setDisabled(asset.folder, file, false);
            forgetOptimized(asset.folder, [...gone]);
            toast('success', `'${asset.file}'을(를) 지웠어요.`);
            await reload();
            // 채팅 · 북마크 카드 · 메모에 이미 떠 있는 그 그림을 숨기게 알린다 (hold.js)
            document.dispatchEvent(new CustomEvent('char-assets:deleted', { detail: { folder: asset.folder, files: [...gone] } }));
            list = list.filter(item => !gone.has(item.file) && runtime.sources.some(source => source.assets.some(other => other.folder === item.folder && other.file === item.file)));
            if (!list.length) {
                closeViewer();
                return;
            }
            cursor = Math.min(cursor, list.length - 1);
            show();
        } catch (error) {
            console.error('[캐릭터 에셋] 지우기 실패', error);
            toast('error', `지우지 못했어요. ${error?.message ?? ''}`);
        } finally {
            working = false;
        }
    }

    /** 「이 자리」 줄: name = 지금 보는 그림 파일, '' = 빼기. 바꾸면 창을 닫는다 (채팅의 그 자리가 바로 다시 그려진다) */
    async function onSlot(name) {
        if (!slot) return;
        working = true;
        let ok = false;
        try {
            ok = await slot.apply(name);
        } catch (error) {
            console.error('[캐릭터 에셋] 이 자리 바꾸기 실패', error);
        } finally {
            working = false;
        }
        if (ok) closeViewer();
        else toast('warning', '이 자리를 바꾸지 못했어요.');
    }

    // 채팅의 그림을 꾹 눌러 열었을 때(hold.js) 손을 떼며 오는 click 이 어두운 곳에 닿아도 바로 닫히지 않게 — hold.js 가 먼저 먹지만 한 번 더
    const openedAt = Date.now();
    element.addEventListener('click', (event) => {
        const action = event.target.closest('[data-act]')?.dataset.act;
        if (!action) {
            // 그림 바깥(어두운 곳)을 누르면 닫는다. 쓸어 넘기기 · 끌기 · 두 번 톡 직후의 click 과, 확대해서 보는 중에는 닫지 않는다.
            if (zoom.quiet() || zoom.zoomed() || Date.now() - openedAt < 350) return;
            if (event.target === element || event.target.classList.contains('eh-viewer-stage')) closeViewer();
            return;
        }
        if (working) return;
        if (action === 'close') closeViewer();
        else if (action === 'prev') step(-1);
        else if (action === 'next') step(1);
        else if (action === 'toggle') onToggle();
        else if (action === 'copy') onCopy();
        else if (action === 'rename') onRename();
        else if (action === 'delete') onDelete();
        else if (action === 'slot-use') { if (!inSlot(current())) onSlot(current().file); }
        else if (action === 'slot-clear') onSlot('');
    });

    // 실리태번은 html에서 mousedown/touchstart를 받아 '서랍 바깥을 눌렀다'고 보고 확장 서랍을 닫아 버린다.
    // 이 창은 body에 붙어 있어 서랍 바깥으로 보이므로, 누름 이벤트가 html까지 올라가지 않게 막는다.
    for (const type of ['mousedown', 'touchstart', 'pointerdown']) {
        element.addEventListener(type, (event) => event.stopPropagation(), { passive: true });
    }

    // 창이 떠 있는 동안 실리태번 전역 단축키(← → 스와이프, ↑ 마지막 메시지 편집 등)로 새지 않게 막는다.
    element.addEventListener('keydown', (event) => {
        event.stopPropagation();
        if (working) return;
        if (event.key === 'ArrowLeft') { event.preventDefault(); step(-1); }
        else if (event.key === 'ArrowRight') { event.preventDefault(); step(1); }
    });
    element.addEventListener('keyup', (event) => event.stopPropagation());

    // Esc 등 브라우저가 직접 닫았을 때도 치운다
    element.addEventListener('close', () => {
        if (element.isConnected) dispose(element);
    });
    // 5.4.3: 북마크 창 · 앞뒤 문맥 창 위에서 연 경우(채팅 그림 꾹 누르기) 그 창들의 document 캡처 Esc 가 먼저 받아 밑의 창을 닫고
    // preventDefault 로 이 창의 Esc 닫기까지 막았다 — 이 창이 맨 위일 때만 window 캡처로 먼저 받아 이 창만 닫는다.
    // 창 위에 확인 · 입력 팝업이 떠 있으면 그 팝업이 맨 위이므로 건드리지 않는다.
    const onEsc = (event) => {
        if (event.key !== 'Escape' || !element.open) return;
        const open = [...document.querySelectorAll('dialog[open]')];
        if (open[open.length - 1] !== element) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        dispose(element);
    };
    window.addEventListener('keydown', onEsc, true);
    element._cleanup = () => {
        window.removeEventListener('keydown', onEsc, true);
        zoom.destroy();
    };

    document.body.append(element);
    show();
    element.showModal();
    // toast 컨테이너를 맨 위 층(dialog 안)으로 옮겨야 창 위에 알림이 보인다.
    fixToastrForDialogs();
}
