// 9.0.6 런타임 JS 가 선언 · import 도 없고 브라우저 · 실리태번 전역도 아닌 이름을 읽지 않는지 (읽으면 그 경로가 ReferenceError 로 멈춘다).
// 9.0.1 그라데이션 정리가 src/gradient-ui.js 를 지웠는데 설정 창 「색」 탭이 mixControls 를 계속 불렀고,
// 내장했던 확장 하나는 정의 없는 이름을 읽어 답이 오지 않았다(9.0.6 감사). 범위 분석은 tools/audit/undeclared.mjs,
// 구문 분석기는 node 안에 든 acorn 을 --expose-internals 로 꺼내 쓴다(설치할 것 없음).
//   node tools/tests/module-undeclared.mjs [저장소]
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const tool = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'audit', 'undeclared.mjs');
const env = { ...process.env, ACORN_PATH: '', ST_ROOT: '' };
const r = spawnSync(process.execPath, ['--expose-internals', '--no-warnings', tool, root, '--strict'], { cwd: root, encoding: 'utf8', env });
process.stdout.write(r.stdout || '');
process.stderr.write(r.stderr || '');
if (r.status !== 0) { console.error('[실패] 정의 없는 이름을 읽는 곳이 있어요 — 위 목록을 고치거나, 다른 확장 · 최신 브라우저 전역이면 undeclared.mjs 의 OPTIONAL_GLOBALS 에 이유와 함께 더해요'); process.exit(1); }
console.log('ok 정의 없는 이름 0');
