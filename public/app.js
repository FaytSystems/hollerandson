const state = {
  parlors: [],
  selectedBusiness: null,
  token: localStorage.getItem("hs_employee_token") || "",
  customerToken: localStorage.getItem("hs_customer_token") || "",
  dashboard: null,
  customerDashboard: null,
  calendarView: localStorage.getItem("hs_calendar_view") || "day",
  calendarDate: new Date().toISOString().slice(0, 10),
  favorites: JSON.parse(localStorage.getItem("hs_favorites") || "[]"),
  customerPrefs: JSON.parse(localStorage.getItem("hs_customer_prefs") || "{}")
};

const STRIPE_BUY_BUTTON_ID = "buy_btn_1TmRvsGJtywdCBcEmAmvEuWF";
const STRIPE_PUBLISHABLE_KEY =
  "pk_live_51TdF41GJtywdCBcEVXcvUM8SB5O6Y34OCA0nrPqvlfa5RQfmSj5TroPhVQq8heMzbJZuEhxoOwVXC7sYrpSBybdk002vxsC9AC";

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

function toast(message) {
  const toastEl = $("#toast");
  toastEl.textContent = message;
  toastEl.classList.add("is-visible");
  window.clearTimeout(toastEl._timeout);
  toastEl._timeout = window.setTimeout(() => toastEl.classList.remove("is-visible"), 4200);
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function businessLocation(business) {
  const loc = business.location || {};
  return [loc.address, loc.city, loc.state, loc.postalCode].filter(Boolean).join(", ");
}

function firstImage(business) {
  return business.art?.[0]?.image || "/assets/tattoo-studio-hero.png";
}

function compactDate(value) {
  if (!value) return "Unscheduled";
  return new Intl.DateTimeFormat("en", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));
}

function shortDate(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(new Date(value));
}

function dateKey(value) {
  const date = value instanceof Date ? value : new Date(value);
  return date.toISOString().slice(0, 10);
}

function displayTime(value) {
  return new Intl.DateTimeFormat("en", {
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));
}

function startOfWeek(date) {
  const next = new Date(date);
  const day = next.getDay();
  next.setDate(next.getDate() - day);
  next.setHours(0, 0, 0, 0);
  return next;
}

