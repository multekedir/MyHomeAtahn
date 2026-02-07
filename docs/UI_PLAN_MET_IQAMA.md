# UI Implementation Plan — MET Mosque Frame (Adhan + Iqama)

This document maps the product spec to **this codebase** (Electron + HTML/CSS/JS in `renderer/`).

---

## Layout Blueprint (Landscape)

| Zone | Height | Contents |
|------|--------|----------|
| **Top** | 10–15% | HeaderBar: masjid name (left) + last updated (right) |
| **Main** | 55–60% | HeroClock: time, next prayer + countdown, date line, divider |
| **Bottom** | 25–30% | PrayerStrip: 5 tiles × (name, Adhan big, Iqama small) |

---

## UI Components → Files

| Component | Purpose | Implementation |
|-----------|---------|----------------|
| **FrameBackground** | Base color, pattern overlay, vignette | `renderer/themes/earthy-frame/theme.css` (body, .pattern, body::after). Optional: `frame-mask.svg` if desired. |
| **HeaderBar** | Masjid name + “Updated YYYY-MM” | **New:** `<header class="header-bar">` in `index.html`; styles in `theme.css`. Left: “MET Mosque”, right: “Updated Feb 2026”. |
| **HeroClock** | Current time, next prayer + countdown, date line, divider | **Existing** `.top-block` in `index.html` (#current-time, next-prayer area, #dateLine, .clock-divider). Sizing in `theme.css` (time 96–120px, next 40–52px, date 20–26px). |
| **PrayerStrip** | Row of 5 prayer tiles | **Existing** `.prayerBar` in `index.html`. **Change:** each tile shows name + Adhan (big) + Iqama (small). |
| **PrayerTile** | One prayer: name, adhan time, iqama time, isNext | **Existing** `.prayerCell`. **Add:** `.prayerAdhan`, `.prayerIqama`. **Existing** `.prayerCell.next` for highlight. Optional: dot indicator, “Iqama in Xm” when &lt;20 min. |

---

## Typography Scale (theme.css)

| Element | Size (approx) |
|---------|----------------|
| Time | 96–120 px |
| Next prayer + countdown | 40–52 px |
| Date line | 20–26 px |
| Tile Adhan | 34–44 px |
| Tile Iqama | 18–22 px |
| Tile labels (name) | 16–18 px |

---

## Data Flow

1. **On load:** `clock.js` calls `masjidScheduleAgent.getMonthSchedule(masjidId, new Date())` → cache or fetch monthly API.
2. **Today:** `prayerTimesResolver.getTodayPrayerTimes(date, month)` → `NormalizedDay` (adhan + iqama per prayer).
3. **Display:** Use MET adhan/iqama for the strip when available; fallback to calculated adhan-only (existing `PrayerCalculator`). Next-prayer highlight and countdown can stay on calculated times or be driven by MET (spec: “next prayer” = next adhan).
4. **Cache:** One JSON file per month under `config/` (e.g. `masjid_149c83b3250e_2026-02.json`). Fetch once per month; reuse until month change.

---

## File Changes Summary

| File | Action |
|------|--------|
| `renderer/index.html` | Add HeaderBar; add `.prayerIqama` in each `.prayerCell`; optional next-prayer line under hero. |
| `renderer/themes/earthy-frame/theme.css` | Header bar styles; .prayerAdhan / .prayerIqama sizes; keep brass accent for .next. |
| `renderer/clock.js` | Require MET schedule agent + resolver; on init load month → today; in `updatePrayerTimes()` / tile render use MET adhan+iqama when present. |
| **New** `renderer/services/masjidConfig.js` | MASJID_ID, BASE_URL, TIMEZONE. |
| **New** `renderer/services/monthKey.js` | getMonthKey(date), getDateKey(date). |
| **New** `renderer/services/masjidScheduleClient.js` | fetchMonthlySchedule(masjidId, monthKey), timeout 8–10s. |
| **New** `renderer/services/masjidScheduleCache.js` | loadNormalized, saveMonth, isMonthCached (config dir). |
| **New** `renderer/services/masjidScheduleNormalizer.js` | normalizeMonth(raw, monthKey, masjidId) → NormalizedMonth; API uses fajr, duhr, asr, maghrib, isha; each { adhan, iqama }. |
| **New** `renderer/services/masjidScheduleAgent.js` | getMonthSchedule(masjidId, date) → cache or fetch → normalized. |
| **New** `renderer/services/prayerTimesResolver.js` | getTodayPrayerTimes(date, month), getNextPrayer(now, today). |

---

## Interaction Rules (frame-like)

- No buttons, no scrolling.
- Only auto-refresh (clock tick, month change triggers refetch).
- Optional later: tap tile to toggle “Iqama 5:40” vs “Iqama in 14m”.

---

## API Response Shape (for normalizer)

- `masjid`, `yearMonth` (e.g. "2026-02"), `days` (array).
- Each day: `day` ("01".."31"), `date` (e.g. "Friday, Feb 06, 2026"), `fajr`/`duhr`/`asr`/`maghrib`/`isha` each `{ adhan: "6:02 AM", iqama: "6:12 AM" }`.
- Map `duhr` → `dhuhr`. Build date key as `yearMonth + "-" + day` → "2026-02-06".
