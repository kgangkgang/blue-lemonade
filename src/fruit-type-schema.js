// Known renderer structures only. Names match the bundled Fruit localization dictionary.
export const FRUIT_TYPES = [

    {id:'status',prompt:'cc526ae2-8d33-4cee-9f86-1629a13bb6c0',aliases:['5472f208-b696-4f5b-a32e-025d0ef8da82'],name:'🍏 Top-글머리 문구｜본문 앞 상태창 택1 @鸦',root:'.fate-status-wrapper',regions:{info:['날짜 · 시간 · 장소 · 날씨','.fate-top-grid'],quote:['장면 인용문','.movie-line-content'],names:['인물 이름 줄','.fate-outfit-label'],footer:['하단 고정 문구','.fate-bottom-en']},layout:true},
    {id:'compact',prompt:'67dbe0dc-f188-444d-a812-379088c1a7ee',name:'🍏 Top-간결｜본문 앞 상태창 택1 @小鱼 @yuki',root:'#statusBar.dynamic-status-container',regions:{info:['시간 · 장소 · 날씨','.line-1,.line-2'],quote:['짧은 문구','.line-3']},layout:true},
    {id:'single',prompt:'7be20e56-40e9-478c-8363-872318e96c77',name:'🍏 1인 상태창 @小夜',root:'.swiss-island',regions:{info:['세부 정보 값','.detail-value,.tag-box,.text-desc'],quote:['대사 말풍선','.speech-bubble'],names:['인물 이름','.main-title,.capsule-title'],footer:['상태 표시','.status-badge']},layout:false},
    {id:'novel',prompt:'94863b1a-5f51-4483-bb6c-f05aca62743a',name:'🍏 소설 제목 @蛾摩拉',root:'.novel-header-container',regions:{info:['관계 · 장소 · 태그','#novel-meta-container,.novel-tags-wrapper'],quote:['글머리 문구','.novel-preface'],names:['장 번호 · 제목','.novel-chapter-num,.novel-title']},layout:false},
    {id:'prologue',prompt:'d1eeda8f-9e49-4d32-8d4a-5854410e4d8a',name:'🍏 첫머리 서문｜서문 택1 @NUE @yuki',root:'.vintage-prologue',regions:{quote:['서문','#main-text-container'],footer:['출처','#prologue-source']},layout:false},
    {"id": "qingguo-forum", "prompt": "32e14959-2f33-403c-9ac7-e47a3653f03d", "name": "청과 · 방송 포럼", "owner": "qingguo", "root": ".forum-container:has(.live-indicator):has(.subject-info)", "regions": {"info": ["방송 정보·댓글", ".subject-info,.comment-text"], "names": ["제목·작성자", ".forum-title,.comment-author"], "footer": ["방송 표시·동작", ".live-indicator,.comment-actions"]}, "layout": false},
    {"id": "qingguo-board", "prompt": "95badcf5-e6f5-41ab-8ed9-df7d90e18cf0", "name": "청과 · 소문 게시판", "owner": "qingguo", "root": ".rumor-board", "regions": {"info": ["게시글·댓글", ".post-body,.comment-body"], "names": ["제목·작성자", ".post-title,.user-id"], "footer": ["시간·부가 정보", ".timestamp,.comment-meta"]}, "layout": false},
    {"id": "qingguo-mailbox", "prompt": "3ad7662a-006b-4a87-b4be-099215ffd122", "name": "청과 · 편지함", "owner": "qingguo", "root": ".mbox:has(.m-head .m-title):has(.m-scroll)", "regions": {"info": ["편지 내용", ".sms-content"], "names": ["제목·발신자", ".m-title,.sms-id"], "footer": ["시간·상태", ".sms-time,.m-status,.m-foot"]}, "layout": false},
    {"id": "deus-tracker", "prompt": "tracker", "name": "시간 표시", "owner": "deus", "root": ":is(.dem-track,.dem-track-recovery,.dem-tracker)", "regions": {"info": ["시간 · 날짜 · 장소 · 날씨", ".dem-track__value,.dem-track-recovery__value,.dem-track__temp,.dem-track-recovery__temp,.dem-track__clock,.dem-track__date,.dem-track__place,.dem-track__sky,.dem-tracker .dem-card__body"]}, "layout": true},
    {"id": "deus-status", "prompt": "403539e4-e530-43a1-be30-5d5bd33d4d5e", "name": "상태창", "owner": "deus", "root": ".dem-status", "regions": {"info": ["상태 값", ".dem-status-row__value,.dem-card__body"], "names": ["인물 이름", ".dem-status-row__name"], "quote": ["제목", ".dem-card__title"]}, "layout": false},
    {"id": "deus-threads", "prompt": "ab70a374-f6f5-4e5c-a1c6-1596a4397806", "name": "스토리 떡밥", "owner": "deus", "root": ".dem-threads", "regions": {"info": ["떡밥 기록", ".dem-threads__body,.dem-card__body"], "names": ["제목", ".dem-card__title"]}, "layout": false},
    {"id": "deus-psych", "prompt": "7eb033d6-2036-4c5a-9b3a-d22d1d6da7b8", "name": "심리 상태", "owner": "deus", "root": ".dem-psychological-states", "regions": {"info": ["심리 기록", ".dem-psychological-states__body,.dem-card__body"], "names": ["인물 이름", ".dem-psychological-state-row__name"], "quote": ["제목", ".dem-card__title"]}, "layout": false},
    {"id": "deus-plot", "prompt": "9f4e7a1c-2b63-4d80-a5e7-91c3f6b8d204", "name": "줄거리 흐름", "owner": "deus", "root": ".dem-plotlines", "regions": {"info": ["줄거리 기록", ".dem-plotlines__body,.dem-card__body"], "names": ["제목", ".dem-card__title"]}, "layout": false},
    {"id": "deus-momentum", "prompt": "tension", "name": "모멘텀 엔진", "owner": "deus", "root": ".dem-momentum-engine", "regions": {"info": ["전개 경로", ".dem-momentum-engine__body,.dem-card__body"], "names": ["제목", ".dem-card__title"]}, "layout": false},
    {"id": "deus-conflict", "prompt": "fff18557-018d-4856-9497-2f47a6ef2b2a", "name": "갈등 블록", "owner": "deus", "root": ".dem-conflict", "regions": {"info": ["갈등 내용", ".dem-card__body,details,> :not(summary)"], "names": ["제목", ".dem-card__title"]}, "layout": false},
];
export const FRUIT_UNSUPPORTED = ['🍏 하단 상태창｜카드에 상태창이 있을 때만','🍏 캐릭터 표 @YUKI','📌 요약｜필수 @喵喵电波'];
// 8.0.6 실리태번은 채팅 메시지 안 HTML 의 class 마다 「custom-」을 붙여요(.dem-track → .custom-dem-track).
//   데우스 상태창은 채팅 본문에 바로 그려져 접두어가 붙고, 과일 계열은 TavernHelper iframe 안이라 원래 이름 그대로예요.
//   선택자의 class 하나하나를 두 이름 모두로 받아요(무게는 class 하나 그대로).
export const stSelector=selector=>String(selector).replace(/\.(-?[_a-zA-Z][\w-]*)/g,(m,name)=>name.startsWith('custom-')?m:`:is(.${name},.custom-${name})`);
const matchCache=new Map();
export const typeMatch=type=>{let s=matchCache.get(type.root);if(!s)matchCache.set(type.root,s=stSelector(type.root));return s;};
// 규칙 모음(중첩 없는 CSS)의 선택자 부분만 두 이름으로 바꿔요 — 값(1.6 · 22px)은 건드리지 않아요.
export const stCss=css=>String(css).replace(/(^|[}\n])([^{}]+)\{/g,(m,head,sel)=>`${head}${stSelector(sel)}{`);
export const REGION_DEFAULT = Object.freeze({on:false,font:'original',size:16,weight:400,italic:false,spacing:0,line:1.6,align:'original',wrap:'original'});
export const typeOwner=type=>type.owner==='deus'?'deus':'fruit';
export const ownerEnabled=(s,owner)=>s.ownerOn?.[owner]??s.on;
export const anyTypeEnabled=s=>ownerEnabled(s,'fruit')||ownerEnabled(s,'deus');
export const layoutChoices=type=>type.id==='status'?[['original','가로 · 원작 배치'],['vertical','세로 · 한 줄씩']]:type.id==='compact'?[['original','세로 · 원작 배치'],['horizontal','가로 · 두 칸']]:[['original','가로 · 원작 줄바꿈'],['vertical','세로 · 한 줄씩']];
const number=(v,min,max,fallback)=>Number.isFinite(Number(v))?Math.min(max,Math.max(min,Number(v))):fallback;
export function tidyFruitType(value) {
    const source=value&&typeof value==='object'&&!Array.isArray(value)?value:{};
    const result={on:source.on===true,kind:FRUIT_TYPES.some(x=>x.id===source.kind)?source.kind:'status',ownerOn:{},ownerKinds:{},types:{}};
    for(const owner of ['fruit','deus']){if(typeof source.ownerOn?.[owner]==='boolean')result.ownerOn[owner]=source.ownerOn[owner];const types=FRUIT_TYPES.filter(t=>typeOwner(t)===owner);result.ownerKinds[owner]=types.find(t=>t.id===source.ownerKinds?.[owner])?.id||types.find(t=>t.id===source.kind)?.id||types[0].id;}
    for(const type of FRUIT_TYPES){
        const old=source.types?.[type.id]||{},row={layout:['original','horizontal','vertical'].includes(old.layout)?old.layout:'original',hideFooter:old.hideFooter===true,regions:{}};
        if(type.layout&&!layoutChoices(type).some(([key])=>key===row.layout))row.layout='original';
        if(type.id==='compact')row.previewStyle=['present','olden','scifi'].includes(old.previewStyle)?old.previewStyle:'present';
        for(const key of Object.keys(type.regions)){
            const r=old.regions?.[key]||{};
            row.regions[key]={on:r.on===true,font:typeof r.font==='string'&&/^[\w-]{1,100}$/.test(r.font)?r.font:'original',size:number(r.size,8,64,16),weight:number(r.weight,100,900,400),italic:r.italic===true,spacing:number(r.spacing,-2,12,0),line:number(r.line,.8,4,1.6),align:['original','left','center','right','justify'].includes(r.align)?r.align:'original',wrap:['original','word','anywhere','nowrap'].includes(r.wrap)?r.wrap:'original'};
        }
        result.types[type.id]=row;
    }
    return result;
}
export function fruitTypeCss(value, fontFamily = ()=>'') {
    const s=tidyFruitType(value);if(!anyTypeEnabled(s))return '';
    const rules=[];
    for(const type of FRUIT_TYPES){
        if(!ownerEnabled(s,typeOwner(type)))continue;
        const config=s.types[type.id];
        if(type.layout&&config.layout!=='original'){
            if(type.id==='deus-tracker')rules.push(`${type.root}{display:grid!important;grid-template-columns:${config.layout==='vertical'?'minmax(0,1fr)':'repeat(4,minmax(0,1fr))'}!important;gap:8px!important}${type.root} :is(.dem-track__item,.dem-track-recovery__item){min-width:0!important}`,
                // 8.0.6 데우스 V3: 칸은 안쪽 .dem-track__grid 가 나눠요 — 세로면 시각 · 날씨 · 날짜 · 장소를 한 줄씩
                config.layout==='vertical'?`${type.root} .dem-track__grid{grid-template-columns:minmax(0,1fr)!important;grid-template-areas:"time" "wx" "date" "place"!important}${type.root} .dem-track__time{padding-right:0!important;border-right:0!important}${type.root} .dem-track__wx{flex-direction:row!important;align-items:center!important;justify-content:flex-start!important;text-align:left!important}${type.root} .dem-track__place--context{grid-row:auto!important}`:'');
            else if(type.id==='status')rules.push(`${type.root} .fate-top-grid{display:grid!important;grid-template-columns:${config.layout==='vertical'?'minmax(0,1fr)':'repeat(4,minmax(0,1fr))'}!important}${type.root} .fate-grid-item{min-width:0!important}`);
            else rules.push(`${type.root} .status-bar-content{display:${config.layout==='vertical'?'flex':'grid'}!important;flex-direction:column!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:8px!important}${type.root} .line-3{grid-column:1/-1}`);
        }
        for(const [key,[,selector]] of Object.entries(type.regions)){
            const r=config.regions[key];if(!r.on)continue;
            const targets=selector.split(',').map(x=>`${type.root} ${x}`).join(','),family=fontFamily(r.font);
            const declarations=[`font-size:${r.size}px!important`,`font-weight:${r.weight}!important`,`font-style:${r.italic?'italic':'normal'}!important`,`letter-spacing:${r.spacing}px!important`,`line-height:${r.line}!important`];
            if(family)declarations.push(`font-family:${family}!important`);
            // Renderers center through flex/grid boxes as well as text-align, so move those boxes with the text.
            const flex={left:'flex-start',center:'center',right:'flex-end',justify:'flex-start'}[r.align],cell={left:'start',center:'center',right:'end',justify:'stretch'}[r.align];
            if(r.align!=='original'){declarations.push(`text-align:${r.align}!important`,`justify-content:${flex}!important`,`justify-items:${cell}!important`);rules.push(`${selector.split(',').map(x=>`${type.root} ${x} *`).join(',')}{text-align:inherit!important}`);}
            if(r.align!=='original'&&key==='info'&&type.id==='status')rules.push(`${type.root} .fate-grid-item{align-items:${r.align==='justify'?'stretch':flex}!important;text-align:inherit!important}`);
            if(r.wrap!=='original')declarations.push(`white-space:${r.wrap==='nowrap'?'nowrap':'normal'}!important`,`word-break:${r.wrap==='word'?'keep-all':'normal'}!important`,`overflow-wrap:${r.wrap==='nowrap'?'normal':'anywhere'}!important`);
            declarations.push('min-width:0!important','max-width:100%!important');
            if(r.wrap==='nowrap')declarations.push('overflow-x:auto!important');
            rules.push(`${targets}{${declarations.join(';')}}`);
            rules.push(`${selector.split(',').map(x=>`${type.root} ${x} :is(span,p,b,i,em,strong)`).join(',')}{${family?'font-family:inherit!important;':''}font-size:inherit!important;font-weight:inherit!important;font-style:inherit!important;letter-spacing:inherit!important;line-height:inherit!important;text-align:inherit!important}`);
            if(key==='info'&&type.id==='status')rules.push(`${type.root} .fate-grid-value,${type.root} .fate-grid-label{font-size:inherit!important;line-height:inherit!important;font-weight:inherit!important;font-style:inherit!important;letter-spacing:inherit!important;white-space:inherit!important;overflow-wrap:inherit!important;word-break:inherit!important;${family?'font-family:inherit!important;':''}text-align:inherit!important}`);
            if(key==='quote'&&type.id==='status')rules.push(`${targets}{display:block!important}${targets} .movie-huge-text,${targets} .char-wrap{font:inherit!important;letter-spacing:inherit!important;line-height:inherit!important;transform:none!important;margin:0!important;display:inline!important}`);
        }
        if(config.hideFooter&&type.regions.footer)rules.push(`${type.root} ${type.regions.footer[1]}{display:none!important;margin:0!important;padding:0!important}`);
    }
    return stCss(rules.join('\n'));
}
