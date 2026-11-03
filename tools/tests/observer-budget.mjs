// 9.0.4 감시 상한(정적): 테마 · 애드온 런타임 JS 에서 문서 전체(body · html)나 채팅(#chat)을 subtree 로 「직접」 보는 MutationObserver 가 다시 생기지 않게 막아요.
//   그런 감시는 공용 감시 허브(src/dom-watch.js — 문서마다 감시자 하나 · #chat 가지치기) 구독이나, 채팅 메시지면 메시지 꾸미기(src/message-decor.js)로 해요.
//   내장 스크립트(src/scripts/** — iframe 갈래 몫)는 세기만 하고 막지 않아요. 세는 도구는 tools/audit/observers.mjs(node 안 acorn 을 --expose-internals 로 꺼내 써요).
//   상한: body · html subtree 직접 0 · #chat subtree 직접 0 · new MutationObserver 자리 80(9.0.4 끝에 74 — 늘릴 때는 이유를 적고 올려요)
//   node tools/tests/observer-budget.mjs [저장소]
import path from 'node:path';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const tool = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'audit', 'observers.mjs');
const env = { ...process.env, ACORN_PATH: '', ST_ROOT: '' };
const r = spawnSync(process.execPath, ['--expose-internals', '--no-warnings', tool, root, '--check', '--max-body', '0', '--max-chat', '0', '--max-new', '80'], { cwd: root, encoding: 'utf8', env });
process.stdout.write(r.stdout || '');
process.stderr.write(r.stderr || '');
if (r.status !== 0) { console.error('[실패] 감시 상한을 넘었어요 — 위 목록의 감시를 watchDom(…) 구독(채팅 밖이면 exclude: \'#chat\')이나 addMessageDecorator(…)로 옮겨요'); process.exit(1); }
const yml = fs.readFileSync(path.join(root, '.github/workflows/release-check.yml'), 'utf8');
if (!yml.includes('node tools/tests/observer-budget.mjs .')) { console.error('[실패] release-check.yml 에 등록해요'); process.exit(1); }
console.log('ok 감시 상한 안 · CI 등록');
