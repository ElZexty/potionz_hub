# Potionz — Netlify one-time key login

This package is adapted for Netlify Functions + Netlify Edge Functions. It does **not** use SQLite or a long-running Telegram polling process. Supabase Postgres stores hashed license keys and sessions; Telegram delivers admin commands through a webhook.

## 1. Rotate the exposed Telegram token
The token pasted into the earlier chat should be revoked with @BotFather. Create a replacement token and use only the replacement in Netlify environment variables.

## 2. Create the Supabase database
1. Create a Supabase project.
2. Open **SQL Editor** and run all of `supabase-schema.sql`.
3. In Project Settings → API, copy the Project URL and the **service_role** key. Keep the service-role key secret.

## 3. Deploy to Netlify
1. Put the contents of this folder in a GitHub repository (or deploy the folder with Netlify CLI).
2. In Netlify, add the repository as a site. The included `netlify.toml` sets `public` as the publish directory and `netlify/functions` as the functions directory.
3. In Site configuration → Environment variables, add:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `TELEGRAM_BOT_TOKEN` (the new token)
   - `TELEGRAM_ADMIN_IDS` (your numeric Telegram user ID; comma-separated IDs are supported)
   - `TELEGRAM_WEBHOOK_SECRET` (a long random string containing only letters, numbers, `_` or `-`)
4. Trigger a new deploy after setting the variables. Use the Netlify-provided HTTPS domain.

## 4. Connect Telegram to the Netlify webhook
After deployment, set the Telegram webhook once. Replace the placeholders and run this from a terminal:

```bash
curl -X POST "https://api.telegram.org/bot<NEW_BOT_TOKEN>/setWebhook" \
  -d "url=https://<YOUR-NETLIFY-SITE>/.netlify/functions/telegram-webhook" \
  -d "secret_token=<YOUR_TELEGRAM_WEBHOOK_SECRET>"
```

Telegram should return `"ok":true`. Do not paste the token or secret into public source files, GitHub, or chat.

## 5. Generate keys
Open a private chat with your bot. Send `/start`, then:
- `/genkey` — generate one key
- `/genkey 5` — generate five keys (1–25 supported)
- `/keys` — show total, unused, and redeemed counts

Keys are shown only when generated. The database stores SHA-256 hashes, not plaintext keys. Each key can be redeemed once.

## Authentication behavior
- Unauthenticated visitors are served only `login.html`; the shop entry page is gated by a Netlify Edge Function.
- Key redemption and session lookup happen server-side.
- A successful key creates a 30-day HttpOnly, Secure, SameSite=Strict session cookie.
- Refreshing the page does not consume another key. The key itself cannot be reused after redemption.
- The key is one-time; the browser session expires after 30 days. A new key is needed after expiry.

## Important
- Keep `SUPABASE_SERVICE_ROLE_KEY`, `TELEGRAM_BOT_TOKEN`, and `TELEGRAM_WEBHOOK_SECRET` in Netlify environment variables only.
- Do not commit `.env` files or secrets.
- The shop's checkout is still demo-only, as in the original HTML; this package only adds access control.
- If you change the Netlify domain, update the Telegram webhook URL.
