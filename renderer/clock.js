const { ipcRenderer } = require('electron');
const path = require('path');
const PrayerCalculator = require(path.join(__dirname, 'prayer.js'));
const hijriConverter = require('hijri-converter');

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
        
        this.init();
    }

    async init() {
        // Show real time immediately (before settings load)
        this.updateClock();
        setInterval(() => this.updateClock(), 1000);

        // Load settings (clock already running with system time)
        await this.calculator.loadSettings();
        this.settings = this.calculator.settings;

        // Recalculate with settings (timezone, location for prayer times)
        this.updatePrayerTimes();
        this.updateClock();
        
        // Check for prayer times every second
        setInterval(() => this.checkPrayerTimes(), 1000);
        
        // Update prayer times at midnight
        this.scheduleMidnightUpdate();
        
        // Listen for settings updates
        ipcRenderer.on('settings-updated', (event, settings) => {
            this.settings = settings;
            this.calculator.settings = settings;
            this.updatePrayerTimes();
        });
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
            this.updateRamadanDisplay();
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
        
        // Update prayer time displays (use timezone from settings; default Pacific)
        const prayers = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];
        const timeFormat = this.settings?.display?.timeFormat || '12';
        const timeZone = this.settings?.location?.timezone || 'America/Los_Angeles';
        
        prayers.forEach(prayer => {
            const time = this.calculator.prayerTimes[prayer];
            const timeString = this.formatTime(time, timeFormat === '24', timeZone, false);
            document.getElementById(`${prayer}-time`).textContent = timeString;
        });
    }

    updateNextPrayer() {
        this.nextPrayer = this.calculator.getNextPrayer();
        
        // Highlight only the next prayer cell (earthy-frame: single glow)
        const cells = document.querySelectorAll('.prayerCell');
        cells.forEach(cell => {
            const isNext = this.nextPrayer && cell.getAttribute('data-prayer') === this.nextPrayer.name;
            cell.classList.toggle('next', isNext);
        });
        
        const countdownEl = document.getElementById('next-prayer-countdown');
        if (this.nextPrayer && countdownEl) {
            countdownEl.textContent = this.nextPrayer.countdown;
            const warning = this.calculator.getPrayerWarning(this.nextPrayer);
            countdownEl.classList.remove('warning', 'urgent');
            if (warning === 'urgent') countdownEl.classList.add('urgent');
            else if (warning === 'warning') countdownEl.classList.add('warning');
        }
    }

    updateCompletedPrayers() {
        this.completedPrayers = this.calculator.getCompletedPrayers();
        
        const prayers = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];
        prayers.forEach(prayer => {
            const checkmark = document.getElementById(`${prayer}-check`);
            if (this.completedPrayers.includes(prayer)) {
                checkmark.classList.remove('hidden');
            } else {
                checkmark.classList.add('hidden');
            }
        });
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

    updateRamadanDisplay() {
        const isRamadan = this.calculator.isRamadanMode();
        const banner = document.getElementById('ramadan-banner');
        
        if (isRamadan) {
            const day = this.calculator.getRamadanDay();
            if (day) {
                document.getElementById('ramadan-day').textContent = `Ramadan Day ${day}/30`;
                banner.classList.remove('hidden');
            }
            
            // Update prayer labels for Ramadan
            const fajrLabel = document.querySelector('[data-prayer="fajr"] .prayerName');
            const maghribLabel = document.querySelector('[data-prayer="maghrib"] .prayerName');
            
            if (fajrLabel) {
                fajrLabel.classList.add('ramadan-label');
            }
            if (maghribLabel) {
                maghribLabel.classList.add('ramadan-label');
            }
        } else {
            banner.classList.add('hidden');
            const labels = document.querySelectorAll('.ramadan-label');
            labels.forEach(label => label.classList.remove('ramadan-label'));
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
                    // Play subtle notification at 10 minutes
                    this.playNotification();
                }
            }
            
            // Check for Suhoor warning (Ramadan mode, 30 min before Fajr)
            if (this.calculator.isRamadanMode() && this.nextPrayer && this.nextPrayer.name === 'fajr') {
                const now = new Date();
                const timeUntil = this.nextPrayer.time.getTime() - now.getTime();
                const minutesUntil = Math.floor(timeUntil / 60000);
                
                if (minutesUntil <= 30 && minutesUntil > 0) {
                    this.showSuhoorWarning(minutesUntil);
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
        const iftarDisplay = document.getElementById('iftar-display');
        
        clockDisplay.classList.add('hidden');
        iftarDisplay.classList.add('hidden');
        athanDisplay.classList.remove('hidden');
        
        // Special handling for Maghrib in Ramadan
        if (this.calculator.isRamadanMode() && prayerName === 'maghrib') {
            this.showIftarDua();
            await this.sleep(30000); // 30 seconds
        }
        
        // Set prayer name
        const prayerNameUpper = prayerName.toUpperCase();
        document.getElementById('athan-prayer-name').textContent = prayerNameUpper;
        
        // Update time
        const timeFormat = this.settings?.display?.timeFormat || '12';
        const timeZone = this.settings?.location?.timezone || 'America/Los_Angeles';
        const timeString = this.formatTime(this.currentTime, timeFormat === '24', timeZone);
        document.getElementById('athan-time').textContent = timeString;
        
        // Determine which audio file to play
        let audioFile = this.settings?.athan?.default || 'makkah.mp3';
        if (prayerName === 'fajr' && this.settings?.athan?.fajr) {
            audioFile = this.settings.athan.fajr;
        }
        
        // Load and play audio
        const path = require('path');
        const appPath = window.__APP_PATH__ || __dirname.replace('/renderer', '');
        const audioPath = path.join(appPath, 'assets', 'athan', audioFile);
        // Normalize path for different OS
        const normalizedPath = audioPath.replace(/\\/g, '/');
        this.athanAudio.src = `file:///${normalizedPath}`;
        this.athanAudio.volume = (this.settings?.athan?.volume || 80) / 100;
        
        // Fade in
        this.athanAudio.volume = 0;
        await this.athanAudio.play();
        
        // Fade in over 2 seconds
        const fadeInterval = setInterval(() => {
            if (this.athanAudio.volume < (this.settings?.athan?.volume || 80) / 100) {
                this.athanAudio.volume = Math.min(
                    this.athanAudio.volume + 0.05,
                    (this.settings?.athan?.volume || 80) / 100
                );
            } else {
                clearInterval(fadeInterval);
            }
        }, 100);
        
        // Wait for audio to finish (or 3 minutes max)
        await Promise.race([
            new Promise(resolve => {
                this.athanAudio.onended = resolve;
            }),
            this.sleep(180000) // 3 minutes max
        ]);
        
        // Return to clock display
        athanDisplay.classList.add('hidden');
        clockDisplay.classList.remove('hidden');
        this.isAthanPlaying = false;
    }

    showIftarDua() {
        const iftarDisplay = document.getElementById('iftar-display');
        iftarDisplay.classList.remove('hidden');
    }

    showSuhoorWarning(minutesUntil) {
        // Create or update suhoor warning element
        let warningEl = document.getElementById('suhoor-warning');
        if (!warningEl) {
            warningEl = document.createElement('div');
            warningEl.id = 'suhoor-warning';
            warningEl.className = 'suhoor-warning';
            document.body.appendChild(warningEl);
        }
        warningEl.textContent = `Suhoor ends in ${minutesUntil} minutes`;
        
        // Play warning sound at specific intervals
        if (minutesUntil === 15 || minutesUntil === 10 || minutesUntil === 5) {
            this.playNotification();
        }
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
            // Schedule next midnight update
            setInterval(() => {
                this.updatePrayerTimes();
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
