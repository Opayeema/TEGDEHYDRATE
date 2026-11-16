import {registerSW} from 'virtual:pwa-register';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{outcome: 'accepted' | 'dismissed'; platform: string}>;
}

export interface TegPwaStatus {
  isInstallable: boolean;
  isInstalled: boolean;
  isIOS: boolean;
  isOnline: boolean;
  offlineReady: boolean;
  updateAvailable: boolean;
}

export interface TegPwaBridge {
  getStatus: () => TegPwaStatus;
  install: () => Promise<'prompted' | 'accepted' | 'dismissed' | 'unavailable'>;
  applyUpdate: () => Promise<void>;
  subscribe: (fn: (status: TegPwaStatus) => void) => () => void;
}

declare global {
  interface Window {
    __TEG_PWA__?: TegPwaBridge;
  }
}

const THREE_CDN_ASSETS = [
  'https://cdn.jsdelivr.net/npm/three@0.170.0/+esm',
  'https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/controls/OrbitControls.js/+esm',
  'https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/environments/RoomEnvironment.js/+esm',
];

function detectStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const nav = window.navigator as Navigator & {standalone?: boolean};
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    nav.standalone === true
  );
}

function detectIOS(): boolean {
  if (typeof window === 'undefined') return false;
  const ua = window.navigator.userAgent.toLowerCase();
  const isIPhoneOrIPad = /iphone|ipad|ipod/.test(ua);
  const isIPadOSDesktopUA = window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1;
  return isIPhoneOrIPad || isIPadOSDesktopUA;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;
const status: TegPwaStatus = {
  isInstallable: false,
  isInstalled: detectStandalone(),
  isIOS: detectIOS(),
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
  offlineReady: false,
  updateAvailable: false,
};

const listeners = new Set<(s: TegPwaStatus) => void>();

function notify(): void {
  const snapshot: TegPwaStatus = {...status};
  listeners.forEach((fn) => fn(snapshot));
  window.dispatchEvent(new CustomEvent('teg-pwa-status', {detail: snapshot}));
}

window.addEventListener('beforeinstallprompt', (e: Event) => {
  e.preventDefault();
  deferredPrompt = e as BeforeInstallPromptEvent;
  status.isInstallable = true;
  notify();
});

window.addEventListener('appinstalled', () => {
  deferredPrompt = null;
  status.isInstallable = false;
  status.isInstalled = true;
  notify();
});

window.addEventListener('online', () => {
  status.isOnline = true;
  notify();
});

window.addEventListener('offline', () => {
  status.isOnline = false;
  notify();
});

const standaloneMql = window.matchMedia('(display-mode: standalone)');
if (typeof standaloneMql.addEventListener === 'function') {
  standaloneMql.addEventListener('change', () => {
    status.isInstalled = detectStandalone();
    notify();
  });
}

let updateServiceWorker: (reloadPage?: boolean) => Promise<void> = async () => {};

if ('serviceWorker' in navigator) {
  updateServiceWorker = registerSW({
    immediate: true,
    onOfflineReady() {
      status.offlineReady = true;
      notify();
    },
    onNeedRefresh() {
      status.updateAvailable = true;
      notify();
    },
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;
      // Warm Three.js CDN runtime cache once SW controls the page
      navigator.serviceWorker.ready
        .then(() => {
          if (!navigator.onLine) return;
          for (const url of THREE_CDN_ASSETS) {
            fetch(url, {mode: 'cors'}).catch(() => {});
          }
        })
        .catch(() => {});
    },
  });
}

window.__TEG_PWA__ = {
  getStatus: () => ({...status}),
  async install() {
    if (!deferredPrompt) return 'unavailable';
    await deferredPrompt.prompt();
    const {outcome} = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      deferredPrompt = null;
      status.isInstallable = false;
      status.isInstalled = true;
      notify();
      return 'accepted';
    }
    return 'dismissed';
  },
  async applyUpdate() {
    await updateServiceWorker(true);
  },
  subscribe(fn) {
    listeners.add(fn);
    fn({...status});
    return () => {
      listeners.delete(fn);
    };
  },
};
