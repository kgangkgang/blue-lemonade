// 장시간 메모리 시험용 모듈 길잡이 — 테마 밖(실리태번 본체: script.js · popup.js · extensions.js …)을 가리키는 import 를 가짜 모듈로 바꾼다.
//   tools/tests/chat-switch-leak.mjs 가 module.register 로 건다. 가짜 모듈의 이름은 테마 소스가 그 파일에서 가져오는 이름을 미리 훑어 만든다.
//   값은 실행 때 globalThis.__leakHost(이름) 가 준다 (실리태번 흉내 ctx 에 있으면 그것, 없으면 무엇이든 되는 빈 흉내).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

let root = '';
const names = new Map();   // 테마 밖 절대 경로 → Set(이름)
const DEFAULTS = ['eventSource', 'event_types', 'saveSettingsDebounced', 'saveSettings', 'getRequestHeaders', 'chat', 'characters', 'this_chid', 'name1', 'name2', 'chat_metadata', 'extension_settings', 'extensionNames', 'power_user', 'main_api',
    'online_status', 'model_list', 'oai_settings', 'secret_state', 'SECRET_KEYS', 'callGenericPopup', 'POPUP_TYPE', 'POPUP_RESULT', 'Popup', 'getContext', 'renderExtensionTemplateAsync', 'settingsReady', 'getCurrentUserHandle', 'getStringHash',
    'world_names', 'selected_group', 'groups', 'DEFAULT_SAVE_EDIT_TIMEOUT', 'promptManager', 'substituteParams', 'getThumbnailUrl', 'isMobile', 'debounce', 'delay', 'uuidv4', 'escapeHtml'];

export async function initialize(data) {
    root = path.resolve(data.root);
    const files = [];
    (function walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) { if (!/^(node_modules|\.git|tools|docs)$/.test(e.name)) walk(p); } else if (/\.m?js$/.test(e.name)) files.push(p); } })(root);
    for (const file of files) {
        const text = fs.readFileSync(file, 'utf8');
        for (const m of text.matchAll(/import\s*(?:([\w$]+)\s*,?\s*)?(?:\{([^}]*)\}|\*\s+as\s+[\w$]+)?\s*from\s*['"](\.{1,2}\/[^'"]+)['"]/g)) {
            const abs = path.resolve(path.dirname(file), m[3]);
            if (abs.startsWith(root + path.sep)) continue;
            const set = names.get(abs) || names.set(abs, new Set()).get(abs);
            if (m[1]) set.add('default');
            for (const part of (m[2] || '').split(',')) { const n = part.trim().split(/\s+as\s+/)[0].trim(); if (n) set.add(n); }
        }
    }
}

export async function resolve(specifier, context, next) {
    if (context.parentURL?.startsWith('file:') && /^\.{1,2}\//.test(specifier)) {
        const parent = fileURLToPath(context.parentURL);
        const abs = path.resolve(path.dirname(parent), specifier.split('?')[0]);
        if (parent.startsWith(root) && !abs.startsWith(root + path.sep)) return { url: 'leakstub:' + pathToFileURL(abs).href, shortCircuit: true };
    }
    if (/^\/(scripts|lib|css)\//.test(specifier)) return { url: 'leakstub:' + specifier, shortCircuit: true };
    return next(specifier, context);
}

export async function load(url, context, next) {
    if (process.env.LEAK_MODLOG && url.startsWith('file:') && fileURLToPath(url).startsWith(root + path.sep) && !fileURLToPath(url).includes(path.sep + 'tools' + path.sep)) fs.appendFileSync(process.env.LEAK_MODLOG, path.relative(root, fileURLToPath(url)).split(path.sep).join('/') + '\n');
    if (!url.startsWith('leakstub:')) return next(url, context);
    const target = url.slice('leakstub:'.length);
    let abs = ''; try { abs = fileURLToPath(target); } catch { /* /scripts/… */ }
    const list = new Set([...DEFAULTS, ...(names.get(abs) || [])]);
    list.delete('default');
    const valid = [...list].filter(n => /^[A-Za-z_$][\w$]*$/.test(n));
    const source = valid.map(n => `export const ${n} = globalThis.__leakHost(${JSON.stringify(n)});`).join('\n') + `\nexport default globalThis.__leakHost('default');\n`;
    return { format: 'module', source, shortCircuit: true };
}
