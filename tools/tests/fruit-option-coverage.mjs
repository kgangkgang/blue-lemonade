// 과일 계열 세 프리셋(과일 6.4 · 야한 과일 2.0 · 청과 2.0)의 모든 항목에 길게 누르기 도움말이 있는지 — 본문 지문이 사전에 있어야 「확인된 설명」으로 떠요.
//   node tools/tests/fruit-option-coverage.mjs [테마 루트]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const root=path.resolve(process.argv[2]||'.');
const {FRUIT_OPTION_EFFECTS,FRUIT_OPTION_BASELINES}=await import(pathToFileURL(path.join(root,'src/scripts/fruit-option-effects.js')));
const source=JSON.parse(fs.readFileSync(path.join(root,'tools/scripts-src/fruit-family/option-effects.json'),'utf8'));
const fixture=JSON.parse(fs.readFileSync(path.join(root,'tools/tests/fruit-option-presets.json'),'utf8'));
// 생성 파일 = 원본 json
assert.deepEqual(FRUIT_OPTION_EFFECTS,source.effects,'fruit-option-effects.js 가 option-effects.json 과 달라요 — node tools/build-fruit-family.mjs');
assert.deepEqual(FRUIT_OPTION_BASELINES,source.baselines);
// 세 프리셋의 항목마다 본문 지문(확인된 설명) + id 기본 설명 둘 다
let total=0;const missing=[];
for(const [preset,items] of Object.entries(fixture.presets)){
    assert(items.length>=250,`${preset} 고정물이 너무 짧아요`);
    for(const it of items){
        total++;
        if(!it.hash)continue; // 빈 본문은 코드가 「내용이 없는 구분 항목」으로 설명해요
        if(!FRUIT_OPTION_EFFECTS[it.hash])missing.push(`${preset}: ${it.name} (지문 없음)`);
        if(!FRUIT_OPTION_BASELINES[it.id])missing.push(`${preset}: ${it.name} (id 기본 설명 없음)`);
    }
}
assert.deepEqual(missing,[],`도움말이 빠진 항목 ${missing.length}개`);
// 설명 글 자체: 해요체 문장 · 길이 · 금지어 · 영어 문장 없음
// 금지어는 글자 코드로 만들어요(이 시험 파일이 출하 검사의 금지어 검사에 걸리지 않게)
const W=(...c)=>String.fromCharCode(...c);
const BANNED=new RegExp([W(0xCC10,0xBE60),W(0xAC24)+"\\b",W(0xBC84,0xADF8,0x20,0xC5C6,0xC74C),"\\d+"+W(0xBC30)+" "].join("|"));
for(const [kind,map] of [['effects',FRUIT_OPTION_EFFECTS],['baselines',FRUIT_OPTION_BASELINES]]){
    for(const [key,text] of Object.entries(map)){
        assert(typeof text==='string'&&text.length>=15&&text.length<=240,`${kind} ${key.slice(0,12)} 길이 ${text.length}`);
        assert(/(?:요|다|니다)[.)）]*$/.test(text.trim()),`${kind} ${key.slice(0,12)} 해요체로 끝나지 않아요: ${text.slice(-20)}`);
        assert(!BANNED.test(text),`${kind} ${key.slice(0,12)} 금지어: ${text}`);
        assert(!/\b[A-Za-z]+(?:\s+[A-Za-z]+){4,}\b/.test(text),`${kind} ${key.slice(0,12)} 영어 문장: ${text}`);
    }
}
console.log(`Fruit option coverage: ${Object.keys(fixture.presets).length} presets, ${total} items, ${Object.keys(FRUIT_OPTION_EFFECTS).length} verified bodies, ${Object.keys(FRUIT_OPTION_BASELINES).length} baselines, ${missing.length} missing`);
