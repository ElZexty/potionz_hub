import { listNews, verifySession, getCookie, json, COOKIE_NAME } from './_shared.mjs';

// GET /api/news — announcements for the News panel. Only for logged-in visitors,
// same as the shop page itself.
export default async (req) => {
  if (req.method !== 'GET') return json(405, { error: 'Method not allowed.' }, { Allow: 'GET' });
  if (!verifySession(getCookie(req, COOKIE_NAME))) return json(401, { error: 'Not logged in.' });
  try {
    const items = (await listNews()).slice(0, 50).map(({ title, text, created_at }) => ({ title, text, created_at }));
    return json(200, { announcements: items });
  } catch (e) {
    console.error('news failed:', e);
    return json(500, { error: 'News unavailable.' });
  }
};
