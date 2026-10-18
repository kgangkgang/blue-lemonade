const numericIds = values => [...new Set(Array.from(values || []).filter(Number.isSafeInteger).filter(id => id >= 0))].sort((a, b) => a - b);

// Never silently omit unloaded messages from a scene: the existing load-older
// action is the only path that changes which messages are available to capture.
export function captureRange(loadedIds, first, last) {
    if (String(first).trim() === '' || String(last).trim() === '') return { error: '시작과 끝 메시지를 골라 주세요.' };
    const start = Number(first), end = Number(last);
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || end < start) return { error: '시작 번호부터 끝 번호까지 순서대로 입력해 주세요.' };
    const ids = numericIds(loadedIds).filter(id => id >= start && id <= end);
    if (ids.length !== end - start + 1) return { error: '이 구간에 아직 불러오지 않은 메시지가 있어요. 이전 채팅을 불러온 뒤 다시 골라 주세요.' };
    return { ids, start, end };
}

export function capturePickerControlsMarkup() {
    return `<div data-capture-range><p class="salty-note">목록에서 시작과 끝 메시지를 체크한 뒤, 그 사이를 한 번에 골라요.</p><button type="button" class="salty-btn" data-capture-range-selected>선택한 처음부터 끝까지 담기</button><details><summary>번호로 구간 고르기</summary><div class="bl-tool-grid"><label class="bl-tool-field">시작 번호<input type="number" min="0" step="1" inputmode="numeric" data-capture-range-start placeholder="시작 메시지 번호"></label><label class="bl-tool-field">끝 번호<input type="number" min="0" step="1" inputmode="numeric" data-capture-range-end placeholder="끝 메시지 번호"></label></div><button type="button" class="salty-btn" data-capture-range-apply>이 구간 선택</button></details><p class="salty-note" data-capture-range-status role="status" aria-live="polite">불러온 메시지만 선택할 수 있어요.</p></div>`;
}

export function bindCapturePickerControls(root, { loadedIds, selected, chatKey, blocked = () => false, onChange = () => {} }) {
    const controls = root.querySelector('[data-capture-range]');
    if (!controls) return;
    const first = controls.querySelector('[data-capture-range-start]');
    const last = controls.querySelector('[data-capture-range-end]');
    const status = controls.querySelector('[data-capture-range-status]');
    const initialChat = chatKey();
    const apply = (start, end) => {
        if (chatKey() !== initialChat) { status.textContent = '채팅이 바뀌었어요. 선택 창을 다시 열어 주세요.'; return; }
        if (blocked()) { status.textContent = '다른 채팅 미리보기를 닫은 뒤 골라 주세요.'; return; }
        const result = captureRange(loadedIds(), start, end);
        if (result.error) { status.textContent = result.error; return; }
        selected.clear();
        for (const id of result.ids) selected.add(id);
        for (const input of root.querySelectorAll('[data-word-message]')) input.checked = selected.has(Number(input.dataset.wordMessage));
        first.value = String(result.start); last.value = String(result.end);
        status.textContent = `#${result.start}부터 #${result.end}까지 ${result.ids.length}개를 골랐어요. 아래에서 캡처 미리보기를 만들어요.`;
        onChange();
    };
    controls.querySelector('[data-capture-range-apply]').addEventListener('click', () => apply(first.value, last.value));
    controls.querySelector('[data-capture-range-selected]').addEventListener('click', () => {
        const ids = numericIds(selected);
        if (ids.length < 2) { status.textContent = '목록에서 시작과 끝 메시지 두 개를 체크해 주세요.'; return; }
        apply(ids[0], ids.at(-1));
    });
}
