// 6.7.0 진단 파일 만들기 (채팅 › 기타 › 진단). 제보할 때 이 JSON 하나만 받으면 원인을 바로 찾게:
//   판(테마 · 애드온 · 실리태번) · 켜진 기능 이름 · 최근 블루레몬에이드 오류 · 고른 메시지 하나의 원문 · 번역문 · 추론 길이 · 번역 검사 결과.
// 넣지 않는 것: API 키 · 주소 · 개인 설정 값(글자 · 숫자 값은 빼고 켜짐만) · 채팅의 다른 메시지 · 인물 이름 · 추론 글.
// 무엇을 넣는지 창에 먼저 보여 주고, 메시지 글은 스위치로 뺄 수 있다. 누를 때만 이 파일을 불러온다.
import { getSettings } from './settings.js';
import { currentVersion } from './notice.js';
import { recentErrors } from './diag-errors.js';
import { addonVersions } from './addon-versions.js';

const SCHEMA = 1;

/** 설정에서 켜진 스위치 경로만 (값이 true 인 것). 글자 · 숫자 · 색 같은 값은 넣지 않는다 */
export function enabledPaths(value, prefix = '', out = [], depth = 0) {
    if (!value || typeof value !== 'object' || Array.isArray(value) || depth > 3) return out;
    for (const [key, item] of Object.entries(value)) {
        const path = prefix ? `${prefix}.${key}` : key;
        if (item === true) out.push(path);
        else if (item && typeof item === 'object' && !Array.isArray(item)) enabledPaths(item, path, out, depth + 1);
    }
    return out;
}

const count = (text, mark) => String(text ?? '').split(mark).length - 1;
const BRACKETS = ['「', '」', '『', '』', '“', '”'];
const THINK = /<(think|thinking|ECoT|reasoning)\b[^>]*>[\s\S]*?<\/\1\s*>/gi;
const paragraphs = text => String(text ?? '').split(/\n[\t ]*\n/).filter(p => p.trim()).length;

/**
 * 메시지 하나의 검사 결과 (번역기 판정 함수를 그대로 쓴다 — seg = translation-segments.js 모듈).
 * withText 가 거짓이면 글은 넣지 않고 길이 · 판정만.
 */
export function messageReport(message, index, seg, { withText = true } = {}) {
    if (!message) return null;
    const original = String(message.mes ?? ''), translation = typeof message.extra?.display_text === 'string' ? message.extra.display_text : '';
    const reasoning = String(message.extra?.reasoning ?? '');
    const thinkInText = (original.match(THINK) || []).reduce((sum, block) => sum + block.length, 0);
    const has = !!translation;
    const report = {
        index,
        isUser: !!message.is_user,
        swipes: Array.isArray(message.swipes) ? message.swipes.length : 0,
        lengths: { original: original.length, translation: translation.length, reasoning: reasoning.length, thinkBlockInText: thinkInText },
        paragraphs: { original: paragraphs(original), translation: has ? paragraphs(translation) : 0 },
        checks: {
            hasTranslation: has,
            translationEdited: !!message.extra?.translation_edited,
            streamCut: !!message.extra?.stream_cut,
            comments: { original: count(original, '<!--'), translation: count(translation, '<!--') },
            openComment: has && typeof seg?.openCommentAt === 'function' ? seg.openCommentAt(translation) >= 0 : null,
            brokenComments: has && typeof seg?.brokenComments === 'function' ? seg.brokenComments(original, translation) : null,
            looksCutShort: has && typeof seg?.looksCutShort === 'function' ? seg.looksCutShort(original, translation) : null,
            brackets: Object.fromEntries(BRACKETS.map(b => [b, [count(original, b), count(translation, b)]])),
            bracketsMissing: has && typeof seg?.restoreDialogueBrackets === 'function' ? seg.restoreDialogueBrackets(original, translation) !== translation : null,
        },
    };
    if (withText) { report.original = original; report.translation = translation; }
    return report;
}

/** 파일 본문 (순수 — 검사에서 그대로 부른다) */
export function buildDiagnosisFile({ versions, features, errors = [], environment = {}, message = null, now = new Date() }) {
    return { kind: 'blue-lemonade-diagnosis', schema: SCHEMA, createdAt: now.toISOString(), versions, environment, features, errors, message };
}

const short = (ua) => String(ua || '').match(/(?:Edg|OPR|SamsungBrowser|Firefox|Chrome|Version)\/[\d.]+/g)?.join(' ') || '';

