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
assert.ok(index.includes("buy_btn_1TmRvsGJtywdCBcEmAmvEuWF"), "Stripe buy button is present");
assert.ok(index.includes("pk_live_51TdF41GJtywdCBcE"), "Stripe publishable key is present");

console.log("Holler & Son checks passed.");

