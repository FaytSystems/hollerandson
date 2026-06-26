const http = require("node:http");
const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");

const ROOT_DIR = __dirname;
const PUBLIC_DIR = path.join(ROOT_DIR, "public");
const DATA_DIR = path.join(ROOT_DIR, "data");
const STORE_PATH = process.env.DATA_FILE
  ? path.resolve(ROOT_DIR, process.env.DATA_FILE)
  : path.join(DATA_DIR, "store.json");
const PORT = Number(process.env.PORT || 4173);
const MAX_BODY_BYTES = 12 * 1024 * 1024;

const LOCATION_INDEX = {
  "nashville": { label: "Nashville, TN", lat: 36.1627, lng: -86.7816 },
  "nashville tn": { label: "Nashville, TN", lat: 36.1627, lng: -86.7816 },
  "37203": { label: "Nashville, TN 37203", lat: 36.1539, lng: -86.7895 },
  "east nashville": { label: "East Nashville, TN", lat: 36.1866, lng: -86.7409 },
  "austin": { label: "Austin, TX", lat: 30.2672, lng: -97.7431 },
  "austin tx": { label: "Austin, TX", lat: 30.2672, lng: -97.7431 },
  "brooklyn": { label: "Brooklyn, NY", lat: 40.6782, lng: -73.9442 },
  "brooklyn ny": { label: "Brooklyn, NY", lat: 40.6782, lng: -73.9442 },
  "chicago": { label: "Chicago, IL", lat: 41.8781, lng: -87.6298 },
  "chicago il": { label: "Chicago, IL", lat: 41.8781, lng: -87.6298 },
  "denver": { label: "Denver, CO", lat: 39.7392, lng: -104.9903 },
  "denver co": { label: "Denver, CO", lat: 39.7392, lng: -104.9903 },
  "los angeles": { label: "Los Angeles, CA", lat: 34.0522, lng: -118.2437 },
  "los angeles ca": { label: "Los Angeles, CA", lat: 34.0522, lng: -118.2437 },
  "miami": { label: "Miami, FL", lat: 25.7617, lng: -80.1918 },
  "miami fl": { label: "Miami, FL", lat: 25.7617, lng: -80.1918 },
  "portland": { label: "Portland, OR", lat: 45.5152, lng: -122.6784 },
  "portland or": { label: "Portland, OR", lat: 45.5152, lng: -122.6784 },
  "seattle": { label: "Seattle, WA", lat: 47.6062, lng: -122.3321 },
  "seattle wa": { label: "Seattle, WA", lat: 47.6062, lng: -122.3321 }
};

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml; charset=utf-8",
  ".webp": "image/webp",
  ".ico": "image/x-icon"
};

function hashPassword(password) {
  return crypto.createHash("sha256").update(String(password)).digest("hex");
}

function randomId(prefix) {
  return `${prefix}_${crypto.randomBytes(8).toString("hex")}`;
}

function nowIso() {
  return new Date().toISOString();
}

function addDays(days, hour = 14, minute = 0) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(hour, minute, 0, 0);
  return date.toISOString();
}

