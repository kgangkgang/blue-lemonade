// Independently implemented message script and sound library UI.
// Feature reference: MultiCast-TTS, Copyright (c) 2026 JINSIN2, MIT.
// https://github.com/JINSIN2/MultiCast-TTS — see ../NOTICE.md for retained attribution.
import { showThemeModal } from '../../../modal.js';
import { allVoices } from './voices.js';
import { normalizeRows, saveScript, clearScript, scriptIdentity, scriptFingerprint } from './script-store.js';
import * as library from './sfx-library.js';
import { ttsCreditsHtml } from '../credits.js';
import { sfxCreditElement } from './sfx-credits.js';

const EMOTIONS = [['', '자동'], ['neutral', '담담하게'], ['calm', '차분하게'], ['happy', '기쁘게'], ['sad', '슬프게'], ['angry', '화나게'], ['fearful', '두렵게'], ['disgusted', '불쾌하게'], ['surprised', '놀라게'], ['whisper', '속삭이기'], ['shout', '외치기']];
const MODES = [['sequence', '순서대로'], ['overlay', '다음 대사와 함께'], ['loop', '끝까지 반복']];
const copy = value => JSON.parse(JSON.stringify(value));
let active = null, serial = 0;
const uid = () => `edit-${Date.now().toString(36)}-${(++serial).toString(36)}`;
const element = (tag, className, text) => { const node = document.createElement(tag); if (className) node.className = className; if (text != null) node.textContent = text; return node; };
function button(text, action, className = '') { const b = element('button', `lvs-button ${className}`, text); b.type = 'button'; if (action) b.addEventListener('click', action); return b; }
function options(items, value) { const select = element('select'); for (const [v, name] of items) { const option = element('option', '', name); option.value = v; select.append(option); } if (value != null) select.value = value; return select; }

function loadStyle() {
    const href = new URL('../script-editor.css', import.meta.url).href;
    if (!document.querySelector('link[data-lv-script-style]')) { const link = element('link'); link.rel = 'stylesheet'; link.href = href; link.dataset.lvScriptStyle = 'true'; document.head.append(link); }
}

/** Explicitly opened only; importing this module performs no generation or chat writes. */
export async function openScriptEditor(mesId) { return openEditor(Number(mesId)); }
export async function openSoundLibrary({ soundId } = {}) {
    if (active?.dialog.isConnected) { active.library(soundId); return active.dialog; }
    return openEditor(null, { soundId });
}

