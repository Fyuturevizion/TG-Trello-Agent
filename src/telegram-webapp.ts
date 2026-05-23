export interface TelegramWebAppUser {
  id: number;
  first_name?: string;
  username?: string;
}

function bufferToHex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function hmacSha256(key: ArrayBuffer | Uint8Array, message: string): Promise<ArrayBuffer> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(message));
}

/** Validates Telegram Mini App initData. https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app */
export async function validateInitData(
  initData: string,
  botToken: string,
): Promise<{ user: TelegramWebAppUser } | null> {
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return null;

  params.delete('hash');
  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');

  const secretKey = await hmacSha256(
    new TextEncoder().encode('WebAppData'),
    botToken,
  );
  const calculated = bufferToHex(await hmacSha256(secretKey, dataCheckString));

  if (calculated !== hash) return null;

  const userRaw = params.get('user');
  if (!userRaw) return null;

  try {
    const user = JSON.parse(userRaw) as TelegramWebAppUser;
    if (!user.id) return null;
    return { user };
  } catch {
    return null;
  }
}
