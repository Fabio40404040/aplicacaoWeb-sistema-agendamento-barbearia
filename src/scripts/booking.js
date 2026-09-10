import { ApiError, apiRequest } from "./api.js";

export function initializeBooking() {
  const form = document.querySelector("#booking-form");
  const dateInput = document.querySelector("#date");
  const timeInput = document.querySelector("#time");
  const modeInput = document.querySelector("#booking-mode");
  const serviceInput = document.querySelector("#service");
  const nameInput = document.querySelector("#name");
  const phoneInput = document.querySelector("#phone");
  const submitButton = document.querySelector("#booking-submit");
  const success = document.querySelector("#booking-success");
  const availabilityLegend = document.querySelector("#availability-legend");
  const bookingError = document.querySelector("#booking-error");
  const validationError = document.querySelector("#form-validation-error");
  const timeButtons = [...document.querySelectorAll(".time-btn")];
  let services = [];
  let lastBooking = null;

  const toMinutes = (time) => {
    const [hours, minutes] = time.split(":").map(Number);
    return hours * 60 + minutes;
  };
  const overlaps = (start, duration, rangeStart, rangeEnd) =>
    start < rangeEnd && start + duration > rangeStart;
  const selectedDuration = () =>
    services.find((service) => service.name === serviceInput.value)?.duration ||
    60;

  function showBookingError(message) {
    bookingError.textContent = message;
    bookingError.hidden = false;
  }

  function resetTimeSelection() {
    timeInput.value = "";
    modeInput.value = "booking";
    timeButtons.forEach((button) => button.classList.remove("is-selected"));
    submitButton.innerHTML = "Solicitar agendamento <span>→</span>";
    bookingError.hidden = true;
  }

  async function loadServices() {
    try {
      const data = await apiRequest("/api/services");
      services = data.services;
      const current = serviceInput.value;
      serviceInput.replaceChildren(new Option("Selecione um serviço", ""));
      services.forEach((service) => {
        const price = Number(service.price).toLocaleString("pt-BR", {
          style: "currency",
          currency: "BRL",
        });
        serviceInput.add(
          new Option(`${service.name} — ${price}`, service.name),
        );
      });
      if (services.some((service) => service.name === current)) {
        serviceInput.value = current;
      }
    } catch {
      showBookingError(
        "O sistema de agendamento está temporariamente indisponível.",
      );
      submitButton.disabled = true;
    }
  }

  async function refreshAvailability() {
    resetTimeSelection();
    const date = dateInput.value;
    if (!date) return;
    try {
      const data = await apiRequest(
        `/api/availability?date=${encodeURIComponent(date)}`,
      );
      const duration = selectedDuration();
      let hasOccupiedSlot = false;
      timeButtons.forEach((button) => {
        const start = toMinutes(button.dataset.time);
        const appointment = data.appointments.find((item) =>
          overlaps(
            start,
            duration,
            toMinutes(item.time),
            toMinutes(item.time) + item.duration,
          ),
        );
        const blocked = data.blocks.some(
          (block) =>
            block.allDay ||
            overlaps(
              start,
              duration,
              toMinutes(block.start),
              toMinutes(block.end),
            ),
        );
        const occupied = Boolean(appointment);
        if (occupied) hasOccupiedSlot = true;
        button.disabled = blocked;
        button.classList.toggle("is-occupied", occupied && !blocked);
        button.classList.toggle("is-blocked", blocked);
        button.dataset.availability = blocked
          ? "blocked"
          : occupied
            ? "occupied"
            : "available";
        if (blocked || occupied) {
          const timeLabel = document.createElement("span");
          const unavailableLabel = document.createElement("small");
          timeLabel.textContent = button.dataset.time;
          unavailableLabel.textContent = blocked
            ? "× Bloqueado"
            : "AGENDADO · FILA";
          button.replaceChildren(timeLabel, unavailableLabel);
        } else {
          button.textContent = button.dataset.time;
        }
        button.title = blocked
          ? "Horário indisponível"
          : occupied
            ? "Horário agendado; selecione para entrar na fila de espera"
            : "Horário disponível";
        button.setAttribute(
          "aria-label",
          blocked
            ? `${button.dataset.time} indisponível`
            : occupied
              ? `${button.dataset.time} agendado; entrar na fila de espera`
              : `${button.dataset.time} disponível`,
        );
      });
      availabilityLegend.hidden = !hasOccupiedSlot;
    } catch {
      showBookingError(
        "Não foi possível consultar os horários. Tente novamente.",
      );
    }
  }

  const now = new Date();
  dateInput.min = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
    .toISOString()
    .split("T")[0];
  dateInput.addEventListener("click", () => {
    if (typeof dateInput.showPicker !== "function") return;
    try {
      dateInput.showPicker();
    } catch {
      return;
    }
  });

  dateInput.addEventListener("change", refreshAvailability);
  serviceInput.addEventListener("change", refreshAvailability);

  timeButtons.forEach((button) =>
    button.addEventListener("click", () => {
      if (button.dataset.availability === "blocked") return;
      timeButtons.forEach((item) => item.classList.remove("is-selected"));
      button.classList.add("is-selected");
      document.querySelector(".time-grid").classList.remove("has-error");
      timeInput.value = button.dataset.time;
      const isWaitlist = button.dataset.availability === "occupied";
      modeInput.value = isWaitlist ? "waitlist" : "booking";
      submitButton.innerHTML = isWaitlist
        ? "Entrar na fila de espera <span>→</span>"
        : "Solicitar agendamento <span>→</span>";
      bookingError.hidden = true;
    }),
  );

  form.addEventListener(
    "invalid",
    (event) => {
      if (event.target === nameInput || event.target === phoneInput) {
        validationError.hidden = false;
      }
    },
    true,
  );
  nameInput.addEventListener("input", () => {
    validationError.hidden =
      nameInput.validity.valid && phoneInput.validity.valid;
  });
  phoneInput.addEventListener("input", () => {
    phoneInput.value = phoneInput.value
      .replace(/\D/g, "")
      .replace(/^(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{5})(\d)/, "$1-$2")
      .slice(0, 15);
    validationError.hidden =
      nameInput.validity.valid && phoneInput.validity.valid;
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    validationError.hidden = true;
    bookingError.hidden = true;
    if (!timeInput.value) {
      document.querySelector(".time-grid").classList.add("has-error");
      document.querySelector(".time-btn").focus();
      return;
    }
    const data = new FormData(form);
    submitButton.disabled = true;
    submitButton.innerHTML = "Enviando... <span>→</span>";
    try {
      const isWaitlist = data.get("bookingMode") === "waitlist";
      await apiRequest(isWaitlist ? "/api/waitlist" : "/api/appointments", {
        method: "POST",
        body: JSON.stringify({
          name: data.get("name"),
          phone: data.get("phone"),
          service: data.get("service"),
          date: data.get("date"),
          time: data.get("time"),
        }),
      });
      lastBooking = {
        date: data.get("date"),
        service: data.get("service"),
      };
      const formattedDate = new Date(
        `${data.get("date")}T12:00:00`,
      ).toLocaleDateString("pt-BR", { day: "2-digit", month: "long" });
      document.querySelector("#success-summary").textContent =
        isWaitlist
          ? `${data.get("service")} • ${formattedDate} às ${data.get("time")} • fila de espera.`
          : `${data.get("service")} • ${formattedDate} às ${data.get("time")}. Tolerância máxima de 5 minutos.`;
      document.querySelector("#success-eyebrow").textContent = isWaitlist
        ? "Fila de espera"
        : "Tudo certo";
      document.querySelector("#success-title").textContent =
        isWaitlist ? "Você está na fila!" : "Horário agendado!";
      form.hidden = true;
      success.hidden = false;
      success.setAttribute("tabindex", "-1");
      success.focus();
    } catch (error) {
      const message =
        error instanceof ApiError
          ? error.message
          : "Não foi possível concluir. Tente novamente.";
      if (error instanceof ApiError && error.status === 409) {
        await refreshAvailability();
      }
      showBookingError(message);
    } finally {
      submitButton.disabled = false;
      submitButton.innerHTML =
        modeInput.value === "waitlist"
          ? "Entrar na fila de espera <span>→</span>"
          : "Solicitar agendamento <span>→</span>";
    }
  });

  document
    .querySelector("#book-another")
    .addEventListener("click", async () => {
      success.hidden = true;
      form.hidden = false;
      form.reset();
      if (lastBooking) {
        dateInput.value = lastBooking.date;
        serviceInput.value = lastBooking.service;
      }
      resetTimeSelection();
      await refreshAvailability();
    });

  void loadServices();
}
