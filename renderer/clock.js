const { ipcRenderer } = require('electron');
const path = require('path');
const PrayerCalculator = require(path.join(__dirname, 'prayer.js'));
const hijriConverter = require('hijri-converter');
const { MASJID_ID, MASJID_DISPLAY_NAME } = require(path.join(__dirname, 'services', 'masjidConfig'));
const { getMonthSchedule } = require(path.join(__dirname, 'services', 'masjidScheduleAgent'));
const { getTodayPrayerTimes } = require(path.join(__dirname, 'services', 'prayerTimesResolver'));
const { getTodayRamadanTimes } = require(path.join(__dirname, 'services', 'ramadanEventTimes'));
const { computeOverlayState } = require(path.join(__dirname, 'services', 'ramadanOverlayAgent'));
const { getDateKey } = require(path.join(__dirname, 'services', 'monthKey'));
const { loadDuas } = require(path.join(__dirname, 'services', 'duaSelector'));
const RamadanOverlay = require(path.join(__dirname, 'overlays', 'ramadanOverlay.js'));
const MoonCalc = require(path.join(__dirname, 'moon.js'));

class AthanClock {
    constructor() {
        this.calculator = new PrayerCalculator();
        this.currentTime = null;
        this.nextPrayer = null;
        this.completedPrayers = [];
        this.isAthanPlaying = false;
        this.athanAudio = document.getElementById('athan-audio');
        this.notificationAudio = document.getElementById('notification-audio');
        this.settings = null;
        this.metMonth = null;
        this.metToday = null;
        /** When > Date.now(), Ramadan overlay uses fake times for testing. Event: 'maghrib' | 'fajr' | 'taraweeh' */
        this.ramadanOverlayTestUntil = 0;
        this.ramadanOverlayTestEvent = 'maghrib';
        /** Fixed target times for test countdown (set when shortcut pressed so countdown actually decreases) */
        this.ramadanOverlayTestTargets = null;
        this.moonCalc = new MoonCalc();

        this.init();
    }