function addDaysToDate(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function hasSubscriptionAccess() {
  return Boolean(state.dashboard?.access?.isSubscribed);
}

function gatedMessage(feature) {
  return `
    <article class="mini-panel">
      <p class="eyebrow">Subscription required</p>
      <h3>${escapeHtml(feature)} unlocks after the studio plan is active.</h3>
      <p class="muted">Use the Subscription tab to complete the monthly Stripe plan. Stripe will notify the site by webhook and access will update automatically.</p>
    </article>
  `;
}

function isoDate(daysFromNow = 1) {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  return date.toISOString().slice(0, 10);
}

async function api(path, options = {}) {
  const headers = {
    ...(options.headers || {})
  };
  if (options.body && !(options.body instanceof FormData)) headers["Content-Type"] = "application/json";
  if (state.token) headers.Authorization = `Bearer ${state.token}`;
  if (state.customerToken) headers["X-Customer-Token"] = state.customerToken;
  const response = await fetch(path, { ...options, headers });
  const type = response.headers.get("Content-Type") || "";
  const payload = type.includes("application/json") ? await response.json() : await response.text();
  if (!response.ok) {
    throw new Error(payload?.error || payload || "Request failed.");
  }
  return payload;
}

function tags(items = [], limit = 4) {
  return items
    .slice(0, limit)
    .map((item) => `<span class="tag">${escapeHtml(item)}</span>`)
    .join("");
}

function favoriteIds() {
  if (state.customerDashboard) {
    return (state.customerDashboard.favorites || []).map((business) => business.id);
  }
  return state.favorites;
}

function renderParlors(payload) {
  state.parlors = payload.parlors || [];
  const list = $("#parlor-results");
  const summary = $("#result-summary");
  const locationText = payload.locationKnown ? ` within ${payload.radius} miles of ${payload.location}` : "";
  summary.textContent = `${state.parlors.length} studio${state.parlors.length === 1 ? "" : "s"}${locationText}`;

  if (!state.parlors.length) {
    list.innerHTML = `
      <article class="mini-panel">
        <h3>No studios matched that search.</h3>
        <p class="muted">Try a wider radius, a nearby city, or a broader tattoo style.</p>
      </article>
    `;
    return;
  }

  list.innerHTML = state.parlors
    .map((business) => {
      const distance = business.distanceMiles !== null ? `<span>${business.distanceMiles} mi</span>` : "";
      const favorite = favoriteIds().includes(business.id);
      return `
        <article class="parlor-card">
          <div class="parlor-media" style="background-image: url('${firstImage(business)}')"></div>
          <div class="parlor-body">
            <div>
              <div class="meta-line">
                ${business.featured ? '<span class="tag hot">Featured</span>' : ""}
                ${distance}
                <span>${escapeHtml(business.hours || "By appointment")}</span>
              </div>
              <h3>${escapeHtml(business.name)}</h3>
              <p class="meta-line">${escapeHtml(businessLocation(business))}</p>
            </div>
            <p>${escapeHtml(business.bio).slice(0, 190)}${business.bio.length > 190 ? "..." : ""}</p>
            <div class="tag-row">${tags(business.specialties, 5)}</div>
            <div class="meta-line">
              <span>${escapeHtml(business.phone)}</span>
              <span>Deposit from $${Number(business.minDeposit || 0)}</span>
            </div>
            <div class="card-actions">
              <button class="primary-action" data-book="${business.id}" type="button">Make appointment</button>
              <button class="secondary-action" data-profile="${business.id}" type="button">View page</button>
              <button class="ghost-action" data-favorite="${business.id}" type="button">${favorite ? "Saved" : "Save"}</button>
            </div>
          </div>
        </article>
      `;
    })
    .join("");
}

async function loadParlors(params = {}) {
  const query = new URLSearchParams(params);
  const payload = await api(`/api/parlors?${query.toString()}`);
  renderParlors(payload);
}

function getBusiness(id) {
  return (
    state.parlors.find((business) => business.id === id || business.slug === id) ||
    (state.customerDashboard?.favorites || []).find((business) => business.id === id || business.slug === id)
  );
}

function renderFavorites() {
  const list = $("#favorite-list");
  const favoriteBusinesses = state.customerDashboard
    ? state.customerDashboard.favorites || []
    : state.favorites.map(getBusiness).filter(Boolean);
  $("#favorite-count").textContent = String(favoriteBusinesses.length);
  if (!favoriteBusinesses.length) {
    list.innerHTML = '<p class="muted">Saved studios will appear here.</p>';
    const fullList = $("#customer-favorite-results");
    if (fullList) fullList.innerHTML = '<article class="mini-panel"><h3>No favorites yet.</h3><p class="muted">Save studios from search results and they will stay on your dashboard.</p></article>';
    return;
  }
  list.innerHTML = favoriteBusinesses
    .map(
      (business) => `
        <div class="favorite-item">
          <span>${escapeHtml(business.name)}</span>
          <button class="ghost-action" data-book="${business.id}" type="button">Book</button>
        </div>
      `
    )
    .join("");
  const fullList = $("#customer-favorite-results");
  if (fullList) {
    fullList.innerHTML = favoriteBusinesses
      .map(
        (business) => `
          <article class="parlor-card">
            <div class="parlor-media" style="background-image: url('${firstImage(business)}')"></div>
            <div class="parlor-body">
              <div>
                <h3>${escapeHtml(business.name)}</h3>
                <p class="meta-line">${escapeHtml(businessLocation(business))}</p>
              </div>
              <p>${escapeHtml(business.bio || "").slice(0, 180)}</p>
              <div class="tag-row">${tags(business.specialties || [], 5)}</div>
              <div class="card-actions">
                <button class="primary-action" data-book="${business.id}" type="button">Make appointment</button>
                <button class="secondary-action" data-profile="${business.id}" type="button">View page</button>
                <button class="ghost-action" data-favorite="${business.id}" type="button">Remove</button>
              </div>
            </div>
          </article>
        `
      )
      .join("");
  }
}

async function toggleFavorite(id) {
  if (state.customerToken) {
    const exists = favoriteIds().includes(id);
    state.customerDashboard = exists
      ? await api(`/api/customer/favorites/${encodeURIComponent(id)}`, { method: "DELETE" })
      : await api("/api/customer/favorites", {
          method: "POST",
          body: JSON.stringify({ businessId: id })
        });
    renderCustomerDashboard();
  } else if (state.favorites.includes(id)) {
    state.favorites = state.favorites.filter((favorite) => favorite !== id);
    localStorage.setItem("hs_favorites", JSON.stringify(state.favorites));
  } else {
    state.favorites = [id, ...state.favorites].slice(0, 12);
    localStorage.setItem("hs_favorites", JSON.stringify(state.favorites));
  }
  renderParlors({ parlors: state.parlors, radius: Number($("#search-radius").value || 50), locationKnown: false });
  renderFavorites();
}

function setCustomerPrefsForm() {
  $("#pref-name").value = state.customerPrefs.name || "";
  $("#pref-email").value = state.customerPrefs.email || "";
  $("#pref-phone").value = state.customerPrefs.phone || "";
  $$('input[name="pref-contact"]').forEach((input) => {
    input.checked = input.value === (state.customerPrefs.contactMethod || "email");
  });
}

function saveCustomerPrefs() {
  const prefs = {
    name: $("#pref-name").value.trim(),
    email: $("#pref-email").value.trim(),
    phone: $("#pref-phone").value.trim(),
    contactMethod: $('input[name="pref-contact"]:checked')?.value || "email"
  };
  state.customerPrefs = prefs;
  localStorage.setItem("hs_customer_prefs", JSON.stringify(prefs));
  toast("Customer info saved.");
}

function renderCustomerDashboard() {
  const shell = $("#customer-dashboard");
  if (!shell) return;
  const loginPage = $("#customer-login-page");
  if (!state.customerDashboard) {
    shell.hidden = true;
    if (loginPage) loginPage.hidden = false;
    renderFavorites();
    renderCustomerInbox();
    renderCustomerGallery();
    return;
  }
  const customer = state.customerDashboard.customer || {};
  shell.hidden = false;
  if (loginPage) loginPage.hidden = true;
  $("#customer-dashboard-title").textContent = `${customer.name || "Customer"} dashboard`;
  $("#customer-inbox-count").textContent = String(state.customerDashboard.unreadCount || 0);
  state.customerPrefs = {
    name: customer.name || "",
    email: customer.email || "",
    phone: customer.phone || "",
    contactMethod: customer.preferredContact || "email"
  };
  localStorage.setItem("hs_customer_prefs", JSON.stringify(state.customerPrefs));
  setCustomerPrefsForm();
  renderFavorites();
  renderCustomerInbox();
  renderCustomerGallery();
}

function renderCustomerInbox() {
  const list = $("#customer-message-list");
  if (!list) return;
  const messages = state.customerDashboard?.messages || [];
  if (!state.customerDashboard) {
    list.innerHTML = '<article class="mini-panel"><h3>Login to see your messages.</h3><p class="muted">Customer inbox messages appear after sign up, booking requests, and studio replies.</p></article>';
    return;
  }
  if (!messages.length) {
    list.innerHTML = '<article class="mini-panel"><h3>No messages yet.</h3><p class="muted">Booking confirmations and studio replies will appear here.</p></article>';
    return;
  }
  list.innerHTML = messages
    .map(
      (message) => `
        <article class="message-item ${message.read ? "" : "unread"}">
          <div class="meta-line">
            <span class="tag">${escapeHtml(message.status || "new")}</span>
            <span>${escapeHtml(message.fromName || "Holler & Son")}</span>
            <span>${shortDate(message.createdAt)}</span>
          </div>
          <h3>${escapeHtml(message.subject)}</h3>
          <p>${escapeHtml(message.body || message.preview || "")}</p>
          ${message.read ? "" : `<button class="ghost-action" data-customer-message-read="${message.id}" type="button">Mark read</button>`}
        </article>
      `
    )
    .join("");
}

function renderCustomerGallery() {
  const wall = $("#customer-gallery");
  if (!wall) return;
  const sourceStudios = state.customerDashboard?.favorites?.length ? state.customerDashboard.favorites : state.parlors;
  const artItems = sourceStudios.flatMap((business) =>
    (business.art || []).map((art) => ({ ...art, businessName: business.name, businessId: business.id }))
  );
  if (!artItems.length) {
    wall.innerHTML = '<article class="mini-panel"><h3>No gallery art yet.</h3><p class="muted">Save studios or search more areas to collect gallery inspiration here.</p></article>';
    return;
  }
  wall.innerHTML = artItems
    .map(
      (art) => `
        <article class="art-tile">
          <img src="${art.image}" alt="${escapeHtml(art.title)}">
          <div>
            <strong>${escapeHtml(art.title)}</strong>
            <p class="muted">${escapeHtml(art.businessName)}${art.caption ? ` - ${escapeHtml(art.caption)}` : ""}</p>
            <button class="ghost-action" data-profile="${art.businessId}" type="button">Studio page</button>
          </div>
        </article>
      `
    )
    .join("");
}

async function customerAuth(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const endpoint = form.id === "customer-signup-form" ? "/api/customer/signup" : "/api/customer/login";
  const payload = formToObject(form);
  const response = await api(endpoint, {
    method: "POST",
    body: JSON.stringify(payload)
  });
  state.customerToken = response.token;
  state.customerDashboard = response.dashboard;
  localStorage.setItem("hs_customer_token", state.customerToken);
  renderCustomerDashboard();
  renderParlors({ parlors: state.parlors, radius: Number($("#search-radius").value || 50), locationKnown: false });
  toast(endpoint.includes("signup") ? "Customer account created." : "Customer login successful.");
  $("#customer-dashboard").scrollIntoView({ behavior: "smooth", block: "start" });
}

async function loadCustomerDashboard() {
  if (!state.customerToken) return;
  state.customerDashboard = await api("/api/customer/dashboard");
  renderCustomerDashboard();
}

function activateCustomerTab(name) {
  $$(".customer-tabs .tab-button").forEach((button) => button.classList.toggle("is-active", button.dataset.customerTab === name));
  $$(".customer-tab-panel").forEach((panel) => panel.classList.toggle("is-active", panel.id === `customer-tab-${name}`));
}

function profileLinks(business) {
  const links = [];
  if (business.website) links.push(`<a class="secondary-action" href="${escapeHtml(business.website)}" target="_blank" rel="noreferrer">Website</a>`);
  if (business.socials?.instagram) links.push(`<a class="ghost-action" href="${escapeHtml(business.socials.instagram)}" target="_blank" rel="noreferrer">Instagram</a>`);
  if (business.socials?.facebook) links.push(`<a class="ghost-action" href="${escapeHtml(business.socials.facebook)}" target="_blank" rel="noreferrer">Facebook</a>`);
  if (business.socials?.tiktok) links.push(`<a class="ghost-action" href="${escapeHtml(business.socials.tiktok)}" target="_blank" rel="noreferrer">TikTok</a>`);
  return links.join("");
}

function openProfile(id) {
  const business = getBusiness(id);
  if (!business) return;
  state.selectedBusiness = business;
  $("#profile-content").innerHTML = `
    <div class="profile-hero">
      <img src="${firstImage(business)}" alt="${escapeHtml(business.name)} artwork preview">
      <div>
        <p class="eyebrow">Tattoo parlor page</p>
        <h2>${escapeHtml(business.name)}</h2>
        <p class="meta-line">${escapeHtml(businessLocation(business))}</p>
        <p>${escapeHtml(business.bio)}</p>
      </div>
      <div class="tag-row">${tags(business.specialties, 10)}</div>
      <div class="meta-line">
        <span>${escapeHtml(business.phone)}</span>
        <span>${escapeHtml(business.email)}</span>
        <span>${escapeHtml(business.hours || "By appointment")}</span>
        <span>Deposit from $${Number(business.minDeposit || 0)}</span>
      </div>
      <div class="card-actions">
        <button class="primary-action" data-book="${business.id}" type="button">Make appointment</button>
        ${profileLinks(business)}
      </div>
      <div class="art-wall">
        ${(business.art || [])
          .map(
            (art) => `
              <article class="art-tile">
                <img src="${art.image}" alt="${escapeHtml(art.title)}">
                <div>
                  <strong>${escapeHtml(art.title)}</strong>
                  <p class="muted">${escapeHtml(art.caption || art.style || "")}</p>
                </div>
              </article>
            `
          )
          .join("")}
      </div>
    </div>
  `;
  $("#profile-dialog").showModal();
}

function fillBookingPrefs(form) {
  form.customerName.value = state.customerPrefs.name || "";
  form.email.value = state.customerPrefs.email || "";
  form.phone.value = state.customerPrefs.phone || "";
  form.contactMethod.value = state.customerPrefs.contactMethod || "email";
  form.preferredDate.min = isoDate(1);
  form.preferredDate.value = isoDate(2);
  form.preferredTime.value = "14:00";
}

function openBooking(id) {
  const business = getBusiness(id) || state.selectedBusiness;
  if (!business) return;
  const form = $("#booking-form");
  state.selectedBusiness = business;
  form.reset();
  form.businessId.value = business.id;
  $("#booking-title").textContent = `Request an appointment with ${business.name}`;
  form.artist.innerHTML = ['<option value="Any available artist">Any available artist</option>']
    .concat((business.artists || []).map((artist) => `<option value="${escapeHtml(artist)}">${escapeHtml(artist)}</option>`))
    .join("");
  $("#booking-note").textContent = "";
  fillBookingPrefs(form);
  $("#booking-dialog").showModal();
}

function formToObject(form) {
  const data = new FormData(form);
  const payload = {};
  for (const [key, value] of data.entries()) {
    payload[key] = value;
  }
  $$('input[type="checkbox"]', form).forEach((input) => {
    payload[input.name] = input.checked;
  });
  return payload;
}

async function handleBookingSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const payload = formToObject(form);
  const response = await api("/api/inquiries", {
    method: "POST",
    body: JSON.stringify(payload)
  });
  state.customerPrefs = {
    name: payload.customerName,
    email: payload.email,
    phone: payload.phone,
    contactMethod: payload.contactMethod
  };
  localStorage.setItem("hs_customer_prefs", JSON.stringify(state.customerPrefs));
  setCustomerPrefsForm();
  $("#booking-note").textContent = response.emailDelivery?.ok
    ? "Request sent and email notification delivered."
    : "Request saved to the employee inbox. Email delivery needs RESEND_API_KEY in production.";
  toast("Appointment request created.");
  if (state.customerToken) await loadCustomerDashboard();
  if (state.token) await loadDashboard();
}

