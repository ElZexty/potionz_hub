const COOKIE_NAME = 'potionz_session';
async function hash(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
}
export default async (request: Request, context: any) => {
  const url = new URL(request.url);
  const path = url.pathname;
  // Only protect HTML entry points; APIs and static assets are handled separately.
  if (path === '/login.html' || path.startsWith('/.netlify/') || path.startsWith('/api/')) return context.next();
  if (!(path === '/' || path === '/index.html' || path.endsWith('.html'))) return context.next();
  const cookie = request.headers.get('cookie') || '';
  const raw = cookie.split(';').map(x => x.trim()).find(x => x.startsWith(COOKIE_NAME + '='));
  if (raw) {
    let token = '';
    try { token = decodeURIComponent(raw.slice(COOKIE_NAME.length + 1)); } catch {}
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (token && supabaseUrl && serviceKey) {
      const tokenHash = await hash(token);
      const endpoint = `${supabaseUrl.replace(/\/$/, '')}/rest/v1/potionz_sessions?select=token_hash&token_hash=eq.${tokenHash}&expires_at=gt.${encodeURIComponent(new Date().toISOString())}&limit=1`;
      try {
        const response = await fetch(endpoint, { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } });
        if (response.ok && (await response.json()).length === 1) return context.next();
      } catch (e) { console.error('Session validation failed:', e); }
    }
  }
  return context.rewrite(new URL('/login.html', request.url));
};
