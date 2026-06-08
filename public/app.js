const tg = window.Telegram?.WebApp;
const fallbackEl = document.getElementById('fallback');
const appMain = document.getElementById('appMain');
const heroDefault = document.getElementById('heroDefault');
const heroProduct = document.getElementById('heroProduct');
const productEyebrow = document.getElementById('productEyebrow');
const productTitle = document.getElementById('productTitle');
const productGoal = document.getElementById('productGoal');
const typeSection = document.getElementById('typeSection');
const featureAreaSection = document.getElementById('featureAreaSection');
const featureAreaSelect = document.getElementById('featureArea');

/** WLTH-branded chrome inside Telegram (header / background). */
function applyWlthTheme() {
  if (!tg) return;
  const header = '#5c4fd1';
  const bg = '#f0edf8';
  if (tg.setHeaderColor) tg.setHeaderColor(header);
  if (tg.setBackgroundColor) tg.setBackgroundColor(bg);
  if (tg.setBottomBarColor) tg.setBottomBarColor('#ffffff');
  if (tg.enableClosingConfirmation) tg.enableClosingConfirmation();
}

if (!tg?.initData) {
  fallbackEl.hidden = false;
  appMain.hidden = true;
} else {
  tg.ready();
  tg.expand();
  applyWlthTheme();
}

const productContext = {
  mode: false,
  slug: '',
  label: '',
  phase: 1,
};

function parseProductSlug(raw) {
  if (!raw) return null;
  const value = String(raw).trim().toLowerCase();
  if (value.startsWith('product_')) return value.slice('product_'.length);
  if (value === 'product') return null;
  return null;
}

function applyPresetType(value) {
  const type = value === 'idea' ? 'wishlist' : value;
  if (type === 'bug' || type === 'wishlist') {
    const radio = document.querySelector(`input[name="type"][value="${type}"]`);
    if (radio) radio.checked = true;
  }
}

const params = new URLSearchParams(location.search);
applyPresetType(params.get('type'));

const startParam = tg?.initDataUnsafe?.start_param;
if (startParam && !startParam.startsWith('product_')) {
  applyPresetType(startParam);
}

const form = document.getElementById('form');
const errorEl = document.getElementById('error');
const submitBtn = document.getElementById('submit');
const ercNa = document.getElementById('ercNa');
const ercInput = document.getElementById('ercInput');
const photosInput = document.getElementById('photos');
const fileLabel = document.getElementById('fileLabel');
const deviceSelect = document.getElementById('device');
const browserSection = document.getElementById('browserSection');
const browserSelect = document.getElementById('browser');
const appVersionSection = document.getElementById('appVersionSection');
const appVersionInput = document.getElementById('appVersion');
const appVersionInfo = document.getElementById('appVersionInfo');
const appVersionInfoTip = document.getElementById('appVersionInfoTip');
const nativeAppConfirmedInput = document.getElementById('nativeAppConfirmed');
const nativeAppModal = document.getElementById('nativeAppModal');
const nativeAppConfirmCheck = document.getElementById('nativeAppConfirmCheck');
const nativeAppModalContinue = document.getElementById('nativeAppModalContinue');
const nativeAppModalCancel = document.getElementById('nativeAppModalCancel');
const nativeAppModalBackdrop = document.getElementById('nativeAppModalBackdrop');

const DESKTOP_DEVICES = new Set(['apple_laptop', 'pc']);
const NATIVE_MOBILE_DEVICES = new Set(['android', 'iphone', 'native_app']);
const NATIVE_APP_DEVICE = 'native_app';

function setAppVersionInfoOpen(open) {
  if (!appVersionInfo || !appVersionInfoTip) return;
  appVersionInfo.setAttribute('aria-expanded', open ? 'true' : 'false');
  appVersionInfoTip.hidden = !open;
}

function setNativeAppConfirmed(confirmed) {
  nativeAppConfirmedInput.value = confirmed ? 'true' : '';
}