async function openEditor(mesId, { soundId } = {}) {
    if (active?.dialog.isConnected) { active.dialog.focus(); return active.dialog; }
    const player = await import('./player.js');
    // Recheck after the asynchronous import: two quick clicks must not open two editors.
    if (active?.dialog.isConnected) { active.dialog.focus(); return active.dialog; }
    const identity = mesId === null ? null : scriptIdentity(mesId);
    let rows = identity ? normalizeRows(player.scriptRows(mesId)) : [], saved = copy(rows), undo = [], redo = [];
    let busy = false, closed = false, ownPlayback = false, preparingPlayback = false, ownExport = false, tab = identity ? 'script' : 'library';
    let preview = null, previewUrl = '', previewTimer = 0, previewRequest = 0;
    const initialSound = soundId ? library.getSfx(soundId) : null;
    let selectedSoundId = initialSound?.id || '', libraryQuery = initialSound?.name || '', libraryCategory = '', helpPinned = false, asking = null;
    const opener = document.activeElement;
    loadStyle();
    const dialog = element('dialog', 'lvs-dialog lv-editor');
    dialog.setAttribute('aria-labelledby', 'lvs-title'); dialog.tabIndex = -1;
    const shell = element('div', 'lvs-shell'); dialog.append(shell);
    const header = element('header', 'lvs-header'), heading = element('div');
    const title = element('h2', '', identity ? '음성 대본 편집' : '효과음 보관함'); title.id = 'lvs-title';
    heading.append(title, element('p', 'lvs-description', identity ? '원문은 그대로 두고, 이 메시지를 읽는 소리만 편집해요.' : '효과음을 듣고, 가져오고, 정리해요.'));
    const close = button('닫기', () => requestClose()); header.append(heading, close); shell.append(header);
    const tabs = element('div', 'lvs-tabs'); tabs.setAttribute('role', 'tablist'); tabs.setAttribute('aria-label', '대본 도구');
    const scriptTab = button('대본', () => setTab('script')), libraryTab = button('효과음', () => setTab('library'));
    scriptTab.hidden = !identity; tabs.append(scriptTab, libraryTab); shell.append(tabs);
    const status = element('p', 'lvs-status', identity ? '고친 뒤 이 메시지에 저장을 눌러 주세요.' : '효과음을 고르면 무료로 미리 들을 수 있어요.'); status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite'); shell.append(status);
    const content = element('div', 'lvs-content'), scriptPanel = element('section', 'lvs-panel'), libraryPanel = element('section', 'lvs-panel');
    scriptPanel.id = 'lvs-script-panel'; libraryPanel.id = 'lvs-library-panel'; content.append(scriptPanel, libraryPanel); shell.append(content);
    const footer = element('footer', 'lvs-footer'), footerButtons = element('div', 'lvs-actions');
    const save = button('이 메시지에 저장', () => task(async () => { valid(); rows = await saveScript(mesId, rows, identity); saved = copy(rows); updateControls(); notice('이 메시지의 대본을 저장했어요.'); }), 'lvs-primary');
    const play = button('전체 듣기', () => listen());
    const stop = button('정지', () => { stopPreview(); stopOwnedAudio(); notice('재생과 소리 저장을 멈췄어요.'); });
    const download = button('WAV 저장', () => task(async () => { valid(); ownExport = true; try { const ready = await player.downloadScript(mesId, normalizeRows(rows)); if (!closed) notice(ready ? '대본 음원을 WAV로 준비했어요.' : '저장할 소리가 없거나 음성 기능이 꺼져 있어요.', !ready); } finally { ownExport = false; } }));
    const attributionIds = () => rows.filter(row => row.enabled && row.kind === 'sfx' && library.isSfxEnabled(row.sfxId)).map(row => row.sfxId);
    const copyCredits = button('출처 복사', () => task(async () => { valid(); const text = library.sfxAttribution(attributionIds()); if (!text) { notice('복사할 효과음 출처가 없어요.'); return; } try { if (!navigator.clipboard?.writeText) throw new Error(); await navigator.clipboard.writeText(text); } catch { throw new Error('출처를 복사하지 못했어요. 아래 저작권·출처를 펼쳐 직접 복사해 주세요.'); } notice('사용한 효과음 출처를 복사했어요. 공개할 게시물 설명에 함께 붙여 주세요.'); }));
    const exportHelp = help('효과음·반복·쉼·줄 음량을 합쳐 최대 10분까지 저장해요. 파일은 원래 속도(1배속)이며 출처도 기록돼요. 브라우저 내장 목소리는 저장할 수 없어요. CC BY 음원이 있으면 출처 복사 내용을 공개 게시물에도 함께 적어 주세요.'); exportHelp.hidden = !identity;
    footerButtons.append(play, stop, download, exportHelp, copyCredits, save); footer.append(footerButtons);
    const source = element('details', 'lvs-source'), sourceSummary = element('summary', '', '저작권·출처 · TTS와 효과음');
    const credits = element('div'); credits.innerHTML = ttsCreditsHtml(); // trusted static attribution; no user content
    source.append(sourceSummary, credits); footer.append(source); shell.append(footer);
    const tooltip = element('div', 'lvs-tooltip'); tooltip.id = 'lvs-help'; tooltip.setAttribute('role', 'tooltip'); tooltip.hidden = true; dialog.append(tooltip);
    let helpButton = null;

    function notice(text, error = false) { if (closed) return; status.textContent = text; status.classList.toggle('lvs-error', error); }
    function dirty() { return JSON.stringify(rows) !== JSON.stringify(saved); }
    function valid() {
        if (closed) throw new Error('편집 창이 닫혔어요.');
        const current = scriptIdentity(mesId);
        if (current.message !== identity.message || current.chat !== identity.chat || scriptFingerprint(current.message) !== identity.fingerprint) throw new Error('채팅이나 원문·번역이 바뀌었어요. 이 메시지의 대본을 다시 열어 주세요.');
        return normalizeRows(rows);
    }
    async function task(work) {
        if (busy || closed) return;
        busy = true; updateControls();
        try { await work(); } catch (error) { notice(error?.message || '작업하지 못했어요. 다시 시도해 주세요.', true); }
        finally { busy = false; if (!closed) updateControls(); }
    }
    function updateControls() {
        for (const control of scriptPanel.querySelectorAll('input,textarea,select,button')) control.disabled = busy || control.dataset.unavailable === 'true';
        save.disabled = busy || !dirty(); play.disabled = download.disabled = busy || !rows.some(r => r.enabled); save.hidden = play.hidden = download.hidden = !identity;
        copyCredits.hidden = !identity; copyCredits.disabled = busy || !attributionIds().length;
        for (const control of libraryPanel.querySelectorAll('[data-busy-lock]')) control.disabled = busy;
        const u = scriptPanel.querySelector('[data-undo]'), r = scriptPanel.querySelector('[data-redo]'); if (u) u.disabled = busy || !undo.length; if (r) r.disabled = busy || !redo.length;
        scriptTab.setAttribute('aria-selected', String(tab === 'script')); libraryTab.setAttribute('aria-selected', String(tab === 'library'));
        scriptTab.tabIndex = tab === 'script' ? 0 : -1; libraryTab.tabIndex = tab === 'library' ? 0 : -1;
    }
    function snapshot(before) { if (JSON.stringify(before) === JSON.stringify(rows)) return; undo.push(before); if (undo.length > 80) undo.shift(); redo = []; updateControls(); notice('편집 중 · 아직 저장하지 않았어요.'); }
    function mutate(fn, focusId) { if (busy) return; const before = copy(rows); fn(); snapshot(before); renderScript(); if (focusId) scriptPanel.querySelector(`[data-row-id="${focusId}"] textarea`)?.focus(); }
    function setTab(next) { tab = next; scriptPanel.hidden = next !== 'script'; libraryPanel.hidden = next !== 'library'; hideHelp(); if (next === 'library') renderLibrary(); updateControls(); }
    function history(back) { const from = back ? undo : redo, to = back ? redo : undo; if (!from.length || busy) return; to.push(copy(rows)); rows = from.pop(); renderScript(); notice('대본 편집을 ' + (back ? '되돌렸어요.' : '다시 적용했어요.')); }
    function help(text) {
        const b = button('?', null, 'lvs-help-button'); b.setAttribute('aria-label', '사용 방법'); b.setAttribute('aria-expanded', 'false');
        const hide = () => { if (helpPinned || helpButton !== b) return; tooltip.hidden = true; b.removeAttribute('aria-describedby'); b.setAttribute('aria-expanded', 'false'); };
        const show = () => { if (helpButton && helpButton !== b) { helpButton.removeAttribute('aria-describedby'); helpButton.setAttribute('aria-expanded', 'false'); helpPinned = false; } helpButton = b; tooltip.textContent = text; tooltip.hidden = false; b.setAttribute('aria-describedby', tooltip.id); b.setAttribute('aria-expanded', 'true'); const rect = b.getBoundingClientRect(); tooltip.style.left = Math.max(12, Math.min(rect.left, innerWidth - tooltip.offsetWidth - 12)) + 'px'; tooltip.style.top = Math.max(12, Math.min(rect.bottom + 6, innerHeight - tooltip.offsetHeight - 12)) + 'px'; };
        b.addEventListener('mouseenter', show); b.addEventListener('mouseleave', hide); b.addEventListener('focus', show); b.addEventListener('blur', () => { helpPinned = false; hide(); });
        b.addEventListener('click', () => { helpPinned = !helpPinned; if (helpPinned) show(); else hide(); }); return b;
    }
    function hideHelp() { helpPinned = false; tooltip.hidden = true; helpButton?.removeAttribute('aria-describedby'); helpButton?.setAttribute('aria-expanded', 'false'); helpButton = null; }
    function field(labelText, control, explanation = '') {
        const wrap = element('div', 'lvs-field'), label = element('label', '', labelText), caption = element('div', 'lvs-label');
        control.id = `lvs-field-${++serial}`; label.htmlFor = control.id; caption.append(label); if (explanation) caption.append(help(explanation)); wrap.append(caption, control); return wrap;
    }
    function valueControl(row, key, control, numeric = false) {
        control.value = row[key]; let before = null;
        control.addEventListener('focus', () => { before = copy(rows); });
        control.addEventListener('input', () => { if (busy) return; row[key] = numeric ? Number(control.value) : control.value; updateControls(); });
        control.addEventListener('change', () => { if (busy) return; const previous = before || copy(rows); row[key] = numeric ? Number(control.value) : control.value; snapshot(previous); before = copy(rows); });
        return control;
    }
    function input(row, key, type = 'text', min, max) { const control = element('input'); control.type = type; if (min != null) control.min = String(min); if (max != null) control.max = String(max); return valueControl(row, key, control, type === 'number'); }
    function select(row, key, items) { const control = options(items, row[key]); control.addEventListener('change', () => mutate(() => { row[key] = control.value; })); return control; }
    function appendRow(kind, sfxId = '') { if (rows.length >= 500) { notice('대본은 500줄까지 편집할 수 있어요.', true); return; } const id = uid(); mutate(() => rows.push(normalizeRows([{ id, kind, text: '', sfxId, mode: sfxId && library.getSfx(sfxId)?.loop ? 'loop' : 'sequence', gapMs: kind === 'pause' ? 500 : 0 }])[0]), id); setTab('script'); }
    function renderScript() {
        scriptPanel.replaceChildren(); if (!identity) return;
        const toolbar = element('div', 'lvs-actions lvs-toolbar');
        const undoButton = button('↶ 실행 취소', () => history(true)), redoButton = button('↷ 다시 실행', () => history(false)); undoButton.dataset.undo = ''; redoButton.dataset.redo = '';
        toolbar.append(undoButton, redoButton, button('+ 대사', () => appendRow('voice')), button('+ 효과음', () => appendRow('sfx')), button('+ 쉼', () => appendRow('pause')));
        const reset = button('저장된 편집 지우기', () => task(async () => { valid(); if (!await ask('이 메시지의 저장된 대본 편집을 지우고 원래 읽기 설정으로 돌아갈까요? 원문은 바뀌지 않아요.', '편집 지우기')) return; valid(); const before = copy(rows); await clearScript(mesId, identity); rows = normalizeRows(player.scriptRows(mesId)); saved = copy(rows); snapshot(before); renderScript(); notice('저장된 편집을 지웠어요. 실행 취소하면 이전 편집을 다시 가져올 수 있어요.'); }));
        toolbar.append(reset); scriptPanel.append(toolbar);
        scriptPanel.append(element('p', 'lvs-description', '듣기·다시 생성·WAV 저장은 선택한 음성 서비스의 크레딧을 사용할 수 있어요. 효과음 듣기와 편집 저장은 음성을 생성하지 않아요.'));
        const list = element('div', 'lvs-rows'); list.setAttribute('aria-label', '대본 줄'); scriptPanel.append(list);
        if (!rows.length) list.append(element('p', 'lvs-empty', '대사·효과음·쉼을 추가해 대본을 만들어 보세요.'));
        rows.forEach((row, index) => {
            const card = element('article', 'lvs-row'); card.dataset.rowId = row.id; card.classList.toggle('lvs-muted-row', !row.enabled);
            const head = element('div', 'lvs-row-head'), label = element('label', 'lvs-check'), enabled = element('input'); enabled.type = 'checkbox'; enabled.checked = row.enabled;
            enabled.addEventListener('change', () => mutate(() => { row.enabled = enabled.checked; })); label.append(enabled, document.createTextNode(`${index + 1}. ${row.kind === 'voice' ? '대사' : row.kind === 'sfx' ? '효과음' : '쉼'}`));
            const actions = element('div', 'lvs-actions'); const up = button('↑', () => mutate(() => { [rows[index - 1], rows[index]] = [rows[index], rows[index - 1]]; })), down = button('↓', () => mutate(() => { [rows[index], rows[index + 1]] = [rows[index + 1], rows[index]]; }));
            up.setAttribute('aria-label', `${index + 1}번째 줄 위로`); down.setAttribute('aria-label', `${index + 1}번째 줄 아래로`); up.dataset.unavailable = String(index === 0); down.dataset.unavailable = String(index === rows.length - 1);
            actions.append(up, down, button('삭제', () => mutate(() => rows.splice(index, 1)))); head.append(label, actions); card.append(head);
            const grid = element('div', 'lvs-fields');
            if (row.kind === 'voice') {
                const text = valueControl(row, 'text', element('textarea')); text.rows = 2; text.maxLength = 12000; card.append(field('읽을 대사', text, '여기서 고친 말만 음성에 반영돼요. 채팅의 원문과 번역문은 바뀌지 않아요.'));
                const speaker = input(row, 'speaker'); speaker.maxLength = 200; grid.append(field('화자', speaker, '자동 목소리를 고른 상태에서 화자를 바꾸면 그 사람에게 연결된 목소리를 찾아요.'));
                const voices = (allVoices() || []).filter(v => v && v.uid && !v.gone).map(v => [v.uid, `${v.name || v.uid}${v.provider ? ` · ${v.provider}` : ''}`]);
                if (row.voiceUid && !voices.some(([id]) => id === row.voiceUid)) voices.unshift([row.voiceUid, '현재 목소리 · 목록에 없음']);
                grid.append(field('목소리', select(row, 'voiceUid', [['', '화자에 맞게 자동'], ...voices]), '이 줄만 다른 목소리로 읽게 할 수 있어요. 자동은 현재 화자 연결을 따릅니다.'));
                grid.append(field('감정', select(row, 'emotion', EMOTIONS), '지원하는 음성 엔진에서 이 줄의 감정을 바꿔요. 표현의 강도와 지원 범위는 엔진마다 달라요.'));
            } else if (row.kind === 'sfx') {
                const effects = library.listSfx().map(s => [s.id, s.name]); if (row.sfxId && !effects.some(([id]) => id === row.sfxId)) effects.unshift([row.sfxId, '찾을 수 없는 효과음']);
                grid.append(field('효과음', select(row, 'sfxId', [['', '효과음 선택'], ...effects])));
                const mode = options(MODES, row.mode); mode.addEventListener('change', () => mutate(() => { row.mode = mode.value; if (row.mode === 'loop') { row.repeats = 1; row.durationMs = 0; } }));
                grid.append(field('재생 방식', mode, '순서대로: 소리가 끝난 뒤 다음 줄로. 다음 대사와 함께: 다음 대사를 읽으며 재생. 끝까지 반복: 메시지가 끝날 때까지 반복해요. 한 줄 미리듣기는 짧게만 들려줘요.'));
                const repeats = options([['1', '1번'], ['2', '2번'], ['3', '3번'], ['4', '4번']], row.repeats || 1);
                repeats.addEventListener('change', () => mutate(() => { row.repeats = Number(repeats.value); row.durationMs = 0; }));
                const durations = [['0', '원본 길이'], ['2000', '2초'], ['4000', '4초'], ['6000', '6초'], ['8000', '8초']];
                if (row.durationMs && !durations.some(([ms]) => Number(ms) === row.durationMs)) durations.push([String(row.durationMs), `${row.durationMs / 1000}초 (현재)`]);
                const duration = options(durations, row.durationMs || 0); duration.addEventListener('change', () => mutate(() => { row.durationMs = Number(duration.value); row.repeats = 1; }));
                repeats.dataset.unavailable = duration.dataset.unavailable = String(row.mode === 'loop');
                grid.append(field('횟수', repeats, '보통은 1번이에요. 두 번 두드리거나 떨어지는 장면은 횟수를 골라요. 길이를 고르면 횟수는 1번으로 돌아가요. 끝까지 반복 모드에서는 쓰지 않아요.'), field('길이', duration, '계속 타이핑하는 것처럼 이어지는 동작만 시간을 골라요. 선택한 시간 동안 음원을 반복해요. 횟수와 함께 적용하지 않고, 끝까지 반복 모드에서는 쓰지 않아요.'));
                card.append(button('보관함에서 찾기', () => setTab('library')));
            }
            if (row.kind !== 'pause') { const volume = input(row, 'volume', 'number', 0, 1); volume.step = '.05'; grid.append(field('이 줄 음량 (0~1)', volume, '1은 원래 크기, 0.5는 절반 크기예요. 이 줄에만 적용해요.')); }
            const gap = input(row, 'gapMs', 'number', 0, 10000); gap.step = '50'; grid.append(field(row.kind === 'pause' ? '쉬는 시간 (ms)' : '줄 뒤에 쉬기 (ms)', gap, '1000 ms가 1초예요. 500을 넣으면 반 초 쉬어요. 최대 10초까지 정할 수 있어요.'));
            card.append(grid);
            const rowActions = element('div', 'lvs-actions'); rowActions.append(button('이 줄 듣기', () => listen(row.id)));
            if (row.kind === 'voice') rowActions.append(button('다시 생성', () => listen(row.id, true))); card.append(rowActions); list.append(card);
        });
        updateControls();
    }

    async function listen(rowId, regenerate = false) {
        return task(async () => {
            valid(); stopPreview(); ownPlayback = true;
            notice(regenerate ? '이 줄의 음성을 다시 만들고 있어요…' : '대본을 준비하고 있어요…');
            preparingPlayback = true;
            let started;
            try { started = await player.speakScript(mesId, normalizeRows(rows), { rowId, regenerate }); } finally { preparingPlayback = false; }
            if (!started) ownPlayback = false;
            if (!closed) notice(started ? '재생 중에는 정지 버튼으로 멈출 수 있어요.' : '재생할 줄이 없거나 음성 기능이 꺼져 있어요.', !started);
        });
    }
    function stopOwnedAudio() { if (ownExport || preparingPlayback || (ownPlayback && player.currentMesId() === mesId)) player.stop(); ownPlayback = ownExport = false; }
    function stopPreview() { previewRequest++; clearTimeout(previewTimer); if (preview) { preview.pause(); preview.removeAttribute('src'); preview.load(); preview = null; } if (previewUrl) URL.revokeObjectURL(previewUrl); previewUrl = ''; }
    async function previewSound(id) {
        stopPreview(); stopOwnedAudio();
        const request = previewRequest;
        try { const blob = await library.sfxBlob(id); if (closed || request !== previewRequest) return; previewUrl = URL.createObjectURL(blob); preview = new Audio(previewUrl); preview.volume = .75; preview.addEventListener('ended', stopPreview, { once: true }); await preview.play(); if (closed || request !== previewRequest) return; previewTimer = setTimeout(stopPreview, 8000); notice('효과음 미리듣기 · 최대 8초'); }
        catch (error) { if (!closed && request === previewRequest) { stopPreview(); notice(error?.message || '효과음을 듣지 못했어요.', true); } }
    }
    function fileButton(text, accept, multiple, onFiles) {
        const input = element('input'); input.type = 'file'; input.accept = accept; input.multiple = multiple; input.hidden = true;
        input.addEventListener('change', () => { const files = [...input.files]; input.value = ''; if (files.length) task(() => onFiles(files)); });
        const b = button(text, () => input.click()); b.dataset.busyLock = ''; const span = element('span', 'lvs-file-button'); span.append(b, input); return span;
    }
    function downloadBlob(blob, name) { const url = URL.createObjectURL(blob), link = element('a'); link.href = url; link.download = name; dialog.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
    function renderLibrary() {
        libraryPanel.replaceChildren();
        const actions = element('div', 'lvs-actions');
        actions.append(fileButton('음원 가져오기', 'audio/*,.mp3,.wav,.ogg,.m4a,.flac', true, async files => { let imported = 0; const errors = []; for (const file of files) { if (closed) break; try { await library.importSfx(file, { name: file.name.replace(/\.[^.]+$/, '') }); imported++; } catch (error) { errors.push(error?.message || '가져오기 실패'); } } if (!closed) { renderLibrary(); renderScript(); notice(`${imported}개 효과음을 보관함에 넣었어요.` + (errors.length ? ` ${errors.length}개 실패: ${errors[0]}` : ''), errors.length > 0); } }),
            fileButton('효과음 팩 가져오기', '.json,application/json', false, async files => { const result = await library.importSfxPack(files[0]); if (!closed) { renderLibrary(); renderScript(); const summary = typeof result === 'number' ? `${result}개` : `추가 ${result?.added || 0}개 · 건너뜀 ${result?.skipped || 0}개 · 실패 ${result?.failed || 0}개${result?.credited ? ` · 출처 보완 ${result.credited}개` : ''}${result?.restored ? ` · 파일 복원 ${result.restored}개` : ''}`; notice('효과음 팩: ' + summary + (result?.failed ? ' · ' + (result.errors?.[0]?.message || result.errors?.[0] || '파일을 확인해 주세요.') : ''), !!result?.failed); } }));
        const pack = button('내 효과음 팩 저장', () => task(async () => { const blob = await library.exportSfxPack(); if (!closed) { downloadBlob(blob, 'lemon-sound-effects.json'); notice('효과음 팩을 저장했어요.'); } })); pack.dataset.busyLock = ''; actions.append(pack, help('가져온 음원은 이 브라우저 보관함에 저장돼요. 다른 기기로 옮기거나 보관하려면 내 효과음 팩 저장을 이용하세요.'));
        libraryPanel.append(actions);
        const filters = element('div', 'lvs-library-filters'), search = element('input'); search.type = 'search'; search.placeholder = '이름 · 연결 단어 찾기'; search.value = libraryQuery;
        const list = library.listSfx(); const categories = [...new Set(list.map(s => s.category || '기타'))].sort();
        const category = options([['', '모든 종류'], ...categories.map(c => [c, c])], libraryCategory); filters.append(field('검색', search), field('종류', category)); libraryPanel.append(filters);
        const results = element('div', 'lvs-sounds'); libraryPanel.append(results);
        const renderResults = () => {
            results.replaceChildren(); const query = libraryQuery.trim().toLocaleLowerCase();
            const matches = library.listSfx().filter(s => (!selectedSoundId || s.id === selectedSoundId) && (!libraryCategory || (s.category || '기타') === libraryCategory) && (!query || `${s.name} ${(s.words || []).join(' ')} ${s.category || ''}`.toLocaleLowerCase().includes(query)));
            if (!matches.length) results.append(element('p', 'lvs-empty', '맞는 효과음이 없어요. 검색을 바꾸거나 음원을 가져와 주세요.'));
            for (const sound of matches) {
                const item = element('article', 'lvs-sound'), info = element('div', 'lvs-sound-info'); info.append(element('strong', '', sound.name), element('span', 'lvs-description', `${sound.category || '기타'} · ${sound.custom ? '내 효과음' : '기본 효과음'}`));
                const usage = element('div', 'lvs-sound-usage'), usageLabel = element('label', 'lvs-check'), useSound = element('input'), unused = element('span', 'lvs-unused', '사용 안 함');
                useSound.type = 'checkbox'; useSound.checked = library.isSfxEnabled(sound.id); useSound.setAttribute('aria-label', `${sound.name} 재생에 사용`);
                const syncUsage = () => { unused.hidden = useSound.checked; item.classList.toggle('lvs-sound-unused', !useSound.checked); };
                useSound.addEventListener('change', () => { library.setSfxEnabled(sound.id, useSound.checked); syncUsage(); updateControls(); });
                usageLabel.append(useSound, document.createTextNode('재생에 사용'));
                usage.append(usageLabel, help('꺼두면 채팅 읽기·대본 재생·WAV 저장에서 제외돼요. 미리듣기로 소리는 확인할 수 있어요.'), unused);
                // 1.6.3 우선(★): 비슷한 소리가 여럿일 때 분석이 이 소리를 먼저 고른다 (지시문만 바뀜 → 다음 읽기 때 한 번 다시 분석)
                const favLabel = element('label', 'lvs-check'), fav = element('input'); fav.type = 'checkbox'; fav.checked = library.isSfxFavorite(sound.id); fav.setAttribute('aria-label', `${sound.name} 우선`);
                fav.addEventListener('change', () => { library.setSfxFavorite(sound.id, fav.checked); });
                favLabel.append(fav, document.createTextNode('우선')); usage.append(favLabel, help('비슷한 소리가 여럿일 때 분석이 이 소리를 먼저 골라요. 지시문이 바뀌어 다음 읽기 때 한 번 다시 분석해요.'));
                syncUsage(); info.append(usage);
                const credit = sfxCreditElement(sound); if (credit) info.append(credit);
                const buttons = element('div', 'lvs-actions'); buttons.append(button('듣기', () => previewSound(sound.id)));
                if (identity) buttons.append(button('+ 대본에 추가', () => appendRow('sfx', sound.id)));
                item.append(info, buttons);
                if (sound.custom) {
                    const details = element('details', 'lvs-sound-edit'); details.append(element('summary', '', '이름 · 연결 단어 수정'));
                    const name = element('input'); name.value = sound.name; name.maxLength = 80;
                    const words = element('input'); words.value = (sound.words || []).join(', '); words.maxLength = 1000;
                    const category = element('input'); category.value = sound.category || '내 효과음'; category.maxLength = 32;
                    const loop = element('input'); loop.type = 'checkbox'; loop.checked = !!sound.loop;
                    const loopLabel = element('label', 'lvs-check'); loopLabel.append(loop, document.createTextNode('추가할 때 반복 재생'));
                    const form = element('div', 'lvs-fields'); form.append(field('이름', name), field('연결 단어', words, '쉼표로 나눠 적어요. 자동 효과음을 켰을 때 이 단어가 나온 소리에 연결할 수 있어요. 예: 문, 문 열기'), field('종류', category), loopLabel);
                    const editActions = element('div', 'lvs-actions'); const update = button('수정 저장', () => task(async () => { await library.updateSfx(sound.id, { name: name.value.trim(), words: words.value.split(',').map(w => w.trim()).filter(Boolean), category: category.value.trim(), loop: loop.checked }); if (!closed) { renderLibrary(); renderScript(); notice('효과음 정보를 저장했어요.'); } }));
                    const remove = button('보관함에서 삭제', () => task(async () => { if (!await ask(`“${sound.name}”을 보관함에서 삭제할까요? 대본에 넣었던 소리도 다시 가져오기 전에는 재생되지 않아요.`, '효과음 삭제')) return; if (closed) return; stopPreview(); await library.removeSfx(sound.id); if (!closed) { renderLibrary(); renderScript(); notice('효과음을 보관함에서 지웠어요.'); } }));
                    update.dataset.busyLock = remove.dataset.busyLock = ''; editActions.append(update, remove); details.append(form, editActions); item.append(details);
                }
                results.append(item);
            }
            updateControls();
        };
        search.addEventListener('input', () => { selectedSoundId = ''; libraryQuery = search.value; renderResults(); }); category.addEventListener('change', () => { selectedSoundId = ''; libraryCategory = category.value; renderResults(); }); renderResults();
    }
    function ask(text, confirmText) {
        if (asking) return asking;
        const focus = document.activeElement, decision = element('dialog', 'lvs-dialog lvs-confirm');
        const message = element('p', '', text); message.id = 'lvs-confirm-message'; decision.setAttribute('aria-labelledby', message.id);
        const actions = element('div', 'lvs-actions'); const cancel = button('취소', () => decision.close('cancel')), confirm = button(confirmText, () => decision.close('yes'), 'lvs-primary'); actions.append(cancel, confirm); decision.append(message, actions);
        asking = new Promise(resolve => { decision.addEventListener('close', () => { const yes = decision.returnValue === 'yes'; decision.remove(); asking = null; if (focus?.isConnected) focus.focus(); resolve(yes); }, { once: true }); });
        dialog.append(decision); showThemeModal(decision); cancel.focus(); return asking;
    }
    async function requestClose() { if (asking) return; if (dirty() && !await ask('아직 저장하지 않은 대본 편집이 있어요. 저장하지 않고 닫을까요?', '저장하지 않고 닫기')) return; if (!closed) dialog.close(); }
    for (const [b, panel] of [[scriptTab, scriptPanel], [libraryTab, libraryPanel]]) { b.id = panel.id + '-tab'; b.setAttribute('role', 'tab'); b.setAttribute('aria-controls', panel.id); panel.setAttribute('role', 'tabpanel'); panel.setAttribute('aria-labelledby', b.id); b.addEventListener('keydown', event => { if (identity && ['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) { event.preventDefault(); setTab(event.key === 'Home' ? 'script' : event.key === 'End' ? 'library' : tab === 'script' ? 'library' : 'script'); (tab === 'script' ? scriptTab : libraryTab).focus(); } }); }
    dialog.addEventListener('cancel', event => { event.preventDefault(); if (!tooltip.hidden) { hideHelp(); return; } requestClose(); });
    dialog.addEventListener('keydown', event => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z' && !event.target.closest('input,textarea')) { event.preventDefault(); history(!event.shiftKey); } });
    content.addEventListener('scroll', hideHelp, { passive: true });
    dialog.addEventListener('close', () => { closed = true; stopPreview(); stopOwnedAudio(); if (active?.dialog === dialog) active = null; dialog.remove(); if (opener?.isConnected) opener.focus(); }, { once: true });
    document.body.append(dialog); active = { dialog, library: soundId => { if (soundId) { const sound = library.getSfx(soundId); selectedSoundId = sound?.id || ''; libraryQuery = sound?.name || ''; libraryCategory = ''; } setTab('library'); } }; renderScript(); setTab(tab);
    try { showThemeModal(dialog); } catch (error) { active = null; dialog.remove(); throw error; }
    close.focus(); return dialog;
}
