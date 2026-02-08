/**
 * Play soft chime only when entering AT_TIME for Maghrib and Taraweeh. Fajr silent.
 * Uses settings server URL so renderer can load chime.mp3 from assets/athan/.
 */
let chimeAudio = null;

function playEventChime(eventType) {
  if (eventType === 'FAJR') return;
  if (eventType !== 'MAGHRIB' && eventType !== 'TARAWEEH') return;
  try {
    if (!chimeAudio) {
      chimeAudio = new Audio('http://localhost:3000/assets/athan/chime.mp3');
    }
    chimeAudio.currentTime = 0;
    chimeAudio.volume = 0.5;
    chimeAudio.play().catch(() => {});
  } catch (e) {
    console.warn('Chime play failed:', e);
  }
}

module.exports = { playEventChime };
