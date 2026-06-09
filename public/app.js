const tg = window.Telegram?.WebApp;
const fallbackEl = document.getElementById('fallback');
const appMain = document.getElementById('appMain');
const productMain = document.getElementById('productMain');

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

function applyPresetType(value) {
  const type = value === 'idea' ? 'wishlist' : value;
  if (type === 'bug' || type === 'wishlist') {
    const radio = document.querySelector(`input[name="type"][value="${type}"]`);
    if (radio) radio.checked = true;
  }
}

const params = new URLSearchParams(location.search);
applyPresetType(params.get('type'));

const startParam = tg?.initDataUnsafe?.start_param ?? '';
if (startParam && startParam !== 'product' && !startParam.startsWith('product_')) {
  applyPresetType(startParam);
}

function isProductMode() {
  return (
    params.get('mode') === 'product' ||
    startParam === 'product' ||
    startParam.startsWith('product_')
  );
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
  return form.querySelector('input[name="type"]:checked')?.value ?? 'bug';
}

function needsAppVersion() {
  return selectedReportType() === 'bug' && NATIVE_MOBILE_DEVICES.has(deviceSelect.value);
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
    const reportType = data.get('type');

    if (device === NATIVE_APP_DEVICE && data.get('nativeAppConfirmed') !== 'true') {
      openNativeAppModal();
      throw new Error('Please confirm this issue affects both native apps.');
    }

    if (DESKTOP_DEVICES.has(device) && !browser) {
      throw new Error('Please select a browser for Mac or PC.');
    }

    const appVersion = String(data.get('appVersion') ?? '').trim();
    if (reportType === 'bug' && NATIVE_MOBILE_DEVICES.has(device) && !appVersion) {
      setAppVersionInfoOpen(true);
      throw new Error('App version number is required for native app bug reports.');
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

    tg.showAlert('Saved to Trello INBOX. The QA channel has been notified.', () => tg.close());
  } catch (err) {
    if (tg?.HapticFeedback?.notificationOccurred) {
      tg.HapticFeedback.notificationOccurred('error');
    }
    errorEl.textContent = err.message ?? String(err);
    errorEl.hidden = false;
    submitBtn.disabled = false;
    submitBtn.textContent = 'Save to Trello INBOX';
  }
});

const productHubScreen = document.getElementById('productHubScreen');
const productFormScreen = document.getElementById('productFormScreen');
const productCategoryGrid = document.getElementById('productCategoryGrid');
const productHubError = document.getElementById('productHubError');
const productBackBtn = document.getElementById('productBackBtn');
const productForm = document.getElementById('productForm');
const productErrorEl = document.getElementById('productError');
const productSubmitBtn = document.getElementById('productSubmit');
const productAreaInput = document.getElementById('productArea');
const productPhotosInput = document.getElementById('productPhotos');
const productFileLabel = document.getElementById('productFileLabel');
const productAreaBadge = document.getElementById('productAreaBadge');
const productFormHeading = document.getElementById('productFormHeading');
const productFormSubtitle = document.getElementById('productFormSubtitle');

let productState = { displayName: '', areas: [] };
let selectedArea = null;

productPhotosInput?.addEventListener('change', () => {
  const n = productPhotosInput.files?.length ?? 0;
  productFileLabel.textContent =
    n === 0 ? 'No files selected' : n === 1 ? '1 file selected' : `${n} files selected`;
});

function showProductHub() {
  productHubScreen.hidden = false;
  productFormScreen.hidden = true;
  productErrorEl.hidden = true;
}

function showProductForm(area) {
  selectedArea = area;
  productAreaInput.value = area.id;
  productAreaBadge.textContent = `${area.icon} ${area.label}`;
  productFormHeading.textContent = area.label;
  productFormSubtitle.textContent = area.hint ?? 'Add your notes for this area.';
  productSubmitBtn.textContent = `Add to ${area.label}`;
  productSubmitBtn.disabled = false;
  productHubScreen.hidden = true;
  productFormScreen.hidden = false;
  productErrorEl.hidden = true;
  document.getElementById('productTitle')?.focus();
}

