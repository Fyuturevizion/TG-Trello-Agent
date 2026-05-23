export type BrowserKey = 'chrome' | 'safari' | 'firefox' | 'edge' | 'brave' | 'other';

export const BROWSER_LABELS: Record<BrowserKey, string> = {
  chrome: 'Chrome',
  safari: 'Safari',
  firefox: 'Firefox',
  edge: 'Edge',
  brave: 'Brave',
  other: 'Other',
};

export function isBrowserKey(value: string): value is BrowserKey {
  return value in BROWSER_LABELS;
}

export function browserLabel(key: BrowserKey): string {
  return BROWSER_LABELS[key];
}

export const DESKTOP_DEVICE_KEYS = ['apple_laptop', 'pc'] as const;

export function deviceNeedsBrowser(device: string): boolean {
  return (DESKTOP_DEVICE_KEYS as readonly string[]).includes(device);
}
