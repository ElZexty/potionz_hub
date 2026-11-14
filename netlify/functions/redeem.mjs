import { keyStore, sha256, json, makeSession, KEY_RE, COOKIE_NAME, SESSION_DAYS } from './_shared.mjs';

export default async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed.' }, { Allow: 'POST' });
  let supplied;
  try { supplied = String((await req.json())?.key || '').trim().toUpperCase(); }
  catch { return json(400, { error: 'Invalid request.' }); }
  if (!KEY_RE.test(supplied)) return json(400, { error: 'Enter a validly formatted access key.' });

  try {
    const store = keyStore();
    const id = sha256(supplied);
    const record = await store.get(id, { type: 'json' });
    if (!record || record.redeemed_at) {
      return json(401, { error: 'That key is invalid or has already been used.' });
    }
    await store.setJSON(id, { ...record, redeemed_at: new Date().toISOString() });

    const token = makeSession(SESSION_DAYS);
    const cookie = `${COOKIE_NAME}=${encodeURIComponent(token)}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${SESSION_DAYS * 86400}`;
    return json(200, { ok: true }, { 'Set-Cookie': cookie });
  } catch (e) {
    console.error('redeem failed:', e);
    return json(500, { error: 'Authentication service unavailable.' });
  }
};
