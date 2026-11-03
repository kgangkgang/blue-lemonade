// 1.0.x 시작할 때 저장된 상태창 글자 설정을 고르는 부분만(settings.js 가 시작 그래프에서 받아요).
//   종류마다 id · 주인 · 영역 키 · 배치 여부만 담은 모양 표예요. 이름 · 선택자가 든 전체 목록(FRUIT_TYPES)은 fruit-type-schema.js 에 있고
//   두 목록이 같은지는 시험(tools/tests/status-type-blocks.mjs)이 봐요. 종류 · 영역을 더하면 두 곳 모두 고쳐요.
// 장식 색 고르기 — 테마 팔레트 토큰만(--salty-…). 기본 강조색, 원작 색은 손대지 않음
export const DECOR_CHOICES=[['accent','강조색'],['text','글자색'],['muted','흐린 글자색'],['line','선 색'],['original','원작 색']];
export const TYPE_SHAPES=`status:f:info,quote,names,between,footer:L
compact:f:info,quote:L
single:f:info,quote,names,footer
novel:f:info,quote,names
prologue:f:quote,footer
qingguo-forum:f:info,names,footer
qingguo-board:f:info,names,footer
qingguo-mailbox:f:info,names,footer
fruit-choices:f:names,info:D
fruit-theater:f:names,info,quote,between,label,footer:D
fruit-reverie:f:names,info,label,footer:D
fruit-summary:f:names,info,footer:D
deus-tracker:d:info:L
deus-status:d:info,names,quote,label:D
deus-threads:d:info,names,tag:D
deus-psych:d:info,names,quote,label:D
deus-plot:d:info,names,label:D
deus-momentum:d:info,names,label:D
deus-conflict:d:info,names:D
deus-scene-plan:d:names,phase,label,info:D
deus-cyoa:d:names,quote,label,info,text:D
deus-relationships:d:quote,names,meter,label,info:D
deus-meanwhile:d:names,fold,tag,quote,info:D
deus-truths:d:names,fold,tag,quote,info,label,value:D
deus-undercurrents:d:names,tag,people,label,info,footer:D
deus-scratchpad:d:names,tag,info:D
deus-companions:d:names,tag,people,info:D
deus-phi-note:d:names,tag,info
deus-notice:d:names,info,label
deus-modules:d:names,label,info:D
deus-thinking:d:names,phase,label,info:D
deus-tail:d:info:D
sola-ooc:s:names,tag,info,label,note:D
sola-user-ooc:s:names,tag,info,label,note:D
sola-tempo:s:names,tag,info,label,note:D
sola-feeling:s:names,tag,info,label,note:D
sola-bond:s:names,tag,info,label,note:D
sola-cabinet:s:names,tag,info,label,note:D
sola-thought-engine:s:names,tag,info,label,note:D
sola-calendar:s:names,tag,info,label,note:D
sola-wardrobe:s:names,tag,info,label,note:D
sola-inventory:s:names,tag,info,label,note:D
sola-cast:s:names,tag,info,label,note:D
sola-notebook:s:names,tag,info,label,note:D
sola-trait:s:names,tag,info,label,note:D
sola-matrix:s:names,tag,info,label,note:D
sola-heart:s:names,tag,info,label,note:D
sola-current:s:names,tag,info,label,note:D
sola-arrow:s:names,tag,info,label,note:D
sola-easel:s:names,tag,info,label,note:D
sola-hud:s:names,tag,info,label,note:D
sola-chatterbox:s:names,tag,info,label,note:D
sola-capsule:s:info
sola-micro:s:names,info`.split('\n').map(line=>{const [id,owner,keys,flags='']=line.split(':');return {id,owner:owner==='d'?'deus':owner==='s'?'sola':'fruit',regions:Object.fromEntries(keys.split(',').map(k=>[k,1])),layout:flags.includes('L'),decor:flags.includes('D')};});
export const REGION_DEFAULT = Object.freeze({on:false,font:'original',size:16,weight:400,italic:false,spacing:0,line:1.6,align:'original',wrap:'original'});
export const OWNERS=['fruit','deus','sola'];
export const typeOwner=type=>type.owner==='deus'||type.owner==='sola'?type.owner:'fruit';
export const ownerEnabled=(s,owner)=>s.ownerOn?.[owner]??s.on;
export const anyTypeEnabled=s=>OWNERS.some(owner=>ownerEnabled(s,owner));
export const layoutChoices=type=>type.id==='status'?[['original','가로 · 원작 배치'],['vertical','세로 · 한 줄씩']]:type.id==='compact'?[['original','세로 · 원작 배치'],['horizontal','가로 · 두 칸']]:[['original','가로 · 원작 줄바꿈'],['vertical','세로 · 한 줄씩']];
const number=(v,min,max,fallback)=>Number.isFinite(Number(v))?Math.min(max,Math.max(min,Number(v))):fallback;
export function tidyFruitType(value) {
    const source=value&&typeof value==='object'&&!Array.isArray(value)?value:{};
    const result={on:source.on===true,kind:TYPE_SHAPES.some(x=>x.id===source.kind)?source.kind:'status',ownerOn:{},ownerKinds:{},types:{}};
    for(const owner of OWNERS){if(typeof source.ownerOn?.[owner]==='boolean')result.ownerOn[owner]=source.ownerOn[owner];const types=TYPE_SHAPES.filter(t=>typeOwner(t)===owner);result.ownerKinds[owner]=types.find(t=>t.id===source.ownerKinds?.[owner])?.id||types.find(t=>t.id===source.kind)?.id||types[0].id;}
    for(const type of TYPE_SHAPES){
        const old=source.types?.[type.id]||{},row={layout:['original','horizontal','vertical'].includes(old.layout)?old.layout:'original',hideFooter:old.hideFooter===true,regions:{}};
        if(type.layout&&!layoutChoices(type).some(([key])=>key===row.layout))row.layout='original';
        if(type.decor)row.decor=DECOR_CHOICES.some(([k])=>k===old.decor)?old.decor:'accent';
        if(type.id==='compact')row.previewStyle=['present','olden','scifi'].includes(old.previewStyle)?old.previewStyle:'present';
        for(const key of Object.keys(type.regions)){
            const r=old.regions?.[key]||{};
            row.regions[key]={on:r.on===true,font:typeof r.font==='string'&&/^[\w-]{1,100}$/.test(r.font)?r.font:'original',size:number(r.size,8,64,16),weight:number(r.weight,100,900,400),italic:r.italic===true,spacing:number(r.spacing,-2,12,0),line:number(r.line,.8,4,1.6),align:['original','left','center','right','justify'].includes(r.align)?r.align:'original',wrap:['original','word','anywhere','nowrap'].includes(r.wrap)?r.wrap:'original'};
        }
        result.types[type.id]=row;
    }
    return result;
}
