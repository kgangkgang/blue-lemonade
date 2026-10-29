// TTS (Lemon TTS) — 시작점: 설정 화면 붙이기 · 이벤트 · 메시지 버튼 · 지팡이 메뉴 · 슬래시 명령
// 블루 레몬에이드 내장판: 기존 lemon_voice 설정·캐시·명령을 이어 쓴다.
import { eventSource, event_types, chat, substituteParams, saveSettingsDebounced } from '../../../../../../../script.js';
import { getContext, extensionNames, extension_settings } from '../../../../../../extensions.js';
import { POPUP_TYPE, callGenericPopup } from '../../../../../../popup.js';
import { getSettings as themeSettings } from '../../settings.js';
import { addonsEnabled } from '../../usage-mode.js';
import { verifyAddonCss } from '../../addon-files-check.js';
import { runtimeEnabled, setRuntimeEnabled } from './src/runtime.js';
import { SlashCommandParser } from '../../../../../../slash-commands/SlashCommandParser.js';
import { SlashCommand } from '../../../../../../slash-commands/SlashCommand.js';
import { ARGUMENT_TYPE, SlashCommandArgument, SlashCommandNamedArgument } from '../../../../../../slash-commands/SlashCommandArgument.js';
import { settings, save, VERSION, PATH, SYNC_TEXT_FIELDS } from './src/settings.js';
import { registerAddonMerge } from '../list-sync.js';   // 7.0.2
import { segmentMessage, parseRegexLines } from './src/text.js';
import * as speakers from './src/speakers.js';
import * as voices from './src/voices.js';
import * as player from './src/player.js';
import * as ui from './src/ui.js';
import * as analysis from './src/analysis.js';
import * as clickplay from './src/clickplay.js';
import * as namevoice from './src/name-voice.js';   // 6.3.6 이름 꾹 눌러 목소리 고르기
import * as paint from './src/paint.js';   // 6.2.3 색 없는 대사에 화자 색
import * as pregen from './src/pregen.js';
import * as modelswitch from './src/modelswitch.js';
import { log } from './src/log.js';
import { registerPeopleSource, peopleChanged, invalidatePeople } from '../../people.js';   // 6.9.5 인물표 — 대사 색 · 목소리를 이름 다리의 people 로

export { VERSION };
export let duplicate = false;
let holder = null, root = null, inlineHost = null, opening = false, initialized = false;
let nativeAnchor = null, placement = 'holder', nativeDisplay = '';
const OWNER = Symbol.for('blue-lemonade.tts.owner');
function hasOtherOwner() {
    const disabled = extension_settings.disabledExtensions || [];
    return ['tts', 'lemon-voice', 'lemon-tts'].some(name => extensionNames.includes(`third-party/${name}`) && !disabled.includes(`third-party/${name}`))
        || !!window.LemonVoice || !!document.getElementById('lv_settings') || !!globalThis[OWNER];
}
function nativeHome() {
    if (nativeAnchor?.isConnected) return nativeAnchor;
    const host = document.getElementById('extensions_settings2') || document.getElementById('extensions_settings');
    if (!host) return null;
    nativeAnchor = document.createComment('Blue Lemonade TTS settings home');
    host.append(nativeAnchor); return nativeAnchor;
}
function prepareEmbedded() {
    if (placement === 'native') nativeDisplay = root.querySelector('.inline-drawer-content').style.display;
    root.hidden = false;
    root.classList.add('bl-embedded-settings');
    root.querySelector('.inline-drawer-content').style.display = 'flex';
}
function restoreSettingsHome() {
    if (!root || opening) return;
    if (inlineHost?.isConnected) {
        prepareEmbedded(); if (root.parentElement !== inlineHost) inlineHost.replaceChildren(root); placement = 'inline'; return;
    }
    const anchor = nativeHome();
    root.classList.remove('bl-embedded-settings');
    if (placement !== 'native' || !root.isConnected) {
        root.querySelector('.inline-drawer-content').style.display = nativeDisplay;
        if (anchor) { anchor.after(root); placement = 'native'; }
        else { holder.append(root); placement = 'holder'; }
    }
    root.hidden = !runtimeEnabled() || themeSettings().addonUI?.ttsDrawer === false;
}
/** 표시 위치만 맞춘다. 음성·재생·요술봉 설정은 바꾸지 않는다. */
export function syncVisibility() { restoreSettingsHome(); }
export function syncEnabled() {
    const s = themeSettings();
    const on = !duplicate && addonsEnabled(s) && s.addons?.tts === true;
    setRuntimeEnabled(on);
    syncVisibility();
    if (!initialized) return on;
    if (!on) {
        clearTimeout(streamTimer); streamTimer = 0; stream = null; spoken = null;
        pregen.pregenCancel(); analysis.stopForAddon(); player.stopForAddon(); clickplay.destroy(); namevoice.destroy(); paint.destroy(); modelswitch.unregister();
        removeWand(); document.querySelectorAll('#chat .lv_play, #chat .lv_script').forEach(el => el.remove());
    } else { clickplay.init(); namevoice.init(); paint.init(); modelswitch.register(); syncWand(); addButtons(); }
    peopleChanged();
    return on;
}
export async function openPanel() {
    await ready;
    if (duplicate || !root) return;
    if (inlineHost?.isConnected && inlineHost.offsetParent) { root.scrollIntoView({ block: 'nearest' }); return; }
    if (opening) return; opening = true;
    prepareEmbedded(); placement = 'popup';
    ui.ensureFresh();   // 5.6.4 닫혀 있는 동안 바뀐 채팅의 목소리 카드
    try { await callGenericPopup(root, POPUP_TYPE.TEXT, '', { okButton: '닫기', wide: true, allowVerticalScrolling: true, onOpen: popup => popup?.dlg?.classList.add('bl-roomy-dialog') }); }
    finally { opening = false; restoreSettingsHome(); }
}
export function mountInline(host) {
    inlineHost = host;
    let cancelled = false;
    ready.then(() => {
        if (cancelled || inlineHost !== host || duplicate || !root) return;
        if (opening) host.textContent = '열린 설정창을 닫으면 여기에 표시돼요.';
        else { prepareEmbedded(); host.replaceChildren(root); placement = 'inline'; ui.ensureFresh(); }
    }).catch(() => { if (!cancelled) host.textContent = 'TTS 설정을 불러오지 못했어요. 새로고침 후 다시 확인해 주세요.'; });
    return () => { cancelled = true; if (inlineHost !== host) return; inlineHost = null; restoreSettingsHome(); };
}

