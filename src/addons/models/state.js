// 모델 등록 — 설정 보관과 공통 상수
// 설정 키(model_register)와 폴더 이름은 바꾸지 않는다. 등록해 둔 모델 목록이 여기 들어 있다.
import { extension_settings } from '../../../../../../extensions.js';
import { saveSettingsDebounced } from '../../../../../../../script.js';

export const MODULE = 'model_register';
export const FOLDER = 'model-register';
/** 이전 확장(Custom-Vertex-Model)이 쓰던 설정 키. 처음 켤 때 한 번만 가져온다. */
export const OLD_MODULE = 'vertexCustomModels';
export const VERSION = '1.0.4';
export const TITLE = '모델 등록';

const DEFAULTS = Object.freeze({
    /** { [공급자]: 등록한 모델 이름 목록 } */
    sources: {},
    /** { [공급자]: 사용자가 고른 우리 모델 } — 실리태번이 목록을 새로 채우며 선택을 지워도 되살리기 위해 따로 둔다. */
    picks: {},
});

export function settings() {
    return extension_settings[MODULE];
}

export function saveSettings() {
    saveSettingsDebounced();
}

function cleanList(list) {
    if (!Array.isArray(list)) return [];
    const seen = new Set();
    const out = [];
    for (const item of list) {
        const name = String(item ?? '').trim();
        if (!name || seen.has(name)) continue;
        seen.add(name);
        out.push(name);
    }
    return out;
}

export function initSettings() {
    if (!extension_settings[MODULE] || typeof extension_settings[MODULE] !== 'object') {
        const store = structuredClone(DEFAULTS);
        const old = extension_settings[OLD_MODULE];
        // 이전 확장은 버텍스 하나만 다뤘다. 그때 등록해 둔 모델과 고른 모델을 그대로 옮겨 온다.
        if (old && typeof old === 'object') {
            const models = cleanList(old.models);
            if (models.length) {
                store.sources.vertexai = models;
                store.migratedFrom = OLD_MODULE;
            }
            const picked = String(old.selectedModel ?? '').trim();
            if (picked && models.includes(picked)) store.picks.vertexai = picked;
        }
        extension_settings[MODULE] = store;
        saveSettings();
    }
    const store = settings();
    if (!store.sources || typeof store.sources !== 'object' || Array.isArray(store.sources)) store.sources = {};
    if (!store.picks || typeof store.picks !== 'object' || Array.isArray(store.picks)) store.picks = {};
    for (const [source, list] of Object.entries(store.sources)) {
        const clean = cleanList(list);
        if (clean.length) store.sources[source] = clean;
        else delete store.sources[source];
    }
    for (const [source, pick] of Object.entries(store.picks)) {
        const name = String(pick ?? '').trim();
        if (name && (store.sources[source] ?? []).includes(name)) store.picks[source] = name;
        else delete store.picks[source];
    }
    return store;
}

/** 공급자에 등록해 둔 모델 이름들 */
export function modelsOf(source) {
    return settings().sources[source] ?? [];
}

/** 목록을 통째로 바꾼다. 고른 모델이 목록에서 사라졌으면 기억도 지운다(이름 바꾸기는 movePick이 따로 옮긴다). */
export function setModels(source, list) {
    const store = settings();
    const clean = cleanList(list);
    if (clean.length) store.sources[source] = clean;
    else delete store.sources[source];
    const pick = store.picks[source];
    if (pick && !clean.includes(pick)) delete store.picks[source];
    saveSettings();
    return clean;
}

/**
 * 사용자가 고른 모델을 기억한다.
 * 실리태번은 목록을 새로 채운 뒤 스스로 change를 쏘는데, 그것까지 받아 적으면 기억이 지워진다.
 * 그래서 사용자가 직접 고른 경우(fromUser)에만 기억을 지울 수 있게 한다.
 */
export function rememberPick(source, model, { fromUser = false } = {}) {
    const store = settings();
    const name = String(model ?? '').trim();
    if (name && modelsOf(source).includes(name)) {
        if (store.picks[source] === name) return;
        store.picks[source] = name;
        saveSettings();
        return;
    }
    if (!fromUser) return; // 실리태번이 스스로 바꾼 값 — 기억은 그대로 둔다
    if (store.picks[source] === undefined) return;
    delete store.picks[source];
    saveSettings();
}

/** 이름을 바꿨을 때 기억도 따라 옮긴다. */
export function movePick(source, from, to) {
    const store = settings();
    if (store.picks[source] !== from) return;
    const name = String(to ?? '').trim();
    if (name) store.picks[source] = name;
    else delete store.picks[source];
    saveSettings();
}

export function pickOf(source) {
    return settings().picks[source] ?? '';
}
