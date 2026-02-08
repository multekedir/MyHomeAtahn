/**
 * Load and select one dua per event per day (deterministic rotation).
 * Event mapping: MAGHRIB → maghrib, FAJR → fajr, TARAWEEH → taraweeh
 * In Electron renderer we read from disk; otherwise try fetch (e.g. dev server).
 */
const path = require('path');
const fs = require('fs');

let duasByEvent = null;

async function loadDuas() {
  if (duasByEvent) return duasByEvent;
  if (loadDuasSync()) return duasByEvent;
  try {
    const res = await fetch('http://localhost:3000/assets/duas/ramadan_duas.json');
    if (!res.ok) throw new Error(res.statusText);
    const data = await res.json();
    duasByEvent = {
      maghrib: data.maghrib || [],
      fajr: data.fajr || [],
      taraweeh: data.taraweeh || []
    };
    return duasByEvent;
  } catch (e) {
    console.warn('Dua load failed:', e);
    duasByEvent = { maghrib: [], fajr: [], taraweeh: [] };
    return duasByEvent;
  }
}

const EVENT_TO_KEY = { MAGHRIB: 'maghrib', FAJR: 'fajr', TARAWEEH: 'taraweeh' };

/** Try to load from disk synchronously (Electron); call before getDuaForEvent if duos might not be loaded */
function loadDuasSync() {
  if (duasByEvent) return true;
  const candidates = [];
  if (typeof window !== 'undefined' && window.__APP_PATH__) {
    candidates.push(window.__APP_PATH__);
  }
  candidates.push(path.join(__dirname, '..', '..'));
  if (typeof process !== 'undefined' && process.cwd) {
    candidates.push(process.cwd());
  }
  for (const appPath of candidates) {
    try {
      const jsonPath = path.join(appPath, 'assets', 'duas', 'ramadan_duas.json');
      if (fs.existsSync(jsonPath)) {
        const raw = fs.readFileSync(jsonPath, 'utf8');
        const data = JSON.parse(raw);
        duasByEvent = {
          maghrib: data.maghrib || [],
          fajr: data.fajr || [],
          taraweeh: data.taraweeh || []
        };
        return true;
      }
    } catch (e) {
      // try next path
    }
  }
  return false;
}

/**
 * @param {string} eventType - "MAGHRIB" | "FAJR" | "TARAWEEH"
 * @param {string} dateKey - "YYYY-MM-DD"
 * @returns {{ arabic: string, transliteration: string } | null}
 */
function getDuaForEvent(eventType, dateKey) {
  if (!duasByEvent) loadDuasSync();
  const key = EVENT_TO_KEY[eventType];
  if (!key || !duasByEvent) return null;
  const list = duasByEvent[key];
  if (!list || list.length === 0) return null;
  const dayHash = dateKey.split('-').reduce((a, b) => a + parseInt(b, 10), 0);
  const index = dayHash % list.length;
  return list[index];
}

module.exports = { loadDuas, loadDuasSync, getDuaForEvent };