const STREAM_MS = 700;   // 스트리밍 중 새 문장 검사 간격
const SWIPE_MS = 400;    // 스와이프 뒤 생성이 시작되는지 기다리는 시간
const FIRST_MS = 1500;   // 채팅을 연 직후의 첫 메시지(인사말)는 읽지 않음

// ---------- 상태 (채팅을 바꾸면 비움)
let spoken = null;        // 마지막으로 읽은 메시지 { id, swipe, text, sig }
let stream = null;        // 스트리밍으로 읽던 메시지 { id, raw }  raw = 지금까지 받은 날글 (ST 가 다듬기 전)
let streamTimer = 0;
let streamLast = 0;
let genStartedAt = 0;     // 마지막 생성 시작 시각
let chatChangedAt = 0;
let groupTurnFrom = -1;   // 8.2.7 그룹 차례(GROUP_WRAPPER_STARTED ~ FINISHED)가 시작될 때의 채팅 길이 (차례 밖이면 -1)
/** 8.2.7 이 번호의 메시지가 지금 그룹 차례에 나온 답인가 */
const inGroupTurn = (id) => groupTurnFrom >= 0 && Number.isInteger(id) && id >= groupTurnFrom;

function toast(msg, kind = 'info') {
    if (window.toastr) toastr[kind](msg, 'TTS', { closeButton: false, timeOut: kind === 'error' ? 5000 : 2500 });
}
function hash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return (h >>> 0).toString(36);
}
const swipeOf = (mes) => Number(mes && mes.swipe_id) || 0;
const msgOf = (id) => (Number.isInteger(id) && id >= 0 ? chat[id] : undefined);

// ---------- 문장 나누기 옵션 (말한 사람 배우기용, player 와 같은 규칙; 정규식 줄 해석은 text.parseRegexLines 하나로)
function knownNames(ctx) {
    const names = new Set(Object.keys(settings().char_map || {}));
    for (const v of voices.allVoices()) { names.add(v.name); for (const a of v.aliases || []) names.add(a); }
    if (ctx.name2) names.add(ctx.name2);
    if (ctx.groupId && Array.isArray(ctx.groups)) {
        const g = ctx.groups.find(x => x.id === ctx.groupId);
        for (const avatar of (g && g.members) || []) { const c = (ctx.characters || []).find(x => x.avatar === avatar); if (c) names.add(c.name); }
    }
    try { for (const n of speakers.knownNames() || []) names.add(n); } catch { /* 채팅 메타가 없으면 넘어감 */ }   // 배운 이름·팔레트 별명
    return [...names].filter(Boolean);
}
function segOpts(mes) {
    const s = settings();
    const ctx = getContext();
    return {
        skipTags: new Set(String(s.skip_tags || '').split(',').map(t => t.trim().toLowerCase()).filter(Boolean)),
        skipCode: !!s.skip_codeblocks,
        stripRegex: parseRegexLines(s.strip_regex),
        userName: ctx.name1,
        charName: (mes && !mes.is_user && mes.name) || ctx.name2,
        knownNames: knownNames(ctx),
        routes: s.routes,
        final: true,
    };
}
function segmentsOf(mes, text) {
    try {
        let t = String(text || '');
        try { t = substituteParams(t); } catch { /* 매크로 치환 실패는 무시 */ }
        return segmentMessage(t, segOpts(mes)) || [];
    } catch (e) { log('err', `문장 나누기 실패: ${e.message}`); return []; }
}

