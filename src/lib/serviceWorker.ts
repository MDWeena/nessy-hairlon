import { anyFormInProgress, reloadPreservingDrafts } from "./formDrafts.js";

const HOURLY = 60 * 60 * 1000;

/**
 * Registers the service worker ourselves (vite.config.ts: injectRegister false) so updates are
 * actually looked for: on return to the foreground and hourly while open — an installed app
 * resumed from the background otherwise never checks. The generated worker activates as soon as
 * it's installed (registerType "autoUpdate" → skipWaiting + clientsClaim); when it takes over,
 * the page reloads onto the new build if nobody is mid-form. If someone is, it waits — the version
 * check before submitting offers the refresh then.
 */
export function startServiceWorker(): void {
  if (!import.meta.env.PROD || typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

  const sw = navigator.serviceWorker;
  // A first install also fires controllerchange — that isn't an update and needs no reload.
  let hadController = !!sw.controller;
  sw.addEventListener("controllerchange", () => {
    if (!hadController) { hadController = true; return; }
    if (!anyFormInProgress()) reloadPreservingDrafts();
  });

  window.addEventListener("load", () => {
    sw.register("/sw.js", { scope: "/" }).then(reg => {
      const check = () => { reg.update().catch(() => { /* offline — try again later */ }); };
      setInterval(check, HOURLY);
      document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") check(); });
    }).catch(err => console.error("Service worker registration failed", err));
  });
}
