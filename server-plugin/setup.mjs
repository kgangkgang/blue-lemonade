#!/usr/bin/env node
// Run once from the SillyTavern folder: node "path/to/this/setup.mjs"
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { safeDirectory } from './blue-lemonade-zip/install.mjs';
async function findRoot() {
    if (process.argv[2]) return path.resolve(process.argv[2]);
    const candidates = [process.cwd()];
    for (let p = path.dirname(fileURLToPath(import.meta.url));;) { candidates.push(p); const parent = path.dirname(p); if (parent === p) break; p = parent; }
    for (const candidate of candidates) {
        try { if (JSON.parse(await fs.readFile(path.join(candidate, 'package.json'), 'utf8')).name === 'sillytavern') return candidate; } catch { /* Try the next parent. */ }
    }
    throw Error('테마를 실리태번 확장 폴더에 먼저 넣어 주세요. 또는 SillyTavern 폴더에서 이 명령을 실행해 주세요.');
}
try {
    const root = await findRoot();
    await safeDirectory(root);
    const pkg = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8'));
    if (pkg.name !== 'sillytavern') throw Error('실리태번 폴더에서 실행해 주세요.');
    const require = createRequire(path.join(root, 'package.json')), YAML = require('yaml');
    require('yauzl');
    const config = path.join(root, 'config.yaml'), stat = await fs.lstat(config);
    if (!stat.isFile() || stat.isSymbolicLink()) throw Error('일반 config.yaml 파일이 필요해요.');
    const original = await fs.readFile(config, 'utf8'), doc = YAML.parseDocument(original);
    if (doc.errors.length) throw Error('config.yaml 문법 오류를 먼저 고쳐 주세요.');
    const plugins = path.join(root, 'plugins'); await fs.mkdir(plugins, { recursive: true }); await safeDirectory(plugins);
    const others = (await fs.readdir(plugins, { withFileTypes: true })).filter(e => !e.name.startsWith('.') && e.name !== 'blue-lemonade-zip' && (e.isDirectory() || /\.[cm]?js$/i.test(e.name)));
    if (doc.get('enableServerPlugins') !== true && others.length) throw Error('다른 서버 플러그인이 있어요. config.yaml의 enableServerPlugins를 true로 바꾸면 함께 켜지므로, 직접 확인한 뒤 이 명령을 다시 실행해 주세요.');
    const source = path.join(path.dirname(fileURLToPath(import.meta.url)), 'blue-lemonade-zip');
    await safeDirectory(source);
    const backupRoot = path.join(root, '.blue-lemonade-zip-setup'); await fs.mkdir(backupRoot, { recursive: true }); await safeDirectory(backupRoot);
    const backup = path.join(backupRoot, randomUUID()); await fs.mkdir(backup);
    await fs.copyFile(config, path.join(backup, 'config.yaml'));
    const target = path.join(plugins, 'blue-lemonade-zip');
    const stage = path.join(backup, 'new-plugin'); await fs.mkdir(stage);
    for (const name of ['index.mjs', 'archive.mjs', 'install.mjs']) {
        const file = path.join(source, name), s = await fs.lstat(file);
        if (!s.isFile() || s.isSymbolicLink()) throw Error('도우미 파일을 다시 받아 주세요.');
        await fs.copyFile(file, path.join(stage, name));
    }
    let moved = false;
    try { await fs.lstat(target); await safeDirectory(target); await fs.rename(target, path.join(backup, 'old-plugin')); moved = true; }
    catch (e) { if (e.code !== 'ENOENT') throw e; }
    try { await fs.rename(stage, target); }
    catch (e) { if (moved) await fs.rename(path.join(backup, 'old-plugin'), target); throw e; }
    doc.set('enableServerPlugins', true);
    if (await fs.readFile(config, 'utf8') !== original) throw Error('작업 중 config.yaml이 바뀌었어요. 기존 설정을 보존했으니 명령을 다시 실행해 주세요.');
    const nextConfig = path.join(root, `config.blzip-${randomUUID()}.tmp`);
    try { await fs.writeFile(nextConfig, String(doc), { flag: 'wx' }); await fs.rename(nextConfig, config); }
    finally { await fs.unlink(nextConfig).catch(() => {}); }
    console.log('ZIP 도우미를 준비했어요. 실리태번 서버를 완전히 종료한 뒤 다시 켜 주세요.');
    console.log('원래 설정과 이전 도우미 백업:', backup);
} catch (error) { console.error(error.message); process.exitCode = 1; }
