/**
 * PrayTimes — Prayer times calculator (Meeus-based solar position).
 * Used by PrayerCalculator for fajr, dhuhr, asr, maghrib, isha.
 */
class PrayTimes {

  static TIME_NAMES = {
    imsak: 'Imsak',
    fajr: 'Fajr',
    sunrise: 'Sunrise',
    dhuhr: 'Dhuhr',
    asr: 'Asr',
    sunset: 'Sunset',
    maghrib: 'Maghrib',
    isha: 'Isha',
    midnight: 'Midnight',
  };

  static METHODS = {
    MWL: {
      name: 'Muslim World League',
      params: { fajr: 18, isha: 17 },
    },
    ISNA: {
      name: 'Islamic Society of North America (ISNA)',
      params: { fajr: 15, isha: 15 },
    },
    Egypt: {
      name: 'Egyptian General Authority of Survey',
      params: { fajr: 19.5, isha: 17.5 },
    },
    Makkah: {
      name: 'Umm Al-Qura University, Makkah',
      params: { fajr: 18.5, isha: '90 min' },
    },
    Karachi: {
      name: 'University of Islamic Sciences, Karachi',
      params: { fajr: 18, isha: 18 },
    },
    Tehran: {
      name: 'Institute of Geophysics, University of Tehran',
      params: { fajr: 17.7, isha: 14, maghrib: 4.5, midnight: 'Jafari' },
    },
    Jafari: {
      name: 'Shia Ithna-Ashari, Leva Institute, Qum',
      params: { fajr: 16, isha: 14, maghrib: 4, midnight: 'Jafari' },
    },
    MoonsightingCommittee: {
      name: 'Moonsighting Committee Worldwide',
      params: { fajr: 18, isha: 18, shafaq: 'general' },
    },
  };

  static DEFAULT_PARAMS = {
    maghrib: '0 min',
    midnight: 'Standard',
  };

  constructor(method = 'MWL') {
    for (const [, config] of Object.entries(PrayTimes.METHODS)) {
      for (const [paramName, defaultVal] of Object.entries(PrayTimes.DEFAULT_PARAMS)) {
        if (config.params[paramName] === undefined || config.params[paramName] === null) {
          config.params[paramName] = defaultVal;
        }
      }
    }

    this.calcMethod = method in PrayTimes.METHODS ? method : 'MWL';
    this.settings = {
      imsak: '10 min',
      dhuhr: '0 min',
      asr: 'Standard',
      highLats: 'NightMiddle',
      ...PrayTimes.METHODS[this.calcMethod].params,
    };

    this.offset = {};
    for (const name of Object.keys(PrayTimes.TIME_NAMES)) {
      this.offset[name] = 0;
    }

    this.timeFormat = '24h';
    this.timeSuffixes = ['am', 'pm'];
    this.invalidTime = '-----';

    this.numIterations = 2;
    this.useInterpolation = true;

    this.temperature = 10;
    this.pressure = 1013.25;

    this.highLatMethod = 'NearestLatitude';

    this.lat = 0;
    this.lng = 0;
    this.elv = 0;
    this.timeZone = 0;
    this.jDate = 0;
  }

  setMethod(method) {
    if (method in PrayTimes.METHODS) {
      this.calcMethod = method;
      Object.assign(this.settings, PrayTimes.METHODS[method].params);
    } else {
      throw new Error(`Unknown method: ${method}. Available: ${Object.keys(PrayTimes.METHODS).join(', ')}`);
    }
  }

  adjust(params) {
    Object.assign(this.settings, params);
  }

  tune(timeOffsets) {
    Object.assign(this.offset, timeOffsets);
  }

  setAtmosphere({ temperature, pressure } = {}) {
    if (temperature !== undefined) this.temperature = temperature;
    if (pressure !== undefined) this.pressure = pressure;
  }

  getMethod() { return this.calcMethod; }
  getSettings() { return { ...this.settings }; }
  getOffsets() { return { ...this.offset }; }

  getTimes(dateInput, coords, timezoneInput, dst = 0, format = null) {
    this.lat = coords[0];
    this.lng = coords[1];
    this.elv = coords.length > 2 ? coords[2] : 0;

    if (format !== null) {
      this.timeFormat = format;
    }

    let year, month, day;
    if (dateInput instanceof Date) {
      year = dateInput.getFullYear();
      month = dateInput.getMonth() + 1;
      day = dateInput.getDate();
    } else if (Array.isArray(dateInput)) {
      [year, month, day] = dateInput;
    } else {
      throw new Error('dateInput must be a Date object or [year, month, day] array');
    }

    if (typeof timezoneInput === 'string') {
      this.timeZone = this._resolveTimezone(timezoneInput, year, month, day);
    } else {
      const tzOffset = timezoneInput ?? 0;
      this.timeZone = tzOffset + (dst ? 1 : 0);
    }

    this.jDate = PrayTimes._julian(year, month, day);

    return this._computeTimes();
  }

