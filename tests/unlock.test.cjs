const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { handler } = require('../netlify/functions/unlock.cjs');
// The tests inject a sample credential; they NEVER include an actual invite password.
const code = 'TESTPASSCODE123';
process.env.GO_OUT_INVITES_JSON = JSON.stringify([
  { id: 'sample-invite', name: 'Sample Recipient', hash: createHash('sha256').update(code).digest('hex') }
]);
test('valid individual code unlocks its named invitation', async () => {
  const result = await handler({ httpMethod:'POST', body: JSON.stringify({code}) });
  assert.equal(result.statusCode, 200);
  const data = JSON.parse(result.body);
  assert.equal(data.inviteId, 'sample-invite');
  assert.equal(data.guestName, 'Sample Recipient');
  assert.ok(!result.body.includes(code));
});
test('invalid password is denied', async () => {
  const result = await handler({httpMethod:'POST',body:JSON.stringify({code:'WRONGPASSWORD123'})});
  assert.equal(result.statusCode,401);
});
test('password works in either letter case', async () => {
  const result = await handler({httpMethod:'POST',body:JSON.stringify({code:code.toLowerCase()})});
  assert.equal(result.statusCode,200);
});
test('unrelated methods denied',async()=>{
  const result=await handler({httpMethod:'GET',body:''});assert.equal(result.statusCode,405);
});
test('oversized request denied',async()=>{
  const result=await handler({httpMethod:'POST',body:'x'.repeat(502)});assert.equal(result.statusCode,413);
});
