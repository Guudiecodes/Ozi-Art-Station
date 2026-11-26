# Arzzet setup

## Run it on your PC
    npm install
    npm run dev
Open http://localhost:3000/login and create the owner account with jokesonyou146@gmail.com. Only that email can ever sign in. Uploads are paused for everyone else.
Forgot the password: `npm run reset-owner`, then open /login again.

## Accounts you need to go live
| Account | Why | Cost |
|---|---|---|
| Host that keeps files on disk (a VPS such as Hetzner or DigitalOcean, or Railway/Render with a disk) | Runs the site | from ~$5/month |
| Domain name | Your address, and needed for payment webhooks | ~$10/year |
| Paystack business account (NGN, GHS, ZAR, KES) | Card and bank payments | free, 1.5%+fee per sale |
| Flutterwave business account | Second payment option, more countries | free, per-sale fee |
| Resend (optional) | Emails the download link | free tier |
| Mixamo (free Adobe ID) or Avaturn | Extra home page characters | free |

Vercel and similar serverless hosts do not keep files written at runtime. If you choose one, the database and file storage must move to Neon Postgres and Cloudflare R2 first (`src/lib/db.ts` and `src/lib/storage.ts` are the only two files to change).

## Environment (server)
Copy `.env.example`. Set `SETUP_KEY` and `APP_SECRET` to long random text. Set the site address in Admin, Settings.

## Payments
Admin, Payments. Paste the keys, tick the gateway, Save, press Test connection. Copy the two webhook URLs shown there into the Paystack and Flutterwave dashboards. Start with test keys.

## Back up
Copy the `data` folder regularly. It holds the database, uploaded files and the encryption key.
