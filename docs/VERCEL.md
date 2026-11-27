# Deploy Arzzet on Vercel

Vercel cannot keep files or a database on its own disk. Arzzet needs two free add-ons there: **Neon** (database) and file storage: **Vercel Blob** (no card) or **Cloudflare R2**. Without them the site loads, but nothing you save survives, and the admin panel says so.

**Important:** Vercel's free Hobby plan is for non-commercial use only. A shop that takes payments needs Vercel Pro (about $20/month). Any host with a disk (a VPS) also works and needs none of this.

## 1. Import the project
Vercel, Add New, Project, pick the GitHub repo `Ozi-Art-Station`. Framework: Next.js (detected). Leave every build setting as it is. Do not deploy yet.

## 2. Database: Neon
Project, Storage, Create Database, Neon (free). Connect it to the project. Vercel adds `DATABASE_URL` for you. Arzzet creates its own table on first visit.

## 3a. Files: Vercel Blob (no card, easiest)
Project, Storage, Create, Blob, name `arzzet-files`, access **Private**, tick the read-write token option, Production and Preview. Vercel adds `BLOB_READ_WRITE_TOKEN`. Nothing else to set. Free allowance: 1 GB storage, 10 GB transfer a month. If R2 variables are also set, R2 wins.
Add `OWNER_EMAIL` and `SECRET_KEY` (any long random text). `SECRET_KEY` is used as the setup key on the first sign-up and to encrypt payment keys. Never change it afterwards.

## 3b. Files: Cloudflare R2 (needs a card)
1. Cloudflare dashboard, R2 Object Storage, Create bucket, name it `arzzet`. Keep it **private** (do not turn on public access).
2. R2, Manage API tokens, Create API token, permission **Object Read & Write**, limited to that bucket. Copy the Access Key ID, Secret Access Key, and your Account ID.
3. Bucket, Settings, CORS policy, paste this (replace the site address):
```json
[{"AllowedOrigins":["https://YOUR-SITE.vercel.app","https://your-domain.com","http://localhost:3000"],"AllowedMethods":["GET","PUT","HEAD"],"AllowedHeaders":["*"],"ExposeHeaders":["ETag"],"MaxAgeSeconds":3600}]
```
CORS is what lets browsers upload large files directly and load previews and characters.

## 4. Environment variables (Vercel, Settings, Environment Variables)
| Name | Value |
|---|---|
| `R2_ACCOUNT_ID` | from Cloudflare |
| `R2_ACCESS_KEY_ID` | from the API token |
| `R2_SECRET_ACCESS_KEY` | from the API token |
| `R2_BUCKET` | `arzzet` |
| `SETUP_KEY` | any long random text (you type it once when creating the owner account) |
| `APP_SECRET` | any long random text. Encrypts your payment keys. Never change it later |
| `OWNER_EMAIL` | jokesonyou146@gmail.com |
| `SITE_URL` | your final address, for example https://your-domain.com |

`DATABASE_URL` is already there from step 2.

## 5. Deploy, then create the owner
Deploy. Open `/login`, enter the owner email, a password, and the `SETUP_KEY`. Then Admin, Payments, Settings.

## 6. Payment webhooks
Admin, Payments shows two webhook URLs. Paste them into the Paystack and Flutterwave dashboards.

## Limits to know
- Uploads go straight to R2 (up to 120 MB per model). The low-res preview is built by a function that may stop after 60 seconds on very large models. If that happens, upload your own smaller preview file with the asset.
- Every page reads the latest data from Neon, and saves finish just after the response. Two edits at the very same instant can overwrite each other. For one owner this is rare. Payments are always re-checked with Paystack or Flutterwave, so a missed update is fixed by the Check payment again button.
- Test locally first: `npm run dev` needs none of the above.
