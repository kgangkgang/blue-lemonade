// 장면 소리 설정 조각 (6.9.8): 채팅 › 화면 › 날씨 묶음 안 — 스위치 · 소리 크기 · 천둥 · 화면 밖에서도 · 내 소리 파일(접힘).
// panel.js 가 제 조각 함수(row · stack · slider · toggle)를 넘겨 그린다: sceneSoundMarkup(s, { row, stack, slider, toggle }) / bindSceneSound(root, update, refresh).
// 내 파일은 실리태번 사용자 파일(/api/files/upload → /user/files/…)에 올린다 — 같은 서버면 다른 기기에서도 들린다. 소리 자체는 scene-sound.js.
import { KINDS, KIND_LABELS, FILE_EXT, FILE_MAX_BYTES, tidySceneSound } from './scene-sound-rules.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ACCEPT = 'audio/*,.mp3,.ogg,.oga,.wav,.m4a,.aac,.webm,.flac,.opus';
const shortName = url => String(url || '').split('/').pop().replace(/^bl-scene-[a-z]+-\d+\./, '내 파일.');

export function sceneSoundMarkup(s, h) {
    const cfg = tidySceneSound(s?.sceneSound);
    let html = h.row('장면 소리', h.toggle('sceneSound.on', cfg.on), '날씨 효과에 맞춘 배경 소리 — 비 · 바람 · 눈 · 안개 · 물결. TTS 가 꺼져 있어도 이어지고, TTS 효과음은 같은 소리를 건너뛰어요');
    if (!cfg.on) return html;
    html += h.slider('sceneSound.volume', '소리 크기', 0, 100, 1, 40);
    html += h.row('천둥', h.toggle('sceneSound.thunder', cfg.thunder), '비가 올 때 가끔 한 번');
    html += h.row('화면 밖에서도', h.toggle('sceneSound.background', cfg.background), '다른 앱을 보거나 화면을 꺼도 이어져요');
    const count = KINDS.filter(kind => cfg.files[kind]).length;
    html += `<details class="bl-ss-files" data-md-fold="scene-sound-files"><summary><span>내 소리 파일</span>${count ? `<small>${count}</small>` : ''}</summary>
        ${KINDS.map(kind => { const url = cfg.files[kind] || ''; return `<div class="bl-ss-file" data-kind="${kind}"><span class="bl-ss-kind">${KIND_LABELS[kind]}</span><span class="bl-ss-name">${url ? esc(shortName(url)) : '합성'}</span>
            <button type="button" class="bl-ss-btn" data-ss-act="preview" data-kind="${kind}" aria-label="${KIND_LABELS[kind]} 들어 보기" aria-pressed="false"><i class="fa-solid fa-play" aria-hidden="true"></i></button>
            <button type="button" class="bl-ss-btn" data-ss-act="pick" data-kind="${kind}" aria-label="${KIND_LABELS[kind]} 내 파일 고르기"><i class="fa-solid fa-folder-open" aria-hidden="true"></i></button>
            ${url ? `<button type="button" class="bl-ss-btn" data-ss-act="clear" data-kind="${kind}" aria-label="${KIND_LABELS[kind]} 내 파일 빼기"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button>` : ''}
        </div>`; }).join('')}
        <p class="salty-note">파일이 없는 소리는 합성으로 들려요. mp3 · ogg · wav · m4a · webm · flac, 12MB 까지. 올린 파일은 실리태번 사용자 파일 칸에 남아요.</p>
        <input type="file" accept="${ACCEPT}" hidden data-file="scene-sound"></details>`;
    return html;
}

function readBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
        reader.onerror = () => reject(reader.error || new Error('파일을 읽지 못했어요'));
        reader.readAsDataURL(file);
    });
}
/** 사용자 파일 칸에 올린다 → '/user/files/bl-scene-<종류>-<시각>.<확장자>' */
export async function uploadSceneFile(file, kind, { fetch: doFetch = (...a) => globalThis.fetch(...a), headers = () => globalThis.SillyTavern?.getContext?.()?.getRequestHeaders?.() || {}, now = () => Date.now(), read = readBase64 } = {}) {
    const ext = String(file?.name || '').match(FILE_EXT)?.[1]?.toLowerCase();
    if (!ext) throw new Error('mp3 · ogg · wav · m4a · webm · flac 파일만 올릴 수 있어요');
    if (file.size > FILE_MAX_BYTES) throw new Error('12MB 보다 큰 파일은 못 올려요');
    const name = `bl-scene-${kind}-${now()}.${ext}`;
    const res = await doFetch('/api/files/upload', { method: 'POST', headers: headers(), body: JSON.stringify({ name, data: await read(file) }) });
    if (!res.ok) throw new Error(`올리기 실패: ${await res.text()}`);
    const { path } = await res.json();
    return '/' + String(path).replace(/^\/+/, '');
}
export async function deleteSceneFile(url, { fetch: doFetch = (...a) => globalThis.fetch(...a), headers = () => globalThis.SillyTavern?.getContext?.()?.getRequestHeaders?.() || {} } = {}) {
    if (!url) return;
    try { await doFetch('/api/files/delete', { method: 'POST', headers: headers(), body: JSON.stringify({ path: String(url).replace(/^\/+/, '') }) }); } catch { /* 서버 파일은 남아도 문제 없음 */ }
}

