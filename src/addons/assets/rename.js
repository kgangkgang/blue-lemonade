// 캐릭터 에셋 1.7.0 — 캐릭터 이름 바꾸기 따라가기 (CHARACTER_RENAMED).
// 그림 폴더 이름 = 카드 파일 이름(확장자 뺌)이라 실리태번이 이름을 바꾸면(카드 파일이 바뀜) 새 이름 폴더는 비고,
// 프리셋 목록 · 꺼 둔 그림 · 다른 카드 링크 · 경량화 기록이 옛 열쇠에 남아 안 보였다. 실리태번은 characters/<옛 이름>/ 그림 폴더를 옮기지 않는다.
//   renameFolderKeys(store, from, to)  순수: 설정 열쇠를 새 폴더로 (presets · links · disabled · optimizedImages · 다른 카드 links[].owner)
//   followCharacterRename(oldAvatar, newAvatar)  옛 폴더에 그림이 있으면 옮길지 한 번 묻고(실리태번 창이 다 닫힌 뒤), 옮기면 설정 열쇠도 함께.
//     옮기기는 프리셋 이름 바꾸기와 같은 순서: 새 폴더에 전부 올린 다음에야 옛 파일을 지운다(하나라도 못 올리면 올린 것을 치우고 그만 — 그림은 늘 한 군데에 온전히).
//     옮기지 않으면 설정도 그대로 둔다(열쇠와 그림이 같은 곳을 가리키게). 옛 폴더에 그림이 없으면 설정 열쇠만 옮긴다.
import { fetchAssets, uploadImage, deleteAsset, sameBaseSiblings } from './assets.js';
import { folderKey } from './presets.js';
import { ask } from '../../ask.js';

const isObj = v => !!v && typeof v === 'object' && !Array.isArray(v);
const stripExt = avatar => String(avatar || '').replace(/\.[^/.]+$/, '');
/** 'from' 또는 'from/프리셋' → 'to' · 'to/프리셋'. 다른 폴더면 null */
export function movedKey(key, from, to) {
    const k = String(key ?? '');
    if (k === from) return to;
    if (k.startsWith(from + '/')) return to + k.slice(from.length);
    return null;
}

/** 순수: 설정 열쇠 옮기기. 새 폴더에 이미 같은 열쇠가 있으면 그 칸은 그대로(덮지 않음). 옮긴 칸 수를 돌려준다 */
export function renameFolderKeys(store, from, to) {
    let moved = 0;
    if (!isObj(store) || !from || !to || from === to) return moved;
    for (const field of ['presets', 'links', 'disabled']) {
        const map = store[field];
        if (!isObj(map)) continue;
        for (const key of Object.keys(map)) {
            const next = movedKey(key, from, to);
            if (next === null || next in map) continue;
            map[next] = map[key]; delete map[key]; moved++;
        }
    }
    if (isObj(store.links)) for (const list of Object.values(store.links)) {
        if (!Array.isArray(list)) continue;
        for (const item of list) if (item && item.owner === from) { item.owner = to; moved++; }
    }
    const record = store.optimizedImages;
    if (isObj(record)) for (const key of Object.keys(record)) {
        let pair;
        try { pair = JSON.parse(key); } catch { continue; }
        if (!Array.isArray(pair) || pair.length !== 2) continue;
        const next = movedKey(pair[0], from, to);
        if (next === null) continue;
        const nk = JSON.stringify([next, pair[1]]);
        if (!(nk in record)) record[nk] = record[key];
        delete record[key]; moved++;
    }
    return moved;
}

/** 옛 캐릭터 폴더와 프리셋 폴더 열쇠들 (설정에 적힌 프리셋 이름으로) */
function folderKeys(store, folder) {
    const list = Array.isArray(store?.presets?.[folder]) ? store.presets[folder] : [];
    const names = list.filter(p => p && typeof p.name === 'string' && p.name).map(p => p.name);
    return [folder, ...new Set(names)].map((name, i) => (i === 0 ? folder : folderKey(folder, name)));
}

/** 실리태번 창(이름 바꾸기 확인 · 「지난 채팅도 바꿀까요」)이 다 닫힐 때까지 (최대 2분) */
async function popupsClosed(doc = globalThis.document, limitMs = 120000) {
    const start = Date.now();
    while (Date.now() - start < limitMs) {
        if (!doc?.querySelector?.('dialog.popup[open]')) return true;
        await new Promise(r => setTimeout(r, 500));
    }
    return false;
}

