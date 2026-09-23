import { knownConflicts } from './core.js';
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
export async function diagnose() {
    const { extensionNames = [] } = await import('/scripts/extensions.js');
    const settings = getSettings(), ctx = context();
    const disabled = ctx.extensionSettings.disabledExtensions || [];
    const rows = knownConflicts(extensionNames, disabled, settings.addons);
    const css = customCssReport();
    if (css.chat.length) rows.push({ code: 'custom-css', level: '가능성', text: `커스텀 CSS ${css.chat.length}개 규칙이 채팅 화면을 바꿔요. 화면 문제와 관련될 수 있어요.` });
    const buttons = [...document.querySelectorAll('#chat > .mes:last-child .mes_buttons [class*="translate"]')].filter(el => getComputedStyle(el).display !== 'none');
    if (buttons.length > 1) rows.push({ code: 'translators', level: '가능성', text: '번역 버튼이 여러 개 보여요. 자동 번역이 둘 이상 켜져 있는지 확인해 주세요.' });
    const health = await checkInstallation(false);
    if (health.disk && (health.disk !== health.version || health.css !== health.version)) rows.push({ code: 'version-mismatch', level: '확인됨', text: `설치 버전이 달라요. JS ${health.version} / CSS ${health.css || '?'} / manifest ${health.disk}` });
    if (health.error) rows.push({ code: 'unreadable', level: '확인 불가', text: health.error });
    for (const e of errors) rows.push({ code: 'runtime', level: '오류 관측', text: `${e.folder}: ${e.kind} 발생. 충돌 원인인지는 미확정이에요.` });
    if (!rows.length) rows.push({ code: 'none', level: '점검 완료', text: '알려진 중복 실행과 관측된 오류가 없어요. 모든 확장의 호환성을 보장하는 검사는 아니에요.' });
    // Copy-safe by construction: no arbitrary settings, URLs, chat, selectors, or error messages.
    const report = ['블루 레몬에이드 확장 진단', `테마 ${health.version} · 화면 ${innerWidth}×${innerHeight}`, `활성 확장 ${extensionNames.filter(n => !disabled.includes(n)).length}개`, ...rows.map(r => `[${r.level}] ${r.text}`)].join('\n');
    return { rows, report };
}