// ---------- 자동 읽기
function onRendered(id, isUser, type) {
    if (!runtimeEnabled()) return;
    const s = settings();
    const mes = msgOf(id);
    if (!mes || mes.is_system) return;
    const greeting = type === 'first_message';
    // 대화 색 → 말한 사람 배우기 (봇 메시지만, 읽기 여부와 무관, 원문 기준)
    // 인사말은 채팅을 막 연 경우에만: 그룹 채팅은 CHAT_CHANGED 보다 먼저 인사말을 그려서 메타가 아직 이전 채팅 것이다
    if (!isUser && s.enabled && (!greeting || Date.now() - chatChangedAt < FIRST_MS)) {
        // 5.6.4 이 렌더 뒤에 실리태번이 채팅을 저장하면 (보통 답장) 배운 표는 그 저장에 얹는다 — 1초 뒤 같은 채팅을 또 저장하지 않게
        try { speakers.learnFromMessage(mes, segmentsOf(mes, mes.mes), { deferSave: speakers.chatSavedAfterRender(id, type, getContext().streamingProcessor) }); }
        catch (e) { log('err', `말한 사람 배우기 실패: ${e.message}`); }
    }
    // 1.2.2 미리 만들기: 말한 사람을 배운 뒤, 자동 읽기와 상관없이 (다음 틱에 — 설정 · 마지막 메시지 · 인사말은 pregen 이 거름)
    if (!isUser) {
        try { pregen.onRendered(id, type); }
        catch (e) { log('err', `미리 만들기 실패: ${e.message}`); }
        // 6.2.3 색 없는 대사에 화자 색: 칠하고, 화자를 모르는 색 없는 대사가 있으면 대사 분석 한 번 (말한 사람을 배운 뒤)
        try { paint.onRendered(id, type); }
        catch (e) { log('err', `화자 색 실패: ${e.message}`); }
    }
    if (!s.enabled || !s.auto_play) return;
    if (isUser && !s.narrate_user) return;
    const text = String(mes.mes || '');
    if (!text.trim() || text === '...') return;
    const swipe = swipeOf(mes);
    const sig = `${id}:${swipe}:${hash(text)}`;
    if (spoken && spoken.sig === sig) return;          // 같은 내용을 두 번 그리면 한 번만
    const prev = spoken;
    spoken = { id, swipe, text, sig };
    // 인사말(채팅 열기·그룹 멤버별·카드 편집 뒤 다시 만들기)은 기억만 하고 읽지 않음 — 손으로 ▶ 나 /lv-read 는 됨
    if (greeting) return;
    // 스트리밍으로 읽던 메시지 → 아직 안 읽은 부분만
    if (stream && stream.id === id) { player.speakMessage(id, { fromStream: true }); return; }
    // 이어 쓰기: 같은 메시지·같은 스와이프가 앞부분 그대로 길어짐 → 달라진 문장부터
    let startSeg = 0;
    if (prev && prev.id === id && prev.swipe === swipe && text.length > prev.text.length && text.startsWith(prev.text.trimEnd())) {
        const a = segmentsOf(mes, prev.text), b = segmentsOf(mes, text);
        while (startSeg < a.length && b[startSeg] && a[startSeg].text === b[startSeg].text) startSeg++;
    }
    player.speakMessage(id, { startSeg });
}

