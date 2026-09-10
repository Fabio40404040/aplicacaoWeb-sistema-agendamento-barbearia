import { isoDate, panelState, saveState } from "./panel-state.js";

const money = (value) =>
  Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dateFromIso = (value) => new Date(`${value}T12:00:00`);
const fullDate = (value) =>
  dateFromIso(value).toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  });
const shortDate = (value) =>
  dateFromIso(value)
    .toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })
    .replace(".", "");
let appointmentPendingRemoval = null;

function cloneTemplate(id) {
  return document.querySelector(id).content.firstElementChild.cloneNode(true);
}

function setField(element, field, value) {
  element.querySelector(`[data-field="${field}"]`).textContent = value;
}

function showToast(message) {
  const toast = document.querySelector("#toast");
  toast.textContent = `✓  ${message}`;
  toast.classList.add("show");
  window.setTimeout(() => toast.classList.remove("show"), 2600);
}

function removeAppointment(appointment) {
  appointmentPendingRemoval = appointment;
  document.querySelector("#absence-client").textContent = appointment.client;
  document.querySelector("#absence-details").textContent =
    `${fullDate(appointment.date)}, às ${appointment.time}.`;
  document.querySelector("#absence-dialog").showModal();
}

function confirmAppointmentRemoval() {
  if (!appointmentPendingRemoval) return;
  panelState.appointments = panelState.appointments.filter(
    (item) => item.id !== appointmentPendingRemoval.id,
  );
  saveState("appointments");
  document.querySelector("#absence-dialog").close();
  appointmentPendingRemoval = null;
  renderOverview();
  renderSchedule();
  showToast("Ausência registrada. O horário está disponível novamente.");
}

function renderAppointments(container, appointments) {
  container.replaceChildren();
  [...appointments]
    .sort((a, b) => a.time.localeCompare(b.time))
    .forEach((appointment) => {
      const row = cloneTemplate("#appointment-template");
      row.querySelector("time").textContent = appointment.time;
      row.querySelector(".client-avatar").textContent = appointment.client
        .split(" ")
        .map((name) => name[0])
        .slice(0, 2)
        .join("");
      row.querySelector("strong").textContent = appointment.client;
      row.querySelector("small").textContent =
        `${appointment.service} · ${appointment.duration} min`;
      const status = row.querySelector(".status");
      status.classList.add(appointment.status);
      status.textContent =
        appointment.status === "confirmed" ? "Confirmado" : "Pendente";
      const remove = row.querySelector(".appointment-remove");
      remove.title = `Remover o agendamento de ${appointment.client}`;
      remove.setAttribute(
        "aria-label",
        `Marcar ${appointment.client} como não compareceu e remover o agendamento`,
      );
      remove.addEventListener("click", () => removeAppointment(appointment));
      container.append(row);
    });
  if (!appointments.length) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "Nenhum atendimento para esta data.";
    container.append(empty);
  }
}

function renderOverview() {
  const appointments = panelState.appointments.filter(
    (item) => item.date === isoDate(),
  );
  const revenue = appointments.reduce(
    (sum, item) =>
      sum +
      (panelState.services.find((service) => service.name === item.service)
        ?.price || 0),
    0,
  );
  const next =
    appointments.find(
      (item) =>
        item.time >=
        new Date().toLocaleTimeString("pt-BR", {
          hour: "2-digit",
          minute: "2-digit",
        }),
    ) || appointments[0];
  document.querySelector("#today-count").textContent = String(
    appointments.length,
  ).padStart(2, "0");
  document.querySelector("#confirmed-count").textContent =
    `${appointments.filter((item) => item.status === "confirmed").length} confirmados`;
  document.querySelector("#next-time").textContent = next?.time || "—";
  document.querySelector("#next-client").textContent =
    next?.client || "Agenda livre";
  document.querySelector("#today-revenue").textContent = money(revenue);
  renderAppointments(
    document.querySelector("#overview-appointments"),
    appointments.slice(0, 4),
  );
}

