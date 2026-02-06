# 🕌 Athan Clock – Prayer Time Display

A fullscreen **athan (Islamic prayer) clock** built with Electron. Designed as a calm, readable display for the living room or desk—time, date (Gregorian + Hijri), and five daily prayer times in one view.

Runs on **macOS**, **Linux** (including Raspberry Pi), and **Windows**.

## Features

- ⏰ **Large clock** – System time by default; optional timezone in settings
- 📅 **Date line** – Gregorian + Hijri (e.g. *Mon, Apr 15 • 15 Sha'ban 1447 AH*)
- 🕌 **Five daily prayers** – Fajr, Dhuhr, Asr, Maghrib, Isha with calculated times
- 🔊 **Athan playback** – Plays selected MP3 at prayer time (fade-in, fullscreen)
- 🌙 **Ramadan mode** – Iftar/Suhoor labels, countdown, optional warnings
- ⚙️ **Web settings** – Configure location, method, timezone, audio at `http://localhost:3000/settings.html`
- 🎨 **Earthy Frame theme** – Gradient background, subtle Islamic pattern, glass-style prayer strip
- 🚀 **Auto-start (Linux)** – systemd service for boot and kiosk use

## Quick Start

```bash
git clone https://github.com/multekedir/MyHomeAtahn.git
cd MyHomeAtahn

make install    # or: npm install
make start      # or: npm start
```

**Settings:** While the app is running, open **http://localhost:3000/settings.html** in a browser, or press **Ctrl+S** (Mac: **Cmd+S**) in the app.

**Audio:** Add MP3 files to `assets/athan/` (e.g. `makkah.mp3`, `madinah.mp3`) and optionally `assets/sounds/notification.mp3`. See `assets/athan/README.md`.

## Requirements

- **Node.js** 16+
- **Electron** (installed via `npm install`)

## Makefile Targets

| Command | Description |
|--------|-------------|
| `make` / `make help` | Show all targets |
| `make install` | Install npm dependencies |
| `make start` | Start the app (fullscreen) |
| `make dev` | Start with dev flag |
| `make setup` | Run full install script (Linux) |
| `make install-service` | Install systemd service (Linux) |
| `make uninstall-service` | Remove systemd service |
| `make status` | Service status (Linux) |
| `make logs` | Follow service logs (Linux) |
| `make clean` | Remove node_modules and config JSON |
| `make test` | Placeholder for tests |

On **macOS**, `install-service`, `uninstall-service`, `status`, and `logs` do not apply; the app runs normally with `make start`.

## Configuration

**Location & time**

- **System time by default** – Clock and date use your computer’s timezone.
- To use a fixed timezone (e.g. while traveling), set **Timezone** in Settings (e.g. `America/Los_Angeles`, `Europe/London`).
- Default location (for prayer times) is Portland, OR area; set your city/coordinates in Settings or use “Auto-detect Location”.

**Calculation methods:** ISNA (North America), Muslim World League, Egyptian, Umm al-Qura, Karachi.

**Time adjustments:** Per-prayer ±15 minutes to match your local mosque.

**Athan:** Choose default and Fajr audio files, volume, and test playback from Settings.

## Keyboard Shortcuts

- **F11** – Toggle fullscreen  
- **Ctrl+Q** / **Cmd+Q** – Quit  
- **Ctrl+S** / **Cmd+S** – Open settings in browser  
- **Ctrl+R** / **Cmd+R** – Reload app  

## File Structure

```
├── main.js                    # Electron main process, settings API
├── package.json
├── Makefile
├── renderer/
│   ├── index.html             # Main clock UI
│   ├── clock.js               # Clock, date, next-prayer highlight
│   ├── prayer.js              # Prayer times (adhan lib), Hijri
│   ├── styles.css             # Base styles
│   └── themes/
│       └── earthy-frame/      # Theme: gradient, pattern, glass bar
│           ├── theme.css
│           └── pattern.svg
│   └── settings/              # Web settings UI
├── assets/
│   ├── athan/                 # Athan MP3s (makkah.mp3, etc.)
│   └── sounds/                # notification.mp3
├── config/
│   └── settings.json          # Saved settings (created at run)
└── scripts/
    ├── install.sh             # Linux install
    └── athan-clock.service    # systemd unit
```

## Linux: Run on Boot

```bash
make setup              # install app and service
make install-service    # enable systemd service
sudo systemctl start athan-clock.service
```

Screen sleep prevention (e.g. `xset`) runs when the app starts on Linux.

## Troubleshooting

- **Time wrong** – Use system time (leave timezone empty in Settings) or set the correct timezone (e.g. `America/Los_Angeles`).
- **Prayer times wrong** – Check location (lat/long) and calculation method in Settings; use time adjustments if needed.
- **No audio** – Ensure MP3s exist in `assets/athan/` and volume is set in Settings.
- **Pattern not visible** – Theme uses `renderer/themes/earthy-frame/pattern.svg`; ensure the file exists and the app was reloaded.

## Tech

- [Electron](https://www.electronjs.org/) – Desktop app
- [adhan](https://github.com/batoulapps/adhan-js) – Prayer time calculation
- [hijri-converter](https://www.npmjs.com/package/hijri-converter) – Hijri dates

## License

MIT.

---

**Barakallahu feekum.**
