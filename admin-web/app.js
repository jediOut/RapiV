const DEFAULT_API_BASE_URL = "http://localhost:3000/api";
const STORAGE_KEY = "rapiv-admin-session";

const state = {
  apiBaseUrl: localStorage.getItem("rapiv-admin-api") || DEFAULT_API_BASE_URL,
  accessToken: null,
  user: null
};

const elements = {
  loginForm: document.querySelector("#loginForm"),
  activeSession: document.querySelector("#activeSession"),
  apiBaseUrl: document.querySelector("#apiBaseUrl"),
  email: document.querySelector("#email"),
  password: document.querySelector("#password"),
  sessionUser: document.querySelector("#sessionUser"),
  logoutButton: document.querySelector("#logoutButton"),
  dashboard: document.querySelector("#dashboard"),
  message: document.querySelector("#message"),
  refreshButton: document.querySelector("#refreshButton"),
  lastUpdated: document.querySelector("#lastUpdated"),
  totalDue: document.querySelector("#totalDue"),
  blockedCouriers: document.querySelector("#blockedCouriers"),
  businessDue: document.querySelector("#businessDue"),
  overdueCount: document.querySelector("#overdueCount"),
  courierRows: document.querySelector("#courierRows"),
  businessRows: document.querySelector("#businessRows"),
  courierCount: document.querySelector("#courierCount"),
  businessCount: document.querySelector("#businessCount"),
  dailyRunForm: document.querySelector("#dailyRunForm"),
  weeklyRunForm: document.querySelector("#weeklyRunForm"),
  dailyDate: document.querySelector("#dailyDate"),
  weeklyDate: document.querySelector("#weeklyDate")
};

init();

function init() {
  elements.apiBaseUrl.value = state.apiBaseUrl;
  elements.dailyDate.value = today();
  elements.weeklyDate.value = today();

  const savedSession = readSession();
  if (savedSession) {
    state.accessToken = savedSession.accessToken;
    state.user = savedSession.user;
    showAuthenticated();
    void refreshDashboard();
  }

  elements.loginForm.addEventListener("submit", handleLogin);
  elements.logoutButton.addEventListener("click", logout);
  elements.refreshButton.addEventListener("click", () => void refreshDashboard());
  elements.dailyRunForm.addEventListener("submit", handleDailyRun);
  elements.weeklyRunForm.addEventListener("submit", handleWeeklyRun);
  elements.courierRows.addEventListener("click", handleConfirmClick);
  elements.businessRows.addEventListener("click", handleConfirmClick);
}

async function handleLogin(event) {
  event.preventDefault();
  setBusy(elements.loginForm.querySelector("button"), true);

  try {
    state.apiBaseUrl = normalizeApiBaseUrl(elements.apiBaseUrl.value);
    localStorage.setItem("rapiv-admin-api", state.apiBaseUrl);

    const session = await request("/auth/login", {
      method: "POST",
      body: {
        email: elements.email.value,
        password: elements.password.value
      },
      skipAuth: true
    });

    if (!session.user?.roles?.includes("ADMIN")) {
      throw new Error("Este usuario no tiene rol ADMIN.");
    }

    state.accessToken = session.accessToken;
    state.user = session.user;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    elements.password.value = "";
    showAuthenticated();
    await refreshDashboard();
    showMessage("Sesion iniciada.");
  } catch (error) {
    showMessage(error.message, true);
  } finally {
    setBusy(elements.loginForm.querySelector("button"), false);
  }
}

async function handleDailyRun(event) {
  event.preventDefault();
  const date = elements.dailyDate.value;
  await runAction(`/cash-settlements/daily-run?date=${encodeURIComponent(date)}`, "Corte diario generado.");
}

async function handleWeeklyRun(event) {
  event.preventDefault();
  const week = elements.weeklyDate.value;
  await runAction(
    `/business-commission-settlements/weekly-run?week=${encodeURIComponent(week)}`,
    "Corte semanal generado."
  );
}

async function handleConfirmClick(event) {
  const button = event.target.closest("[data-confirm-type]");
  if (!button) {
    return;
  }

  const type = button.dataset.confirmType;
  const id = button.dataset.settlementId;
  const path = type === "courier"
    ? `/cash-settlements/${id}/confirm`
    : `/business-commission-settlements/${id}/confirm`;

  setBusy(button, true);
  try {
    await request(path, { method: "PATCH" });
    await refreshDashboard();
    showMessage("Liquidacion marcada como recibida.");
  } catch (error) {
    showMessage(error.message, true);
  } finally {
    setBusy(button, false);
  }
}

async function runAction(path, successMessage) {
  try {
    await request(path, { method: "POST" });
    await refreshDashboard();
    showMessage(successMessage);
  } catch (error) {
    showMessage(error.message, true);
  }
}

