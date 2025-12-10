import { initCursor, drawCursor, getCursorCenter, setGameCursor, drawCursorHitbox, setCustomCursorImage, getCursorPosition } from "./cursor.js";
import {
  initHazards,
  onResize as hazardsOnResize,
  resetHazards,
  updateHazards,
  drawHazards,
  triggerAllPendingHazards,
  checkHazardCollisions,
  triggerBarrageWave,
  setDeathMode,
  triggerLargeSawPunishment,
} from "./hazards.js";
import { initStartScreen, hideStartScreenForGame, showStartScreenAfterDeath, refreshTimeFormatting } from "./startScreen.js";
import { formatTimeSeconds } from "./utils.js";
import { initAudio, playPlayerExplosionSound, playTypingSound, setSfxVolume, setMusicVolume, setCustomMusicUrl } from "./sounds.js";

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const timerEl = document.getElementById("timer");

// Settings controls
const settingsSfxRangeEl = document.getElementById("settingsSfxRange");
const settingsMusicRangeEl = document.getElementById("settingsMusicRange");
const settingsHitboxCheckboxEl = document.getElementById("settingsHitboxCheckbox");
const settingsTimerStyleEl = document.getElementById("settingsTimerStyle");
const settingsMusicFileEl = document.getElementById("settingsMusicFile");
const settingsMusicFileButtonEl = document.getElementById("settingsMusicFileButton");
const settingsCursorFileEl = document.getElementById("settingsCursorFile");
const settingsCursorFileButtonEl = document.getElementById("settingsCursorFileButton");
const settingsViewOtherCursorsCheckboxEl = document.getElementById("settingsViewOtherCursorsCheckbox");
const settingsResetButtonEl = document.getElementById("settingsResetButton");

const SETTINGS_STORAGE_KEY = "cursorDeathSettings_v1";

// Death screen elements
const deathScreenEl = document.getElementById("deathScreen");
const deathTimeValueEl = document.getElementById("deathTimeValue");
const deathPlaceEl = document.getElementById("deathPlace");
const deathMessageEl = document.getElementById("deathMessage");
const deathClickHintEl = document.getElementById("deathClickHint");

// Death count element
const deathCountEl = document.getElementById("deathCount");

// Multiplayer / records setup
const room = new WebsimSocket();
await room.initialize();
const currentUser = await window.websim.getCurrentUser();

// banned users (no leaderboard visibility, scores ignored)
const BANNED_USERNAMES = new Set([
  "frosty_",
  "manfope",
  "thepersonwitharedexclamationmark",
  "schweller",
  "nguyen",
  "nguyens",
  "blueryellow",
  "forgetfulnight6857758",
  "easyglitter4827354",
  "cursordeath",
]);

function isBannedUsername(username) {
  if (!username) return false;
  return BANNED_USERNAMES.has(String(username).toLowerCase());
}

initAudio(); // prepare audio system once we have JS running

let showHitbox = false;
let timerStyle = "classic"; // "classic" | "minutes"
let customCursorUrl = null;
let customMusicUrl = null;

// History of other players' cursor positions for delayed rendering
// Map<clientId, Array<{ x: number, y: number, t: number }>>
const otherCursorHistory = new Map();

// Simple image cache for other players' cursor sprites
const otherCursorImageCache = new Map();
const DEFAULT_CURSOR_SRC = "/cursor.png";

function getOtherCursorImage(url) {
  const src = url && typeof url === "string" ? url : DEFAULT_CURSOR_SRC;
  if (otherCursorImageCache.has(src)) {
    return otherCursorImageCache.get(src);
  }
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.src = src;
  otherCursorImageCache.set(src, img);
  return img;
}

// helper for timer formatting based on chosen style
function formatTimerValue(sec) {
  if (timerStyle === "minutes") {
    const totalMs = Math.max(0, sec) * 1000;
    const totalMsInt = Math.floor(totalMs);
    const minutes = Math.floor(totalMsInt / 60000);
    const remainingMs = totalMsInt % 60000;
    const seconds = Math.floor(remainingMs / 1000);
    const ms = remainingMs % 1000;

    const mm = String(minutes).padStart(2, "0");
    const ss = String(seconds).padStart(2, "0");
    const mmm = String(ms).padStart(3, "0");
    return `${mm}:${ss}.${mmm}`;
  }
  // classic: seconds + centiseconds
  return formatTimeSeconds(sec);
}

