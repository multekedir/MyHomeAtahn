const API_BASE = 'http://localhost:3000/api';

let currentSettings = null;

// Load settings on page load
document.addEventListener('DOMContentLoaded', async () => {
    await loadSettings();
    setupEventListeners();
});

async function loadSettings() {
    try {
        const response = await fetch(`${API_BASE}/settings`);
        currentSettings = await response.json();
        populateForm(currentSettings);
    } catch (error) {
        console.error('Error loading settings:', error);
        showMessage('Error loading settings. Using defaults.', 'error');
    }
}

function populateForm(settings) {
    // Location settings
    document.getElementById('city').value = settings.location?.city || '';
    document.getElementById('latitude').value = settings.location?.latitude || '';
    document.getElementById('longitude').value = settings.location?.longitude || '';
    document.getElementById('timezone').value = settings.location?.timezone || '';

    // Calculation method
    document.getElementById('calculation-method').value = settings.calculationMethod || 'MuslimWorldLeague';

    // Time adjustments
    document.getElementById('fajr-adjust').value = settings.timeAdjustments?.fajr || 0;
    document.getElementById('dhuhr-adjust').value = settings.timeAdjustments?.dhuhr || 0;
    document.getElementById('asr-adjust').value = settings.timeAdjustments?.asr || 0;
    document.getElementById('maghrib-adjust').value = settings.timeAdjustments?.maghrib || 0;
    document.getElementById('isha-adjust').value = settings.timeAdjustments?.isha || 0;

    // Athan settings
    document.getElementById('athan-volume').value = settings.athan?.volume ?? 80;
    document.getElementById('volume-display').textContent = `${settings.athan?.volume ?? 80}%`;
    document.getElementById('athan-play-dua-after').checked = settings.athan?.playDuaAfter !== false;

    // Display settings
    document.getElementById('time-format').value = settings.display?.timeFormat || '12';
    document.getElementById('brightness').value = settings.display?.brightness || 100;
    document.getElementById('brightness-display').textContent = `${settings.display?.brightness || 100}%`;
    document.getElementById('night-mode-start').value = settings.display?.nightModeStart || 22;
    document.getElementById('night-mode-end').value = settings.display?.nightModeEnd || 6;
    document.getElementById('language').value = settings.display?.language || 'en';

    // Ramadan settings
    document.getElementById('ramadan-enabled').checked = settings.ramadan?.enabled || false;
    if (settings.ramadan?.enabled) {
        document.getElementById('ramadan-dates').classList.remove('hidden');
        if (settings.ramadan.startDate) {
            document.getElementById('ramadan-start').value = settings.ramadan.startDate.split('T')[0];
        }
        if (settings.ramadan.endDate) {
            document.getElementById('ramadan-end').value = settings.ramadan.endDate.split('T')[0];
        }
        const lead = settings.ramadan?.countdownLeadMinutes || {};
        document.getElementById('ramadan-lead-maghrib').value = lead.maghrib ?? 5;
        document.getElementById('ramadan-lead-fajr').value = lead.fajr ?? 15;
        document.getElementById('ramadan-lead-taraweeh').value = lead.taraweeh ?? 10;
    }
}

