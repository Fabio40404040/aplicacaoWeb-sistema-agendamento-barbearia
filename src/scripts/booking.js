import { panelState } from "./panel-state.js";

export function initializeBooking() {
  const form = document.querySelector("#booking-form");
  const dateInput = document.querySelector("#date");
  const timeInput = document.querySelector("#time");
  const modeInput = document.querySelector("#booking-mode");
  const serviceInput = document.querySelector("#service");
  const nameInput = document.querySelector("#name");
  const submitButton = document.querySelector("#booking-submit");
  const success = document.querySelector("#booking-success");
  const availabilityLegend = document.querySelector("#availability-legend");
  const bookingError = document.querySelector("#booking-error");
  const validationError = document.querySelector("#form-validation-error");
  const timeButtons = [...document.querySelectorAll(".time-btn")];
  let lastBooking = null;

  const defaultDurations = {
    "Corte tradicional": 40,
    "Corte degradê": 50,
    "Barba completa": 35,
    "Corte + barba": 75,
    "Pezinho / acabamento": 15,
    Sobrancelha: 10,
  };
  const load = (key, fallback = []) => {
    try {
      const stored = localStorage.getItem(key);
      return stored === null ? fallback : JSON.parse(stored) || fallback;
    } catch {
      return fallback;
    }
  };
  const toMinutes = (time) => {
    const [hours, minutes] = time.split(":").map(Number);
    return hours * 60 + minutes;
  };
  const overlaps = (start, duration, rangeStart, rangeEnd) =>
    start < rangeEnd && start + duration > rangeStart;
  const selectedDuration = () => {
    const services = load("frs-services", panelState.services);
    return (
      services.find((service) => service.name === serviceInput.value)?.duration ||
      defaultDurations[serviceInput.value] ||
      60
    );
  };

  function resetTimeSelection() {
    timeInput.value = "";
    modeInput.value = "booking";
    timeButtons.forEach((button) => button.classList.remove("is-selected"));
    submitButton.innerHTML = "Solicitar agendamento <span>→</span>";
    bookingError.hidden = true;
  }

  function refreshAvailability() {
    resetTimeSelection();
    const date = dateInput.value;
    const slotDuration = 60;
    const appointments = load(
      "frs-appointments",
      panelState.appointments,
    ).filter(
      (appointment) => appointment.date === date,
    );
    const blocks = load("frs-blocks", panelState.blocks).filter(
      (block) => block.date === date,
    );

    let hasOccupiedSlot = false;
    timeButtons.forEach((button) => {
      const start = toMinutes(button.dataset.time);
      const appointmentInSlot = appointments.find(
        (appointment) =>
          Math.floor(toMinutes(appointment.time) / 60) ===
          Math.floor(start / 60),
      );
      const occupied = Boolean(appointmentInSlot);
      if (occupied) hasOccupiedSlot = true;
      const blocked = blocks.some(
        (block) =>
          block.allDay ||
          overlaps(
            start,
            slotDuration,
            toMinutes(block.start),
            toMinutes(block.end),
          ),
      );
      button.disabled = blocked || occupied;
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
          : "AGENDADO";
        button.replaceChildren(timeLabel, unavailableLabel);
      } else {
        button.textContent = button.dataset.time;
      }
      button.title = blocked
        ? "Horário indisponível"
        : occupied
          ? `Horário já agendado para ${appointmentInSlot.time}`
          : "Horário disponível";
      button.setAttribute(
        "aria-label",
        blocked
          ? `${button.dataset.time} indisponível`
          : occupied
            ? `${button.dataset.time} já agendado`
            : `${button.dataset.time} disponível`,
      );
    });
    availabilityLegend.hidden = !hasOccupiedSlot;
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
  window.addEventListener("storage", (event) => {
    if (["frs-appointments", "frs-blocks"].includes(event.key)) {
      refreshAvailability();
    }
  });

  timeButtons.forEach((button) =>
    button.addEventListener("click", () => {
      timeButtons.forEach((item) => item.classList.remove("is-selected"));
      button.classList.add("is-selected");
      document.querySelector(".time-grid").classList.remove("has-error");
      timeInput.value = button.dataset.time;
      modeInput.value = "booking";
      submitButton.innerHTML = "Solicitar agendamento <span>→</span>";
    }),
  );

  form.addEventListener(
    "invalid",
    (event) => {
      if (event.target === nameInput) validationError.hidden = false;
    },
    true,
  );
  nameInput.addEventListener("input", () => {
    validationError.hidden = nameInput.validity.valid;
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    validationError.hidden = true;
    if (!timeInput.value) {
      document.querySelector(".time-grid").classList.add("has-error");
      document.querySelector(".time-btn").focus();
      return;
    }
    const data = new FormData(form);
    const currentAppointments = load(
      "frs-appointments",
      panelState.appointments,
    );
    const selectedSlot = Math.floor(toMinutes(data.get("time")) / 60);
    const alreadyBooked = currentAppointments.some(
      (appointment) =>
        appointment.date === data.get("date") &&
        Math.floor(toMinutes(appointment.time) / 60) === selectedSlot,
    );
    if (alreadyBooked) {
      refreshAvailability();
      bookingError.hidden = false;
      return;
    }
    lastBooking = {
      date: data.get("date"),
      service: data.get("service"),
    };
    const formattedDate = new Date(
      `${data.get("date")}T12:00:00`,
    ).toLocaleDateString("pt-BR", { day: "2-digit", month: "long" });
    const isWaitlist = data.get("bookingMode") === "waitlist";
    if (isWaitlist) {
      const waitlist = load("frs-waitlist");
      waitlist.push({
        id: Date.now(),
        client: data.get("name"),
        service: data.get("service"),
        date: data.get("date"),
        time: data.get("time"),
        createdAt: new Date().toISOString(),
      });
      localStorage.setItem("frs-waitlist", JSON.stringify(waitlist));
    } else {
      const appointments = currentAppointments;
      appointments.push({
        id: Date.now(),
        time: data.get("time"),
        client: data.get("name"),
        service: data.get("service"),
        duration: selectedDuration(),
        date: data.get("date"),
        status: "pending",
      });
      localStorage.setItem(
        "frs-appointments",
        JSON.stringify(appointments),
      );
    }
    refreshAvailability();
    document.querySelector("#success-summary").textContent =
      isWaitlist
        ? `${data.get("service")} • ${formattedDate} às ${data.get("time")} • fila de espera`
        : `${data.get("service")} • ${formattedDate} às ${data.get("time")}. Tolerância máxima de 5 minutos.`;
    document.querySelector("#success-eyebrow").textContent = isWaitlist
      ? "Fila de espera"
      : "Tudo certo";
    document.querySelector("#success-title").textContent = isWaitlist
      ? "Você está na fila!"
      : "Horário agendado!";
    form.hidden = true;
    success.hidden = false;
    success.setAttribute("tabindex", "-1");
    success.focus();
  });

  document.querySelector("#book-another").addEventListener("click", () => {
    success.hidden = true;
    form.hidden = false;
    form.reset();
    if (lastBooking) {
      dateInput.value = lastBooking.date;
      serviceInput.value = lastBooking.service;
    }
    resetTimeSelection();
    refreshAvailability();
  });

  refreshAvailability();
}