function openNativeAppModal() {
  nativeAppConfirmCheck.checked = false;
  nativeAppModalContinue.disabled = true;
  setNativeAppConfirmed(false);
  nativeAppModal.hidden = false;
  document.body.style.overflow = 'hidden';
}

function closeNativeAppModal(revertDevice) {
  nativeAppModal.hidden = true;
  document.body.style.overflow = '';
  if (revertDevice) {
    deviceSelect.value = deviceSelect.dataset.lastValue || 'iphone';
    setNativeAppConfirmed(false);
    syncBrowserField();
  }
}

function confirmNativeAppModal() {
  setNativeAppConfirmed(true);
  deviceSelect.dataset.lastValue = NATIVE_APP_DEVICE;
  nativeAppModal.hidden = true;
  document.body.style.overflow = '';
  syncBrowserField();
}

function selectedReportType() {
  if (productContext.mode) return 'product';
  return form.querySelector('input[name="type"]:checked')?.value ?? 'bug';
}

function needsAppVersion() {
  const reportType = selectedReportType();
  return (reportType === 'bug' || reportType === 'product') && NATIVE_MOBILE_DEVICES.has(deviceSelect.value);
}

function syncAppVersionField() {
  const show = needsAppVersion();
  appVersionSection.hidden = !show;
  appVersionInput.required = show;
  appVersionInput.setAttribute('aria-required', show ? 'true' : 'false');
  if (!show) {
    appVersionInput.value = '';
    setAppVersionInfoOpen(false);
  }
}

function syncBrowserField() {
  const needsBrowser = DESKTOP_DEVICES.has(deviceSelect.value);
  browserSection.hidden = !needsBrowser;
  browserSelect.required = needsBrowser;
  if (!needsBrowser) {
    browserSelect.value = '';
  }

  if (deviceSelect.value !== NATIVE_APP_DEVICE) {
    setNativeAppConfirmed(false);
  }

  syncAppVersionField();
}

function applyProductMode(ctx) {
  productContext.mode = true;
  productContext.slug = ctx.slug;
  productContext.label = ctx.label;
  productContext.phase = ctx.phase;

  heroDefault.hidden = true;
  heroProduct.hidden = false;
  typeSection.hidden = true;
  featureAreaSection.hidden = false;
  featureAreaSelect.required = true;

  productEyebrow.textContent = `${ctx.label} · Phase ${ctx.phase}`;
  productTitle.textContent = 'Product feedback';
  productGoal.textContent = ctx.phaseGoal || ctx.phaseTitle || 'Tell us what you found on this build.';
  submitBtn.textContent = 'Save product feedback';

  featureAreaSelect.innerHTML = '<option value="">Select area…</option>';
  for (const area of ctx.featureAreas ?? []) {
    const opt = document.createElement('option');
    opt.value = area.id;
    opt.textContent = area.label;
    featureAreaSelect.appendChild(opt);
  }

  syncAppVersionField();
}

async function initProductMode() {
  const fromStart = parseProductSlug(startParam);
  const fromQuery = params.get('product');
  const slug = fromStart || fromQuery;
  if (!slug && startParam !== 'product') return;

  try {
    const url = slug ? `/api/product/active?slug=${encodeURIComponent(slug)}` : '/api/product/active';
    const res = await fetch(url);
    const json = await res.json();
    if (!res.ok || !json.ok) {
      throw new Error(json.error ?? 'Product QA is not open');
    }
    applyProductMode(json);
  } catch (err) {
    errorEl.textContent = err.message ?? String(err);
    errorEl.hidden = false;
  }
}

deviceSelect.addEventListener('change', () => {
  const next = deviceSelect.value;
  if (next === NATIVE_APP_DEVICE) {
    openNativeAppModal();
    return;
  }
  deviceSelect.dataset.lastValue = next;
  syncBrowserField();
});

deviceSelect.dataset.lastValue = deviceSelect.value;

document.querySelectorAll('input[name="type"]').forEach((radio) => {
  radio.addEventListener('change', syncAppVersionField);
});

