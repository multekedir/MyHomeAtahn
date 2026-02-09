const PrayTimes = require('./PrayTimes.js');
const hijriConverter = require('hijri-converter');

/** Map app calculation method names to PrayTimes.METHODS keys */
const METHOD_MAP = {
  MuslimWorldLeague: 'MWL',
  ISNA: 'ISNA',
  Egyptian: 'Egypt',
  UmmAlQura: 'Makkah',
  Karachi: 'Karachi',
  Tehran: 'Tehran',
  Jafari: 'Jafari',
  MoonsightingCommittee: 'MoonsightingCommittee',
};

/**
 * Get calendar date (year, month, day) for a moment in a given IANA timezone.
 */
function getDateInTimezone(now, timezone) {
  if (!timezone) {
    return {
      year: now.getFullYear(),
      month: now.getMonth() + 1,
      day: now.getDate(),
    };
  }
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
    });
    const parts = formatter.formatToParts(now);
    const get = (type) => parseInt(parts.find((p) => p.type === type)?.value ?? 0, 10);
    return {
      year: get('year'),
      month: get('month'),
      day: get('day'),
    };
  } catch (e) {
    return {
      year: now.getFullYear(),
      month: now.getMonth() + 1,
      day: now.getDate(),
    };
  }
}

/**
 * Convert PrayTimes float hour (local time in that timezone) to a Date (UTC moment).
 */
function floatToDate(year, month, day, floatHour, tzOffsetHours) {
  const ms = Math.round(
    Date.UTC(year, month - 1, day, 0, 0, 0, 0) + (floatHour - tzOffsetHours) * 3600000
  );
  return new Date(ms);
}

class PrayerCalculator {
  constructor() {
    this.settings = null;
    this.prayerTimes = null;
    this.today = new Date();
    this.updateInterval = null;
  }

  async loadSettings() {
    try {
      const response = await fetch('http://localhost:3000/api/settings');
      this.settings = await response.json();
      return this.settings;
    } catch (error) {
      console.error('Error loading settings:', error);
      this.settings = {
        location: {
          latitude: 45.4619489360556,
          longitude: -122.80151735583487,
        },
        calculationMethod: 'MuslimWorldLeague',
        timeAdjustments: {
          fajr: 0,
          dhuhr: 0,
          asr: 0,
          maghrib: 0,
          isha: 0,
        },
      };
      return this.settings;
    }
  }

  getPrayTimesMethod() {
    const name = this.settings?.calculationMethod || 'MuslimWorldLeague';
    return METHOD_MAP[name] || 'MWL';
  }

  calculatePrayerTimes(date = null) {
    if (!this.settings) {
      console.error('Settings not loaded');
      return null;
    }

    const targetDate = date || new Date();
    const tz = this.settings.location?.timezone || undefined;
    const { year, month, day } = getDateInTimezone(targetDate, tz);

    const lat = this.settings.location.latitude;
    const lng = this.settings.location.longitude;
    const elv = this.settings.location.elevation != null ? this.settings.location.elevation : 0;
    const coords = [lat, lng];
    if (elv) coords.push(elv);

    const method = this.getPrayTimesMethod();
    const pt = new PrayTimes(method);

    const adjustments = this.settings.timeAdjustments || {};
    pt.tune({
      fajr: adjustments.fajr || 0,
      dhuhr: adjustments.dhuhr || 0,
      asr: adjustments.asr || 0,
      maghrib: adjustments.maghrib || 0,
      isha: adjustments.isha || 0,
    });

    const timezoneInput = tz != null && tz !== '' ? tz : -new Date().getTimezoneOffset() / 60;
    const raw = pt.getTimes([year, month, day], coords, timezoneInput, 0, 'Float');

    const tzOffset = pt.timeZone;
    const toDate = (floatHour) => floatToDate(year, month, day, floatHour, tzOffset);

    return {
      fajr: toDate(raw.fajr),
      dhuhr: toDate(raw.dhuhr),
      asr: toDate(raw.asr),
      maghrib: toDate(raw.maghrib),
      isha: toDate(raw.isha),
    };
  }

  getNextPrayer() {
    if (!this.prayerTimes) {
      this.prayerTimes = this.calculatePrayerTimes();
    }
    if (!this.prayerTimes) return null;

    const now = new Date();
    const prayers = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];

    const today = new Date();
    if (
      today.getDate() !== this.today.getDate() ||
      today.getMonth() !== this.today.getMonth() ||
      today.getFullYear() !== this.today.getFullYear()
    ) {
      this.today = today;
      this.prayerTimes = this.calculatePrayerTimes();
    }

    for (let prayer of prayers) {
      if (this.prayerTimes[prayer] > now) {
        const diff = this.prayerTimes[prayer].getTime() - now.getTime();
        return {
          name: prayer,
          time: this.prayerTimes[prayer],
          countdown: this.formatCountdown(diff),
        };
      }
    }

    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    const tomorrowPrayers = this.calculatePrayerTimes(tomorrow);

