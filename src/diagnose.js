// 4.7.1 진단 한 줄 복사 + 커스텀 CSS 가 채팅 메시지 칸을 건드리는지 (제보 받을 때 처음 묻는 것들을 한 번에)
// 2026-09-23 "세로 폰에서 연필 버튼이 화면 밖" 제보는 사용자 커스텀 CSS 가 원인이었는데 그걸 아는 데 반나절이 걸렸다.
import { getSettings } from './settings.js';
import { currentVersion } from './notice.js';

// 메시지 칸을 그리는 선택자 — 여기 걸리는 커스텀 CSS 는 테마 모양을 깨뜨릴 수 있다
const CHAT = /#chat\b|#sheld\b|#form_sheld\b|#send_form\b|\.mes\b|\.mes_|\.mesAvatarWrapper|\.ch_name|\.name_text|\.timestamp\b|\.swipe|\.extraMesButtons|\.avatar\b|\.last_mes/;

/** 커스텀 CSS 를 대충 쪼개 규칙 수와 메시지 칸을 건드리는 선택자를 센다 (정확한 파서는 아니지만 제보용으로 충분) */
export function customCssReport(css = SillyTavern.getContext().powerUserSettings?.custom_css || '') {
    const text = String(css || '');
    const lines = text.split('\n').filter(line => line.trim()).length;
    const chat = [];
    let rules = 0;
    // 주석 · @media 껍데기를 벗기고 "선택자 { … }" 조각만 본다
    const body = text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/@[^{]+\{/g, '');
    for (const match of body.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
        const selector = match[1].replace(/\s+/g, ' ').trim();
        if (!selector || selector.startsWith('@')) continue;
        rules++;
        if (CHAT.test(selector)) chat.push(selector.length > 60 ? selector.slice(0, 57) + '…' : selector);
    }
    return { lines, rules, chat };
}

const short = (s) => String(s || '').replace(/^.*?(Chrome\/[\d.]+|Firefox\/[\d.]+|Version\/[\d.]+).*$/, '$1');

/** 제보에 붙여 넣을 한 덩어리 — 버전 · 화면 · 실리태번 표시 옵션 · 테마 모드 · 커스텀 CSS · 확장 */
export async function buildDiagnosis() {
    const s = getSettings();
    const ctx = SillyTavern.getContext();
    const stVersion = await fetch('/version').then(r => r.ok ? r.json() : null).then(v => v ? `${v.pkgVersion}${v.gitBranch ? ` ${v.gitBranch}` : ''}${v.gitRevision ? ` ${String(v.gitRevision).slice(0, 7)}` : ''}` : '?').catch(() => '?');
    const body = document.body.classList;
    const flags = ['hideChatAvatars', 'expandMessageActions', 'bubblechat', 'documentstyle', 'no-timestamps', 'no-mesIDDisplay', 'no-timer', 'no-tokenCount', 'waifuMode', 'movingUI'].filter(c => body.contains(c));
    const css = customCssReport();
    let extensions = '?';
    try {
        const ext = await import('/scripts/extensions.js');
        const disabled = new Set(ctx.extensionSettings?.disabledExtensions || []);
        extensions = (ext.extensionNames || []).filter(n => !disabled.has(n)).map(n => n.replace(/^third-party\//, '')).join(', ') || '없음';
    } catch { /* 실리태번 구조가 다르면 목록 없이 */ }
    const addons = Object.entries(s.addons || {}).filter(([, on]) => on).map(([id]) => id).join(', ') || '없음';
    const scripts = Object.entries(ctx.extensionSettings?.blue_lemonade_scripts?.enabled || {}).filter(([, on]) => on).map(([id]) => id).join(', ') || '없음';
    const lines = [
        `블루 레몬에이드 ${currentVersion() || '?'} · 실리태번 ${stVersion} · ${short(navigator.userAgent)} · ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`,
        `화면 ${window.innerWidth}×${window.innerHeight} @${devicePixelRatio} ${window.innerWidth < window.innerHeight ? '세로' : '가로'} · 실리태번 표시: ${flags.join(' ') || '기본'} · 언어 ${ctx.powerUserSettings?.ui_language || navigator.language}`,
        `테마: 팔레트 ${s.palette}${s.customName ? `(${s.customName})` : ''} · 내 메시지 ${s.chat?.user} · 이름 줄 ${s.chat?.header} · 아이콘 ${s.chat?.icons} · 프로필 ${s.profile?.mode}/${s.profile?.headerLayout}/${s.profile?.nameAlign} · 내 프로필 ${s.userProfile?.mode} · 고정 버튼 ${(s.chat?.mesPins || []).length}개 · 좌우 여백 ${s.type?.gutter} · 날씨 ${s.chat?.weather}`,
        `커스텀 CSS ${css.lines}줄 ${css.rules}규칙${css.chat.length ? ` · 메시지 칸을 건드림 ${css.chat.length}개: ${css.chat.slice(0, 6).join(' | ')}${css.chat.length > 6 ? ' …' : ''}` : ' · 메시지 칸 무관'}${s.compat?.muteCustomCss ? ' · 테마가 끄는 중' : ''}`,
        `애드온 ${addons} · 스크립트 ${scripts}`,
        `확장 ${extensions}`,
    ];
    return lines.join('\n');
}
