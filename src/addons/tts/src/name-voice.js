// 6.3.6 답의 이름(.name_text)을 꾹 눌러 그 답에 나온 인물들의 목소리 고르기 (발굴 #6 — 설정 › TTS › 목소리 탭 › 인물 줄까지 다섯 번 들어가던 것).
// 누르기 규칙은 테마 websearch.js · 캐릭터 에셋 hold.js 와 같다: 0.5초(폰은 길게 누르기 신호 contextmenu 가 먼저 오면 그것으로),
//   pointerdown · contextmenu 에 preventDefault 없음(막으면 폰의 톡 · 낱말 고르기가 죽는다), 창을 띄운 누르기의 끝에 오는 click 하나만 먹는다.
// 짧은 탭 · 아바타 · 메시지 단추는 그대로. 내 메시지 · 시스템 메시지에는 뜨지 않는다. 고르면 설정 › 목소리 탭과 같은 저장(char_map · 엔진 고정 규칙).
import { eventSource, event_types } from '../../../../../../../../script.js';
import { getContext } from '../../../../../../../extensions.js';
import { runtimeEnabled } from './runtime.js';
import { dialogueSpeakers } from './player.js';
import { nameVoiceRowsHtml, pickCharVoice } from './ui.js';
import { messageSpeakers, placeBelow } from './name-voice-core.js';
import { log } from './log.js';

const HOLD_MS = 500;            // 실리태번 · 테마의 길게 누르기와 같은 길이
const SLOP = 8;                 // 이만큼(px) 움직이면 스크롤로 본다
const CLICK_AFTER_UP = 400;     // 손을 뗀 뒤 이 안에 오는 click 은 꾹 누르기의 끝
const BOX_CLASS = 'lv-namevoice';

let press = null, held = null, lastType = '', box = null, started = false;

function targetOf(el) {
    const name = el?.closest?.('#chat .mes .name_text');
    if (!name) return null;
    const id = Number(name.closest('.mes')?.getAttribute('mesid'));
    if (!Number.isInteger(id)) return null;
    let mes = null;
    try { mes = getContext()?.chat?.[id]; } catch { mes = null; }
    if (!mes || mes.is_user || mes.is_system) return null;
    return { id, el: name, mes };
}

const WATCH = [['pointermove', onMove], ['scroll', cancel]];
function cancel() {
    if (!press) return;
    clearTimeout(press.timer);
    press = null;
    for (const [type, handler] of WATCH) window.removeEventListener(type, handler, true);
}
function onMove(event) {
    if (!press || event.pointerId !== press.pointerId) return;
    if (Math.hypot(event.clientX - press.x, event.clientY - press.y) > SLOP) cancel();
}
function fire() {
    const p = press;
    cancel();
    if (!p) return;
    held = { id: p.pointerId, up: 0 };
    open(p);
}
function onDown(event) {
    lastType = event.pointerType;
    if (held && (held.up || event.isPrimary)) held = null;
    if (box && !box.contains(event.target)) close();
    if (press) { cancel(); return; }   // 둘째 손가락 — 확대 · 두 손가락 스크롤
    if (!event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0)) return;
    if (!runtimeEnabled()) return;
    const t = targetOf(event.target);
    if (!t) return;
    press = { ...t, pointerId: event.pointerId, x: event.clientX, y: event.clientY, touch: event.pointerType !== 'mouse', timer: setTimeout(fire, HOLD_MS) };
    for (const [type, handler] of WATCH) window.addEventListener(type, handler, { capture: true, passive: true });
}
function onUp(event) {
    if (press && event.pointerId === press.pointerId) cancel();
    if (held && !held.up && event.pointerId === held.id) held.up = Date.now();
}
function holding() {
    if (held?.up && Date.now() - held.up > CLICK_AFTER_UP) held = null;
    return !!held;
}
/** 창을 띄운 누르기의 끝에 오는 click 하나 — 이름을 누르면 도는 다른 동작으로 새지 않게 */
function onClick(event) {
    if (!event.isTrusted || !holding()) return;
    held = null;
    event.preventDefault();
    event.stopImmediatePropagation();
}
/** 폰은 길게 누르면 contextmenu 를 먼저 보낸다 — 그 신호로 바로 띄우되 막지 않는다. PC 오른쪽 클릭은 브라우저 메뉴 그대로 */
function onContextMenu(event) {
    if (!press || (event.pointerType || lastType) === 'mouse') return;
    if (event.shiftKey || event.ctrlKey || event.altKey || event.metaKey) { cancel(); return; }
    const p = press;
    cancel();
    held = { id: p.pointerId, up: 0, menu: true };
    open(p);
}
function onKey(event) { if (box && event.key === 'Escape') { event.stopPropagation(); close(); } }

