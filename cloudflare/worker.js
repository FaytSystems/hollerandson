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

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}

function nowIso() {
  return new Date().toISOString();
}

function randomId(prefix) {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return `${prefix}_${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

function clean(value, fallback = "") {
  return String(value ?? fallback).trim();
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function list(value) {
  if (Array.isArray(value)) return value.map((item) => clean(item)).filter(Boolean);
  return String(value || "").split(",").map((item) => item.trim()).filter(Boolean);
}

function parseJson(value, fallback) {
  try {
    return JSON.parse(value || "");
  } catch {
    return fallback;
  }
}

function normalize(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function emailLocalPart(value) {
  return normalize(value).replace(/\s+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48) || "studio";
}

function parseAddress(address) {
  const match = String(address || "").match(/<([^>]+)>/);
  return clean(match ? match[1] : address).toLowerCase();
}

function emailDomain(env) {
  return clean(env.BUSINESS_EMAIL_DOMAIN || "hollerandson.com").toLowerCase();
}

function professionalAddress(settings) {
  return `${settings.local_part}@${settings.domain}`.toLowerCase();
}

function formatFrom(displayName, address) {
  const safeName = clean(displayName || "Holler & Son").replace(/["<>]/g, "");
  return `${safeName} <${address}>`;
}

function geocode(value) {
  const key = normalize(value);
  return key ? LOCATION_INDEX[key] || null : null;
}

function milesBetween(a, b) {
  const toRad = (degrees) => (degrees * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * 3958.8 * Math.asin(Math.sqrt(h));
}

async function sha256(value) {
  const bytes = new TextEncoder().encode(String(value));
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function hex(buffer) {
  return Array.from(new Uint8Array(buffer), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqualHex(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let index = 0; index < a.length; index += 1) {
    diff |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return diff === 0;
}

async function verifyStripeSignature(rawBody, signatureHeader, endpointSecret) {
  if (!endpointSecret) throw new Error("STRIPE_WEBHOOK_SECRET is not configured.");
  if (!signatureHeader) throw new Error("Missing Stripe-Signature header.");

  const parts = Object.fromEntries(
    signatureHeader.split(",").map((part) => {
      const [key, ...rest] = part.split("=");
      return [key, rest.join("=")];
    })
  );
  const timestamp = parts.t;
  const signatures = signatureHeader
    .split(",")
    .filter((part) => part.startsWith("v1="))
    .map((part) => part.slice(3));
  if (!timestamp || !signatures.length) throw new Error("Invalid Stripe-Signature header.");

  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (age > 300) throw new Error("Stripe webhook timestamp is outside tolerance.");

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(endpointSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const expected = hex(await crypto.subtle.sign("HMAC", key, encoder.encode(`${timestamp}.${rawBody}`)));
  if (!signatures.some((signature) => timingSafeEqualHex(signature, expected))) {
    throw new Error("Stripe webhook signature verification failed.");
  }
}

function publicBusiness(row, art = [], distanceMiles = null) {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    location: {
      address: row.address,
      city: row.city,
      state: row.state,
      postalCode: row.postal_code,
      lat: row.lat,
      lng: row.lng
    },
    phone: row.phone,
    email: row.email,
    website: row.website || "",
    socials: parseJson(row.socials_json, {}),
    bio: row.bio || "",
    hours: row.hours || "",
    minDeposit: row.min_deposit || 0,
    specialties: parseJson(row.specialties_json, []),
    artists: parseJson(row.artists_json, []),
    featured: Boolean(row.featured),
    art,
    distanceMiles: typeof distanceMiles === "number" ? Number(distanceMiles.toFixed(1)) : null,
    updatedAt: row.updated_at
  };
}

async function getArt(env, businessId) {
  const { results } = await env.DB.prepare(
    "SELECT id, title, style, caption, image_url AS image, created_at AS createdAt FROM art WHERE business_id = ? ORDER BY created_at DESC LIMIT 80"
  ).bind(businessId).all();
  return results || [];
}

async function getBusiness(env, idOrSlug) {
  return env.DB.prepare("SELECT * FROM businesses WHERE id = ? OR slug = ? LIMIT 1").bind(idOrSlug, idOrSlug).first();
}

async function uniqueSlug(env, value) {
  const base = emailLocalPart(value).slice(0, 52) || "studio";
  let slug = base;
  let counter = 2;
  while (await getBusiness(env, slug)) {
    slug = `${base}-${counter}`;
    counter += 1;
  }
  return slug;
}

function publicCustomer(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email || "",
    phone: row.phone || "",
    preferredContact: row.preferred_contact || "email",
    updatedAt: row.updated_at
  };
}

async function customerDashboard(env, customer) {
  const { results: favoriteRows } = await env.DB.prepare(
    `SELECT b.*
     FROM customer_favorites f
     JOIN businesses b ON b.id = f.business_id
     WHERE f.customer_id = ?
     ORDER BY f.created_at DESC`
  )
    .bind(customer.id)
    .all();
  const favorites = [];
  for (const row of favoriteRows || []) {
    favorites.push(publicBusiness(row, await getArt(env, row.id)));
  }
  const { results: messages } = await env.DB.prepare(
    `SELECT
      id, business_id AS businessId, direction, status, from_name AS fromName,
      subject, preview, body, read, created_at AS createdAt
     FROM customer_messages
     WHERE customer_id = ?
     ORDER BY created_at DESC
     LIMIT 120`
  )
    .bind(customer.id)
    .all();
  return {
    customer: publicCustomer(customer),
    favorites,
    messages: (messages || []).map((message) => ({ ...message, read: Boolean(message.read) })),
    unreadCount: (messages || []).filter((message) => !message.read).length
  };
}

async function getSubscription(env, businessId) {
  return env.DB.prepare(
    "SELECT * FROM subscriptions WHERE business_id = ? ORDER BY updated_at DESC LIMIT 1"
  ).bind(businessId).first();
}

function publicEmailSettings(settings) {
  if (!settings) return null;
  return {
    businessId: settings.business_id,
    localPart: settings.local_part,
    domain: settings.domain,
    address: professionalAddress(settings),
    displayName: settings.display_name,
    replyTo: settings.reply_to || "",
    forwardTo: settings.forward_to || "",
    inboxEnabled: Boolean(settings.inbox_enabled),
    forwardingEnabled: Boolean(settings.forwarding_enabled),
    signature: settings.signature || "",
    updatedAt: settings.updated_at
  };
}

function publicPaymentRequest(row) {
  return {
    id: row.id,
    customerName: row.customer_name,
    email: row.email || "",
    phone: row.phone || "",
    service: row.service,
    amountCents: row.amount_cents,
    currency: row.currency || "USD",
    status: row.status,
    requestType: row.request_type,
    publicUrl: row.public_url,
    notes: row.notes || "",
    invoiceSent: Boolean(row.invoice_sent),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    paidAt: row.paid_at || ""
  };
}

async function getEmailSettings(env, businessId) {
  return env.DB.prepare("SELECT * FROM business_email_settings WHERE business_id = ? LIMIT 1")
    .bind(businessId)
    .first();
}

async function ensureEmailSettings(env, business) {
  const existing = await getEmailSettings(env, business.id);
  if (existing) return existing;
  const now = nowIso();
  const localPart = emailLocalPart(business.slug || business.name);
  const domain = emailDomain(env);
  await env.DB.prepare(
    `INSERT INTO business_email_settings (
      business_id, local_part, domain, display_name, reply_to, forward_to,
      inbox_enabled, forwarding_enabled, signature, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      business.id,
      localPart,
      domain,
      business.name,
      business.email || "",
      business.email || "",
      1,
      0,
      `${business.name}\nSent through Holler & Son.`,
      now,
      now
    )
    .run();
  return getEmailSettings(env, business.id);
}

