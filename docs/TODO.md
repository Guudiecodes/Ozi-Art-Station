# Arzzet: what is left to do

## Before the client goes live
- [ ] Delete the 13 sample assets (Admin, Assets). They come from public sample sets and are not the client's to sell.
- [ ] Confirm the three hero characters (Michelle, Alex, Soldier) may be used commercially on a public site. Replace any that may not.
- [ ] Add the missing hero characters (girl, old woman, boy, human in beach clothes): make them in Mixamo or Avaturn, export as .glb, add in Admin, Home page.
- [ ] Deploy on Vercel Pro or a VPS (docs/VERCEL.md). Hobby is non-commercial.
- [ ] Create the owner account (/login) and set a strong password.
- [ ] Paystack: complete the business account, paste test keys, run one test purchase, then switch to live keys.
- [ ] Flutterwave: same.
- [ ] Add the webhook URLs from Admin, Payments to both dashboards.
- [ ] Set the public site address, support email and currency (Admin, Settings).
- [ ] Review the terms, privacy and refund pages (Admin, Legal pages) for the client's country.
- [ ] Upload the real products with prices, descriptions and preview files.
- [ ] Custom domain on Vercel, then update SITE_URL.

## Accounts needed
| Account | Used for |
|---|---|
| GitHub | code (done) |
| Vercel Pro | hosting |
| Neon | database |
| Cloudflare R2 | file storage |
| Paystack | payments (NGN, GHS, ZAR, KES) |
| Flutterwave | payments (more countries) |
| Resend (optional) | emails the buyer's download link |
| Mixamo or Avaturn | extra hero characters |
| A domain registrar | the shop address |

## Soon after launch
- [ ] Cover image per asset (rendered on upload) for faster cards and better link previews.
- [ ] Email receipts through Resend, and a customers list in the admin.
- [ ] Daily backup of the Neon database.
- [ ] Discount codes and bundles.
- [ ] Two-step login for the owner.
- [ ] Optional: watermark on public previews.
