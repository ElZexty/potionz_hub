import crypto from 'node:crypto';
import { keyStore, sha256, botToken, adminIds, webhookSecret } from './_shared.mjs';

const part = () => crypto.randomBytes(4).toString('hex').toUpperCase();
const makeKey = () => `PZ-${part()}-${part()}-${part()}`;

async function sendMessage(chatId, text) {
  const r = await fetch(`https://api.telegram.org/bot${botToken()}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true })
  });
  if (!r.ok) console.error('Telegram sendMessage failed:', await r.text());
}

const ok = () => new Response('OK', { status: 200 });

export default async (req) => {
  if (!botToken()) return new Response('TELEGRAM_BOT_TOKEN is not set.', { status: 500 });
  if (req.method !== 'POST') return new Response('Method not allowed.', { status: 405 });
  if (req.headers.get('x-telegram-bot-api-secret-token') !== webhookSecret()) {
    return new Response('Unauthorized.', { status: 401 });
  }

  let update;
  try { update = await req.json(); } catch { return new Response('Bad JSON.', { status: 400 }); }
  const msg = update.message;
  if (!msg?.text || !msg.chat?.id || msg.chat.type !== 'private') return ok();

  const command = msg.text.trim();
  const fromId = String(msg.from?.id);
  try {
    if (!adminIds().has(fromId)) {
      if (/^\/(start|myid)\b/.test(command)) {
        await sendMessage(msg.chat.id, `This bot is restricted to its administrator.\nYour Telegram ID: ${fromId}`);
      }
      return ok();
    }

    if (/^\/(start|help)(?:@\w+)?$/.test(command)) {
      await sendMessage(msg.chat.id,
        'Potionz key manager\n\n/genkey — create one key\n/genkey 5 — create five keys (1–25)\n/keys — show key totals\n/myid — show your Telegram ID');
      return ok();
    }
    if (/^\/myid(?:@\w+)?$/.test(command)) {
      await sendMessage(msg.chat.id, `Your Telegram ID: ${fromId}`);
      return ok();
    }

    const gen = command.match(/^\/genkey(?:@\w+)?(?:\s+(\d+))?$/);
    if (gen) {
      const count = Math.min(25, Math.max(1, Number(gen[1] || 1)));
      const store = keyStore();
      const keys = Array.from({ length: count }, makeKey);
      const created_at = new Date().toISOString();
      await Promise.all(keys.map(k => store.setJSON(sha256(k), { created_at, created_by: fromId, redeemed_at: null })));
      await sendMessage(msg.chat.id,
        `Created ${count} one-time key(s):\n\n${keys.join('\n')}\n\nCopy these now; only hashes are stored.`);
      return ok();
    }

    if (/^\/keys(?:@\w+)?$/.test(command)) {
      const store = keyStore();
      const { blobs } = await store.list();
      const records = await Promise.all(blobs.map(b => store.get(b.key, { type: 'json' })));
      const total = records.filter(Boolean).length;
      const redeemed = records.filter(r => r?.redeemed_at).length;
      await sendMessage(msg.chat.id, `Keys created: ${total}\nUnused: ${total - redeemed}\nRedeemed: ${redeemed}`);
      return ok();
    }
  } catch (e) {
    console.error('Telegram webhook error:', e);
    await sendMessage(msg.chat.id, 'Command failed. Check the Netlify function logs.');
  }
  return ok();
};