async function login(event) {
  event.preventDefault();
  const payload = {
    email: $("#login-email").value.trim(),
    password: $("#login-password").value
  };
  const response = await api("/api/employee/login", {
    method: "POST",
    body: JSON.stringify(payload)
  });
  state.token = response.token;
  localStorage.setItem("hs_employee_token", state.token);
  toast("Employee login successful.");
  await loadDashboard();
}

async function businessSignup(event) {
  event.preventDefault();
  const response = await api("/api/business/signup", {
    method: "POST",
    body: JSON.stringify(formToObject(event.currentTarget))
  });
  state.token = response.token;
  localStorage.setItem("hs_employee_token", state.token);
  toast("Studio created. Finish the subscription to unlock business tools.");
  await loadDashboard();
  activateTab("subscription");
  $("#dashboard").scrollIntoView({ behavior: "smooth", block: "start" });
  await loadParlors({
    query: $("#search-query").value,
    location: $("#search-location").value,
    radius: $("#search-radius").value,
    style: $("#search-style").value
  });
}

async function loadDashboard() {
  const payload = await api("/api/employee/dashboard");
  state.dashboard = payload;
  $("#login-panel").hidden = true;
  $("#business-signup").hidden = true;
  $("#dashboard").hidden = false;
  $("#dashboard-title").textContent = payload.business.name;
  $("#employee-badge").textContent = `${payload.employee.name} - ${payload.employee.role}`;
  renderDashboard();
}

