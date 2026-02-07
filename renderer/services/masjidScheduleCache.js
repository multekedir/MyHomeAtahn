/**
 * Cache normalized monthly schedule to disk (config folder).
 * Key: masjid_{id}_month_{YYYY-MM}.json
 */
const fs = require('fs');
const path = require('path');

const configDir = path.join(__dirname, '..', '..', 'config');
const CACHE_PREFIX = 'masjid';
const CACHE_SUFFIX = '.json';

function cachePath(masjidId, monthKey) {
  const name = `${CACHE_PREFIX}_${masjidId}_${monthKey.replace('-', '_')}${CACHE_SUFFIX}`;
  return path.join(configDir, name);
}

function loadNormalized(masjidId, monthKey) {
  try {
    const filePath = cachePath(masjidId, monthKey);
    if (!fs.existsSync(filePath)) return null;
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

function saveMonth(masjidId, monthKey, normalized) {
  try {
    if (!fs.existsSync(configDir)) fs.mkdirSync(configDir, { recursive: true });
    const filePath = cachePath(masjidId, monthKey);
    fs.writeFileSync(filePath, JSON.stringify(normalized, null, 2), 'utf8');
  } catch (e) {
    console.error('Masjid schedule cache save error:', e);
  }
}

function isMonthCached(masjidId, monthKey) {
  const filePath = cachePath(masjidId, monthKey);
  return fs.existsSync(filePath);
}

module.exports = { loadNormalized, saveMonth, isMonthCached, cachePath };
