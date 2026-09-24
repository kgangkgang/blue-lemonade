// 캐릭터 에셋 — 그림 파일 목록·올리기·지우기·이름 바꾸기 (실리태번 /api/sprites 사용), 이름 규칙, 묶음
import { getRequestHeaders } from '../../../../../../../script.js';
import { formatKeywordList } from './names.js';

export const ALLOWED_EXT = ['png','apng','webp','gif','jpg','jpeg','jfif','pjpeg','pjp','bmp','dib','avif','ico','cur','svg','heic','heif','tif','tiff','jxl'];

/** @typedef {{ file: string, base: string, ext: string, folder: string, url: string, group: string, groupLabel: string }} Asset */

export function extOf(name) {
    const match = /\.([^./\\]+)$/.exec(String(name));
    return match ? match[1].toLowerCase() : '';
}

export function baseOf(name) {
    const text = String(name);
    const dot = text.lastIndexOf('.');
    return dot > 0 ? text.slice(0, dot) : text;
}

export function isAllowedName(name) {
    return ALLOWED_EXT.includes(extOf(name));
}

export function isZipName(name) {
    return /\.zip$/i.test(String(name));
}

/** 번호 묶음 이름: Name_smile-1.png, Name_smile_2.png, Name_smile.3.png → Name_smile */
export function groupLabelOf(name) {
    return baseOf(name).replace(/[-_.]\d+$/, '');
}

export function groupKeyOf(name) {
    return groupLabelOf(name).toLowerCase();
}

