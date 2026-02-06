# Quick Start Guide

## Prerequisites

- Node.js 16+ installed
- Linux operating system
- Audio output device

## Installation Steps

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Add audio files:**
   - Place MP3 athan files in `assets/athan/`:
     - `makkah.mp3`
     - `madinah.mp3`
     - `mishary.mp3`
     - `abdulbasit.mp3`
   - Place notification sound in `assets/sounds/notification.mp3`

3. **Run the application:**
   ```bash
   npm start
   ```

4. **Configure settings:**
   - Open `http://localhost:3000/settings.html` in your browser
   - Enter your location (latitude/longitude)
   - Select calculation method
   - Configure audio settings
   - Save settings

5. **Enable auto-start (optional):**
   ```bash
   chmod +x scripts/install.sh
   ./scripts/install.sh
   sudo systemctl enable athan-clock.service
   sudo systemctl start athan-clock.service
   ```

## Testing

1. **Test clock display:**
   - Application should launch in fullscreen
   - Current time should display and update every second
   - Prayer times should be calculated and displayed

2. **Test settings:**
   - Open settings page
   - Change location
   - Save and verify changes apply

3. **Test athan playback:**
   - Wait for a prayer time or manually trigger
   - Audio should play with fade-in
   - Display should switch to athan view

## Troubleshooting

- **Audio not playing:** Check audio files exist and system audio is working
- **Prayer times wrong:** Verify location coordinates in settings
- **Settings not saving:** Check `config/` directory is writable
- **Application crashes:** Check Node.js version (needs 16+)

## Keyboard Shortcuts

- `F11` - Toggle fullscreen
- `Ctrl+Q` - Quit
- `Ctrl+S` - Open settings
- `Ctrl+R` - Reload