async function getEmailMessages(env, businessId) {
  const { results } = await env.DB.prepare(
    `SELECT
      id, direction, status, from_address AS fromAddress, to_address AS toAddress,
      reply_to AS replyTo, subject, text_body AS textBody, html_body AS htmlBody,
      raw_preview AS rawPreview, message_id AS messageId, in_reply_to AS inReplyTo,
      forwarded_to AS forwardedTo, provider_json AS providerJson, read, created_at AS createdAt
    FROM email_messages
    WHERE business_id = ?
    ORDER BY created_at DESC
    LIMIT 120`
  )
    .bind(businessId)
    .all();
  return (results || []).map((message) => ({
    ...message,
    provider: parseJson(message.providerJson, {}),
    read: Boolean(message.read)
  }));
}

async function sendResendEmail(env, payload) {
  if (!env.RESEND_API_KEY) {
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
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
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

function accessForSubscription(subscription) {
  const activeStatuses = new Set(["active", "trialing"]);
  const status = subscription?.status || "none";
  const endsAt = subscription?.current_period_end || "";
  const periodStillValid = !endsAt || new Date(endsAt).getTime() > Date.now();
  const isSubscribed = Boolean(subscription && activeStatuses.has(status) && periodStillValid);
  return {
    isSubscribed,
    status,
    currentPeriodEnd: endsAt,
    cancelAtPeriodEnd: Boolean(subscription?.cancel_at_period_end),
    stripeCustomerId: subscription?.stripe_customer_id || "",
    stripeSubscriptionId: subscription?.stripe_subscription_id || ""
  };
}

async function requireSubscribed(env, businessId) {
  const subscription = await getSubscription(env, businessId);
  const access = accessForSubscription(subscription);
  if (!access.isSubscribed) {
    return json(
      {
        error: "A current subscription is required for this business action.",
        access
      },
      402
    );
  }
  return null;
}

async function sendInquiryEmail(env, business, inquiry, appointment) {
  const to = env.BUSINESS_NOTIFICATION_EMAIL || business.email;
  if (!env.RESEND_API_KEY) {
    return {
      ok: false,
      mode: "local-inbox",
      to,
      detail: "RESEND_API_KEY is not configured; notification was saved to the employee inbox."
    };
  }

  const html = `
    <h1>New tattoo inquiry</h1>
    <p><strong>Studio:</strong> ${business.name}</p>
    <p><strong>Customer:</strong> ${inquiry.customerName}</p>
    <p><strong>Preferred contact:</strong> ${inquiry.contactMethod}</p>
    <p><strong>Email:</strong> ${inquiry.email || "Not provided"}</p>
    <p><strong>Phone:</strong> ${inquiry.phone || "Not provided"}</p>
    <p><strong>Requested time:</strong> ${appointment.start}</p>
    <p><strong>Service:</strong> ${inquiry.service}</p>
    <p><strong>Artist:</strong> ${inquiry.artist}</p>
    <p><strong>Message:</strong><br>${inquiry.message || ""}</p>
  `;

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: env.EMAIL_FROM || "Holler & Son <onboarding@resend.dev>",
        to: [to],
        subject: `New tattoo inquiry from ${inquiry.customerName}`,
        html
      })
    });
    const providerResponse = await response.json().catch(() => ({}));
    return { ok: response.ok, mode: "resend", to, providerStatus: response.status, providerResponse };
  } catch (error) {
    return { ok: false, mode: "resend", to, detail: error.message };
  }
}

async function sendBusinessEmail(env, business, settings, payload) {
  const to = clean(payload.to);
  const subject = clean(payload.subject);
  const message = clean(payload.message);
  if (!to || !to.includes("@")) return json({ error: "Recipient email is required." }, 400);
  if (!subject) return json({ error: "Subject is required." }, 400);
  if (!message) return json({ error: "Message is required." }, 400);

  const fromAddress = professionalAddress(settings);
  const signature = clean(settings.signature);
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
  const delivery = await sendResendEmail(env, {
    from: formatFrom(settings.display_name || business.name, fromAddress),
    to,
    replyTo: settings.reply_to || fromAddress,
    subject,
    text,
    html
  });
  const createdAt = nowIso();
  await env.DB.prepare(
    `INSERT INTO email_messages (
      id, business_id, direction, status, from_address, to_address, reply_to,
      subject, text_body, html_body, provider_json, read, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      randomId("email"),
      business.id,
      "outgoing",
      delivery.ok ? "sent" : "saved",
      fromAddress,
      to,
      settings.reply_to || fromAddress,
      subject,
      text,
      html,
      JSON.stringify(delivery),
      1,
      createdAt
    )
    .run();
  const { results: matchedCustomers } = await env.DB.prepare(
    "SELECT id FROM customers WHERE lower(email) = lower(?)"
  )
    .bind(to)
    .all();
  for (const customer of matchedCustomers || []) {
    await env.DB.prepare(
      `INSERT INTO customer_messages (
        id, customer_id, business_id, direction, status, from_name,
        subject, preview, body, read, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        randomId("custmsg"),
        customer.id,
        business.id,
        "incoming",
        delivery.ok ? "sent" : "saved",
        business.name,
        subject,
        message.slice(0, 220),
        text,
        0,
        createdAt
      )
      .run();
  }
  return json({ ok: delivery.ok, delivery, message: { to, subject, createdAt } }, delivery.ok ? 201 : 202);
}

function requestOrigin(request) {
  return new URL(request.url).origin;
}

async function sendPaymentInvoiceEmail(env, request, business, payment) {
  if (!payment.email) return json({ error: "Customer email is required before sending an invoice." }, 400);
  const settings = await ensureEmailSettings(env, business);
  const amount = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: payment.currency || "USD"
  }).format(Number(payment.amount_cents || 0) / 100);
  const invoiceUrl = payment.public_url || `${requestOrigin(request)}/pay/${payment.id}`;
  const message = [
    `Hi ${payment.customer_name},`,
    "",
    `${business.name} sent you an invoice for ${amount}.`,
    `Service: ${payment.service}`,
    payment.notes ? `Notes: ${payment.notes}` : "",
    "",
    `Open invoice: ${invoiceUrl}`,
    "",
    "You can show the invoice QR code in person or contact the studio with questions."
  ]
    .filter(Boolean)
    .join("\n");
  const response = await sendBusinessEmail(env, business, settings, {
    to: payment.email,
    subject: `${business.name} invoice for ${amount}`,
    message
  });
  const payload = await response.clone().json().catch(() => ({}));
  const now = nowIso();
  await env.DB.prepare(
    "UPDATE payment_requests SET invoice_sent = 1, status = CASE WHEN status = 'open' THEN 'sent' ELSE status END, updated_at = ? WHERE id = ? AND business_id = ?"
  )
    .bind(now, payment.id, business.id)
    .run();
  return json({ ok: response.ok, payment: publicPaymentRequest({ ...payment, invoice_sent: 1, status: payment.status === "open" ? "sent" : payment.status, updated_at: now }), delivery: payload.delivery || payload }, response.status);
}