function svgData(title, palette, pathLine) {
  const [bg, ink, accent, paper] = palette;
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 640">
      <defs>
        <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stop-color="${bg}"/>
          <stop offset="1" stop-color="${ink}"/>
        </linearGradient>
        <filter id="grain">
          <feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" stitchTiles="stitch"/>
          <feColorMatrix type="saturate" values="0"/>
          <feComponentTransfer><feFuncA type="table" tableValues="0 .18"/></feComponentTransfer>
        </filter>
      </defs>
      <rect width="900" height="640" fill="url(#g)"/>
      <rect width="900" height="640" filter="url(#grain)" opacity=".5"/>
      <circle cx="710" cy="160" r="92" fill="${accent}" opacity=".22"/>
      <circle cx="182" cy="480" r="122" fill="${paper}" opacity=".12"/>
      <path d="${pathLine}" fill="none" stroke="${paper}" stroke-width="18" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M126 526 C260 440, 376 576, 512 486 S760 430, 800 540" fill="none" stroke="${accent}" stroke-width="7" stroke-linecap="round"/>
      <text x="56" y="96" fill="${paper}" font-family="Georgia, serif" font-size="54" font-weight="700">${title}</text>
    </svg>
  `;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function createSeedStore() {
  const createdAt = nowIso();
  const hollerArt = [
    {
      id: "art_holler_serpent",
      title: "Serpent & Rose",
      style: "blackwork",
      caption: "High-contrast linework with botanical detail.",
      image: svgData("SERPENT", ["#160f12", "#3b1117", "#c99a4b", "#f2dfc2"], "M180 360 C250 180, 420 210, 402 332 C386 444, 548 462, 610 310 C648 218, 760 238, 744 350"),
      createdAt
    },
    {
      id: "art_holler_anchor",
      title: "Old Gold Anchor",
      style: "traditional",
      caption: "Bold traditional forms with warm brass tones.",
      image: svgData("ANCHOR", ["#111214", "#202b2d", "#a61c31", "#f3deb3"], "M450 160 L450 450 M338 260 C338 196, 562 196, 562 260 M276 430 C380 552, 520 552, 624 430"),
      createdAt
    },
    {
      id: "art_holler_moth",
      title: "Night Moth",
      style: "fine-line",
      caption: "Fine-line symmetry for delicate placement work.",
      image: svgData("MOTH", ["#12100e", "#2d2119", "#b85c38", "#f1e8d8"], "M450 220 C360 120, 220 176, 214 332 C320 330, 384 394, 450 476 C516 394, 580 330, 686 332 C680 176, 540 120, 450 220"),
      createdAt
    }
  ];

  return {
    schemaVersion: 1,
    employees: [
      {
        id: "emp_owner",
        businessId: "holler-and-son",
        name: "Mara Holler",
        email: "studio@hollerandson.ink",
        passwordHash: hashPassword("inkmaster2026"),
        role: "Owner"
      }
    ],
    sessions: [],
    businesses: [
      {
        id: "holler-and-son",
        name: "Holler & Son Tattoo Co.",
        slug: "holler-and-son",
        location: {
          address: "418 Meridian St",
          city: "Nashville",
          state: "TN",
          postalCode: "37207",
          lat: 36.1866,
          lng: -86.7409
        },
        phone: "(615) 555-0198",
        email: "studio@hollerandson.ink",
        website: "https://hollerandson.example",
        socials: {
          instagram: "https://instagram.com/hollerandson",
          facebook: "https://facebook.com/hollerandson",
          tiktok: "https://tiktok.com/@hollerandson"
        },
        bio: "A appointment-first Nashville studio specializing in custom blackwork, traditional flash, fine-line botanicals, and cover-up planning. Consultations are built around clean expectations, reference art, and realistic session timing.",
        specialties: ["blackwork", "traditional", "fine-line", "cover-ups", "botanical"],
        artists: ["Mara Holler", "Evan Son", "June Vega"],
        hours: "Tue-Sat 11:00 AM-8:00 PM",
        minDeposit: 75,
        featured: true,
        art: hollerArt,
        createdAt,
        updatedAt: createdAt
      },
      {
        id: "electric-sparrow",
        name: "Electric Sparrow Studio",
        slug: "electric-sparrow",
        location: {
          address: "900 E 6th St",
          city: "Austin",
          state: "TX",
          postalCode: "78702",
          lat: 30.2646,
          lng: -97.7299
        },
        phone: "(512) 555-0142",
        email: "books@electricsparrow.example",
        website: "https://electricsparrow.example",
        socials: {
          instagram: "https://instagram.com/electricsparrow"
        },
        bio: "Austin custom studio focused on neo-traditional color, illustrative pieces, and weekend consult blocks.",
        specialties: ["neo-traditional", "color", "illustrative"],
        artists: ["Riley Stone", "Mae Wren"],
        hours: "Wed-Sun 12:00 PM-9:00 PM",
        minDeposit: 100,
        featured: false,
        art: [
          {
            id: "art_sparrow_color",
            title: "Chromatic Wing",
            style: "neo-traditional",
            caption: "Saturated color with crisp linework.",
            image: svgData("COLOR", ["#101416", "#193235", "#f06d2f", "#f5d399"], "M220 366 C328 184, 532 166, 690 342 C552 318, 500 440, 392 496 C360 410, 304 374, 220 366"),
            createdAt
          }
        ],
        createdAt,
        updatedAt: createdAt
      },
      {
        id: "blackline-borough",
        name: "Blackline Borough",
        slug: "blackline-borough",
        location: {
          address: "221 Driggs Ave",
          city: "Brooklyn",
          state: "NY",
          postalCode: "11222",
          lat: 40.7221,
          lng: -73.9467
        },
        phone: "(718) 555-0167",
        email: "frontdesk@blacklineborough.example",
        website: "",
        socials: {
          instagram: "https://instagram.com/blacklineborough",
          facebook: "https://facebook.com/blacklineborough"
        },
        bio: "Brooklyn appointment studio for geometric, black-and-gray, ornamental, and delicate single-needle work.",
        specialties: ["geometric", "black-and-gray", "ornamental", "single-needle"],
        artists: ["Nico Vale", "Ari Brooks"],
        hours: "Mon-Sat 10:00 AM-7:00 PM",
        minDeposit: 125,
        featured: false,
        art: [
          {
            id: "art_borough_geo",
            title: "Quiet Geometry",
            style: "geometric",
            caption: "Measured geometry with soft shading.",
            image: svgData("GEO", ["#111113", "#29272d", "#9f2336", "#e7dfcb"], "M450 122 L652 474 L248 474 Z M306 342 L594 342 M450 122 L450 474"),
            createdAt
          }
        ],
        createdAt,
        updatedAt: createdAt
      },
      {
        id: "golden-needle-la",
        name: "Golden Needle LA",
        slug: "golden-needle-la",
        location: {
          address: "740 Mateo St",
          city: "Los Angeles",
          state: "CA",
          postalCode: "90021",
          lat: 34.0389,
          lng: -118.2326
        },
        phone: "(213) 555-0188",
        email: "hello@goldenneedlela.example",
        website: "https://goldenneedlela.example",
        socials: {
          instagram: "https://instagram.com/goldenneedlela"
        },
        bio: "Large-scale realism, portrait planning, and multi-session sleeve work with private consult days.",
        specialties: ["realism", "portraits", "sleeves", "black-and-gray"],
        artists: ["Calder Moss", "Ivy Ren"],
        hours: "Tue-Sun 11:00 AM-9:00 PM",
        minDeposit: 150,
        featured: false,
        art: [
          {
            id: "art_golden_realism",
            title: "Smoke Study",
            style: "realism",
            caption: "Smooth black-and-gray gradients.",
            image: svgData("REALISM", ["#100f0f", "#2b211f", "#d0a85a", "#f0e4d2"], "M246 462 C318 310, 352 214, 450 176 C548 214, 582 310, 654 462 C540 404, 360 404, 246 462"),
            createdAt
          }
        ],
        createdAt,
        updatedAt: createdAt
      }
    ],
    subscriptions: [
      {
        id: "sub_demo_holler",
        businessId: "holler-and-son",
        stripeCustomerId: "cus_demo_holler",
        stripeSubscriptionId: "sub_demo_holler",
        stripePriceId: "price_demo_monthly",
        status: "active",
        currentPeriodEnd: "2099-12-31T23:59:59.000Z",
        cancelAtPeriodEnd: false,
        lastEventId: "seed",
        createdAt,
        updatedAt: createdAt
      }
    ],
    stripeEvents: [],
    emailSettings: [
      {
        businessId: "holler-and-son",
        localPart: "holler-and-son",
        domain: "hollerandson.com",
        displayName: "Holler & Son Tattoo Co.",
        replyTo: "studio@hollerandson.ink",
        forwardTo: "studio@hollerandson.ink",
        inboxEnabled: true,
        forwardingEnabled: true,
        signature: "Holler & Son Tattoo Co.\nBook online with Holler & Son.",
        createdAt,
        updatedAt: createdAt
      }
    ],
    emailMessages: [],
    customers: [],
    inquiries: [],
    appointments: [
      {
        id: "appt_consult_1",
        businessId: "holler-and-son",
        customerName: "Avery Cole",
        contact: "avery@example.com",
        contactMethod: "email",
        service: "Blackwork consultation",
        artist: "Mara Holler",
        start: addDays(2, 13, 0),
        durationMinutes: 45,
        status: "confirmed",
        notes: "Bring botanical references.",
        source: "seed",
        createdAt
      },
      {
        id: "appt_consult_2",
        businessId: "holler-and-son",
        customerName: "Morgan Lee",
        contact: "(615) 555-0133",
        contactMethod: "phone",
        service: "Sleeve planning",
        artist: "Evan Son",
        start: addDays(4, 16, 30),
        durationMinutes: 60,
        status: "pending",
        notes: "Prefers phone confirmation.",
        source: "seed",
        createdAt
      }
    ],
    inbox: []
  };
}

async function ensureStore() {
  await fs.mkdir(path.dirname(STORE_PATH), { recursive: true });
  try {
    await fs.access(STORE_PATH);
  } catch {
    await writeStore(createSeedStore());
  }
}

async function readStore() {
  await ensureStore();
  const raw = await fs.readFile(STORE_PATH, "utf8");
  const store = JSON.parse(raw);
  let changed = false;
  if (!Array.isArray(store.subscriptions)) {
    store.subscriptions = [
      {
        id: "sub_demo_holler",
        businessId: "holler-and-son",
        stripeCustomerId: "cus_demo_holler",
        stripeSubscriptionId: "sub_demo_holler",
        stripePriceId: "price_demo_monthly",
        status: "active",
        currentPeriodEnd: "2099-12-31T23:59:59.000Z",
        cancelAtPeriodEnd: false,
        lastEventId: "migration",
        createdAt: nowIso(),
        updatedAt: nowIso()
      }
    ];
    changed = true;
  }
  if (!Array.isArray(store.stripeEvents)) {
    store.stripeEvents = [];
    changed = true;
  }
  if (!Array.isArray(store.emailSettings)) {
    store.emailSettings = [];
    changed = true;
  }
  if (!Array.isArray(store.emailMessages)) {
    store.emailMessages = [];
    changed = true;
  }
  if (!Array.isArray(store.customers)) {
    store.customers = [];
    changed = true;
  }
  if (changed) await writeStore(store);
  return store;
}

async function writeStore(store) {
  const tempPath = `${STORE_PATH}.tmp`;
  await fs.mkdir(path.dirname(STORE_PATH), { recursive: true });
  await fs.writeFile(tempPath, `${JSON.stringify(store, null, 2)}\n`, "utf8");
  await fs.rename(tempPath, STORE_PATH);
}

function normalizeKey(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function geocodeLocation(value) {
  const key = normalizeKey(value);
  if (!key) return null;
  return LOCATION_INDEX[key] || null;
}

function milesBetween(a, b) {
  const toRad = (degrees) => (degrees * Math.PI) / 180;
  const earthMiles = 3958.8;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * earthMiles * Math.asin(Math.sqrt(h));
}

function publicBusiness(business, distanceMiles = null) {
  return {
    id: business.id,
    name: business.name,
    slug: business.slug,
    location: business.location,
    phone: business.phone,
    email: business.email,
    website: business.website,
    socials: business.socials || {},
    bio: business.bio,
    specialties: business.specialties || [],
    artists: business.artists || [],
    hours: business.hours,
    minDeposit: business.minDeposit,
    featured: Boolean(business.featured),
    art: business.art || [],
    distanceMiles:
      typeof distanceMiles === "number" ? Number(distanceMiles.toFixed(1)) : null,
    updatedAt: business.updatedAt
  };
}

function searchBusinesses(store, params) {
  const query = normalizeKey(params.get("query"));
  const style = normalizeKey(params.get("style"));
  const locationTerm = params.get("location") || "";
  const radius = Math.min(Math.max(Number(params.get("radius") || 50), 1), 500);
  const origin = geocodeLocation(locationTerm);
  const fallbackLocation = normalizeKey(locationTerm);

  const matches = store.businesses
    .map((business) => {
      const target = {
        lat: Number(business.location.lat),
        lng: Number(business.location.lng)
      };
      const distance = origin ? milesBetween(origin, target) : null;
      const haystack = normalizeKey(
        [
          business.name,
          business.location.address,
          business.location.city,
          business.location.state,
          business.location.postalCode,
          business.bio,
          ...(business.specialties || []),
          ...(business.artists || [])
        ].join(" ")
      );
      return { business, distance, haystack };
    })
    .filter(({ distance, haystack }) => {
      const queryMatches = query ? haystack.includes(query) : true;
      const styleMatches = style ? haystack.includes(style) : true;
      const locationMatches = origin
        ? distance <= radius
        : fallbackLocation
          ? haystack.includes(fallbackLocation)
          : true;
      return queryMatches && styleMatches && locationMatches;
    })
    .sort((a, b) => {
      if (a.distance !== null && b.distance !== null) return a.distance - b.distance;
      if (a.business.featured !== b.business.featured) return a.business.featured ? -1 : 1;
      return a.business.name.localeCompare(b.business.name);
    });

  return {
    locationKnown: Boolean(origin),
    location: origin ? origin.label : null,
    radius,
    parlors: matches.map(({ business, distance }) => publicBusiness(business, distance))
  };
}

function findBusiness(store, idOrSlug) {
  return store.businesses.find(
    (business) => business.id === idOrSlug || business.slug === idOrSlug
  );
}

function findAppointment(store, businessId, appointmentId) {
  return store.appointments.find(
    (appointment) => appointment.businessId === businessId && appointment.id === appointmentId
  );
}

function getSubscription(store, businessId) {
  return [...(store.subscriptions || [])]
    .filter((subscription) => subscription.businessId === businessId)
    .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))[0];
}

function accessForSubscription(subscription) {
  const activeStatuses = new Set(["active", "trialing"]);
  const status = subscription?.status || "none";
  const endsAt = subscription?.currentPeriodEnd || "";
  const periodStillValid = !endsAt || new Date(endsAt).getTime() > Date.now();
  const isSubscribed = Boolean(subscription && activeStatuses.has(status) && periodStillValid);
  return {
    isSubscribed,
    status,
    currentPeriodEnd: endsAt,
    cancelAtPeriodEnd: Boolean(subscription?.cancelAtPeriodEnd),
    stripeCustomerId: subscription?.stripeCustomerId || "",
    stripeSubscriptionId: subscription?.stripeSubscriptionId || ""
  };
}

function subscriptionRequiredResponse(store, auth) {
  const access = accessForSubscription(getSubscription(store, auth.business.id));
  return access.isSubscribed
    ? null
    : {
        error: "A current subscription is required for this business action.",
        access
      };
}

function emailDomain() {
  return cleanString(process.env.BUSINESS_EMAIL_DOMAIN || "hollerandson.com").toLowerCase();
}

function emailLocalPart(value) {
  return normalizeKey(value).replace(/\s+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48) || "studio";
}

function professionalAddress(settings) {
  return `${settings.localPart}@${settings.domain}`.toLowerCase();
}

function formatFrom(displayName, address) {
  const safeName = cleanString(displayName || "Holler & Son").replace(/["<>]/g, "");
  return `${safeName} <${address}>`;
}

function publicEmailSettings(settings) {
  if (!settings) return null;
  return {
    businessId: settings.businessId,
    localPart: settings.localPart,
    domain: settings.domain,
    address: professionalAddress(settings),
    displayName: settings.displayName,
    replyTo: settings.replyTo || "",
    forwardTo: settings.forwardTo || "",
    inboxEnabled: Boolean(settings.inboxEnabled),
    forwardingEnabled: Boolean(settings.forwardingEnabled),
    signature: settings.signature || "",
    updatedAt: settings.updatedAt
  };
}

function ensureEmailSettings(store, business) {
  let settings = store.emailSettings.find((candidate) => candidate.businessId === business.id);
  if (!settings) {
    const createdAt = nowIso();
    settings = {
      businessId: business.id,
      localPart: emailLocalPart(business.slug || business.name),
      domain: emailDomain(),
      displayName: business.name,
      replyTo: business.email || "",
      forwardTo: business.email || "",
      inboxEnabled: true,
      forwardingEnabled: false,
      signature: `${business.name}\nSent through Holler & Son.`,
      createdAt,
      updatedAt: createdAt
    };
    store.emailSettings.push(settings);
  }
  return settings;
}

async function sendResendEmail(payload) {
  if (!process.env.RESEND_API_KEY) {
    return {
      ok: false,
      mode: "local-inbox",
      detail: "RESEND_API_KEY is not configured; email was saved but not delivered."
    };
  }

  try {
    const body = {
      from: payload.from,
      to: Array.isArray(payload.to) ? payload.to : [payload.to],
      subject: payload.subject,
      text: payload.text,
      html: payload.html
    };
    if (payload.replyTo) body.reply_to = payload.replyTo;
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });
    const providerResponse = await response.json().catch(() => ({}));
    return {
      ok: response.ok,
      mode: "resend",
      providerStatus: response.status,
      providerResponse
    };
  } catch (error) {
    return { ok: false, mode: "resend", detail: error.message };
  }
}

async function sendBusinessEmail(store, business, settings, body) {
  const to = cleanString(body.to);
  const subject = cleanString(body.subject);
  const message = cleanString(body.message);
  if (!to || !to.includes("@")) return { status: 400, payload: { error: "Recipient email is required." } };
  if (!subject) return { status: 400, payload: { error: "Subject is required." } };
  if (!message) return { status: 400, payload: { error: "Message is required." } };

  const fromAddress = professionalAddress(settings);
  const signature = cleanString(settings.signature);
  const text = `${message}${signature ? `\n\n--\n${signature}` : ""}`;
  const html = `
    <div style="font-family:Inter,Arial,sans-serif;line-height:1.55;color:#171414">
      ${escapeHtml(message).replace(/\n/g, "<br>")}
      ${
        signature
          ? `<hr style="border:none;border-top:1px solid #ddd;margin:24px 0 12px"><p style="color:#6b6259">${escapeHtml(signature).replace(/\n/g, "<br>")}</p>`
          : ""
      }
    </div>
  `;
  const delivery = await sendResendEmail({
    from: formatFrom(settings.displayName || business.name, fromAddress),
    to,
    replyTo: settings.replyTo || fromAddress,
    subject,
    text,
    html
  });
  const createdAt = nowIso();
  store.emailMessages.push({
    id: randomId("email"),
    businessId: business.id,
    direction: "outgoing",
    status: delivery.ok ? "sent" : "saved",
    fromAddress,
    toAddress: to,
    replyTo: settings.replyTo || fromAddress,
    subject,
    textBody: text,
    htmlBody: html,
    rawPreview: "",
    messageId: "",
    inReplyTo: "",
    forwardedTo: "",
    provider: delivery,
    read: true,
    createdAt
  });
  return { status: delivery.ok ? 201 : 202, payload: { ok: delivery.ok, delivery, message: { to, subject, createdAt } } };
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function contactForInquiry(inquiry) {
  if (inquiry.contactMethod === "phone") return inquiry.phone || inquiry.email || "";
  return inquiry.email || inquiry.phone || "";
}

async function sendInquiryEmail(business, inquiry, appointment) {
  const to = process.env.BUSINESS_NOTIFICATION_EMAIL || business.email;
  const subject = `New tattoo inquiry from ${inquiry.customerName}`;
  const html = `
    <h1>New tattoo inquiry</h1>
    <p><strong>Studio:</strong> ${escapeHtml(business.name)}</p>
    <p><strong>Customer:</strong> ${escapeHtml(inquiry.customerName)}</p>
    <p><strong>Preferred contact:</strong> ${escapeHtml(inquiry.contactMethod)}</p>
    <p><strong>Email:</strong> ${escapeHtml(inquiry.email || "Not provided")}</p>
    <p><strong>Phone:</strong> ${escapeHtml(inquiry.phone || "Not provided")}</p>
    <p><strong>Requested time:</strong> ${escapeHtml(appointment.start)}</p>
    <p><strong>Service:</strong> ${escapeHtml(inquiry.service)}</p>
    <p><strong>Artist:</strong> ${escapeHtml(inquiry.artist || "Any available artist")}</p>
    <p><strong>Message:</strong><br>${escapeHtml(inquiry.message).replace(/\n/g, "<br>")}</p>
  `;

  if (!process.env.RESEND_API_KEY) {
    return {
      ok: false,
      mode: "local-inbox",
      to,
      detail: "RESEND_API_KEY is not configured; notification was saved to the employee inbox."
    };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || "Holler & Son <onboarding@resend.dev>",
        to: [to],
        subject,
        html
      })
    });
    const providerResponse = await response.json().catch(() => ({}));
    return {
      ok: response.ok,
      mode: "resend",
      to,
      providerStatus: response.status,
      providerResponse
    };
  } catch (error) {
    return {
      ok: false,
      mode: "resend",
      to,
      detail: error.message
    };
  }
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(JSON.stringify(payload));
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error("Request body is too large."));
        req.destroy();
        return;
      }
      raw += chunk;
    });
    req.on("end", () => {
      if (!raw.trim()) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error("Request body must be valid JSON."));
      }
    });
    req.on("error", reject);
  });
}

function readTextBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error("Request body is too large."));
        req.destroy();
        return;
      }
      raw += chunk;
    });
    req.on("end", () => resolve(raw));
    req.on("error", reject);
  });
}

function timingSafeEqualHex(a, b) {
  const left = Buffer.from(String(a || ""), "hex");
  const right = Buffer.from(String(b || ""), "hex");
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function verifyStripeSignature(rawBody, signatureHeader, endpointSecret) {
  if (!endpointSecret) throw new Error("STRIPE_WEBHOOK_SECRET is not configured.");
  if (!signatureHeader) throw new Error("Missing Stripe-Signature header.");
  const timestamp = signatureHeader
    .split(",")
    .find((part) => part.startsWith("t="))
    ?.slice(2);
  const signatures = signatureHeader
    .split(",")
    .filter((part) => part.startsWith("v1="))
    .map((part) => part.slice(3));
  if (!timestamp || !signatures.length) throw new Error("Invalid Stripe-Signature header.");
  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (age > 300) throw new Error("Stripe webhook timestamp is outside tolerance.");
  const expected = crypto
    .createHmac("sha256", endpointSecret)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");
  if (!signatures.some((signature) => timingSafeEqualHex(signature, expected))) {
    throw new Error("Stripe webhook signature verification failed.");
  }
}

function stripeTimestamp(seconds) {
  return seconds ? new Date(Number(seconds) * 1000).toISOString() : "";
}

function subscriptionPriceId(subscription) {
  return subscription?.items?.data?.[0]?.price?.id || "";
}

function upsertSubscription(store, payload) {
  const now = nowIso();
  const existing = store.subscriptions.find(
    (subscription) => subscription.stripeSubscriptionId === payload.stripeSubscriptionId
  );
  const next = {
    id: existing?.id || payload.id || randomId("sub"),
    businessId: payload.businessId,
    stripeCustomerId: payload.stripeCustomerId || "",
    stripeSubscriptionId: payload.stripeSubscriptionId,
    stripePriceId: payload.stripePriceId || existing?.stripePriceId || "",
    status: payload.status || "incomplete",
    currentPeriodEnd: payload.currentPeriodEnd || existing?.currentPeriodEnd || "",
    cancelAtPeriodEnd: Boolean(payload.cancelAtPeriodEnd),
    lastEventId: payload.lastEventId || "",
    createdAt: existing?.createdAt || now,
    updatedAt: now
  };
  if (existing) Object.assign(existing, next);
  else store.subscriptions.push(next);
}

function businessIdForSubscription(store, stripeSubscriptionId, stripeCustomerId = "") {
  const bySubscription = store.subscriptions.find(
    (subscription) => subscription.stripeSubscriptionId === stripeSubscriptionId
  );
  if (bySubscription) return bySubscription.businessId;
  const byCustomer = [...store.subscriptions]
    .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))
    .find((subscription) => subscription.stripeCustomerId === stripeCustomerId);
  return byCustomer?.businessId || "";
}

async function handleStripeWebhook(req, res, store) {
  const rawBody = await readTextBody(req);
  verifyStripeSignature(rawBody, req.headers["stripe-signature"], process.env.STRIPE_WEBHOOK_SECRET);
  const event = JSON.parse(rawBody);
  if (store.stripeEvents.some((seen) => seen.id === event.id)) {
    return sendJson(res, 200, { received: true, duplicate: true });
  }

  const object = event.data?.object || {};
  const processedAt = nowIso();

  if (event.type === "checkout.session.completed") {
    const business = findBusiness(store, cleanString(object.client_reference_id));
    const subscriptionId = typeof object.subscription === "string" ? object.subscription : object.subscription?.id;
    if (business && subscriptionId) {
      upsertSubscription(store, {
        businessId: business.id,
        stripeCustomerId: typeof object.customer === "string" ? object.customer : object.customer?.id,
        stripeSubscriptionId: subscriptionId,
        status: object.payment_status === "paid" ? "active" : "incomplete",
        lastEventId: event.id
      });
    }
  }

  if (event.type === "customer.subscription.created" || event.type === "customer.subscription.updated") {
    const businessId = businessIdForSubscription(
      store,
      object.id,
      typeof object.customer === "string" ? object.customer : object.customer?.id
    );
    if (businessId) {
      upsertSubscription(store, {
        businessId,
        stripeCustomerId: typeof object.customer === "string" ? object.customer : object.customer?.id,
        stripeSubscriptionId: object.id,
        stripePriceId: subscriptionPriceId(object),
        status: object.status,
        currentPeriodEnd: stripeTimestamp(object.current_period_end),
        cancelAtPeriodEnd: Boolean(object.cancel_at_period_end),
        lastEventId: event.id
      });
    }
  }

  if (event.type === "customer.subscription.deleted") {
    const existing = store.subscriptions.find((subscription) => subscription.stripeSubscriptionId === object.id);
    if (existing) {
      existing.status = object.status || "canceled";
      existing.currentPeriodEnd = stripeTimestamp(object.current_period_end);
      existing.cancelAtPeriodEnd = Boolean(object.cancel_at_period_end);
      existing.lastEventId = event.id;
      existing.updatedAt = processedAt;
    }
  }

  if (event.type === "invoice.paid" || event.type === "invoice.payment_failed") {
    const subscriptionId = typeof object.subscription === "string" ? object.subscription : object.subscription?.id;
    const existing = store.subscriptions.find(
      (subscription) => subscription.stripeSubscriptionId === subscriptionId
    );
    if (existing) {
      existing.status = event.type === "invoice.paid" ? "active" : "past_due";
      existing.currentPeriodEnd = stripeTimestamp(object.lines?.data?.[0]?.period?.end) || existing.currentPeriodEnd;
      existing.lastEventId = event.id;
      existing.updatedAt = processedAt;
    }
  }

  store.stripeEvents.push({
    id: event.id,
    type: event.type,
    processedAt,
    payload: event
  });
  await writeStore(store);
  return sendJson(res, 200, { received: true });
}

function getBearerToken(req) {
  const header = req.headers.authorization || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : "";
}

function getAuthContext(store, req) {
  const token = getBearerToken(req);
  if (!token) return null;
  const session = store.sessions.find((candidate) => candidate.token === token);
  if (!session || new Date(session.expiresAt).getTime() < Date.now()) return null;
  const employee = store.employees.find((candidate) => candidate.id === session.employeeId);
  const business = employee ? findBusiness(store, employee.businessId) : null;
  if (!employee || !business) return null;
  return { employee, business, session };
}

function cleanString(value, fallback = "") {
  return String(value ?? fallback).trim();
}

function cleanList(value) {
  if (Array.isArray(value)) return value.map((item) => cleanString(item)).filter(Boolean);
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function validateInquiry(body, business) {
  const customerName = cleanString(body.customerName);
  const contactMethod = body.contactMethod === "phone" ? "phone" : "email";
  const email = cleanString(body.email);
  const phone = cleanString(body.phone);
  const service = cleanString(body.service);
  const preferredDate = cleanString(body.preferredDate);
  const preferredTime = cleanString(body.preferredTime);

  if (!business) return "Tattoo parlor was not found.";
  if (!customerName) return "Customer name is required.";
  if (contactMethod === "email" && !email) return "Email is required for email contact.";
  if (contactMethod === "phone" && !phone) return "Phone number is required for phone contact.";
  if (!service) return "Tattoo idea or service is required.";
  if (!preferredDate || !preferredTime) return "Preferred date and time are required.";
  return null;
}

async function handleApi(req, res, url) {
  const store = await readStore();
  const method = req.method || "GET";
  const pathname = url.pathname;

  if (method === "GET" && pathname === "/api/health") {
    return sendJson(res, 200, { ok: true, service: "hollerandson", time: nowIso() });
  }

  if (method === "POST" && pathname === "/api/stripe/webhook") {
    return handleStripeWebhook(req, res, store);
  }

  if (method === "GET" && pathname === "/api/parlors") {
    return sendJson(res, 200, searchBusinesses(store, url.searchParams));
  }

  const parlorMatch = pathname.match(/^\/api\/parlors\/([^/]+)$/);
  if (method === "GET" && parlorMatch) {
    const business = findBusiness(store, decodeURIComponent(parlorMatch[1]));
    if (!business) return sendJson(res, 404, { error: "Tattoo parlor not found." });
    return sendJson(res, 200, { business: publicBusiness(business) });
  }

  if (method === "POST" && pathname === "/api/employee/login") {
    const body = await readJsonBody(req);
    const email = cleanString(body.email).toLowerCase();
    const passwordHash = hashPassword(body.password || "");
    const employee = store.employees.find(
      (candidate) => candidate.email.toLowerCase() === email && candidate.passwordHash === passwordHash
    );
    if (!employee) return sendJson(res, 401, { error: "Invalid employee login." });

    const token = crypto.randomBytes(24).toString("base64url");
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 12).toISOString();
    store.sessions = store.sessions.filter(
      (session) => new Date(session.expiresAt).getTime() > Date.now()
    );
    store.sessions.push({ token, employeeId: employee.id, createdAt: nowIso(), expiresAt });
    await writeStore(store);

    const business = findBusiness(store, employee.businessId);
    return sendJson(res, 200, {
      token,
      employee: {
        id: employee.id,
        name: employee.name,
        email: employee.email,
        role: employee.role
      },
      business: publicBusiness(business)
    });
  }

  if (method === "POST" && pathname === "/api/inquiries") {
    const body = await readJsonBody(req);
    const business = findBusiness(store, cleanString(body.businessId || body.parlorId));
    const validationError = validateInquiry(body, business);
    if (validationError) return sendJson(res, 400, { error: validationError });

    const start = new Date(`${body.preferredDate}T${body.preferredTime}:00`).toISOString();
    const inquiry = {
      id: randomId("inq"),
      customerId: null,
      businessId: business.id,
      customerName: cleanString(body.customerName),
      contactMethod: body.contactMethod === "phone" ? "phone" : "email",
      email: cleanString(body.email),
      phone: cleanString(body.phone),
      service: cleanString(body.service),
      artist: cleanString(body.artist || "Any available artist"),
      placement: cleanString(body.placement),
      budget: cleanString(body.budget),
      message: cleanString(body.message),
      consent: Boolean(body.consent),
      status: "new",
      createdAt: nowIso()
    };
    if (body.saveCustomer) {
      const existingCustomer = store.customers.find((customer) => {
        const sameEmail = inquiry.email && customer.email?.toLowerCase() === inquiry.email.toLowerCase();
        const samePhone = inquiry.phone && customer.phone === inquiry.phone;
        return sameEmail || samePhone;
      });
      const customerPayload = {
        name: inquiry.customerName,
        email: inquiry.email,
        phone: inquiry.phone,
        preferredContact: inquiry.contactMethod,
        updatedAt: inquiry.createdAt
      };
      if (existingCustomer) {
        Object.assign(existingCustomer, customerPayload);
        inquiry.customerId = existingCustomer.id;
      } else {
        const customer = {
          id: randomId("cust"),
          ...customerPayload,
          createdAt: inquiry.createdAt
        };
        store.customers.push(customer);
        inquiry.customerId = customer.id;
      }
    }
    const appointment = {
      id: randomId("appt"),
      businessId: business.id,
      inquiryId: inquiry.id,
      customerName: inquiry.customerName,
      contact: contactForInquiry(inquiry),
      contactMethod: inquiry.contactMethod,
      service: inquiry.service,
      artist: inquiry.artist,
      start,
      durationMinutes: Number(body.durationMinutes || 60),
      status: "pending",
      notes: inquiry.message,
      source: "customer",
      createdAt: inquiry.createdAt
    };

    const delivery = await sendInquiryEmail(business, inquiry, appointment);
    const inboxMessage = {
      id: randomId("msg"),
      businessId: business.id,
      inquiryId: inquiry.id,
      appointmentId: appointment.id,
      fromName: inquiry.customerName,
      fromContact: contactForInquiry(inquiry),
      subject: `New ${inquiry.service} inquiry`,
      preview: inquiry.message || `${inquiry.customerName} requested ${inquiry.service}.`,
      delivery,
      read: false,
      createdAt: inquiry.createdAt
    };

    store.inquiries.push(inquiry);
    store.appointments.push(appointment);
    store.inbox.push(inboxMessage);
    await writeStore(store);

    return sendJson(res, 201, {
      ok: true,
      inquiry,
      appointment,
      emailDelivery: delivery
    });
  }

  const auth = getAuthContext(store, req);
  const needsAuth =
    pathname.startsWith("/api/employee/") ||
    pathname.startsWith("/api/business/") ||
    pathname.startsWith("/api/inquiries/") ||
    pathname.startsWith("/api/appointments/");
  if (needsAuth && !auth) return sendJson(res, 401, { error: "Employee login required." });

  if (method === "GET" && pathname === "/api/employee/dashboard") {
    const businessId = auth.business.id;
    const access = accessForSubscription(getSubscription(store, businessId));
    const emailSettings = ensureEmailSettings(store, auth.business);
    await writeStore(store);
    return sendJson(res, 200, {
      employee: {
        id: auth.employee.id,
        name: auth.employee.name,
        email: auth.employee.email,
        role: auth.employee.role
      },
      business: publicBusiness(auth.business),
      access,
      emailSettings: publicEmailSettings(emailSettings),
      emailMessages: access.isSubscribed
        ? store.emailMessages
            .filter((message) => message.businessId === businessId)
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        : [],
      inquiries: access.isSubscribed
        ? store.inquiries
            .filter((inquiry) => inquiry.businessId === businessId)
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        : [],
      appointments: access.isSubscribed
        ? store.appointments
            .filter((appointment) => appointment.businessId === businessId)
            .sort((a, b) => a.start.localeCompare(b.start))
        : [],
      customers: access.isSubscribed
        ? store.customers
            .filter((customer) =>
              store.inquiries.some(
                (inquiry) => inquiry.businessId === businessId && inquiry.customerId === customer.id
              )
            )
            .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        : [],
      inbox: access.isSubscribed
        ? store.inbox
            .filter((message) => message.businessId === businessId)
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        : []
    });
  }

  if (method === "PATCH" && pathname === "/api/business/profile") {
    const subscriptionError = subscriptionRequiredResponse(store, auth);
    if (subscriptionError) return sendJson(res, 402, subscriptionError);

    const body = await readJsonBody(req);
    const business = auth.business;
    business.name = cleanString(body.name, business.name);
    business.phone = cleanString(body.phone, business.phone);
    business.email = cleanString(body.email, business.email);
    business.website = cleanString(body.website, business.website);
    business.bio = cleanString(body.bio, business.bio);
    business.hours = cleanString(body.hours, business.hours);
    business.minDeposit = Number(body.minDeposit || business.minDeposit || 0);
    business.specialties = cleanList(body.specialties);
    business.artists = cleanList(body.artists);
    business.socials = {
      instagram: cleanString(body.instagram || business.socials?.instagram),
      facebook: cleanString(body.facebook || business.socials?.facebook),
      tiktok: cleanString(body.tiktok || business.socials?.tiktok)
    };
    business.location = {
      ...business.location,
      address: cleanString(body.address, business.location.address),
      city: cleanString(body.city, business.location.city),
      state: cleanString(body.state, business.location.state),
      postalCode: cleanString(body.postalCode, business.location.postalCode),
      lat: Number(body.lat || business.location.lat),
      lng: Number(body.lng || business.location.lng)
    };
    business.updatedAt = nowIso();
    await writeStore(store);
    return sendJson(res, 200, { ok: true, business: publicBusiness(business) });
  }

  if (method === "PATCH" && pathname === "/api/business/email-settings") {
    const subscriptionError = subscriptionRequiredResponse(store, auth);
    if (subscriptionError) return sendJson(res, 402, subscriptionError);

    const body = await readJsonBody(req);
    const localPart = emailLocalPart(body.localPart || auth.business.slug || auth.business.name);
    const domain = cleanString(body.domain || emailDomain()).toLowerCase();
    const duplicate = store.emailSettings.find(
      (settings) =>
        settings.businessId !== auth.business.id &&
        settings.localPart.toLowerCase() === localPart.toLowerCase() &&
        settings.domain.toLowerCase() === domain
    );
    if (duplicate) return sendJson(res, 409, { error: "That professional email address is already taken." });
    const settings = ensureEmailSettings(store, auth.business);
    settings.localPart = localPart;
    settings.domain = domain;
    settings.displayName = cleanString(body.displayName || auth.business.name);
    settings.replyTo = cleanString(body.replyTo || auth.business.email);
    settings.forwardTo = cleanString(body.forwardTo);
    settings.inboxEnabled = Boolean(body.inboxEnabled);
    settings.forwardingEnabled = Boolean(body.forwardingEnabled);
    settings.signature = cleanString(body.signature);
    settings.updatedAt = nowIso();
    if (settings.replyTo && !settings.replyTo.includes("@")) {
      return sendJson(res, 400, { error: "Reply-to must be a valid email address." });
    }
    if (settings.forwardTo && !settings.forwardTo.includes("@")) {
      return sendJson(res, 400, { error: "Forward-to must be a valid email address." });
    }
    await writeStore(store);
    return sendJson(res, 200, { ok: true, emailSettings: publicEmailSettings(settings) });
  }

  if (method === "POST" && pathname === "/api/business/email/send") {
    const subscriptionError = subscriptionRequiredResponse(store, auth);
    if (subscriptionError) return sendJson(res, 402, subscriptionError);

    const result = await sendBusinessEmail(
      store,
      auth.business,
      ensureEmailSettings(store, auth.business),
      await readJsonBody(req)
    );
    await writeStore(store);
    return sendJson(res, result.status, result.payload);
  }

  const emailReadMatch = pathname.match(/^\/api\/business\/email\/messages\/([^/]+)$/);
  if (method === "PATCH" && emailReadMatch) {
    const subscriptionError = subscriptionRequiredResponse(store, auth);
    if (subscriptionError) return sendJson(res, 402, subscriptionError);

    const body = await readJsonBody(req);
    const message = store.emailMessages.find(
      (candidate) => candidate.id === decodeURIComponent(emailReadMatch[1]) && candidate.businessId === auth.business.id
    );
    if (!message) return sendJson(res, 404, { error: "Email message not found." });
    message.read = Boolean(body.read);
    await writeStore(store);
    return sendJson(res, 200, { ok: true });
  }

  if (method === "POST" && pathname === "/api/business/art") {
    const subscriptionError = subscriptionRequiredResponse(store, auth);
    if (subscriptionError) return sendJson(res, 402, subscriptionError);

    const body = await readJsonBody(req);
    const image = cleanString(body.image);
    if (!image.startsWith("data:image/")) {
      return sendJson(res, 400, { error: "Art upload must be an image data URL." });
    }
    const art = {
      id: randomId("art"),
      title: cleanString(body.title, "Untitled flash"),
      style: cleanString(body.style, "custom"),
      caption: cleanString(body.caption),
      image,
      createdAt: nowIso()
    };
    auth.business.art = [art, ...(auth.business.art || [])].slice(0, 80);
    auth.business.updatedAt = nowIso();
    await writeStore(store);
    return sendJson(res, 201, { ok: true, art });
  }

  const artDeleteMatch = pathname.match(/^\/api\/business\/art\/([^/]+)$/);
  if (method === "DELETE" && artDeleteMatch) {
    const subscriptionError = subscriptionRequiredResponse(store, auth);
    if (subscriptionError) return sendJson(res, 402, subscriptionError);

    const artId = decodeURIComponent(artDeleteMatch[1]);
    auth.business.art = (auth.business.art || []).filter((art) => art.id !== artId);
    auth.business.updatedAt = nowIso();
    await writeStore(store);
    return sendJson(res, 200, { ok: true });
  }

  if (method === "POST" && pathname === "/api/business/appointments") {
    const subscriptionError = subscriptionRequiredResponse(store, auth);
    if (subscriptionError) return sendJson(res, 402, subscriptionError);

    const body = await readJsonBody(req);
    const start = new Date(`${body.date}T${body.time}:00`).toISOString();
    const appointment = {
      id: randomId("appt"),
      businessId: auth.business.id,
      customerName: cleanString(body.customerName),
      contact: cleanString(body.contact),
      contactMethod: body.contactMethod === "phone" ? "phone" : "email",
      service: cleanString(body.service),
      artist: cleanString(body.artist || "Any available artist"),
      start,
      durationMinutes: Number(body.durationMinutes || 60),
      status: cleanString(body.status || "confirmed"),
      notes: cleanString(body.notes),
      source: "employee",
      createdAt: nowIso()
    };
    if (!appointment.customerName || !appointment.contact || !appointment.service) {
      return sendJson(res, 400, { error: "Customer, contact, and service are required." });
    }
    store.appointments.push(appointment);
    await writeStore(store);
    return sendJson(res, 201, { ok: true, appointment });
  }

  const appointmentPatchMatch = pathname.match(/^\/api\/business\/appointments\/([^/]+)$/);
  if (method === "PATCH" && appointmentPatchMatch) {
    const subscriptionError = subscriptionRequiredResponse(store, auth);
    if (subscriptionError) return sendJson(res, 402, subscriptionError);

    const body = await readJsonBody(req);
    const appointment = findAppointment(store, auth.business.id, decodeURIComponent(appointmentPatchMatch[1]));
    if (!appointment) return sendJson(res, 404, { error: "Appointment not found." });
    ["customerName", "contact", "service", "artist", "notes", "status"].forEach((field) => {
      if (body[field] !== undefined) appointment[field] = cleanString(body[field]);
    });
    if (body.date && body.time) {
      appointment.start = new Date(`${body.date}T${body.time}:00`).toISOString();
    }
    if (body.durationMinutes) appointment.durationMinutes = Number(body.durationMinutes);
    await writeStore(store);
    return sendJson(res, 200, { ok: true, appointment });
  }

  const inquiryPatchMatch = pathname.match(/^\/api\/inquiries\/([^/]+)$/);
  if (method === "PATCH" && inquiryPatchMatch) {
    const subscriptionError = subscriptionRequiredResponse(store, auth);
    if (subscriptionError) return sendJson(res, 402, subscriptionError);

    const body = await readJsonBody(req);
    const inquiry = store.inquiries.find(
      (candidate) => candidate.id === decodeURIComponent(inquiryPatchMatch[1]) && candidate.businessId === auth.business.id
    );
    if (!inquiry) return sendJson(res, 404, { error: "Inquiry not found." });
    if (body.status) inquiry.status = cleanString(body.status);
    if (body.notes) inquiry.employeeNotes = cleanString(body.notes);
    const appointment = store.appointments.find((candidate) => candidate.inquiryId === inquiry.id);
    if (appointment && body.status === "confirmed") appointment.status = "confirmed";
    if (appointment && body.status === "declined") appointment.status = "cancelled";
    await writeStore(store);
    return sendJson(res, 200, { ok: true, inquiry, appointment });
  }

  return sendJson(res, 404, { error: "API route not found." });
}

async function serveStatic(req, res, url) {
  let relativePath = decodeURIComponent(url.pathname);
  if (relativePath === "/") relativePath = "/index.html";
  const filePath = path.normalize(path.join(PUBLIC_DIR, relativePath));
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  try {
    const file = await fs.readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      "Content-Type": MIME_TYPES[ext] || "application/octet-stream",
      "Cache-Control": ext === ".html" ? "no-store" : "public, max-age=3600"
    });
    res.end(file);
  } catch {
    const fallback = await fs.readFile(path.join(PUBLIC_DIR, "index.html"));
    res.writeHead(200, {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store"
    });
    res.end(fallback);
  }
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
    if (url.pathname.startsWith("/api/")) {
      await handleApi(req, res, url);
    } else {
      await serveStatic(req, res, url);
    }
  } catch (error) {
    if (!res.headersSent) {
      sendJson(res, 500, { error: error.message || "Server error." });
    } else {
      res.end();
    }
  }
});

if (require.main === module) {
  ensureStore()
    .then(() => {
      server.listen(PORT, () => {
        console.log(`Holler & Son is running at http://localhost:${PORT}`);
      });
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = { server, createSeedStore, searchBusinesses };
