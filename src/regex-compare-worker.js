import { compareRegex } from './regex-compare-core.js';
self.onmessage=({data})=>{
    try { self.postMessage({result:compareRegex(data.input,data.rules)}); }
    catch(error){self.postMessage({error:error.message});}
};
