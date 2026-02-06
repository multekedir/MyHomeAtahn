# 🕌 Athan Clock - Stationary Linux Prayer Clock Application

A fullscreen web-based athan (Islamic prayer call) clock application for Linux that runs as a dedicated, always-on display. Perfect for Raspberry Pi or any Linux desktop system.

## Features

- ⏰ **Large, Clear Display**: 180px time display, readable from 10+ feet away
- 🕌 **Automatic Prayer Times**: Calculates all 5 daily prayers using multiple calculation methods
- 🔊 **Athan Playback**: Plays athan automatically at prayer times with fade-in audio
- 🌙 **Ramadan Mode**: Special display with Iftar countdown and Suhoor warnings
- ⚙️ **Web Settings Interface**: Configure everything via browser at `http://localhost:3000/settings.html`
- 🚀 **Auto-Start**: Runs automatically on system boot via systemd
- 💤 **Sleep Prevention**: Prevents screen sleep and screensaver activation

## Screenshots

### Main Clock Display
```
┌──────────────────────────────────────────┐
│                                          │
│            3:45:32 PM                    │
│         (Very large, centered)           │
│                                          │
│         Next: Asr in 1:23:15            │
│         (Medium size, centered)          │
│                                          │
│   Fajr    Dhuhr    Asr    Maghrib  Isha│
│   5:42am  12:34pm  3:45pm  6:12pm  7:45pm│
│    ✓                                     │
│                                          │
│   Thursday, Sha'ban 15, 1447 AH         │
│   February 6, 2026                       │
│                                          │
└──────────────────────────────────────────┘
```

## Requirements