    const diff = tomorrowPrayers.fajr.getTime() - now.getTime();
    return {
      name: 'fajr',
      time: tomorrowPrayers.fajr,
      countdown: this.formatCountdown(diff),
    };
  }

  formatCountdown(milliseconds) {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  formatTime(date, format24 = false) {
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';

    if (format24) {
      return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    } else {
      const displayHours = hours % 12 || 12;
      return `${displayHours}:${String(minutes).padStart(2, '0')} ${ampm}`;
    }
  }

  getTimePartsInZone(date, timeZone) {
    if (!timeZone) {
      return { hour: date.getHours(), minute: date.getMinutes(), second: date.getSeconds() };
    }
    try {
      const f = new Intl.DateTimeFormat('en-CA', {
        timeZone,
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
      const parts = f.formatToParts(date);
      const get = (t) => parseInt(parts.find((p) => p.type === t)?.value ?? 0, 10);
      return { hour: get('hour'), minute: get('minute'), second: get('second') };
    } catch (e) {
      return { hour: date.getHours(), minute: date.getMinutes(), second: date.getSeconds() };
    }
  }

  isPrayerTime(prayerName, timeZone = undefined) {
    if (!this.prayerTimes) return false;

    const now = new Date();
    const prayerTime = this.prayerTimes[prayerName];
    const nowParts = this.getTimePartsInZone(now, timeZone);
    const prayerParts = this.getTimePartsInZone(prayerTime, timeZone);

    return (
      nowParts.hour === prayerParts.hour &&
      nowParts.minute === prayerParts.minute &&
      nowParts.second === 0
    );
  }

  getCompletedPrayers() {
    if (!this.prayerTimes) return [];

    const now = new Date();
    const prayers = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];
    const completed = [];

    for (let prayer of prayers) {
      if (this.prayerTimes[prayer] < now) {
        completed.push(prayer);
      }
    }

    return completed;
  }

  getPrayerWarning(nextPrayer) {
    if (!nextPrayer) return null;

    const now = new Date();
    const timeUntil = nextPrayer.time.getTime() - now.getTime();
    const minutesUntil = Math.floor(timeUntil / 60000);

    if (minutesUntil <= 2) {
      return 'urgent';
    } else if (minutesUntil <= 10) {
      return 'warning';
    }

    return null;
  }

  autoDetectRamadan() {
    const today = new Date();
    const hijri = hijriConverter.toHijri(
      today.getFullYear(),
      today.getMonth() + 1,
      today.getDate()
    );
    if (hijri.hm === 9) {
      const ramadanStart = hijriConverter.toGregorian(hijri.hy, 9, 1);
      const startDate = new Date(ramadanStart.gy, ramadanStart.gm - 1, ramadanStart.gd);
      const ramadanEnd = hijriConverter.toGregorian(hijri.hy, 9, 30);
      const endDate = new Date(ramadanEnd.gy, ramadanEnd.gm - 1, ramadanEnd.gd);
      return {
        isRamadan: true,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        currentDay: hijri.hd,
      };
    }
    return {
      isRamadan: false,
      startDate: null,
      endDate: null,
      currentDay: null,
    };
  }

  getDaysUntilRamadan() {
    const today = new Date();
    const hijri = hijriConverter.toHijri(
      today.getFullYear(),
      today.getMonth() + 1,
      today.getDate()
    );
    if (hijri.hm === 9) {
      return 0;
    }
    let ramadanYear = hijri.hy;
    if (hijri.hm > 9) {
      ramadanYear = hijri.hy + 1;
    }
    const nextRamadan = hijriConverter.toGregorian(ramadanYear, 9, 1);
    const ramadanDate = new Date(nextRamadan.gy, nextRamadan.gm - 1, nextRamadan.gd);
    const diffTime = ramadanDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  }

  isRamadanMode() {
    if (this.settings?.ramadan?.enabled) {
      const now = new Date();
      const startDate = this.settings.ramadan.startDate
        ? new Date(this.settings.ramadan.startDate)
        : null;
      const endDate = this.settings.ramadan.endDate
        ? new Date(this.settings.ramadan.endDate)
        : null;
      if (startDate && endDate && now >= startDate && now <= endDate) {
        return true;
      }
    }
    const autoDetect = this.autoDetectRamadan();
    return autoDetect.isRamadan;
  }

  getRamadanDay() {
    const autoDetect = this.autoDetectRamadan();
    if (autoDetect.isRamadan) {
      return autoDetect.currentDay;
    }
    if (!this.settings?.ramadan?.enabled || !this.settings.ramadan.startDate) {
      return null;
    }
    const now = new Date();
    const startDate = new Date(this.settings.ramadan.startDate);
    const diffTime = now.getTime() - startDate.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return diffDays;
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = PrayerCalculator;
} else {
  window.PrayerCalculator = PrayerCalculator;
}