  getFormattedTime(time, format, suffixes = null) {
    if (isNaN(time)) return this.invalidTime;
    if (format === 'Float') return time;
    if (!suffixes) suffixes = this.timeSuffixes;

    time = PrayTimes._fixhour(time + 0.5 / 60);
    const hours = Math.floor(time);
    const minutes = Math.floor((time - hours) * 60);

    if (format === '12h') {
      const suffix = suffixes[hours < 12 ? 0 : 1];
      return `${((hours + 11) % 12 + 1)}:${String(minutes).padStart(2, '0')}${suffix}`;
    }
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  }

  _resolveTimezone(tzName, year, month, day) {
    try {
      const utcDate = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));

      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: tzName,
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric',
        hour12: false,
      });

      const parts = formatter.formatToParts(utcDate);
      const getPart = (type) => parseInt(parts.find(p => p.type === type)?.value || '0', 10);

      const localDate = new Date(
        getPart('year'),
        getPart('month') - 1,
        getPart('day'),
        getPart('hour') === 24 ? 0 : getPart('hour'),
        getPart('minute'),
        getPart('second')
      );

      const utcNoon = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
      const diffMs = localDate.getTime() - utcNoon.getTime();
      const offsetHours = Math.round(diffMs / (1000 * 60 * 15)) * 0.25;
      return offsetHours;
    } catch (e) {
      console.warn(`Could not resolve timezone '${tzName}': ${e.message}. Defaulting to UTC.`);
      return 0;
    }
  }

  _sunPosition(jd) {
    const T = (jd - 2451545.0) / 36525.0;

    const L0 = PrayTimes._fixangle(280.46646 + T * (36000.76983 + 0.0003032 * T));
    const M = PrayTimes._fixangle(357.52911 + T * (35999.05029 - 0.0001537 * T));
    const e = 0.016708634 - T * (0.000042037 + 0.0000001267 * T);

    const Mrad = PrayTimes._dtr(M);
    const C = (1.914602 - T * (0.004817 + 0.000014 * T)) * Math.sin(Mrad)
            + (0.019993 - 0.000101 * T) * Math.sin(2 * Mrad)
            + 0.000289 * Math.sin(3 * Mrad);

    const sunLon = L0 + C;

    const omega = 125.04 - 1934.136 * T;
    const sunLonApparent = sunLon - 0.00569 - 0.00478 * Math.sin(PrayTimes._dtr(omega));

    const epsilon0 = 23.0 + (26.0 + (21.448 - T * (46.8150 + T * (0.00059 - T * 0.001813))) / 60.0) / 60.0;
    const epsilon = epsilon0 + 0.00256 * Math.cos(PrayTimes._dtr(omega));

    const decl = PrayTimes._rtd(Math.asin(
      Math.sin(PrayTimes._dtr(epsilon)) * Math.sin(PrayTimes._dtr(sunLonApparent))
    ));

    const y = Math.tan(PrayTimes._dtr(epsilon / 2)) ** 2;
    const L0rad = PrayTimes._dtr(L0);
    let eqt = y * Math.sin(2 * L0rad)
            - 2 * e * Math.sin(Mrad)
            + 4 * e * y * Math.sin(Mrad) * Math.cos(2 * L0rad)
            - 0.5 * y * y * Math.sin(4 * L0rad)
            - 1.25 * e * e * Math.sin(2 * Mrad);
    eqt = PrayTimes._rtd(eqt) / 15.0;

    return [decl, eqt];
  }

  _sunPositionAt(jd, hour) {
    if (!this.useInterpolation) {
      return this._sunPosition(jd + hour / 24.0);
    }

    const pos0 = this._sunPosition(jd);
    const pos12 = this._sunPosition(jd + 0.5);
    const pos24 = this._sunPosition(jd + 1.0);

    const n = hour / 24.0;
    const decl = PrayTimes._interpolate(pos0[0], pos12[0], pos24[0], n);
    const eqt = PrayTimes._interpolate(pos0[1], pos12[1], pos24[1], n);

    return [decl, eqt];
  }

  static _interpolate(y0, y1, y2, n) {
    const a = 2 * y0 - 4 * y1 + 2 * y2;
    const b = -3 * y0 + 4 * y1 - y2;
    const c = y0;
    return a * n * n + b * n + c;
  }

  _midDay(time) {
    const eqt = this._sunPositionAt(this.jDate, time * 24.0)[1];
    return PrayTimes._fixhour(12 - eqt - this.lng / 15.0);
  }

  _sunAngleTime(angle, time, direction = null) {
    try {
      const hour = time * 24.0;
      const decl = this._sunPositionAt(this.jDate, hour)[0];
      const noon = this._midDay(time);

      const cosHA = (-PrayTimes._sinD(angle) - PrayTimes._sinD(decl) * PrayTimes._sinD(this.lat))
                  / (PrayTimes._cosD(decl) * PrayTimes._cosD(this.lat));

      if (cosHA < -1 || cosHA > 1) return NaN;

      const t = (1.0 / 15.0) * PrayTimes._rtd(Math.acos(cosHA));
      return noon + (direction === 'ccw' ? -t : t);
    } catch (e) {
      return NaN;
    }
  }

  _asrTime(factor, time) {
    const hour = time * 24.0;
    const decl = this._sunPositionAt(this.jDate, hour)[0];
    const angle = -PrayTimes._rtd(Math.atan(1.0 / (factor + PrayTimes._tanD(Math.abs(this.lat - decl)))));
    return this._sunAngleTime(angle, time);
  }

  _riseSetAngle() {
    let dip = 0;
    if (this.elv && this.elv > 0) {
      const earthRadius = 6371000;
      dip = PrayTimes._rtd(Math.acos(earthRadius / (earthRadius + this.elv)));
    }

    const baseRefraction = 0.567;
    const solarSemiDiameter = 0.266;
    const pressureFactor = this.pressure / 1013.25;
    const temperatureFactor = 283.0 / (273.0 + this.temperature);
    const adjustedRefraction = baseRefraction * pressureFactor * temperatureFactor;

    return adjustedRefraction + solarSemiDiameter + dip;
  }

  _computePrayerTimes(times) {
    times = this._dayPortion(times);
    const params = this.settings;
    const riseSet = this._riseSetAngle();

    return {
      imsak:   this._sunAngleTime(this._eval(params.imsak), times.imsak, 'ccw'),
      fajr:    this._sunAngleTime(this._eval(params.fajr), times.fajr, 'ccw'),
      sunrise: this._sunAngleTime(riseSet, times.sunrise, 'ccw'),
      dhuhr:   this._midDay(times.dhuhr),
      asr:     this._asrTime(this._asrFactor(params.asr), times.asr),
      sunset:  this._sunAngleTime(riseSet, times.sunset),
      maghrib: this._sunAngleTime(this._eval(params.maghrib), times.maghrib),
      isha:    this._sunAngleTime(this._eval(params.isha), times.isha),
    };
  }

  _computeTimes() {
    let times = {
      imsak: 5, fajr: 5, sunrise: 6, dhuhr: 12,
      asr: 13, sunset: 18, maghrib: 18, isha: 18,
    };

    for (let i = 0; i < this.numIterations; i++) {
      times = this._computePrayerTimes(times);
    }

    times = this._adjustTimes(times);

    if (this.settings.midnight === 'Jafari') {
      times.midnight = times.sunset + this._timeDiff(times.sunset, times.fajr) / 2;
    } else {
      times.midnight = times.sunset + this._timeDiff(times.sunset, times.sunrise) / 2;
    }

    times = this._tuneTimes(times);
    return this._formatTimes(times);
  }

  _adjustTimes(times) {
    const params = this.settings;

    for (const t of Object.keys(times)) {
      times[t] += this.timeZone;
    }

    if ((params.highLats || 'None') !== 'None') {
      times = this._adjustHighLats(times);
    }

    if (this._isMin(params.imsak)) {
      times.imsak = times.fajr - this._eval(params.imsak) / 60.0;
    }
    if (this._isMin(params.maghrib)) {
      times.maghrib = times.sunset + this._eval(params.maghrib) / 60.0;
    }
    if (this._isMin(params.isha)) {
      times.isha = times.maghrib + this._eval(params.isha) / 60.0;
    }

    times.dhuhr += this._eval(params.dhuhr) / 60.0;

    return times;
  }

  _asrFactor(asrParam) {
    const methods = { Standard: 1, Hanafi: 2 };
    return methods[asrParam] ?? this._eval(asrParam);
  }

  _tuneTimes(times) {
    for (const name of Object.keys(times)) {
      if (name in this.offset) {
        times[name] += this.offset[name] / 60.0;
      }
    }
    return times;
  }

  _formatTimes(times) {
    const result = {};
    for (const [name, value] of Object.entries(times)) {
      result[name] = this.getFormattedTime(value, this.timeFormat);
    }
    return result;
  }

  _adjustHighLats(times) {
    const params = this.settings;
    const nightTime = this._timeDiff(times.sunset, times.sunrise);

    times.imsak   = this._adjustHLTime(times.imsak, times.sunrise, this._eval(params.imsak), nightTime, 'ccw');
    times.fajr    = this._adjustHLTime(times.fajr, times.sunrise, this._eval(params.fajr), nightTime, 'ccw');
    times.isha    = this._adjustHLTime(times.isha, times.sunset, this._eval(params.isha), nightTime);
    times.maghrib = this._adjustHLTime(times.maghrib, times.sunset, this._eval(params.maghrib), nightTime);

    return times;
  }

  _adjustHLTime(time, base, angle, night, direction = null) {
    const portion = this._nightPortion(angle, night);
    const diff = direction === 'ccw'
      ? this._timeDiff(time, base)
      : this._timeDiff(base, time);

    if (isNaN(time) || diff > portion) {
      if (this.settings.highLats === 'NearestLatitude' || this.highLatMethod === 'NearestLatitude') {
        const nearestTime = this._nearestLatitudeTime(angle, direction);
        if (!isNaN(nearestTime)) return nearestTime;
      }
      time = base + (direction === 'ccw' ? -portion : portion);
    }

    return time;
  }

  _nearestLatitudeTime(angle, direction = null) {
    const originalLat = this.lat;
    const sign = this.lat >= 0 ? 1 : -1;

    for (let testLatAbs = Math.floor(Math.abs(this.lat)); testLatAbs >= 45; testLatAbs--) {
      this.lat = sign * testLatAbs;
      try {
        const result = this._sunAngleTime(angle, direction === 'ccw' ? 0.25 : 0.75, direction);
        if (!isNaN(result)) {
          this.lat = originalLat;
          return result;
        }
      } catch (e) {
        continue;
      }
    }

    this.lat = originalLat;
    return NaN;
  }

  _nightPortion(angle, night) {
    const method = this.settings.highLats || 'NightMiddle';
    let portion;
    if (method === 'AngleBased') {
      portion = angle / 60.0;
    } else if (method === 'OneSeventh') {
      portion = 1.0 / 7.0;
    } else {
      portion = 1.0 / 2.0;
    }
    return portion * night;
  }

  static _julian(year, month, day) {
    if (month <= 2) {
      year -= 1;
      month += 12;
    }
    const A = Math.floor(year / 100);
    const B = 2 - A + Math.floor(A / 4);
    return Math.floor(365.25 * (year + 4716))
         + Math.floor(30.6001 * (month + 1))
         + day + B - 1524.5;
  }

  _timeDiff(time1, time2) {
    const diff = time2 - time1;
    return diff < 0 ? diff + 24.0 : diff;
  }

  _eval(st) {
    if (typeof st === 'number') return st;
    const match = String(st).match(/^([0-9.+-]+)/);
    if (!match) {
      console.warn(`Could not parse numeric value from '${st}', defaulting to 0`);
      return 0;
    }
    const val = parseFloat(match[1]);
    if (isNaN(val)) {
      console.warn(`Invalid numeric value from '${st}', defaulting to 0`);
      return 0;
    }
    return val;
  }

  _isMin(arg) {
    return typeof arg === 'string' && arg.includes('min');
  }

  _dayPortion(times) {
    const result = {};
    for (const [k, v] of Object.entries(times)) {
      result[k] = v / 24.0;
    }
    return result;
  }

  static _dtr(d) { return d * Math.PI / 180.0; }
  static _rtd(r) { return r * 180.0 / Math.PI; }

  static _sinD(d) { return Math.sin(PrayTimes._dtr(d)); }
  static _cosD(d) { return Math.cos(PrayTimes._dtr(d)); }
  static _tanD(d) { return Math.tan(PrayTimes._dtr(d)); }

  static _fixangle(angle) {
    let a = angle - 360.0 * Math.floor(angle / 360.0);
    return a < 0 ? a + 360.0 : a;
  }

  static _fixhour(hour) {
    let a = hour - 24.0 * Math.floor(hour / 24.0);
    return a < 0 ? a + 24.0 : a;
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = PrayTimes;
}
if (typeof window !== 'undefined') {
  window.PrayTimes = PrayTimes;
}
