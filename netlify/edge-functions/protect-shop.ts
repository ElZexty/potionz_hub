const COOKIE_NAME = 'potionz_session';

function env(name: string): string {
  // @ts-ignore Netlify global is available in edge functions
  const v = (globalThis as any).Netlify?.env?.get?.(name) ?? (globalThis as any).Deno?.env?.get?.(name) ?? '';
  return String(v).trim();
}

function base64url(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Must match verifySession() in netlify/functions/_shared.mjs.
async function validSession(token: string): Promise<boolean> {
  const secret = env('SESSION_SECRET') || env('TELEGRAM_BOT_TOKEN');
  if (!token || !secret) return false;
  const i = token.lastIndexOf('.');
  if (i < 0) return false;
  const payload = token.slice(0, i);
  const sig = token.slice(i + 1);
  const keyBytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('potionz-session:' + secret));
  const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const expected = base64url(new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload))));
  if (expected.length !== sig.length) return false;
  let diff = 0;
  for (let j = 0; j < sig.length; j++) diff |= sig.charCodeAt(j) ^ expected.charCodeAt(j);
  return diff === 0 && Number(payload.split('.')[0]) > Date.now();
}

export default async (request: Request, context: any) => {
  const path = new URL(request.url).pathname;
  // Only protect HTML entry points; APIs and static assets pass through.
  if (path === '/login.html' || path.startsWith('/.netlify/') || path.startsWith('/api/')) return context.next();
  if (!(path === '/' || path === '/index.html' || path.endsWith('.html'))) return context.next();

  const cookie = request.headers.get('cookie') || '';
  const raw = cookie.split(';').map(x => x.trim()).find(x => x.startsWith(COOKIE_NAME + '='));
  if (raw) {
    let token = '';
    try { token = decodeURIComponent(raw.slice(COOKIE_NAME.length + 1)); } catch {}
    try { if (await validSession(token)) return context.next(); }
    catch (e) { console.error('Session validation failed:', e); }
  }
  return context.rewrite(new URL('/login.html', request.url));
};