    async init() {
        // Show real time immediately (before settings load)
        this.updateClock();
        setInterval(() => this.updateClock(), 1000);

        // Load settings (clock already running with system time)
        await this.calculator.loadSettings();
        this.settings = this.calculator.settings;

        this.applyTheme(this.settings);

        // Recalculate with settings (timezone, location for prayer times)
        this.updatePrayerTimes();
        this.updateClock();
        
        // Check for prayer times every second
        setInterval(() => this.checkPrayerTimes(), 1000);
        
        // Update prayer times at midnight
        this.scheduleMidnightUpdate();

        // MET Mosque schedule (monthly cache); populates adhan/iqama in strip and header
        this.loadMetSchedule();

        // Listen for settings updates
        ipcRenderer.on('settings-updated', (event, settings) => {
            this.settings = settings;
            this.calculator.settings = settings;
            this.applyTheme(settings);
            this.updatePrayerTimes();
            if (settings?.ramadan?.enabled) loadDuas().catch(() => {});
        });

        // Shortcut to trigger athan for testing: Ctrl+Shift+A (Windows/Linux) or Cmd+Shift+A (Mac)
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'a') {
                e.preventDefault();
                this.playAthan('dhuhr');
            }
            // Ramadan overlay test shortcuts (10 min window each; simulates event in 30s then at-time)
            if ((e.ctrlKey || e.metaKey) && e.shiftKey) {
                const key = e.key.toLowerCase();
                if (key === 'r') {
                    e.preventDefault();
                    const now = Date.now();
                    this.ramadanOverlayTestUntil = now + 10 * 60 * 1000;
                    this.ramadanOverlayTestEvent = 'maghrib';
                    this.ramadanOverlayTestTargets = {
                        maghribAdhan: new Date(now + 30 * 1000),
                        fajrAdhan: new Date(now + 60 * 60 * 1000),
                        ishaIqama: new Date(now + 60 * 60 * 1000)
                    };
                    loadDuas().catch(() => {});
                } else if (key === 'f') {
                    e.preventDefault();
                    const now = Date.now();
                    this.ramadanOverlayTestUntil = now + 10 * 60 * 1000;
                    this.ramadanOverlayTestEvent = 'fajr';
                    this.ramadanOverlayTestTargets = {
                        maghribAdhan: new Date(now - 60 * 60 * 1000),
                        fajrAdhan: new Date(now + 30 * 1000),
                        ishaIqama: new Date(now + 60 * 60 * 1000)
                    };
                    loadDuas().catch(() => {});
                } else if (key === 't') {
                    e.preventDefault();
                    const now = Date.now();
                    this.ramadanOverlayTestUntil = now + 10 * 60 * 1000;
                    this.ramadanOverlayTestEvent = 'taraweeh';
                    this.ramadanOverlayTestTargets = {
                        maghribAdhan: new Date(now - 60 * 60 * 1000),
                        fajrAdhan: new Date(now + 60 * 60 * 1000),
                        ishaIqama: new Date(now + 30 * 1000)
                    };
                    loadDuas().catch(() => {});
                }
            }
        });

        // Ramadan overlay: countdown + at-time (Maghrib, Fajr, Taraweeh); refresh every second
        setInterval(() => this.tickRamadanOverlay(), 1000);
        // When user taps to dismiss overlay, end test mode so it doesn't keep reopening
        document.body.addEventListener('ramadan-overlay-dismissed', () => {
            this.ramadanOverlayTestUntil = 0;
            this.ramadanOverlayTestTargets = null;
        });
        // Preload duos so overlay can show them when at-time screen appears
        await loadDuas().catch(() => {});
    }

    tickRamadanOverlay() {
        const now = new Date();
        let times;

        if (this.ramadanOverlayTestUntil > now && this.ramadanOverlayTestTargets) {
            // Test mode: use fixed targets set when shortcut was pressed so countdown decreases each second
            times = this.ramadanOverlayTestTargets;
        } else if (!this.settings?.ramadan?.enabled || !this.calculator.isRamadanMode()) {
            this.ramadanOverlayTestTargets = null;
            RamadanOverlay.update({ state: 'NONE' });
            return;
        } else {
            times = getTodayRamadanTimes(this.calculator, this.metToday);
        }

        const lead = this.settings?.ramadan?.countdownLeadMinutes || {};
        const stateResult = computeOverlayState(now, times, {
            maghribLeadMin: lead.maghrib,
            fajrLeadMin: lead.fajr,
            taraweehLeadMin: lead.taraweeh
        });
        RamadanOverlay.update(stateResult, getDateKey(now));
    }

    applyTheme(settings) {
        const theme = settings?.display?.theme || 'earthy-frame';
        const link = document.getElementById('theme-link');
        if (link) {
            link.href = `themes/${theme}/theme.css`;
        }
    }

    async loadMetSchedule() {
        try {
            const month = await getMonthSchedule(MASJID_ID, new Date());
            this.metMonth = month;
            this.metToday = getTodayPrayerTimes(new Date(), month);
            this.updateHeader();
            this.updatePrayerTimes();
        } catch (err) {
            console.error('MET schedule load failed:', err);
            this.metMonth = null;
            this.metToday = null;
            this.updateHeader();
        }
    }

    updateHeader() {
        const masjidEl = document.getElementById('masjid-name');
        if (masjidEl) masjidEl.textContent = MASJID_DISPLAY_NAME;
        this.updateMoonPhase();
    }

    /** Map phase fraction (0–1) to moon-phases.svg symbol id; update icon in top-right. */
    updateMoonPhase() {
        const container = document.getElementById('moon-phase');
        if (!container) return;
        const useEl = container.querySelector('svg use');
        if (!useEl) return;
        const phase = this.moonCalc.getPhase(new Date());
        const symbolId = this.phaseToSymbolId(phase.phase);
        const href = `#${symbolId}`;
        if (useEl.getAttribute('href') !== href) {
            useEl.setAttribute('href', href);
        }
        const title = `${phase.name} • ${(phase.illumination * 100).toFixed(0)}%`;
        if (container.getAttribute('title') !== title) {
            container.setAttribute('title', title);
        }
    }

    phaseToSymbolId(phaseFraction) {
        const symbols = ['moon-new', 'moon-wax-crescent', 'moon-first-quarter', 'moon-wax-gibbous', 'moon-full', 'moon-wane-gibbous', 'moon-last-quarter', 'moon-wane-crescent'];
        const p = ((phaseFraction % 1) + 1) % 1;
        const index = Math.round(p * 8) % 8;
        return symbols[index];
    }

    updateClock() {
        const now = new Date();
        this.currentTime = now;
        
        // Update current time display — system time by default, or timezone from settings if set
        const timeFormat = this.settings?.display?.timeFormat || '12';
        const timeZone = this.settings?.location?.timezone || undefined;
        const timeString = this.formatTimeForDisplay(now, timeFormat === '24', timeZone);
        const el = document.getElementById('current-time');
        if (el) el.textContent = timeString;

        // Update dates (safe without settings)
        this.updateDates();

        // Prayer-related updates only after settings/times are loaded
        if (this.calculator.prayerTimes) {
            this.updateNextPrayer();
            this.updateCompletedPrayers();
        }

        this.updateRamadanCountdown();
        this.updateMoonPhase();
    }

    updateRamadanCountdown() {
        const countdownEl = document.getElementById('ramadan-countdown');
        const countdownTextEl = document.getElementById('ramadan-countdown-text');
        const moonUse = countdownEl?.querySelector('.ramadan-countdown-moon use');
        if (!countdownEl || !countdownTextEl) return;
        const daysUntil = this.calculator.getDaysUntilRamadan();
        if (daysUntil > 0 && daysUntil <= 14) {
            countdownEl.classList.remove('hidden');
            if (daysUntil === 1) {
                countdownTextEl.textContent = 'Ramadan begins tomorrow!';
            } else {
                countdownTextEl.textContent = `Ramadan begins in ${daysUntil} days`;
            }
            if (moonUse) {
                const phase = this.moonCalc.getPhase(new Date());
                const symbolId = this.phaseToSymbolId(phase.phase);
                moonUse.setAttribute('href', `#${symbolId}`);
            }
        } else {
            countdownEl.classList.add('hidden');
        }
    }

    /** Format time for main clock — system time when timeZone omitted, else that zone */
    formatTimeForDisplay(date, format24, timeZone) {
        const opts = format24
            ? { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }
            : { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true };
        if (timeZone) opts.timeZone = timeZone;
        try {
            return new Intl.DateTimeFormat('en-US', opts).format(date);
        } catch (e) {
            return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: !format24 });
        }
    }

    getTimePartsInZone(date, timeZone) {
        try {
            const f = new Intl.DateTimeFormat('en-CA', { timeZone: timeZone || 'America/Los_Angeles', hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
            const parts = f.formatToParts(date);
            const get = (t) => {
                const p = parts.find(x => x.type === t);
                return p ? parseInt(p.value, 10) : 0;
            };
            return { hour: get('hour'), minute: get('minute'), second: get('second') };
        } catch (e) {
            return { hour: date.getHours(), minute: date.getMinutes(), second: date.getSeconds() };
        }
    }

    formatTime(date, format24 = false, timeZone = undefined, includeSeconds = true) {
        const { hour: hours, minute: minutes, second: seconds } = this.getTimePartsInZone(date, timeZone);
        const ampm = hours >= 12 ? 'PM' : 'AM';
        
        if (format24) {
            const base = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
            return includeSeconds ? `${base}:${String(seconds).padStart(2, '0')}` : base;
        } else {
            const displayHours = hours % 12 || 12;
            const base = `${displayHours}:${String(minutes).padStart(2, '0')}`;
            return includeSeconds ? `${base}:${String(seconds).padStart(2, '0')} ${ampm}` : `${base} ${ampm}`;
        }
    }

    updatePrayerTimes() {
        this.calculator.prayerTimes = this.calculator.calculatePrayerTimes();

        const prayers = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];
        const timeFormat = this.settings?.display?.timeFormat || '12';
        const timeZone = this.settings?.location?.timezone || 'America/Los_Angeles';

        prayers.forEach(prayer => {
            const timeEl = document.getElementById(`${prayer}-time`);
            const iqamaEl = document.getElementById(`${prayer}-iqama`);
            if (this.metToday && this.metToday[prayer]) {
                const adhan = this.metToday[prayer].adhan;
                const iqama = this.metToday[prayer].iqama;
                if (timeEl) timeEl.textContent = adhan || '—';
                if (iqamaEl) iqamaEl.textContent = iqama ? `Iqama ${iqama}` : 'Iqama —';
            } else {
                const time = this.calculator.prayerTimes[prayer];
                const timeString = this.formatTime(time, timeFormat === '24', timeZone, false);
                if (timeEl) timeEl.textContent = timeString;
                if (iqamaEl) iqamaEl.textContent = 'Iqama —';
            }
        });
    }

    updateNextPrayer() {
        this.nextPrayer = this.calculator.getNextPrayer();

        // Hero line: "Next: Maghrib" or "Next: Maghrib • MM:SS" (countdown only when < 60 min)
        const nextLineEl = document.getElementById('next-prayer-line');
        if (nextLineEl) {
            if (this.nextPrayer) {
                const name = this.nextPrayer.name.charAt(0).toUpperCase() + this.nextPrayer.name.slice(1);
                const msUntil = this.nextPrayer.time.getTime() - Date.now();
                const showCountdown = msUntil < 60 * 60 * 1000;
                nextLineEl.textContent = showCountdown ? `Next: ${name} • ${this.nextPrayer.countdown}` : `Next: ${name}`;
                const warning = this.calculator.getPrayerWarning(this.nextPrayer);
                nextLineEl.classList.remove('warning', 'urgent');
                if (warning === 'urgent') nextLineEl.classList.add('urgent');
                else if (warning === 'warning') nextLineEl.classList.add('warning');
            } else {
                nextLineEl.textContent = 'Next: — • —';
                nextLineEl.classList.remove('warning', 'urgent');
            }
        }

        // Highlight only the next prayer cell (earthy-frame: single glow)
        const cells = document.querySelectorAll('.prayerCell');
        cells.forEach(cell => {
            const isNext = this.nextPrayer && cell.getAttribute('data-prayer') === this.nextPrayer.name;
            cell.classList.toggle('next', isNext);
        });
    }

    updateCompletedPrayers() {
        this.completedPrayers = this.calculator.getCompletedPrayers();
        // Checkmarks removed from UI
    }

    updateDates() {
        const now = new Date();
        const timeZone = this.settings?.location?.timezone || 'America/Los_Angeles';
        const opts = { timeZone };
        const gregorianLong = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', ...opts });
        const gregorianShort = now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', ...opts });
        
        const gregorianEl = document.getElementById('gregorian-date');
        if (gregorianEl) gregorianEl.textContent = gregorianLong;
        
        const hijriMonths = [
            'Muharram', 'Safar', 'Rabi al-Awwal', 'Rabi al-Thani',
            'Jumada al-Awwal', 'Jumada al-Thani', 'Rajab', "Sha'ban",
            'Ramadan', 'Shawwal', 'Dhul-Qadah', 'Dhul-Hijjah'
        ];
        try {
            const hijri = hijriConverter.toHijri(now.getFullYear(), now.getMonth() + 1, now.getDate());
            const hijriDateStr = `${hijri.hd} ${hijriMonths[hijri.hm - 1]} ${hijri.hy} AH`;
            const hijriEl = document.getElementById('hijri-date');
            if (hijriEl) hijriEl.textContent = hijriDateStr;
            const dateLineEl = document.getElementById('dateLine');
            if (dateLineEl) dateLineEl.textContent = `${gregorianShort} • ${hijriDateStr}`;
        } catch (error) {
            console.error('Error calculating Hijri date:', error);
            const hijriEl = document.getElementById('hijri-date');
            if (hijriEl) hijriEl.textContent = 'Hijri date calculation error';
            const dateLineEl = document.getElementById('dateLine');
            if (dateLineEl) dateLineEl.textContent = gregorianShort;
        }
    }

    checkPrayerTimes() {
        try {
            if (this.isAthanPlaying) return;
            
            const prayers = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];
            
            const timeZone = this.settings?.location?.timezone || 'America/Los_Angeles';
            for (let prayer of prayers) {
                if (this.calculator.isPrayerTime(prayer, timeZone)) {
                    this.playAthan(prayer);
                    break;
                }
            }
            
            // Check for pre-prayer warnings
            if (this.nextPrayer) {
                const warning = this.calculator.getPrayerWarning(this.nextPrayer);
                if (warning === 'warning' && !this.isAthanPlaying) {
                    this.playNotification();
                }
            }
        } catch (error) {
            console.error('Error checking prayer times:', error);
        }
    }

    async playAthan(prayerName) {
        if (this.isAthanPlaying) return;
        
        this.isAthanPlaying = true;
        
        // Show athan display
        const clockDisplay = document.getElementById('clock-display');
        const athanDisplay = document.getElementById('athan-display');
        
        clockDisplay.classList.add('hidden');
        athanDisplay.classList.remove('hidden');
        
        // Set prayer name
        const prayerNameUpper = prayerName.toUpperCase();
        document.getElementById('athan-prayer-name').textContent = prayerNameUpper;
        
        // Update time
        const timeFormat = this.settings?.display?.timeFormat || '12';
        const timeZone = this.settings?.location?.timezone || 'America/Los_Angeles';
        const timeString = this.formatTime(this.currentTime, timeFormat === '24', timeZone);
        document.getElementById('athan-time').textContent = timeString;
        
        // Fixed files: athan.mp3 (fajr: fajir.mp3), then dua.mp3
        const athanFile = prayerName === 'fajr' ? 'fajir.mp3' : 'athan.mp3';
        const path = require('path');
        const appPath = window.__APP_PATH__ || __dirname.replace('/renderer', '');
        const volume = (this.settings?.athan?.volume ?? 80) / 100;

        const playOne = (filename) => {
            const audioPath = path.join(appPath, 'assets', 'athan', filename);
            const normalizedPath = audioPath.replace(/\\/g, '/');
            this.athanAudio.src = `file:///${normalizedPath}`;
            this.athanAudio.volume = volume;
            return new Promise((resolve, reject) => {
                this.athanAudio.onended = resolve;
                this.athanAudio.onerror = reject;
                this.athanAudio.volume = 0;
                this.athanAudio.play().then(() => {
                    const fadeInterval = setInterval(() => {
                        if (this.athanAudio.volume < volume) {
                            this.athanAudio.volume = Math.min(this.athanAudio.volume + 0.05, volume);
                        } else {
                            clearInterval(fadeInterval);
                        }
                    }, 100);
                }).catch(reject);
            });
        };

        // Play athan, then dua if enabled (each max 3 min)
        await Promise.race([ playOne(athanFile), this.sleep(180000) ]);
        if (this.settings?.athan?.playDuaAfter !== false) {
            try {
                await Promise.race([ playOne('dua.mp3'), this.sleep(180000) ]);
            } catch (e) {
                console.warn('Dua playback skipped:', e);
            }
        }

        // Return to clock display
        athanDisplay.classList.add('hidden');
        clockDisplay.classList.remove('hidden');
        this.isAthanPlaying = false;
    }

    async playNotification() {
        try {
            const path = require('path');
            const appPath = window.__APP_PATH__ || __dirname.replace('/renderer', '');
            const audioPath = path.join(appPath, 'assets', 'sounds', 'notification.mp3');
            // Normalize path for different OS
            const normalizedPath = audioPath.replace(/\\/g, '/');
            this.notificationAudio.src = `file:///${normalizedPath}`;
            this.notificationAudio.volume = 0.3;
            await this.notificationAudio.play();
        } catch (error) {
            console.error('Error playing notification:', error);
        }
    }

    scheduleMidnightUpdate() {
        const now = new Date();
        const midnight = new Date();
        midnight.setHours(24, 0, 0, 0);
        
        const msUntilMidnight = midnight.getTime() - now.getTime();
        
        setTimeout(() => {
            this.updatePrayerTimes();
            this.loadMetSchedule(); // refresh MET today (and month if changed)
            // Schedule next midnight update
            setInterval(() => {
                this.updatePrayerTimes();
                this.loadMetSchedule();
            }, 24 * 60 * 60 * 1000); // 24 hours
        }, msUntilMidnight);
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Initialize clock when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        new AthanClock();
    });
} else {
    new AthanClock();
}
