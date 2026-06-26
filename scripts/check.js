const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { createSeedStore, searchBusinesses } = require("../server");

const root = path.resolve(__dirname, "..");

for (const file of [
  "server.js",
  "public/index.html",
  "public/styles.css",
  "public/app.js",
  "public/assets/tattoo-studio-hero.png",
  "public/assets/holler-son-logo.png",
  "public/assets/holler-son-social-banner.png",
  "cloudflare/worker.js",
  "cloudflare/schema.sql",
  "wrangler.toml"
]) {
  assert.ok(fs.existsSync(path.join(root, file)), `${file} should exist`);
}

const store = createSeedStore();
const nashvilleResults = searchBusinesses(
  store,
  new URLSearchParams({ location: "Nashville", radius: "100" })
);
assert.equal(nashvilleResults.locationKnown, true);
assert.ok(
  nashvilleResults.parlors.some((business) => business.id === "holler-and-son"),
  "Nashville search should include Holler & Son"
);

const nameResults = searchBusinesses(store, new URLSearchParams({ query: "blackline" }));
assert.ok(nameResults.parlors.some((business) => business.id === "blackline-borough"));

const index = fs.readFileSync(path.join(root, "public/index.html"), "utf8");
const app = fs.readFileSync(path.join(root, "public/app.js"), "utf8");
const worker = fs.readFileSync(path.join(root, "cloudflare/worker.js"), "utf8");
const schema = fs.readFileSync(path.join(root, "cloudflare/schema.sql"), "utf8");
assert.ok(app.includes("buy_btn_1TmRvsGJtywdCBcEmAmvEuWF"), "Stripe buy button ID is present");
assert.ok(app.includes("pk_live_51TdF41GJtywdCBcE"), "Stripe publishable key is present");
assert.ok(app.includes("client-reference-id"), "Stripe buy button maps checkout to a business");
assert.ok(index.includes("stripe-buy-button-container"), "Stripe buy button container is present");
assert.ok(worker.includes("/api/stripe/webhook"), "Cloudflare Stripe webhook route is present");
assert.ok(worker.includes("verifyStripeSignature"), "Cloudflare webhook signature verification is present");
assert.ok(worker.includes("async email(message, env"), "Cloudflare inbound email handler is present");
assert.ok(worker.includes("/api/business/email/send"), "Business email send route is present");
assert.ok(schema.includes("CREATE TABLE IF NOT EXISTS subscriptions"), "D1 subscription table is present");
assert.ok(schema.includes("CREATE TABLE IF NOT EXISTS stripe_events"), "D1 Stripe event idempotency table is present");
assert.ok(schema.includes("CREATE TABLE IF NOT EXISTS business_email_settings"), "D1 business email settings table is present");
assert.ok(schema.includes("CREATE TABLE IF NOT EXISTS email_messages"), "D1 mailbox message table is present");

console.log("Holler & Son checks passed.");
