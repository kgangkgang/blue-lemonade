// 놓쳤던 실리태번 기본 제목 링크를 공통 도움말 규칙에서 다시 제외하지 않도록 확인해요.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(process.argv[2]||'.'),css=fs.readFileSync(path.join(root,'css/56-control-consistency.css'),'utf8');
const native=':where(#WorldInfo h3 > a.notes-link)';
const rules=[...css.replace(/\/\*[\s\S]*?\*\//g,'').matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(m=>({selector:m[1],body:m[2]}));
const shared=rules.filter(r=>r.selector.includes('.bl-wi-help')&&r.selector.includes(native));
assert.ok(shared.some(r=>r.body.includes('width:1.25em')&&r.body.includes('background:transparent')),'기본 제목 링크도 같은 크기·투명 바탕을 써야 해요');
assert.ok(shared.some(r=>r.selector.includes('::after')&&r.body.includes('var(--salty-mi-help)')),'기존 선 원 물음표를 재사용해야 해요');
assert.ok(shared.some(r=>r.selector.includes('::before')&&r.body.includes('44px')),'모바일 누르는 칸도 함께 적용해야 해요');
assert.ok(shared.some(r=>r.selector.includes(':focus-visible')),'링크의 키보드 초점을 표시해야 해요');
assert.ok(rules.some(r=>r.selector.includes('#WorldInfo h3 > a.notes-link > .note-link-span')&&r.body.includes('opacity:0')),'회색 채움 글리프가 새 그림과 겹치면 안 돼요');
assert.ok(rules.some(r=>r.selector.trim()==='html body.salty #WorldInfo h3 > a.notes-link'&&r.body.includes('font-size:var(--bl-fs-body)')&&r.body.includes('margin:0')),'제목 간격과 메뉴 글자 비례를 유지해야 해요');
assert.ok(rules.some(r=>r.selector.trim()==='html body.salty #WorldInfo > .flex-container > h3'&&r.body.includes('gap:6px')),'일반 머리줄 규칙이 제목의 6px 간격을 덮지 않아야 해요');
console.log('월드인포 제목 도움말 누락 방지 7검사를 통과했어요.');
