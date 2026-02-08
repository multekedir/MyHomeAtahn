/**
 * Get today's Ramadan overlay trigger times: Maghrib adhan, next Fajr adhan, Isha iqama (MET).
 */
const { parseTimeToDate } = require('./prayerTimesResolver');

/**
 * @param {object} calculator - PrayerCalculator instance (with calculatePrayerTimes)
 * @param {object | null} metToday - today's MET day { fajr, dhuhr, asr, maghrib, isha } with .adhan/.iqama
 * @returns {{ maghribAdhan: Date, fajrAdhan: Date, ishaIqama: Date | null }}
 */
function getTodayRamadanTimes(calculator, metToday) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const times = calculator.calculatePrayerTimes(now);
  if (!times) {
    return { maghribAdhan: new Date(0), fajrAdhan: new Date(0), ishaIqama: null };
  }

  const maghribAdhan = times.maghrib;

  let fajrAdhan = times.fajr;
  if (now >= times.fajr) {
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowTimes = calculator.calculatePrayerTimes(tomorrow);
    if (tomorrowTimes) fajrAdhan = tomorrowTimes.fajr;
  }

  let ishaIqama = null;
  if (metToday && metToday.isha && metToday.isha.iqama) {
    ishaIqama = parseTimeToDate(metToday.isha.iqama, today);
  }

  return { maghribAdhan, fajrAdhan, ishaIqama };
}

module.exports = { getTodayRamadanTimes };
