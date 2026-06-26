PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS businesses (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  postal_code TEXT NOT NULL,
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  phone TEXT NOT NULL,
  email TEXT NOT NULL,
  website TEXT DEFAULT '',
  bio TEXT DEFAULT '',
  hours TEXT DEFAULT '',
  min_deposit INTEGER DEFAULT 0,
  specialties_json TEXT DEFAULT '[]',
  artists_json TEXT DEFAULT '[]',
  socials_json TEXT DEFAULT '{}',
  featured INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS employees (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'Employee',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  preferred_contact TEXT DEFAULT 'email',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS customer_accounts (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL UNIQUE REFERENCES customers(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS customer_sessions (
  token TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES customer_accounts(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS customer_favorites (
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  PRIMARY KEY (customer_id, business_id)
);

CREATE TABLE IF NOT EXISTS customer_messages (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  business_id TEXT REFERENCES businesses(id) ON DELETE SET NULL,
  direction TEXT NOT NULL DEFAULT 'incoming',
  status TEXT NOT NULL DEFAULT 'new',
  from_name TEXT NOT NULL DEFAULT 'Holler & Son',
  subject TEXT NOT NULL,
  preview TEXT DEFAULT '',
  body TEXT DEFAULT '',
  read INTEGER DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS inquiries (
  id TEXT PRIMARY KEY,
  customer_id TEXT REFERENCES customers(id) ON DELETE SET NULL,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  customer_name TEXT NOT NULL,
  contact_method TEXT NOT NULL,
  email TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  service TEXT NOT NULL,
  artist TEXT DEFAULT 'Any available artist',
  placement TEXT DEFAULT '',
  budget TEXT DEFAULT '',
  message TEXT DEFAULT '',
  consent INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'new',
  employee_notes TEXT DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS appointments (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  inquiry_id TEXT REFERENCES inquiries(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL,
  contact TEXT NOT NULL,
  contact_method TEXT NOT NULL DEFAULT 'email',
  service TEXT NOT NULL,
  artist TEXT DEFAULT 'Any available artist',
  start TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 60,
  status TEXT NOT NULL DEFAULT 'pending',
  notes TEXT DEFAULT '',
  source TEXT NOT NULL DEFAULT 'customer',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS art (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  style TEXT DEFAULT '',
  caption TEXT DEFAULT '',
  r2_key TEXT DEFAULT '',
  image_url TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS inbox (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  inquiry_id TEXT REFERENCES inquiries(id) ON DELETE SET NULL,
  appointment_id TEXT REFERENCES appointments(id) ON DELETE SET NULL,
  from_name TEXT NOT NULL,
  from_contact TEXT NOT NULL,
  subject TEXT NOT NULL,
  preview TEXT DEFAULT '',
  delivery_json TEXT DEFAULT '{}',
  read INTEGER DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS business_email_settings (
  business_id TEXT PRIMARY KEY REFERENCES businesses(id) ON DELETE CASCADE,
  local_part TEXT NOT NULL,
  domain TEXT NOT NULL DEFAULT 'hollerandson.com',
  display_name TEXT NOT NULL,
  reply_to TEXT DEFAULT '',
  forward_to TEXT DEFAULT '',
  inbox_enabled INTEGER DEFAULT 1,
  forwarding_enabled INTEGER DEFAULT 0,
  signature TEXT DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(local_part, domain)
);

CREATE TABLE IF NOT EXISTS email_messages (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  direction TEXT NOT NULL CHECK(direction IN ('incoming', 'outgoing')),
  status TEXT NOT NULL DEFAULT 'stored',
  from_address TEXT NOT NULL,
  to_address TEXT NOT NULL,
  reply_to TEXT DEFAULT '',
  subject TEXT DEFAULT '',
  text_body TEXT DEFAULT '',
  html_body TEXT DEFAULT '',
  raw_preview TEXT DEFAULT '',
  message_id TEXT DEFAULT '',
  in_reply_to TEXT DEFAULT '',
  forwarded_to TEXT DEFAULT '',
  provider_json TEXT DEFAULT '{}',
  read INTEGER DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  stripe_customer_id TEXT DEFAULT '',
  stripe_subscription_id TEXT NOT NULL UNIQUE,
  stripe_price_id TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'incomplete',
  current_period_end TEXT DEFAULT '',
  cancel_at_period_end INTEGER DEFAULT 0,
  last_event_id TEXT DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS stripe_events (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  processed_at TEXT NOT NULL,
  payload_json TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_businesses_slug ON businesses(slug);
CREATE INDEX IF NOT EXISTS idx_art_business ON art(business_id);
CREATE INDEX IF NOT EXISTS idx_inquiries_business ON inquiries(business_id, created_at);
CREATE INDEX IF NOT EXISTS idx_appointments_business ON appointments(business_id, start);
CREATE INDEX IF NOT EXISTS idx_inbox_business ON inbox(business_id, created_at);
CREATE INDEX IF NOT EXISTS idx_sessions_employee ON sessions(employee_id);
CREATE INDEX IF NOT EXISTS idx_customer_accounts_email ON customer_accounts(email);
CREATE INDEX IF NOT EXISTS idx_customer_sessions_account ON customer_sessions(account_id);
CREATE INDEX IF NOT EXISTS idx_customer_favorites_customer ON customer_favorites(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_messages_customer ON customer_messages(customer_id, created_at);
CREATE INDEX IF NOT EXISTS idx_email_settings_address ON business_email_settings(local_part, domain);
CREATE INDEX IF NOT EXISTS idx_email_messages_business ON email_messages(business_id, created_at);
CREATE INDEX IF NOT EXISTS idx_subscriptions_business ON subscriptions(business_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_customer ON subscriptions(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);

INSERT OR IGNORE INTO businesses (
  id, slug, name, address, city, state, postal_code, lat, lng, phone, email, website,
  bio, hours, min_deposit, specialties_json, artists_json, socials_json, featured, created_at, updated_at
) VALUES (
  'holler-and-son',
  'holler-and-son',
  'Holler & Son Tattoo Co.',
  '418 Meridian St',
  'Nashville',
  'TN',
  '37207',
  36.1866,
  -86.7409,
  '(615) 555-0198',
  'studio@hollerandson.ink',
  'https://hollerandson.example',
  'An appointment-first Nashville studio specializing in custom blackwork, traditional flash, fine-line botanicals, and cover-up planning.',
  'Tue-Sat 11:00 AM-8:00 PM',
  75,
  '["blackwork","traditional","fine-line","cover-ups","botanical"]',
  '["Mara Holler","Evan Son","June Vega"]',
  '{"instagram":"https://instagram.com/hollerandson","facebook":"https://facebook.com/hollerandson","tiktok":"https://tiktok.com/@hollerandson"}',
  1,
  datetime('now'),
  datetime('now')
);

INSERT OR IGNORE INTO employees (
  id, business_id, name, email, password_hash, role, created_at
) VALUES (
  'emp_owner',
  'holler-and-son',
  'Mara Holler',
  'studio@hollerandson.ink',
  '39732c6608eaf0cab88824f04faff99ddbcb184a52828225579c392ad8c91440',
  'Owner',
  datetime('now')
);

INSERT OR IGNORE INTO art (
  id, business_id, title, style, caption, r2_key, image_url, created_at
) VALUES (
  'art_seed_studio',
  'holler-and-son',
  'Studio Flash Wall',
  'studio',
  'A look at the studio mood and flash wall.',
  '',
  '/assets/tattoo-studio-hero.png',
  datetime('now')
);

INSERT OR IGNORE INTO business_email_settings (
  business_id, local_part, domain, display_name, reply_to, forward_to,
  inbox_enabled, forwarding_enabled, signature, created_at, updated_at
) VALUES (
  'holler-and-son',
  'holler-and-son',
  'hollerandson.com',
  'Holler & Son Tattoo Co.',
  'studio@hollerandson.ink',
  'studio@hollerandson.ink',
  1,
  1,
  'Holler & Son Tattoo Co.\nBook online with Holler & Son.',
  datetime('now'),
  datetime('now')
);

INSERT OR IGNORE INTO subscriptions (
  id, business_id, stripe_customer_id, stripe_subscription_id, stripe_price_id,
  status, current_period_end, cancel_at_period_end, last_event_id, created_at, updated_at
) VALUES (
  'sub_demo_holler',
  'holler-and-son',
  'cus_demo_holler',
  'sub_demo_holler',
  'price_demo_monthly',
  'active',
  '2099-12-31T23:59:59.000Z',
  0,
  'seed',
  datetime('now'),
  datetime('now')
);
