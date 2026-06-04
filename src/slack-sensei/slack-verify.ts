/**
 * Verify Slack Events API requests (signing secret).
 * @see https://api.slack.com/authentication/verifying-requests-from-slack
 */
export async function verifySlackRequest(
  signingSecret: string,
  rawBody: string,
  timestampHeader: string | undefined,
  signatureHeader: string | undefined,
): Promise<boolean> {
  if (!signingSecret || !timestampHeader || !signatureHeader) return false;

  const age = Math.abs(Date.now() / 1000 - Number(timestampHeader));
  if (!Number.isFinite(age) || age > 60 * 5) return false;

  const base = `v0:${timestampHeader}:${rawBody}`;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(signingSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(base));
  const hex = [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
  const expected = `v0=${hex}`;

  return timingSafeEqual(expected, signatureHeader);
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}