function names(t) {
    let lines = [];
    try { lines = dialogueSpeakers(t.id); } catch (e) { log('err', `이름 목소리: 화자 구하기 실패 ${String(e?.message || e).slice(0, 40)}`); }
    let userName = '';
    try { userName = getContext()?.name1 || ''; } catch { userName = ''; }
    return messageSpeakers(lines, { userName, sender: t.mes.name });
}

function render(list) {
    if (!box) return;
    box.querySelector('.lv-namevoice-rows').innerHTML = nameVoiceRowsHtml(list);
}
function place(anchorEl) {
    if (!box || !anchorEl?.isConnected) return;
    const a = anchorEl.getBoundingClientRect();
    const r = box.getBoundingClientRect();
    const pos = placeBelow(a, { width: r.width, height: r.height }, { width: window.innerWidth, height: window.innerHeight });
    box.style.left = `${pos.left}px`;
    box.style.top = `${pos.top}px`;
}
function open(p) {
    close();
    const list = names(p);
    if (!list.length) return;
    if (p.touch) setTimeout(() => { try { const sel = getSelection(); if (sel && p.el.contains(sel.anchorNode)) sel.removeAllRanges(); } catch { /* 무시 */ } }, 0);   // 이름 낱말 선택 막대가 창을 덮지 않게
    try { navigator.vibrate?.(12); } catch { /* 진동 없는 기기 */ }
    box = document.createElement('div');
    box.className = BOX_CLASS;
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-label', `${p.mes.name || ''} 목소리`.trim());
    box.innerHTML = '<div class="lv-namevoice-rows"></div>';
    document.body.append(box);
    render(list);
    box.addEventListener('change', (event) => {
        const sel = event.target.closest?.('select[data-lv-namevoice]');
        if (!sel) return;
        try { pickCharVoice(sel.dataset.lvNamevoice, sel.value); }
        catch (e) { log('err', `이름 목소리 저장 실패: ${String(e?.message || e).slice(0, 40)}`); }
        render(list);   // 엔진 자동 맞춤이면 실제로 읽는 짝이 보이게
        place(p.el);
    });
    place(p.el);
    box.querySelector('select')?.focus({ preventScroll: true });
    document.addEventListener('keydown', onKey, true);
}
export function close() {
    if (!box) return;
    box.remove();
    box = null;
    document.removeEventListener('keydown', onKey, true);
}
export const isOpen = () => !!box;

const onScroll = () => close();
export function init() {
    if (started) return;
    started = true;
    const passive = { capture: true, passive: true };
    window.addEventListener('pointerdown', onDown, passive);
    window.addEventListener('pointerup', onUp, passive);
    window.addEventListener('pointercancel', onUp, passive);
    window.addEventListener('click', onClick, true);
    window.addEventListener('contextmenu', onContextMenu, true);
    window.addEventListener('resize', onScroll);
    document.getElementById('chat')?.addEventListener('scroll', onScroll, { passive: true });
    try { if (event_types?.CHAT_CHANGED) eventSource.on(event_types.CHAT_CHANGED, onScroll); } catch { /* 시험 */ }
}
export function destroy() {
    if (!started) return;
    started = false;
    cancel(); close(); held = null;
    window.removeEventListener('pointerdown', onDown, true);
    window.removeEventListener('pointerup', onUp, true);
    window.removeEventListener('pointercancel', onUp, true);
    window.removeEventListener('click', onClick, true);
    window.removeEventListener('contextmenu', onContextMenu, true);
    window.removeEventListener('resize', onScroll);
    document.getElementById('chat')?.removeEventListener('scroll', onScroll);
    try { if (event_types?.CHAT_CHANGED) eventSource.removeListener?.(event_types.CHAT_CHANGED, onScroll); } catch { /* 시험 */ }
}
