import { keyStore, sha256, json, makeSession, COOKIE_NAME, SESSION_DAYS } from './_shared.mjs';

// Accept keys pasted with spaces, line breaks, hidden characters, odd dashes or
// lowercase letters: keep only letters/digits and rebuild PZ-XXXXXXXX-XXXXXXXX-XXXXXXXX.
function normalizeKey(input) {
  const raw = String(input || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const m = raw.match(/PZ([A-F0-9]{24})/);
  if (m) return { key: `PZ-${m[1].slice(0, 8)}-${m[1].slice(8, 16)}-${m[1].slice(16, 24)}` };
  if (/^PZ[A-F0-9]{18}$/.test(raw)) return { oldKey: true };
  return {};
}

export default async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed.' }, { Allow: 'POST' });
  let input;
  try { input = (await req.json())?.key; }
  catch { return json(400, { error: 'Invalid request.' }); }

  const { key: supplied, oldKey } = normalizeKey(input);
  if (oldKey) {
    return json(400, { error: 'That key is from the old bot and no longer works. Ask for a new key (they look like PZ-XXXXXXXX-XXXXXXXX-XXXXXXXX).' });
  }
  if (!supplied) {
    return json(400, { error: 'That doesn’t look like an access key. Keys look like PZ-XXXXXXXX-XXXXXXXX-XXXXXXXX.' });
  }

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
