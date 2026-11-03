// 1.0.0 극한 최적화: 첫 장(style.css)에서 「닫힌 서랍 · 테마 창 안에서만 맞는 규칙」을 빼요 — src/lite.js 가 그 서랍 · 창이 처음 열릴 때(LAZY_OPENERS · 상단 서랍 누름)
//   원래 차례 전체 시트(style-lazy.gen.css)로 바꿔 끼우니, 그 전까지 닫혀 있는(display:none) 칸 안의 규칙은 화면에 아무 영향이 없어요.
//   판단은 선택자 글만으로(정확): 갈래마다 괄호 묶음(:is · :where · :not · :has …)을 뺀 바깥 사슬에 서랍 · 창 표식이 있어야 하고, 하나라도 없으면 그대로 둬요.
//   표식 = src/lite.js LAZY_OPENERS 의 맨 오른쪽 칸(.salty-panel · .bl-*-dialog …) + 실리태번 위 막대 서랍과 그 안 칸 id. 전체 시트는 손대지 않아요.
'use strict';
const fs = require('fs');
const path = require('path');

// 실리태번 1.19 위 막대 서랍(.drawer-content)과 그 안에서만 쓰는 칸 — 닫히면 display:none
const DRAWER_TOKENS = ['.drawer-content', '.openDrawer', '#left-nav-panel', '#rm_api_block', '#AdvancedFormatting', '#WorldInfo', '#world_popup', '#user-settings-block', '#Backgrounds', '#bg_menu_content',
    '#rm_extensions_block', '#extensions_settings', '#extensions_settings2', '#PersonaManagement', '#right-nav-panel', '#rm_characters_block', '#rm_print_characters_block', '#rm_ch_create_block',
    '#completion_prompt_manager', '#completion_prompt_manager_popup', '#floatingPrompt', '#cfgConfig'];

/** src/lite.js LAZY_OPENERS 의 맨 오른쪽 칸에서 id · class 표식을 뽑아요(‘dialog[open] .salty-panel’ → ‘.salty-panel’) */
function openerTokens(liteFile) {
    const text = fs.readFileSync(liteFile, 'utf8');
    const m = /const LAZY_OPENERS = \[([\s\S]*?)\]\.join\(/.exec(text) || /const LAZY_OPENERS = \[([\s\S]*?)\];/.exec(text);
    if (!m) throw new Error('src/lite.js 에서 LAZY_OPENERS 를 찾지 못했어요');
    const out = new Set();
    for (const raw of m[1].match(/'[^']*'/g) || []) {
        const sel = raw.slice(1, -1).trim();
        const last = sel.split(/\s+/).pop();
        for (const tok of last.match(/[#.][\w-]+/g) || []) if (tok !== '.openDrawer') out.add(tok);
    }
    return [...out];
}
function scopeTokens(root) {
    return [...new Set([...DRAWER_TOKENS, ...openerTokens(path.join(root, 'src', 'lite.js'))])];
}

/** 괄호 묶음(중첩)을 지운 바깥 사슬 */
function outerChain(selector) {
    let out = '', depth = 0;
    for (const ch of selector) {
        if (ch === '(') { depth++; continue; }
        if (ch === ')') { depth = Math.max(0, depth - 1); continue; }
        if (!depth) out += ch;
    }
    return out;
}
function splitTop(text, sep) {
    const out = []; let depth = 0, quote = null, cur = '';
    for (const ch of text) {
        if (quote) { cur += ch; if (ch === quote) quote = null; continue; }
        if (ch === '"' || ch === "'") { quote = ch; cur += ch; continue; }
        if (ch === '(' || ch === '[') depth++;
        if (ch === ')' || ch === ']') depth--;
        if (!depth && ch === sep) { out.push(cur); cur = ''; continue; }
        cur += ch;
    }
    out.push(cur);
    return out;
}
const tokenRe = tokens => new RegExp(`(?<![\\w-])(?:${tokens.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})(?![\\w-])`);
/** 갈래 전부가 바깥 사슬에 표식을 품으면 참 */
function scoped(selector, re) {
    const parts = splitTop(selector, ',').map(s => s.trim()).filter(Boolean);
    return parts.length > 0 && parts.every(part => re.test(outerChain(part)));
}

/** 블록 단위로 걸어요: 조건 @규칙(@media · @supports · @container · @layer)은 안으로 들어가고, 선택자 규칙만 빼요. 빈 조건 묶음은 같이 빼요 */
function walk(text, re, stats) {
    let out = '', i = 0;
    const n = text.length;
    while (i < n) {
        const open = text.indexOf('{', i);
        if (open < 0) { out += text.slice(i); break; }
        // 블록 밖 글(주석 · 공백 · @import 같은 한 줄 @규칙)은 그대로
        const head = text.slice(i, open);
        const semi = head.lastIndexOf(';');
        const before = semi >= 0 ? head.slice(0, semi + 1) : '';
        const prelude = (semi >= 0 ? head.slice(semi + 1) : head);
        let depth = 1, k = open + 1, quote = null;
        while (k < n && depth) {
            const ch = text[k];
            if (quote) { if (ch === quote && text[k - 1] !== '\\') quote = null; }
            else if (ch === '"' || ch === "'") quote = ch;
            else if (ch === '{') depth++;
            else if (ch === '}') depth--;
            k++;
        }
        const body = text.slice(open + 1, k - 1);
        const sel = prelude.trim();
        out += before;
        if (/^@(media|supports|container|layer)\b/.test(sel)) {
            const inner = walk(body, re, stats);
            if (inner.trim()) out += `${prelude}{${inner}}`; else stats.emptyGroups++;
        } else if (sel.startsWith('@') || !scoped(sel, re)) {
            out += `${prelude}{${body}}`;
        } else {
            stats.rules++; stats.bytes += k - i;
        }
        i = k;
    }
    return out;
}
function deferScoped(text, tokens) {
    const stats = { rules: 0, bytes: 0, emptyGroups: 0, tokens: tokens.length };
    const re = tokenRe(tokens);
    return { text: walk(text, re, stats), stats };
}
/** 애드온 첫 장: 갈래마다 바깥 사슬에 창 표시가 있고 지킴 표시가 없을 때만 빼요 */
function deferAddon(text, panelSource, keepSource) {
    const panel = new RegExp(`(?<![\\w-])(?:${panelSource})`), keep = new RegExp(`(?<![\\w-])(?:${keepSource})`);
    const stats = { rules: 0, bytes: 0, emptyGroups: 0 };
    const match = { test: chain => panel.test(chain) && !keep.test(chain) };
    return { text: walk(text, match, stats), stats };
}
module.exports = { deferAddon, deferScoped, scopeTokens, scoped, outerChain, DRAWER_TOKENS, openerTokens };
