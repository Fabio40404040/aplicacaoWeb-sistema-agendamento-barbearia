let installPrompt = null;

const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches ||
  window.navigator.standalone === true;

export function initializePwa() {
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/sw.js").catch((error) => {
        console.error("Não foi possível ativar o modo aplicativo.", error);
      });
    });
  }

  const installButton = document.querySelector("[data-install-app]");
  if (!installButton) return;

  installButton.hidden = false;
  if (isStandalone()) {
    installButton.setAttribute("aria-label", "Aplicativo já instalado");
    installButton.title = "Aplicativo já instalado";
  }

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    installPrompt = event;
    installButton.hidden = false;
  });

  installButton.addEventListener("click", async () => {
    if (isStandalone()) {
      window.alert("Este aplicativo já está na tela inicial do seu celular.");
      return;
    }

    if (installPrompt) {
      installPrompt.prompt();
      await installPrompt.userChoice;
      installPrompt = null;
      return;
    }

    if (isIos()) {
      window.alert(
        "No iPhone, abra este site no Safari ou Chrome. Toque em Compartilhar → Adicionar à Tela de Início → Adicionar. No Safari, mantenha ‘Abrir como App da Web’ ativado. Se você abriu o link dentro de outro app, copie o endereço e abra-o em um desses navegadores.",
      );
      return;
    }

    window.alert(
      "Abra o menu do navegador e escolha ‘Instalar aplicativo’ ou ‘Adicionar à tela inicial’.",
    );
  });

  window.addEventListener("appinstalled", () => {
    installPrompt = null;
    installButton.setAttribute("aria-label", "Aplicativo já instalado");
    installButton.title = "Aplicativo já instalado";
  });
}
