import { keyStore, botToken, json } from './_shared.mjs';

// GET /api/status — public, shown on the login page.
// bot:  "online" when the Telegram bot token works and the bot is connected to this site's webhook.
// keys: "ready" when the key storage can be reached, so keys can be checked.
export default async () => {
  const status = { bot: 'offline', keys: 'unavailable', checked_at: new Date().toISOString() };
  const token = botToken();

  const tg = async method => {
    const r = await fetch(`https://api.telegram.org/bot${token}/${method}`, { signal: AbortSignal.timeout(4000) });
    return r.json();
  };

  const [bot, keys] = await Promise.allSettled([
    token ? Promise.all([tg('getMe'), tg('getWebhookInfo')]) : Promise.reject(new Error('no token')),
    keyStore().get('__health_check__')
  ]);

  if (bot.status === 'fulfilled') {
    const [me, hook] = bot.value;
    const url = hook?.result?.url || '';
    const lastError = hook?.result?.last_error_date || 0;
    const recentError = lastError && Date.now() / 1000 - lastError < 600 && (hook.result.pending_update_count || 0) > 0;
    if (me?.ok && url.endsWith('/.netlify/functions/telegram-webhook') && !recentError) status.bot = 'online';
  }
  if (keys.status === 'fulfilled') status.keys = 'ready';

  return json(200, status);
};
