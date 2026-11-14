import { verifySession, getCookie, json, COOKIE_NAME } from './_shared.mjs';

export default async (req) => {
  if (req.method !== 'GET') return json(405, { error: 'Method not allowed.' }, { Allow: 'GET' });
  return json(200, { authenticated: verifySession(getCookie(req, COOKIE_NAME)) });
};
