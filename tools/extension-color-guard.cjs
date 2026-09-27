'use strict';
// Build-time only. Keep layout declarations in place; opt out of paint at a
// runtime-owned extension boundary without editing that extension's CSS/settings.
const L = require('./css-lib.cjs');
const MARKER = '[data-bl-native-ext-colors]';
const UI_MODULES = new Set([
    '01-smear-topbar-drawers.css', '02-controls.css', '03-menus.css',
    '09-st-align-brand-loader-greys.css', '10-foundation.css', '15-drawers.css',
    '16-typescale.css', '17-semantic.css', '18-density.css', '19-extwindows.css',
    '26-rounds-1.7.css', '27-compact.css', '34-color-pick.css',
    '56-control-consistency.css', '57-native-ux.css',
]);
const COLORS = new Set([
    'color', 'fill', 'stroke', 'caret-color', 'accent-color', 'scrollbar-color',
    '-webkit-text-fill-color', '-webkit-text-stroke-color', 'text-emphasis-color',
    '-webkit-text-emphasis-color', 'text-decoration-color', 'box-shadow', 'text-shadow',
]);
// Explicit adapter paint tokens only, not dimensions or all arbitrary variables.
const TOKEN = /^--(?:ui-(?:canvas|panel|surface(?:-raised)?|hover|border(?:-strong)?|text(?:-soft|-muted)?|accent(?:-hover)?|on-accent|danger|shadow(?:-soft)?)|ap-(?:accent|bg-[\w-]+|text(?:-vague)?|border|input-border)|(?:cg|rl|llmt|eh|TH|th)-(?:base|card|scrim|tint|line|text|danger|accent|muted|faint|hover|border|dim|head-bg|well|window-shadow|card-shadow)(?:-[\w-]+)?|sw-field|tool-cool-color-picker-btn-border-color(?:-inner)?|SmartTheme(?:Body|Em)Color)$/;
const BORDER = /^(?:border(?:-(?:top|right|bottom|left|block|inline)(?:-(?:start|end))?)?|outline)$/;
const STYLE = /^(?:none|hidden|dotted|dashed|solid|double|groove|ridge|inset|outset|auto)$/i;
const WIDTH = /^(?:0|(?:\d*\.)?\d+(?:px|em|rem|pt|pc|in|cm|mm|q|vh|vw|vmin|vmax)|thin|medium|thick|(?:calc|min|max|clamp)\([\s\S]*\))$/i;
const COLOR_VALUE = /^(?:#[\da-f]{3,8}|transparent|currentcolor|(?:var|rgb|rgba|hsl|hsla|hwb|lab|lch|oklab|oklch|color|color-mix|light-dark)\([\s\S]*\))$/i;

function isPaint(name) {
    return COLORS.has(name) || /^background(?:-|$)/.test(name)
        || /^(?:border(?:-[a-z]+)*|outline)-color$/.test(name) || TOKEN.test(name);
}
function guardSelector(selector, marker = MARKER, positive = false) {
    const guard = positive ? `:where(${marker},${marker} *)` : `:where(:not(${marker},${marker} *))`;
    return L.topSplit(selector).map(part => {
        // Pseudo elements cannot be followed by :where. Walk syntax, not commas
        // or colons inside :is(), escaped Tailwind classes or attribute values.
        let at = part.length;
        for (let i = 0; i < part.length;) {
            const c = part[i];
            if (c === '\\') { i += 2; continue; }
            if (c === '"' || c === "'") { i = L.endString(part, i); continue; }
            if (c === '[') { i = L.endBracket(part, i) + 1; continue; }
            if (c === '(') { i = L.endParen(part, i) + 1; continue; }
            if (c === ':' && (part[i + 1] === ':' || /^:(?:before|after|first-line|first-letter)(?![\w-])/i.test(part.slice(i)))) { at = i; break; }
            i++;
        }
        const next = part.slice(0, at) + guard + part.slice(at);
        if (L.cmpSpec(L.spec(part), L.spec(next)) !== 0) throw Error(`Extension paint guard changed specificity: ${part}`);
        return next;
    }).join(',\n');
}
function words(value) {
    const result = [];
    let start = 0;
    for (let i = 0; i <= value.length; i++) {
        if (value[i] === '(') { i = L.endParen(value, i); continue; }
        if (value[i] === '"' || value[i] === "'") { i = L.endString(value, i) - 1; continue; }
        if (i === value.length || /\s/.test(value[i])) { if (i > start) result.push(value.slice(start, i)); start = i + 1; }
    }
    return result;
}
function borderGeometry(decl) {
    if (!BORDER.test(decl.lname)) return null;
    const parts = words(L.stripComments(decl.value).trim());
    let width = null, style = null, color = null;
    for (const part of parts) {
        if (WIDTH.test(part) && width === null) width = part;
        else if (STYLE.test(part) && style === null) style = part;
        else if (COLOR_VALUE.test(part) && color === null) color = part;
        else return null; // Unknown shorthand: do not guess its dimensions.
    }
    if (!color || !style) return null;
    // OFF retains the original shorthand, including invalid-at-computed-value
    // behavior and border-image reset. ON intentionally preserves only geometry.
    return [
        { ...decl, name: `${decl.lname}-width`, lname: `${decl.lname}-width`, value: width || 'medium' },
        { ...decl, name: `${decl.lname}-style`, lname: `${decl.lname}-style`, value: style },
    ];
}
const declaration = d => `${d.name}:${d.value}${d.important ? ' !important' : ''};`;
const normalized = d => `${d.lname}:${L.stripComments(d.value).replace(/\s+/g, ' ')}${d.important ? '!' : ''}`;
function signature(css, { marker = MARKER, guarded = false } = {}) {
    const tree = L.parse(css);
    if (tree.problems.length) throw Error(`Extension color CSS parse: ${tree.problems[0]}`);
    const negative = `:where(:not(${marker},${marker} *))`, positive = `:where(${marker},${marker} *)`;
    const result = [];
    function visit(nodes, context) {
        for (const node of nodes) {
            if (node.type === 'rule') {
                if (guarded && node.selector.replace(/,\s+/g, ',').includes(positive)) continue;
                let selector = node.selector;
                if (guarded) {
                    // cleanSel normalizes comma whitespace; normalize the guard too.
                    selector = selector.split(L.cleanSel(negative)).join('');
                }
                for (const decl of node.decls) result.push(`${context}|${L.cleanSel(selector)}|${normalized(decl)}`);
            } else if (node.type === 'at') {
                if (node.children) visit(node.children, `${context}/${node.prelude}`);
                else result.push(`${context}|${css.slice(node.start, node.end)}`);
            }
        }
    }
    visit(tree.children, ''); return result;
}
function guard(css, { moduleName, marker = MARKER } = {}) {
    const stats = { rules: 0, declarations: 0, borderGeometry: 0, focusShadowKept: 0 };
    if (!UI_MODULES.has(moduleName)) return { text: css, stats };
    if (!/^\[data-[\w-]+\]$/.test(marker)) throw Error('Extension color marker must be a data attribute selector');
    const tree = L.parse(css);
    if (tree.problems.length) throw Error(`Extension color CSS parse: ${tree.problems[0]}`);
    const edits = [];
    for (const rule of L.flatRules(tree)) {
        if (!/\bbody\.salty(?:\b|-)/.test(rule.selector)) continue;
        const runs = [];
        const append = (mode, decl) => {
            if (runs.at(-1)?.mode === mode) runs.at(-1).decls.push(decl);
            else runs.push({ mode, decls: [decl] });
        };
        let changed = false;
        for (const decl of rule.decls) {
            // Keep an existing keyboard ring: outline:none plus a removed shadow
            // would leave controls without any visible focus indication.
            const focusShadow = /:focus(?:-visible|-within)?\b/.test(rule.selector) && decl.lname === 'box-shadow';
            const geometry = !focusShadow && borderGeometry(decl);
            if (!focusShadow && (isPaint(decl.lname) || geometry)) {
                append('off', decl); changed = true; stats.declarations++;
                if (geometry) { for (const d of geometry) append('on', d); stats.borderGeometry++; }
            } else {
                append('both', decl);
                if (focusShadow) stats.focusShadowKept++;
            }
        }
        if (!changed) continue;
        const replacement = runs.map(run => `${run.mode === 'both' ? rule.selector : guardSelector(rule.selector, marker, run.mode === 'on')} {\n${run.decls.map(declaration).join('\n')}\n}`).join('\n');
        edits.push([rule.start, rule.end, replacement]); stats.rules++;
    }
    let text = css;
    for (const [start, end, replacement] of edits.reverse()) text = text.slice(0, start) + replacement + text.slice(end);
    const before = signature(css), after = signature(text, { guarded: true, marker });
    if (before.length !== after.length || before.some((value, i) => value !== after[i])) throw Error(`Extension color guard changed OFF declaration order: ${moduleName}`);
    return { text, stats };
}
module.exports = { MARKER, UI_MODULES, isPaint, guardSelector, borderGeometry, signature, guard };
