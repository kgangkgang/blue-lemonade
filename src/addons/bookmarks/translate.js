// 북마크 — LLM 번역기(llm-translator-custom) 연동: 번역하기, 번역문 직접 고치기, 번역문 지우기
//
// 번역문은 채팅 화면과 같은 자리(message.extra.display_text)에 둔다. 그래서 그 채팅을 열면 바로 번역문이 보인다.
// LLM 번역기는 원문을 열쇠로 삼아 번역문을 IndexedDB(LLMtranslatorDB)에도 적어 두고, 채팅 화면의 '번역문 수정'은
// 거기서 원본을 찾는다. 여기서 만든 번역문도 같은 DB에 함께 적는다 (DB 쓰기가 실패해도 번역문 표시는 그대로 간다).
import { extension_settings, getContext } from '../../../../../../extensions.js';
import { eventSource, updateMessageBlock } from '../../../../../../../script.js';
import { isEditingMessage } from './edit-guard.js';
import { getStringHash } from '../../../../../../utils.js';
import { SlashCommandParser } from '../../../../../../slash-commands/SlashCommandParser.js';
import { currentChatKey } from './state.js';
import { loadRecord, saveRecord, saveOtherMessageExtra, sameMessage } from './data.js';

const TRANSLATOR_MODULE = 'llm-translator-custom';
const TRANSLATE_COMMAND = 'llmTranslate';
const COMMAND_ERROR_PREFIX = 'LLM 번역 중 오류 발생: ';
const DB_NAME = 'LLMtranslatorDB';
const STORE_NAME = 'translations';

// ── 번역기 부르기 ────────────────────────────────────────────

function translateCommand() {
    const command = SlashCommandParser.commands?.[TRANSLATE_COMMAND];
    return typeof command?.callback === 'function' ? command : null;
}

/** LLM 번역기 확장이 켜져 있어서 번역할 수 있는지 */
export function hasTranslator() {
    return translateCommand() !== null;
}

export function hasTranslation(message) {
    return !!message?.extra?.display_text;
}

/** 번역기가 DB 열쇠로 쓰는 원문 (채팅 화면의 번역 버튼과 같은 방식으로 매크로를 채운 글) */
export function originalTextOf(message) {
    const context = getContext();
    return context.substituteParams(message?.mes ?? '', context.name1, message?.name);
}

/**
 * 채팅 화면의 '원문 보기' 상태: 번역문을 original_translation_backup에 치워 두고 원문을 보여 주는 중.
 * 번역기의 '번역문 수정'은 백업을 지우지 않고 남길 수 있어서, 지금 보이는 글이 정말 원문일 때만 그렇게 본다.
 */
export function isShowingOriginal(message) {
    return hasTranslation(message) && !!message.extra.original_translation_backup && message.extra.display_text === originalTextOf(message);
}

/**
 * 오래 기다린 뒤에도 같은 메시지에 쓰는지 확인할 값.
 * 메시지 객체를 그대로 들고 있으면 그사이 원문 수정으로 같은 객체가 바뀌어도 알아채지 못하므로, 비교할 값만 베껴 둔다.
 */
export function expectationOf(message) {
    return {
        message: { mes: message?.mes, send_date: message?.send_date, name: message?.name, is_user: message?.is_user },
        original: originalTextOf(message),
    };
}

/**
 * 슬래시 명령을 글자로 조립하지 않고 명령의 함수를 바로 부른다.
 * 원문에 | 나 {{매크로}} 같은 것이 있어도 파서를 거치지 않으니 그대로 넘어간다.
 * 명령은 실패해도 던지지 않고 오류 문구를 돌려주므로 여기서 오류로 바꾼다.
 */
async function requestTranslation(text) {
    const command = translateCommand();
    if (!command) throw new Error('LLM 번역기 확장이 꺼져 있거나 설치되어 있지 않아요.');
    const result = await command.callback({}, text);
    if (typeof result !== 'string') throw new Error('번역 결과를 받지 못했어요.');
    if (result.startsWith(COMMAND_ERROR_PREFIX)) throw new Error(result.slice(COMMAND_ERROR_PREFIX.length));
    if (!result.trim()) throw new Error('번역 결과가 비어 있어요.');
    return result;
}

// ── 번역기와 같은 모양으로 적기 ──────────────────────────────
// 번역기는 display_text에 받은 번역문 그대로가 아니라 '원문 병기' 설정으로 가공한 글을 넣고(processTranslationText),
// 1.7.1부터 원문 사본(original_text_for_translation) 대신 원문 해시(original_text_hash)로 원문 수정을 알아챈다.
// DB에는 가공 전 번역문을 둔다.