/** 설정 창 뿌리에 한 번: 들어 보기 · 고르기 · 빼기 · 파일 올리기 · 스위치를 켜면 아래 줄이 나오게 다시 그리기 */
export function bindSceneSound(root, update, refresh) {
    if (!root || root._sceneSoundBound) return;
    root._sceneSoundBound = true;
    const notify = (kind, text) => { try { globalThis.toastr?.[kind]?.(text, 'Blue Lemonade'); } catch { /* 알림 없이 */ } };
    root.addEventListener('click', async (event) => {
        const button = event.target?.closest?.('[data-ss-act]');
        if (!button || !root.contains(button)) return;
        event.preventDefault();
        const { ssAct: act, kind } = button.dataset;
        if (!KINDS.includes(kind)) return;
        if (act === 'pick') {
            const input = root.querySelector('input[data-file="scene-sound"]');
            if (input) { input.dataset.kind = kind; input.click(); }
            return;
        }
        if (act === 'clear') {
            const old = tidySceneSound(globalThis.Salty?.getSettings?.()?.sceneSound).files[kind] || '';
            update(st => { if (st.sceneSound?.files) delete st.sceneSound.files[kind]; });
            await deleteSceneFile(old);
            return;
        }
        if (act === 'preview') {
            if (button.getAttribute('aria-pressed') === 'true') return;
            button.setAttribute('aria-pressed', 'true');
            try { const m = await import('./scene-sound.js'); await m.previewSceneSound(kind, 4000); }
            catch (error) { notify('warning', `들어 보기를 못 했어요: ${error?.message || error}`); }
            finally { if (button.isConnected) button.setAttribute('aria-pressed', 'false'); }
        }
    });
    root.addEventListener('change', async (event) => {
        const target = event.target;
        if (target?.matches?.('input[data-toggle="sceneSound.on"]')) { setTimeout(() => refresh?.(), 0); return; }   // 켜면 아래 줄(크기 · 천둥 · 파일)이 나온다
        if (!target?.matches?.('input[data-file="scene-sound"]') || !target.files?.[0]) return;
        const kind = target.dataset.kind, file = target.files[0];
        target.value = '';
        if (!KINDS.includes(kind)) return;
        try {
            const url = await uploadSceneFile(file, kind);
            const old = tidySceneSound(globalThis.Salty?.getSettings?.()?.sceneSound).files[kind] || '';
            update(st => { st.sceneSound ??= {}; st.sceneSound.files ??= {}; st.sceneSound.files[kind] = url; });
            if (old && old !== url) await deleteSceneFile(old);
        } catch (error) { notify('error', error?.message || String(error)); }
    });
}
