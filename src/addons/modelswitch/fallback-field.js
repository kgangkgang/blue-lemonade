// 6.4.5 「검열당했을 때」 칸 — 번역 · 한글화 패널 · 다시 쓰기 · 캐릭터 에셋 설정 창에 (대사 분석처럼 그 기능 설정 안에서 켠다).
// 저장 = 그 설정의 fallback { enabled, provider(실리태번 chat_completion_source), model } — 모델 전환 「<이름> (검열되면)」 줄과 같은 자리라
// 거기서 골라 둔 값이 그대로 보인다 (옮김 없음). 「안 함」 = enabled:false 만 (제공처 · 모델은 남김) · 제공처를 고르면 enabled:true —
// 남겨 둔 제공처를 다시 고르면 모델이 돌아오고, 다른 제공처면 모델을 비운다.
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

/** 직접 입력을 유지하면서 고를 목록을 좁힌다. 저장된 모델을 열면 전체 목록부터 보여 준다. */
export function matchingModels(ids, typed, current = '') {
    const list = [...new Set(ids.filter(name => typeof name === 'string' && name.trim()))];
    const query = String(typed ?? '').trim().toLowerCase();
    return !query || query === String(current).trim().toLowerCase() ? list : list.filter(name => name.toLowerCase().includes(query));
}

function fieldStyle(doc) {
    const href = new URL('./fallback-field.css', import.meta.url).href;
    if ([...doc.querySelectorAll('link[rel="stylesheet"]')].some(link => link.href === href)) return;
    const link = doc.createElement('link'); link.rel = 'stylesheet'; link.href = href; doc.head.append(link);
}

/**
 * host 안에 칸을 그리고 묶는다 (다시 불러도 한 번만 묶음 · 다시 그림).
 *  settings(): fallback 칸을 가진 설정 객체 · sources: 고를 제공처 id (null = 전부) · save(): 저장 ·
 *  row(label, control): 그 애드온의 한 줄 모양 · main(): 본 모델 { source, model } (같으면 한 줄 알림)
 */
export function mountFallbackField(host, { id, settings, sources = null, save = () => {}, row, main = () => null, selectClass = 'text_pole', inputClass = 'text_pole', notify = true }) {
    if (!host) return null;
    fieldStyle(host.ownerDocument);
    const line = typeof row === 'function' ? row : (label, control) => `<label>${label}${control}</label>`;
    const list = `bl-fb-models-${id}`;
    const choices = SOURCES.filter(source => !sources || sources.includes(source.id));
    let picking = false, current = '', query = '';
    const renderOptions = () => {
        const box = host.querySelector('.bl-fb-options'), button = host.querySelector('[data-bl-fb-pick]');
        if (!box || !button) return;
        box.hidden = !picking; button.setAttribute('aria-expanded', String(picking));
        if (!picking) return;
        const { provider, model } = fieldState(settings());
        const all = LM.list(LM.sourceOf(provider)).ids || [];
        const ids = matchingModels([...all, ...(current ? [current] : [])], query, current);
        box.innerHTML = ids.length ? ids.map(name => `<button type="button" role="option" aria-selected="${name === model}" data-bl-fb-option="${esc(name)}">${esc(name)}</button>`).join('')
            : '<small>맞는 모델이 없어요. 정확한 모델 이름을 직접 적어도 돼요.</small>';
    };
    const render = () => {
        const holder = settings();
        const { provider, model } = fieldState(holder);
        current = model; query = model; picking = false;
        // Preserve an existing provider even when this field's supported list has
        // narrowed. Showing Off here would disagree with the saved fallback.
        const savedChoice = provider && !choices.some(source => source.id === provider)
            ? `<option value="${esc(provider)}" selected>${esc(provider)} (저장된 제공처)</option>` : '';
        let note = '';
        if (provider && !model) note = '모델을 골라 주세요';
        else if (provider) { let now = null; try { now = main(); } catch { now = null; } if (now && now.source === provider && String(now.model || '') === model) note = '본 모델과 같아서 다시 보내지 않아요'; }
        host.innerHTML = line('검열당했을 때', `<select class="${selectClass}" data-bl-fb="provider" aria-label="검열당했을 때 쓸 제공처"><option value="">안 함</option>${savedChoice}${choices.map(source => `<option value="${esc(source.id)}"${source.id === provider ? ' selected' : ''}>${esc(source.label)}</option>`).join('')}</select>`)
            + (provider ? line('모델', `<div class="bl-fb-picker"><div class="bl-fb-model-row"><input type="text" class="${inputClass}" data-bl-fb="model" value="${esc(model)}" placeholder="모델 검색 · 직접 입력" autocomplete="off" spellcheck="false" aria-label="검열당했을 때 쓸 모델" aria-controls="${list}"><button type="button" data-bl-fb-pick aria-label="모델 목록 열기" aria-expanded="false" aria-controls="${list}"><i class="fa-solid fa-chevron-down" aria-hidden="true"></i></button></div><div id="${list}" class="bl-fb-options" role="listbox" aria-label="검열당했을 때 쓸 모델 목록" hidden></div></div>`) : '')
            + (note ? `<small class="bl-fb-note">${esc(note)}</small>` : '');
    };
    const changed = () => { try { save(); } catch { /* 저장은 다음에 */ } if (notify) window.dispatchEvent(new Event('bl:model-switch-targets')); };
    const on = {
        change(event) {
            const kind = event.target?.dataset?.blFb;
            if (kind === 'provider') { pickProvider(settings(), event.target.value); changed(); render(); }
            else if (kind === 'model') { pickModel(settings(), event.target.value); changed(); }
        },
        input(event) {
            if (event.target?.dataset?.blFb !== 'model') return;
            query = event.target.value; picking = true; pickModel(settings(), query); try { save(); } catch { /* 다음에 */ } renderOptions();
        },
        focusin(event) { if (event.target?.dataset?.blFb === 'model') { picking = true; renderOptions(); } },
        pointerdown(event) { if (event.target.closest('[data-bl-fb-option]')) event.preventDefault(); },
        click(event) {
            const option = event.target.closest('[data-bl-fb-option]');
            if (option) {
                event.preventDefault(); pickModel(settings(), option.dataset.blFbOption); changed(); render(); host.querySelector('[data-bl-fb="model"]')?.focus(); picking = false; renderOptions();
            } else if (event.target.closest('[data-bl-fb-pick]')) { event.preventDefault(); picking = !picking; query = host.querySelector('[data-bl-fb="model"]')?.value || ''; renderOptions(); }
        },
        keydown(event) {
            if (event.key === 'Escape' && picking) { event.preventDefault(); picking = false; renderOptions(); event.stopPropagation(); }
            else if (event.key === 'ArrowDown' && event.target?.dataset?.blFb === 'model') { event.preventDefault(); picking = true; renderOptions(); host.querySelector('[data-bl-fb-option]')?.focus(); }
        },
    };
    host.blFallbackHandlers = on;
    if (!host.dataset.blFbBound) {
        host.dataset.blFbBound = '1';
        for (const type of Object.keys(on)) host.addEventListener(type, event => host.blFallbackHandlers?.[type]?.(event));
    }
    host.blFallbackRender = render;
    render();
    return render;
}