let displayProcessor = null; // Promise<함수|null>, 처음 쓸 때 한 번만 만든다

/**
 * 번역기(1.8.13~)가 내보내는 processTranslationText 를 빌린다.
 * 실리태번이 <script type="module"> 로 이미 불러온 번역기만 쓴다: 같은 주소의 import 는 그 모듈을 그대로 돌려주고 다시 실행하지 않는다.
 * 번역기가 꺼져 있어 불린 적이 없으면 import 하지 않는다 — 하면 번역기가 새로 실행돼 버린다.
 * 예전 번역기라 내보내지 않으면 번역문을 가공하지 않고 쓴다 (번역기의 '원문 병기 안 함'과 같은 결과).
 */
function loadDisplayProcessor() {
    const bundled=globalThis[Symbol.for('blue-lemonade.translator')];
    if(typeof bundled?.processTranslationText==='function')return Promise.resolve(bundled.processTranslationText);
    displayProcessor ??= (async () => {
        const url = new URL(`../../../../${TRANSLATOR_MODULE}/index.js`, import.meta.url).href;
        const loaded = [...document.querySelectorAll('script[type="module"][src]')].some(script => script.src === url);
        if (!loaded) return null;
        const module = await import(url);
        if (typeof module.processTranslationText === 'function') return module.processTranslationText;
        console.warn('[북마크] 번역기가 번역문 가공(원문 병기)을 내보내지 않아 번역문을 그대로 씁니다. 번역기를 1.8.13 이상으로 올려 주세요.');
        return null;
    })().catch((error) => {
        console.warn('[북마크] 번역기 모듈을 읽지 못해 번역문을 그대로 씁니다:', error);
        return null;
    });
    return displayProcessor;
}

/** 번역기가 display_text에 넣는 것과 같은 글 */
async function displayTextOf(original, translation) {
    const process = await loadDisplayProcessor();
    if (!process) return translation;
    try {
        return process(original, translation);
    } catch (error) {
        console.warn('[북마크] 번역문을 가공하지 못해 그대로 씁니다:', error);
        return translation;
    }
}

/** 번역기(1.7.1~)의 markTranslatedOriginal과 같다: 원문 해시만 두고 사본은 지운다. */
function markTranslatedOriginal(extra, original) {
    extra.original_text_hash = String(getStringHash(String(original ?? '')));
    delete extra.original_text_for_translation;
}

// ── 번역기 DB (IndexedDB) ────────────────────────────────────

function requestToPromise(request) {
    return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error('IndexedDB 오류'));
    });
}

function openDb() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);
        request.onupgradeneeded = () => {
            // 번역기가 아직 한 번도 돌지 않았을 때만 온다. 번역기와 같은 모양으로 만든다.
            const db = request.result;
            if (db.objectStoreNames.contains(STORE_NAME)) return;
            const store = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
            for (const name of ['originalText', 'provider', 'model', 'date']) store.createIndex(name, name, { unique: false });
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error('IndexedDB를 열지 못했습니다.'));
        request.onblocked = () => reject(new Error('IndexedDB가 다른 탭에서 쓰이고 있습니다.'));
    });
}

async function withStore(mode, task) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, mode);
        let result;
        const fail = (error) => {
            db.close();
            reject(error ?? new Error('IndexedDB 오류'));
        };
        transaction.oncomplete = () => {
            db.close();
            resolve(result);
        };
        transaction.onerror = () => fail(transaction.error);
        transaction.onabort = () => fail(transaction.error);
        Promise.resolve()
            .then(() => task(transaction.objectStore(STORE_NAME)))
            .then((value) => { result = value; }, (error) => {
                try { transaction.abort(); } catch { /* 이미 끝났다 */ }
                fail(error);
            });
    });
}

function dbGet(original) {
    return withStore('readonly', async (store) => {
        const record = await requestToPromise(store.index('originalText').get(original));
        return typeof record?.translation === 'string' ? record.translation : null;
    });
}