// 스트리밍 중: 700 ms 에 한 번, 완성된 문장만 player 가 골라 읽음
// 이벤트가 주는 날글(text)을 쓴다 — chat[id].mes 는 ST 가 홀수 개의 " * 를 임시로 닫아 두어 덜 끝난 대화문이 닫힌 것처럼 보인다
function onStreamToken(text) {
    if (!runtimeEnabled()) return;
    const s = settings();
    if (!s.enabled || !s.auto_play || !s.stream_read) return;
    const sp = getContext().streamingProcessor;
    if (sp && (sp.type === 'quiet' || sp.type === 'impersonate')) return;
    const id = sp && Number.isInteger(sp.messageId) && sp.messageId >= 0 ? sp.messageId : chat.length - 1;
    if (id < 0) return;
    // 번역을 기다리는 설정이면 재생기가 스트리밍 읽기를 하지 않는다 → 스트리밍 표시도 남기지 않아 그려질 때 보통 답장처럼 (번역 → 분석 → 읽기)
    try { if (player.streamBlocked(id)) { if (stream && stream.id === id) stream = null; return; } }
    catch (e) { log('err', `스트리밍 확인 실패: ${e.message}`); }
    const raw = String(sp?.continueMessage ?? '') + String(text ?? '');   // 이어 쓰기: 앞글 + 새로 온 글
    if (!stream || stream.id !== id) stream = { id, raw }; else stream.raw = raw;
    const wait = STREAM_MS - (Date.now() - streamLast);
    if (wait <= 0) { clearTimeout(streamTimer); streamTimer = 0; pushStream(id); }
    else if (!streamTimer) streamTimer = setTimeout(() => { streamTimer = 0; pushStream(id); }, wait);
}
function pushStream(id) {
    if (!runtimeEnabled()) return;
    streamLast = Date.now();
    const mes = msgOf(id);
    if (!mes || mes.is_system || !mes.mes || mes.mes === '...') return;
    const raw = stream && stream.id === id && stream.raw ? stream.raw : String(mes.mes);
    try { player.onStreamProgress(id, raw); }
    catch (e) { log('err', `스트리밍 읽기 실패: ${e.message}`); }
}
function onGenStarted(type, _params, dryRun) {
    if (!runtimeEnabled()) return;
    if (dryRun || type === 'quiet' || type === 'impersonate') return;
    paint.onGenStarted();   // 6.2.3 생성 중인 마지막 메시지는 칠하지 않음
    genStartedAt = Date.now();
    clearTimeout(streamTimer); streamTimer = 0; streamLast = 0;
    stream = null;
    if (settings().on_new !== 'interrupt') return;
    // 방금 보낸 내 메시지를 읽는 중이면 끊지 않음 (답장이 오면 그때 on_new 규칙대로)
    const cur = player.currentMesId();
    const mes = msgOf(cur);
    if (mes && mes.is_user && cur === chat.length - 1) return;
    // 8.2.7 그룹 채팅은 한 차례에 캐릭터들이 차례로 답한다 — 다음 캐릭터의 생성이 시작될 때 이 차례의 앞 캐릭터 답을 끊지 않는다.
    //       예전엔 여기서 끊겨(번역 · 분석을 기다리던 것도) 마지막 캐릭터 답만 들렸다. 「끊고 읽기」는 다음 답이 그려질 때 그대로 (위 내 메시지와 같게)
    if (type === 'normal' && mes && !mes.is_user && inGroupTurn(cur)) return;
    player.stop();
}
function onGenEnded() {
    if (!runtimeEnabled()) return;
    paint.onGenEnded();
    clearTimeout(streamTimer); streamTimer = 0;
    if (!stream) return;
    const mes = msgOf(stream.id);
    if (!mes || !mes.mes) return;
    try { player.onStreamEnd(stream.id); }
    catch (e) { log('err', `스트리밍 마무리 실패: ${e.message}`); }
}
function onSwiped(mesId) {
    if (!runtimeEnabled()) return;
    player.stop();
    const at = Date.now();
    // 400 ms 안에 생성이 시작되면 새 스와이프 → 답장이 그려질 때 읽음 (미리 만들기도 그때)
    setTimeout(() => {
        if (!runtimeEnabled()) return;
        if (genStartedAt >= at) return;
        // 있는 스와이프로 넘김: 미리 만들기 (대개 캐시에 있음, 자동 읽기와 상관없이)
        try { pregen.onSwipedExisting(mesId); }
        catch (e) { log('err', `미리 만들기 실패: ${e.message}`); }
        const s = settings();
        if (!s.enabled || !s.auto_play || !s.swipe_read) return;
        const mes = msgOf(mesId);
        if (!mes || mes.is_system || (mes.is_user && !s.narrate_user)) return;
        const text = String(mes.mes || '');
        if (!text.trim() || text === '...') return;
        spoken = { id: mesId, swipe: swipeOf(mes), text, sig: `${mesId}:${swipeOf(mes)}:${hash(text)}` };
        player.speakMessage(mesId);
    }, SWIPE_MS);
}
function onDeleted() {
    if (!runtimeEnabled()) return;
    const cur = player.currentMesId();
    if (Number.isInteger(cur) && cur >= 0 && (cur >= chat.length || !document.querySelector(`#chat .mes[mesid="${cur}"]`))) player.stop();
    if (spoken && spoken.id >= chat.length) spoken = null;
    if (stream && stream.id >= chat.length) stream = null;
    // 지워진 메시지가 낸 표는 걷어내고, 번호가 밀린 메시지의 기록은 따라 옮긴다
    try { speakers.syncChat(); }
    catch (e) { log('err', `말한 사람 기록 정리 실패: ${e.message}`); }
}
// 7.0.2 캐릭터 이름 바꾸기: 이벤트 때는 실리태번이 아직 캐릭터 목록을 다시 읽기 전이라 옛 이름을 잡아 두고, 목록을 다시 읽은 뒤(다음 CHAT_CHANGED · 늦어도 몇 초)
//   새 아바타 카드의 이름으로 목소리 연결을 복사한다 (speakers.renameCharacterKeys — 색 기억은 바로 새 아바타로)
let pendingRename = null;
function onCharacterRenamed(oldAvatar, newAvatar) {
    try {
        const ctx = getContext();
        const oldName = (ctx.characters || []).find(c => c?.avatar === oldAvatar)?.name || '';
        const s = settings();
        if (speakers.renameCharacterKeys(s, { oldAvatar, newAvatar }).colors) save();
        pendingRename = { oldName, newAvatar, at: Date.now() };
        setTimeout(finishRename, 4000);
    } catch (e) { log('err', `이름 바꾸기 따라가기 실패: ${String(e?.message || e).slice(0, 40)}`); }
}
function finishRename() {
    const p = pendingRename;
    if (!p || Date.now() - p.at > 60000) { pendingRename = null; return; }
    const ctx = getContext();
    const card = (ctx.characters || []).find(c => c?.avatar === p.newAvatar);
    if (!card?.name) return;   // 아직 목록을 다시 안 읽음 — 다음 CHAT_CHANGED 에서
    pendingRename = null;
    const taken = [ctx.name1, ...(ctx.characters || []).filter(c => c?.avatar !== p.newAvatar).map(c => c?.name)].filter(Boolean);
    const out = speakers.renameCharacterKeys(settings(), { oldName: p.oldName, newName: card.name, taken });
    if (out.voices) { save(); globalThis.toastr?.info(`「${p.oldName}」의 목소리 연결을 새 이름 「${card.name}」에도 이어 두었어요.`, 'TTS', { timeOut: 4000 }); }
}
function onChatChanged() {
    if (pendingRename) { try { finishRename(); } catch { /* 다음에 */ } }
    if (!runtimeEnabled()) return;
    player.stop();
    spoken = null; stream = null; groupTurnFrom = -1;
    clearTimeout(streamTimer); streamTimer = 0; streamLast = 0;
    chatChangedAt = Date.now();
    addButtons();
    try { ui.refreshChat(); }
    catch (e) { log('err', `설정 화면 새로 고침 실패: ${e.message}`); }
    try { paint.onChatChanged(); }   // 6.2.3 다 그려진 뒤 칠하고 마지막 답장을 본다
    catch (e) { log('err', `화자 색 실패: ${e.message}`); }
    peopleChanged();   // 6.9.5 인물표는 채팅마다 (색 표가 채팅에 산다)
}
/** 6.9.5 인물표 공급자: 이 채팅의 대사 색(색 표) · 그 이름에 연결된 목소리 · TTS 별명표의 표기. TTS 가 꺼져 있으면 아무것도 주지 않는다 */
const peopleSource = {
    person(names) {
        if (!runtimeEnabled()) return null;
        let color = null, voice = null;
        const isUser = names.some(n => speakers.isPersonaName(n));
        for (const n of names) {
            color ??= speakers.colorOfName(n);
            voice ??= voices.linkedVoice(n, { isUser });
            if (color && voice) break;
        }
        return { names: speakers.namesOf(names[0]), color, voice: voice ? { uid: voice.uid, name: voice.name, provider: voice.provider, lang: voice.lang || '' } : null };
    },
    names() { return runtimeEnabled() ? speakers.peopleNames() : []; },
    stamp: () => [runtimeEnabled(), ...speakers.peopleInputs()],   // 7.2.8 인물표 기억 — 이 값이 같고 판(peopleStamp)이 같으면 같은 답
};
// 글이 바뀐 메시지(편집·스와이프·다시 그림): 저장된 대사 분석은 글 해시로 묶여 있어 analysis 쪽이 낡은 것을 걸러 낸다
function onMessageChanged(id) {
    if (!runtimeEnabled()) return;
    const n = Number(id);
    if (!Number.isInteger(n) || n < 0) return;
    try { analysis.onMessageChanged(n); }
    catch (e) { log('err', `분석 기록 정리 실패: ${e.message}`); }
}

