// 엔진 등록부 — 이 순서가 엔진 탭 칩 순서
import minimax from './minimax.js';
import openai from './openai.js';
import openai_compat from './openai_compat.js';
import openrouter from './openrouter.js';
import elevenlabs from './elevenlabs.js';
import gemini from './gemini.js';
import azure from './azure.js';
import typecast from './typecast.js';
import cartesia from './cartesia.js';
import browser from './browser.js';
import gtranslate from './gtranslate.js';

export const PROVIDERS = { minimax, openai, openai_compat, openrouter, elevenlabs, gemini, azure, typecast, cartesia, browser, gtranslate };

export function getProvider(id) {
    return Object.prototype.hasOwnProperty.call(PROVIDERS, id) ? PROVIDERS[id] : null;
}

export function listProviders() {
    return Object.values(PROVIDERS);
}

export default PROVIDERS;
