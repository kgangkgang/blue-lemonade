// 6.4.5 「검열당했을 때」 칸 — 번역 · 한글화 패널 · 다시 쓰기 · 캐릭터 에셋 설정 창에 (대사 분석처럼 그 기능 설정 안에서 켠다).
// 저장 = 그 설정의 fallback { enabled, provider(실리태번 chat_completion_source), model } — 모델 전환 「<이름> (검열되면)」 줄과 같은 자리라
// 거기서 골라 둔 값이 그대로 보인다 (옮김 없음). 「안 함」 = enabled:false 만 (제공처 · 모델은 남김) · 제공처를 고르면 enabled:true —
// 남겨 둔 제공처를 다시 고르면 모델이 돌아오고, 다른 제공처면 모델을 비운다. 꺼진 칸(안 함 · 모델 없음)은 모델 전환 목록에서 숨는다 (rows.js).
// 본 요청이 내용 차단으로 막혔을 때만 그 모델로 한 번 더 보낸다 (fallback.js withFallback — 각 애드온의 요청 길은 그대로)
import { SOURCES } from '../models/sources.js';
import * as LM from '../../live-models.js';

const isObj = value => !!value && typeof value === 'object' && !Array.isArray(value);
const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

/** 칸이 보이는 값 — 「안 함」이면 provider '' */
export function fieldState(holder) {
    const fb = isObj(holder?.fallback) ? holder.fallback : {};
    const provider = fb.enabled === false ? '' : String(fb.provider ?? '').trim();
    return { provider, model: provider ? String(fb.model ?? '').trim() : '' };
}

/** 제공처를 고름 ('' = 안 함) → holder.fallback 을 고친다 (얼어 있으면 새 객체) */
export function pickProvider(holder, provider) {
    if (!isObj(holder)) return null;
    const old = isObj(holder.fallback) ? holder.fallback : {};
    const fb = Object.isFrozen(old) ? { ...old } : old;
    const next = String(provider ?? '').trim();
    if (!next) fb.enabled = false;
    else {
        if (String(fb.provider ?? '').trim() !== next) fb.model = '';
        fb.provider = next;
        fb.enabled = true;
    }
    if (typeof fb.provider !== 'string') fb.provider = '';
    if (typeof fb.model !== 'string') fb.model = '';
    holder.fallback = fb;
    return fb;
}

/** 모델 이름을 고름 */
export function pickModel(holder, model) {
    if (!isObj(holder)) return null;
    const old = isObj(holder.fallback) ? holder.fallback : { enabled: true, provider: '' };
    const fb = Object.isFrozen(old) ? { ...old } : old;
    fb.model = String(model ?? '').trim();
    holder.fallback = fb;
    return fb;
}

/**
 * host 안에 칸을 그리고 묶는다 (다시 불러도 한 번만 묶음 · 다시 그림).
 *  settings(): fallback 칸을 가진 설정 객체 · sources: 고를 제공처 id (null = 전부) · save(): 저장 ·
 *  row(label, control): 그 애드온의 한 줄 모양 · main(): 본 모델 { source, model } (같으면 한 줄 알림)
 */
export function mountFallbackField(host, { id, settings, sources = null, save = () => {}, row, main = () => null, selectClass = 'text_pole', inputClass = 'text_pole' }) {
    if (!host) return null;
    const line = typeof row === 'function' ? row : (label, control) => `<label>${label}${control}</label>`;
    const list = `bl-fb-models-${id}`;
    const choices = SOURCES.filter(source => !sources || sources.includes(source.id));
    const render = () => {
        const holder = settings();
        const { provider, model } = fieldState(holder);
        const ids = provider ? [...new Set([...(LM.list(LM.sourceOf(provider)).ids || []), ...(model ? [model] : [])])] : [];
        // Preserve an existing provider even when this field's supported list has
        // narrowed. Showing Off here would disagree with the saved fallback.
        const savedChoice = provider && !choices.some(source => source.id === provider)
            ? `<option value="${esc(provider)}" selected>${esc(provider)} (저장된 제공처)</option>` : '';
        let note = '';
        if (provider && !model) note = '모델을 골라 주세요';
        else if (provider) { let now = null; try { now = main(); } catch { now = null; } if (now && now.source === provider && String(now.model || '') === model) note = '본 모델과 같아서 다시 보내지 않아요'; }
        host.innerHTML = line('검열당했을 때', `<select class="${selectClass}" data-bl-fb="provider" aria-label="검열당했을 때 쓸 제공처"><option value="">안 함</option>${savedChoice}${choices.map(source => `<option value="${esc(source.id)}"${source.id === provider ? ' selected' : ''}>${esc(source.label)}</option>`).join('')}</select>`)
            + (provider ? line('모델', `<input type="text" class="${inputClass}" data-bl-fb="model" list="${list}" value="${esc(model)}" placeholder="모델 이름" autocomplete="off" spellcheck="false" aria-label="검열당했을 때 쓸 모델"><datalist id="${list}">${ids.map(name => `<option value="${esc(name)}"></option>`).join('')}</datalist>`) : '')
            + (note ? `<small class="bl-fb-note">${esc(note)}</small>` : '');
    };
    if (!host.dataset.blFbBound) {
        host.dataset.blFbBound = '1';
        const changed = () => { try { save(); } catch { /* 저장은 다음에 */ } window.dispatchEvent(new Event('bl:model-switch-targets')); };
        host.addEventListener('change', event => {
            const kind = event.target?.dataset?.blFb;
            if (kind === 'provider') { pickProvider(settings(), event.target.value); changed(); render(); }
            else if (kind === 'model') { pickModel(settings(), event.target.value); changed(); render(); }
        });
        // 모델 이름은 칠 때마다 저장 (다시 그리지 않음 — 입력 중 초점을 지킨다)
        host.addEventListener('input', event => { if (event.target?.dataset?.blFb === 'model') { pickModel(settings(), event.target.value); try { save(); } catch { /* 다음에 */ } } });
    }
    host.blFallbackRender = render;
    render();
    return render;
}