// ---------- 메시지 버튼
// 8.2.7 메시지 하나에 읽기 · 소리 대본 단추 (없는 것만). 둘 다 없으면 한 번에 붙인다 — 결과 순서는 예전과 같다(읽기 · 대본 · 원래 단추)
function addButtonsTo(el) {
    const mes = msgOf(Number(el.getAttribute('mesid')));
    if (mes && mes.is_system) return;
    const box = el.querySelector('.extraMesButtons');
    if (!box) return;
    const add = [];
    if (!el.querySelector('.lv_play')) {
        const btn = document.createElement('div');
        btn.className = 'mes_button lv_play fa-solid fa-volume-high interactable';
        btn.tabIndex = 0;
        btn.setAttribute('role', 'button');
        btn.setAttribute('aria-label', '읽기');
        add.push(btn);
    }
    if (!el.querySelector('.lv_script')) {
        const edit = document.createElement('div');
        edit.className = 'mes_button lv_script fa-solid fa-file-audio interactable';
        edit.tabIndex = 0; edit.setAttribute('role', 'button'); edit.setAttribute('aria-label', '소리 대본 편집');
        // 읽기 단추가 이미 있으면 그 뒤가 아니라 맨 앞 (예전 순서: 대본을 먼저 맨 앞에 · 그다음 읽기를 맨 앞에)
        if (add.length) add.push(edit); else box.prepend(edit);
    }
    if (add.length) box.prepend(...add);
}
function addButtons() {
    if (!runtimeEnabled()) return;
    for (const el of document.querySelectorAll('#chat .mes')) addButtonsTo(el);
}
// 8.2.7 #chat 에 새로 붙은 메시지만 본다 — 예전엔 메시지 하나가 붙어도(답 하나 · 더 보기) 채팅 전체를 다시 훑었다 (붙이는 결과는 같다: 단추는 메시지와 함께만 사라진다)
function addButtonsFor(records) {
    if (!runtimeEnabled()) return;
    for (const record of records) for (const node of record.addedNodes) {
        if (node.nodeType !== 1) continue;
        if (node.classList.contains('mes')) addButtonsTo(node);
        else for (const el of node.querySelectorAll?.('.mes') || []) addButtonsTo(el);
    }
}
function onPlayClick(el) {
    if (!runtimeEnabled()) return;
    const id = Number(el.closest('.mes')?.getAttribute('mesid'));
    if (!Number.isInteger(id) || !chat[id]) return;
    if (player.currentMesId() === id) player.stop();       // 읽는 중이면 정지
    else player.speakMessage(id, { force: true });         // 꺼져 있어도 손으로 누르면 읽음
}

