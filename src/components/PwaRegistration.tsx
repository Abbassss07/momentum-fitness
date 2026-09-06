"use client";

import { useEffect } from "react";
import { setDeferredInstallPrompt, type DeferredInstallPrompt } from "@/lib/pwaInstall";

export function PwaRegistration() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    void navigator.serviceWorker.register("/sw.js").catch(() => {
      // The site remains fully usable when a browser blocks service workers.
    });

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredInstallPrompt(event as DeferredInstallPrompt);
    };
    const onAppInstalled = () => setDeferredInstallPrompt(null);

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);

  return null;
}
