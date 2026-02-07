/**
 * Resolve today's prayer times and next prayer from normalized month.
 */
const { getDateKey } = require('./monthKey');
const { PRAYER_KEYS } = require('./masjidScheduleNormalizer');

function getTodayPrayerTimes(date, month) {
  if (!month || !month.days) return null;
  const dateKey = getDateKey(date);
  return month.days[dateKey] || null;
}

/** Parse "5:26 PM" or "17:26" into today's Date (same day as refDate) for comparison */
function parseTimeToDate(timeStr, refDate) {
  if (!timeStr) return null;
  const d = new Date(refDate);
  const match = String(timeStr).trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!match) return null;
  let h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  const ampm = (match[3] || '').toUpperCase();
  if (ampm === 'PM' && h < 12) h += 12;
  if (ampm === 'AM' && h === 12) h = 0;
  d.setHours(h, m, 0, 0);
  return d;
}

function getNextPrayer(now, today) {
  if (!today) return null;
  const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  for (const key of PRAYER_KEYS) {
    const row = today[key];
    if (!row) continue;
    const adhanDate = parseTimeToDate(row.adhan, todayDate);
    if (adhanDate && now < adhanDate) {
      return { key, when: adhanDate, type: 'adhan', label: key.charAt(0).toUpperCase() + key.slice(1) };
    }
  }
  return null;
}

module.exports = { getTodayPrayerTimes, getNextPrayer, parseTimeToDate };