/** 같은 원문이 있으면 그 줄을 고치고, 없으면 새로 적는다. 날짜는 번역기와 같은 방식(한국 시간을 더한 ISO)으로 쓴다. */
function dbPut(original, translation) {
    const settings = extension_settings[TRANSLATOR_MODULE] ?? {};
    const fields = {
        translation,
        provider: settings.llm_provider ?? '',
        model: settings.llm_model ?? '',
        date: new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString(),
    };
    return withStore('readwrite', async (store) => {
        const existing = await requestToPromise(store.index('originalText').get(original));
        await requestToPromise(existing ? store.put({ ...existing, ...fields }) : store.add({ originalText: original, ...fields }));
    });
}

function dbDelete(original) {
    return withStore('readwrite', async (store) => {
        const existing = await requestToPromise(store.index('originalText').get(original));
        if (existing) await requestToPromise(store.delete(existing.id));
    });
}

/** DB는 번역기의 보조 기록이라, 실패해도 번역문 표시는 계속한다. */
async function quietly(task, what) {
    try {
        return await task();
    } catch (error) {
        console.warn(`[북마크] 번역기 DB ${what}에 실패했습니다:`, error);
        return null;
    }
}

// ── 메시지에 적기 ────────────────────────────────────────────

/**
 * 채팅 화면에 그 메시지가 그려져 있으면 바로 다시 그린다. 다른 채팅을 미리보기 중이면 같은 번호의 다른 메시지이니 건드리지 않는다.
 * showingOriginal: 번역기는 '원문 보기' 상태를 .mes_text의 jQuery data로 기억하므로 함께 맞춰 준다
 *                  (false = 번역문을 보여 주는 중, null = 번역문 없음, undefined = 건드리지 않음).
 */
function refreshChatMessage(record, index, message, showingOriginal = undefined) {
    if (!record.isCurrent || document.body.classList.contains('cg-previewing')) return;
    const element = document.querySelector(`#chat .mes[mesid="${index}"]`);
    if (!element) return;
    // 1.2.10: 채팅에서 이 메시지를 고치는 중이면 다시 그리지 않는다 (편집 창이 지워져 ✓ 에 번역문이 원문으로 저장됐다).
    //         편집을 끝내거나 취소하면 실리태번이 다시 그리고, 번역기가 MESSAGE_UPDATED 로 번역문을 보여 준다.
    if (!isEditingMessage(document, index)) updateMessageBlock(index, message);
    const jq = globalThis.jQuery;
    if (showingOriginal === undefined || !jq) return;
    const text = jq(element).find('.mes_text');
    if (showingOriginal === null) text.removeData('showing-original');
    else text.data('showing-original', showingOriginal);
}

/**
 * message.extra를 고치고 저장한다.
 * 현재 채팅: 실리태번이 들고 있는 메시지를 고치고 실리태번의 저장을 부른다. 저장에 실패하면 되돌린다.
 * 다른 채팅: 불러와 둔 복사본이 아니라 파일의 최신본에 반영해 저장한다 (data.js).
 * expected: 기다리는 사이에 메시지가 바뀌지 않았는지 확인할 값 { message, original }
 */
async function writeExtra(record, index, mutate, expected, showingOriginal) {
    if (!record.isCurrent) return saveOtherMessageExtra(record, index, expected.message, mutate);

    if (currentChatKey() !== record.key) throw new Error('그사이 다른 채팅으로 바뀌어서 저장하지 않았어요.');
    const message = record.messages?.[index];
    if (!message || !sameMessage(message, expected.message) || originalTextOf(message) !== expected.original) {
        throw new Error('그사이 메시지가 바뀌어서 저장하지 않았어요. 다시 해 주세요.');
    }

    const snapshot = message.extra && typeof message.extra === 'object' ? { ...message.extra } : null;
    if (!snapshot) message.extra = {};
    mutate(message.extra);
    try {
        refreshChatMessage(record, index, message, showingOriginal);
        await saveRecord(record, { messagesChanged: true });
    } catch (error) {
        if (snapshot) {
            for (const key of Object.keys(message.extra)) delete message.extra[key];
            Object.assign(message.extra, snapshot);
        } else {
            delete message.extra;
        }
        refreshChatMessage(record, index, message);
        throw error;
    }
    return message;
}

function emitTranslated(record, index, original, translation) {
    if (!record.isCurrent) return;
    // 번역기가 번역을 마쳤을 때 내는 것과 같은 알림 (다른 확장이 듣고 있을 수 있다)
    eventSource.emit('EXTENSION_LLM_TRANSLATE_DONE', { messageId: index, originalText: original, translatedText: translation, type: 'translation' });
    eventSource.emit('EXTENSION_LLM_TRANSLATE_UI_UPDATED', { messageId: String(index), type: 'translation' });
}