function renderServices() {
  const body = document.querySelector("#services-body");
  body.replaceChildren();
  panelState.services.forEach((service) => {
    const row = cloneTemplate("#service-template");
    setField(row, "name", service.name);
    setField(row, "category", service.category);
    setField(row, "duration", `${service.duration} min`);
    setField(row, "price", money(service.price));
    const toggle = row.querySelector(".toggle-status");
    toggle.classList.toggle("on", service.active);
    toggle.querySelector("b").textContent = service.active
      ? "Ativo"
      : "Inativo";
    toggle.addEventListener("click", () => {
      service.active = !service.active;
      saveState("services");
      renderServices();
      showToast("Status do serviço atualizado.");
    });
    row
      .querySelector(".edit-btn")
      .addEventListener("click", () => openServiceDialog(service));
    body.append(row);
  });
  document.querySelector("#service-total").textContent =
    `${panelState.services.length} serviços cadastrados`;
  document.querySelector("#service-active-total").textContent =
    `${panelState.services.filter((item) => item.active).length} ativos`;
  refreshPromotionOptions();
}

function renderPromotions() {
  const grid = document.querySelector("#promotions-grid");
  grid.querySelectorAll(".promo-card").forEach((card) => card.remove());
  const addButton = grid.querySelector(".new-promo");
  panelState.promotions.forEach((promotion) => {
    const card = cloneTemplate("#promotion-template");
    card.classList.toggle("inactive", !promotion.active);
    card.querySelector(".promo-ribbon").textContent = promotion.active
      ? "ATIVA"
      : "PAUSADA";
    setField(card, "service", promotion.service);
    setField(card, "title", promotion.title);
    setField(card, "price", money(promotion.price));
    setField(
      card,
      "period",
      `${shortDate(promotion.start)} — ${shortDate(promotion.end)}`,
    );
    const toggle = card.querySelector(".toggle-promo");
    toggle.textContent = promotion.active ? "Pausar" : "Ativar";
    toggle.addEventListener("click", () => {
      promotion.active = !promotion.active;
      saveState("promotions");
      renderPromotions();
    });
    card
      .querySelector(".edit-promo")
      .addEventListener("click", () => openPromotionDialog(promotion));
    grid.insertBefore(card, addButton);
  });
}

function renderDateStrip() {
  const strip = document.querySelector("#date-strip");
  strip.replaceChildren();
  for (let index = -2; index < 5; index += 1) {
    const value = isoDate(index);
    const date = dateFromIso(value);
    const button = document.createElement("button");
    const weekday = document.createElement("span");
    const day = document.createElement("strong");
    button.className = "date-chip";
    button.classList.toggle("selected", value === panelState.selectedDate);
    weekday.textContent = date
      .toLocaleDateString("pt-BR", { weekday: "short" })
      .replace(".", "");
    day.textContent = date.getDate();
    button.append(weekday, day);
    button.addEventListener("click", () => {
      panelState.selectedDate = value;
      renderSchedule();
    });
    strip.append(button);
  }
}

function renderSchedule() {
  const appointments = panelState.appointments.filter(
    (item) => item.date === panelState.selectedDate,
  );
  const selected = dateFromIso(panelState.selectedDate);
  document.querySelector("#month-label").textContent =
    selected.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  document.querySelector("#date-picker").value = panelState.selectedDate;
  document.querySelector("#schedule-date").textContent = fullDate(
    panelState.selectedDate,
  );
  document.querySelector("#schedule-total").textContent =
    `${appointments.length} ${appointments.length === 1 ? "ATENDIMENTO" : "ATENDIMENTOS"}`;
  document.querySelector("#schedule-minutes").textContent =
    `${appointments.reduce((sum, item) => sum + item.duration, 0)} min reservados`;
  renderDateStrip();
  renderAppointments(
    document.querySelector("#schedule-appointments"),
    appointments,
  );
}

