/** Bump when Mini App HTML/CSS/JS changes — busts Telegram WebView cache. */
export const WEBAPP_UI_VERSION = '20260608-product';

export function webappUrlWithVersion(base: string, extra?: Record<string, string>): string {
  const url = new URL(base.replace(/\/$/, '') || 'https://example.invalid');
  url.searchParams.set('ui', WEBAPP_UI_VERSION);
  if (extra) {
    for (const [k, v] of Object.entries(extra)) url.searchParams.set(k, v);
  }
  return url.toString();
}
