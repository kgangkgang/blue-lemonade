#!/usr/bin/env node
// 프리셋 JSON 에 프롬프트 폴더를 넣은 새 파일을 만들어요 — 프리셋을 폴더로 정리해 전달할 때 쓰는 도구예요(테마가 프리셋 파일에 쓰지는 않아요).
//   node tools/preset-folders.mjs <프리셋.json> --out <새 파일.json> [--folders <폴더 정의.json>] [--force]
//   --folders 를 안 주면 구분선 · 시작끝 짝으로 만든 자동 초안을 넣어요. 폴더 정의를 손봐서 다시 넣으려면 --draft <파일> 로 초안만 받아요.
//   node tools/preset-folders.mjs <프리셋.json> --draft <초안.json>
// 폴더 정의: [{ "name": "문체", "ids": ["프롬프트 identifier", …], "pick": false, "open": false, "children": [{ "name": …, "ids": […] }] }] (또는 { "folders": […] })
// 원본은 건드리지 않고, 있는 파일은 --force 없이는 덮어쓰지 않아요. 프리셋의 다른 칸은 그대로 두고 extensions.blPromptFolders 한 칸만 넣어요.
// 없는 identifier 는 빼고 알려요. 테마는 그 프리셋에 사용자 폴더가 없을 때 이 칸을 초깃값으로 읽어요.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { PRESET_FIELD, planFromDividers, tidyFolders } from '../src/prompt-folders-core.js';

/** 프리셋의 실제 순서(id 배열) — 전역 순서(100001)가 있으면 그것, 없으면 가장 긴 것. 프롬프트가 없는 항목은 뺌 */
export function presetOrder(preset) {
    const prompts = new Set((preset?.prompts || []).map(p => p?.identifier));
    const lists = (Array.isArray(preset?.prompt_order) ? preset.prompt_order : []).filter(item => Array.isArray(item?.order));
    const chosen = lists.find(item => String(item.character_id) === '100001' && item.order.length) || [...lists].sort((a, b) => b.order.length - a.order.length)[0];
    return (chosen?.order || []).map(entry => entry?.identifier).filter(id => prompts.has(id));
}
/** 구분선 · 시작끝 짝으로 만든 폴더 정의 초안 */
export function draftFolders(preset) {
    const byId = new Map((preset?.prompts || []).map(p => [p?.identifier, p]));
    return planFromDividers(presetOrder(preset), id => byId.get(id)).map(plan => ({ name: plan.name, ids: plan.ids, open: false, pick: false, ...(plan.children.length ? { children: plan.children } : {}) }));
}
/** 폴더 정의 → 저장 모양(id 를 차례로 매김 · 하위는 parent 로). 프리셋에 없는 identifier 는 빼서 missing 으로 돌려줘요 */
export function normalizeFolders(preset, definition) {
    const known = new Set((preset?.prompts || []).map(p => p?.identifier));
    const list = Array.isArray(definition) ? definition : definition?.folders;
    if (!Array.isArray(list)) throw new Error('폴더 정의는 배열이나 { folders: [...] } 여야 해요');
    const flat = [], missing = [];
    const keep = ids => (Array.isArray(ids) ? ids : []).filter(id => { if (known.has(id)) return true; missing.push(id); return false; });
    const add = (item, parent) => {
        const id = `f${flat.length + 1}`;
        flat.push({ id, name: item?.name, ids: keep(item?.ids), open: item?.open === true, pick: item?.pick === true, parent });
        return id;
    };
    for (const item of list) {
        const id = add(item, '');
        for (const child of Array.isArray(item?.children) ? item.children : []) add(child, id);
    }
    const folders = tidyFolders(flat).filter(f => f.ids.length || flat.some(c => c.parent === f.id && c.ids.length));
    return { folders, missing };
}
/** 폴더를 넣은 새 프리셋 객체(원본은 그대로). 다른 칸 · 순서는 바꾸지 않아요 */
export function withFolders(preset, folders) {
    const next = structuredClone(preset);
    if (!next.extensions || typeof next.extensions !== 'object' || Array.isArray(next.extensions)) next.extensions = {};
    next.extensions[PRESET_FIELD] = { version: 1, folders };
    return next;
}
const indentOf = text => /\n( +|\t)"/.exec(text)?.[1] ?? 4;

function main(argv) {
    const args = { _: [] };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === '--force') args.force = true;
        else if (a.startsWith('--')) args[a.slice(2)] = argv[++i];
        else args._.push(a);
    }
    const input = args._[0];
    if (!input || (!args.out && !args.draft)) { console.log('사용법: node tools/preset-folders.mjs <프리셋.json> --out <새 파일.json> [--folders <폴더 정의.json>] [--force] | --draft <초안.json>'); return 2; }
    const text = fs.readFileSync(input, 'utf8');
    const preset = JSON.parse(text.replace(/^﻿/, ''));
    const target = args.out || args.draft;
    if (path.resolve(target) === path.resolve(input)) { console.error('원본과 다른 파일 이름을 주세요'); return 1; }
    if (fs.existsSync(target) && !args.force) { console.error(`이미 있는 파일이에요: ${target} (덮어쓰려면 --force)`); return 1; }
    const draft = draftFolders(preset);
    if (args.draft) {
        fs.writeFileSync(target, JSON.stringify(draft, null, 2) + '\n');
        console.log(`초안 폴더 ${draft.length}개 → ${target}`);
        return 0;
    }
    const definition = args.folders ? JSON.parse(fs.readFileSync(args.folders, 'utf8').replace(/^﻿/, '')) : draft;
    const { folders, missing } = normalizeFolders(preset, definition);
    if (!folders.length) { console.error('넣을 폴더가 없어요(구분선을 못 찾았거나 identifier 가 모두 없어요)'); return 1; }
    const eol = text.includes('\r\n') ? '\r\n' : '\n';
    const body = JSON.stringify(withFolders(preset, folders), null, indentOf(text)).replace(/\n/g, eol) + (/\n$/.test(text) ? eol : '');
    fs.writeFileSync(target, body);
    console.log(`폴더 ${folders.length}개(하위 ${folders.filter(f => f.parent).length}) · 항목 ${folders.reduce((n, f) => n + f.ids.length, 0)}개 → ${target}`);
    if (missing.length) console.log(`프리셋에 없는 identifier ${missing.length}개는 뺐어요: ${missing.slice(0, 20).join(', ')}`);
    return 0;
}
if (process.argv[1] && import.meta.url === pathToFileURL(fs.realpathSync(process.argv[1])).href) process.exitCode = main(process.argv.slice(2));
