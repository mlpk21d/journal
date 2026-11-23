export const MAX_BYTES=5*1024*1024;
export function validateScreenshot(bytes:Uint8Array,mime:string){
 if(bytes.length===0||bytes.length>MAX_BYTES)throw new Error('Screenshot must be between 1 byte and 5 MB');
 const png=bytes.length>=8&&[137,80,78,71,13,10,26,10].every((b,i)=>bytes[i]===b);
 const jpg=bytes.length>=3&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
 const webp=bytes.length>=12&&Buffer.from(bytes.subarray(0,4)).toString()==='RIFF'&&Buffer.from(bytes.subarray(8,12)).toString()==='WEBP';
 if(mime==='image/png'&&png)return 'png';
 if(mime==='image/jpeg'&&jpg)return 'jpg';
 if(mime==='image/webp'&&webp)return 'webp';
 throw new Error('Only valid PNG, JPEG and WebP images are accepted');
}