// ---------- 지팡이 메뉴 (설정 wand_menu: 끄면 두 줄을 뺀다 · 'tts:wand' 로 바로 반영)
// "TTS" 줄은 켜고 끄지 않고 빛나지도 않는다 — 누르면 확장 창을 열고 우리 설정 서랍으로 간다. "TTS 정지" 는 그대로 정지
/**
 * 확장 창(위 막대의 블록 아이콘 = #extensions-settings-button 의 .drawer-toggle → #rm_extensions_block)을 열고
 * TTS 서랍(.lv-settings .inline-drawer)이 닫혀 있으면 펼쳐 그 자리로 스크롤
 */
function openOwnSettings() { return openPanel(); }

function addWand() {
    const menu = document.getElementById('extensionsMenu');
    if (!menu || document.getElementById('lv_wand')) return;
    const item = (id, icon, label) => {
        const d = document.createElement('div');
        d.id = id;
        d.className = 'list-group-item flex-container flexGap5 interactable';
        d.tabIndex = 0;
        d.setAttribute('role', 'button');
        d.innerHTML = `<div class="fa-solid ${icon} extensionsMenuExtensionButton"></div><span>${label}</span>`;
        return d;
    };
    const wand = item('lv_wand', 'fa-volume-high', 'TTS');
    const stopItem = item('lv_wand_stop', 'fa-stop', 'TTS 정지');
    const onKey = (fn) => (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn(); } };
    wand.addEventListener('click', openOwnSettings);
    wand.addEventListener('keydown', onKey(openOwnSettings));
    stopItem.addEventListener('click', () => player.stop());
    stopItem.addEventListener('keydown', onKey(() => player.stop()));
    menu.append(wand, stopItem);
}
function removeWand() {
    for (const id of ['lv_wand', 'lv_wand_stop']) document.getElementById(id)?.remove();
}
/** 설정 wand_menu 에 맞춰 두 줄을 넣거나 뺀다 (ui.js 가 document 에 'tts:wand' { detail: { on } } 를 보냄) */
function syncWand(e) {
    const on = runtimeEnabled() && (typeof e?.detail?.on === 'boolean' ? e.detail.on : settings().wand_menu !== false);
    if (on) addWand(); else removeWand();
}

