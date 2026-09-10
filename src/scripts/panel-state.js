const today = new Date();

const storageSections = [
  "appointments",
  "promotions",
  "services",
  "blocks",
  "waitlist",
];

storageSections.forEach((section) => {
  const currentKey = `frs-${section}`;
  const legacyKey = `imperial-${section}`;
  if (
    localStorage.getItem(currentKey) === null &&
    localStorage.getItem(legacyKey) !== null
  ) {
    localStorage.setItem(currentKey, localStorage.getItem(legacyKey));
  }
});

export function isoDate(offset = 0) {
  const date = new Date(today);
  date.setDate(date.getDate() + offset);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const defaultServices = [
  {
    id: 1,
    name: "Corte tradicional",
    duration: 40,
    price: 45,
    category: "Cabelo",
    active: true,
  },
  {
    id: 2,
    name: "Corte degradê",
    duration: 50,
    price: 55,
    category: "Cabelo",
    active: true,
  },
  {
    id: 3,
    name: "Barba completa",
    duration: 35,
    price: 45,
    category: "Barba",
    active: true,
  },
  {
    id: 4,
    name: "Corte + barba",
    duration: 75,
    price: 89,
    category: "Combo",
    active: true,
  },
];

function load(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}

function loadAppointments() {
  const demoClients = new Map([
    [1, "André Lima"],
    [2, "Caio Mendes"],
    [3, "Rafael Alves"],
    [4, "Lucas Freitas"],
    [5, "Mateus Rocha"],
    [6, "Davi Moura"],
  ]);
  const saved = load("frs-appointments", []);
  const appointments = saved.filter(
    (appointment) =>
      demoClients.get(Number(appointment.id)) !== appointment.client,
  );

  if (appointments.length !== saved.length) {
    localStorage.setItem(
      "frs-appointments",
      JSON.stringify(appointments),
    );
  }
  return appointments;
}

function loadPromotions() {
  const saved = load("frs-promotions", []);
  const promotions = saved.filter(
    (promotion) =>
      !(
        Number(promotion.id) === 1 &&
        ["Quarta Imperial", "Quarta FRS"].includes(promotion.title) &&
        promotion.service === "Corte + barba"
      ),
  );

  if (promotions.length !== saved.length) {
    localStorage.setItem("frs-promotions", JSON.stringify(promotions));
  }
  return promotions;
}

export const panelState = {
  selectedDate: isoDate(),
  services: load("frs-services", defaultServices),
  promotions: loadPromotions(),
  appointments: loadAppointments(),
  blocks: load("frs-blocks", []),
  waitlist: load("frs-waitlist", []),
};

export function saveState(key) {
  localStorage.setItem(`frs-${key}`, JSON.stringify(panelState[key]));
}
