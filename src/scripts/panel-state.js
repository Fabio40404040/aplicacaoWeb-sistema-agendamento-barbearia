import { apiRequest } from "./api.js";

const today = new Date();

export function isoDate(offset = 0) {
  const date = new Date(today);
  date.setDate(date.getDate() + offset);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export const panelState = {
  selectedDate: isoDate(),
  services: [],
  promotions: [],
  appointments: [],
  blocks: [],
  waitlist: [],
};

export async function loadPanelState() {
  const state = await apiRequest("/api/admin/state");
  ["services", "promotions", "appointments", "blocks", "waitlist"].forEach(
    (key) => {
      panelState[key] = state[key] || [];
    },
  );
  return panelState;
}

export async function saveState(key) {
  await apiRequest(`/api/admin/state/${key}`, {
    method: "PUT",
    body: JSON.stringify({ items: panelState[key] }),
  });
}
