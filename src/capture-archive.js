// Uncompressed ZIP: media is already compressed. Build only when the user requests all parts.
const table=Uint32Array.from({length:256},(_,n)=>{for(let i=0;i<8;i++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
export async function captureArchive(files,signal){
    let offset=0;const bodies=[],directory=[];
    const header=size=>{const bytes=new Uint8Array(size);return [bytes,new DataView(bytes.buffer)];};
    for(const file of files){
        signal?.throwIfAborted();const data=new Uint8Array(await file.blob.arrayBuffer());signal?.throwIfAborted();
        let crc=0xffffffff;for(const byte of data)crc=table[(crc^byte)&255]^(crc>>>8);crc=(crc^0xffffffff)>>>0;
        const name=new TextEncoder().encode(file.name),[local,l]=header(30),[central,c]=header(46);
        l.setUint32(0,0x04034b50,true);l.setUint16(4,20,true);l.setUint16(6,0x800,true);l.setUint16(12,33,true);l.setUint32(14,crc,true);l.setUint32(18,data.length,true);l.setUint32(22,data.length,true);l.setUint16(26,name.length,true);
        c.setUint32(0,0x02014b50,true);c.setUint16(4,20,true);c.setUint16(6,20,true);c.setUint16(8,0x800,true);c.setUint16(14,33,true);c.setUint32(16,crc,true);c.setUint32(20,data.length,true);c.setUint32(24,data.length,true);c.setUint16(28,name.length,true);c.setUint32(42,offset,true);
        bodies.push(local,name,file.blob);directory.push(central,name);offset+=30+name.length+data.length;
    }
    const size=directory.reduce((n,part)=>n+part.length,0),[end,e]=header(22);
    e.setUint32(0,0x06054b50,true);e.setUint16(8,files.length,true);e.setUint16(10,files.length,true);e.setUint32(12,size,true);e.setUint32(16,offset,true);
    return new Blob([...bodies,...directory,end],{type:'application/zip'});
}