function loadSettings() {
  // defaults
  let sfx = 1.0;
  let music = 0.1;
  let hitbox = false;
  let style = "classic";
  let cursorUrl = null;
  let musicUrl = null;

  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (typeof parsed.sfx === "number") sfx = Math.max(0, Math.min(1, parsed.sfx));
      if (typeof parsed.music === "number") music = Math.max(0, Math.min(1, parsed.music));
      if (typeof parsed.showHitbox === "boolean") hitbox = parsed.showHitbox;
      if (parsed.timerStyle === "minutes" || parsed.timerStyle === "classic") {
        style = parsed.timerStyle;
      }
      if (typeof parsed.cursorUrl === "string") {
        cursorUrl = parsed.cursorUrl;
      }
      if (typeof parsed.musicUrl === "string") {
        musicUrl = parsed.musicUrl;
      }
    }
  } catch (e) {
    console.error("Failed to load settings", e);
  }

  // apply to audio / visuals
  setSfxVolume(sfx);
  setMusicVolume(music);
  showHitbox = hitbox;
  timerStyle = style;
  customCursorUrl = cursorUrl;
  customMusicUrl = musicUrl;

  if (customCursorUrl) {
    setCustomCursorImage(customCursorUrl);
  } else {
    setCustomCursorImage(null);
  }

  if (customMusicUrl) {
    setCustomMusicUrl(customMusicUrl);
  } else {
    setCustomMusicUrl(null);
  }

  // apply to UI if present
  if (settingsSfxRangeEl) {
    settingsSfxRangeEl.value = String(Math.round(sfx * 100));
  }
  if (settingsMusicRangeEl) {
    settingsMusicRangeEl.value = String(Math.round(music * 100));
  }
  if (settingsHitboxCheckboxEl) {
    settingsHitboxCheckboxEl.checked = hitbox;
  }
  if (settingsTimerStyleEl) {
    settingsTimerStyleEl.value = style;
  }
  // Set default button labels when using built-in assets (no custom files)
  if (settingsMusicFileButtonEl && !customMusicUrl) {
    // Show the default music name when no custom music is set
    settingsMusicFileButtonEl.textContent = "Resonance";
  }
  if (settingsCursorFileButtonEl && !customCursorUrl) {
    // Show the default cursor image name when no custom cursor is set
    settingsCursorFileButtonEl.textContent = "Cursor.png";
  }
  // Leave custom button labels as whatever was set when user picked a file
}

function saveSettings() {
  try {
    const sfxVal =
      settingsSfxRangeEl ? (Number(settingsSfxRangeEl.value) || 0) / 100 : 1.0;
    const musicVal =
      settingsMusicRangeEl ? (Number(settingsMusicRangeEl.value) || 0) / 100 : 0.1;
    const hitboxVal = !!showHitbox;
    const styleVal =
      settingsTimerStyleEl && (settingsTimerStyleEl.value === "minutes" || settingsTimerStyleEl.value === "classic")
        ? settingsTimerStyleEl.value
        : timerStyle;

    const payload = {
      sfx: Math.max(0, Math.min(1, sfxVal)),
      music: Math.max(0, Math.min(1, musicVal)),
      showHitbox: hitboxVal,
      timerStyle: styleVal,
      cursorUrl: customCursorUrl || null,
      musicUrl: customMusicUrl || null,
    };
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(payload));
  } catch (e) {
    console.error("Failed to save settings", e);
  }
}

/**
 * Reset all settings (volumes, gameplay options, custom music/cursor)
 * back to their default values and clear stored preferences.
 */
function resetSettingsToDefaults() {
  try {
    localStorage.removeItem(SETTINGS_STORAGE_KEY);
  } catch (e) {
    console.error("Failed to clear settings from storage", e);
  }

  // Core defaults
  const defaultSfx = 1.0;       // 100%
  const defaultMusic = 0.1;     // 10%
  const defaultHitbox = false;  // off
  const defaultTimerStyle = "classic";

  // Apply to internal state
  setSfxVolume(defaultSfx);
  setMusicVolume(defaultMusic);
  showHitbox = defaultHitbox;
  timerStyle = defaultTimerStyle;
  customCursorUrl = null;
  customMusicUrl = null;

  // Reset visuals for cursor and music back to built-in assets
  setCustomCursorImage(null);           // uses /cursor.png internally
  setCustomMusicUrl(null);             // uses /resonance (1).mp3 internally

  // Reset UI controls if present
  if (settingsSfxRangeEl) {
    settingsSfxRangeEl.value = String(Math.round(defaultSfx * 100));
  }
  if (settingsMusicRangeEl) {
    settingsMusicRangeEl.value = String(Math.round(defaultMusic * 100));
  }
  if (settingsHitboxCheckboxEl) {
    settingsHitboxCheckboxEl.checked = defaultHitbox;
  }
  if (settingsTimerStyleEl) {
    settingsTimerStyleEl.value = defaultTimerStyle;
  }
  if (settingsMusicFileButtonEl) {
    // Show default music name after reset
    settingsMusicFileButtonEl.textContent = "Resonance";
  }
  if (settingsCursorFileButtonEl) {
    // Show default cursor image name after reset
    settingsCursorFileButtonEl.textContent = "Cursor.png";
  }

  // Persist the fresh defaults
  saveSettings();

  // Ensure all time displays (leaderboards, etc.) reflect default timer style
  refreshTimeFormatting();
}

