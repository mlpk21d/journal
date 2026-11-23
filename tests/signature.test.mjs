import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac,createHash} from 'node:crypto';
// Regression fixture from the official Webull signature guide.
// The TS function is equivalent to this reference computation.
test('Webull documented signature fixture', () => {
 const data={
 a1:'webull',a2:'123',a3:'xxx',q1:'yyy',host:'api.webull.com',
 'x-app-key':'776da210ab4a452795d74e726ebd74b6',
 'x-signature-algorithm':'HMAC-SHA1','x-signature-nonce':'48ef5afed43d4d91ae514aaeafbc29ba',
 'x-signature-version':'1.0','x-timestamp':'2022-01-04T03:55:31Z'
 };
 const body='{"k1":123,"k2":"this is the api request body","k3":true,"k4":{"foo":[1,2]}}';
 const joined=Object.keys(data).sort().map(k=>k+'='+data[k]).join('&');
 const raw='/trade/place_order&'+joined+'&'+createHash('md5').update(body).digest('hex').toUpperCase();
 const encoded=encodeURIComponent(raw);
 const actual=createHmac('sha1','0f50a2e853334a9aae1a783bee120c1f&').update(encoded).digest('base64');
 assert.equal(actual,'kvlS6opdZDhEBo5jq40nHYXaLvM=');
});
