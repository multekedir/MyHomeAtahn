/**
 * Fetch monthly prayer times from MET Mosque API.
 * Timeout 8–10s; throw on non-200.
 */
const { MASJID_ID, BASE_URL } = require('./masjidConfig');
const { getMonthKey } = require('./monthKey');

const TIMEOUT_MS = 10000;

function buildMonthlyUrl(masjidId, monthKey) {
  return `${BASE_URL}/masjid/${masjidId}/prayer-times/${monthKey}`;
}

function fetchMonthlySchedule(masjidId, monthKey) {
  const url = buildMonthlyUrl(masjidId || MASJID_ID, monthKey);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  return fetch(url, { signal: controller.signal })
    .then((res) => {
      clearTimeout(timeoutId);
      if (!res.ok) throw new Error(`Schedule API ${res.status}: ${res.statusText}`);
      return res.json();
    })
    .catch((err) => {
      clearTimeout(timeoutId);
      throw err;
    });
}

module.exports = { buildMonthlyUrl, fetchMonthlySchedule };
