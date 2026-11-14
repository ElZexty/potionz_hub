import { botToken, webhookSecret, json } from './_shared.mjs';

// Visit https://<your-site>/api/setup once after deploying.
// It points the Telegram bot at this site's webhook. It only ever sets the
// webhook to this site's own URL, so it is safe to leave in place.
export default async (req) => {
  const token = botToken();
  if (!token) return json(500, { ok: false, error: 'TELEGRAM_BOT_TOKEN is not set in Netlify environment variables.' });

  const origin = new URL(req.url).origin;
  const webhookUrl = `${origin}/.netlify/functions/telegram-webhook`;
  const call = async (method, body) => {
    const r = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body || {})
    });
    return r.json();
  };

  const me = await call('getMe');
  if (!me.ok) return json(500, { ok: false, step: 'getMe', telegram: me, hint: 'The bot token in Netlify is wrong or revoked.' });

  const hook = await call('setWebhook', {
    url: webhookUrl,
    secret_token: webhookSecret(),
    allowed_updates: ['message'],
    drop_pending_updates: true
  });
  return json(hook.ok ? 200 : 500, { ok: hook.ok, bot: '@' + me.result.username, webhook: webhookUrl, telegram: hook.description });
};
