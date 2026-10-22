// Numbered, referenced annotations are part of the requested translation, not model work notes.
const HEADING = /^\s*(?:#{1,6}\s*)?[*_]*(?:역주|번역자\s*주|번역\s*주석|translator[’']?s?\s*notes?|translation\s*notes?|訳注)\s*[*_]*\s*[:：][*_]*\s*$/i;
const DEFINITION = /^\s*\[(\^[^\]\s]{1,40}|\d+)\]\s*(:|：)?\s*(\S.*)$/;
const REFERENCE = /\[(\^[^\]\s]{1,40}|\d+)\]/g;
const PASSAGE = /^\s*(?:⟦\s*\d+\s*⟧|【\s*\d+\s*】)/;
const FENCE = /^\s*(`{3,}|~{3,})/;
const NOTE_CUE = /역주|번역자\s*주|번역\s*주석|translator[’']?s?\s*notes?|translation\s*notes?|訳注|^\s*\[(?:\^[^\]\s]{1,40}|\d+)\]\s*[:：]/im;

export function translatorNoteRanges(value,{headed=false}={}) {
    const text=String(value??'');
    if(!NOTE_CUE.test(text)||!REFERENCE.test(text)){REFERENCE.lastIndex=0;return [];}
    REFERENCE.lastIndex=0;
    const lines=text.split('\n'),offsets=[];let offset=0,fence=null;
    for(const line of lines){offsets.push(offset);offset+=line.length+1;}
    const ranges=[],refs=new Set();
    for(let i=0;i<lines.length;i++){
        const line=lines[i],mark=line.match(FENCE);
        if(mark){if(!fence)fence={char:mark[1][0],length:mark[1].length};else if(fence.char===mark[1][0]&&mark[1].length>=fence.length)fence=null;continue;}
        if(fence)continue;
        if(PASSAGE.test(line))refs.clear();
        const heading=HEADING.test(line),first=line.match(DEFINITION);
        let j=i+(heading?1:0);
        if(heading)while(j<lines.length&&!lines[j].trim())j++;
        const definition=heading?lines[j]?.match(DEFINITION):first;
        if(definition && refs.has(definition[1]) && (heading||definition[1].startsWith('^')||(!headed&&definition[2]))){
            let end=j,valid=true,failedAt=-1;const defined=new Set();
            for(let k=j;k<lines.length;k++){
                if(PASSAGE.test(lines[k])||FENCE.test(lines[k])||HEADING.test(lines[k]))break;
                if(!lines[k].trim()){
                    let next=k+1;while(next<lines.length&&!lines[next].trim())next++;
                    const d=lines[next]?.match(DEFINITION);
                    if(!d||!refs.has(d[1])||defined.has(d[1]))break;
                    k=next-1;continue;
                }
                const d=lines[k].match(DEFINITION);
                if(d&&!refs.has(d[1])){valid=false;failedAt=k;break;}
                if(d&&defined.has(d[1]))break;
                if(d)defined.add(d[1]);
                end=k;
            }
            if(valid){
                const start=offsets[i],finish=offsets[end]+lines[end].length;let attachStart=start;
                while(attachStart>0&&/\s/.test(text[attachStart-1]))attachStart--;
                ranges.push({start,end:finish,attachStart});i=end;continue;
            }
            if(failedAt>i){for(let k=i;k<failedAt;k++)collect(lines[k]);i=failedAt-1;continue;}
        }
        collect(line,first);
    }
    return ranges;
    // A definition is not a reference to itself. This also keeps legacy [n] passage labels distinct.
    // A line that merely starts with [n] (no colon, not [^x]) is a reference, not a definition.
    function collect(line,first=line.match(DEFINITION)){
        const label=first&&(first[2]||first[1].startsWith('^'));
        const body=label?line.slice(line.indexOf(']')+1):line;
        for(const match of body.matchAll(REFERENCE))refs.add(match[1]);
    }
}

export function maskTranslatorNotes(value,{attach=false,prefix='\uE000',headed=false}={}) {
    const source=String(value??''),ranges=translatorNoteRanges(source,{headed}),notes=[];let text='',cursor=0;
    for(const [i,range] of ranges.entries()){
        let token=prefix+String.fromCharCode(0xE100+i)+ '\uE001';
        while(source.includes(token))token=prefix+token;
        text+=source.slice(cursor,attach?range.attachStart:range.start)+token;
        notes.push({token,text:source.slice(range.start,range.end)});cursor=range.end;
    }
    text+=source.slice(cursor);
    return {text,changed:notes.length>0,restore(value,format=note=>note){let result=String(value??'');for(const note of notes)result=result.replaceAll(note.token,()=>format(note.text));return result;}};
}
