import { isProductAreaId, PRODUCT_AREAS, productAreaLabel } from '../product/areas';
import { announceProductFeedback } from '../product/announce';
import { incrementProductFeedbackCount, loadActiveProduct } from '../product/session';
import { addProductAttachment, appendProductFeedback } from '../product/trello';
import { isBlockedUser } from '../telegram';
import { validateInitData } from '../telegram-webapp';
import type { Env } from '../types';

interface ProductFeedbackBody {
  initData: string;
  area: string;
  title: string;
  details: string;
  device?: string;
  photos?: string[];
}

function parseBody(raw: unknown): ProductFeedbackBody | null {
  if (!raw || typeof raw !== 'object') return null;
  const b = raw as Record<string, unknown>;
  if (typeof b.initData !== 'string') return null;
  if (typeof b.area !== 'string' || !isProductAreaId(b.area)) return null;
  if (typeof b.title !== 'string' || !b.title.trim()) return null;
  if (typeof b.details !== 'string' || !b.details.trim()) return null;

  let device: string | undefined;
  if (typeof b.device === 'string' && b.device.trim()) {
    device = b.device.trim().slice(0, 64);
  }

  const photos = Array.isArray(b.photos)
    ? b.photos.filter((p): p is string => typeof p === 'string')
    : [];

  return {
    initData: b.initData,
    area: b.area,
    title: b.title.trim().slice(0, 200),
    details: b.details.trim().slice(0, 4000),
    device,
    photos,
  };
}

function base64ToArrayBuffer(b64: string): ArrayBuffer {
  const binary = atob(b64.replace(/^data:[^;]+;base64,/, ''));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

export async function getActiveProductPublic(env: Env): Promise<{
  ok: true;
  slug: string;
  displayName: string;
  areas: { id: string; label: string }[];
} | { ok: false; error: string }> {
  const active = await loadActiveProduct(env);
  if (!active) {
    return { ok: false, error: 'No product feedback round is open' };
  }
  return {
    ok: true,
    slug: active.slug,
    displayName: active.displayName,
    areas: PRODUCT_AREAS.map((a) => ({ id: a.id, label: a.label })),
  };
}

export async function handleProductFeedbackSubmit(
  env: Env,
  raw: unknown,
): Promise<
  | { ok: true; shortUrl: string; itemNumber: number }
  | { ok: false; error: string; status: number }
> {
  const body = parseBody(raw);
  if (!body) {
    return { ok: false, error: 'Invalid request body', status: 400 };
  }

  const auth = await validateInitData(body.initData, env.TELEGRAM_BOT_TOKEN);
  if (!auth) {
    return { ok: false, error: 'Invalid Telegram session', status: 401 };
  }

  if (isBlockedUser(env, auth.user.id, auth.user.username)) {
    return { ok: false, error: 'Not permitted', status: 403 };
  }

  const campaign = await loadActiveProduct(env);
  if (!campaign) {
    return { ok: false, error: 'Product feedback is not open', status: 403 };
  }

  const itemNumber = await incrementProductFeedbackCount(env);
  const maxPhotos = Math.min(Number(env.MAX_PHOTOS ?? '3') || 3, 10);
  const photos = (body.photos ?? []).slice(0, maxPhotos);

  await appendProductFeedback(env, campaign.cardId, campaign.checklistId, {
    area: body.area,
    title: body.title,
    details: body.details,
    device: body.device,
    reporterUsername: auth.user.username,
    reporterId: auth.user.id,
    reporterFirstName: auth.user.first_name,
    itemNumber,
  });

  let photoIndex = 1;
  for (const photo of photos) {
    try {
      await addProductAttachment(
        env,
        campaign.cardId,
        `${campaign.slug}-${itemNumber}-${photoIndex}.jpg`,
        base64ToArrayBuffer(photo),
      );
      photoIndex += 1;
    } catch (error) {
      console.error(
        JSON.stringify({
          event: 'product_attachment_failed',
          itemNumber,
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    }
  }

  await announceProductFeedback(env, {
    displayName: campaign.displayName,
    areaLabel: productAreaLabel(body.area),
    title: body.title,
    shortUrl: campaign.shortUrl,
    reporterUsername: auth.user.username,
    reporterId: auth.user.id,
    reporterFirstName: auth.user.first_name,
  });

  return { ok: true, shortUrl: campaign.shortUrl, itemNumber };
}
