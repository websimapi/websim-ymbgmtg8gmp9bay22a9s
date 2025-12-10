<<<<<<< SEARCH
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
=======
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
  const defaultSfx = 1.0;
  const defaultMusic = 0.1;
  const defaultHitbox = false;
  const defaultTimerStyle = "classic";

  // Apply to internal state
  setSfxVolume(defaultSfx);
  setMusicVolume(defaultMusic);
  showHitbox = defaultHitbox;
  timerStyle = defaultTimerStyle;
  customCursorUrl = null;
  customMusicUrl = null;

  // Reset visuals for cursor and music
  setCustomCursorImage(null);
  setCustomMusicUrl(null);

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
    settingsMusicFileButtonEl.textContent = "Insert File";
  }
  if (settingsCursorFileButtonEl) {
    settingsCursorFileButtonEl.textContent = "Insert File";
  }

  // Persist the fresh defaults
  saveSettings();

  // Ensure all time displays (leaderboards, etc.) reflect default timer style
  refreshTimeFormatting();
}
>>>>>>> REPLACE

<<<<<<< SEARCH
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
=======
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
>>>>>>> REPLACE

