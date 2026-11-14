import crypto from 'node:crypto';
import { getSupabase, sha256 } from './_shared.mjs';
const makeKey = () => 'PZ-' + crypto.randomBytes(4).toString('hex').toUpperCase() + '-' + crypto.randomBytes(4).toString('hex').toUpperCase() + '-' + crypto.randomBytes(4).toString('hex').toUpperCase();
async function sendMessage(token, chatId, text) {
  const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }) });
  if (!r.ok) console.error('Telegram sendMessage failed:', await r.text());
}
export default async function handler(event) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  const admins = new Set((process.env.TELEGRAM_ADMIN_IDS || '').split(',').map(x => x.trim()).filter(Boolean));
  if (!token || !secret || !admins.size) return { statusCode: 500, body: 'Bot is not configured.' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed.' };
  if (event.headers['x-telegram-bot-api-secret-token'] !== secret) return { statusCode: 401, body: 'Unauthorized.' };
  let update;
  try { update = JSON.parse(event.body || '{}'); } catch { return { statusCode: 400, body: 'Bad JSON.' }; }
  const msg = update.message;
  if (!msg?.text || !msg.chat?.id || !admins.has(String(msg.from?.id)) || msg.chat.type !== 'private') return { statusCode: 200, body: 'OK' };
  const command = msg.text.trim();
  try {
    if (/^\/start(?:@\w+)?$/.test(command)) {
      await sendMessage(token, msg.chat.id, 'Potionz key manager\n/genkey [quantity] — create one-time keys (1–25)\n/keys — show key totals');
    } else {
      const gen = command.match(/^\/genkey(?:@\w+)?(?:\s+(\d+))?$/);
      if (gen) {
        const count = Math.min(25, Math.max(1, Number(gen[1] || 1)));
        const sb = getSupabase();
        const keys = Array.from({ length: count }, makeKey);
        const rows = keys.map(key => ({ key_hash: sha256(key), created_by: String(msg.from.id) }));
        const { error } = await sb.from('potionz_keys').insert(rows);
        if (error) throw error;
        await sendMessage(token, msg.chat.id, `Created ${count} one-time key(s):\n\n${keys.join('\n')}\n\nCopy these now; only hashes are stored.`);
      } else if (/^\/keys(?:@\w+)?$/.test(command)) {
        const sb = getSupabase();
        const [{ count: total, error: totalError }, { count: unused, error: unusedError }] = await Promise.all([
          sb.from('potionz_keys').select('*', { count: 'exact', head: true }),
          sb.from('potionz_keys').select('*', { count: 'exact', head: true }).is('redeemed_at', null)
        ]);
        if (totalError || unusedError) throw totalError || unusedError;
        await sendMessage(token, msg.chat.id, `Keys created: ${total || 0}\nUnused: ${unused || 0}\nRedeemed: ${(total || 0) - (unused || 0)}`);
      }
    }
  } catch (e) { console.error('Telegram webhook error:', e); await sendMessage(token, msg.chat.id, 'Command failed. Check the Netlify function logs and Supabase configuration.'); }
  return { statusCode: 200, body: 'OK' };
}
