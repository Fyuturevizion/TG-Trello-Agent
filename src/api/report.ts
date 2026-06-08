import { deviceNeedsBrowser, isBrowserKey } from '../browsers';
import type { BrowserKey } from '../browsers';
import { saveCardReporter } from '../card-reporter';
import { announceNewCard, notifyReporterDm } from '../channel';
import type { DeviceKey } from '../devices';
import { deviceNeedsAppVersion, isDeviceKey } from '../devices';
import { primaryQaChatId } from '../qa-chats';
import {
  formatBoardLine,
  formatCardUpdateMessage,
  formatReporterMention,
} from '../telegram-format';
import { isBlockedUser } from '../telegram';
import { validateInitData } from '../telegram-webapp';
import { loadActiveProductCampaign } from '../product/store';
import { createProductCard } from '../product/trello';
import { productListLabel } from '../product/lists';
import { getProductDefinition } from '../product/catalog';
import { PRODUCT_FEATURE_AREA_LABELS } from '../product/types';
import type { ProductFeatureArea } from '../product/types';
import { addAttachment, createCard } from '../trello';
import type { Env, ReportType } from '../types';

const PRODUCT_FEATURE_AREAS = new Set<string>(Object.keys(PRODUCT_FEATURE_AREA_LABELS));

interface ReportBody {
  initData: string;
  type: ReportType;
  device: string;
  browser?: string;
  appVersion?: string;
  nativeAppConfirmed?: boolean;
  title: string;
  details: string;
  ercAddress: string;
  photos?: string[];
  productSlug?: string;
  productPhase?: number;
  featureArea?: ProductFeatureArea;
}

function isProductFeatureArea(value: string): value is ProductFeatureArea {
  return PRODUCT_FEATURE_AREAS.has(value);
}

function parseBody(raw: unknown): ReportBody | null {
  if (!raw || typeof raw !== 'object') return null;
  const b = raw as Record<string, unknown>;
  if (typeof b.initData !== 'string') return null;
  if (b.type !== 'bug' && b.type !== 'wishlist' && b.type !== 'product') return null;
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
  if (b.type === 'bug' && deviceNeedsAppVersion(b.device as DeviceKey)) {
    if (typeof b.appVersion !== 'string' || !b.appVersion.trim()) return null;
    appVersion = b.appVersion.trim().slice(0, 64);
  } else if (typeof b.appVersion === 'string' && b.appVersion.trim()) {
    appVersion = b.appVersion.trim().slice(0, 64);
  }

  if (b.device === 'native_app') {
    const confirmed = b.nativeAppConfirmed === true || b.nativeAppConfirmed === 'true';
    if (!confirmed) return null;
  }

  const photos = Array.isArray(b.photos)
    ? b.photos.filter((p): p is string => typeof p === 'string')
    : [];

  let productSlug: string | undefined;
  let productPhase: number | undefined;
  let featureArea: ProductFeatureArea | undefined;
  if (b.type === 'product') {
    if (typeof b.productSlug !== 'string' || !b.productSlug.trim()) return null;
    if (typeof b.featureArea !== 'string' || !isProductFeatureArea(b.featureArea)) return null;
    productSlug = b.productSlug.trim().toLowerCase();
    productPhase = typeof b.productPhase === 'number' ? b.productPhase : Number(b.productPhase);
    if (productPhase !== 1 && productPhase !== 2 && productPhase !== 3) return null;
    featureArea = b.featureArea;
  }

  return {
    initData: b.initData,
    type: b.type,
    device: b.device,
    browser,
    appVersion,
    title: b.title.trim().slice(0, 200),
    details: b.details.trim().slice(0, 4000),
    ercAddress: b.ercAddress.trim().slice(0, 128) || 'N/A',
    photos,
    productSlug,
    productPhase,
    featureArea,
  };
}

function base64ToArrayBuffer(b64: string): ArrayBuffer {
  const binary = atob(b64.replace(/^data:[^;]+;base64,/, ''));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

export async function handleReportSubmit(
  env: Env,
  raw: unknown,
): Promise<{ ok: true; shortUrl: string; name: string } | { ok: false; error: string; status: number }> {
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

  const maxPhotos = Math.min(Number(env.MAX_PHOTOS ?? '3') || 3, 10);
  const photos = (body.photos ?? []).slice(0, maxPhotos);

  const qaChatId = primaryQaChatId(env) ?? auth.user.id;
  const device = body.device as DeviceKey;
  const browser = body.browser as BrowserKey | undefined;

  let card: { id: string; shortUrl: string; name: string };
  let listLine = 'List: INBOX';

  if (body.type === 'product') {
    const active = await loadActiveProductCampaign(env);
    const slug = body.productSlug!;
    if (!active || active.slug !== slug) {
      return { ok: false, error: 'No product QA campaign is open for that build', status: 400 };
    }
    const def = getProductDefinition(slug);
    if (!def) {
      return { ok: false, error: 'Unknown product', status: 400 };
    }
    const phase = active.phase;
    const productCard = await createProductCard(env, {
      productSlug: slug,
      productLabel: def.label,
      phase,
      featureArea: body.featureArea!,
      device,
      browser,
      appVersion: body.appVersion,
      title: body.title,
      details: body.details,
      ercAddress: body.ercAddress,
      reporterUsername: auth.user.username,
      reporterId: auth.user.id,
      chatId: qaChatId,
    });
    card = productCard;
    listLine = `List: ${productListLabel(env, phase)}`;
  } else {
    card = await createCard(env, {
      type: body.type,
      device,
      browser,
      appVersion: body.appVersion,
      title: body.title,
      details: body.details,
      ercAddress: body.ercAddress,
      reporterUsername: auth.user.username,
      reporterId: auth.user.id,
      chatId: qaChatId,
    });
  }

  await saveCardReporter(env, card.id, {
    reporterId: auth.user.id,
    reporterUsername: auth.user.username,
    reporterFirstName: auth.user.first_name,
    title: body.title,
    cardName: card.name,
  });

  let i = 1;
  for (const photo of photos) {
    try {
      await addAttachment(env, card.id, `screenshot-${i}.jpg`, base64ToArrayBuffer(photo));
      i += 1;
    } catch (error) {
      console.error(
        JSON.stringify({
          event: 'attachment_failed',
          index: i,
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    }
  }

  await announceNewCard(env, {
    type: body.type,
    device,
    browser,
    title: body.title,
    cardName: card.name,
    shortUrl: card.shortUrl,
    reporterUsername: auth.user.username,
    reporterId: auth.user.id,
    reporterFirstName: auth.user.first_name,
    listLine,
    featureArea: body.featureArea,
  });

  try {
    const mention = formatReporterMention({
      reporterId: auth.user.id,
      reporterUsername: auth.user.username,
      reporterFirstName: auth.user.first_name,
    });
    const dmText = formatCardUpdateMessage({
      headline: body.type === 'product' ? 'Your product feedback was saved' : 'Your triage card was created',
      title: body.title,
      boardLine: formatBoardLine(env),
      listLine,
      shortUrl: card.shortUrl,
      createdBy: mention,
    }).join('\n');
    await notifyReporterDm(env, auth.user.id, dmText);
  } catch {
    // DM may be blocked if user never started bot
  }

  return { ok: true, shortUrl: card.shortUrl, name: card.name };
}