function renderBlocks() {
  const body = document.querySelector("#blocks-body");
  body.replaceChildren();
  panelState.blocks.forEach((block) => {
    const row = cloneTemplate("#block-template");
    setField(row, "date", shortDate(block.date));
    setField(
      row,
      "period",
      block.allDay ? "Dia inteiro" : `${block.start} — ${block.end}`,
    );
    setField(row, "reason", block.reason);
    row.querySelector(".delete-btn").addEventListener("click", () => {
      panelState.blocks = panelState.blocks.filter(
        (item) => item.id !== block.id,
      );
      saveState("blocks");
      renderBlocks();
      showToast("Bloqueio removido.");
    });
    body.append(row);
  });
  document.querySelector("#block-total").textContent =
    `${panelState.blocks.length} bloqueios`;
  document.querySelector("#blocks-table").hidden = !panelState.blocks.length;
  document.querySelector("#blocks-empty").hidden = Boolean(
    panelState.blocks.length,
  );
}

function renderWaitlist() {
  const body = document.querySelector("#waitlist-body");
  body.replaceChildren();
  const entries = [...panelState.waitlist].sort((a, b) =>
    `${a.date}${a.time}${a.createdAt || ""}`.localeCompare(
      `${b.date}${b.time}${b.createdAt || ""}`,
    ),
  );
  entries.forEach((entry) => {
    const row = document.createElement("tr");
    const date = document.createElement("td");
    const time = document.createElement("td");
    const client = document.createElement("td");
    const service = document.createElement("td");
    const actions = document.createElement("td");
    const contact = document.createElement("a");
    const remove = document.createElement("button");
    const clientName = document.createElement("strong");
    const clientPhone = document.createElement("small");

    date.textContent = shortDate(entry.date);
    time.textContent = entry.time;
    clientName.textContent = entry.client;
    if (entry.phone) {
      clientPhone.textContent = entry.phone;
      client.append(clientName, clientPhone);
    } else {
      client.append(clientName);
    }
    service.textContent = entry.service;
    actions.className = "waitlist-actions";
    contact.className = "contact-btn";
    contact.textContent = "Avisar";
    contact.target = "_blank";
    contact.rel = "noopener";
    const localPhone = String(entry.phone || "").replace(/\D/g, "");
    const phone = localPhone.startsWith("55") ? localPhone : `55${localPhone}`;
    const message = `Olá, ${entry.client}! Surgiu uma vaga para ${entry.service} no dia ${shortDate(entry.date)}, às ${entry.time}. Você ainda tem interesse?`;
    contact.href = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
    remove.className = "delete-btn";
    remove.textContent = "Remover";
    remove.addEventListener("click", () => {
      panelState.waitlist = panelState.waitlist.filter(
        (item) => item.id !== entry.id,
      );
      saveState("waitlist");
      renderWaitlist();
      showToast("Cliente removido da fila de espera.");
    });
    if (localPhone) actions.append(contact);
    actions.append(remove);
    row.append(date, time, client, service, actions);
    body.append(row);
  });
  document.querySelector("#waitlist-total").textContent =
    `${entries.length} ${entries.length === 1 ? "pessoa" : "pessoas"}`;
  document.querySelector("#waitlist-table").hidden = !entries.length;
  document.querySelector("#waitlist-empty").hidden = Boolean(entries.length);
}

function refreshPromotionOptions() {
  const select = document.querySelector("#promotion-service");
  const current = select.value;
  select.replaceChildren();
  panelState.services.forEach((service) => {
    const option = document.createElement("option");
    option.value = service.name;
    option.textContent = service.name;
    select.append(option);
  });
  if (current) select.value = current;
}