function renderDashboard() {
  renderSubscriptionStatus();
  renderCalendar();
  renderInquiries();
  renderMessages();
  renderMailbox();
  fillProfileForm();
  renderDashboardArt();
  renderCustomers();
}

function renderSubscriptionStatus() {
  const access = state.dashboard?.access || {};
  const status = access.status || "none";
  const currentPeriod = access.currentPeriodEnd ? ` through ${shortDate(access.currentPeriodEnd)}` : "";
  $("#subscription-status").textContent = access.isSubscribed
    ? `Subscription active${currentPeriod}. Paid business tools are unlocked.`
    : `Subscription ${status}. Paid business tools are locked until Stripe confirms an active plan.`;

  const container = $("#stripe-buy-button-container");
  if (!container || !state.dashboard?.business) return;
  container.innerHTML = "";
  const button = document.createElement("stripe-buy-button");
  button.setAttribute("buy-button-id", STRIPE_BUY_BUTTON_ID);
  button.setAttribute("publishable-key", STRIPE_PUBLISHABLE_KEY);
  button.setAttribute("client-reference-id", state.dashboard.business.id);
  if (state.dashboard.employee?.email) {
    button.setAttribute("customer-email", state.dashboard.employee.email);
  }
  container.appendChild(button);
}

function renderCalendar() {
  $$("#employee-appointment-form input, #employee-appointment-form select, #employee-appointment-form textarea, #employee-appointment-form button").forEach((control) => {
    control.disabled = !hasSubscriptionAccess();
  });
  const dateInput = $("#calendar-date");
  if (dateInput && !dateInput.value) dateInput.value = state.calendarDate;
  $$('input[name="calendar-view"]').forEach((input) => {
    input.checked = input.value === state.calendarView;
  });
  if (!hasSubscriptionAccess()) {
    $("#calendar-list").innerHTML = gatedMessage("Calendar management");
    return;
  }
  const appointments = state.dashboard?.appointments || [];
  const list = $("#calendar-list");
  if (!appointments.length) {
    list.innerHTML = '<p class="muted">No appointments yet.</p>';
    return;
  }
  if (state.calendarView === "week") {
    renderWeekCalendar(appointments);
    return;
  }
  if (state.calendarView === "month") {
    renderMonthCalendar(appointments);
    return;
  }
  renderDayCalendar(appointments);
}

function appointmentsForDate(appointments, key) {
  return appointments
    .filter((appointment) => dateKey(appointment.start) === key)
    .sort((a, b) => String(a.start).localeCompare(String(b.start)));
}