// Load any stored settings before wiring up UI listeners
loadSettings();

// Initialize default settings UI state / listeners
if (settingsSfxRangeEl) {
  if (!settingsSfxRangeEl.value) {
    settingsSfxRangeEl.value = "100";
  }
  settingsSfxRangeEl.addEventListener("input", () => {
    const v = Number(settingsSfxRangeEl.value) || 0;
    setSfxVolume(v / 100);
    saveSettings();
  });
}
if (settingsMusicRangeEl) {
  if (!settingsMusicRangeEl.value) {
    settingsMusicRangeEl.value = "10";
  }
  settingsMusicRangeEl.addEventListener("input", () => {
    const v = Number(settingsMusicRangeEl.value) || 0;
    setMusicVolume(v / 100);
    saveSettings();
  });
}
if (settingsHitboxCheckboxEl) {
  if (!settingsHitboxCheckboxEl.hasAttribute("checked")) {
    settingsHitboxCheckboxEl.checked = showHitbox;
  }
  settingsHitboxCheckboxEl.addEventListener("change", () => {
    showHitbox = !!settingsHitboxCheckboxEl.checked;
    saveSettings();
  });
}
if (settingsTimerStyleEl) {
  settingsTimerStyleEl.value = timerStyle;
  settingsTimerStyleEl.addEventListener("change", () => {
    const val = settingsTimerStyleEl.value;
    if (val === "minutes" || val === "classic") {
      timerStyle = val;
      saveSettings();
      // Immediately refresh leaderboard time displays to match new style
      refreshTimeFormatting();
    }
  });
}

if (settingsMusicFileButtonEl && settingsMusicFileEl) {
  settingsMusicFileButtonEl.addEventListener("click", () => {
    settingsMusicFileEl.click();
  });
  settingsMusicFileEl.addEventListener("change", async () => {
    const file = settingsMusicFileEl.files && settingsMusicFileEl.files[0];
    if (!file) return;
    settingsMusicFileButtonEl.textContent = file.name;
    try {
      const url = await window.websim.upload(file);
      customMusicUrl = url;
      setCustomMusicUrl(customMusicUrl);
      saveSettings();
    } catch (e) {
      console.error("Failed to upload custom music file", e);
    }
  });
}

if (settingsCursorFileButtonEl && settingsCursorFileEl) {
  settingsCursorFileButtonEl.addEventListener("click", () => {
    settingsCursorFileEl.click();
  });
  settingsCursorFileEl.addEventListener("change", async () => {
    const file = settingsCursorFileEl.files && settingsCursorFileEl.files[0];
    if (!file) return;
    settingsCursorFileButtonEl.textContent = file.name;
    try {
      const url = await window.websim.upload(file);
      customCursorUrl = url;
      setCustomCursorImage(customCursorUrl);
      saveSettings();
    } catch (e) {
      console.error("Failed to upload custom cursor image", e);
    }
  });
}

if (settingsResetButtonEl) {
  settingsResetButtonEl.addEventListener("click", () => {
    resetSettingsToDefaults();
  });
}

let width = 0;
let height = 0;

// Presence broadcasting for other cursors
let lastPresenceUpdateTime = 0;
const PRESENCE_UPDATE_INTERVAL_MS = 50;

// Pause state
let gamePaused = false;
let pauseStartTimestamp = 0;
let pausedByRightClick = false;
let pausedByFocus = false;
let pausedByOffscreen = false;

function recomputePauseState() {
  const wantPaused = pausedByRightClick || pausedByFocus || pausedByOffscreen;

  // If the game isn't actively running, don't manage pause timing
  if (!gameRunning || gameOver) {
    gamePaused = false;
    pauseStartTimestamp = 0;
    return;
  }

  if (wantPaused && !gamePaused) {
    // Transition: running -> paused
    gamePaused = true;
    pauseStartTimestamp = performance.now();
  } else if (!wantPaused && gamePaused) {
    // Transition: paused -> running, shift start time to skip paused duration
    const now = performance.now();
    const pausedDuration = now - pauseStartTimestamp;
    gameStartTime += pausedDuration;
    gamePaused = false;
    pauseStartTimestamp = 0;
  }
}

