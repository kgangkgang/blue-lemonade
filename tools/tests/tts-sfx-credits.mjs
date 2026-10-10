// Synthetic attribution tests: no real chats, imported audio, account data or network.
// node tools/tests/tts-sfx-credits.mjs [theme root or isolated TTS directory]
import assert from 'node:assert/strict';
import { register } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { webcrypto } from 'node:crypto';
const here = path.dirname(fileURLToPath(import.meta.url));
const base = path.resolve(process.argv[2] || path.join(here, '../..'));
const root = fs.existsSync(path.join(base, 'src/sfx-library.js')) ? path.join(base, 'src') : path.join(base, 'src/addons/tts/src');
const data = text => `data:text/javascript,${encodeURIComponent(text)}`;
const T = globalThis.__sfxCreditsTest = { ext: {}, saves: 0 };
const stubs = {
    'script.js': data('export function saveSettingsDebounced(){const t=globalThis.__sfxCreditsTest;t.saves++;if(t.failSave)throw Error("synthetic save failure")}'),
    'extensions.js': data('export const extension_settings=globalThis.__sfxCreditsTest.ext;'),
};
register(data(`let D;export function initialize(d){D=d}export async function resolve(spec,ctx,next){
if(spec.split('../').length>3&&D[spec.split('/').pop()])return {url:D[spec.split('/').pop()],shortCircuit:true};return next(spec,ctx)}`), { data: stubs });
Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });
const records = new Map();
globalThis.indexedDB = { open() {
    const request = {};
    setTimeout(() => { request.result = { close() {}, transaction() {
        const tx = { objectStore() { return {
            put(blob, id) { records.set(id, blob); }, delete(id) { records.delete(id); },
            get(id) { const req = {}; queueMicrotask(() => { req.result = records.get(id); req.onsuccess?.(); }); return req; },
        }; }, abort() { tx.onabort?.(); } };
        setTimeout(() => tx.oncomplete?.(), 0); return tx;
    } }; request.onsuccess?.(); }, 0); return request;
} };
const mod = file => import(pathToFileURL(path.join(root, file)).href);
const C = await mod('sfx-credits.js'), S = await mod('settings.js'), L = await mod('sfx-library.js');
let passed = 0;
const test = async (name, fn) => { await fn(); passed++; console.log(`PASS ${name}`); };
const SHA = 'a'.repeat(64), valid = { name: '가상 효과음', author: 'Sample author', source: 'https://example.org/sound', license: 'CC0-1.0', licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/', sha256: SHA, modifications: '가상 자료 · 발췌' };
await test('structured credit uses bounded allowlist and strips controls', () => {
    const c = C.normalizeSfxCredit({ ...valid, author: 'x'.repeat(400), modifications: 'n'.repeat(1500), extra: 'private', fileName: 'C:\\private\\clip.wav', encoding: 'MP3\u0000 test', excerptStart: 0, gainDb: 0, bytes: 42 });
    assert.equal(c.author.length, 240); assert.equal(c.modifications.length, 1000); assert.equal(c.fileName, 'clip.wav'); assert.equal(c.encoding, 'MP3  test'); assert.equal(c.extra, undefined); assert.equal(c.gainDb, 0); assert.equal(c.excerptStart, 0);
});
await test('only HTTPS links with no credentials are allowed', () => {
    for (const source of ['javascript:alert(1)', 'data:text/html,<svg>', 'file:///private/a', 'http://example.org', '//example.org', 'https://u:p@example.org', 'https://example.org/\nattack']) assert.equal(C.sfxCreditUrl(source), '');
    assert.equal(C.sfxCreditUrl(valid.source), valid.source);
});
await test('invalid numeric and object metadata cannot escape normalization', () => {
    assert.equal(C.normalizeSfxCredit([]), null); assert.equal(C.normalizeSfxCredit(new Date()), null);
    const c = C.normalizeSfxCredit({ author: 'A', excerptStart: '3', fadeInSeconds: Infinity, fadeOutSeconds: -1, gainDb: 500, bytes: 1.5 }); assert.deepEqual(c, { author: 'A' });
});
await test('legacy attribution requires one exact original name and computed hash', () => {
    assert.deepEqual(C.importedSfxCredit({ name: valid.name }, [valid], SHA), valid);
    for (const [item, credits, hash] of [[{ name: ' '+valid.name }, [valid], SHA], [{ name: valid.name }, [valid], ''], [{ name: valid.name }, [valid], 'b'.repeat(64)], [{ name: valid.name }, [valid, valid], SHA], [{ name: valid.name }, Array(65).fill(valid), SHA]]) assert.equal(C.importedSfxCredit(item, credits, hash), null);
});
await test('per-sound attribution refuses a mismatched declared hash without falling back', () => {
    assert.equal(C.importedSfxCredit({ name: valid.name, credit: { ...valid, sha256: 'b'.repeat(64) } }, [valid], SHA), null);
    assert.equal(C.importedSfxCredit({ credit: valid }, null, ''), null);
    assert.equal(C.importedSfxCredit({ credit: { author: 'Sample' } }, null, '' ).author, 'Sample');
});
await test('settings normalization preserves old metadata and disabled sound values', () => {
    const original = { id: 'custom:original-123', name: '기존 가상 음원', words: ['keep'], loop: true, custom: true, bytes: 16, mime: 'audio/wav', untouched: 'keep', credit: { ...valid, source: 'javascript:alert(1)' } };
    T.ext.lemon_voice = { sfx: { custom: [original], disabled: ['custom:original-123', 'daily_keyboard'] } };
    const s = S.settings(); assert.deepEqual(s.sfx.disabled, ['custom:original-123', 'daily_keyboard']); assert.equal(s.sfx.custom[0].untouched, 'keep'); assert.equal(s.sfx.custom[0].credit.source, undefined); assert.equal(s.sfx.custom[0].name, original.name); assert.equal(s.sfx.custom[0].loop, true);
});
const raw = Buffer.from('RIFF0000WAVEsynthetic-testing-audio');
const file = new Blob([raw], { type: 'audio/wav' });
const hash = Buffer.from(await crypto.subtle.digest('SHA-256', raw)).toString('hex');
const sound = { name: '가상 옷감', category: '가상 시험', words: ['synthetic fabric'], loop: false, data: 'data:audio/wav;base64,' + raw.toString('base64') };
const legacyCredit = { ...valid, name: sound.name, sha256: hash, excerptStart: .25, excerptSeconds: .6 };
const pack = content => new Blob([JSON.stringify({ format: L.SFX_PACK_FORMAT, version: 1, ...content })]);
let imported;
await test('legacy pack imports audio with attribution and retains old values', async () => {
    const before = JSON.stringify(L.getSfx('custom:original-123'));
    const result = await L.importSfxPack(pack({ sounds: [sound], credits: [legacyCredit] })); assert.equal(result.added, 1); assert.equal(result.failed, 0);
    imported = L.listSfx().find(x => x.name === sound.name); assert.deepEqual(imported.credit, legacyCredit); assert.equal(JSON.stringify(L.getSfx('custom:original-123')), before); assert.equal(S.settings().sfx.custom[0].untouched, 'keep'); assert.equal(L.isSfxEnabled('daily_keyboard'), false); assert.deepEqual(Buffer.from(await (await L.sfxBlob(imported.id)).arrayBuffer()), raw);
});
await test('export and reimport preserve attribution without duplicate or preference changes', async () => {
    // Existing synthetic metadata has no file; supply its bytes just for this export.
    records.set('custom:original-123', file);
    L.setSfxEnabled(imported.id, false);
    const exported = await L.exportSfxPack(), data = JSON.parse(await exported.text());
    assert.deepEqual(data.sounds.find(x => x.name === sound.name).credit, legacyCredit);
    const before = JSON.stringify(L.getSfx(imported.id)), result = await L.importSfxPack(pack({ sounds: [data.sounds.find(x => x.name === sound.name)] }));
    assert.equal(result.added, 0); assert.equal(result.duplicates, 1); assert.equal(JSON.stringify(L.getSfx(imported.id)), before); assert.equal(L.isSfxEnabled(imported.id), false);
});
await test('reimport repairs only missing credits even after keyword edits', async () => {
    const row = S.settings().sfx.custom.find(x => x.id === imported.id); delete row.credit; row.words = ['user-edited']; row.loop = true; row.category = '사용자 분류'; const before = { ...row };
    const result = await L.importSfxPack(pack({ sounds: [sound], credits: [legacyCredit] })); assert.equal(result.added, 0); assert.equal(result.credited, 1); assert.equal(result.duplicates, 1);
    const after = L.getSfx(imported.id); delete after.credit; assert.deepEqual(after, before); assert.equal(L.isSfxEnabled(imported.id), false);
    const repeat = await L.importSfxPack(pack({ sounds: [sound], credits: [legacyCredit] })); assert.equal(repeat.added, 0); assert.equal(repeat.credited, 0);
});
await test('existing nonempty credit is not overwritten by a new pack', async () => {
    const result = await L.importSfxPack(pack({ sounds: [{ ...sound, credit: { ...legacyCredit, author: 'Other author' } }] }));
    assert.equal(result.added, 0); assert.equal(result.credited, 0); assert.equal(L.getSfx(imported.id).credit.author, legacyCredit.author);
});
await test('metadata synced without audio restores same id and existing edits', async () => {
    const row = S.settings().sfx.custom.find(x => x.id === imported.id); row.name = '사용자가 바꾼 이름'; delete row.credit;
    const repaired = await L.importSfxPack(pack({ sounds: [sound], credits: [legacyCredit] })); assert.equal(repaired.added, 0); assert.equal(repaired.credited, 1); assert.equal(L.getSfx(imported.id).name, '사용자가 바꾼 이름');
    const before = JSON.stringify(L.getSfx(imported.id)); records.delete(imported.id);
    const result = await L.importSfxPack(pack({ sounds: [sound], credits: [legacyCredit] }));
    assert.equal(result.added, 0); assert.equal(result.restored, 1); assert.equal(JSON.stringify(L.getSfx(imported.id)), before); assert.equal(L.isSfxEnabled(imported.id), false); assert.deepEqual(Buffer.from(await (await L.sfxBlob(imported.id)).arrayBuffer()), raw);
    const repeat = await L.importSfxPack(pack({ sounds: [sound], credits: [legacyCredit] })); assert.equal(repeat.restored, 0); assert.equal(repeat.added, 0);
});
await test('failed metadata save rolls back only newly restored audio', async () => {
    records.delete(imported.id); const before = JSON.stringify(S.settings().sfx), other = records.get('custom:original-123'); T.failSave = true;
    await assert.rejects(L.importSfxPack(pack({ sounds: [sound], credits: [legacyCredit] })), /synthetic save failure/); T.failSave = false;
    assert.equal(records.has(imported.id), false); assert.equal(records.get('custom:original-123'), other); assert.equal(JSON.stringify(S.settings().sfx), before);
    await L.importSfxPack(pack({ sounds: [sound], credits: [legacyCredit] }));
});
await test('custom attribution copied to WAV text states supplied provenance and edits', () => {
    const text = L.sfxAttribution([imported.id]); assert.ok(text.includes(valid.author)); assert.ok(text.includes(valid.licenseUrl)); assert.ok(text.includes('별도 검증 안 함')); assert.ok(text.includes('제공된 음원 변경 내역')); assert.ok(text.includes('반복/길이 조절·믹싱'));
    assert.ok(C.customSfxAttribution({ name: 'Unknown' }).includes('정보 없음'));
});
await test('ambiguous legacy records never attach credit to new audio', async () => {
    const different = Buffer.from('RIFF0000WAVEother synthetic testing audio'), next = { ...sound, name: '가상 중복 출처', data: 'data:audio/wav;base64,' + different.toString('base64') }, otherHash = Buffer.from(await crypto.subtle.digest('SHA-256', different)).toString('hex'), credit = { ...legacyCredit, name: next.name, sha256: otherHash };
    const result = await L.importSfxPack(pack({ sounds: [next], credits: [credit, { ...credit, author: 'Conflicting author' }] })); assert.equal(result.added, 1); assert.equal(L.listSfx().find(x => x.name === next.name).credit, undefined);
});
await test('WAV metadata builder embeds supplied attribution', async () => {
    const { wavWithCredits } = await mod('playback-details.js');
    const wav = new Uint8Array(44); wav.set(new TextEncoder().encode('RIFF'), 0); wav.set(new TextEncoder().encode('WAVE'), 8);
    const output = await wavWithCredits(new Blob([wav]), L.sfxAttribution([imported.id]));
    const value = new TextDecoder().decode(await output.arrayBuffer()); assert.ok(value.includes('ICMT')); assert.ok(value.includes(valid.author)); assert.ok(value.includes(valid.source));
});
await test('HTML in attribution stays text and only sanitized links enter the DOM', () => {
    class Node { constructor(tag) { this.tagName = tag; this.childNodes = []; this.attributes = {}; } append(...nodes) { this.childNodes.push(...nodes); } setAttribute(k,v) { this.attributes[k]=v; } set innerHTML(_) { throw Error('Imported HTML assignment forbidden'); } }
    globalThis.document = { createElement: tag => new Node(tag), createTextNode: value => ({ textContent: value }) };
    const node = C.sfxCreditElement({ name: '<img src=x onerror=alert(1)>', custom: true, credit: { author: '<svg onload=alert(2)>', license: '<script>x</script>', source: 'javascript:alert(1)', licenseUrl: valid.licenseUrl } });
    const all = node => [node,...(node.childNodes || []).flatMap(all)], nodes = all(node);
    assert.ok(nodes.some(x => x.textContent === '<svg onload=alert(2)> · <script>x</script>')); assert.equal(nodes.filter(x => x.tagName === 'a').length, 1); assert.equal(nodes.find(x => x.tagName === 'a').href, valid.licenseUrl); assert.equal(nodes.filter(x => ['script','img','svg'].includes(x.tagName)).length, 0);
});
console.log(`${passed} attribution groups passed`);
