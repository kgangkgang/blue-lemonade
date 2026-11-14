// 채팅 캡처에 화면 조작 표시가 안 찍히는지 (캡처 정리): 리롤 배지 「R 2/2」 · 스와이프 번호 · 화살표 · 단추 줄 · 편집 연필 · 북마크 · 체크 · 그림 넘기기 번호
// 합성 메시지(실리태번 메시지 틀 모양)에서 stripCaptureUi 뒤에 본문 · 이름 · 꾸밈은 남고 조작 표시만 빠지는지 본다. 사용자 자료 없음.
// node tools/tests/capture-clean-ui.mjs [dev folder]
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
const root=process.argv[2]?pathToFileURL(path.resolve(process.argv[2])+'/'):new URL('../../',import.meta.url);
const {CAPTURE_SKIP,CAPTURE_MARK,stripCaptureUi}=await import(new URL('src/capture-layout.js',root));
// 아주 작은 DOM: 태그 · 클래스 · 속성 하나짜리 선택자만 (CAPTURE_SKIP 은 그 꼴만 쓴다 — 아래에서 확인)
const simple=/^(?:[a-z][a-z0-9-]*|\.[A-Za-z_][\w-]*|\[[a-z][\w-]*\])$/;
const parts=CAPTURE_SKIP.split(',');
for(const part of parts)assert.match(part,simple,`단순 선택자만: ${part}`);
const el=(tag,cls='',kids=[],attrs={},text='')=>{
    const node={tag,classes:cls.split(' ').filter(Boolean),attrs,children:[],parent:null,text,
        matchesOne(s){if(s[0]==='.')return this.classes.includes(s.slice(1));if(s[0]==='[')return Object.hasOwn(this.attrs,s.slice(1,-1));return this.tag===s;},
        matches(list){return list.split(',').some(s=>this.matchesOne(s));},
        querySelectorAll(list){const out=[];const walk=n=>{for(const c of n.children){if(c.matches(list))out.push(c);walk(c);}};walk(this);return out;},
        remove(){if(!this.parent)return;this.parent.children=this.parent.children.filter(c=>c!==this);this.parent=null;},
        get textContent(){return this.text+this.children.map(c=>c.textContent).join('');},
    };
    for(const k of kids){k.parent=node;node.children.push(k);}
    return node;
};
const message=()=>el('div','mes',[
    el('div','for_checkbox'),el('input','del_checkbox'),
    el('div','mesAvatarWrapper',[el('div','avatar',[el('img')]),el('div','mesIDDisplay',[],{},'#12'),el('div','mes_timer',[],{},'6.1s'),el('div','tokenCounterDisplay',[],{},'812t'),
        el('tlr-badge','tlr-badge tlr-tier-r',[],{'data-tlr-look':''},'R 2/2')]),
    el('div','swipe_left fa-chevron-left'),
    el('div','mes_block',[
        el('div','ch_name',[el('span','name_text',[],{},'보낸이'),el('i','mes_ghost'),el('small','timestamp',[],{},'2026-11-14'),
            el('div','mes_buttons',[el('div','mes_button extraMesButtonsHint'),el('div','extraMesButtons',[el('div','mes_button mes_copy')]),
                el('div','mes_button bl-pinned',[],{},'★'),el('div','mes_button mes_bookmark'),el('div','mes_button mes_edit',[],{},'✎')]),
            el('div','mes_edit_buttons',[el('div','mes_edit_done menu_button')])]),
        el('details','mes_reasoning_details',[el('summary','mes_reasoning_summary',[el('span','mes_reasoning_header_title',[],{},'생각'),el('span','llmt-rsn-meta',[],{},'1,204자 · 영어'),
            el('div','mes_reasoning_actions',[el('div','mes_reasoning_copy mes_button')])]),el('div','llmt-rsn-bar',[el('button','menu_button llmt-rsn-btn',[],{},'번역해서 보기')]),el('div','mes_reasoning',[],{},'생각 본문')]),
        el('div','mes_text',[el('div','llmt-progress',[],{},'번역 중 2/5'),el('p','',[],{},'본문 첫 문단'),el('div','bl-weather-deco',[],{},'날씨'),
            el('span','future-chip',[],{'data-bl-no-capture':''},'새 칩'),el('span','other-chip bl-no-capture',[],{},'클래스 칩')]),
        el('div','mes_media_wrapper',[el('div','mes_img_container',[el('div','mes_img_controls',[el('div','mes_media_enlarge')]),el('img','mes_img')]),
            el('div','mes_img_swipes',[el('div','mes_img_swipe_left'),el('div','mes_img_swipe_counter',[],{},'1/3'),el('div','mes_img_swipe_right')])]),
        el('div','mes_file_wrapper',[el('div','mes_file_container',[el('div','mes_file_name',[],{},'메모.txt'),el('div','mes_file_open'),el('div','mes_file_delete')])]),
    ]),
    el('div','swipeRightBlock',[el('div','swipe_right'),el('div','swipes-counter',[],{},'2/2')]),
]);
let passed=0;const test=(name,fn)=>{fn();passed++;console.log('PASS '+name);};
const gone=[ 'for_checkbox','del_checkbox','tlr-badge','swipe_left','swipe_right','swipeRightBlock','swipes-counter','mes_ghost','mes_buttons','mes_button','mes_edit','mes_bookmark','mes_edit_buttons',
    'mes_reasoning_actions','llmt-rsn-meta','llmt-rsn-bar','llmt-progress','mes_img_controls','mes_img_swipes','mes_img_swipe_counter','mes_file_open','mes_file_delete','future-chip','other-chip'];
