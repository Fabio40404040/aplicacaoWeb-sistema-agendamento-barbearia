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
  if (!installButton || isStandalone()) return;

  if (isIos()) installButton.hidden = false;

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    installPrompt = event;
    installButton.hidden = false;
  });

  installButton.addEventListener("click", async () => {
    if (installPrompt) {
      installPrompt.prompt();
      await installPrompt.userChoice;
      installPrompt = null;
      installButton.hidden = true;
      return;
    }

    if (isIos()) {
      window.alert(
        "No iPhone, abra este site no Safari ou Chrome. Toque em Compartilhar → Adicionar à Tela de Início → Adicionar. No Safari, mantenha ‘Abrir como App da Web’ ativado. Se você abriu o link dentro de outro app, copie o endereço e abra-o em um desses navegadores.",
      );
    }
  });

  window.addEventListener("appinstalled", () => {
    installPrompt = null;
    installButton.hidden = true;
  });
}