function openServiceDialog(service) {
  const form = document.querySelector("#service-form");
  form.reset();
  form.elements.id.value = service?.id || "";
  form.elements.name.value = service?.name || "";
  form.elements.category.value = service?.category || "Cabelo";
  form.elements.duration.value = service?.duration || 45;
  form.elements.price.value = service?.price || "";
  document.querySelector("#service-dialog-title").textContent = service
    ? "EDITAR CORTE"
    : "NOVO CORTE";
  document.querySelector("#service-dialog").showModal();
}

function openPromotionDialog(promotion) {
  const form = document.querySelector("#promotion-form");
  form.reset();
  refreshPromotionOptions();
  form.elements.id.value = promotion?.id || "";
  form.elements.title.value = promotion?.title || "";
  form.elements.service.value =
    promotion?.service || panelState.services[0]?.name || "";
  form.elements.price.value = promotion?.price || "";
  form.elements.start.value = promotion?.start || isoDate();
  form.elements.end.value = promotion?.end || isoDate(30);
  document.querySelector("#promotion-dialog").showModal();
}

function openBlockDialog(date = isoDate()) {
  const form = document.querySelector("#block-form");
  form.reset();
  form.elements.date.value = date;
  form.elements.date.min = isoDate();
  document.querySelector("#block-dialog").showModal();
}

function showView(view) {
  document.querySelectorAll("[data-panel]").forEach((panel) => {
    panel.hidden = panel.dataset.panel !== view;
  });
  document
    .querySelectorAll(".panel-nav [data-view]")
    .forEach((button) =>
      button.classList.toggle("active", button.dataset.view === view),
    );
  document.querySelector("#dashboard").classList.remove("menu-is-open");
  if (view === "overview") renderOverview();
  if (view === "services") renderServices();
  if (view === "promotions") renderPromotions();
  if (view === "schedule") renderSchedule();
  if (view === "waitlist") renderWaitlist();
  if (view === "blocks") renderBlocks();
}

function initializeAuthentication() {
  const login = document.querySelector("#login-view");
  const dashboard = document.querySelector("#dashboard");
  const showDashboard = () => {
    login.hidden = true;
    dashboard.hidden = false;
    showView("overview");
  };
  if (sessionStorage.getItem("frs-auth") === "true") showDashboard();
  document.querySelector("#toggle-password").addEventListener("click", () => {
    const password = document.querySelector("#login-form [name='password']");
    password.type = password.type === "password" ? "text" : "password";
  });
  document.querySelector("#login-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const valid =
      data.get("email") === "frs@barbearia.com" &&
      data.get("password") === "frs123";
    document.querySelector(".login-error").hidden = valid;
    if (!valid) return;
    sessionStorage.setItem("frs-auth", "true");
    showDashboard();
  });
  document.querySelector("#logout").addEventListener("click", () => {
    sessionStorage.removeItem("frs-auth");
    dashboard.hidden = true;
    login.hidden = false;
  });
}

function initializeNavigation() {
  document
    .querySelectorAll("[data-view]")
    .forEach((button) =>
      button.addEventListener("click", () => showView(button.dataset.view)),
    );
  document
    .querySelector(".menu-toggle")
    .addEventListener("click", () =>
      document.querySelector("#dashboard").classList.toggle("menu-is-open"),
    );
  document
    .querySelector(".sidebar-scrim")
    .addEventListener("click", () =>
      document.querySelector("#dashboard").classList.remove("menu-is-open"),
    );
}

