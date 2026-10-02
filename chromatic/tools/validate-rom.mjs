import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
export async function validateRom(path){
 const rom=await readFile(path);let checksum=0;
 for(let i=0x134;i<=0x14c;i++)checksum=(checksum-rom[i]-1)&255;
 const expectedSize=32768*2**rom[0x148];
 if(rom.length!==expectedSize||rom[0x143]!==0xc0||rom[0x149]!==3||![0x1b,0x1e].includes(rom[0x147])||checksum!==rom[0x14d])throw Error('Unexpected native ROM header, mapper, SRAM capacity, size or checksum');
 let globalChecksum=0;for(let i=0;i<rom.length;i++)if(i!==0x14e&&i!==0x14f)globalChecksum=(globalChecksum+rom[i])&65535;
 if(globalChecksum!==rom.readUInt16BE(0x14e))throw Error('ROM global checksum failed');
 const metadata={title:rom.subarray(0x134,0x143).toString('ascii').replaceAll('\0',''),sha256:createHash('sha256').update(rom).digest('hex'),bytes:rom.length,color:'gbc-only',mapper:'MBC5',sramBytes:32768,headerChecksum:checksum,globalChecksum,compiler:'GB Studio 4.3.2 / GBDK 4.5.0',playtest:'Human gameplay and physical cartridge acceptance pending'};
 await writeFile(join(dirname(path),'manifest.json'),JSON.stringify(metadata,null,2)+'\n');
 console.log(`Verified native ${rom.length/1024} KB GBC ROM with 32 KB SRAM: ${path}`);return metadata;
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1])await validateRom(process.argv[2]||fileURLToPath(new URL('../build/evergrow-chromatic.gbc',import.meta.url)));