function appointmentButton(appointment, compact = false) {
  return `
    <button class="appointment-block" data-appointment="${appointment.id}" type="button">
      <strong>${escapeHtml(compact ? appointment.customerName || appointment.customer_name : appointment.service)}</strong>
      <span>${displayTime(appointment.start)} - ${escapeHtml(compact ? appointment.service : appointment.customerName || appointment.customer_name)}</span>
    </button>
  `;
}

function renderDayCalendar(appointments) {
  const key = $("#calendar-date")?.value || state.calendarDate;
  const dayAppointments = appointmentsForDate(appointments, key);
  const hours = Array.from({ length: 15 }, (_, index) => index + 7);
  $("#calendar-list").innerHTML = `
    <div class="calendar-day-view">
      ${hours
        .map((hour) => {
          const blocks = dayAppointments.filter((appointment) => new Date(appointment.start).getHours() === hour);
          return `
            <div class="hour-row">
              <div class="hour-label">${hour > 12 ? hour - 12 : hour}:00 ${hour >= 12 ? "PM" : "AM"}</div>
              <div class="hour-blocks">
                ${blocks.length ? blocks.map((appointment) => appointmentButton(appointment)).join("") : '<span class="empty-hour">Open</span>'}
              </div>
            </div>
          `;
        })
        .join("")}
    </div>
  `;
}

function renderWeekCalendar(appointments) {
  const anchor = new Date($("#calendar-date")?.value || state.calendarDate);
  const weekStart = startOfWeek(anchor);
  const days = Array.from({ length: 7 }, (_, index) => addDaysToDate(weekStart, index));
  $("#calendar-list").innerHTML = `
    <div class="calendar-summary-grid">
      ${days
        .map((day) => {
          const key = dateKey(day);
          const blocks = appointmentsForDate(appointments, key);
          return `
            <article class="calendar-day-card">
              <div class="panel-title">
                <span>${new Intl.DateTimeFormat("en", { weekday: "short", month: "short", day: "numeric" }).format(day)}</span>
                <button class="secondary-action count-button" data-calendar-jump="${key}" type="button">${blocks.length}</button>
              </div>
              <div class="appointment-scroll">
                ${blocks.length ? blocks.map((appointment) => appointmentButton(appointment, true)).join("") : '<p class="muted">No appointments.</p>'}
              </div>
            </article>
          `;
        })
        .join("")}
    </div>
  `;
}

function renderMonthCalendar(appointments) {
  const anchor = new Date($("#calendar-date")?.value || state.calendarDate);
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const gridStart = startOfWeek(first);
  const days = Array.from({ length: 42 }, (_, index) => addDaysToDate(gridStart, index));
  $("#calendar-list").innerHTML = `
    <div class="calendar-month-title">${new Intl.DateTimeFormat("en", { month: "long", year: "numeric" }).format(anchor)}</div>
    <div class="calendar-month-grid">
      ${days
        .map((day) => {
          const key = dateKey(day);
          const blocks = appointmentsForDate(appointments, key);
          const muted = day.getMonth() === anchor.getMonth() ? "" : "muted-day";
          return `
            <article class="calendar-month-cell ${muted}">
              <div class="panel-title">
                <span>${day.getDate()}</span>
                <button class="secondary-action count-button" data-calendar-jump="${key}" type="button">${blocks.length}</button>
              </div>
              <div class="appointment-scroll compact-scroll">
                ${blocks.map((appointment) => appointmentButton(appointment, true)).join("") || '<span class="muted">Open</span>'}
              </div>
            </article>
          `;
        })
        .join("")}
    </div>
  `;
}

function openAppointmentDetail(id) {
  const appointment = (state.dashboard?.appointments || []).find((item) => item.id === id);
  if (!appointment) return;
  $("#appointment-detail").innerHTML = `
    <div class="profile-hero">
      <div>
        <p class="eyebrow">Appointment</p>
        <h2>${escapeHtml(appointment.service)}</h2>
        <p class="meta-line">${compactDate(appointment.start)} · ${Number(appointment.durationMinutes || appointment.duration_minutes || 60)} minutes</p>
      </div>
      <div class="mini-panel">
        <div class="meta-line"><span class="tag">${escapeHtml(appointment.status || "pending")}</span><span>${escapeHtml(appointment.artist || "Any artist")}</span></div>
        <h3>${escapeHtml(appointment.customerName || appointment.customer_name)}</h3>
        <p>${escapeHtml(appointment.contact || "")}</p>
        <p class="muted">${escapeHtml(appointment.notes || "No notes saved.")}</p>
      </div>
    </div>
  `;
  $("#appointment-dialog").showModal();
}

function legacyCalendarList(appointments) {
  return appointments
    .map(
      (appointment) => `
        <article class="calendar-item">
          <span class="calendar-date">${compactDate(appointment.start)}</span>
          <h3>${escapeHtml(appointment.service)}</h3>
          <div class="meta-line">
            <span>${escapeHtml(appointment.customerName || appointment.customer_name)}</span>
            <span>${escapeHtml(appointment.contact)}</span>
            <span>${escapeHtml(appointment.artist || "Any artist")}</span>
            <span>${Number(appointment.durationMinutes || appointment.duration_minutes || 60)} min</span>
            <span class="tag">${escapeHtml(appointment.status)}</span>
          </div>
          <p class="muted">${escapeHtml(appointment.notes || "")}</p>
        </article>
      `
    )
    .join("");
}