/**
 * LLM 번역기로 번역해서 번역문으로 보여 준다.
 * fresh가 아니면 번역기 DB에 같은 원문의 번역문이 있을 때 그것을 쓴다 (채팅 화면의 번역 버튼과 같다).
 * @returns {Promise<{ fromCache: boolean }>}
 */
export async function translateMessage(record, index, { fresh = false } = {}) {
    await loadRecord(record);
    const message = record.messages[index];
    if (!message) throw new Error('메시지를 찾을 수 없습니다.');
    const expected = expectationOf(message);
    const { original } = expected;
    if (!original.trim()) throw new Error('번역할 원문이 비어 있어요.');

    let translation = fresh ? null : await quietly(() => dbGet(original), '조회');
    const fromCache = !!translation;
    if (!translation) {
        translation = await requestTranslation(original);
        // 저장이 실패하더라도 받은 번역문은 남겨 두어 다시 시도할 때 또 부르지 않게 한다.
        await quietly(() => dbPut(original, translation), '기록');
    }

    const display = await displayTextOf(original, translation);
    await writeExtra(record, index, (extra) => {
        extra.display_text = display;
        markTranslatedOriginal(extra, original);
        delete extra.original_translation_backup;
    }, expected, false);
    emitTranslated(record, index, original, display);
    return { fromCache };
}

/**
 * 채팅 화면에서 '원문 보기'로 치워 둔 번역문을 다시 보여 준다 (번역기를 부르지 않는다).
 * @returns {Promise<boolean>} 되살렸으면 true
 */
export async function restoreTranslation(record, index) {
    await loadRecord(record);
    const message = record.messages[index];
    if (!isShowingOriginal(message)) return false;
    await writeExtra(record, index, (extra) => {
        // 다른 채팅은 파일의 최신본에 적으므로, 그사이 다른 곳에서 이미 되살렸으면 건드리지 않는다.
        if (!extra.original_translation_backup) throw new Error('번역문이 이미 보이고 있어요. 목록을 다시 열어 확인해 주세요.');
        extra.display_text = extra.original_translation_backup;
        delete extra.original_translation_backup;
    }, expectationOf(message), false);
    if (record.isCurrent) eventSource.emit('EXTENSION_LLM_TRANSLATE_UI_UPDATED', { messageId: String(index), type: 'toggle' });
    return true;
}

/** 직접 고칠 때 미리 채울 번역문: 번역기 DB의 원본(표시용 가공 전) → 없으면 지금 보이는(또는 치워 둔) 번역문 */
export async function editableTranslation(record, index) {
    await loadRecord(record);
    const message = record.messages[index];
    if (!hasTranslation(message)) return '';
    const cached = await quietly(() => dbGet(originalTextOf(message)), '조회');
    if (cached) return cached;
    return message.extra.original_translation_backup || message.extra.display_text || '';
}

/**
 * 번역문을 직접 써 넣거나 고친다.
 * expected: 편집 창을 열기 전에 잡아 둔 { message, original } (없으면 지금 값을 쓴다)
 */
export async function setTranslation(record, index, text, expected = null) {
    await loadRecord(record);
    const message = record.messages[index];
    if (!message) throw new Error('메시지를 찾을 수 없습니다.');
    expected ??= expectationOf(message);
    const { original } = expected;
    const display = await displayTextOf(original, text);
    await writeExtra(record, index, (extra) => {
        extra.display_text = display;
        markTranslatedOriginal(extra, original);
        delete extra.original_translation_backup;
    }, expected, false);
    await quietly(() => dbPut(original, text), '기록');
    if (record.isCurrent) eventSource.emit('EXTENSION_LLM_TRANSLATE_UI_UPDATED', { messageId: String(index), type: 'edit_save' });
}

/**
 * 번역문을 지운다. 원문은 그대로 남는다.
 * @returns {Promise<boolean>} 지웠으면 true, 원래 없었으면 false
 */
export async function clearTranslation(record, index, expected = null) {
    await loadRecord(record);
    const message = record.messages[index];
    if (!message) throw new Error('메시지를 찾을 수 없습니다.');
    if (!hasTranslation(message)) return false;
    expected ??= expectationOf(message);
    await writeExtra(record, index, (extra) => {
        delete extra.display_text;
        delete extra.original_translation_backup;
    }, expected, null);
    await quietly(() => dbDelete(expected.original), '삭제');
    return true;
}
