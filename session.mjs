import { validSession, json } from './_shared.mjs';
export async function handler(event) {
  if (event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed.' }, { Allow: 'GET' });
  try { return json(200, { authenticated: await validSession(event) }); }
  catch (e) { console.error(e); return json(500, { authenticated: false, error: 'Authentication service unavailable.' }); }
}
