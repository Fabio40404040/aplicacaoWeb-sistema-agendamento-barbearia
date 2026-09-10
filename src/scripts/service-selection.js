export function initializeServiceSelection() {
  const serviceSelect = document.querySelector("#service");
  document.querySelectorAll("[data-service]").forEach((link) => {
    link.addEventListener("click", () => {
      serviceSelect.value = link.dataset.service;
    });
  });
}
