import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';

const root = path.resolve(process.argv[2] || '.');
const { Installer } = await import(pathToFileURL(path.join(root, 'server-plugin/blue-lemonade-zip/install.mjs')));
async function fixture(folder = 'sample', display_name = 'Sample') {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'bl-zip-remove-')), base = path.join(dir, 'extensions');
    const target = path.join(base, folder); await fs.mkdir(path.join(target, '.git'), { recursive: true });
    await fs.writeFile(path.join(target, 'manifest.json'), JSON.stringify({ display_name, version: '1.0.0', js: 'index.js' }));
    await fs.writeFile(path.join(target, 'index.js'), '/* sample extension */');
    await fs.writeFile(path.join(target, '.git/config'), 'saved git metadata');
    await fs.writeFile(path.join(target, 'saved.json'), 'saved extension data');
    await fs.writeFile(path.join(dir, 'settings.json'), 'separate settings');
    await fs.mkdir(path.join(dir, 'chats')); await fs.writeFile(path.join(dir, 'chats/sample.jsonl'), 'separate chat');
    return { dir, base, target };
}
const present = p => fs.access(p).then(() => true, () => false);
async function tree(dir) {
    const out = {};
    for (const item of await fs.readdir(dir, { withFileTypes: true })) {
        const p = path.join(dir, item.name);
        if (item.isDirectory()) for (const [n, d] of Object.entries(await tree(p))) out[item.name + '/' + n] = d;
        else out[item.name] = (await fs.readFile(p)).toString('base64');
    }
    return out;
}

test('preview leaves files intact; removal survives restart; restore preserves all bytes and external data', async () => {
    const { dir, base, target } = await fixture(), m = new Installer(), original = await tree(target);
    assert.equal((await m.manageable(base))[0].protected, false);
    const p = await m.removalPreview(base, 'one', 'sample');
    assert.deepEqual(await tree(target), original); assert.equal(p.files, 4);
    const result = await m.remove(base, 'one', p.token);
    assert.equal(result.removed, true); assert.equal(await present(target), false);
    const restarted = new Installer(); assert.deepEqual(await restarted.manageable(base), []);
    const backups = await restarted.backups(base); assert.equal(backups.length, 1); assert.equal(backups[0].action, 'remove');
    assert.equal(backups[0].id, result.backup);
    await restarted.restore(base, result.backup); assert.deepEqual(await tree(target), original);
    assert.equal(await fs.readFile(path.join(dir, 'settings.json'), 'utf8'), 'separate settings');
    assert.equal(await fs.readFile(path.join(dir, 'chats/sample.jsonl'), 'utf8'), 'separate chat');
    await assert.rejects(m.remove(base, 'one', p.token), /다시 골라/);
});

test('wrong owner/base/kind, expired and stale removal plans cannot remove a folder', async () => {
    const { base, target } = await fixture(), other = await fixture(), m = new Installer();
    let p = await m.removalPreview(base, 'one', 'sample');
    await assert.rejects(m.remove(base, 'two', p.token));
    await assert.rejects(m.remove(other.base, 'one', p.token));
    await assert.rejects(m.install(base, 'one', p.token));
    m.plans.get(p.token).expires = 0; await assert.rejects(m.remove(base, 'one', p.token));
    p = await m.removalPreview(base, 'one', 'sample');
    await fs.writeFile(path.join(target, 'new.txt'), 'changed after preview');
    await assert.rejects(m.remove(base, 'one', p.token), /바뀌/);
    assert.equal(await fs.readFile(path.join(target, 'new.txt'), 'utf8'), 'changed after preview');
    const invalid = m.reserve(base, 'one', { kind: 'install' }); await assert.rejects(m.remove(base, 'one', invalid));
    assert.equal(await present(target), true);
});

test('invalid paths, non-extensions and theme self-removal are blocked', async () => {
    const { base, target } = await fixture(), m = new Installer();
    for (const folder of ['../sample', '..', '/sample', 'C:\\sample', 'SAMPLE', 'missing']) await assert.rejects(m.removalPreview(base, 'one', folder));
    await fs.mkdir(path.join(base, 'not-extension')); await assert.rejects(m.removalPreview(base, 'one', 'not-extension'));
    for (const [folder, name] of [['blue-lemonade', 'renamed'], ['renamed-theme', 'Blue Lemonade']]) {
        const f = await fixture(folder, name); assert.equal((await m.manageable(f.base))[0].protected, true);
        await assert.rejects(m.removalPreview(f.base, 'one', folder), /블루레몬/); assert.equal(await present(f.target), true);
    }
    assert.equal(await present(target), true);
});

test('junctions and symlinks never move linked data', async () => {
    const { base, target } = await fixture(), external = await fixture(), m = new Installer();
    await fs.symlink(external.target, path.join(base, 'linked'), 'junction');
    assert.equal((await m.manageable(base)).some(x => x.folder === 'linked'), false);
    await assert.rejects(m.removalPreview(base, 'one', 'linked'), /링크/);
    await fs.symlink(external.target, path.join(target, 'nested-link'), 'junction');
    await assert.rejects(m.removalPreview(base, 'one', 'sample'), /링크/);
    assert.equal(await present(path.join(external.target, 'saved.json')), true);
});

test('journal failure restores original immediately; interrupted removal recovers next access', async () => {
    const { base, target } = await fixture(), original = await tree(target);
    const m = new Installer({ beforeRemoveCommit: () => { throw Error('simulated journal failure'); } });
    const p = await m.removalPreview(base, 'one', 'sample'); await assert.rejects(m.remove(base, 'one', p.token), /simulated/);
    assert.deepEqual(await tree(target), original);
    const box = path.join(base, '../.blue-lemonade-zip', randomUUID()); await fs.mkdir(box);
    await fs.writeFile(path.join(box, 'record.json'), JSON.stringify({ folder: 'sample', action: 'remove', pending: true, date: new Date().toISOString() }));
    await fs.rename(target, path.join(box, 'files'));
    await new Installer().manageable(base); assert.deepEqual(await tree(target), original);
});

test('concurrent removal, restore and install cannot interleave', async () => {
    const { base, target } = await fixture(), m = new Installer(); let release;
    const p = await m.removalPreview(base, 'one', 'sample');
    const blocked = m.locked(base, () => new Promise(r => { release = r; }));
    await assert.rejects(m.remove(base, 'one', p.token), /진행 중/);
    await assert.rejects(m.restore(base, randomUUID()), /진행 중/);
    await assert.rejects(m.install(base, 'one', 'missing'), /진행 중/);
    release(); await blocked; assert.equal(await present(target), true);
});
