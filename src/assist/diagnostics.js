import { knownConflicts, DUPLICATES } from './core.js';
import { context } from './state.js';
import { getSettings } from '../settings.js';
import { customCssReport } from '../diagnose.js';
import { checkInstallation } from '../install-health.js';
// Error messages/stacks can contain prompts or credentials. Keep only error class and extension folder.
const errors = [];
let listening = false;
const errorHandler = event => {
    const raw = String(event.filename || event.reason?.stack || '');
    const folder = raw.match(/\/extensions\/third-party\/([a-zA-Z0-9_-]{1,80})\//)?.[1] || '출처 미확인';
    const kind = String(event.error?.name || event.reason?.name || 'Error').replace(/[^a-zA-Z]/g, '').slice(0, 40) || 'Error';
    errors.push({ folder, kind }); errors.splice(0, Math.max(0, errors.length - 20));
};
export function syncDiagnostics(on) {
    if (on === listening) return; listening = on;
    for (const name of ['error', 'unhandledrejection']) window[on ? 'addEventListener' : 'removeEventListener'](name, errorHandler);
}
// 5.4.4 같은 방향(받은 답 · 보낼 글)을 자동 번역하는 번역기 이름들. 둘 이상이면 같은 메시지를 두 번 번역한다.
// 예전엔 마지막 메시지의 [class*="translate"] 단추를 셌다 — 내장 LLM 번역(mes_legacy_translate)과 실리태번 기본 번역(mes_translate)
// 단추가 늘 같이 잡혀 LLM 번역만 켜도 '여러 개'로 경고했고, 접힌 ··· 메뉴 안의 폭 0 단추까지 셌다. 이제 켜진 확장 · 자동 번역 설정을 본다
function autoTranslators(names, disabled, settings, ext) {
    const active = new Set(names.filter(n => !disabled.includes(n)).map(n => n.replace(/^third-party\//, '')));
    const found = [];
    // 실리태번 기본 번역(translate): none · responses · inputs · both
    const core = active.has('translate') ? ext.translate?.auto_mode : null;
    if (core && core !== 'none') found.push({ name: '실리태번 번역', incoming: core === 'responses' || core === 'both', outgoing: core === 'inputs' || core === 'both' });
    // LLM 번역: 내장 기능과 단독 확장이 같은 설정(llm-translator-custom)을 쓴다 (둘이 함께 켜진 것은 duplicate-translator 가 따로 알림). none · all · ai · user
    const llmOn = !!settings.addons?.translator || DUPLICATES.translator.some(folder => active.has(folder));
    const llm = llmOn ? (ext['llm-translator-custom'] ?? ext['llm-translator'])?.auto_mode : null;
    if (llm && llm !== 'none') found.push({ name: 'LLM 번역', incoming: llm === 'all' || llm === 'ai', outgoing: llm === 'all' || llm === 'user' });
    const clash = ['incoming', 'outgoing'].some(way => found.filter(t => t[way]).length > 1);
    return clash ? found.map(t => t.name) : [];
}
export async function diagnose() {
    const { extensionNames = [] } = await import('/scripts/extensions.js');
    const settings = getSettings(), ctx = context();
    const disabled = ctx.extensionSettings.disabledExtensions || [];
    const rows = knownConflicts(extensionNames, disabled, settings.addons);
    const css = customCssReport();
    if (css.chat.length) rows.push({ code: 'custom-css', level: '가능성', text: `커스텀 CSS ${css.chat.length}개 규칙이 채팅 화면을 바꿔요. 화면 문제와 관련될 수 있어요.` });
    const translators = autoTranslators(extensionNames, disabled, settings, ctx.extensionSettings);
    if (translators.length > 1) rows.push({ code: 'translators', level: '확인됨', text: `자동 번역이 두 곳에서 켜져 있어요 (${translators.join(' · ')}). 같은 메시지를 두 번 번역할 수 있어요.` });
    const health = await checkInstallation(false);
    if (health.disk && (health.disk !== health.version || health.css !== health.version)) rows.push({ code: 'version-mismatch', level: '확인됨', text: `설치 버전이 달라요. JS ${health.version} / CSS ${health.css || '?'} / manifest ${health.disk}` });
    if (health.error) rows.push({ code: 'unreadable', level: '확인 불가', text: health.error });
    for (const e of errors) rows.push({ code: 'runtime', level: '오류 관측', text: `${e.folder}: ${e.kind} 발생. 충돌 원인인지는 미확정이에요.` });
    if (!rows.length) rows.push({ code: 'none', level: '점검 완료', text: '알려진 중복 실행이나 관측된 오류가 없어요.' });
    // Copy-safe by construction: no arbitrary settings, URLs, chat, selectors, or error messages.
    const report = ['블루 레몬에이드 확장 진단', `테마 ${health.version} · 화면 ${innerWidth}×${innerHeight}`, `활성 확장 ${extensionNames.filter(n => !disabled.includes(n)).length}개`, ...rows.map(r => `[${r.level}] ${r.text}`)].join('\n');
    return { rows, report };
}
