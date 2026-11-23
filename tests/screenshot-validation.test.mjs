import test from 'node:test';
import assert from 'node:assert/strict';
import {validateScreenshot,MAX_BYTES} from '../src/lib/review/screenshot-validation.ts';
test('validates actual image signatures instead of trusting a name',()=>{
 assert.equal(validateScreenshot(Uint8Array.from([137,80,78,71,13,10,26,10]),'image/png'),'png');
 assert.equal(validateScreenshot(Uint8Array.from([255,216,255]),'image/jpeg'),'jpg');
 assert.equal(validateScreenshot(Buffer.from('RIFF1234WEBP'),'image/webp'),'webp');
 assert.throws(()=>validateScreenshot(Buffer.from('hello'),'image/png'),/Only valid/);
 assert.throws(()=>validateScreenshot(Uint8Array.from([255,216,255]),'image/png'),/Only valid/);
 assert.throws(()=>validateScreenshot(Uint8Array.of(1),'image/svg+xml'),/Only valid/);
 assert.throws(()=>validateScreenshot(new Uint8Array(MAX_BYTES+1),'image/png'),/5 MB/);
});
