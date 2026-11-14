import { getStore } from '@netlify/blobs';
import crypto from 'node:crypto';

// Keys live in Netlify Blobs (built into Netlify, no external database needed).
export const keyStore = () => getStore({ name: 'potionz-keys', consistency: 'strong' });
// Announcements shown under News on the website (added with /new_ann in Telegram).
export const newsStore = () => getStore({ name: 'potionz-news', consistency: 'strong' });

// Returns announcements newest first: [{ id, title, text, created_at }].
export async function listNews() {
  const store = newsStore();
  const { blobs } = await store.list();
  const items = await Promise.all(blobs.map(async b => {
    const a = await store.get(b.key, { type: 'json' });
    return a ? { id: b.key, ...a } : null;
  }));
  return items.filter(Boolean).sort((x, y) => String(y.created_at).localeCompare(String(x.created_at)));
}

export const COOKIE_NAME = 'potionz_session';
export const SESSION_DAYS = 30;
export const DEFAULT_ADMIN_IDS = '8823255837';
export const KEY_RE = /^PZ-[A-F0-9]{8}-[A-F0-9]{8}-[A-F0-9]{8}$/;

export function env(name) {
  const v = globalThis.Netlify?.env?.get?.(name) ?? process.env[name] ?? '';
  return String(v).trim();
}

export const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');

export const botToken = () => env('TELEGRAM_BOT_TOKEN');
export const adminIds = () =>
  new Set((env('TELEGRAM_ADMIN_IDS') || DEFAULT_ADMIN_IDS).split(',').map(x => x.trim()).filter(Boolean));

// Webhook secret: TELEGRAM_WEBHOOK_SECRET if set, otherwise derived from the bot token.
export const webhookSecret = () =>
  env('TELEGRAM_WEBHOOK_SECRET') || sha256('potionz-webhook:' + botToken()).slice(0, 48);

// Session cookies are signed, so no session database is needed.
// The edge function (protect-shop.ts) verifies them with the same secret.
const sessionKey = () =>
  crypto.createHash('sha256').update('potionz-session:' + (env('SESSION_SECRET') || botToken())).digest();

const sign = payload => crypto.createHmac('sha256', sessionKey()).update(payload).digest('base64url');

export function makeSession(days = SESSION_DAYS) {
  const payload = `${Date.now() + days * 86400000}.${crypto.randomBytes(16).toString('base64url')}`;
  return `${payload}.${sign(payload)}`;
}

export function verifySession(token) {
  if (!token || !botToken()) return false;
  const i = token.lastIndexOf('.');
  if (i < 0) return false;
  const payload = token.slice(0, i);
  const sig = Buffer.from(token.slice(i + 1));
  const expected = Buffer.from(sign(payload));
  if (sig.length !== expected.length || !crypto.timingSafeEqual(sig, expected)) return false;
  return Number(payload.split('.')[0]) > Date.now();
}

export function getCookie(req, name) {
  const raw = req.headers.get('cookie') || '';
  const part = raw.split(';').map(x => x.trim()).find(x => x.startsWith(name + '='));
  if (!part) return null;
  try { return decodeURIComponent(part.slice(name.length + 1)); } catch { return null; }
}

export const json = (status, body, headers = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers }
  });