function renderInquiries() {
  if (!hasSubscriptionAccess()) {
    $("#inquiry-list").innerHTML = gatedMessage("Inquiry management");
    return;
  }
  const inquiries = state.dashboard?.inquiries || [];
  const list = $("#inquiry-list");
  if (!inquiries.length) {
    list.innerHTML = '<p class="muted">New customer requests will appear here.</p>';
    return;
  }
  list.innerHTML = inquiries
    .map(
      (inquiry) => `
        <article class="inquiry-item">
          <div class="meta-line">
            <span class="tag hot">${escapeHtml(inquiry.status || "new")}</span>
            <span>${shortDate(inquiry.createdAt || inquiry.created_at)}</span>
          </div>
          <h3>${escapeHtml(inquiry.service)}</h3>
          <p>${escapeHtml(inquiry.message || "No extra notes.")}</p>
          <div class="meta-line">
            <span>${escapeHtml(inquiry.customerName || inquiry.customer_name)}</span>
            <span>${escapeHtml(inquiry.email || inquiry.phone || "")}</span>
            <span>${escapeHtml(inquiry.artist || "Any artist")}</span>
          </div>
          <div class="card-actions">
            <button class="secondary-action" data-inquiry-status="${inquiry.id}:confirmed" type="button">Confirm</button>
            <button class="ghost-action" data-inquiry-status="${inquiry.id}:declined" type="button">Decline</button>
          </div>
        </article>
      `
    )
    .join("");
}

function renderMessages() {
  if (!hasSubscriptionAccess()) {
    $("#message-list").innerHTML = gatedMessage("Email notification history");
    return;
  }
  const messages = state.dashboard?.inbox || [];
  const list = $("#message-list");
  if (!messages.length) {
    list.innerHTML = '<p class="muted">Email notification attempts will appear here.</p>';
    return;
  }
  list.innerHTML = messages
    .map((message) => {
      const delivery = message.delivery || {};
      const mode = delivery.mode || "local-inbox";
      const status = delivery.ok ? "sent" : mode;
      return `
        <article class="message-item">
          <div class="meta-line">
            <span class="tag">${escapeHtml(status)}</span>
            <span>${shortDate(message.createdAt || message.created_at)}</span>
          </div>
          <h3>${escapeHtml(message.subject)}</h3>
          <p>${escapeHtml(message.preview)}</p>
          <p class="muted">${escapeHtml(delivery.detail || `To: ${delivery.to || "studio inbox"}`)}</p>
        </article>
      `;
    })
    .join("");
}

function renderMailbox() {
  fillEmailSettingsForm();
  renderMailboxMessages();
}

function fillEmailSettingsForm() {
  const form = $("#email-settings-form");
  const settings = state.dashboard?.emailSettings || {};
  if (!form) return;
  form.localPart.value = settings.localPart || "";
  form.domain.value = settings.domain || "hollerandson.com";
  form.displayName.value = settings.displayName || state.dashboard?.business?.name || "";
  form.replyTo.value = settings.replyTo || state.dashboard?.business?.email || "";
  form.forwardTo.value = settings.forwardTo || "";
  form.inboxEnabled.checked = settings.inboxEnabled !== false;
  form.forwardingEnabled.checked = Boolean(settings.forwardingEnabled);
  form.signature.value = settings.signature || "";
  $("#professional-email-preview").textContent = settings.address || `${form.localPart.value || "studio"}@${form.domain.value || "hollerandson.com"}`;
  $$("#email-settings-form input, #email-settings-form textarea, #email-settings-form button, #compose-email-form input, #compose-email-form textarea, #compose-email-form button").forEach((control) => {
    control.disabled = !hasSubscriptionAccess();
  });
}

function renderMailboxMessages() {
  const list = $("#mailbox-list");
  if (!hasSubscriptionAccess()) {
    list.innerHTML = gatedMessage("Professional mailbox");
    return;
  }
  const messages = state.dashboard?.emailMessages || [];
  if (!messages.length) {
    list.innerHTML = '<p class="muted">Incoming and sent customer emails will appear here.</p>';
    return;
  }
  list.innerHTML = messages
    .map((message) => {
      const direction = message.direction === "incoming" ? "Incoming" : "Sent";
      const body = message.textBody || message.rawPreview || "";
      const contactLine =
        message.direction === "incoming"
          ? `From ${message.fromAddress} to ${message.toAddress}`
          : `To ${message.toAddress} from ${message.fromAddress}`;
      return `
        <article class="mailbox-item ${message.read ? "" : "unread"}">
          <div class="meta-line">
            <span class="tag">${escapeHtml(direction)}</span>
            <span>${escapeHtml(message.status || "stored")}</span>
            <span>${shortDate(message.createdAt)}</span>
            ${message.forwardedTo ? `<span>Forwarded to ${escapeHtml(message.forwardedTo)}</span>` : ""}
          </div>
          <h3>${escapeHtml(message.subject || "(No subject)")}</h3>
          <p class="meta-line">${escapeHtml(contactLine)}</p>
          <p class="mailbox-body">${escapeHtml(body).slice(0, 900)}</p>
          ${
            message.direction === "incoming" && !message.read
              ? `<button class="ghost-action" data-email-read="${message.id}" type="button">Mark read</button>`
              : ""
          }
        </article>
      `;
    })
    .join("");
}

async function saveEmailSettings(event) {
  event.preventDefault();
  if (!hasSubscriptionAccess()) return toast("Activate the studio subscription before editing mailbox settings.");
  const response = await api("/api/business/email-settings", {
    method: "PATCH",
    body: JSON.stringify(formToObject(event.currentTarget))
  });
  state.dashboard.emailSettings = response.emailSettings;
  fillEmailSettingsForm();
  toast(`Mailbox saved: ${response.emailSettings.address}`);
}

async function sendCustomerEmail(event) {
  event.preventDefault();
  if (!hasSubscriptionAccess()) return toast("Activate the studio subscription before sending customer email.");
  const response = await api("/api/business/email/send", {
    method: "POST",
    body: JSON.stringify(formToObject(event.currentTarget))
  });
  event.currentTarget.reset();
  toast(response.ok ? "Email sent." : "Email saved locally. Configure Resend to deliver it.");
  await loadDashboard();
  activateTab("mailbox");
}