function resetProductForm() {
  productForm?.reset();
  productAreaInput.value = selectedArea?.id ?? '';
  productFileLabel.textContent = 'No files selected';
  productSubmitBtn.disabled = false;
  productSubmitBtn.textContent = selectedArea ? `Add to ${selectedArea.label}` : 'Add feedback';
}

function renderProductTiles(areas) {
  productCategoryGrid.innerHTML = '';
  for (const area of areas) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'product-category-tile';
    btn.setAttribute('role', 'listitem');
    btn.innerHTML = `
      <span class="product-category-icon" aria-hidden="true">${area.icon ?? '•'}</span>
      <span class="product-category-label">${area.label}</span>
      <span class="product-category-hint">${area.hint ?? ''}</span>
    `;
    btn.addEventListener('click', () => {
      if (tg?.HapticFeedback?.impactOccurred) tg.HapticFeedback.impactOccurred('light');
      showProductForm(area);
    });
    productCategoryGrid.appendChild(btn);
  }
}

productBackBtn?.addEventListener('click', () => {
  resetProductForm();
  showProductHub();
});

async function initProductMode() {
  const res = await fetch('/api/product-active');
  const json = await res.json();
  if (!res.ok || !json.ok) {
    throw new Error(json.error ?? 'Product feedback is not open');
  }

  productState = { displayName: json.displayName, areas: json.areas };
  appMain.hidden = true;
  productMain.hidden = false;
  showProductHub();

  const brandTitle = document.getElementById('brandTitle');
  const topBadge = document.getElementById('topBadge');
  const productHeading = document.getElementById('productHeading');
  const productEyebrow = document.getElementById('productEyebrow');
  const productSubtitle = document.getElementById('productSubtitle');
  if (brandTitle) brandTitle.textContent = `WLTH · ${json.displayName}`;
  if (topBadge) topBadge.textContent = 'Product';
  if (productHeading) productHeading.textContent = `${json.displayName}`;
  if (productEyebrow) productEyebrow.textContent = 'One shared Trello card';
  if (productSubtitle) {
    productSubtitle.textContent =
      'Tap a feature area. Your note lands in that checklist — not a new card.';
  }

  renderProductTiles(json.areas);

  const deepArea = params.get('area');
  if (deepArea) {
    const match = json.areas.find((a) => a.id === deepArea);
    if (match) showProductForm(match);
  }
}

productForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  productErrorEl.hidden = true;
  productSubmitBtn.disabled = true;
  productSubmitBtn.textContent = 'Saving…';
  if (tg?.HapticFeedback?.impactOccurred) tg.HapticFeedback.impactOccurred('light');

  try {
    if (!tg?.initData) {
      throw new Error('Open this form from Telegram (@WLTH_Triage_Bot).');
    }

    const data = new FormData(productForm);
    const photos = [];
    const files = [...(productPhotosInput.files ?? [])].slice(0, 3);
    for (const file of files) {
      photos.push(await fileToBase64(file));
    }

    const body = {
      initData: tg.initData,
      area: data.get('area'),
      title: data.get('title'),
      details: data.get('details'),
      photos,
    };
    const device = String(data.get('device') ?? '').trim();
    if (device) body.device = device;

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

    const label = json.areaLabel ?? selectedArea?.label ?? 'product';
    tg.showAlert(`Added to ${label} (#${json.itemNumber}).`, () => {
      resetProductForm();
      showProductHub();
    });
  } catch (err) {
    if (tg?.HapticFeedback?.notificationOccurred) {
      tg.HapticFeedback.notificationOccurred('error');
    }
    productErrorEl.textContent = err.message ?? String(err);
    productErrorEl.hidden = false;
    productSubmitBtn.disabled = false;
    productSubmitBtn.textContent = selectedArea ? `Add to ${selectedArea.label}` : 'Add feedback';
  }
});

if (tg?.initData && isProductMode()) {
  initProductMode().catch((err) => {
    appMain.hidden = true;
    productMain.hidden = false;
    productHubScreen.hidden = false;
    productFormScreen.hidden = true;
    productHubError.textContent = err.message ?? String(err);
    productHubError.hidden = false;
  });
}