// ---------- 슬래시 명령 · 바깥 API
/** uid 또는 이름/다른 이름/voiceId → uid. 빈 값이면 '' , 못 찾으면 null */
function resolveVoiceUid(v) {
    const q = String(v ?? '').trim();
    if (!q) return '';
    if (voices.findVoice(q)) return q;
    const norm = (x) => String(x || '').toLowerCase().replace(/\s+/g, '');
    const nq = norm(q);
    const hit = voices.allVoices().find(x => norm(x.name) === nq || norm(x.voiceId) === nq || (x.aliases || []).some(a => norm(a) === nq));
    return hit ? hit.uid : null;
}
function addSlashCommands() {
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'lv',
        callback: (args, value) => {
            const text = String(value ?? '').trim();
            if (!text) return '';
            const uid = resolveVoiceUid(args.voice);
            if (uid === null) { toast(`목소리를 못 찾았어요: ${args.voice}`, 'warning'); return ''; }
            // 다 읽을 때까지 기다리지 않는다 (스크립트가 막히지 않게); 실패는 재생기가 토스트로 알림
            Promise.resolve(player.speakText(text, uid)).catch(() => { /* 재생기가 알림 */ });
            return '';
        },
        namedArgumentList: [SlashCommandNamedArgument.fromProps({ name: 'voice', description: '목소리 uid 또는 이름', typeList: [ARGUMENT_TYPE.STRING] })],
        unnamedArgumentList: [SlashCommandArgument.fromProps({ description: '읽을 글', typeList: [ARGUMENT_TYPE.STRING], isRequired: true })],
        helpString: 'TTS로 글 읽기. 예: <code>/lv voice=안내 안녕</code>',
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'lv-stop',
        callback: () => { player.stop(); return ''; },
        helpString: 'TTS 정지',
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'lv-read',
        callback: (_args, value) => {
            const raw = String(value ?? '').trim();
            const id = raw ? Number(raw) : chat.length - 1;
            if (!Number.isInteger(id) || !chat[id]) { toast('없는 메시지 번호예요', 'warning'); return ''; }
            player.speakMessage(id, { force: true, noWait: true });   // 명령은 번역을 기다리지 않음
            return '';
        },
        unnamedArgumentList: [SlashCommandArgument.fromProps({ description: '메시지 번호 (비우면 마지막)', typeList: [ARGUMENT_TYPE.NUMBER] })],
        helpString: '메시지를 TTS로 읽기. 예: <code>/lv-read 12</code>',
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'lv-analyze',
        callback: (_args, value) => {
            const raw = String(value ?? '').trim();
            const id = raw ? Number(raw) : chat.length - 1;
            if (!Number.isInteger(id) || !chat[id]) { toast('없는 메시지 번호예요', 'warning'); return ''; }
            Promise.resolve(player.reanalyze(id)).catch(() => { /* 재생기가 알림 */ });
            return '';
        },
        unnamedArgumentList: [SlashCommandArgument.fromProps({ description: '메시지 번호 (비우면 마지막)', typeList: [ARGUMENT_TYPE.NUMBER] })],
        helpString: '메시지의 대사를 다시 분석 (감정 · 원어 읽기). 예: <code>/lv-analyze 12</code>',
    }));
}

