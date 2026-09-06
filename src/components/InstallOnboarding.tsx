"use client";

import { useEffect, useState } from "react";
import { Download, MoreVertical, Share2, X } from "lucide-react";
import {
  getDeferredInstallPrompt,
  setDeferredInstallPrompt,
  subscribeToInstallPrompt,
  type DeferredInstallPrompt,
} from "@/lib/pwaInstall";

type Platform = "ios-safari" | "ios-other" | "android-chrome" | "android-other" | "desktop";

function getPlatform(): Platform {
  const userAgent = navigator.userAgent;
  const isIos = /iPad|iPhone|iPod/.test(userAgent)
    || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if (isIos) return /CriOS|FxiOS|EdgiOS|OPiOS/.test(userAgent) ? "ios-other" : "ios-safari";
  if (/Android/.test(userAgent)) {
    return /Chrome\//.test(userAgent) && !/EdgA|OPR|SamsungBrowser/.test(userAgent)
      ? "android-chrome"
      : "android-other";
  }
  return "desktop";
}

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches
    || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
}

export function isMobileInstallCandidate() {
  return getPlatform() !== "desktop" && !isStandalone();
}

export function InstallOnboarding({ onClose }: { onClose: () => void }) {
  const platform = typeof navigator === "undefined" ? "desktop" : getPlatform();
  const [installPrompt, setInstallPrompt] = useState<DeferredInstallPrompt | null>(() =>
    typeof window === "undefined" ? null : getDeferredInstallPrompt(),
  );
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    return subscribeToInstallPrompt(setInstallPrompt);
  }, []);

  if (platform === "desktop" || isStandalone()) return null;

  async function install() {
    const prompt = installPrompt ?? getDeferredInstallPrompt();
    if (!prompt) return;
    setInstalling(true);
    try {
      await prompt.prompt();
      await prompt.userChoice;
      setDeferredInstallPrompt(null);
      onClose();
    } finally {
      setInstalling(false);
    }
  }

  const hasNativeInstall = platform === "android-chrome" && Boolean(installPrompt);

  return (
    <div className="modal-backdrop install-onboarding-backdrop" role="presentation">
      <section className="modal install-onboarding" role="dialog" aria-modal="true" aria-labelledby="install-title">
        <button type="button" className="install-onboarding-close" onClick={onClose} aria-label="Close install guide">
          <X size={18} />
        </button>
        <div className="install-onboarding-icon" aria-hidden="true"><Download size={22} /></div>
        <p className="section-label">Make Momentum yours</p>
        <h2 id="install-title">Add Momentum to your home screen</h2>
        <p className="install-onboarding-intro">Open it like an app and keep your training one tap away.</p>

        {platform === "ios-safari" ? (
          <ol className="install-steps">
            <li><Share2 size={17} aria-hidden="true" /><span>Tap <strong>Share</strong> (the square with the up arrow).</span></li>
            <li><span className="install-step-number">2</span><span>Scroll down and tap <strong>Add to Home Screen</strong>.</span></li>
            <li><span className="install-step-number">3</span><span>Tap <strong>Add</strong> to confirm.</span></li>
          </ol>
        ) : null}

        {platform === "ios-other" ? (
          <div className="install-callout">
            <strong>Open this page in Safari first.</strong>
            <span>iPhone browsers other than Safari cannot add Momentum to your home screen.</span>
          </div>
        ) : null}

        {platform === "android-chrome" ? (
          <>
            {hasNativeInstall ? (
              <button type="button" className="primary-button install-native-button" disabled={installing} onClick={() => void install()}>
                <Download size={17} /> {installing ? "Opening install…" : "Install app"}
              </button>
            ) : null}
            <ol className="install-steps">
              <li><MoreVertical size={18} aria-hidden="true" /><span>Tap Chrome&apos;s <strong>three-dot menu</strong>.</span></li>
              <li><span className="install-step-number">2</span><span>Choose <strong>Install app</strong> or <strong>Add to Home screen</strong>.</span></li>
              <li><span className="install-step-number">3</span><span>Tap <strong>Install</strong> to confirm.</span></li>
            </ol>
          </>
        ) : null}

        {platform === "android-other" ? (
          <div className="install-callout">
            <strong>Use your browser menu.</strong>
            <span>Look for <strong>Install app</strong> or <strong>Add to Home screen</strong>, then confirm.</span>
          </div>
        ) : null}

        <button type="button" className="text-button install-onboarding-later" onClick={onClose}>Maybe later</button>
      </section>
    </div>
  );
}
