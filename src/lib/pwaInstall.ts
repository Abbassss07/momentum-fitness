export type DeferredInstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

let deferredInstallPrompt: DeferredInstallPrompt | null = null;
const listeners = new Set<(prompt: DeferredInstallPrompt | null) => void>();

export function setDeferredInstallPrompt(prompt: DeferredInstallPrompt | null) {
  deferredInstallPrompt = prompt;
  listeners.forEach((listener) => listener(prompt));
}

export function getDeferredInstallPrompt() {
  return deferredInstallPrompt;
}

export function subscribeToInstallPrompt(listener: (prompt: DeferredInstallPrompt | null) => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