/** 파일 이름으로 못 쓰는 글자를 뺀다. 서버도 한 번 더 정리한다. */
export function sanitizeBase(text) {
    return String(text ?? '')
        .replace(/[/\\:*?"<>|\x00-\x1f]/g, '')
        .replace(/^\.+/, '')
        .trim();
}

// 1.4.2: localeCompare 에 옵션을 넘기면 부를 때마다 비교기를 새로 만든다(정렬이 수십 배 느림). 한 번 만들어 쓴다 — 결과는 같다.
const NAME_COLLATOR = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

export function compareNames(a, b) {
    return NAME_COLLATOR.compare(String(a), String(b));
}

// 폴더는 '캐릭터' 또는 '캐릭터/프리셋' — 칸마다 따로 인코딩해서 '/'는 남긴다
function assetUrl(folder, file, query) {
    const path = String(folder).split('/').map(encodeURIComponent).join('/');
    return `/characters/${path}/${encodeURIComponent(file)}${query}`;
}

function makeAsset(folder, file, query = '') {
    return {
        file,
        base: baseOf(file),
        ext: extOf(file),
        folder,
        url: assetUrl(folder, file, query),
        group: groupKeyOf(file),
        groupLabel: groupLabelOf(file),
    };
}

/** 폴더의 그림 목록 (이름순) */
export async function fetchAssets(folder) {
    if (!folder) return [];
    const response = await fetch(`/api/sprites/get?name=${encodeURIComponent(folder)}`, { cache: 'no-cache' });
    if (!response.ok) throw new Error(describeStatus(response.status));
    const list = await response.json();
    const assets = [];
    for (const item of Array.isArray(list) ? list : []) {
        const path = String(item?.path ?? '');
        if (!path) continue;
        const question = path.indexOf('?');
        const cleanPath = question >= 0 ? path.slice(0, question) : path;
        const query = question >= 0 ? path.slice(question) : '';
        const file = cleanPath.slice(cleanPath.lastIndexOf('/') + 1);
        // 서버가 image/* 파일만 돌려주므로 그대로 믿는다 (올릴 때만 형식을 가린다). 그래야 ZIP으로 들어온 avif 같은 파일도 보이고 지울 수 있다.
        if (!file) continue;
        assets.push(makeAsset(folder, file, query));
    }
    assets.sort((a, b) => compareNames(a.file, b.file));
    return assets;
}

function describeStatus(status) {
    if (status === 403) return '권한 오류예요. 페이지를 새로고침한 뒤 다시 해 보세요.';
    if (status === 413) return '파일이 너무 커요.';
    if (status === 400) return '요청이 잘못됐어요. 파일 이름을 확인해 주세요.';
    if (status === 404) return '폴더를 찾지 못했어요.';
    return `서버 오류 (${status})`;
}

async function postForm(url, form) {
    const response = await fetch(url, {
        method: 'POST',
        headers: getRequestHeaders({ omitContentType: true }),
        body: form,
        cache: 'no-cache',
    });
    if (!response.ok) throw new Error(describeStatus(response.status));
    return response;
}

async function postJson(url, payload) {
    const response = await fetch(url, {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify(payload),
        cache: 'no-cache',
    });
    if (!response.ok) throw new Error(describeStatus(response.status));
    return response;
}

/**
 * 그림 한 장 올리기. 서버는 같은 이름(확장자 무관)의 파일을 먼저 지우고 `이름.원래확장자`로 저장한다.
 * @param {string} folder
 * @param {File} file
 * @param {string} [base] 저장할 이름 (확장자 제외). 비우면 파일 이름
 */
export async function uploadImage(folder, file, base = baseOf(file.name)) {
    const label = sanitizeBase(base);
    if (!label) throw new Error('파일 이름이 비어 있어요.');
    if (!isAllowedName(file.name)) throw new Error(`지원하지 않는 형식이에요: ${file.name}`);
    const form = new FormData();
    form.append('name', folder);
    form.append('label', label);
    form.append('spriteName', label);
    form.append('avatar', file, file.name);
    await postForm('/api/sprites/upload', form);
}

/** ZIP 통째로 올리기. 안의 그림이 풀려 저장되고, 같은 이름은 덮어써진다. 올라간 장수를 돌려준다. */
export async function uploadZip(folder, file) {
    const form = new FormData();
    form.append('name', folder);
    form.append('avatar', file, file.name);
    const response = await postForm('/api/sprites/upload-zip', form);
    try {
        const data = await response.json();
        return Number(data?.count) || 0;
    } catch {
        return 0;
    }
}

/** 이름(확장자 제외)이 같은 파일을 지운다. */
export async function deleteAsset(folder, base) {
    await postJson('/api/sprites/delete', { name: folder, label: base, spriteName: base });
}

/** 확장자만 다른 같은 이름의 파일들 (서버는 지울 때 이것들을 함께 지운다. 대소문자까지 같아야 한다) */
export function sameBaseSiblings(assets, asset) {
    return assets.filter(other => other !== asset && other.base === asset.base);
}

/**
 * 이름 바꾸기 = 새 이름으로 올린 뒤 예전 파일 지우기.
 * @param {Asset} asset
 * @param {string} newBase
 * @param {{ taken?: Asset|null, afterUpload?: () => void }} [options]
 *   taken: 대소문자만 다른 기존 파일. 서버는 대소문자까지 같은 이름만 지우므로(안드로이드는 대소문자를 가린다) 여기서 지운다.
 *   afterUpload: 새 파일이 생긴 직후 부를 함수 (꺼짐 상태 옮기기)
 * 새 파일은 생겼는데 예전 파일을 못 지우면 error.partial = true 로 던진다.
 */
export async function renameAsset(asset, newBase, { taken = null, afterUpload = null } = {}) {
    const response = await fetch(asset.url, { cache: 'no-cache' });
    if (!response.ok) throw new Error('원본 파일을 읽지 못했어요.');
    const blob = await response.blob();
    const file = new File([blob], `${newBase}.${asset.ext}`, { type: blob.type || 'application/octet-stream' });
    await uploadImage(asset.folder, file, newBase);
    afterUpload?.();
    try {
        if (taken && taken.file !== asset.file && taken.base !== newBase && taken.base.toLowerCase() === newBase.toLowerCase()) {
            await deleteAsset(asset.folder, taken.base);
        }
        if (newBase.toLowerCase() !== asset.base.toLowerCase()) {
            await deleteAsset(asset.folder, asset.base);
        }
    } catch (error) {
        const wrapped = new Error(`새 이름 '${file.name}'으로는 저장됐지만 예전 파일 '${asset.file}'을 지우지 못했어요. ${error?.message ?? ''}`.trim());
        wrapped.partial = true;
        throw wrapped;
    }
}

// ── 묶음과 AI 목록 ─────────────────────────────────────────────

/**
 * @typedef {{ key: string, label: string, members: Asset[], exact: Asset|null, onCount: number }} Group
 * 번호 묶음. label은 번호를 뗀 이름, exact는 번호 없는 원래 파일(있으면).
 */

/**
 * @param {Asset[]} assets
 * @param {Set<string>} disabled 꺼 둔 파일 이름
 * @param {boolean} grouped false면 파일마다 묶음 하나
 * @returns {Group[]}
 */
export function buildGroups(assets, disabled, grouped) {
    const map = new Map();
    for (const asset of assets) {
        const key = grouped ? asset.group : asset.file.toLowerCase();
        if (!map.has(key)) map.set(key, { key, label: grouped ? asset.groupLabel : asset.base, members: [], exact: null, onCount: 0 });
        const group = map.get(key);
        group.members.push(asset);
        if (grouped && asset.base.toLowerCase() === group.key) group.exact = asset;
        if (!disabled.has(asset.file)) group.onCount++;
    }
    const groups = [...map.values()];
    for (const group of groups) {
        // 번호 없는 원래 파일이 맨 앞, 그 뒤로 번호순
        group.members.sort((a, b) => (a === group.exact ? -1 : b === group.exact ? 1 : compareNames(a.file, b.file)));
        if (group.exact) group.label = group.exact.base;
        else if (grouped) group.label = group.members[0].groupLabel;
    }
    groups.sort((a, b) => compareNames(a.label, b.label));
    return groups;
}

/**
 * AI에게 주는 그림 이름 목록. 묶음이 켜져 있으면 묶음마다 대표 파일 하나(번호 없는 파일이 있으면 그것)만 적는다.
 * 실제 있는 파일 이름만 적어서, 정규식이 만든 주소도 바로 맞고 표시할 때는 묶음 안에서 하나를 고른다.
 * 여러 캐릭터가 한 폴더에 있으면 캐릭터마다 한 줄 (formatKeywordList).
 */
export function keywordText(assets, disabled, grouped) {
    const enabled = assets.filter(asset => !disabled.has(asset.file));
    const shown = grouped
        ? buildGroups(enabled, new Set(), true).map(group => group.exact ?? group.members[0])
        : enabled;
    return formatKeywordList(shown);
}

/**
 * 채팅 그림 맞추기용 찾아보기표.
 * byName/byBase는 꺼 둔 파일도 넣는다 (AI가 굳이 썼다면 보여 주는 편이 낫다). groups는 켜 둔 파일만.
 */
/**
 * @param {string} folder 지금 캐릭터 폴더
 * @param {Asset[]} assets 켜진 폴더를 합친 목록 (store.js)
 * @param {Set<string>} disabled
 * @param {Iterable<string>} [folders] 그림이 올 수 있는 캐릭터 폴더들 (자기 + 불러온 캐릭터). 화면의 그림이 이 폴더에서 온 것일 때만 바꾼다.
 */
export function buildIndex(folder, assets, disabled, folders = [folder]) {
    const byName = new Map();
    const byBase = new Map();
    const groups = new Map();
    for (const asset of assets) {
        byName.set(asset.file.toLowerCase(), asset);
        const base = asset.base.toLowerCase();
        if (!byBase.has(base)) byBase.set(base, asset);
        if (disabled.has(asset.file)) continue;
        if (!groups.has(asset.group)) groups.set(asset.group, []);
        groups.get(asset.group).push(asset);
    }
    return { folder, folders: new Set(folders), byName, byBase, groups };
}
