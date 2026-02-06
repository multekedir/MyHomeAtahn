const { app, BrowserWindow, globalShortcut } = require('electron');
const path = require('path');
const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');

let mainWindow;
let settingsServer;
let settingsHttpServer;
const SETTINGS_PORT = 3000;

// Ensure config directory exists
const configDir = path.join(__dirname, 'config');
if (!fs.existsSync(configDir)) {
  fs.mkdirSync(configDir, { recursive: true });
}

// Default settings (system time; location for prayer times)
const defaultSettings = {
  location: {
    city: 'Portland',
    latitude: 45.4619489360556,
    longitude: -122.80151735583487
    // no timezone = use system/local time for clock and date
  },
  calculationMethod: 'MuslimWorldLeague',
  timeAdjustments: {
    fajr: 0,
    dhuhr: 0,
    asr: 0,
    maghrib: 0,
    isha: 0
  },
  athan: {
    default: 'makkah.mp3',
    fajr: 'makkah.mp3',
    volume: 80
  },
  display: {
    timeFormat: '12',
    brightness: 100,
    nightModeStart: 22,
    nightModeEnd: 6,
    language: 'en'
  },
  ramadan: {
    enabled: false,
    startDate: null,
    endDate: null
  }
};

// Load settings from file
function loadSettings() {
  const settingsPath = path.join(configDir, 'settings.json');
  try {
    if (fs.existsSync(settingsPath)) {
      const data = fs.readFileSync(settingsPath, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error loading settings:', error);
  }
  return defaultSettings;
}

// Save settings to file
function saveSettings(settings) {
  const settingsPath = path.join(configDir, 'settings.json');
  try {
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
    return true;
  } catch (error) {
    console.error('Error saving settings:', error);
    return false;
  }
}

  // Start Express server for settings
function startSettingsServer() {
  settingsServer = express();
  settingsServer.use(bodyParser.json());
  settingsServer.use(express.static(path.join(__dirname, 'renderer', 'settings')));
  
  // Serve assets directory
  settingsServer.use('/assets', express.static(path.join(__dirname, 'assets')));

  // CORS middleware
  settingsServer.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    next();
  });

  // Get settings
  settingsServer.get('/api/settings', (req, res) => {
    const settings = loadSettings();
    res.json(settings);
  });

  // Save settings
  settingsServer.post('/api/settings', (req, res) => {
    const settings = req.body;
    if (saveSettings(settings)) {
      // Notify main window to reload settings
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('settings-updated', settings);
      }
      res.json({ success: true });
    } else {
      res.status(500).json({ success: false, error: 'Failed to save settings' });
    }
  });

  settingsHttpServer = settingsServer.listen(SETTINGS_PORT, () => {
    console.log(`Settings server running on http://localhost:${SETTINGS_PORT}`);
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1920,
    height: 1080,
    fullscreen: true,
    frame: false,
    kiosk: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true
    },
    backgroundColor: '#1a1a1a'
  });

  // Make app path available globally
  mainWindow.webContents.executeJavaScript(`
    window.__APP_PATH__ = ${JSON.stringify(__dirname)};
  `);

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  // Prevent window from closing
  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
    }
  });

  // Register global shortcuts
  globalShortcut.register('F11', () => {
    mainWindow.setFullScreen(!mainWindow.isFullScreen());
  });

  globalShortcut.register('CommandOrControl+Q', () => {
    app.isQuitting = true;
    app.quit();
  });

  globalShortcut.register('CommandOrControl+S', () => {
    // Open settings in default browser
    const { shell } = require('electron');
    shell.openExternal(`http://localhost:${SETTINGS_PORT}/settings.html`);
  });

  globalShortcut.register('CommandOrControl+R', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.reload();
    }
  });

  // Prevent screen sleep (Linux)
  if (process.platform === 'linux') {
    const { exec } = require('child_process');
    exec('xset s off && xset -dpms && xset s noblank', (error) => {
      if (error) {
        console.error('Error preventing screen sleep:', error);
      }
    });
  }
}

app.whenReady().then(() => {
  startSettingsServer();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  if (settingsHttpServer) {
    settingsHttpServer.close();
  }
});

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});