if (appVersionInfo && appVersionInfoTip) {
  appVersionInfo.addEventListener('click', () => {
    const open = appVersionInfo.getAttribute('aria-expanded') !== 'true';
    setAppVersionInfoOpen(open);
  });
}

nativeAppConfirmCheck.addEventListener('change', () => {
  nativeAppModalContinue.disabled = !nativeAppConfirmCheck.checked;
});

nativeAppModalContinue.addEventListener('click', () => {
  if (!nativeAppConfirmCheck.checked) return;
  confirmNativeAppModal();
});

nativeAppModalCancel.addEventListener('click', () => closeNativeAppModal(true));
nativeAppModalBackdrop.addEventListener('click', () => closeNativeAppModal(true));

syncBrowserField();
void initProductMode();

ercNa.addEventListener('change', () => {
  ercInput.disabled = ercNa.checked;
  if (ercNa.checked) ercInput.value = '';
});

photosInput.addEventListener('change', () => {
  const n = photosInput.files?.length ?? 0;
  fileLabel.textContent =
    n === 0 ? 'No files selected' : n === 1 ? '1 file selected' : `${n} files selected`;
});

async function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  errorEl.hidden = true;
  submitBtn.disabled = true;
  submitBtn.textContent = 'Saving…';
  if (tg?.HapticFeedback?.impactOccurred) tg.HapticFeedback.impactOccurred('light');

  try {
    if (!tg?.initData) {
      throw new Error('Open this form from Telegram (@WLTH_Triage_Bot).');
    }

    const data = new FormData(form);
    const photos = [];
    const files = [...(photosInput.files ?? [])].slice(0, 3);
    for (const file of files) {
      photos.push(await fileToBase64(file));
    }

    const device = data.get('device');
    const browser = data.get('browser');
    const reportType = selectedReportType();

    if (device === NATIVE_APP_DEVICE && data.get('nativeAppConfirmed') !== 'true') {
      openNativeAppModal();
      throw new Error('Please confirm this issue affects both native apps.');
    }

    if (DESKTOP_DEVICES.has(device) && !browser) {
      throw new Error('Please select a browser for Mac or PC.');
    }

    const appVersion = String(data.get('appVersion') ?? '').trim();
    if (needsAppVersion() && !appVersion) {
      setAppVersionInfoOpen(true);
      throw new Error('App version number is required for native app reports.');
    }

    const featureArea = data.get('featureArea');
    if (reportType === 'product' && !featureArea) {
      throw new Error('Please select which feature area your feedback is about.');
    }

    const body = {
      initData: tg.initData,
      type: reportType,
      device,
      title: data.get('title'),
      details: data.get('details'),
      ercAddress: ercNa.checked ? 'N/A' : (data.get('ercAddress') || 'N/A'),
      photos,
    };
    if (browser) body.browser = browser;
    if (appVersion) body.appVersion = appVersion;
    if (device === NATIVE_APP_DEVICE) body.nativeAppConfirmed = true;
    if (reportType === 'product') {
      body.productSlug = productContext.slug;
      body.productPhase = productContext.phase;
      body.featureArea = featureArea;
    }

    const res = await fetch('/api/report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const json = await res.json();
    if (!res.ok || !json.ok) {
      throw new Error(json.error ?? 'Submit failed');
    }

    if (tg.HapticFeedback?.notificationOccurred) {
      tg.HapticFeedback.notificationOccurred('success');
    }

    const successMsg = reportType === 'product'
      ? 'Product feedback saved. The QA channel has been notified.'
      : 'Saved to Trello INBOX. The QA channel has been notified.';
    tg.showAlert(successMsg, () => tg.close());
  } catch (err) {
    if (tg?.HapticFeedback?.notificationOccurred) {
      tg.HapticFeedback.notificationOccurred('error');
    }
    errorEl.textContent = err.message ?? String(err);
    errorEl.hidden = false;
    submitBtn.disabled = false;
    submitBtn.textContent = productContext.mode ? 'Save product feedback' : 'Save to Trello INBOX';
  }
});
