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
    document.getElementById('default-athan').value = settings.athan?.default || 'makkah.mp3';
    document.getElementById('fajr-athan').value = settings.athan?.fajr || 'makkah.mp3';
    document.getElementById('athan-volume').value = settings.athan?.volume || 80;
    document.getElementById('volume-display').textContent = `${settings.athan?.volume || 80}%`;

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

    // Auto-detect Ramadan
    document.getElementById('auto-detect-ramadan').addEventListener('click', () => {
        // Simplified - in production, use proper Hijri calendar
        const currentYear = new Date().getFullYear();
        // Approximate Ramadan dates (would need proper calculation)
        const ramadanStart = new Date(currentYear, 2, 1); // March 1st (example)
        const ramadanEnd = new Date(currentYear, 2, 30); // March 30th (example)
        
        document.getElementById('ramadan-start').value = ramadanStart.toISOString().split('T')[0];
        document.getElementById('ramadan-end').value = ramadanEnd.toISOString().split('T')[0];
        
        showMessage('Ramadan dates set (approximate). Please verify.', 'success');
    });

    // Test athan
    document.getElementById('test-athan').addEventListener('click', () => {
        const audioFile = document.getElementById('default-athan').value;
        const volume = document.getElementById('athan-volume').value / 100;
        
        // Use absolute path for settings page
        const audio = new Audio(`http://localhost:3000/assets/athan/${audioFile}`);
        audio.volume = volume;
        audio.play().catch(error => {
            console.error('Error playing test audio:', error);
            showMessage('Error playing test audio. Make sure audio files are in assets/athan/', 'error');
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
            default: document.getElementById('default-athan').value,
            fajr: document.getElementById('fajr-athan').value,
            volume: parseInt(document.getElementById('athan-volume').value)
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
            endDate: document.getElementById('ramadan-end').value || null
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
