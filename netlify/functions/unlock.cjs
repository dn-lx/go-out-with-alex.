'use strict';
const { createHash, timingSafeEqual } = require('node:crypto');

exports.handler = async function (event) {
  const baseHeaders = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
  };
  function reply(statusCode, data) { return { statusCode, headers: baseHeaders, body: JSON.stringify(data) }; }
  if (event.httpMethod !== 'POST') return reply(405, { message: 'Only POST is allowed.' });
  if (event.body?.length > 500) return reply(413, { message: 'The request is too long.' });
  let code;
  try { code = JSON.parse(event.body || '{}').code; } catch { return reply(400, { message: 'Invalid request.' }); }
  if (typeof code !== 'string' || !/^[A-Z0-9-]{4,32}$/i.test(code)) return reply(401, { message: 'That password does not seem right.' });
  const stored = process.env.GO_OUT_INVITES_JSON;
  let invites = require('../../lib/invites.cjs');
  if (stored) {
    try { invites = JSON.parse(stored); } catch { return reply(503, { message: 'Invitation configuration needs attention.' }); }
  }
  const incoming = Buffer.from(createHash('sha256').update(code.trim().toUpperCase()).digest('hex'), 'hex');
  let match = null;
  for (const entry of Array.isArray(invites) ? invites : []) {
    if (typeof entry?.hash !== 'string' || !/^[a-f0-9]{64}$/.test(entry.hash)) continue;
    const digest = Buffer.from(entry.hash, 'hex');
    if (timingSafeEqual(incoming, digest)) match = entry;
  }
  if (!match) return reply(401, { message: 'That password does not seem right. Try again?' });
  const name = String(match.name || 'you').trim().slice(0, 48);
  const id = String(match.id || 'invite').slice(0, 30).replace(/[^a-zA-Z0-9_-]/g, '');
  return reply(200, { ok: true, guestName: name, inviteId: id });
};