async function refreshDashboard() {
  const overview = await request("/admin/settlements/overview");
  renderOverview(overview);
}

function renderOverview(overview) {
  const totals = overview.totals;
  elements.totalDue.textContent = money(totals.totalDueToRapivCents);
  elements.blockedCouriers.textContent = String(totals.blockedCouriers);
  elements.businessDue.textContent = money(totals.businessCommissionDueCents);
  elements.overdueCount.textContent = String(
    totals.overdueCourierSettlements + totals.overdueBusinessSettlements
  );
  elements.lastUpdated.textContent = `Actualizado ${dateTime(overview.generatedAt)}`;

  elements.courierCount.textContent = `${totals.pendingCourierSettlements} pendientes`;
  elements.businessCount.textContent = `${totals.pendingBusinessSettlements} pendientes`;
  elements.courierRows.innerHTML = renderCourierRows(overview.courierCashSettlements);
  elements.businessRows.innerHTML = renderBusinessRows(overview.businessCommissionSettlements);
}

function renderCourierRows(rows) {
  if (!rows.length) {
    return `<tr><td colspan="6" class="empty-row">No hay repartidores con efectivo pendiente.</td></tr>`;
  }

  return rows.map((row) => `
    <tr>
      <td>
        <strong>${escapeHtml(row.courier?.name || "Repartidor")}</strong>
        <span class="subtext">${escapeHtml(row.courier?.email || row.courierId)}</span>
      </td>
      <td>
        ${escapeHtml(row.settlementDate)}
        <span class="subtext">${dateTime(row.periodEndAt)}</span>
      </td>
      <td>${row.orderGroupCount}</td>
      <td class="money">${money(row.netDueToRapivCents)}</td>
      <td>${statusLabel(row.isOverdue)}</td>
      <td>
        <button type="button" data-confirm-type="courier" data-settlement-id="${escapeHtml(row.id)}">
          Confirmar
        </button>
      </td>
    </tr>
  `).join("");
}

function renderBusinessRows(rows) {
  if (!rows.length) {
    return `<tr><td colspan="6" class="empty-row">No hay negocios con comision pendiente.</td></tr>`;
  }

  return rows.map((row) => `
    <tr>
      <td>
        <strong>${escapeHtml(row.business?.name || "Negocio")}</strong>
        <span class="subtext">${escapeHtml(row.owner?.email || row.businessId)}</span>
      </td>
      <td>
        ${escapeHtml(row.settlementWeek)}
        <span class="subtext">${dateTime(row.periodEndAt)}</span>
      </td>
      <td>${row.orderCount}</td>
      <td class="money">${money(row.rapivCommissionCents)}</td>
      <td>${statusLabel(row.isOverdue)}</td>
      <td>
        <button type="button" data-confirm-type="business" data-settlement-id="${escapeHtml(row.id)}">
          Confirmar
        </button>
      </td>
    </tr>
  `).join("");
}

async function request(path, options = {}) {
  const headers = {
    "Content-Type": "application/json"
  };

  if (!options.skipAuth && state.accessToken) {
    headers.Authorization = `Bearer ${state.accessToken}`;
  }

  const response = await fetch(`${state.apiBaseUrl}${path}`, {
    method: options.method || "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new Error(payload?.message || `Error HTTP ${response.status}`);
  }

  return payload;
}

function showAuthenticated() {
  elements.loginForm.classList.add("hidden");
  elements.activeSession.classList.remove("hidden");
  elements.dashboard.classList.remove("hidden");
  elements.sessionUser.textContent = state.user?.email || "Admin";
}

function logout() {
  localStorage.removeItem(STORAGE_KEY);
  state.accessToken = null;
  state.user = null;
  elements.loginForm.classList.remove("hidden");
  elements.activeSession.classList.add("hidden");
  elements.dashboard.classList.add("hidden");
  showMessage("Sesion cerrada.");
}

function readSession() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

function normalizeApiBaseUrl(value) {
  return (value || DEFAULT_API_BASE_URL).trim().replace(/\/+$/, "");
}

function showMessage(text, isError = false) {
  elements.message.textContent = text;
  elements.message.classList.toggle("error", isError);
  elements.message.classList.remove("hidden");
}

function setBusy(button, busy) {
  if (!button) {
    return;
  }

  button.disabled = busy;
}

function statusLabel(isOverdue) {
  return `<span class="status ${isOverdue ? "overdue" : ""}">${isOverdue ? "Vencido" : "Pendiente"}</span>`;
}

function money(cents) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN"
  }).format(Number(cents || 0) / 100);
}

function dateTime(value) {
  if (!value) {
    return "";
  }

  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
