// 한글화 패널 번역 메모리 내보내기 (8.2.7) — 전체 내보내기는 원문 본문을 대조 열쇠로 담으니 나누기 전에 묻고, 제목만 내보내기는 묻지 않는다
//   node tools/tests/prompt-memory-export.mjs <테마 루트>
// index.js 의 exportTM 을 잘라 vm 에서 돌린다 (가짜 캐시 · 다운로드 · 확인 창). 합성 자료만, 네트워크 · 파일 쓰기 없음.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const root = path.resolve(process.argv[2] || '.');
const source = fs.readFileSync(path.join(root, 'src/addons/prompt/index.js'), 'utf8');
const start = source.indexOf('function exportTM(scope) {'), end = source.indexOf('// ── Translation Memory (TM): import', start);
assert.ok(start > 0 && end > start, 'exportTM 을 찾지 못함');
const head = source.slice(source.lastIndexOf('\n', start) + 1, start);   // 'async ' 가 붙었는지까지

function setup({ answer = true } = {}) {
    const downloads = [], asks = [], toasts = [];
    const cache = new Map([['A::main', '### 메인\n\n번역 본문'], ['A::tone', '### 어조\n\n']]);
    const context = {
        items: [{ id: 'main', name: 'Main', content: 'Original body' }, { id: 'tone', name: 'Tone', content: 'Original tone' }, { id: 'rx', name: 'Regex', content: '', titleOnly: true }],
        ns: 'A', kind: 'preset', page: {}, idPfx: 'pt-preset',
        getCached: (ns, id) => cache.get(`${ns}::${id}`) ?? null,
        getTranslatedTitle: (ns, id) => ({ main: '메인', tone: '어조', rx: '정규식' })[id] ?? null,
        splitTitleAndBody: text => { const m = String(text).match(/^### (.+)\n\n([\s\S]*)$/); return m ? { title: m[1], body: m[2] } : { title: null, body: text }; },
        getSourceName: () => 'Sample', sanitizeFilename: s => s,
        downloadBlob: (blob, name) => downloads.push([name, blob.parts.join('')]),
        Blob: class { constructor(parts) { this.parts = parts; } },
        ask: async (message, opts) => { asks.push([message, opts]); return answer; },
        toastr: Object.fromEntries(['info', 'warning', 'error', 'success'].map(k => [k, m => toasts.push([k, m])])),
        JSON,
    };
    vm.runInNewContext(`${head}${source.slice(start, end)}\nglobalThis.exportTM = exportTM;`, context);
    return { context, downloads, asks, toasts };
}

let passed = 0;
async function test(name, fn) { await fn(); passed++; console.log('  ok  ' + name); }

await test('전체 내보내기: 원문이 들어간다고 먼저 묻고, 확인하면 원문 본문과 번역문을 담는다', async () => {
    const t = setup();
    await t.context.exportTM('full');
    assert.equal(t.asks.length, 1, '내보내기 전에 한 번 묻는다');
    assert.match(t.asks[0][0], /원문 1개/);
    assert.match(t.asks[0][0], /제목만 내보내기/);
    assert.equal(t.downloads.length, 1);
    const data = JSON.parse(t.downloads[0][1]);
    assert.equal(data.type, 'prompt-panel-tm');
    assert.deepEqual(data.entries.find(e => e.id === 'main'), { id: 'main', name: 'Main', content: 'Original body', nameTranslated: '메인', contentTranslated: '번역 본문' });
    assert.equal(data.entries.find(e => e.id === 'tone').content, undefined, '본문 번역이 없는 항목엔 원문을 넣지 않는다');
});

await test('전체 내보내기에서 취소하면 파일을 만들지 않는다', async () => {
    const t = setup({ answer: false });
    await t.context.exportTM('full');
    assert.equal(t.asks.length, 1);
    assert.equal(t.downloads.length, 0);
});

await test('제목만 내보내기는 원문 본문이 없어 묻지 않고 바로 만든다', async () => {
    const t = setup({ answer: false });
    await t.context.exportTM('title');
    assert.equal(t.asks.length, 0);
    assert.equal(t.downloads.length, 1);
    const data = JSON.parse(t.downloads[0][1]);
    assert.ok(data.entries.every(e => e.content === undefined && e.contentTranslated === undefined), '본문 · 번역 본문 없음');
    assert.equal(data.entries.length, 3);
});

console.log(`prompt memory export: ${passed} passed`);
