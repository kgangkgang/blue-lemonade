// Original renderer font stacks and public font stylesheets, with synthetic text only.
const zeo=id=>`https://fontsapi.zeoseven.com/${id}/main/result.css`;
const google=query=>`https://fonts.googleapis.com/css2?${query}&display=swap`;
export const compactPreviewStyle=value=>['present','olden','scifi'].includes(value)?value:'present';
export function originalFontFamilies(kind,variant='present'){
    if(kind==='compact')return[({present:'MaokenZhuyuanTi',olden:'LXGW ZhenKai',scifi:'点点像素体-方形'})[compactPreviewStyle(variant)]];
    return({status:['LXGW WenKai','SiyinSong','Dancing Script'],single:['Inter'],novel:['Playfair Display','Noto Serif SC','Cinzel'],prologue:['Allura','PING FANG SHAO HUA','TekitouPoem','Caveat']})[kind]||[];
}
export function originalPreview(kind,variant='present'){
    if(kind==='status')return{links:[zeo(892),zeo(292),google('family=Dancing+Script')],css:'.fate-top-grid,.fate-outfit-label,.fate-between{font-family:"LXGW WenKai",sans-serif}.fate-grid-label,.movie-deco-eng{font-family:sans-serif}.movie-line-content{font-family:"SiyinSong",serif}.fate-bottom-en{font-family:"Dancing Script",cursive}'};
    if(kind==='compact'){
        const [id,font]=({present:[88,'"MaokenZhuyuanTi",sans-serif'],olden:[2,'"LXGW ZhenKai",serif'],scifi:[110,'"点点像素体-方形",sans-serif']})[compactPreviewStyle(variant)];
        return{links:[zeo(id)],css:`.status-bar-content{font-family:${font}}`};
    }
    if(kind==='single')return{links:[google('family=Inter:wght@400;500;600;700;900')],css:'.swiss-island{font-family:Inter,sans-serif}.swiss-island .detail-value,.swiss-island .capsule-date,.swiss-island .status-text{font-family:monospace}'};
    if(kind==='novel')return{links:[google('family=Noto+Serif+SC:wght@400;700&family=Playfair+Display:ital,wght@0,700;1,400&family=Cinzel:wght@500')],css:'.novel-header-container{font-family:"Playfair Display","Noto Serif SC",serif}.novel-chapter-num{font-family:Cinzel,"Noto Serif SC",serif}.novel-preface{font-family:"Noto Serif SC",serif}'};
    if(kind==='prologue')return{links:[google('family=Allura&family=Caveat:wght@400..700'),zeo(157),zeo(85)],css:'.vintage-prologue{font-family:Allura,"PING FANG SHAO HUA",TekitouPoem,Caveat,cursive}'};
    return{links:[],css:'body{font-family:var(--mainFontFamily,system-ui,sans-serif)}.dem-card,.dem-track{font-family:var(--mainFontFamily,system-ui,sans-serif);font-size:.92em}.dem-track{display:flex;align-items:center;flex-wrap:wrap;gap:2px 14px}.dem-track__item{display:flex;align-items:center;gap:4px}'};
}
