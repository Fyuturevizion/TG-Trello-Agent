import { deviceNeedsBrowser, isBrowserKey } from '../browsers';
import type { BrowserKey } from '../browsers';
import { announceProductFeedback, notifyReporterDm } from '../channel';
import type { DeviceKey } from '../devices';
import { isDeviceKey } from '../devices';
import {
  featureAreaLabel,
  getProductDefinition,
  getProductRecord,
  isValidFeatureArea,
  isValidFeedbackType,
} from '../products';
import { escapeHtml, formatBoardLine, formatCardUpdateMessage, formatReporterMention } from '../telegram-format';
import { isBlockedUser } from '../telegram';
import { validateInitData } from '../telegram-webapp';
import {
  addAttachment,
  addProductFeedbackItem,
  buildProductChecklistItemName,
  buildProductFeedbackComment,
} from '../trello';
import type { Env } from '../types';
import { PRODUCT_FEEDBACK_TYPES, type ProductFeatureArea } from '../products';

interface ProductFeedbackBody {
  initData: string;
  product: string;
  featureArea: string;
  feedbackType: string;
  device: string;
  browser?: string;
  appVersion?: string;
  nativeAppConfirmed?: boolean;
  title: string;
  details: string;
  ercAddress: string;
  photos?: string[];
}

function parseBody(raw: unknown): ProductFeedbackBody | null {
  if (!raw || typeof raw !== 'object') return null;
  const b = raw as Record<string, unknown>;
  if (typeof b.initData !== 'string') return null;
  if (typeof b.product !== 'string' || !b.product.trim()) return null;
  if (typeof b.featureArea !== 'string' || !b.featureArea.trim()) return null;
  if (typeof b.feedbackType !== 'string' || !isValidFeedbackType(b.feedbackType)) return null;
  if (typeof b.device !== 'string' || !isDeviceKey(b.device)) return null;
  if (typeof b.title !== 'string' || !b.title.trim()) return null;
  if (typeof b.details !== 'string' || !b.details.trim()) return null;
  if (typeof b.ercAddress !== 'string') return null;

  let browser: BrowserKey | undefined;
  if (deviceNeedsBrowser(b.device)) {
    if (typeof b.browser !== 'string' || !isBrowserKey(b.browser)) return null;
    browser = b.browser;
  } else if (b.browser !== undefined && b.browser !== '') {
    if (typeof b.browser !== 'string' || !isBrowserKey(b.browser)) return null;
    browser = b.browser;
  }

  let appVersion: string | undefined;
  if (typeof b.appVersion === 'string' && b.appVersion.trim()) {
    appVersion = b.appVersion.trim().slice(0, 64);
  }

  if (b.device === 'native_app') {
    const confirmed = b.nativeAppConfirmed === true || b.nativeAppConfirmed === 'true';
    if (!confirmed) return null;
  }

  const photos = Array.isArray(b.photos)
    ? b.photos.filter((p): p is string => typeof p === 'string')
    : [];

  return {
    initData: b.initData,
    product: b.product.trim().toLowerCase(),
    featureArea: b.featureArea.trim(),
    feedbackType: b.feedbackType,
    device: b.device,
    browser,
    appVersion,
    title: b.title.trim().slice(0, 200),
    details: b.details.trim().slice(0, 4000),
    ercAddress: b.ercAddress.trim().slice(0, 128) || 'N/A',
    photos,
  };
}

