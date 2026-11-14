import crypto from 'node:crypto';
import { keyStore, newsStore, listNews, getApiSwitch, setApiSwitch, sha256, botToken, adminIds, webhookSecret } from './_shared.mjs';

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
        'Potionz key manager\n\n/genkey — create one key\n/genkey 5 — create five keys (1–25)\n/keys — show key totals\n\n/new_ann TEXT — post an announcement to News\n   (put a title on the first line and the message on the next lines)\n/anns — list announcements\n/del_ann [N] — delete announcement N (default: newest)\n\n/api_on — show API ONLINE on the login page\n/api_off — show API OFFLINE on the login page\n/api_status — check the switch\n\n/myid — show your Telegram ID');
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

    const sw = command.match(/^\/api_(on|off|status)(?:@\w+)?$/);
    if (sw) {
      if (sw[1] !== 'status') await setApiSwitch(sw[1] === 'on', fromId);
      const { online, changed_at } = await getApiSwitch();
      const when = changed_at ? `\nLast changed: ${new Date(changed_at).toUTCString()}` : '';
      await sendMessage(msg.chat.id, online
        ? `🟢 API is ON. The login page shows API — ONLINE.${when}\nTurn it off with /api_off`
        : `🔴 API is OFF. The login page shows API — OFFLINE.${when}\nTurn it on with /api_on`);
      return ok();
    }

    const ann = command.match(/^\/new_ann(?:@\w+)?(?:\s+([\s\S]+))?$/);
    if (ann) {
      const body = (ann[1] || '').trim();
      if (!body) {
        await sendMessage(msg.chat.id,
          'Usage:\n/new_ann New drop tonight at 9pm\n\nOr with a title:\n/new_ann Restock\nAll cards are back in stock.');
        return ok();
      }
      const [first, ...rest] = body.split('\n');
      const title = rest.length ? first.trim().slice(0, 120) : '';
      const text = (rest.length ? rest.join('\n') : body).trim().slice(0, 2000);
      const created_at = new Date().toISOString();
      await newsStore().setJSON(`${Date.now()}-${crypto.randomBytes(3).toString('hex')}`, { title, text, created_at, created_by: fromId });
      await sendMessage(msg.chat.id, `✅ Announcement posted to News.${title ? `\n\n${title}` : ''}\n${text}`);
      return ok();
    }

    if (/^\/anns(?:@\w+)?$/.test(command)) {
      const items = await listNews();
      if (!items.length) { await sendMessage(msg.chat.id, 'No announcements yet. Add one with /new_ann'); return ok(); }
      const lines = items.slice(0, 20).map((a, i) =>
        `${i + 1}. ${a.created_at.slice(0, 10)} — ${(a.title || a.text).replace(/\s+/g, ' ').slice(0, 60)}`);
      await sendMessage(msg.chat.id, `Announcements (newest first):\n\n${lines.join('\n')}\n\nDelete one with /del_ann N`);
      return ok();
    }

    const del = command.match(/^\/del_ann(?:@\w+)?(?:\s+(\d+))?$/);
    if (del) {
      const items = await listNews();
      const n = Number(del[1] || 1);
      const target = items[n - 1];
      if (!target) { await sendMessage(msg.chat.id, items.length ? `No announcement #${n}. See /anns` : 'No announcements to delete.'); return ok(); }
      await newsStore().delete(target.id);
      await sendMessage(msg.chat.id, `🗑 Deleted announcement #${n}: ${(target.title || target.text).slice(0, 60)}`);
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
