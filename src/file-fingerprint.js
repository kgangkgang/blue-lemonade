// Detect mixed releases/corrupt copies, including plain-HTTP LAN installations.
// This is a content fingerprint, not a signature or an authenticity check.
export function fileFingerprint(buffer){
    const bytes=buffer instanceof Uint8Array?buffer:new Uint8Array(buffer);
    let a=0x811c9dc5,b=0x9e3779b9;
    for(const byte of bytes){a=Math.imul(a^byte,0x01000193);b=Math.imul(b^byte,0x85ebca6b);b^=b>>>13;}
    return `${bytes.length}:${(a>>>0).toString(16).padStart(8,'0')}:${(b>>>0).toString(16).padStart(8,'0')}`;
}