async function markEmailRead(id) {
  await api(`/api/business/email/messages/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify({ read: true })
  });
  await loadDashboard();
  activateTab("mailbox");
}

function fillProfileForm() {
  const business = state.dashboard?.business;
  if (!business) return;
  const form = $("#profile-form");
  form.name.value = business.name || "";
  form.phone.value = business.phone || "";
  form.email.value = business.email || "";
  form.website.value = business.website || "";
  form.address.value = business.location?.address || "";
  form.city.value = business.location?.city || "";
  form.state.value = business.location?.state || "";
  form.postalCode.value = business.location?.postalCode || "";
  form.lat.value = business.location?.lat || "";
  form.lng.value = business.location?.lng || "";
  form.hours.value = business.hours || "";
  form.minDeposit.value = business.minDeposit || 0;
  form.instagram.value = business.socials?.instagram || "";
  form.facebook.value = business.socials?.facebook || "";
  form.tiktok.value = business.socials?.tiktok || "";
  form.specialties.value = (business.specialties || []).join(", ");
  form.artists.value = (business.artists || []).join(", ");
  form.bio.value = business.bio || "";
  $$("#profile-form input, #profile-form textarea, #profile-form button").forEach((control) => {
    control.disabled = !hasSubscriptionAccess();
  });
}

async function saveProfile(event) {
  event.preventDefault();
  if (!hasSubscriptionAccess()) return toast("Activate the studio subscription before editing the public page.");
  const payload = formToObject(event.currentTarget);
  const response = await api("/api/business/profile", {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
  state.dashboard.business = response.business;
  toast("Business page saved.");
  await loadParlors({
    query: $("#search-query").value,
    location: $("#search-location").value,
    radius: $("#search-radius").value,
    style: $("#search-style").value
  });
}

function renderDashboardArt() {
  $$("#art-form input, #art-form textarea, #art-form button").forEach((control) => {
    control.disabled = !hasSubscriptionAccess();
  });
  if (!hasSubscriptionAccess()) {
    $("#dashboard-art").innerHTML = gatedMessage("Art uploads");
    return;
  }
  const art = state.dashboard?.business?.art || [];
  const wall = $("#dashboard-art");
  if (!art.length) {
    wall.innerHTML = '<p class="muted">Upload art to start building the studio wall.</p>';
    return;
  }
  wall.innerHTML = art
    .map(
      (item) => `
        <article class="art-tile">
          <img src="${item.image}" alt="${escapeHtml(item.title)}">
          <div>
            <strong>${escapeHtml(item.title)}</strong>
            <p class="muted">${escapeHtml(item.caption || item.style || "")}</p>
            <button class="ghost-action" data-delete-art="${item.id}" type="button">Remove</button>
          </div>
        </article>
      `
    )
    .join("");
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function uploadArt(event) {
  event.preventDefault();
  if (!hasSubscriptionAccess()) return toast("Activate the studio subscription before uploading art.");
  const form = event.currentTarget;
  const file = form.image.files[0];
  if (!file) return;
  const image = await fileToDataUrl(file);
  const payload = {
    title: form.title.value.trim(),
    style: form.style.value.trim(),
    caption: form.caption.value.trim(),
    image
  };
  await api("/api/business/art", {
    method: "POST",
    body: JSON.stringify(payload)
  });
  form.reset();
  toast("Art uploaded.");
  await loadDashboard();
  await loadParlors({
    query: $("#search-query").value,
    location: $("#search-location").value,
    radius: $("#search-radius").value,
    style: $("#search-style").value
  });
}

function renderCustomers() {
  if (!hasSubscriptionAccess()) {
    $("#customer-table").innerHTML = '<tr><td colspan="5">Subscription required to view saved customers.</td></tr>';
    return;
  }
  const rows = state.dashboard?.customers || [];
  const body = $("#customer-table");
  if (!rows.length) {
    body.innerHTML = '<tr><td colspan="5">No saved customers yet.</td></tr>';
    return;
  }
  body.innerHTML = rows
    .map(
      (customer) => `
        <tr>
          <td>${escapeHtml(customer.name)}</td>
          <td>${escapeHtml(customer.email || "")}</td>
          <td>${escapeHtml(customer.phone || "")}</td>
          <td>${escapeHtml(customer.preferredContact || customer.preferred_contact || "email")}</td>
          <td>${shortDate(customer.updatedAt || customer.updated_at)}</td>
        </tr>
      `
    )
    .join("");
}

async function addEmployeeAppointment(event) {
  event.preventDefault();
  if (!hasSubscriptionAccess()) return toast("Activate the studio subscription before adding appointments.");
  const payload = formToObject(event.currentTarget);
  await api("/api/business/appointments", {
    method: "POST",
    body: JSON.stringify(payload)
  });
  event.currentTarget.reset();
  toast("Appointment added.");
  await loadDashboard();
}

async function updateInquiryStatus(value) {
  if (!hasSubscriptionAccess()) return toast("Activate the studio subscription before updating inquiries.");
  const [id, status] = value.split(":");
  await api(`/api/inquiries/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify({ status })
  });
  toast(`Inquiry marked ${status}.`);
  await loadDashboard();
}

async function deleteArt(id) {
  if (!hasSubscriptionAccess()) return toast("Activate the studio subscription before removing art.");
  await api(`/api/business/art/${encodeURIComponent(id)}`, { method: "DELETE" });
  toast("Art removed.");
  await loadDashboard();
}

function activateTab(name) {
  $$(".tab-button").forEach((button) => button.classList.toggle("is-active", button.dataset.tab === name));
  $$(".tab-panel").forEach((panel) => panel.classList.toggle("is-active", panel.id === `tab-${name}`));
}

