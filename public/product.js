const tg = window.Telegram?.WebApp;
const fallbackEl = document.getElementById('fallback');
const appMain = document.getElementById('appMain');
const form = document.getElementById('form');
const errorEl = document.getElementById('error');
const submitBtn = document.getElementById('submit');
const productTitle = document.getElementById('productTitle');
const productEyebrow = document.getElementById('productEyebrow');
const productSubtitle = document.getElementById('productSubtitle');
const productBadge = document.getElementById('productBadge');
const featureAreaSelect = document.getElementById('featureArea');
const featureHint = document.getElementById('featureHint');

function applyWlthTheme() {
  if (!tg) return;
  const header = '#5c4fd1';
  const bg = '#f0edf8';
  if (tg.setHeaderColor) tg.setHeaderColor(header);
  if (tg.setBackgroundColor) tg.setBackgroundColor(bg);
  if (tg.setBottomBarColor) tg.setBottomBarColor('#ffffff');
  if (tg.enableClosingConfirmation) tg.enableClosingConfirmation();
}

function resolveProductSlug() {
  const params = new URLSearchParams(location.search);
  const fromQuery = params.get('product');
  if (fromQuery) return fromQuery.toLowerCase();

  const startParam = tg?.initDataUnsafe?.start_param ?? '';
  if (startParam.startsWith('product_')) {
    return startParam.slice('product_'.length).toLowerCase();
  }
  return 'marketplace';
}

const productSlug = resolveProductSlug();

if (!tg?.initData) {
  fallbackEl.hidden = false;
  appMain.hidden = true;
} else {
  tg.ready();
  tg.expand();
  applyWlthTheme();
}

const ercNa = document.getElementById('ercNa');
const ercInput = document.getElementById('ercInput');
const photosInput = document.getElementById('photos');
const fileLabel = document.getElementById('fileLabel');
const deviceSelect = document.getElementById('device');
const browserSection = document.getElementById('browserSection');
const browserSelect = document.getElementById('browser');
const appVersionInput = document.getElementById('appVersion');
const nativeAppConfirmedInput = document.getElementById('nativeAppConfirmed');
const nativeAppModal = document.getElementById('nativeAppModal');
const nativeAppConfirmCheck = document.getElementById('nativeAppConfirmCheck');
const nativeAppModalContinue = document.getElementById('nativeAppModalContinue');
const nativeAppModalCancel = document.getElementById('nativeAppModalCancel');
const nativeAppModalBackdrop = document.getElementById('nativeAppModalBackdrop');

const DESKTOP_DEVICES = new Set(['apple_laptop', 'pc']);
const NATIVE_APP_DEVICE = 'native_app';

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

function syncBrowserField() {
  const needsBrowser = DESKTOP_DEVICES.has(deviceSelect.value);
  browserSection.hidden = !needsBrowser;
  browserSelect.required = needsBrowser;
  if (!needsBrowser) browserSelect.value = '';
  if (deviceSelect.value !== NATIVE_APP_DEVICE) setNativeAppConfirmed(false);
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

nativeAppConfirmCheck.addEventListener('change', () => {
  nativeAppModalContinue.disabled = !nativeAppConfirmCheck.checked;
});

nativeAppModalContinue.addEventListener('click', () => {
  if (!nativeAppConfirmCheck.checked) return;
  confirmNativeAppModal();
});

nativeAppModalCancel.addEventListener('click', () => closeNativeAppModal(true));
nativeAppModalBackdrop.addEventListener('click', () => closeNativeAppModal(true));

ercNa.addEventListener('change', () => {
  ercInput.disabled = ercNa.checked;
  if (ercNa.checked) ercInput.value = '';
});

photosInput.addEventListener('change', () => {
  const n = photosInput.files?.length ?? 0;
  fileLabel.textContent =
    n === 0 ? 'No files selected' : n === 1 ? '1 file selected' : `${n} files selected`;
});

featureAreaSelect.addEventListener('change', () => {
  const option = featureAreaSelect.selectedOptions[0];
  const note = option?.dataset.note;
  if (note) {
    featureHint.textContent = note;
    featureHint.hidden = false;
  } else {
    featureHint.hidden = true;
  }
});

async function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function statusPrefix(status) {
  if (status === 'preview') return 'Preview · ';
  if (status === 'coming_soon') return 'Soon · ';
  return '';
}

async function loadProductConfig() {
  const res = await fetch(`/api/product/${encodeURIComponent(productSlug)}`);
  const json = await res.json();
  if (!res.ok || !json.ok) {
    throw new Error(json.error ?? 'Could not load product config');
  }
  if (!json.active) {
    throw new Error(`${json.displayName} feedback is not open yet. Ask an admin to run /product ${productSlug}.`);
  }

  productTitle.textContent = `${json.displayName} feedback`;
  productEyebrow.textContent = `${json.displayName} build`;
  productBadge.textContent = json.displayName;
  productSubtitle.textContent =
    'Pick the feature you tested. Your note joins the shared product card on Trello.';

  featureAreaSelect.innerHTML = '<option value="">Select feature…</option>';
  for (const feature of json.featureAreas) {
    const option = document.createElement('option');
    option.value = feature.id;
    option.textContent = `${statusPrefix(feature.status)}${feature.label}`;
    if (feature.note) option.dataset.note = feature.note;
    if (feature.status === 'coming_soon') option.disabled = true;
    featureAreaSelect.appendChild(option);
  }

  form.hidden = false;
  submitBtn.disabled = false;
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

    if (device === NATIVE_APP_DEVICE && data.get('nativeAppConfirmed') !== 'true') {
      openNativeAppModal();
      throw new Error('Please confirm this applies to both native apps.');
    }

    if (DESKTOP_DEVICES.has(device) && !browser) {
      throw new Error('Please select a browser for Mac or PC.');
    }

    const body = {
      initData: tg.initData,
      product: productSlug,
      featureArea: data.get('featureArea'),
      feedbackType: data.get('feedbackType'),
      device,
      title: data.get('title'),
      details: data.get('details'),
      ercAddress: ercNa.checked ? 'N/A' : (data.get('ercAddress') || 'N/A'),
      photos,
    };
    if (browser) body.browser = browser;
    const appVersion = String(data.get('appVersion') ?? '').trim();
    if (appVersion) body.appVersion = appVersion;
    if (device === NATIVE_APP_DEVICE) body.nativeAppConfirmed = true;

    const res = await fetch('/api/product-feedback', {
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

    tg.showAlert('Added to the product feedback card. The QA channel has been notified.', () =>
      tg.close(),
    );
  } catch (err) {
    if (tg?.HapticFeedback?.notificationOccurred) {
      tg.HapticFeedback.notificationOccurred('error');
    }
    errorEl.textContent = err.message ?? String(err);
    errorEl.hidden = false;
    submitBtn.disabled = false;
    submitBtn.textContent = 'Add to product card';
  }
});

syncBrowserField();

if (tg?.initData) {
  loadProductConfig().catch((err) => {
    productTitle.textContent = 'Product feedback unavailable';
    productSubtitle.textContent = err.message ?? String(err);
    errorEl.textContent = err.message ?? String(err);
    errorEl.hidden = false;
  });
}
