/**
 * Normalize MET Mosque API response into app format.
 * API: { ok, masjid, yearMonth, days: [ { day, date, fajr: { adhan, iqama }, duhr, asr, maghrib, isha } ] }
 * We map duhr → dhuhr and build days keyed by YYYY-MM-DD.
 */

const PRAYER_KEYS = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];
const API_TO_OUR = { duhr: 'dhuhr' };

function normalizeDay(rawDay, yearMonth) {
  const day = String(rawDay.day || '').padStart(2, '0');
  const dateKey = `${yearMonth}-${day}`;
  const out = { fajr: {}, dhuhr: {}, asr: {}, maghrib: {}, isha: {} };

  ['fajr', 'duhr', 'asr', 'maghrib', 'isha'].forEach((apiKey) => {
    const ourKey = API_TO_OUR[apiKey] || apiKey;
    const p = rawDay[apiKey];
    if (p && typeof p === 'object') {
      out[ourKey] = {
        adhan: p.adhan ? String(p.adhan).trim() : null,
        iqama: p.iqama ? String(p.iqama).trim() : null
      };
    } else {
      out[ourKey] = { adhan: null, iqama: null };
    }
  });

  return out;
}

function normalizeMonth(raw, monthKey, masjidId) {
  const yearMonth = monthKey || raw.yearMonth || '';
  const days = {};
  const dayList = raw.days || [];

  dayList.forEach((rawDay) => {
    const day = String(rawDay.day || '').padStart(2, '0');
    const dateKey = `${yearMonth}-${day}`;
    days[dateKey] = normalizeDay(rawDay, yearMonth);
  });

  return {
    monthKey: yearMonth,
    days,
    source: {
      masjidId: masjidId || (raw.masjid && raw.masjid.id) || '',
      fetchedAt: new Date().toISOString()
    }
  };
}

module.exports = { normalizeMonth, normalizeDay, PRAYER_KEYS };