function bindEvents() {
  $("#search-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    await loadParlors({
      query: $("#search-query").value,
      location: $("#search-location").value,
      radius: $("#search-radius").value,
      style: $("#search-style").value
    });
    renderFavorites();
  });

  $("#customer-pref-form").addEventListener("submit", (event) => {
    event.preventDefault();
    saveCustomerPrefs();
  });

  $("#clear-customer").addEventListener("click", () => {
    state.customerPrefs = {};
    localStorage.removeItem("hs_customer_prefs");
    setCustomerPrefsForm();
    toast("Customer info cleared.");
  });

  document.addEventListener("click", async (event) => {
    const closeId = event.target.closest("[data-close-dialog]")?.dataset.closeDialog;
    if (closeId) $((`#${closeId}`))?.close();

    const profileId = event.target.closest("[data-profile]")?.dataset.profile;
    if (profileId) openProfile(profileId);

    const bookId = event.target.closest("[data-book]")?.dataset.book;
    if (bookId) openBooking(bookId);

    const favoriteId = event.target.closest("[data-favorite]")?.dataset.favorite;
    if (favoriteId) await toggleFavorite(favoriteId);

    const statusValue = event.target.closest("[data-inquiry-status]")?.dataset.inquiryStatus;
    if (statusValue) await updateInquiryStatus(statusValue);

    const artId = event.target.closest("[data-delete-art]")?.dataset.deleteArt;
    if (artId) await deleteArt(artId);

    const emailReadId = event.target.closest("[data-email-read]")?.dataset.emailRead;
    if (emailReadId) await markEmailRead(emailReadId);

    const appointmentId = event.target.closest("[data-appointment]")?.dataset.appointment;
    if (appointmentId) openAppointmentDetail(appointmentId);

    const jumpDate = event.target.closest("[data-calendar-jump]")?.dataset.calendarJump;
    if (jumpDate) {
      state.calendarDate = jumpDate;
      $("#calendar-date").value = jumpDate;
      state.calendarView = "day";
      localStorage.setItem("hs_calendar_view", state.calendarView);
      renderCalendar();
    }

    const customerMessageId = event.target.closest("[data-customer-message-read]")?.dataset.customerMessageRead;
    if (customerMessageId) {
      state.customerDashboard = await api(`/api/customer/messages/${encodeURIComponent(customerMessageId)}`, {
        method: "PATCH",
        body: JSON.stringify({ read: true })
      });
      renderCustomerDashboard();
    }
  });

  $("#booking-form").addEventListener("submit", handleBookingSubmit);
  $("#customer-login-form").addEventListener("submit", customerAuth);
  $("#customer-signup-form").addEventListener("submit", customerAuth);
  $("#login-form").addEventListener("submit", login);
  $("#business-signup-form").addEventListener("submit", businessSignup);
  $("#email-settings-form").addEventListener("submit", saveEmailSettings);
  $("#compose-email-form").addEventListener("submit", sendCustomerEmail);
  $("#refresh-mailbox").addEventListener("click", async () => {
    await loadDashboard();
    activateTab("mailbox");
  });
  ["localPart", "domain"].forEach((name) => {
    $(`#email-settings-form [name="${name}"]`).addEventListener("input", () => {
      const form = $("#email-settings-form");
      $("#professional-email-preview").textContent = `${form.localPart.value || "studio"}@${form.domain.value || "hollerandson.com"}`;
    });
  });
  $("#profile-form").addEventListener("submit", saveProfile);
  $("#art-form").addEventListener("submit", uploadArt);
  $("#employee-appointment-form").addEventListener("submit", addEmployeeAppointment);
  $("#refresh-dashboard").addEventListener("click", loadDashboard);
  $("#calendar-date").value = state.calendarDate;
  $("#calendar-date").addEventListener("change", (event) => {
    state.calendarDate = event.target.value || new Date().toISOString().slice(0, 10);
    renderCalendar();
  });
  $$('input[name="calendar-view"]').forEach((input) => {
    input.checked = input.value === state.calendarView;
    input.addEventListener("change", () => {
      state.calendarView = input.value;
      localStorage.setItem("hs_calendar_view", state.calendarView);
      renderCalendar();
    });
  });
  $("#logout-button").addEventListener("click", () => {
    state.token = "";
    state.dashboard = null;
    localStorage.removeItem("hs_employee_token");
    $("#login-panel").hidden = false;
    $("#business-signup").hidden = false;
    $("#dashboard").hidden = true;
    toast("Logged out.");
  });
  $("#customer-logout-button").addEventListener("click", () => {
    state.customerToken = "";
    state.customerDashboard = null;
    localStorage.removeItem("hs_customer_token");
    renderCustomerDashboard();
    renderParlors({ parlors: state.parlors, radius: Number($("#search-radius").value || 50), locationKnown: false });
    toast("Customer logged out.");
  });

  $$("[data-tab]").forEach((button) => {
    button.addEventListener("click", () => activateTab(button.dataset.tab));
  });
  $$("[data-customer-tab]").forEach((button) => {
    button.addEventListener("click", () => activateCustomerTab(button.dataset.customerTab));
  });
}

async function init() {
  bindEvents();
  setCustomerPrefsForm();
  await loadParlors({ location: "Nashville", radius: 100 });
  if (state.customerToken) {
    try {
      await loadCustomerDashboard();
    } catch {
      state.customerToken = "";
      localStorage.removeItem("hs_customer_token");
    }
  } else {
    renderCustomerDashboard();
  }
  renderFavorites();
  renderCustomerGallery();
  if (state.token) {
    try {
      await loadDashboard();
    } catch {
      state.token = "";
      localStorage.removeItem("hs_employee_token");
    }
  }
}

init().catch((error) => {
  console.error(error);
  toast(error.message || "Something went wrong.");
});