// Helper: compute user's previous best time (<=300s) and its rank on the full leaderboard
function getUserPrevBestAndRank() {
  try {
    const scores = room.collection("score_v13").getList() || [];
    const username = currentUser?.username;
    if (!username || isBannedUsername(username)) return { prevBest: 0, prevRank: null };

    // previous best time for this user
    let prevBest = 0;
    for (const s of scores) {
      if (!s || typeof s.time !== "number" || Number.isNaN(s.time)) continue;
      if (isBannedUsername(s.username)) continue;
      if (s.username !== username) continue;
      if (s.time > prevBest) prevBest = s.time;
    }

    // build best-by-user list (one best per username)
    const bestByUserMap = new Map();
    for (const s of scores) {
      if (!s || typeof s.time !== "number" || Number.isNaN(s.time)) continue;
      if (isBannedUsername(s.username)) continue;
      const uname = s.username || "anon";
      const key = String(uname);
      const existing = bestByUserMap.get(key);
      if (!existing || s.time > existing.time) {
        bestByUserMap.set(key, { username: key, time: s.time });
      }
    }
    const bestList = Array.from(bestByUserMap.values()).sort(
      (a, b) => b.time - a.time
    );

    let prevRank = null;
    if (prevBest > 0) {
      for (let i = 0; i < bestList.length; i++) {
        const entry = bestList[i];
        if (entry.username === username && entry.time === prevBest) {
          const rank = i + 1;
          if (rank <= 100) {
            prevRank = rank;
          }
          break;
        }
      }
    }

    return { prevBest, prevRank, bestList };
  } catch (e) {
    console.error("Failed to compute previous best and rank", e);
    return { prevBest: 0, prevRank: null, bestList: [] };
  }
}

// Helper (death mode): previous best & rank for death-mode leaderboard
function getUserPrevBestAndRankDeath() {
  try {
    const scores = room.collection("scoreDeath_v13").getList() || [];
    const username = currentUser?.username;
    if (!username || isBannedUsername(username)) {
      return { prevBest: 0, prevRank: null, bestList: [] };
    }

    let prevBest = 0;
    for (const s of scores) {
      if (!s || typeof s.time !== "number" || Number.isNaN(s.time)) continue;
      if (isBannedUsername(s.username)) continue;
      if (s.username !== username) continue;
      if (s.time > prevBest) prevBest = s.time;
    }

    const bestByUserMap = new Map();
    for (const s of scores) {
      if (!s || typeof s.time !== "number" || Number.isNaN(s.time)) continue;
      if (isBannedUsername(s.username)) continue;
      const uname = s.username || "anon";
      const key = String(uname);
      const existing = bestByUserMap.get(key);
      if (!existing || s.time > existing.time) {
        bestByUserMap.set(key, { username: key, time: s.time });
      }
    }
    const bestList = Array.from(bestByUserMap.values()).sort((a, b) => b.time - a.time);

    let prevRank = null;
    if (prevBest > 0) {
      for (let i = 0; i < bestList.length; i++) {
        const entry = bestList[i];
        if (entry.username === username && entry.time === prevBest) {
          const rank = i + 1;
          if (rank <= 100) prevRank = rank;
          break;
        }
      }
    }

    return { prevBest, prevRank, bestList };
  } catch (e) {
    console.error("Failed to compute previous best and rank (death)", e);
    return { prevBest: 0, prevRank: null, bestList: [] };
  }
}

// Helper: compute whether this run is a new highscore that improves rank
function computeHighscoreInfo(finalSeconds) {
  try {
    const username = currentUser?.username;
    if (!username || isBannedUsername(username)) return { show: false, position: null };

    const { prevBest, prevRank, bestList } = getUserPrevBestAndRank();

    // must beat previous best
    if (finalSeconds <= prevBest) {
      return { show: false, position: null };
    }

    // build hypothetical leaderboard times without mutating original list:
    // remove previous entry for this user (if any), then add this run
    const otherEntries = bestList.filter((e) => e.username !== username);
    const times = otherEntries.map((e) => e.time);
    times.push(finalSeconds);

    times.sort((a, b) => b - a);
    const newIndex = times.indexOf(finalSeconds);
    if (newIndex === -1) {
      return { show: false, position: null };
    }
    const newRank = newIndex + 1;

    // only care if new rank is inside top 100
    if (newRank > 100) {
      return { show: false, position: null };
    }

    const oldRankEffective = prevRank == null ? Infinity : prevRank;

    // show highscore only if rank actually improves (smaller number)
    if (newRank < oldRankEffective) {
      return { show: true, position: newRank };
    }

    return { show: false, position: null };
  } catch (e) {
    console.error("Failed to compute highscore info", e);
    return { show: false, position: null };
  }
}

