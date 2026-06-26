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

CREATE INDEX IF NOT EXISTS idx_businesses_slug ON businesses(slug);
CREATE INDEX IF NOT EXISTS idx_art_business ON art(business_id);
CREATE INDEX IF NOT EXISTS idx_inquiries_business ON inquiries(business_id, created_at);
CREATE INDEX IF NOT EXISTS idx_appointments_business ON appointments(business_id, start);
CREATE INDEX IF NOT EXISTS idx_inbox_business ON inbox(business_id, created_at);
CREATE INDEX IF NOT EXISTS idx_sessions_employee ON sessions(employee_id);

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