/**
 * host = { settings, saveSettings, reload, toast } (시험은 가짜). io = { fetchAssets, uploadImage, deleteAsset, ask } (기본은 실제)
 * 돌려줌: 'keys' (그림 없음 — 열쇠만) · 'moved' · 'kept' (옮기지 않음) · 'failed' · 'busy' (새 폴더에 이미 그림) · 'none'
 */
export async function followCharacterRename(oldAvatar, newAvatar, host, io = {}) {
    const from = stripExt(oldAvatar), to = stripExt(newAvatar);
    if (!from || !to || from === to || !host?.settings) return 'none';
    const get = io.fetchAssets || fetchAssets, put = io.uploadImage || uploadImage, del = io.deleteAsset || deleteAsset, confirm = io.ask || ask;
    const store = host.settings();
    const keys = folderKeys(store, from);
    const found = [];
    for (const key of keys) {
        let members = [];
        try { members = await get(key); } catch { members = []; }
        if (members.length) found.push({ key, members });
    }
    const total = found.reduce((n, f) => n + f.members.length, 0);
    if (!total) {
        if (renameFolderKeys(store, from, to)) host.saveSettings?.();
        return 'keys';
    }
    let already = [];
    try { already = await get(to); } catch { already = []; }
    if (already.length) {
        host.toast?.('warning', `새 이름 폴더 「${to}」에 이미 그림이 있어서 옛 폴더 「${from}」의 그림 ${total}장을 옮기지 않았어요.`, { timeOut: 10000 });
        return 'busy';
    }
    if (!io.ask) await popupsClosed();
    const yes = await confirm(`캐릭터 이름이 바뀌어 그림 폴더도 바뀌었어요.\n옛 폴더 「${from}」의 그림 ${total}장(프리셋 ${found.length - (found[0]?.key === from ? 1 : 0)}개 포함)을 새 폴더 「${to}」로 옮길까요?\n옮기지 않으면 이 캐릭터에서 그 그림이 안 보여요.`, { ok: '옮기기', cancel: '그대로 두기', title: '캐릭터 에셋' });
    if (!yes) { host.toast?.('info', `그림은 옛 폴더 「${from}」에 그대로 있어요.`); return 'kept'; }
    for (const { members } of found) {
        const twins = members.filter(a => sameBaseSiblings(members, a).length).map(a => a.file);
        if (twins.length) { host.toast?.('warning', `확장자만 다른 같은 이름의 그림이 있어서 옮기지 않았어요: ${twins.slice(0, 3).join(', ')}`, { timeOut: 10000 }); return 'failed'; }
    }
    const copied = [];
    let failed = '';
    for (const { key, members } of found) {
        const target = movedKey(key, from, to);
        for (const asset of members) {
            try {
                const response = await (io.fetch || globalThis.fetch)(asset.url, { cache: 'no-cache' });
                if (!response.ok) throw new Error('원본 파일을 읽지 못했어요.');
                const blob = await response.blob();
                await put(target, new File([blob], asset.file, { type: blob.type || 'application/octet-stream' }), asset.base);
                copied.push([target, asset.base]);
            } catch (error) { console.error('[캐릭터 에셋] 이름 바꾼 캐릭터 그림 옮기기 실패', asset.file, error); failed = asset.file; break; }
        }
        if (failed) break;
    }
    if (failed) {
        for (const [key, base] of copied) { try { await del(key, base); } catch { /* 새 폴더의 남은 사본 — 그림은 옛 폴더에 그대로 */ } }
        host.toast?.('error', `「${failed}」을(를) 옮기지 못해서 그만뒀어요. 그림은 옛 폴더 「${from}」에 그대로예요.`, { timeOut: 10000 });
        return 'failed';
    }
    const left = [];
    for (const { key, members } of found) for (const asset of members) { try { await del(key, asset.base); } catch { left.push(asset.file); } }
    renameFolderKeys(store, from, to);
    host.saveSettings?.();
    try { await host.reload?.(); } catch { /* 다음 열 때 */ }
    if (left.length) host.toast?.('warning', `옛 폴더에 ${left.length}장이 남았어요 (새 폴더에는 다 있어요): ${left.slice(0, 3).join(', ')}`, { timeOut: 10000 });
    else host.toast?.('success', `그림 ${total}장을 새 폴더 「${to}」로 옮겼어요.`);
    return 'moved';
}