// Helper (death mode): highscore info for death-mode leaderboard
function computeHighscoreInfoDeath(finalSeconds) {
  try {
    const username = currentUser?.username;
    if (!username || isBannedUsername(username)) {
      return { show: false, position: null };
    }

    const { prevBest, prevRank, bestList } = getUserPrevBestAndRankDeath();

    if (finalSeconds <= prevBest) {
      return { show: false, position: null };
    }

    const otherEntries = bestList.filter((e) => e.username !== username);
    const times = otherEntries.map((e) => e.time);
    times.push(finalSeconds);

    times.sort((a, b) => b - a);
    const newIndex = times.indexOf(finalSeconds);
    if (newIndex === -1) {
      return { show: false, position: null };
    }
    const newRank = newIndex + 1;
    if (newRank > 100) {
      return { show: false, position: null };
    }

    const oldRankEffective = prevRank == null ? Infinity : prevRank;
    if (newRank < oldRankEffective) {
      return { show: true, position: newRank };
    }

    return { show: false, position: null };
  } catch (e) {
    console.error("Failed to compute highscore info (death)", e);
    return { show: false, position: null };
  }
}

function resize() {
  const dpr = window.devicePixelRatio || 1;
  width = window.innerWidth;
  height = window.innerHeight;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  hazardsOnResize(width, height);
}

window.addEventListener("resize", resize);

// Pause/resume on tab visibility / window focus
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    // when tab is hidden, pause the game timer/state
    pausedByFocus = true;
  } else {
    // when tab becomes visible again, unpause
    pausedByFocus = false;
  }
  recomputePauseState();
});

window.addEventListener("blur", () => {
  // when window loses focus, pause the game timer/state
  pausedByFocus = true;
  recomputePauseState();
});

window.addEventListener("focus", () => {
  // when window gains focus, resume if no other pause reasons
  pausedByFocus = false;
  recomputePauseState();
});

resize();

// Initialize cursor and hazards
initCursor(canvas);
initHazards(() => ({ width, height }));

// Game state
let gameRunning = false;
let gameOver = false;
let gameStartTime = 0;
// track wall-clock start time for cheat detection
let gameStartWallTime = 0;
let lastTime = performance.now();
let deathTime = null;
let finalSurvivalSeconds = 0;
let currentDeathMode = false;

// Death screen animation state
let deathTimeAnimFrameId = null;
let deathTypingIntervalId = null;
let deathInfoReady = false;

// Death count state
let deathCount = Number(localStorage.getItem("cursorDeathCount_v2")) || 0;

// Trail
const trail = [];
const TRAIL_DURATION = 0.25;

// Explosion particles
let explosionParticles = [];

// Start screen
initStartScreen(room, (isDeathMode) => {
  if (!gameRunning && !gameOver) {
    currentDeathMode = !!isDeathMode;
    startGame();
  }
});

// Initial render of death count
renderDeathCount();

/* ----- Death count helpers ----- */

function renderDeathCount(fromValue = null) {
  if (!deathCountEl) return;
  const target = deathCount;

  // Simple static render if no animation requested
  if (fromValue === null || fromValue === target) {
    deathCountEl.textContent = `deaths: ${target}`;
    return;
  }

  const start = performance.now();
  const duration = 1000;
  const startVal = fromValue;
  const endVal = target;

  const step = (now) => {
    const t = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - t, 3);
    const current = Math.round(startVal + (endVal - startVal) * eased);
    deathCountEl.textContent = `deaths: ${current}`;
    if (t < 1) {
      requestAnimationFrame(step);
    } else {
      deathCountEl.textContent = `deaths: ${endVal}`;
    }
  };
  requestAnimationFrame(step);
}

// Trail logic
function updateTrail(dt) {
  const now = performance.now() / 1000;
  const center = getCursorCenter();
  trail.push({ x: center.x, y: center.y, t: now });
  const cutoff = now - TRAIL_DURATION;
  while (trail.length && trail[0].t < cutoff) {
    trail.shift();
  }
}

function drawTrail() {
  if (trail.length < 2) return;

  const now = performance.now() / 1000;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  ctx.beginPath();
  for (let i = 0; i < trail.length; i++) {
    const p = trail[i];
    const age = now - p.t;
    const alpha = 1 - age / TRAIL_DURATION;
    if (alpha <= 0) continue;
    const x = p.x;
    const y = p.y;
    ctx.strokeStyle = `rgba(0,0,0,${0.25 * alpha})`;
    ctx.lineWidth = 2 + 1 * alpha;

    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x, y);
    }
  }
}

