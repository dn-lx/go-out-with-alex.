#!/usr/bin/env node
// Generate an individual invite password and a hash entry for lib/invites.cjs.
// Only reveal the plaintext passcode privately; never commit it to Git.
const crypto = require('node:crypto');
const id = process.argv[2];
const name = process.argv[3] || 'you';
if (!id || !/^[A-Za-z0-9_-]{1,30}$/.test(id)) {
  console.error('Usage: node scripts/new-invite.cjs invite-2 "Her Name"');
  process.exit(1);
}
const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
let code = '';
for (const byte of crypto.randomBytes(16)) code += alphabet[byte % alphabet.length];
const hash = crypto.createHash('sha256').update(code).digest('hex');
console.log('PRIVATE PASSWORD (give only to recipient):', code);
console.log('Add this entry to lib/invites.cjs and deploy:');
console.log(JSON.stringify({id,name,hash},null,2));
