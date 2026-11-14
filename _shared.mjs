import { createClient } from '@supabase/supabase-js';
import crypto from 'node:crypto';

export function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variable.');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
export const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
export const COOKIE_NAME = 'potionz_session';
export const SESSION_DAYS = 30;
export function getCookie(event, name) {
  const raw = event.headers?.cookie || event.headers?.Cookie || '';
  const part = raw.split(';').map(x => x.trim()).find(x => x.startsWith(name + '='));
  if (!part) return null;
  try { return decodeURIComponent(part.slice(name.length + 1)); } catch { return null; }
}
export async function validSession(event) {
  const token = getCookie(event, COOKIE_NAME);
  if (!token) return false;
  const { data, error } = await getSupabase().from('potionz_sessions')
    .select('token_hash').eq('token_hash', sha256(token)).gt('expires_at', new Date().toISOString()).maybeSingle();
  return !error && !!data;
}
export const json = (statusCode, body, extraHeaders = {}) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...extraHeaders },
  body: JSON.stringify(body)
});