- **Operating System**: Linux (tested on Ubuntu, Debian, Raspberry Pi OS)
- **Node.js**: Version 16 or higher
- **Display**: Any monitor or touchscreen (recommended: 7-10" for Raspberry Pi)
- **Audio**: Speakers or audio output device

## Installation

### Quick Install

1. **Clone the repository:**
   ```bash
   git clone https://github.com/multekedir/MyHomeAtahn.git
   cd MyHomeAtahn
   ```

2. **Run the installation script:**
   ```bash
   chmod +x scripts/install.sh
   ./scripts/install.sh
   ```

3. **Add Athan Audio Files:**
   Place your athan MP3 files in the `assets/athan/` directory:
   - `makkah.mp3`
   - `madinah.mp3`
   - `mishary.mp3`
   - `abdulbasit.mp3`

4. **Test the application:**
   ```bash
   cd ~/athan-clock
   npm start
   ```

5. **Configure settings:**
   Open `http://localhost:3000/settings.html` in any browser on your network

6. **Enable auto-start:**
   ```bash
   sudo systemctl enable athan-clock.service
   sudo systemctl start athan-clock.service
   ```

### Manual Installation

If you prefer to install manually:

```bash
# Install dependencies
npm install

# Create necessary directories
mkdir -p assets/athan assets/sounds config

# Copy systemd service (adjust paths)
sudo cp scripts/athan-clock.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable athan-clock.service
```

## Configuration

### Settings Interface

Access the settings at `http://localhost:3000/settings.html` from any device on your network.

**Location Settings:**
- Enter your city name, latitude, and longitude
- Use "Auto-detect Location" to get coordinates from your IP
- Timezone is auto-detected

**Calculation Methods:**
- ISNA (North America)
- Muslim World League (default)
- Egyptian
- Umm al-Qura
- Karachi

**Time Adjustments:**
- Adjust each prayer time by -15 to +15 minutes to match your local mosque

**Athan Audio:**
- Select default athan for all prayers
- Choose separate athan for Fajr (typically softer)
- Adjust volume (0-100%)
- Test playback before saving

**Display Settings:**
- 12-hour or 24-hour time format
- Screen brightness control
- Night mode schedule
- Language selection

**Ramadan Mode:**
- Enable/disable Ramadan mode
- Set start and end dates
- Auto-detect Ramadan dates (approximate)

## Usage

### Running the Application

**Development mode:**
```bash
npm start
```

**Production mode (fullscreen):**
```bash
npm start
```

The application will automatically:
- Launch in fullscreen mode
- Calculate prayer times based on your location
- Display current time with countdown to next prayer
- Play athan at exact prayer times
- Show Ramadan-specific features when enabled

### Keyboard Shortcuts

- **F11**: Toggle fullscreen mode
- **Ctrl+Q**: Quit application
- **Ctrl+S**: Open settings in browser
- **Ctrl+R**: Reload/refresh application

### System Service

**Start service:**
```bash
sudo systemctl start athan-clock.service
```

**Stop service:**
```bash
sudo systemctl stop athan-clock.service
```

**Check status:**
```bash
sudo systemctl status athan-clock.service
```

**View logs:**
```bash
journalctl -u athan-clock.service -f
```

## Features in Detail

### Prayer Time Calculation

Uses the `adhan` library with support for multiple calculation methods:
- Accurate calculations based on latitude/longitude
- Automatic recalculation at midnight
- Support for custom time adjustments

### Athan Playback

- Automatic playback at exact prayer times
- Fade-in audio (2 seconds)
- Fullscreen athan display during playback
- Returns to clock display after completion (2-3 minutes)
- Visual pulsing animation during playback

### Pre-Prayer Warnings

- **10 minutes before**: Countdown turns orange with gentle pulse
- **2 minutes before**: Countdown turns red with faster pulse
- Optional notification sound at 10 minutes

### Ramadan Mode

When enabled:
- Shows "Ramadan Day X/30" at top
- Prominent Iftar countdown (time until Maghrib)
- Labels Fajr as "Suhoor ends"
- Labels Maghrib as "Iftar"
- Suhoor warnings 30, 15, 10, and 5 minutes before Fajr
- Iftar dua display at Maghrib time

### Display Features

- Large, readable fonts (180px time, 70px countdown)
- Dark theme (#1a1a1a background, #f5f5dc text)
- Checkmarks (✓) next to completed prayers
- Both Hijri and Gregorian dates
- Responsive layout

## File Structure

```
athan-clock/
├── main.js                 # Electron main process
├── package.json            # Dependencies and scripts
├── renderer/
│   ├── index.html         # Main clock display
│   ├── clock.js           # Clock logic and updates
│   ├── prayer.js          # Prayer calculation logic
│   ├── styles.css         # Main styling
│   └── settings/
│       ├── settings.html  # Settings interface
│       ├── settings.js    # Settings logic
│       └── settings.css  # Settings styling
├── assets/
│   ├── athan/            # Athan audio files (MP3)
│   └── sounds/           # Notification sounds
├── config/
│   └── settings.json     # User settings (auto-generated)
└── scripts/
    ├── install.sh        # Installation script
    └── athan-clock.service # Systemd service file
```

## Troubleshooting

### Audio Not Playing

1. Check that audio files exist in `assets/athan/`
2. Verify audio system is working: `aplay /usr/share/sounds/alsa/Front_Left.wav`
3. Check volume settings in the settings interface
4. Ensure audio files are in MP3 format

### Prayer Times Incorrect

1. Verify your location coordinates in settings
2. Try a different calculation method
3. Use time adjustments to match your local mosque
4. Check that system time is correct: `date`

### Application Won't Start

1. Check Node.js version: `node -v` (should be 16+)
2. Reinstall dependencies: `npm install`
3. Check logs: `journalctl -u athan-clock.service -n 50`
4. Verify Electron is installed: `npm list electron`

### Screen Sleep Issues

1. Run manually: `xset s off && xset -dpms && xset s noblank`
2. Add to `~/.xprofile` or `~/.xinitrc`
3. For systemd, ensure DISPLAY environment is set correctly

### Settings Not Saving

1. Check that `config/` directory exists and is writable
2. Verify settings server is running (check port 3000)
3. Check browser console for errors
4. Ensure CORS is enabled (should be automatic)

## Development

### Project Structure

- **main.js**: Electron main process, handles window creation and system integration
- **renderer/clock.js**: Main clock logic, updates display every second
- **renderer/prayer.js**: Prayer time calculations using adhan library
- **renderer/settings/**: Web-based settings interface

### Adding Custom Features

1. Modify `renderer/clock.js` for display logic
2. Update `renderer/styles.css` for styling
3. Add new settings in `renderer/settings/settings.html`
4. Update API in `main.js` if needed

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Support

For issues, questions, or feature requests, please open an issue on GitHub.

## Acknowledgments

- Uses [adhan](https://github.com/batoulapps/adhan-js) library for prayer time calculations
- Built with [Electron](https://www.electronjs.org/) for cross-platform desktop apps

---

**May this application help you maintain your prayer schedule. Barakallahu feekum! 🙏**