function setupEventListeners() {
    // Volume slider
    document.getElementById('athan-volume').addEventListener('input', (e) => {
        document.getElementById('volume-display').textContent = `${e.target.value}%`;
    });

    // Brightness slider
    document.getElementById('brightness').addEventListener('input', (e) => {
        document.getElementById('brightness-display').textContent = `${e.target.value}%`;
    });

    // Ramadan toggle
    document.getElementById('ramadan-enabled').addEventListener('change', (e) => {
        const ramadanDates = document.getElementById('ramadan-dates');
        if (e.target.checked) {
            ramadanDates.classList.remove('hidden');
        } else {
            ramadanDates.classList.add('hidden');
        }
    });

    // Auto-detect location
    document.getElementById('auto-detect-location').addEventListener('click', async () => {
        try {
            const response = await fetch('https://ipapi.co/json/');
            const data = await response.json();
            
            document.getElementById('latitude').value = data.latitude;
            document.getElementById('longitude').value = data.longitude;
            document.getElementById('city').value = `${data.city}, ${data.country_name}`;
            document.getElementById('timezone').value = data.timezone;
            
            showMessage('Location detected successfully!', 'success');
        } catch (error) {
            console.error('Error detecting location:', error);
            showMessage('Failed to detect location. Please enter manually.', 'error');
        }
    });

    // Auto-detect Ramadan using Hijri calendar
    document.getElementById('auto-detect-ramadan').addEventListener('click', () => {
        try {
            const hijriConverter = require('hijri-converter');
            const today = new Date();
            const hijri = hijriConverter.toHijri(today.getFullYear(), today.getMonth() + 1, today.getDate());
            if (hijri.hm === 9) {
                const ramadanStart = hijriConverter.toGregorian(hijri.hy, 9, 1);
                const ramadanEnd = hijriConverter.toGregorian(hijri.hy, 9, 30);
                const startDate = new Date(ramadanStart.gy, ramadanStart.gm - 1, ramadanStart.gd);
                const endDate = new Date(ramadanEnd.gy, ramadanEnd.gm - 1, ramadanEnd.gd);
                document.getElementById('ramadan-start').value = startDate.toISOString().split('T')[0];
                document.getElementById('ramadan-end').value = endDate.toISOString().split('T')[0];
                document.getElementById('ramadan-enabled').checked = true;
                document.getElementById('ramadan-dates').classList.remove('hidden');
                showMessage(`Ramadan detected! Currently day ${hijri.hd} of Ramadan ${hijri.hy} AH`, 'success');
            } else {
                const monthNames = [
                    'Muharram', 'Safar', 'Rabi al-Awwal', 'Rabi al-Thani',
                    'Jumada al-Awwal', 'Jumada al-Thani', 'Rajab', "Sha'ban",
                    'Ramadan', 'Shawwal', 'Dhul-Qadah', 'Dhul-Hijjah'
                ];
                showMessage(`Not currently Ramadan. Today is ${hijri.hd} ${monthNames[hijri.hm - 1]} ${hijri.hy} AH`, 'error');
            }
        } catch (e) {
            console.error('Auto-detect Ramadan:', e);
            showMessage('Auto-detect failed. Set dates manually or open settings from the app.', 'error');
        }
    });

    // Test athan (plays athan.mp3)
    document.getElementById('test-athan').addEventListener('click', () => {
        const volume = document.getElementById('athan-volume').value / 100;
        const audio = new Audio('http://localhost:3000/assets/athan/athan.mp3');
        audio.volume = volume;
        audio.play().catch(error => {
            console.error('Error playing test audio:', error);
            showMessage('Error playing test audio. Make sure assets/athan/athan.mp3 exists.', 'error');
        });
    });

    // Form submission
    document.getElementById('settings-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        await saveSettings();
    });
}

async function saveSettings() {
    const settings = {
        location: {
            city: document.getElementById('city').value,
            latitude: parseFloat(document.getElementById('latitude').value),
            longitude: parseFloat(document.getElementById('longitude').value),
            timezone: document.getElementById('timezone').value
        },
        calculationMethod: document.getElementById('calculation-method').value,
        timeAdjustments: {
            fajr: parseInt(document.getElementById('fajr-adjust').value) || 0,
            dhuhr: parseInt(document.getElementById('dhuhr-adjust').value) || 0,
            asr: parseInt(document.getElementById('asr-adjust').value) || 0,
            maghrib: parseInt(document.getElementById('maghrib-adjust').value) || 0,
            isha: parseInt(document.getElementById('isha-adjust').value) || 0
        },
        athan: {
            volume: parseInt(document.getElementById('athan-volume').value),
            playDuaAfter: document.getElementById('athan-play-dua-after').checked
        },
        display: {
            timeFormat: document.getElementById('time-format').value,
            brightness: parseInt(document.getElementById('brightness').value),
            nightModeStart: parseInt(document.getElementById('night-mode-start').value),
            nightModeEnd: parseInt(document.getElementById('night-mode-end').value),
            language: document.getElementById('language').value
        },
        ramadan: {
            enabled: document.getElementById('ramadan-enabled').checked,
            startDate: document.getElementById('ramadan-start').value || null,
            endDate: document.getElementById('ramadan-end').value || null,
            countdownLeadMinutes: {
                maghrib: parseInt(document.getElementById('ramadan-lead-maghrib').value, 10) || 5,
                fajr: parseInt(document.getElementById('ramadan-lead-fajr').value, 10) || 15,
                taraweeh: parseInt(document.getElementById('ramadan-lead-taraweeh').value, 10) || 10
            }
        }
    };

    try {
        const response = await fetch(`${API_BASE}/settings`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(settings)
        });

        const result = await response.json();
        
        if (result.success) {
            showMessage('Settings saved successfully!', 'success');
            currentSettings = settings;
        } else {
            showMessage('Failed to save settings.', 'error');
        }
    } catch (error) {
        console.error('Error saving settings:', error);
        showMessage('Error saving settings. Please try again.', 'error');
    }
}

function showMessage(message, type) {
    const messageEl = document.getElementById('save-message');
    messageEl.textContent = message;
    messageEl.className = `save-message ${type}`;
    messageEl.classList.remove('hidden');
    
    setTimeout(() => {
        messageEl.classList.add('hidden');
    }, 3000);
}