async function collect(ctx) {
    const s = getSettings();
    const stVersion = await fetch('/version').then(r => r.ok ? r.json() : null).then(v => v?.pkgVersion || '').catch(() => '');
    const addons = await addonVersions(s.addons || {});
    let extensions = [];
    try {
        const ext = await import('/scripts/extensions.js');
        const disabled = new Set(ctx.extensionSettings?.disabledExtensions || []);
        extensions = (ext.extensionNames || []).filter(n => !disabled.has(n)).map(n => n.replace(/^third-party\//, ''));
    } catch { /* 실리태번 구조가 다르면 목록 없이 */ }
    const css = getComputedStyle(document.documentElement).getPropertyValue('--bl-release').trim().replace(/["']/g, '');
    return {
        versions: { blueLemonade: currentVersion() || '', style: css, sillyTavern: stVersion, addons: Object.fromEntries(addons.map(a => [a.id, a.version])) },
        environment: { browser: short(navigator.userAgent), mobile: /Android|iPhone|iPad/i.test(navigator.userAgent), screen: `${innerWidth}x${innerHeight}@${devicePixelRatio}`, standalone: matchMedia('(display-mode: standalone)').matches },
        features: {
            usageMode: ['both', 'theme', 'extensions'].includes(s.usageMode) ? s.usageMode : 'both',
            addonsOn: addons.filter(a => a.on).map(a => a.id).concat(Object.keys(s.addons || {}).filter(id => s.addons[id] === true && !addons.some(a => a.id === id))),
            scriptsOn: Object.entries(ctx.extensionSettings?.blue_lemonade_scripts?.enabled || {}).filter(([, on]) => on === true).map(([id]) => id),
            switchesOn: enabledPaths(s).filter(path => !path.startsWith('addons.')),
            otherExtensions: extensions,
        },
    };
}

function defaultIndex(chat) {
    for (let i = chat.length - 1; i >= 0; i--) if (!chat[i]?.is_user && chat[i]?.extra?.display_text) return i;
    for (let i = chat.length - 1; i >= 0; i--) if (!chat[i]?.is_user && !chat[i]?.is_system) return i;
    return chat.length - 1;
}

const stamp = (d) => `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}-${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}`;

function download(data, name) {
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: name });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
}

/** 창: 넣는 항목을 보여 주고 확인을 받은 뒤 내려받기 */
export async function openDiagFile() {
    const ctx = SillyTavern.getContext();
    const chat = Array.isArray(ctx.chat) ? ctx.chat : [];
    const errors = recentErrors();
    const seg = await import('./addons/translator/translation-segments.js').catch(() => null);
    let index = chat.length ? defaultIndex(chat) : -1;
    const box = document.createElement('div');
    box.className = 'bl-diag-file';
    box.innerHTML = `<h3>진단 파일 만들기</h3>
        <p class="salty-note">아래 항목만 JSON 파일 하나로 내려받아요. API 키 · 주소 · 설정 값 · 다른 메시지 글은 넣지 않아요.</p>
        <ul class="bl-diag-items">
            <li>블루레몬에이드 · 애드온 · 실리태번 판</li>
            <li>켜진 기능 이름 (값은 빼요) · 켜진 다른 확장 이름</li>
            <li>최근 블루레몬에이드 오류 ${errors.length}개 (주소 · 키는 가려요)</li>
            <li>화면 크기 · 브라우저 종류</li>
        </ul>
        ${chat.length ? `<div class="salty-row bl-diag-msg"><span>메시지 하나의 원문 · 번역문<small data-diag-info></small></span><label class="salty-switch"><input type="checkbox" data-diag-text checked aria-label="메시지 글 넣기"><span></span></label></div>
        <div class="salty-row bl-diag-pick"><span>메시지 번호<small>0 ~ ${chat.length - 1} · 길이와 번역 검사 결과는 늘 넣어요</small></span><input type="number" class="text_pole" data-diag-index min="0" max="${chat.length - 1}" value="${index}" inputmode="numeric" aria-label="메시지 번호"></div>` : '<p class="salty-note">채팅을 열면 메시지 하나의 번역 검사도 넣을 수 있어요.</p>'}`;
    const info = box.querySelector('[data-diag-info]'), input = box.querySelector('[data-diag-index]'), withText = box.querySelector('[data-diag-text]');
    const paint = () => {
        if (!info) return;
        const m = chat[index];
        if (!m) { info.textContent = '그 번호의 메시지가 없어요'; return; }
        const r = messageReport(m, index, seg, { withText: false });
        info.textContent = `${r.isUser ? '내 메시지' : '캐릭터 답'} · 원문 ${r.lengths.original.toLocaleString()}자 · 번역문 ${r.lengths.translation.toLocaleString()}자 · 추론 ${r.lengths.reasoning.toLocaleString()}자(글은 안 넣음)`;
    };
    input?.addEventListener('input', () => { const n = Number.parseInt(input.value, 10); index = Number.isFinite(n) ? n : -1; paint(); });
    paint();
    const ok = await ctx.callGenericPopup(box, ctx.POPUP_TYPE.CONFIRM, '', { okButton: '내려받기', cancelButton: '취소', onOpen: popup => popup?.dlg?.classList.add('bl-roomy-dialog') });
    if (ok !== ctx.POPUP_RESULT.AFFIRMATIVE) return false;
    const base = await collect(ctx);
    const data = buildDiagnosisFile({ ...base, errors, message: chat[index] ? messageReport(chat[index], index, seg, { withText: !!withText?.checked }) : null });
    download(data, `blue-lemonade-diag-${stamp(new Date())}.json`);
    toastr.success('진단 파일을 내려받았어요. 이 파일을 그대로 보내 주면 돼요', 'Blue Lemonade');
    return true;
}