function base64ToArrayBuffer(b64: string): ArrayBuffer {
  const binary = atob(b64.replace(/^data:[^;]+;base64,/, ''));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

function submissionId(): string {
  const t = Date.now().toString(36);
  const r = Math.random().toString(36).slice(2, 8);
  return `${t}-${r}`;
}

export async function handleProductFeedbackSubmit(
  env: Env,
  raw: unknown,
): Promise<
  | { ok: true; shortUrl: string; submissionId: string }
  | { ok: false; error: string; status: number }
> {
  const body = parseBody(raw);
  if (!body) {
    return { ok: false, error: 'Invalid request body', status: 400 };
  }

  const definition = getProductDefinition(body.product);
  if (!definition) {
    return { ok: false, error: 'Unknown product', status: 400 };
  }

  if (!isValidFeatureArea(definition, body.featureArea)) {
    return { ok: false, error: 'Invalid feature area', status: 400 };
  }

  const record = await getProductRecord(env, body.product);
  if (!record?.active) {
    return { ok: false, error: 'Product feedback is not active', status: 403 };
  }

  const auth = await validateInitData(body.initData, env.TELEGRAM_BOT_TOKEN);
  if (!auth) {
    return { ok: false, error: 'Invalid Telegram session', status: 401 };
  }

  if (isBlockedUser(env, auth.user.id, auth.user.username)) {
    return { ok: false, error: 'Not permitted', status: 403 };
  }

  const maxPhotos = Math.min(Number(env.MAX_PHOTOS ?? '3') || 3, 10);
  const photos = (body.photos ?? []).slice(0, maxPhotos);
  const device = body.device as DeviceKey;
  const browser = body.browser as BrowserKey | undefined;
  const sid = submissionId();
  const featureLabel = featureAreaLabel(definition, body.featureArea) ?? body.featureArea;

  const checklistName = buildProductChecklistItemName({
    featureLabel,
    feedbackType: body.feedbackType,
    title: body.title,
  });

  const commentText = buildProductFeedbackComment({
    definition,
    featureId: body.featureArea,
    feedbackType: body.feedbackType,
    device,
    browser,
    appVersion: body.appVersion,
    title: body.title,
    details: body.details,
    ercAddress: body.ercAddress,
    reporterUsername: auth.user.username,
    reporterId: auth.user.id,
    submissionId: sid,
  });

  await addProductFeedbackItem(env, {
    cardId: record.cardId,
    checklistId: record.checklistId,
    checklistName,
    commentText,
  });

  let i = 1;
  for (const photo of photos) {
    try {
      await addAttachment(
        env,
        record.cardId,
        `marketplace-${sid}-${i}.jpg`,
        base64ToArrayBuffer(photo),
      );
      i += 1;
    } catch (error) {
      console.error(
        JSON.stringify({
          event: 'product_attachment_failed',
          submissionId: sid,
          index: i,
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    }
  }

  await announceProductFeedback(env, {
    productName: definition.displayName,
    featureLabel,
    feedbackType: body.feedbackType,
    title: body.title,
    shortUrl: record.shortUrl,
    reporterUsername: auth.user.username,
    reporterId: auth.user.id,
    reporterFirstName: auth.user.first_name,
  });

  try {
    const mention = formatReporterMention({
      reporterId: auth.user.id,
      reporterUsername: auth.user.username,
      reporterFirstName: auth.user.first_name,
    });
    const dmText = formatCardUpdateMessage({
      headline: `${definition.displayName} feedback recorded`,
      title: body.title,
      subtitle: `${escapeHtml(featureLabel)} · added to the product card checklist`,
      boardLine: formatBoardLine(env),
      listLine: 'Aggregated on product feedback card',
      shortUrl: record.shortUrl,
      createdBy: mention,
    }).join('\n');
    await notifyReporterDm(env, auth.user.id, dmText);
  } catch {
    // DM may be blocked
  }

  return { ok: true, shortUrl: record.shortUrl, submissionId: sid };
}

export async function handleProductConfig(
  env: Env,
  slug: string,
): Promise<
  | {
      ok: true;
      slug: string;
      displayName: string;
      active: boolean;
      featureAreas: ProductFeatureArea[];
      feedbackTypes: typeof PRODUCT_FEEDBACK_TYPES;
    }
  | { ok: false; error: string; status: number }
> {
  const definition = getProductDefinition(slug);
  if (!definition) {
    return { ok: false, error: 'Unknown product', status: 404 };
  }

  const record = await getProductRecord(env, slug);

  return {
    ok: true,
    slug: definition.slug,
    displayName: definition.displayName,
    active: Boolean(record?.active),
    featureAreas: definition.featureAreas,
    feedbackTypes: PRODUCT_FEEDBACK_TYPES,
  };
}
