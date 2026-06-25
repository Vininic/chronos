const SUBSCRIPTION_KEY = "chronos.push.subscription";

export interface PushState {
  supported: boolean;
  permission: NotificationPermission | "unavailable";
  subscribed: boolean;
}

export function getPushState(): PushState {
  const supported = "Notification" in window && "serviceWorker" in navigator && "PushManager" in window;
  if (!supported) return { supported: false, permission: "unavailable", subscribed: false };
  return {
    supported: true,
    permission: Notification.permission,
    subscribed: !!localStorage.getItem(SUBSCRIPTION_KEY),
  };
}

export function getVapidPublicKey(): string | null {
  try {
    return localStorage.getItem("chronos.push.vapidKey");
  } catch {
    return null;
  }
}

export function setVapidPublicKey(key: string): void {
  localStorage.setItem("chronos.push.vapidKey", key);
}

export function clearVapidPublicKey(): void {
  localStorage.removeItem("chronos.push.vapidKey");
}

export async function requestPermission(): Promise<NotificationPermission> {
  const permission = await Notification.requestPermission();
  return permission;
}

export async function subscribeToPush(vapidPublicKey: string): Promise<boolean> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return false;

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource,
    });

    localStorage.setItem(SUBSCRIPTION_KEY, JSON.stringify(subscription.toJSON()));
    return true;
  } catch {
    return false;
  }
}

export async function unsubscribeFromPush(): Promise<boolean> {
  if (!("serviceWorker" in navigator)) return false;

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      await subscription.unsubscribe();
    }
    localStorage.removeItem(SUBSCRIPTION_KEY);
    return true;
  } catch {
    localStorage.removeItem(SUBSCRIPTION_KEY);
    return false;
  }
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from(rawData.split("").map((c) => c.charCodeAt(0)));
}
