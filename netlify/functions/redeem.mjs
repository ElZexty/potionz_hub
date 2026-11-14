import crypto from 'node:crypto';
import { getSupabase, sha256, json, COOKIE_NAME, SESSION_DAYS } from './_shared.mjs';
export default async function handler(event) {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed.' }, { Allow: 'POST' });
  let supplied;
  try { supplied = String(JSON.parse(event.body || '{}')?.key || '').trim().toUpperCase(); }
  catch { return json(400, { error: 'Invalid request.' }); }
  if (!/^PZ-[A-F0-9]{8}-[A-F0-9]{8}-[A-F0-9]{8}$/.test(supplied)) return json(400, { error: 'Enter a validly formatted access key.' });
  try {
    const token = crypto.randomBytes(32).toString('base64url');
    const { data, error } = await getSupabase().rpc('potionz_redeem_key', {
      p_key_hash: sha256(supplied), p_session_hash: sha256(token), p_session_days: SESSION_DAYS
    });
    if (error) throw error;
    if (data !== true) return json(401, { error: 'That key is invalid or has already been used.' });
    const cookie = `${COOKIE_NAME}=${encodeURIComponent(token)}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${SESSION_DAYS * 86400}`;
    return json(200, { ok: true }, { 'Set-Cookie': cookie });
  } catch (e) { console.error(e); return json(500, { error: 'Authentication service unavailable.' }); }
}