function initializeDialogs() {
  document
    .querySelector("#confirm-absence")
    .addEventListener("click", confirmAppointmentRemoval);
  document.querySelectorAll("[data-open-dialog]").forEach((button) =>
    button.addEventListener("click", () => {
      if (button.dataset.openDialog === "service-dialog") openServiceDialog();
      if (button.dataset.openDialog === "promotion-dialog")
        openPromotionDialog();
      if (button.dataset.openDialog === "block-dialog")
        openBlockDialog(
          button.hasAttribute("data-use-selected-date")
            ? panelState.selectedDate
            : isoDate(),
        );
    }),
  );
  document
    .querySelectorAll("[data-close-dialog]")
    .forEach((button) =>
      button.addEventListener("click", () => button.closest("dialog").close()),
    );
  document.querySelectorAll("dialog").forEach((dialog) =>
    dialog.addEventListener("click", (event) => {
      const bounds = dialog.getBoundingClientRect();
      const outside =
        event.clientX < bounds.left ||
        event.clientX > bounds.right ||
        event.clientY < bounds.top ||
        event.clientY > bounds.bottom;
      if (outside) dialog.close();
    }),
  );
}

function initializeForms() {
  document
    .querySelector("#service-form")
    .addEventListener("submit", (event) => {
      event.preventDefault();
      const data = new FormData(event.currentTarget);
      const id = Number(data.get("id"));
      const values = {
        name: data.get("name"),
        category: data.get("category"),
        duration: Number(data.get("duration")),
        price: Number(data.get("price")),
      };
      const service = panelState.services.find((item) => item.id === id);
      if (service) Object.assign(service, values);
      else
        panelState.services.push({ id: Date.now(), ...values, active: true });
      saveState("services");
      event.currentTarget.closest("dialog").close();
      renderServices();
      showView("services");
      showToast(
        service ? "Serviço atualizado com sucesso." : "Novo corte adicionado.",
      );
    });

  document
    .querySelector("#promotion-form")
    .addEventListener("submit", (event) => {
      event.preventDefault();
      const data = new FormData(event.currentTarget);
      const id = Number(data.get("id"));
      const values = {
        title: data.get("title"),
        service: data.get("service"),
        price: Number(data.get("price")),
        start: data.get("start"),
        end: data.get("end"),
      };
      const promotion = panelState.promotions.find((item) => item.id === id);
      if (promotion) Object.assign(promotion, values);
      else
        panelState.promotions.push({ id: Date.now(), ...values, active: true });
      saveState("promotions");
      event.currentTarget.closest("dialog").close();
      showView("promotions");
      showToast("Promoção salva com sucesso.");
    });

  const blockForm = document.querySelector("#block-form");
  blockForm.elements.allDay.addEventListener("change", () => {
    blockForm.querySelectorAll(".time-field input").forEach((input) => {
      input.disabled = blockForm.elements.allDay.checked;
      input.required = !blockForm.elements.allDay.checked;
    });
  });
  blockForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    panelState.blocks.push({
      id: Date.now(),
      date: data.get("date"),
      allDay: data.get("allDay") === "on",
      start: data.get("start"),
      end: data.get("end"),
      reason: data.get("reason"),
    });
    saveState("blocks");
    event.currentTarget.closest("dialog").close();
    showView("blocks");
    showToast("Horário bloqueado na agenda.");
  });

  document.querySelectorAll('input[type="date"]').forEach((input) =>
    input.addEventListener("click", () => {
      if (typeof input.showPicker !== "function") return;
      try {
        input.showPicker();
      } catch {
        return;
      }
    }),
  );
  document.querySelector("#date-picker").addEventListener("change", (event) => {
    panelState.selectedDate = event.target.value;
    renderSchedule();
  });
}

export function initializePanel() {
  document.querySelector("#today-text").textContent = fullDate(isoDate());
  initializeAuthentication();
  initializeNavigation();
  initializeDialogs();
  initializeForms();
  renderServices();
  renderPromotions();
  renderBlocks();
  renderWaitlist();
  renderSchedule();
  renderOverview();
  window.addEventListener("storage", (event) => {
    const stateKey = event.key?.replace("frs-", "");
    if (!["appointments", "blocks", "waitlist"].includes(stateKey)) return;
    try {
      panelState[stateKey] = JSON.parse(event.newValue) || [];
    } catch {
      return;
    }
    renderOverview();
    renderSchedule();
    renderBlocks();
    renderWaitlist();
  });
}
