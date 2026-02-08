/**
 * Ramadan overlay UI: render state, tick countdown, show dua on AT_TIME, tap to dismiss, auto-dismiss.
 */
const { getDuaForEvent } = require('../services/duaSelector');
const { getDateKey } = require('../services/monthKey');
const { playEventChime } = require('../services/ramadanSound');

const TITLES = {
  COUNTDOWN_MAGHRIB: 'Maghrib Adhan in',
  ADHAN_MAGHRIB: 'Maghrib Adhan 🌙',
  COUNTDOWN_FAJR: 'Fajr Adhan in',
  ADHAN_FAJR: 'Fajr Adhan',
  COUNTDOWN_TARAWEEH: 'Taraweeh soon 🌙',
  TARAWEEH_NOW: 'Taraweeh time 🌙'
};

let dismissTimeout = null;
let lastState = 'NONE';

function formatCountdown(ms) {
  if (ms == null || ms <= 0) return '00:00';
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function showOverlay(stateResult, dateKey) {
  const el = document.getElementById('ramadan-overlay');
  if (!el) return;
  el.classList.remove('hidden');
  document.body.classList.add('ramadan-overlay-visible');
  updateOverlay(stateResult, dateKey);
}

function hideOverlay(userDismissed) {
  const el = document.getElementById('ramadan-overlay');
  if (el) el.classList.add('hidden');
  document.body.classList.remove('ramadan-overlay-visible');
  if (dismissTimeout) {
    clearTimeout(dismissTimeout);
    dismissTimeout = null;
  }
  if (userDismissed && typeof document !== 'undefined') {
    document.body.dispatchEvent(new CustomEvent('ramadan-overlay-dismissed'));
  }
}

function renderDuaInto(duaEl, eventType, dateKeyForDua) {
  const dua = getDuaForEvent(eventType, dateKeyForDua);
  const arabic = (dua && dua.arabic) ? dua.arabic : (eventType === 'MAGHRIB' ? 'اللهم لك صمت وعلى رزقك أفطرت' : eventType === 'FAJR' ? 'اللهم بك أصبحنا وبك أمسينا' : 'نويت صلاة التراويح لله تعالى');
  const translit = (dua && dua.transliteration) ? dua.transliteration : (eventType === 'MAGHRIB' ? "Allahumma laka sumtu wa 'ala rizqika aftartu" : eventType === 'FAJR' ? "Allahumma bika asbahna wa bika amsayna" : "Nawaytu salat at-taraweeh lillahi ta'ala");
  const ar = document.createElement('span');
  ar.className = 'arabic';
  ar.textContent = arabic;
  duaEl.appendChild(ar);
  const tr = document.createElement('span');
  tr.className = 'transliteration';
  tr.textContent = translit;
  duaEl.appendChild(tr);
}

function updateOverlay(stateResult, dateKey) {
  const { state, eventType, countdownMs, dismissAt } = stateResult || {};
  const titleEl = document.getElementById('overlay-title');
  const mainEl = document.getElementById('overlay-main');
  const countdownEl = document.getElementById('overlay-countdown');
  const duaEl = document.getElementById('overlay-dua');
  const subtitleEl = document.getElementById('overlay-subtitle');

  if (!titleEl || !mainEl) return;

  const isAtTime = state && (state.startsWith('ADHAN_') || state === 'TARAWEEH_NOW');
  if (isAtTime && lastState !== state) {
    playEventChime(eventType);
  }
  lastState = state || 'NONE';

  titleEl.textContent = TITLES[state] || '';
  subtitleEl.textContent = '';

  const dateKeyForDua = dateKey || (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; })();
  const showDuaDuringCountdown = state === 'COUNTDOWN_FAJR' || state === 'COUNTDOWN_TARAWEEH';
  const countdownNum = countdownMs != null ? Number(countdownMs) : 0;

  if (countdownNum > 0) {
    if (countdownEl) {
      countdownEl.style.display = 'block';
      countdownEl.textContent = formatCountdown(Math.floor(countdownNum));
    }
    if (duaEl) {
      if (showDuaDuringCountdown && eventType) {
        duaEl.style.display = 'block';
        duaEl.innerHTML = '';
        renderDuaInto(duaEl, eventType, dateKeyForDua);
      } else {
        duaEl.style.display = 'none';
        duaEl.innerHTML = '';
      }
    }
  } else if (isAtTime && eventType) {
    if (countdownEl) countdownEl.style.display = 'none';
    if (duaEl) {
      duaEl.style.display = 'block';
      duaEl.innerHTML = '';
      renderDuaInto(duaEl, eventType, dateKeyForDua);
    }
  } else {
    if (countdownEl) countdownEl.style.display = 'none';
    if (duaEl) {
      duaEl.style.display = 'none';
      duaEl.innerHTML = '';
    }
  }

  if (dismissAt) {
    if (dismissTimeout) clearTimeout(dismissTimeout);
    const ms = Math.max(0, dismissAt.getTime() - Date.now());
    dismissTimeout = setTimeout(hideOverlay, ms);
  } else if (dismissTimeout) {
    clearTimeout(dismissTimeout);
    dismissTimeout = null;
  }
}

function update(stateResult, dateKey) {
  if (!stateResult || stateResult.state === 'NONE') {
    hideOverlay();
    lastState = 'NONE';
    return;
  }
  showOverlay(stateResult, dateKey);
}

function attachTapToDismiss() {
  const overlay = document.getElementById('ramadan-overlay');
  if (overlay && !overlay._tapAttached) {
    overlay._tapAttached = true;
    overlay.addEventListener('click', () => hideOverlay(true));
  }
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', attachTapToDismiss);
  } else {
    attachTapToDismiss();
  }
}

module.exports = { showOverlay, hideOverlay, updateOverlay, update };
