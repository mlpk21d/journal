import test from 'node:test';
import assert from 'node:assert/strict';
import {formatBrokerageAccount} from '../src/lib/webull/account-format.ts';

test('brokerage label displays type, first three, two stars and final two characters',()=>{
 assert.equal(formatBrokerageAccount('Individual Margin','CVY123456'), 'Individual Margin-CVY**56');
 assert.equal(formatBrokerageAccount('Roth IRA','ABZ000O109'), 'Roth IRA-ABZ**09');
});
test('missing account type falls back to Brokerage',()=>{
 assert.equal(formatBrokerageAccount(null,'XYZ123456'), 'Brokerage-XYZ**56');
});