async function streamToText(stream, limit = 180000) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let text = "";
  while (text.length < limit) {
    const { done, value } = await reader.read();
    if (done) break;
    text += decoder.decode(value, { stream: true });
  }
  text += decoder.decode();
  return text.slice(0, limit);
}

function rawBodyPreview(raw) {
  const withoutHeaders = raw.split(/\r?\n\r?\n/).slice(1).join("\n\n") || raw;
  return withoutHeaders
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/=\r?\n/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 12000);
}

async function handleIncomingEmail(message, env) {
  const toAddress = parseAddress(message.to);
  const [localPart, domain] = toAddress.split("@");
  if (!localPart || !domain) {
    message.setReject("Invalid recipient.");
    return;
  }

  const settings = await env.DB.prepare(
    "SELECT * FROM business_email_settings WHERE lower(local_part) = lower(?) AND lower(domain) = lower(?) LIMIT 1"
  )
    .bind(localPart, domain)
    .first();
  if (!settings) {
    message.setReject("Unknown Holler & Son mailbox.");
    return;
  }
  if (!settings.inbox_enabled && !settings.forwarding_enabled) {
    message.setReject("Mailbox is disabled.");
    return;
  }

  const raw = await streamToText(message.raw);
  const subject = clean(message.headers.get("subject") || "(No subject)");
  const fromAddress = parseAddress(message.from || message.headers.get("from"));
  const messageId = clean(message.headers.get("message-id"));
  const inReplyTo = clean(message.headers.get("in-reply-to"));
  const preview = rawBodyPreview(raw);
  const createdAt = nowIso();
  let delivery = { ok: false, mode: "none" };

  if (settings.forwarding_enabled && settings.forward_to) {
    delivery = await sendResendEmail(env, {
      from: formatFrom(`${settings.display_name} Mail`, professionalAddress(settings)),
      to: settings.forward_to,
      replyTo: fromAddress,
      subject: `Fwd: ${subject}`,
      text: `Forwarded from ${fromAddress} to ${toAddress}\n\n${preview || raw.slice(0, 8000)}`,
      html: `
        <div style="font-family:Inter,Arial,sans-serif;line-height:1.55;color:#171414">
          <p><strong>Forwarded from:</strong> ${escapeHtml(fromAddress)}</p>
          <p><strong>Original recipient:</strong> ${escapeHtml(toAddress)}</p>
          <hr>
          <p>${escapeHtml(preview || raw.slice(0, 8000)).replace(/\n/g, "<br>")}</p>
        </div>
      `
    });
  }

  if (settings.inbox_enabled) {
    await env.DB.prepare(
      `INSERT INTO email_messages (
        id, business_id, direction, status, from_address, to_address, reply_to,
        subject, text_body, raw_preview, message_id, in_reply_to, forwarded_to,
        provider_json, read, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        randomId("email"),
        settings.business_id,
        "incoming",
        delivery.ok ? "forwarded" : "received",
        fromAddress,
        toAddress,
        fromAddress,
        subject,
        preview,
        raw.slice(0, 24000),
        messageId,
        inReplyTo,
        settings.forwarding_enabled ? settings.forward_to || "" : "",
        JSON.stringify(delivery),
        0,
        createdAt
      )
      .run();
  }
}

function bearerToken(request) {
  const auth = request.headers.get("Authorization") || "";
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : "";
}

async function customerAuthContext(env, request) {
  const token = request.headers.get("X-Customer-Token") || "";
  if (!token) return null;
  const session = await env.DB.prepare(
    `SELECT
      s.token, s.expires_at, a.id AS account_id, a.customer_id,
      c.name, c.email, c.phone, c.preferred_contact, c.updated_at
     FROM customer_sessions s
     JOIN customer_accounts a ON a.id = s.account_id
     JOIN customers c ON c.id = a.customer_id
     WHERE s.token = ?
     LIMIT 1`
  )
    .bind(token)
    .first();
  if (!session || new Date(session.expires_at).getTime() < Date.now()) return null;
  return {
    account: { id: session.account_id, customerId: session.customer_id },
    customer: {
      id: session.customer_id,
      name: session.name,
      email: session.email,
      phone: session.phone,
      preferred_contact: session.preferred_contact,
      updated_at: session.updated_at
    }
  };
}

async function authContext(env, request) {
  const token = bearerToken(request);
  if (!token) return null;
  const session = await env.DB.prepare(
    "SELECT s.token, s.expires_at, e.id AS employee_id, e.business_id, e.name AS employee_name, e.email AS employee_email, e.role FROM sessions s JOIN employees e ON e.id = s.employee_id WHERE s.token = ? LIMIT 1"
  ).bind(token).first();
  if (!session || new Date(session.expires_at).getTime() < Date.now()) return null;
  const business = await getBusiness(env, session.business_id);
  if (!business) return null;
  return {
    business,
    employee: {
      id: session.employee_id,
      name: session.employee_name,
      email: session.employee_email,
      role: session.role
    }
  };
}

async function searchParlors(env, url) {
  const query = normalize(url.searchParams.get("query"));
  const style = normalize(url.searchParams.get("style"));
  const locationTerm = clean(url.searchParams.get("location"));
  const radius = Math.min(Math.max(Number(url.searchParams.get("radius") || 50), 1), 500);
  const origin = geocode(locationTerm);
  const fallbackLocation = normalize(locationTerm);
  const { results } = await env.DB.prepare("SELECT * FROM businesses ORDER BY featured DESC, name ASC").all();
  const rows = results || [];
  const matches = [];

  for (const row of rows) {
    const haystack = normalize([
      row.name,
      row.address,
      row.city,
      row.state,
      row.postal_code,
      row.bio,
      row.specialties_json,
      row.artists_json
    ].join(" "));
    const distance = origin ? milesBetween(origin, { lat: row.lat, lng: row.lng }) : null;
    const queryMatches = query ? haystack.includes(query) : true;
    const styleMatches = style ? haystack.includes(style) : true;
    const locationMatches = origin ? distance <= radius : fallbackLocation ? haystack.includes(fallbackLocation) : true;
    if (queryMatches && styleMatches && locationMatches) {
      matches.push({ row, distance, art: await getArt(env, row.id) });
    }
  }

  matches.sort((a, b) => {
    if (a.distance !== null && b.distance !== null) return a.distance - b.distance;
    if (Boolean(a.row.featured) !== Boolean(b.row.featured)) return a.row.featured ? -1 : 1;
    return a.row.name.localeCompare(b.row.name);
  });

  return json({
    locationKnown: Boolean(origin),
    location: origin ? origin.label : null,
    radius,
    parlors: matches.map(({ row, art, distance }) => publicBusiness(row, art, distance))
  });
}

async function createInquiry(env, body, customerAuth = null) {
  if (customerAuth) {
    body.customerName ||= customerAuth.customer.name;
    body.email ||= customerAuth.customer.email;
    body.phone ||= customerAuth.customer.phone;
    body.saveCustomer = true;
  }
  const business = await getBusiness(env, clean(body.businessId || body.parlorId));
  if (!business) return json({ error: "Tattoo parlor was not found." }, 404);

  const contactMethod = body.contactMethod === "phone" ? "phone" : "email";
  const customerName = clean(body.customerName);
  const email = clean(body.email);
  const phone = clean(body.phone);
  const service = clean(body.service);
  if (!customerName) return json({ error: "Customer name is required." }, 400);
  if (contactMethod === "email" && !email) return json({ error: "Email is required for email contact." }, 400);
  if (contactMethod === "phone" && !phone) return json({ error: "Phone number is required for phone contact." }, 400);
  if (!service) return json({ error: "Tattoo idea or service is required." }, 400);
  if (!body.preferredDate || !body.preferredTime) return json({ error: "Preferred date and time are required." }, 400);

  const createdAt = nowIso();
  let customerId = customerAuth?.customer.id || null;
  if (customerAuth) {
    await env.DB.prepare(
      "UPDATE customers SET name = ?, email = ?, phone = ?, preferred_contact = ?, updated_at = ? WHERE id = ?"
    )
      .bind(customerName, email, phone, contactMethod, createdAt, customerId)
      .run();
  } else if (body.saveCustomer) {
    const existing = await env.DB.prepare(
      "SELECT * FROM customers WHERE (email <> '' AND lower(email) = lower(?)) OR (phone <> '' AND phone = ?) LIMIT 1"
    ).bind(email, phone).first();
    if (existing) {
      customerId = existing.id;
      await env.DB.prepare(
        "UPDATE customers SET name = ?, email = ?, phone = ?, preferred_contact = ?, updated_at = ? WHERE id = ?"
      ).bind(customerName, email, phone, contactMethod, createdAt, customerId).run();
    } else {
      customerId = randomId("cust");
      await env.DB.prepare(
        "INSERT INTO customers (id, name, email, phone, preferred_contact, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
      ).bind(customerId, customerName, email, phone, contactMethod, createdAt, createdAt).run();
    }
  }

  const inquiry = {
    id: randomId("inq"),
    customerId,
    businessId: business.id,
    customerName,
    contactMethod,
    email,
    phone,
    service,
    artist: clean(body.artist || "Any available artist"),
    placement: clean(body.placement),
    budget: clean(body.budget),
    message: clean(body.message),
    consent: Boolean(body.consent),
    status: "new",
    createdAt
  };
  const appointment = {
    id: randomId("appt"),
    businessId: business.id,
    inquiryId: inquiry.id,
    customerName,
    contact: contactMethod === "phone" ? phone : email,
    contactMethod,
    service,
    artist: inquiry.artist,
    start: new Date(`${body.preferredDate}T${body.preferredTime}:00`).toISOString(),
    durationMinutes: Number(body.durationMinutes || 60),
    status: "pending",
    notes: inquiry.message,
    source: "customer",
    createdAt
  };

  await env.DB.prepare(
    "INSERT INTO inquiries (id, customer_id, business_id, customer_name, contact_method, email, phone, service, artist, placement, budget, message, consent, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
  ).bind(
    inquiry.id,
    inquiry.customerId,
    inquiry.businessId,
    inquiry.customerName,
    inquiry.contactMethod,
    inquiry.email,
    inquiry.phone,
    inquiry.service,
    inquiry.artist,
    inquiry.placement,
    inquiry.budget,
    inquiry.message,
    inquiry.consent ? 1 : 0,
    inquiry.status,
    inquiry.createdAt
  ).run();

  await env.DB.prepare(
    "INSERT INTO appointments (id, business_id, inquiry_id, customer_name, contact, contact_method, service, artist, start, duration_minutes, status, notes, source, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
  ).bind(
    appointment.id,
    appointment.businessId,
    appointment.inquiryId,
    appointment.customerName,
    appointment.contact,
    appointment.contactMethod,
    appointment.service,
    appointment.artist,
    appointment.start,
    appointment.durationMinutes,
    appointment.status,
    appointment.notes,
    appointment.source,
    appointment.createdAt
  ).run();

  const delivery = await sendInquiryEmail(env, business, inquiry, appointment);
  await env.DB.prepare(
    "INSERT INTO inbox (id, business_id, inquiry_id, appointment_id, from_name, from_contact, subject, preview, delivery_json, read, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
  ).bind(
    randomId("msg"),
    business.id,
    inquiry.id,
    appointment.id,
    customerName,
    appointment.contact,
    `New ${service} inquiry`,
    inquiry.message || `${customerName} requested ${service}.`,
    JSON.stringify(delivery),
    0,
    createdAt
  ).run();

  if (customerId) {
    await env.DB.prepare(
      "INSERT INTO customer_messages (id, customer_id, business_id, direction, status, from_name, subject, preview, body, read, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    )
      .bind(
        randomId("custmsg"),
        customerId,
        business.id,
        "outgoing",
        "sent",
        "You",
        `Appointment request sent to ${business.name}`,
        `${service} request for ${appointment.start}.`,
        `Your ${service} request was sent to ${business.name}. The studio can contact you by ${contactMethod}.`,
        0,
        createdAt
      )
      .run();
  }

  return json({ ok: true, inquiry, appointment, emailDelivery: delivery }, 201);
}

async function uploadArt(env, auth, body) {
  const subscriptionError = await requireSubscribed(env, auth.business.id);
  if (subscriptionError) return subscriptionError;

  const image = clean(body.image);
  const match = image.match(/^data:(image\/(?:png|jpeg|webp|gif|svg\+xml));base64,(.+)$/);
  if (!match) return json({ error: "Art upload must be a base64 image data URL." }, 400);
  const mime = match[1];
  const extension = mime.includes("jpeg") ? "jpg" : mime.split("/")[1].replace("svg+xml", "svg");
  const id = randomId("art");
  const key = `${auth.business.id}/${id}.${extension}`;
  const binary = Uint8Array.from(atob(match[2]), (char) => char.charCodeAt(0));
  await env.ART_BUCKET.put(key, binary, {
    httpMetadata: { contentType: mime },
    customMetadata: { businessId: auth.business.id, title: clean(body.title) }
  });
  const createdAt = nowIso();
  const art = {
    id,
    title: clean(body.title, "Untitled flash"),
    style: clean(body.style, "custom"),
    caption: clean(body.caption),
    image: `/api/art-images/${key}`,
    createdAt
  };
  await env.DB.prepare(
    "INSERT INTO art (id, business_id, title, style, caption, r2_key, image_url, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
  ).bind(id, auth.business.id, art.title, art.style, art.caption, key, art.image, createdAt).run();
  await env.DB.prepare("UPDATE businesses SET updated_at = ? WHERE id = ?").bind(createdAt, auth.business.id).run();
  return json({ ok: true, art }, 201);
}

function stripeTimestamp(seconds) {
  return seconds ? new Date(Number(seconds) * 1000).toISOString() : "";
}

function subscriptionPriceId(subscription) {
  return subscription?.items?.data?.[0]?.price?.id || "";
}

async function upsertSubscription(env, payload) {
  const now = nowIso();
  await env.DB.prepare(
    `INSERT INTO subscriptions (
      id, business_id, stripe_customer_id, stripe_subscription_id, stripe_price_id,
      status, current_period_end, cancel_at_period_end, last_event_id, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(stripe_subscription_id) DO UPDATE SET
      business_id = excluded.business_id,
      stripe_customer_id = excluded.stripe_customer_id,
      stripe_price_id = excluded.stripe_price_id,
      status = excluded.status,
      current_period_end = excluded.current_period_end,
      cancel_at_period_end = excluded.cancel_at_period_end,
      last_event_id = excluded.last_event_id,
      updated_at = excluded.updated_at`
  )
    .bind(
      payload.id || randomId("sub"),
      payload.businessId,
      payload.stripeCustomerId || "",
      payload.stripeSubscriptionId,
      payload.stripePriceId || "",
      payload.status || "incomplete",
      payload.currentPeriodEnd || "",
      payload.cancelAtPeriodEnd ? 1 : 0,
      payload.lastEventId || "",
      now,
      now
    )
    .run();
}

async function businessIdForSubscription(env, stripeSubscriptionId, stripeCustomerId = "") {
  const bySubscription = stripeSubscriptionId
    ? await env.DB.prepare("SELECT business_id FROM subscriptions WHERE stripe_subscription_id = ? LIMIT 1")
        .bind(stripeSubscriptionId)
        .first()
    : null;
  if (bySubscription?.business_id) return bySubscription.business_id;

  const byCustomer = stripeCustomerId
    ? await env.DB.prepare("SELECT business_id FROM subscriptions WHERE stripe_customer_id = ? ORDER BY updated_at DESC LIMIT 1")
        .bind(stripeCustomerId)
        .first()
    : null;
  return byCustomer?.business_id || "";
}

async function handleStripeWebhook(request, env) {
  const rawBody = await request.text();
  await verifyStripeSignature(rawBody, request.headers.get("Stripe-Signature"), env.STRIPE_WEBHOOK_SECRET);
  const event = JSON.parse(rawBody);

  const seen = await env.DB.prepare("SELECT id FROM stripe_events WHERE id = ? LIMIT 1").bind(event.id).first();
  if (seen) return json({ received: true, duplicate: true });

  const object = event.data?.object || {};
  const processedAt = nowIso();

  if (event.type === "checkout.session.completed") {
    const businessId = clean(object.client_reference_id);
    const subscriptionId = typeof object.subscription === "string" ? object.subscription : object.subscription?.id;
    if (businessId && subscriptionId) {
      const business = await getBusiness(env, businessId);
      if (business) {
        await upsertSubscription(env, {
          businessId: business.id,
          stripeCustomerId: typeof object.customer === "string" ? object.customer : object.customer?.id,
          stripeSubscriptionId: subscriptionId,
          status: object.payment_status === "paid" ? "active" : "incomplete",
          lastEventId: event.id
        });
      }
    }
  }

  if (event.type === "customer.subscription.created" || event.type === "customer.subscription.updated") {
    const businessId = await businessIdForSubscription(
      env,
      object.id,
      typeof object.customer === "string" ? object.customer : object.customer?.id
    );
    if (businessId) {
      await upsertSubscription(env, {
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
    await env.DB.prepare(
      "UPDATE subscriptions SET status = ?, current_period_end = ?, cancel_at_period_end = ?, last_event_id = ?, updated_at = ? WHERE stripe_subscription_id = ?"
    )
      .bind(
        object.status || "canceled",
        stripeTimestamp(object.current_period_end),
        object.cancel_at_period_end ? 1 : 0,
        event.id,
        processedAt,
        object.id
      )
      .run();
  }

  if (event.type === "invoice.paid" || event.type === "invoice.payment_failed") {
    const subscriptionId = typeof object.subscription === "string" ? object.subscription : object.subscription?.id;
    const status = event.type === "invoice.paid" ? "active" : "past_due";
    const periodEnd = object.lines?.data?.[0]?.period?.end;
    await env.DB.prepare(
      "UPDATE subscriptions SET status = ?, current_period_end = COALESCE(NULLIF(?, ''), current_period_end), last_event_id = ?, updated_at = ? WHERE stripe_subscription_id = ?"
    )
      .bind(status, stripeTimestamp(periodEnd), event.id, processedAt, subscriptionId || "")
      .run();
  }

  await env.DB.prepare(
    "INSERT INTO stripe_events (id, type, processed_at, payload_json) VALUES (?, ?, ?, ?)"
  )
    .bind(event.id, event.type, processedAt, rawBody)
    .run();

  return json({ received: true });
}

async function api(request, env) {
  const url = new URL(request.url);
  const method = request.method;

  if (method === "GET" && url.pathname === "/api/health") {
    return json({ ok: true, service: "hollerandson-cloudflare", time: nowIso() });
  }

  if (method === "POST" && url.pathname === "/api/stripe/webhook") {
    return handleStripeWebhook(request, env);
  }

  if (method === "GET" && url.pathname === "/api/parlors") return searchParlors(env, url);

  const parlorMatch = url.pathname.match(/^\/api\/parlors\/([^/]+)$/);
  if (method === "GET" && parlorMatch) {
    const business = await getBusiness(env, decodeURIComponent(parlorMatch[1]));
    if (!business) return json({ error: "Tattoo parlor not found." }, 404);
    return json({ business: publicBusiness(business, await getArt(env, business.id)) });
  }

  const publicPaymentMatch = url.pathname.match(/^\/api\/payments\/([^/]+)$/);
  if (method === "GET" && publicPaymentMatch) {
    const payment = await env.DB.prepare("SELECT * FROM payment_requests WHERE id = ? LIMIT 1")
      .bind(decodeURIComponent(publicPaymentMatch[1]))
      .first();
    if (!payment) return json({ error: "Payment request not found." }, 404);
    const business = await getBusiness(env, payment.business_id);
    if (!business) return json({ error: "Studio not found." }, 404);
    return json({ payment: publicPaymentRequest(payment), business: publicBusiness(business, await getArt(env, business.id)) });
  }

  if (method === "GET" && url.pathname.startsWith("/api/art-images/")) {
    const key = decodeURIComponent(url.pathname.slice("/api/art-images/".length));
    const object = await env.ART_BUCKET.get(key);
    if (!object) return new Response("Not found", { status: 404 });
    return new Response(object.body, {
      headers: {
        "Content-Type": object.httpMetadata?.contentType || "application/octet-stream",
        "Cache-Control": "public, max-age=31536000, immutable"
      }
    });
  }

  if (method === "POST" && url.pathname === "/api/business/signup") {
    const body = await request.json();
    const name = clean(body.businessName || body.name);
    const ownerName = clean(body.ownerName || "Studio owner");
    const email = clean(body.email).toLowerCase();
    const password = clean(body.password);
    const phone = clean(body.phone);
    const city = clean(body.city);
    const state = clean(body.state).toUpperCase();
    if (!name) return json({ error: "Business name is required." }, 400);
    if (!email || !email.includes("@")) return json({ error: "A valid business email is required." }, 400);
    if (password.length < 8) return json({ error: "Password must be at least 8 characters." }, 400);
    const existingEmployee = await env.DB.prepare("SELECT id FROM employees WHERE lower(email) = lower(?) LIMIT 1")
      .bind(email)
      .first();
    if (existingEmployee) return json({ error: "A business login already exists for that email." }, 409);

    const createdAt = nowIso();
    const slug = await uniqueSlug(env, name);
    const locationGuess = geocode(`${city} ${state}`) || geocode(city) || LOCATION_INDEX.nashville;
    await env.DB.prepare(
      `INSERT INTO businesses (
        id, slug, name, address, city, state, postal_code, lat, lng, phone, email, website,
        bio, hours, min_deposit, specialties_json, artists_json, socials_json, featured, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        slug,
        slug,
        name,
        clean(body.address),
        city || locationGuess.label.split(",")[0],
        state || clean(locationGuess.label.split(",")[1] || "TN"),
        clean(body.postalCode),
        Number(body.lat || locationGuess.lat),
        Number(body.lng || locationGuess.lng),
        phone,
        email,
        clean(body.website),
        clean(body.bio, "New Holler & Son studio profile. Add a bio, gallery, artists, and booking details after subscribing."),
        clean(body.hours, "By appointment"),
        Number(body.minDeposit || 0),
        JSON.stringify(list(body.specialties || body.styles)),
        JSON.stringify(list(body.artists || ownerName)),
        JSON.stringify({
          instagram: clean(body.instagram),
          facebook: clean(body.facebook),
          tiktok: clean(body.tiktok)
        }),
        0,
        createdAt,
        createdAt
      )
      .run();
    const employeeId = randomId("emp");
    await env.DB.prepare(
      "INSERT INTO employees (id, business_id, name, email, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
    )
      .bind(employeeId, slug, ownerName, email, await sha256(password), "Owner", createdAt)
      .run();
    await env.DB.prepare(
      `INSERT INTO subscriptions (
        id, business_id, stripe_customer_id, stripe_subscription_id, stripe_price_id,
        status, current_period_end, cancel_at_period_end, last_event_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(randomId("sub"), slug, "", `pending_${slug}`, "", "incomplete", "", 0, "signup", createdAt, createdAt)
      .run();
    const business = await getBusiness(env, slug);
    await ensureEmailSettings(env, business);
    const token = randomId("session");
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 12).toISOString();
    await env.DB.prepare("INSERT INTO sessions (token, employee_id, created_at, expires_at) VALUES (?, ?, ?, ?)")
      .bind(token, employeeId, createdAt, expiresAt)
      .run();
    return json(
      {
        ok: true,
        token,
        employee: { id: employeeId, name: ownerName, email, role: "Owner" },
        business: publicBusiness(business, []),
        access: accessForSubscription(await getSubscription(env, slug))
      },
      201
    );
  }

  if (method === "POST" && (url.pathname === "/api/customer/signup" || url.pathname === "/api/customer/login")) {
    const body = await request.json();
    const email = clean(body.email).toLowerCase();
    const password = clean(body.password);
    if (!email || !email.includes("@")) return json({ error: "A valid email is required." }, 400);
    if (password.length < 8) return json({ error: "Password must be at least 8 characters." }, 400);
    const passwordHash = await sha256(password);
    let account = await env.DB.prepare("SELECT * FROM customer_accounts WHERE lower(email) = lower(?) LIMIT 1")
      .bind(email)
      .first();
    let customer = null;
    const createdAt = nowIso();

    if (url.pathname === "/api/customer/signup") {
      if (account) return json({ error: "A customer account already exists for that email." }, 409);
      customer = await env.DB.prepare("SELECT * FROM customers WHERE lower(email) = lower(?) LIMIT 1").bind(email).first();
      const customerId = customer?.id || randomId("cust");
      if (customer) {
        await env.DB.prepare(
          "UPDATE customers SET name = ?, email = ?, phone = ?, preferred_contact = ?, updated_at = ? WHERE id = ?"
        )
          .bind(clean(body.name, customer.name), email, clean(body.phone, customer.phone), "email", createdAt, customer.id)
          .run();
      } else {
        await env.DB.prepare(
          "INSERT INTO customers (id, name, email, phone, preferred_contact, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
        )
          .bind(customerId, clean(body.name, "Tattoo collector"), email, clean(body.phone), "email", createdAt, createdAt)
          .run();
      }
      const accountId = randomId("custacct");
      await env.DB.prepare(
        "INSERT INTO customer_accounts (id, customer_id, email, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)"
      )
        .bind(accountId, customerId, email, passwordHash, createdAt, createdAt)
        .run();
      await env.DB.prepare(
        "INSERT INTO customer_messages (id, customer_id, business_id, direction, status, from_name, subject, preview, body, read, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
      )
        .bind(
          randomId("custmsg"),
          customerId,
          "",
          "incoming",
          "new",
          "Holler & Son",
          "Welcome to Holler & Son",
          "Your customer dashboard is ready. Search studios, save favorites, and keep booking messages in one place.",
          "Your customer dashboard is ready. Search studios, save favorites, and keep booking messages in one place.",
          0,
          createdAt
        )
        .run();
      account = { id: accountId, customer_id: customerId };
    } else {
      if (!account || account.password_hash !== passwordHash) return json({ error: "Invalid customer login." }, 401);
    }

    const customerId = account.customer_id;
    customer = await env.DB.prepare("SELECT * FROM customers WHERE id = ? LIMIT 1").bind(customerId).first();
    const token = randomId("custsession");
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 14).toISOString();
    await env.DB.prepare("DELETE FROM customer_sessions WHERE expires_at < ?").bind(nowIso()).run();
    await env.DB.prepare("INSERT INTO customer_sessions (token, account_id, created_at, expires_at) VALUES (?, ?, ?, ?)")
      .bind(token, account.id, createdAt, expiresAt)
      .run();
    return json({ token, dashboard: await customerDashboard(env, customer) });
  }

  if (method === "POST" && url.pathname === "/api/employee/login") {
    const body = await request.json();
    const email = clean(body.email).toLowerCase();
    const passwordHash = await sha256(body.password || "");
    const employee = await env.DB.prepare(
      "SELECT * FROM employees WHERE lower(email) = lower(?) AND password_hash = ? LIMIT 1"
    ).bind(email, passwordHash).first();
    if (!employee) return json({ error: "Invalid employee login." }, 401);
    const token = randomId("session");
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 12).toISOString();
    await env.DB.prepare("DELETE FROM sessions WHERE expires_at < ?").bind(nowIso()).run();
    await env.DB.prepare(
      "INSERT INTO sessions (token, employee_id, created_at, expires_at) VALUES (?, ?, ?, ?)"
    ).bind(token, employee.id, nowIso(), expiresAt).run();
    const business = await getBusiness(env, employee.business_id);
    return json({
      token,
      employee: { id: employee.id, name: employee.name, email: employee.email, role: employee.role },
      business: publicBusiness(business, await getArt(env, business.id))
    });
  }

  if (method === "POST" && url.pathname === "/api/inquiries") {
    return createInquiry(env, await request.json(), await customerAuthContext(env, request));
  }

  const customerProtected =
    url.pathname === "/api/customer/dashboard" ||
    url.pathname === "/api/customer/favorites" ||
    url.pathname.startsWith("/api/customer/favorites/") ||
    url.pathname.startsWith("/api/customer/messages/");
  const customerAuth = customerProtected ? await customerAuthContext(env, request) : null;
  if (customerProtected && !customerAuth) return json({ error: "Customer login required." }, 401);

  if (method === "GET" && url.pathname === "/api/customer/dashboard") {
    return json(await customerDashboard(env, customerAuth.customer));
  }

  if (method === "POST" && url.pathname === "/api/customer/favorites") {
    const body = await request.json();
    const business = await getBusiness(env, clean(body.businessId));
    if (!business) return json({ error: "Studio not found." }, 404);
    await env.DB.prepare(
      "INSERT OR IGNORE INTO customer_favorites (customer_id, business_id, created_at) VALUES (?, ?, ?)"
    )
      .bind(customerAuth.customer.id, business.id, nowIso())
      .run();
    return json(await customerDashboard(env, customerAuth.customer));
  }

  const customerFavoriteDelete = url.pathname.match(/^\/api\/customer\/favorites\/([^/]+)$/);
  if (method === "DELETE" && customerFavoriteDelete) {
    await env.DB.prepare("DELETE FROM customer_favorites WHERE customer_id = ? AND business_id = ?")
      .bind(customerAuth.customer.id, decodeURIComponent(customerFavoriteDelete[1]))
      .run();
    return json(await customerDashboard(env, customerAuth.customer));
  }

  const customerMessagePatch = url.pathname.match(/^\/api\/customer\/messages\/([^/]+)$/);
  if (method === "PATCH" && customerMessagePatch) {
    const body = await request.json();
    await env.DB.prepare("UPDATE customer_messages SET read = ? WHERE id = ? AND customer_id = ?")
      .bind(body.read ? 1 : 0, decodeURIComponent(customerMessagePatch[1]), customerAuth.customer.id)
      .run();
    return json(await customerDashboard(env, customerAuth.customer));
  }

  const protectedRoute =
    url.pathname.startsWith("/api/employee/") ||
    url.pathname.startsWith("/api/business/") ||
    url.pathname.startsWith("/api/inquiries/");
  const auth = protectedRoute ? await authContext(env, request) : null;
  if (protectedRoute && !auth) return json({ error: "Employee login required." }, 401);

  if (method === "GET" && url.pathname === "/api/employee/dashboard") {
    const businessId = auth.business.id;
    const [art, subscription, emailSettings] = await Promise.all([
      getArt(env, businessId),
      getSubscription(env, businessId),
      ensureEmailSettings(env, auth.business)
    ]);
    const access = accessForSubscription(subscription);
    const [inquiries, appointments, inbox, customers, emailMessages, payments] = access.isSubscribed
      ? await Promise.all([
          env.DB.prepare("SELECT *, customer_name AS customerName, contact_method AS contactMethod, employee_notes AS employeeNotes, created_at AS createdAt FROM inquiries WHERE business_id = ? ORDER BY created_at DESC").bind(businessId).all(),
          env.DB.prepare("SELECT *, customer_name AS customerName, contact_method AS contactMethod, duration_minutes AS durationMinutes, created_at AS createdAt FROM appointments WHERE business_id = ? ORDER BY start ASC").bind(businessId).all(),
          env.DB.prepare("SELECT *, from_name AS fromName, from_contact AS fromContact, created_at AS createdAt FROM inbox WHERE business_id = ? ORDER BY created_at DESC").bind(businessId).all(),
          env.DB.prepare("SELECT DISTINCT c.* FROM customers c JOIN inquiries i ON i.customer_id = c.id WHERE i.business_id = ? ORDER BY c.updated_at DESC").bind(businessId).all(),
          { results: await getEmailMessages(env, businessId) },
          env.DB.prepare("SELECT * FROM payment_requests WHERE business_id = ? ORDER BY created_at DESC").bind(businessId).all()
        ])
      : [{ results: [] }, { results: [] }, { results: [] }, { results: [] }, { results: [] }, { results: [] }];
    return json({
      employee: auth.employee,
      business: publicBusiness(auth.business, art),
      access,
      emailSettings: publicEmailSettings(emailSettings),
      emailMessages: emailMessages.results || [],
      inquiries: inquiries.results || [],
      appointments: appointments.results || [],
      inbox: (inbox.results || []).map((message) => ({ ...message, delivery: parseJson(message.delivery_json, {}) })),
      customers: customers.results || [],
      payments: (payments.results || []).map(publicPaymentRequest)
    });
  }

  if (method === "PATCH" && url.pathname === "/api/business/profile") {
    const subscriptionError = await requireSubscribed(env, auth.business.id);
    if (subscriptionError) return subscriptionError;

    const body = await request.json();
    const socials = {
      instagram: clean(body.instagram),
      facebook: clean(body.facebook),
      tiktok: clean(body.tiktok)
    };
    await env.DB.prepare(
      `UPDATE businesses SET
        name = ?, address = ?, city = ?, state = ?, postal_code = ?, lat = ?, lng = ?,
        phone = ?, email = ?, website = ?, bio = ?, hours = ?, min_deposit = ?,
        specialties_json = ?, artists_json = ?, socials_json = ?, updated_at = ?
      WHERE id = ?`
    ).bind(
      clean(body.name, auth.business.name),
      clean(body.address, auth.business.address),
      clean(body.city, auth.business.city),
      clean(body.state, auth.business.state),
      clean(body.postalCode, auth.business.postal_code),
      Number(body.lat || auth.business.lat),
      Number(body.lng || auth.business.lng),
      clean(body.phone, auth.business.phone),
      clean(body.email, auth.business.email),
      clean(body.website, auth.business.website),
      clean(body.bio, auth.business.bio),
      clean(body.hours, auth.business.hours),
      Number(body.minDeposit || auth.business.min_deposit || 0),
      JSON.stringify(list(body.specialties)),
      JSON.stringify(list(body.artists)),
      JSON.stringify(socials),
      nowIso(),
      auth.business.id
    ).run();
    const updated = await getBusiness(env, auth.business.id);
    return json({ ok: true, business: publicBusiness(updated, await getArt(env, updated.id)) });
  }

  if (method === "PATCH" && url.pathname === "/api/business/email-settings") {
    const subscriptionError = await requireSubscribed(env, auth.business.id);
    if (subscriptionError) return subscriptionError;

    const body = await request.json();
    const domain = clean(body.domain || env.BUSINESS_EMAIL_DOMAIN || emailDomain(env)).toLowerCase();
    const localPart = emailLocalPart(body.localPart || auth.business.slug || auth.business.name);
    const displayName = clean(body.displayName || auth.business.name);
    const replyTo = clean(body.replyTo || auth.business.email);
    const forwardTo = clean(body.forwardTo);
    if (!displayName) return json({ error: "Display name is required." }, 400);
    if (replyTo && !replyTo.includes("@")) return json({ error: "Reply-to must be a valid email address." }, 400);
    if (forwardTo && !forwardTo.includes("@")) return json({ error: "Forward-to must be a valid email address." }, 400);
    const now = nowIso();
    try {
      await env.DB.prepare(
        `INSERT INTO business_email_settings (
          business_id, local_part, domain, display_name, reply_to, forward_to,
          inbox_enabled, forwarding_enabled, signature, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(business_id) DO UPDATE SET
          local_part = excluded.local_part,
          domain = excluded.domain,
          display_name = excluded.display_name,
          reply_to = excluded.reply_to,
          forward_to = excluded.forward_to,
          inbox_enabled = excluded.inbox_enabled,
          forwarding_enabled = excluded.forwarding_enabled,
          signature = excluded.signature,
          updated_at = excluded.updated_at`
      )
        .bind(
          auth.business.id,
          localPart,
          domain,
          displayName,
          replyTo,
          forwardTo,
          body.inboxEnabled ? 1 : 0,
          body.forwardingEnabled ? 1 : 0,
          clean(body.signature),
          now,
          now
        )
        .run();
    } catch (error) {
      if (String(error.message || "").toLowerCase().includes("unique")) {
        return json({ error: "That professional email address is already taken." }, 409);
      }
      throw error;
    }
    const settings = await getEmailSettings(env, auth.business.id);
    return json({ ok: true, emailSettings: publicEmailSettings(settings) });
  }

  if (method === "POST" && url.pathname === "/api/business/email/send") {
    const subscriptionError = await requireSubscribed(env, auth.business.id);
    if (subscriptionError) return subscriptionError;

    const settings = await ensureEmailSettings(env, auth.business);
    return sendBusinessEmail(env, auth.business, settings, await request.json());
  }

  if (method === "POST" && url.pathname === "/api/business/payments") {
    const subscriptionError = await requireSubscribed(env, auth.business.id);
    if (subscriptionError) return subscriptionError;

    const body = await request.json();
    const amount = Number(body.amount);
    const customerName = clean(body.customerName);
    const service = clean(body.service);
    const email = clean(body.email).toLowerCase();
    if (!customerName) return json({ error: "Customer name is required." }, 400);
    if (!service) return json({ error: "Service is required." }, 400);
    if (!Number.isFinite(amount) || amount <= 0) return json({ error: "Amount must be greater than zero." }, 400);
    if (email && !email.includes("@")) return json({ error: "Customer email must be valid." }, 400);
    const id = randomId("pay");
    const now = nowIso();
    const publicUrl = `${requestOrigin(request)}/pay/${id}`;
    await env.DB.prepare(
      `INSERT INTO payment_requests (
        id, business_id, appointment_id, customer_name, email, phone, service,
        amount_cents, currency, status, request_type, public_url, notes,
        invoice_sent, created_at, updated_at, paid_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        id,
        auth.business.id,
        clean(body.appointmentId),
        customerName,
        email,
        clean(body.phone),
        service,
        Math.round(amount * 100),
        "USD",
        "open",
        body.requestType === "invoice" ? "invoice" : "in_person",
        publicUrl,
        clean(body.notes),
        0,
        now,
        now,
        ""
      )
      .run();
    let payment = await env.DB.prepare("SELECT * FROM payment_requests WHERE id = ? AND business_id = ? LIMIT 1")
      .bind(id, auth.business.id)
      .first();
    let invoiceDelivery = null;
    if (payment.request_type === "invoice" && payment.email) {
      const invoiceResponse = await sendPaymentInvoiceEmail(env, request, auth.business, payment);
      const payload = await invoiceResponse.clone().json().catch(() => ({}));
      invoiceDelivery = payload.delivery || payload;
      payment = await env.DB.prepare("SELECT * FROM payment_requests WHERE id = ? AND business_id = ? LIMIT 1")
        .bind(id, auth.business.id)
        .first();
    }
    return json({ ok: true, payment: publicPaymentRequest(payment), invoiceDelivery }, 201);
  }

  const paymentInvoice = url.pathname.match(/^\/api\/business\/payments\/([^/]+)\/send-invoice$/);
  if (method === "POST" && paymentInvoice) {
    const subscriptionError = await requireSubscribed(env, auth.business.id);
    if (subscriptionError) return subscriptionError;

    const payment = await env.DB.prepare("SELECT * FROM payment_requests WHERE id = ? AND business_id = ? LIMIT 1")
      .bind(decodeURIComponent(paymentInvoice[1]), auth.business.id)
      .first();
    if (!payment) return json({ error: "Payment request not found." }, 404);
    return sendPaymentInvoiceEmail(env, request, auth.business, payment);
  }

  const paymentPatch = url.pathname.match(/^\/api\/business\/payments\/([^/]+)$/);
  if (method === "PATCH" && paymentPatch) {
    const subscriptionError = await requireSubscribed(env, auth.business.id);
    if (subscriptionError) return subscriptionError;

    const body = await request.json();
    const status = clean(body.status || "open");
    if (!new Set(["open", "sent", "paid", "void"]).has(status)) return json({ error: "Unsupported payment status." }, 400);
    const now = nowIso();
    await env.DB.prepare(
      "UPDATE payment_requests SET status = ?, updated_at = ?, paid_at = CASE WHEN ? = 'paid' THEN ? ELSE paid_at END WHERE id = ? AND business_id = ?"
    )
      .bind(status, now, status, now, decodeURIComponent(paymentPatch[1]), auth.business.id)
      .run();
    const payment = await env.DB.prepare("SELECT * FROM payment_requests WHERE id = ? AND business_id = ? LIMIT 1")
      .bind(decodeURIComponent(paymentPatch[1]), auth.business.id)
      .first();
    if (!payment) return json({ error: "Payment request not found." }, 404);
    return json({ ok: true, payment: publicPaymentRequest(payment) });
  }

  const emailRead = url.pathname.match(/^\/api\/business\/email\/messages\/([^/]+)$/);
  if (method === "PATCH" && emailRead) {
    const subscriptionError = await requireSubscribed(env, auth.business.id);
    if (subscriptionError) return subscriptionError;

    const body = await request.json();
    await env.DB.prepare("UPDATE email_messages SET read = ? WHERE id = ? AND business_id = ?")
      .bind(body.read ? 1 : 0, decodeURIComponent(emailRead[1]), auth.business.id)
      .run();
    return json({ ok: true });
  }

  if (method === "POST" && url.pathname === "/api/business/art") return uploadArt(env, auth, await request.json());

  const artDelete = url.pathname.match(/^\/api\/business\/art\/([^/]+)$/);
  if (method === "DELETE" && artDelete) {
    const subscriptionError = await requireSubscribed(env, auth.business.id);
    if (subscriptionError) return subscriptionError;

    const art = await env.DB.prepare("SELECT * FROM art WHERE id = ? AND business_id = ? LIMIT 1").bind(decodeURIComponent(artDelete[1]), auth.business.id).first();
    if (art?.r2_key) await env.ART_BUCKET.delete(art.r2_key);
    await env.DB.prepare("DELETE FROM art WHERE id = ? AND business_id = ?").bind(decodeURIComponent(artDelete[1]), auth.business.id).run();
    return json({ ok: true });
  }

  if (method === "POST" && url.pathname === "/api/business/appointments") {
    const subscriptionError = await requireSubscribed(env, auth.business.id);
    if (subscriptionError) return subscriptionError;

    const body = await request.json();
    const appointment = {
      id: randomId("appt"),
      start: new Date(`${body.date}T${body.time}:00`).toISOString(),
      createdAt: nowIso()
    };
    await env.DB.prepare(
      "INSERT INTO appointments (id, business_id, inquiry_id, customer_name, contact, contact_method, service, artist, start, duration_minutes, status, notes, source, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ).bind(
      appointment.id,
      auth.business.id,
      null,
      clean(body.customerName),
      clean(body.contact),
      body.contactMethod === "phone" ? "phone" : "email",
      clean(body.service),
      clean(body.artist || "Any available artist"),
      appointment.start,
      Number(body.durationMinutes || 60),
      clean(body.status || "confirmed"),
      clean(body.notes),
      "employee",
      appointment.createdAt
    ).run();
    return json({ ok: true, appointment }, 201);
  }

  const inquiryPatch = url.pathname.match(/^\/api\/inquiries\/([^/]+)$/);
  if (method === "PATCH" && inquiryPatch) {
    const subscriptionError = await requireSubscribed(env, auth.business.id);
    if (subscriptionError) return subscriptionError;

    const body = await request.json();
    await env.DB.prepare("UPDATE inquiries SET status = ?, employee_notes = ? WHERE id = ? AND business_id = ?")
      .bind(clean(body.status || "new"), clean(body.notes), decodeURIComponent(inquiryPatch[1]), auth.business.id)
      .run();
    return json({ ok: true });
  }

  return json({ error: "API route not found." }, 404);
}

async function assets(request, env) {
  const response = await env.ASSETS.fetch(request);
  if (response.status !== 404 || request.method !== "GET") return response;
  const url = new URL(request.url);
  url.pathname = "/index.html";
  return env.ASSETS.fetch(new Request(url, request));
}

export default {
  async fetch(request, env) {
    try {
      const url = new URL(request.url);
      if (url.pathname.startsWith("/api/")) return api(request, env);
      return assets(request, env);
    } catch (error) {
      return json({ error: error.message || "Server error." }, 500);
    }
  },

  async email(message, env, ctx) {
    await handleIncomingEmail(message, env, ctx);
  }
};
