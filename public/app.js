const tg = window.Telegram?.WebApp;
const fallbackEl = document.getElementById('fallback');
const appMain = document.getElementById('appMain');

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

const startParam = tg?.initDataUnsafe?.start_param;
if (startParam) applyPresetType(startParam);

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

const DESKTOP_DEVICES = new Set(['apple_laptop', 'pc']);

function syncBrowserField() {
  const needsBrowser = DESKTOP_DEVICES.has(deviceSelect.value);
  browserSection.hidden = !needsBrowser;
  browserSelect.required = needsBrowser;
  if (!needsBrowser) {
    browserSelect.value = '';
  }
}

deviceSelect.addEventListener('change', syncBrowserField);
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
    if (DESKTOP_DEVICES.has(device) && !browser) {
      throw new Error('Please select a browser for Mac or PC.');
    }

    const body = {
      initData: tg.initData,
      type: data.get('type'),
      device,
      title: data.get('title'),
      details: data.get('details'),
      ercAddress: ercNa.checked ? 'N/A' : (data.get('ercAddress') || 'N/A'),
      photos,
    };
    if (browser) body.browser = browser;

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
