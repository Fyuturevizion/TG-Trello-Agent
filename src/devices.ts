import type { Env } from './types';

/** Trello "Device" custom field options on Support/Triage board */
export type DeviceKey = 'android' | 'iphone' | 'native_app' | 'apple_laptop' | 'pc';

export const TRELLO_DEVICES: Record<
  DeviceKey,
  { label: string; optionId: string }
> = {
  android: { label: 'Android Mobile', optionId: '69130d9c54d5911255a8d457' },
  iphone: { label: 'Iphone', optionId: '69130d9c54d5911255a8d458' },
  native_app: { label: 'Native App', optionId: '' },
  apple_laptop: { label: 'Apple Laptop', optionId: '69130eb55feeacc0f9055a74' },
  pc: { label: 'PC', optionId: '69130ece9af7e2a785105ac8' },
};

export function trelloDeviceOptionId(env: Env, device: DeviceKey): string {
  const optionId = TRELLO_DEVICES[device].optionId;
  if (!optionId) {
    throw new Error(`Trello device option is not configured for ${device}`);
  }
  return optionId;
}

export function deviceLabel(key: DeviceKey): string {
  return TRELLO_DEVICES[key].label;
}

export function deviceDisplayLabel(key: DeviceKey, browserLabel?: string): string {
  if (browserLabel) return `${deviceLabel(key)} · ${browserLabel}`;
  return deviceLabel(key);
}

export function isDeviceKey(value: string): value is DeviceKey {
  return value in TRELLO_DEVICES;
}

export function deviceNeedsAppVersion(device: DeviceKey): boolean {
  return device === 'android' || device === 'iphone' || device === 'native_app';
}
