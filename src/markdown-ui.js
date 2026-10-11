import { MARKDOWN_CONTROLS, MARKDOWN_TUNING } from './markdown.js';

// Small, inert drawings: never insert fake message controls or modify chat markup.
function sample(key, choice) {
    const line = (y, x=20, end=76) => `<path d="M${x} ${y}H${end}"/>`;
    const rect = (rx=4, opacity=.12) => `<rect x="12" y="5" width="72" height="26" rx="${rx}" fill="currentColor" fill-opacity="${opacity}" stroke="none"/>`;
    const star = '<path d="m48 9 2.3 6.7L57 18l-6.7 2.3L48 27l-2.3-6.7L39 18l6.7-2.3Z" fill="currentColor" stroke="none"/>';
    let drawing='';
    if(key==='hr') {
        drawing = choice==='dots' ? [36,48,60].map(x=>`<circle cx="${x}" cy="18" r="2" fill="currentColor" stroke="none"/>`).join('')
            : choice==='star'||choice==='diamond' ? line(18,9,33)+line(18,63,87)+(choice==='star'?star:'<path d="m48 11 7 7-7 7-7-7Z"/>')
            : choice==='fade' ? [0.15,.4,.7,1,.7,.4,.15].map((o,i)=>`<path opacity="${o}" d="M${9+i*11} 18h11"/>`).join('')
            : `<path d="M9 18H87" ${choice==='dashed'?'stroke-dasharray="3 4"':''}/>`;
    } else if(key==='heading') {
        drawing=(choice==='soft'?rect():choice==='ribbon'?'<path d="M16 6v25l5-4 5 4V6Z" fill="currentColor" stroke="none"/>':choice==='marker'?'<path d="M19 24H77" stroke-width="9" opacity=".25"/>':choice==='line'?line(29,12,84):choice==='ornament'?'<path d="m14 12 2 5 5 2-5 2-2 5-2-5-5-2 5-2Z" fill="currentColor"/>':'')+`<path d="M${choice==='ribbon'||choice==='ornament'?32:20} 14H70"/>`+line(22,choice==='ribbon'||choice==='ornament'?32:20,59);
    } else if(key==='quote') {
        drawing=(['soft','default','notebook'].includes(choice)?rect():choice==='border'?'<rect x="12" y="5" width="72" height="26" rx="4"/>':'')+(choice==='line'?'<path d="M13 6v24" stroke-width="3"/>':choice==='quotation'?'<path d="M16 9h-5v7h5v-3h-3m12-4h-5v7h5v-3h-3"/>':choice==='notebook'?'<path d="M15 15H81M15 25H81" opacity=".2"/>':'')+line(13,choice==='quotation'?32:23,74)+line(23,23,67);
    } else if(key==='strongStyle'||key==='mark'||key==='underline'||key==='link') {
        drawing=key==='strongStyle'?(choice==='marker'?rect(2,.25):choice==='plain'?'':'<path d="M20 24H76" stroke-width="8" opacity=".25"/>'):key==='mark'?(choice==='plain'?'':rect(2,choice==='soft'?.12:.3)):key==='link'?(choice==='soft'?rect(4):''):'';
        drawing+=line(15)+line(20,20,65);
        if(key==='underline'||key==='link'&&choice!=='plain') drawing+= choice==='wavy'?'<path d="M20 28q4-5 8 0t8 0t8 0t8 0t8 0t8 0t8 0"/>':`<path d="M20 27H76" ${choice==='dotted'?'stroke-dasharray="1 4"':''}/>`+(choice==='double'?line(31):'');
    } else if(key==='inlineCode') {
        drawing=(choice==='plain'?'':choice==='outline'?'<rect x="12" y="5" width="72" height="26" rx="4"/>':rect(choice==='pill'?13:4))+'<path d="m36 12-6 6 6 6m24-12 6 6-6 6M51 10l-6 16"/>';
    } else if(key==='table') {
        drawing='<rect x="12" y="5" width="72" height="26" rx="2"/>'+(choice==='default'||choice==='zebra'?'<path d="M13 24H83" stroke-width="7" opacity=".15"/>':'')+'<path d="M12 14H84M12 23H84"/>'+(choice==='grid'?'<path d="M39 5v26M63 5v26"/>':'');
    } else if(key==='details') {
        drawing=(choice==='card'?'<rect x="12" y="5" width="72" height="26" rx="4"/>':choice==='bar'?'<path d="M12 12H84" stroke-width="13" opacity=".15"/>':'')+'<path d="m19 11 3 3-3 3M30 14h42"/>'+line(25,21,65);
    } else {
        drawing=[10,20,30].map(y=>`<circle cx="17" cy="${y}" r="1.5" fill="currentColor"/>`+line(y,26,choice==='roomy'?64:76)).join('');
    }
    return `<svg viewBox="0 0 96 36" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${drawing}</svg>`;
}

export function markdownControls(s, {esc, row, seg, slider, toggle}) {
    const controls = new Map(MARKDOWN_CONTROLS.map(c=>[c.key,c]));
    const choices = key => {
        const {label,options}=controls.get(key);
        return `<div class="bl-md-choices salty-stack" role="group" aria-label="${label}">${options.map(([value,name])=>`<button type="button" data-act="seg" data-path="markdown.${key}" data-value="${value}" aria-pressed="${s.markdown[key]===value}" class="bl-md-choice${s.markdown[key]===value?' on':''}">${sample(key,value)}<span>${name}</span></button>`).join('')}</div>`;
    };
    const compact = key => {const {label,options}=controls.get(key);return row(label,seg('markdown.'+key,options,options[0][0]));};
    const tuning = key => MARKDOWN_TUNING.filter(item=>item.group===key &&
        !(item.key==='strongThick'&&!['default','underline'].includes(s.markdown.strongStyle)) &&
        !(item.key==='strongAlpha'&&s.markdown.strongStyle==='plain') &&
        !(item.key==='quoteAlpha'&&['plain','line'].includes(s.markdown.quote))).map(item=>slider('markdown.'+item.key,item.key==='strongThick'?'아래 띠 두께':item.label,item.min,item.max,item.step,item.default)).join('');
    const groups=['hr','heading','quote','strongStyle','list','inlineCode','table','details','underline','link','mark'];
    return `<div class="salty-group bl-md-general bl-control-grid">${compact('size')}${compact('space')}${row('장식 색 직접 고르기',toggle('markdown.accentOwn',s.markdown.accentOwn))}${s.markdown.accentOwn?`<div class="salty-row"><span>장식 색</span><input type="color" data-color-path="markdown.accentColor" value="${esc(s.markdown.accentColor)}" aria-label="장식 색"></div>`:''}</div>
        <div class="bl-md-groups">${groups.map(key=>{
            const {label,options}=controls.get(key), selected=options.find(([v])=>v===s.markdown[key])?.[1]||options[0][1];
            const extra=tuning(key)+(key==='list'?compact('listMark'):key==='table'?compact('tableHead'):'');
            return `<details class="bl-md-group" data-md-fold="${key}"${key==='hr'?' open':''}><summary><span>${label}</span><small>${selected}</small></summary><div class="bl-md-group-body">${choices(key)}${extra?`<details class="bl-md-tuning" data-md-fold="${key}-tuning"><summary>세부 조절</summary><div class="bl-control-grid">${extra}</div></details>`:''}</div></details>`;
        }).join('')}</div>`;
}
