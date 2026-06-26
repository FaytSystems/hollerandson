# Holler & Son Tattoo Appointments

A Cloudflare-ready tattoo appointment marketplace and studio portal.

## What is included

- Customer portal with parlor name, style, location, and radius search.
- Public tattoo parlor pages with phone, email, location, website, social links, bio, artists, specialties, hours, art wall, and appointment button.
- Appointment request flow where customers choose phone or email contact.
- Employee login area with inbox, inquiry status, calendar, customer records, public profile editing, and art uploads.
- Email notification hook for tattoo businesses through Resend.
- Professional per-business email addresses with in-house inboxes, outbound customer email, and optional forwarding.
- Stripe monthly-fee buy button in the employee subscription tab.
- Stripe webhook endpoint that turns active subscriptions into business portal access.
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

Install Wrangler or use `npx wrangler` from the project folder:

```powershell
cd C:\Users\UrsaMajor\OneDrive\Desktop\PROJECT\hollerandson
```

Login once:

```powershell
npx wrangler login
```

Create the D1 database:

```powershell
npx wrangler d1 create hollerandson
```

Copy the returned `database_id` into `wrangler.toml`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "hollerandson"
database_id = "your-real-d1-id"
```

Create the R2 bucket:

```powershell
npx wrangler r2 bucket create hollerandson-art
```

The R2 binding is already in `wrangler.toml`:

```toml
[[r2_buckets]]
binding = "ART_BUCKET"
bucket_name = "hollerandson-art"
```

Set the default professional mailbox domain in `wrangler.toml`:

```toml
[vars]
BUSINESS_EMAIL_DOMAIN = "hollerandson.com"
```

Apply the schema locally:

```powershell
npx wrangler d1 execute hollerandson --local --file=cloudflare/schema.sql
```

Apply the schema to production:

```powershell
npx wrangler d1 execute hollerandson --remote --file=cloudflare/schema.sql
```

Deploy:

```powershell
npx wrangler deploy
```

After deploy, your webhook URL is:

```text
https://<your-worker-domain>/api/stripe/webhook
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

## Professional business email

Each subscribed tattoo business can create a professional Holler & Son mailbox in the employee dashboard.

Example:

```text
black-rose@hollerandson.com
```

The Mailbox tab supports:

- custom local part, such as `black-rose`
- display name, such as `Black Rose Tattoo`
- reply-to address, such as `owner@blackrosetattoo.com`
- optional forwarding to the business owner's existing email
- in-house incoming and sent mailbox stored in D1
- outbound customer emails through Resend

Recommended sending pattern:

```text
From: Black Rose Tattoo <black-rose@hollerandson.com>
Reply-To: owner@blackrosetattoo.com
To: customer@email.com
```

### Inbound mailbox setup

Cloudflare Email Service routes incoming email into the Worker through the `email(message, env, ctx)` handler. The Worker stores incoming email in D1 and forwards a copy through Resend when forwarding is enabled.

In Cloudflare:

1. Open Email Routing / Email Service for the domain used by `BUSINESS_EMAIL_DOMAIN`.
2. Enable routing for the domain.
3. Route a catch-all address or each business address to the `hollerandson` Worker.
4. Use a route like `*@hollerandson.com` or individual addresses like `black-rose@hollerandson.com`.

The Worker rejects unknown mailbox addresses, stores known incoming messages in `email_messages`, and forwards to the configured `forwardTo` address when `forwardingEnabled` is on.

Cloudflare's Email Workers API exposes an `email()` handler with `message.from`, `message.to`, headers, raw content, `message.forward()`, `message.reply()`, and `message.setReject()`. This app uses the handler to store mail in D1 and uses Resend for professional outbound and forwarding delivery.

## Stripe monthly fee

The Stripe buy button is created in `public/app.js` after employee login so it can include:

- `client-reference-id`: the logged-in business ID, for example `holler-and-son`.
- `customer-email`: the logged-in employee email.

Stripe sends `client_reference_id` back in the `checkout.session.completed` webhook, allowing the site to activate the matching tattoo business account.

The buy button uses:

```html
<stripe-buy-button
  buy-button-id="buy_btn_1TmRvsGJtywdCBcEmAmvEuWF"
  publishable-key="pk_live_51TdF41GJtywdCBcEVXcvUM8SB5O6Y34OCA0nrPqvlfa5RQfmSj5TroPhVQq8heMzbJZuEhxoOwVXC7sYrpSBybdk002vxsC9AC"
>
</stripe-buy-button>
```

The publishable key is safe in client-side code. Keep Stripe secret keys out of the repo.

### Stripe webhook setup

In Stripe Dashboard:

1. Open Developers > Webhooks.
2. Add an endpoint.
3. Use this endpoint URL:

```text
https://<your-worker-domain>/api/stripe/webhook
```

4. Subscribe to these events:

```text
checkout.session.completed
customer.subscription.created
customer.subscription.updated
customer.subscription.deleted
invoice.paid
invoice.payment_failed
```

5. Reveal the endpoint signing secret. It starts with `whsec_`.
6. Save it to Cloudflare:

```powershell
npx wrangler secret put STRIPE_WEBHOOK_SECRET
```

The Worker verifies `Stripe-Signature` using the raw request body before it trusts any webhook payload.

### Local webhook testing

Install the Stripe CLI, then run:

```powershell
stripe listen --forward-to localhost:4173/api/stripe/webhook
```

Copy the printed `whsec_...` value into your local shell before starting the preview server:

```powershell
$env:STRIPE_WEBHOOK_SECRET="whsec_your_local_cli_secret"
npm.cmd start
```

The Stripe CLI secret is different from the Dashboard webhook secret.

## Data model

- D1 stores business pages, employees, sessions, saved customers, inquiries, appointments, inbox notifications, professional mailbox settings, in-house email messages, subscription state, processed Stripe events, and art metadata.
- R2 stores uploaded tattoo art images per business account.
- Local preview stores data in `data/store.json`.

## Brand assets

Generated brand assets live in `public/assets`:

- `holler-son-logo.png` - square business logo for the website, profile images, and app icons.
- `holler-son-social-banner.png` - wide social media banner/header image.

## Subscription access rules

Employee login is always allowed so a business can reach the Subscription tab.

These actions require an active or trialing subscription:

- profile edits
- art uploads and deletes
- professional email setup and customer email sending
- appointment creation
- inquiry status updates
- inbox, customer records, and calendar data

Stripe events update D1 automatically. When a subscription becomes `active` or `trialing`, the paid business tools unlock. When it becomes `canceled`, `unpaid`, or `past_due`, paid tools lock again.