// Explosion
function spawnExplosion(x, y) {
  // Black particle burst (no blood / no gravity drip)
  const now = performance.now() / 1000;
  const count = 45;
  explosionParticles = [];
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 220 + Math.random() * 180;
    explosionParticles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 0.45 + Math.random() * 0.25,
      birth: now,
      size: 2 + Math.random() * 3,
    });
  }
}

function updateExplosion(dt) {
  const now = performance.now() / 1000;
  explosionParticles = explosionParticles.filter((p) => {
    const age = now - p.birth;
    if (age > p.life) return false;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    // slight slowdown so particles ease out, but no gravity
    p.vx *= 0.96;
    p.vy *= 0.96;
    return true;
  });
}

function drawExplosion() {
  const now = performance.now() / 1000;
  for (const p of explosionParticles) {
    const age = now - p.birth;
    const alpha = 1 - age / p.life;
    if (alpha <= 0) continue;
    ctx.fillStyle = `rgba(0,0,0,${alpha})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
}

// Timer
function updateTimer(now) {
  if (!gameRunning) return;
  const elapsed = (now - gameStartTime) / 1000;

  // Cap only death mode timer at 999.99 seconds
  const displayElapsed = currentDeathMode ? Math.min(elapsed, 999.99) : elapsed;

  timerEl.textContent = formatTimerValue(displayElapsed);
}

// Helper: compute user's previous best (<=300s) before this run
function getUserPreviousBest() {
  try {
    const scores = room.collection("score_v13").getList() || [];
    const username = currentUser?.username;
    if (!username || isBannedUsername(username)) return 0;

    let best = 0;
    for (const s of scores) {
      if (!s || typeof s.time !== "number" || Number.isNaN(s.time)) continue;
      if (isBannedUsername(s.username)) continue;
      if (s.username !== username) continue;
      if (s.time > best) best = s.time;
    }
    return best;
  } catch (e) {
    console.error("Failed to get previous best", e);
    return 0;
  }
}

// Helper: compute highscore rank only among scores above previous best
function computeHighscoreRank(finalSeconds) {
  try {
    const scores = room.collection("score_v13").getList() || [];
    const prevBest = getUserPreviousBest();
    const username = currentUser?.username;
    if (!username || isBannedUsername(username)) {
      return { position: null };
    }

    const times = [];
    for (const s of scores) {
      if (!s || typeof s.time !== "number" || Number.isNaN(s.time)) continue;
      if (isBannedUsername(s.username)) continue;
      if (s.time <= prevBest) continue;
      times.push(s.time);
    }

    // Only consider this run if it's actually above previous best
    if (finalSeconds > prevBest) {
      times.push(finalSeconds);
    }

    if (times.length === 0 || finalSeconds <= prevBest) {
      return { position: null };
    }

    times.sort((a, b) => b - a);

    let position = null;
    for (let i = 0; i < times.length; i++) {
      if (times[i] === finalSeconds) {
        position = i + 1;
        break;
      }
    }

    if (position != null && position <= 100) {
      return { position };
    }

    return { position: null };
  } catch (e) {
    console.error("Failed to compute highscore rank", e);
    return { position: null };
  }
}

// Death screen helpers
function clearDeathScreenAnimations() {
  if (deathTimeAnimFrameId != null) {
    cancelAnimationFrame(deathTimeAnimFrameId);
    deathTimeAnimFrameId = null;
  }
  if (deathTypingIntervalId != null) {
    clearInterval(deathTypingIntervalId);
    deathTypingIntervalId = null;
  }
  deathInfoReady = false;
}

function showDeathScreen(finalSeconds, highscoreInfo, cause) {
  if (!deathScreenEl || !deathTimeValueEl || !deathPlaceEl || !deathMessageEl) return;

  clearDeathScreenAnimations();
  if (deathClickHintEl) {
    deathClickHintEl.classList.remove("visible");
  }

  // Casino-like time count up
  const start = performance.now();
  const duration = 1500; // 1.5s time count-up
  const target = finalSeconds;

  const animate = (now) => {
    const t = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - t, 3);
    const current = target * eased;
    deathTimeValueEl.textContent = formatTimerValue(current);
    if (t < 1) {
      deathTimeAnimFrameId = requestAnimationFrame(animate);
    } else {
      deathTimeValueEl.textContent = formatTimerValue(target);
      deathTimeAnimFrameId = null;
    }
  };
  deathTimeAnimFrameId = requestAnimationFrame(animate);

  // Highscore rank display (only if this run beats previous best AND improves rank)
  if (highscoreInfo && highscoreInfo.show && highscoreInfo.position != null) {
    if (currentDeathMode) {
      deathPlaceEl.textContent = `Death mode highscore! Rank: ${highscoreInfo.position}`;
    } else {
      deathPlaceEl.textContent = `Highscore! Rank: ${highscoreInfo.position}`;
    }
  } else {
    deathPlaceEl.textContent = "";
  }

  // Typed death message
  const messages = [
    "oh no, your cursor died",
    "lasers are annoying, saws are even more annoying",
    "i said MOVE!",
    "definetly a bullet hell",
    "holy jobless",
    "tip:dont die",
  ];

  let msg;
  if (cause === "rightClickBarrage") {
    msg = "right clicked? good.";
  } else if (cause === "windowPunish") {
    msg = "windows of death";
  } else {
    msg = messages[Math.floor(Math.random() * messages.length)];
  }
  deathMessageEl.textContent = "";
  let idx = 0;
  const typingInterval = 70;
  deathTypingIntervalId = setInterval(() => {
    if (idx >= msg.length) {
      clearInterval(deathTypingIntervalId);
      deathTypingIntervalId = null;
      return;
    }
    deathMessageEl.textContent += msg[idx];
    playTypingSound();
    idx += 1;
  }, typingInterval);

  // After a short delay, allow click to exit (much quicker than before)
  const totalInfoDuration = 900; // ms
  setTimeout(() => {
    deathInfoReady = true;
    if (deathClickHintEl) {
      deathClickHintEl.classList.add("visible");
    }
  }, totalInfoDuration);

  deathScreenEl.classList.add("active");
}

function hideDeathScreen() {
  if (!deathScreenEl) return;
  clearDeathScreenAnimations();
  if (deathClickHintEl) {
    deathClickHintEl.classList.remove("visible");
  }
  deathScreenEl.classList.remove("active");
}

// Clicking on the death screen (after info is ready) returns to start
if (deathScreenEl) {
  deathScreenEl.addEventListener("click", () => {
    if (gameOver && deathInfoReady) {
      finalizeGameOver();
    }
  });
}

// START / END OF GAME

function startGame() {
  gameRunning = true;
  gameOver = false;
  gamePaused = false;
  pausedByRightClick = false;
  pausedByFocus = false;
  pausedByOffscreen = false;
  pauseStartTimestamp = 0;
  deathTime = null;
  finalSurvivalSeconds = 0;
  gameStartTime = performance.now();
  // record wall-clock start time for anti-cheat
  gameStartWallTime = Date.now();

  setDeathMode(currentDeathMode);

  hideDeathScreen();

  trail.length = 0;
  explosionParticles = [];
  resetHazards();

  hideStartScreenForGame();

  timerEl.style.display = "block";
  timerEl.textContent = "00.00";
  setGameCursor(true);
}

async function handleDeath(cause = null) {
  if (!gameRunning || gameOver) return;

  gameRunning = false;
  gameOver = true;
  gamePaused = false;
  pausedByRightClick = false;
  pausedByFocus = false;
  pausedByOffscreen = false;
  pauseStartTimestamp = 0;
  deathTime = performance.now();
  setGameCursor(false);

  const rawSurvivalSeconds = (deathTime - gameStartTime) / 1000;
  // Cap death mode survival time at 999.99 seconds; leave normal mode uncapped
  finalSurvivalSeconds = currentDeathMode
    ? Math.min(rawSurvivalSeconds, 999.99)
    : rawSurvivalSeconds;

  timerEl.textContent = formatTimerValue(finalSurvivalSeconds);

  const center = getCursorCenter();
  spawnExplosion(center.x, center.y);
  playPlayerExplosionSound();

  triggerAllPendingHazards(gameStartTime, deathTime);

  // Anti-cheat: compare wall-clock elapsed vs in-game survival time
  let flaggedCheater = false;
  try {
    const wallEnd = Date.now();
    const wallElapsedSeconds = (wallEnd - gameStartWallTime) / 1000;
    const diff = Math.abs(wallElapsedSeconds - finalSurvivalSeconds);
    // If the difference is suspiciously large (2–15 minutes), flag and ban this user
    if (diff >= 120 && diff <= 900) {
      const username = currentUser?.username;
      if (username) {
        BANNED_USERNAMES.add(String(username).toLowerCase());
      }
      flaggedCheater = true;
    }
  } catch (e) {
    console.error("Failed to run anti-cheat timing check", e);
  }

  const username = currentUser?.username;
  const isBannedNow = isBannedUsername(username);

  // Only compute / show highscore info for non-banned, non-flagged users
  const highscoreInfo =
    !flaggedCheater && !isBannedNow
      ? (currentDeathMode
          ? computeHighscoreInfoDeath(finalSurvivalSeconds)
          : computeHighscoreInfo(finalSurvivalSeconds))
      : { show: false, position: null };

  showDeathScreen(finalSurvivalSeconds, highscoreInfo, cause);

  // Only save score if user is not banned and not flagged by anti-cheat
  if (!flaggedCheater && !isBannedNow) {
    try {
      if (!isBannedUsername(username)) {
        const collectionName = currentDeathMode ? "scoreDeath_v13" : "score_v13";
        await room.collection(collectionName).create({
          // save the capped death-mode time; normal mode remains uncapped
          time: finalSurvivalSeconds,
        });
      }
    } catch (e) {
      console.error("Failed to save score", e);
    }
  }
}

function finalizeGameOver() {
  gameOver = false;
  deathTime = null;
  hideDeathScreen();

  // Increment and animate death count when returning to start screen
  const previousCount = deathCount;
  deathCount += 1;
  try {
    localStorage.setItem("cursorDeathCount_v2", String(deathCount));
  } catch (e) {
    console.error("Failed to persist death count", e);
  }
  renderDeathCount(previousCount);

  showStartScreenAfterDeath();
  timerEl.style.display = "none";
  timerEl.textContent = "00.00";
}

// Right-click handling: leave as is, but uses death mode hazards automatically
canvas.addEventListener("contextmenu", (e) => {
  e.preventDefault();
});

canvas.addEventListener("pointerdown", (e) => {
  if (e.button === 2 && gameRunning && !gameOver) {
    triggerBarrageWave(20, gameStartTime);
  }
});

// Shift+F10 stays unchanged and will use death mode barrage behavior when active

// Main loop: unchanged apart from using updateHazards which now respects deathMode

// remove right-click pause release, no longer needed
// canvas.addEventListener("pointerup", (e) => {
//   if (e.button === 2) {
//     pausedByRightClick = false;
//     recomputePauseState();
//   }
// });

// NEW: prevent Shift+F10 context menu and spawn 15 barrages
window.addEventListener("keydown", (e) => {
  if (e.key === "F10" && e.shiftKey) {
    e.preventDefault();
    if (gameRunning && !gameOver) {
      triggerBarrageWave(15, gameStartTime);
    }
  }
});

// NEW: Windows key punishment – spawn 20 barrages when Windows/meta key is pressed
window.addEventListener("keydown", (e) => {
  // On Windows, the Windows key is reported as "Meta"
  if (e.key === "Meta" && !e.repeat) {
    if (gameRunning && !gameOver) {
      triggerLargeSawPunishment(20);
    }
  }
});

// Main loop
function loop(now) {
  const dt = (now - lastTime) / 1000;
  lastTime = now;

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  if (gameRunning) {
    // Broadcast our cursor position periodically for other clients
    const nowMs = performance.now();
    if (nowMs - lastPresenceUpdateTime >= PRESENCE_UPDATE_INTERVAL_MS) {
      const pos = getCursorPosition();
      try {
        room.updatePresence({
          cursorX: pos.x,
          cursorY: pos.y,
          cursorUrl: customCursorUrl || null,
        });
      } catch (e) {
        console.error("Failed to update presence", e);
      }
      lastPresenceUpdateTime = nowMs;
    }

    // Off-screen pause detection
    const center = getCursorCenter();
    const inBounds =
      center.x >= 0 &&
      center.x <= width &&
      center.y >= 0 &&
      center.y <= height;

    pausedByOffscreen = !inBounds;
    recomputePauseState();

    if (!gamePaused) {
      updateTimer(now);
      updateTrail(dt);
      updateHazards(dt, true, gameRunning, gameStartTime);
      updateExplosion(dt);
      checkHazardCollisions(getCursorCenter(), handleDeath);
    } else {
      // While paused, don't advance hazards or timer, just keep explosions (if any) moving
      updateExplosion(dt);
    }

    drawTrail();
    drawHazards(ctx);
    drawCursor(ctx);
    if (showHitbox) {
      drawCursorHitbox(ctx);
    }
    drawExplosion();
  } else if (gameOver) {
    updateHazards(dt, false, false, gameStartTime);
    updateExplosion(dt);

    drawHazards(ctx);
    // hide in-game cursor sprite while dead
    drawExplosion();

    // removed auto-return after 7 seconds; death screen now only exits on click
    // if (deathTime && performance.now() - deathTime >= 7000) {
    //   finalizeGameOver();
    // }
  } else {
    updateExplosion(dt);
    drawExplosion();
  }

  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);