# Holler & Son Tattoo Appointments

A Cloudflare-ready tattoo appointment marketplace and studio portal.

## What is included

- Customer portal with parlor name, style, location, and radius search.
- Public tattoo parlor pages with phone, email, location, website, social links, bio, artists, specialties, hours, art wall, and appointment button.
- Appointment request flow where customers choose phone or email contact.
- Employee login area with inbox, inquiry status, calendar, customer records, public profile editing, and art uploads.
- Email notification hook for tattoo businesses through Resend.
- Stripe monthly-fee buy button in the employee subscription tab.
- Cloudflare D1 schema for accounts, businesses, customers, inquiries, appointments, inbox, sessions, and art metadata.
- Cloudflare R2 upload flow for tattoo art images.
- Local Node preview server that works without installing dependencies.

## Local preview

```powershell
npm.cmd start
```

Then open:

```text
http://localhost:4173
```

Employee demo login:

```text
studio@hollerandson.ink
inkmaster2026
```

Run checks:

```powershell
npm.cmd run check
```

## Cloudflare setup

Create the D1 database:

```powershell
npx wrangler d1 create hollerandson
```

Copy the returned database ID into `wrangler.toml`.

Create the R2 bucket:

```powershell
npx wrangler r2 bucket create hollerandson-art
```

Apply the schema:

```powershell
npx wrangler d1 execute hollerandson --file=cloudflare/schema.sql
```

Deploy:

```powershell
npx wrangler deploy
```

## Email notifications

For production email delivery, set a Resend API key:

```powershell
npx wrangler secret put RESEND_API_KEY
```

Optional:

```powershell
npx wrangler secret put BUSINESS_NOTIFICATION_EMAIL
```

If `RESEND_API_KEY` is not set, appointment requests are still saved to the employee inbox and calendar, but outbound email is recorded as `local-inbox`.

## Stripe monthly fee

The Stripe buy button is embedded in `public/index.html` using:

```html
<stripe-buy-button
  buy-button-id="buy_btn_1TmRvsGJtywdCBcEmAmvEuWF"
  publishable-key="pk_live_51TdF41GJtywdCBcEVXcvUM8SB5O6Y34OCA0nrPqvlfa5RQfmSj5TroPhVQq8heMzbJZuEhxoOwVXC7sYrpSBybdk002vxsC9AC"
>
</stripe-buy-button>
```

The publishable key is safe in client-side code. Keep Stripe secret keys out of the repo.

## Data model

- D1 stores business pages, employees, sessions, saved customers, inquiries, appointments, inbox notifications, and art metadata.
- R2 stores uploaded tattoo art images per business account.
- Local preview stores data in `data/store.json`.

