/**
 * Ramadan overlay state machine. No "ended" states; countdown → at-time → NONE.
 * Lead minutes (when countdown starts) come from options or defaults.
 */
const MAGHRIB_ADHAN_MIN = 3;
const FAJR_ADHAN_MIN = 2;
const TARAWEEH_MIN = 3;

function addMinutes(d, min) {
  const out = new Date(d);
  out.setMinutes(out.getMinutes() + min);
  return out;
}

/**
 * @param {Date} now
 * @param {{ maghribAdhan: Date, fajrAdhan: Date, ishaIqama: Date | null }} times
 * @param {{ maghribLeadMin?: number, fajrLeadMin?: number, taraweehLeadMin?: number }} [options]
 * @returns {{ state: string, eventType: string | null, countdownMs: number | null, dismissAt: Date | null }}
 */
function computeOverlayState(now, times, options) {
  const { maghribAdhan, fajrAdhan, ishaIqama } = times;
  const maghribLead = Math.max(1, Number(options?.maghribLeadMin) || 5);
  const fajrLead = Math.max(1, Number(options?.fajrLeadMin) || 15);
  const taraweehLead = Math.max(1, Number(options?.taraweehLeadMin) || 10);

  const maghribStart = addMinutes(maghribAdhan, -maghribLead);
  const maghribEnd = addMinutes(maghribAdhan, MAGHRIB_ADHAN_MIN);

  const fajrStart = addMinutes(fajrAdhan, -fajrLead);
  const fajrEnd = addMinutes(fajrAdhan, FAJR_ADHAN_MIN);

  const taraweehStart = ishaIqama ? addMinutes(ishaIqama, -taraweehLead) : null;
  const taraweehEnd = ishaIqama ? addMinutes(ishaIqama, TARAWEEH_MIN) : null;

  const tNow = now.getTime();

  // Priority: Maghrib > Fajr > Taraweeh

  if (tNow >= maghribStart && tNow < maghribAdhan) {
    return { state: 'COUNTDOWN_MAGHRIB', eventType: 'MAGHRIB', countdownMs: maghribAdhan.getTime() - tNow, dismissAt: null };
  }
  if (tNow >= maghribAdhan && tNow < maghribEnd) {
    return { state: 'ADHAN_MAGHRIB', eventType: 'MAGHRIB', countdownMs: null, dismissAt: maghribEnd };
  }

  if (tNow >= fajrStart && tNow < fajrAdhan) {
    return { state: 'COUNTDOWN_FAJR', eventType: 'FAJR', countdownMs: fajrAdhan.getTime() - tNow, dismissAt: null };
  }
  if (tNow >= fajrAdhan && tNow < fajrEnd) {
    return { state: 'ADHAN_FAJR', eventType: 'FAJR', countdownMs: null, dismissAt: fajrEnd };
  }

  if (taraweehStart && taraweehEnd && tNow >= taraweehStart && tNow < ishaIqama.getTime()) {
    return { state: 'COUNTDOWN_TARAWEEH', eventType: 'TARAWEEH', countdownMs: ishaIqama.getTime() - tNow, dismissAt: null };
  }
  if (taraweehEnd && tNow >= ishaIqama.getTime() && tNow < taraweehEnd.getTime()) {
    return { state: 'TARAWEEH_NOW', eventType: 'TARAWEEH', countdownMs: null, dismissAt: taraweehEnd };
  }

  return { state: 'NONE', eventType: null, countdownMs: null, dismissAt: null };
}

module.exports = {
  computeOverlayState,
  MAGHRIB_ADHAN_MIN,
  FAJR_ADHAN_MIN,
  TARAWEEH_MIN
};
