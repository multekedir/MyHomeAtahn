/**
 * Orchestrator: get month schedule from cache or fetch, then return normalized.
 */
const { MASJID_ID } = require('./masjidConfig');
const { getMonthKey } = require('./monthKey');
const { fetchMonthlySchedule } = require('./masjidScheduleClient');
const { normalizeMonth } = require('./masjidScheduleNormalizer');
const { loadNormalized, saveMonth } = require('./masjidScheduleCache');

async function getMonthSchedule(masjidId, date) {
  const id = masjidId || MASJID_ID;
  const monthKey = getMonthKey(date);

  const cached = loadNormalized(id, monthKey);
  if (cached && cached.monthKey === monthKey) return cached;

  const raw = await fetchMonthlySchedule(id, monthKey);
  if (!raw || !raw.ok) throw new Error('Invalid schedule response');
  const normalized = normalizeMonth(raw, monthKey, id);
  saveMonth(id, monthKey, normalized);
  return normalized;
}

module.exports = { getMonthSchedule };