test('조작 표시는 하나도 안 남는다',()=>{const m=stripCaptureUi(message());for(const cls of gone)assert.equal(m.querySelectorAll('.'+cls).length,0,`.${cls} 이 남음`);assert.equal(m.querySelectorAll('tlr-badge').length,0);});
test('「R 2/2」 · 스와이프 번호 · 그림 번호 글자가 그림 글에 없다',()=>{const t=stripCaptureUi(message()).textContent;for(const s of ['R 2/2','2/2','1/3','✎','★','번역 중','번역해서 보기','1,204자','새 칩','클래스 칩'])assert.ok(!t.includes(s),`「${s}」 이 남음`);});
test('본문 · 이름 · 날씨 꾸밈 · 생각 본문 · 파일 이름 · 그림은 그대로',()=>{const m=stripCaptureUi(message()),t=m.textContent;for(const s of ['보낸이','본문 첫 문단','날씨','생각 본문','메모.txt','2026-11-14'])assert.ok(t.includes(s),`「${s}」 이 빠짐`);assert.equal(m.querySelectorAll('.mes_img').length,1);assert.equal(m.querySelectorAll('.avatar').length,1);});
test('정보 줄 번호 · 토큰 · 시간은 「표시할 항목」 켜고 끄기에 맡긴다(여기서 지우지 않음)',()=>{const m=stripCaptureUi(message());for(const cls of ['mesIDDisplay','tokenCounterDisplay','mes_timer'])assert.equal(m.querySelectorAll('.'+cls).length,1);});
test('표지(속성 · 클래스)가 빼는 목록에 들어 있다',()=>{for(const s of CAPTURE_MARK.split(','))assert.ok(parts.includes(s),s);});
test('칠하기(copyPaint)와 사본 떼기가 같은 목록을 쓴다',()=>{const src=fs.readFileSync(new URL('src/chat-capture.js',root),'utf8');assert.match(src,/source\.matches\(CAPTURE_SKIP\)/);assert.match(src,/stripCaptureUi\(clone\)/);assert.doesNotMatch(src,/'script,iframe,video,audio,\.mes_buttons/,'옛 손 목록이 남음');});
console.log(`capture clean ui: ${passed} checks passed`);