// ---------- 시작
export const ready = new Promise((resolve, reject) => jQuery(() => { (async () => {
    if (hasOtherOwner()) { duplicate = true; setRuntimeEnabled(false); return; }
    globalThis[OWNER] = 'builtin';
    syncEnabled();
    settings();   // 1.0.0 설정 옮기기까지 여기서 끝남

    // 설정 화면
    let html = '';
    try { html = await $.get(`${PATH}/settings.html`); }
    catch (e) { console.error('[tts] settings.html 로드 실패', e); log('err', 'settings.html 로드 실패'); }
    if (!html) throw new Error('TTS 설정 화면을 불러오지 못했어요.');
    holder = document.createElement('div'); holder.id = 'bl-tts-holder'; holder.hidden = true;
    document.body.append(holder); holder.innerHTML = html; root = holder.querySelector('#lv_settings');
    if (!root) throw new Error('TTS 설정 화면 형식이 달라요.');
    root.querySelector('.lv-version')?.addEventListener('click', event => {
        event.preventDefault(); event.stopPropagation();
        import('./guide.js').then(module => module.showTtsGuide()).catch(error => console.error('[TTS] 사용법 열기 실패', error));
    });
    try { ui.init(); }
    catch (e) { console.error('[tts] 설정 화면 초기화 실패', e); log('err', `설정 화면 초기화 실패: ${e.message}`); }
    try { player.init(); }
    catch (e) { console.error('[tts] 재생기 초기화 실패', e); log('err', `재생기 초기화 실패: ${e.message}`); }
    try { paint.init(); } catch (e) { log('err', `화자 색 시작 실패: ${e.message}`); }   // 6.2.3 색 없는 대사에 화자 색 (#chat 관찰)
    try { clickplay.init(); }                                      // 재생기 다음에 (대사 클릭 → player.speakSegments)
    catch (e) { console.error('[tts] 대사 클릭 초기화 실패', e); log('err', `대사 클릭 초기화 실패: ${e.message}`); }
    try { namevoice.init(); } catch (e) { log('err', `이름 목소리 고르기 시작 실패: ${e.message}`); }   // 6.3.6 이름 꾹 눌러 목소리 고르기
    try { pregen.init(); }                                         // 미리 만들기: 그만두기 · 다시 (시작은 onRendered · onSwiped)
    catch (e) { console.error('[tts] 미리 만들기 초기화 실패', e); log('err', `미리 만들기 초기화 실패: ${e.message}`); }
    try { modelswitch.init(); }                                    // 1.2.3 모델 전환(Blue Lemonade)에 대사 분석 등록 (늦게 뜨면 다시 시도)
    catch (e) { console.error('[tts] 모델 전환 등록 실패', e); log('err', `모델 전환 등록 실패: ${e.message}`); }

    initialized = true; syncEnabled();
    registerPeopleSource('tts', peopleSource);   // 6.9.5 인물표
    document.addEventListener('tts:wand', syncWand);
    if (event_types.APP_READY) eventSource.on(event_types.APP_READY, () => { syncWand(); syncVisibility(); });   // 메뉴·확장 탭이 늦게 생긴 경우

    // 메시지 버튼
    $(document).on('click', '#chat .mes .lv_play', function () { onPlayClick(this); });
    $(document).on('keydown', '#chat .mes .lv_play', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPlayClick(this); } });
    const openScript = el => { if (!runtimeEnabled()) return; const id = Number(el.closest('.mes')?.getAttribute('mesid')); if (!chat[id]) return; import('./src/script-editor.js').then(m => m.openScriptEditor(id)).catch(e => toast(e?.message || '소리 대본을 열지 못했어요', 'error')); };
    $(document).on('click', '#chat .mes .lv_script', function (e) { e.stopPropagation(); openScript(this); });
    $(document).on('keydown', '#chat .mes .lv_script', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); openScript(this); } });
    const chatEl = document.getElementById('chat');
    if (chatEl) new MutationObserver(addButtonsFor).observe(chatEl, { childList: true });
    addButtons();

    // 이벤트
    eventSource.makeLast(event_types.CHARACTER_MESSAGE_RENDERED, (id, type) => onRendered(Number(id), false, type));
    eventSource.makeLast(event_types.USER_MESSAGE_RENDERED, (id) => onRendered(Number(id), true, ''));
    eventSource.on(event_types.STREAM_TOKEN_RECEIVED, onStreamToken);
    eventSource.on(event_types.GENERATION_STARTED, onGenStarted);
    eventSource.on(event_types.GENERATION_ENDED, onGenEnded);
    eventSource.on(event_types.GENERATION_STOPPED, onGenEnded);
    // 8.2.7 그룹 차례 — 조용한 생성 · 대신 쓰기는 차례가 아니다
    if (event_types.GROUP_WRAPPER_STARTED) eventSource.on(event_types.GROUP_WRAPPER_STARTED, (e) => { groupTurnFrom = e?.type === 'quiet' || e?.type === 'impersonate' ? -1 : chat.length; });
    if (event_types.GROUP_WRAPPER_FINISHED) eventSource.on(event_types.GROUP_WRAPPER_FINISHED, () => { groupTurnFrom = -1; });
    eventSource.on(event_types.MESSAGE_SWIPED, (id) => onSwiped(Number(id)));
    eventSource.on(event_types.MESSAGE_DELETED, onDeleted);
    eventSource.on(event_types.CHAT_CHANGED, onChatChanged);
    if (event_types.CHARACTER_RENAMED) eventSource.on(event_types.CHARACTER_RENAMED, onCharacterRenamed);   // 7.0.2
    // 대사 분석 캐시 정리 (CHAT_CHANGED 는 필요 없음: 분석은 채팅 extra 에 산다)
    eventSource.on(event_types.MESSAGE_EDITED, onMessageChanged);
    eventSource.on(event_types.MESSAGE_SWIPED, onMessageChanged);
    eventSource.on(event_types.MESSAGE_UPDATED, onMessageChanged);

    addSlashCommands();

    // 다른 스크립트용
    window.LemonVoice = Object.freeze({
        version: VERSION,
        speakText: (text, voice) => player.speakText(String(text ?? ''), resolveVoiceUid(voice) || ''),
        // 1.5.5 다른 확장의 글을 채팅 메시지와 똑같은 길로 (분석 · 효과음 · 듣는 언어까지 TTS 설정 그대로) — { text, name?, isUser?, only?: { text, index } } 또는 글 하나
        readText: (opts) => player.speakExternal(opts && typeof opts === 'object' ? opts : { text: opts }),
        stop: () => player.stop(),
        // 6.1.8 다른 확장용: 화자의 목소리 · 소리만 받기(재생 없음, ArrayBuffer) · 목소리 목록. 실패는 Error.code (disabled · no-voice · engine · aborted)
        voiceOf: (opts) => player.voiceOfName(opts && typeof opts === 'object' ? opts : { name: opts }),
        synth: (opts) => player.synthForExternal(opts && typeof opts === 'object' ? opts : { text: opts }),
        voices: () => player.voiceListPublic(),
        // 1.9.0 다른 확장용 통화 소리 효과 (목소리 필터 · 생활 소음, WebAudio 노드) — 부를 때만 불러온다. src/fx-call.js
        callFx: () => import('./src/fx-call.js'),
    });
    setTimeout(() => verifyAddonCss({ folder: 'tts', name: '--lv-css-version', version: VERSION, title: 'TTS', selector: '.lv-settings' }), 3000);
    // 7.0.2 발음 사전 · 음소거 낱말을 다른 기기의 옛 설정 저장에 잃지 않게 — 칸마다 고친 시각(field_stamps)이 늦은 쪽 (../list-sync.js)
    try { registerAddonMerge('tts', { module: 'lemon_voice', store: () => extension_settings.lemon_voice, text: SYNC_TEXT_FIELDS, stampKey: 'field_stamps', save: saveSettingsDebounced, onChange: () => { invalidatePeople(); try { ui.refreshChat?.(); } catch { /* 설정 화면 없음 */ } } }); }
    catch (e) { log('err', `기기 간 합치기 실패: ${String(e?.message || e).slice(0, 40)}`); }
})().then(resolve, reject); }));
