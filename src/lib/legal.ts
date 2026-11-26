// Starting text for the legal pages. {site} and {email} are filled in. The owner edits these in Admin, Legal pages.
// This is a plain starting point, not legal advice: have it checked for your country before you go live.
export const LEGAL_TITLES: Record<string, string> = { terms: "Terms of sale", privacy: "Privacy policy", refunds: "Refunds and downloads" };
export const LEGAL_DEFAULT: Record<string, string> = {
  terms: `# What you are buying
{site} sells digital files: 3D models, HDRIs and textures. When payment is confirmed you can download the full-quality file from your order page.

# License
Each asset shows its license on its page. You may use a purchased file in your own projects, including commercial work, under that license. You may not resell, share or redistribute the file itself, alone or in a pack. Free assets marked CC0 can be used for any purpose.

# Payment
Prices are shown in the currency on the asset page. Payments are processed by Paystack or Flutterwave. {site} never sees or stores your card details.

# Downloads
Your download link is tied to the email you give at checkout. Keep it private. Each purchase includes a limited number of downloads.

# Contact
Questions about an order: {email}`,
  privacy: `# What we collect
When you buy: your email address and the order details, so we can deliver your file and answer questions. Card and bank details go straight to the payment provider and are never stored by {site}.

# Cookies
We use a small cookie to remember which assets you have liked, and the site owner's login cookie. We do not use advertising or tracking cookies.

# Who sees your data
Payment providers (Paystack, Flutterwave) process your payment. If email delivery is switched on, an email provider sends your download link. We do not sell your data.

# Your choices
Email {email} to ask for your order data to be corrected or deleted.`,
  refunds: `# Digital files
Because files are delivered instantly, purchases are generally final once downloaded.

# When we will help
If a file is damaged, does not open, or is not what the page described, email {email} within 7 days with your order reference. We will fix it, replace it or refund you.

# Failed payments
If money left your account but no download appeared, contact us with your order reference. We will check with the payment provider and release your file.`,
};
export const fillLegal = (t: string, site: string, email: string) => t.replaceAll("{site}", site).replaceAll("{email}", email || "the seller");
