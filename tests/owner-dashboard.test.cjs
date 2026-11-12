'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {Script}=require('node:vm');
const adminJs=fs.readFileSync('public/admin.js','utf8');
const adminHtml=fs.readFileSync('public/admin.html','utf8');
const guest=fs.readFileSync('public/index.html','utf8');
const ownerCode=fs.readFileSync('netlify/functions/owner.mjs','utf8');

test('owner dashboard is private, responsive, and JavaScript parses',()=>{
  assert.doesNotThrow(()=>new Script(adminJs));
  assert.match(adminHtml,/id="login-form"/);
  assert.match(adminHtml,/autocomplete="current-password"/);
  assert.match(adminHtml,/id="dashboard" hidden/);
  assert.match(adminHtml,/id="invite-form"/);
  assert.match(adminHtml,/id="owner-password-form"/);
  assert.match(adminHtml,/id="settings-form"/);
  assert.match(adminHtml,/id="add-question"/);
  assert.match(adminJs,/crypto\.getRandomValues/);
});
test('owner API signs sessions, checks CSRF and rejects cross-site writes',()=>{
  assert.match(ownerCode,/timingSafeEqual/);
  assert.match(ownerCode,/scryptSync/);
  assert.match(ownerCode,/SameSite=Strict/);
  assert.match(ownerCode,/HttpOnly/);
  assert.match(ownerCode,/sameOrigin\(request\)/);
  assert.match(ownerCode,/x-bunny-csrf/);
  assert.match(ownerCode,/Too many attempts/);
  assert.match(ownerCode,/BUNNY_OWNER_CREDENTIALS/);
  assert.doesNotMatch(adminJs,/BUNNY_OWNER_SESSION_SECRET/);
});
test('visitor page supports editable custom questions in summary and submission',()=>{
  assert.match(guest,/function applyOwnerSettings/);
  assert.match(guest,/extraQuestions\.length \? 'extra-0' : 'success'/);
  assert.match(guest,/extra_answers/);
  assert.match(guest,/configuredAskTemplate=value\.screens\?\.ask\?\.heading/);
  assert.match(guest,/editedVoiceClips\.has\(clipKey\)/);
});
test('secure invitation hashes, whitelisted settings, and validation',async()=>{
  const m=await import('../lib/owner-store.mjs');
  const inv=m.makeInvite({id:'friend-1',name:'Friend',enabled:true,password:'Abcd-987654-QWER'});
  assert.equal(inv.algo,'scrypt');assert.equal(inv.salt.length,32);assert.equal(inv.hash.length,64);
  assert.ok(!JSON.stringify(inv).includes('Abcd-987654-QWER'));
  assert.equal(m.checkInvitePassword('ABCD-987654-QWER',inv),true);
  assert.equal(m.checkInvitePassword('NOT-THIS-PASSWORD',inv),false);
  assert.equal(m.checkInvitePassword('ABCD-987654-QWER',{...inv,enabled:false}),false);
  const another=m.makeInvite({id:'friend-1',name:'Renamed',enabled:true},inv);
  assert.equal(another.hash,inv.hash);
  assert.deepEqual(Object.keys(m.publicInvites([inv])[0]).sort(),['enabled','id','name']);
  assert.throws(()=>m.makeInvite({id:'x',name:'Nobody',password:'123'}),/Invitation ID|Password/);
  assert.throws(()=>m.sanitizedSettings({extraQuestions:[{heading:'Q?',options:['Only one']}]}),/at least two/);
  assert.throws(()=>m.sanitizedSettings({extraQuestions:Array.from({length:6},()=>({heading:'Q',options:['1','2']}))}),/maximum/);
  const safe=m.sanitizedSettings({senderName:'Alex',privateToken:'SHOULDNOTLEAK',screens:{ask:{heading:'{name}, out with {sender}?'}}});
  assert.equal(safe.screens.ask.heading,'{name}, out with {sender}?');
  assert.ok(!JSON.stringify(safe).includes('SHOULDNOTLEAK'));
});
