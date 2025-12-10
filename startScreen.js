import { formatTimeSeconds } from "./utils.js";
import { playClickBeginHellSound, playTypingSound } from "./sounds.js";

const startScreenEl = document.getElementById("startScreen");
const subtitleEl = document.getElementById("subtitle");
const clickToBeginEl = document.getElementById("clickToBegin");
const leaderboardRow1El = document.getElementById("leaderboardRow1");
const leaderboardRow2El = document.getElementById("leaderboardRow2");
const viewFullLeaderboardBtn = document.getElementById("viewFullLeaderboardBtn");
const leaderboardDividerEl = document.querySelector(".leaderboard-divider");
const settingsBtnEl = document.getElementById("settingsBtn");
// Owner cheat scan elements removed

const deathModeCheckboxEl = document.getElementById("deathModeCheckbox");
const deathModeLabelEl = document.getElementById("deathModeLabel");

const fullModalEl = document.getElementById("fullLeaderboardModal");
const fullListEl = document.getElementById("fullLeaderboardList");
const fullPageInfoEl = document.getElementById("fullLeaderboardPageInfo");
const fullPrevBtn = document.getElementById("fullLeaderboardPrev");
const fullNextBtn = document.getElementById("fullLeaderboardNext");
const fullCloseBtn = document.getElementById("fullLeaderboardCloseBtn");
const fullLbTabNormalEl = document.getElementById("fullLbTabNormal");
const fullLbTabDeathEl = document.getElementById("fullLbTabDeath");
const fullSectionTitleEl = document.getElementById("fullLeaderboardSectionTitle");

// removed challenge modal elements
// const challengeModalEl = document.getElementById("challengeModal");
// const challengeCloseBtnEl = document.getElementById("challengeCloseBtn");

const settingsModalEl = document.getElementById("settingsModal");
const settingsCloseBtnEl = document.getElementById("settingsCloseBtn");

const fullSubtitle = "a bullet hell of cursors and also a lot of death";
let subtitleIndex = 0;
let typingIntervalId = null;

let startCallback = null;

let latestScoresNormal = [];
let latestScoresDeath = [];
let fullLeaderboardCurrentPage = 1;
const FULL_LEADERBOARD_PAGE_SIZE = 10;
const FULL_LEADERBOARD_MAX = 100;
let fullLeaderboardMode = "normal"; // "normal" | "death"

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

let currentUser = null;
let deathModeUnlocked = false;

// Keep a reference to the room passed into initStartScreen
let roomRef = null;

export async function initStartScreen(room, onStartGame) {
  startCallback = onStartGame;
  roomRef = room;

  try {
    currentUser = await window.websim.getCurrentUser();
  } catch (e) {
    console.error("Failed to get current user", e);
  }

  if (clickToBeginEl) {
    clickToBeginEl.classList.add("blink");
    clickToBeginEl.addEventListener("click", handleStartClick);
  }

  if (deathModeCheckboxEl) {
    deathModeCheckboxEl.addEventListener("change", () => {
      // nothing else needed here; we read the checkbox when starting the game
    });
  }

  if (viewFullLeaderboardBtn) {
    viewFullLeaderboardBtn.addEventListener("click", () => {
      openFullLeaderboard();
    });
  }
  if (settingsBtnEl) {
    settingsBtnEl.addEventListener("click", () => {
      openSettingsModal();
    });
  }
  if (settingsCloseBtnEl) {
    settingsCloseBtnEl.addEventListener("click", () => {
      closeSettingsModal();
    });
  }
  if (fullCloseBtn) {
    fullCloseBtn.addEventListener("click", () => {
      closeFullLeaderboard();
    });
  }
  if (fullPrevBtn) {
    fullPrevBtn.addEventListener("click", () => {
      if (fullLeaderboardCurrentPage > 1) {
        fullLeaderboardCurrentPage -= 1;
        renderFullLeaderboard();
      }
    });
  }
  if (fullNextBtn) {
    fullNextBtn.addEventListener("click", () => {
      fullLeaderboardCurrentPage += 1;
      renderFullLeaderboard();
    });
  }
  if (fullLbTabNormalEl) {
    fullLbTabNormalEl.addEventListener("click", () => {
      if (fullLeaderboardMode !== "normal") {
        fullLeaderboardMode = "normal";
        fullLeaderboardCurrentPage = 1;
        updateFullLbTabStyles();
        renderFullLeaderboard();
      }
    });
  }
  if (fullLbTabDeathEl) {
    fullLbTabDeathEl.addEventListener("click", () => {
      if (fullLeaderboardMode !== "death") {
        fullLeaderboardMode = "death";
        fullLeaderboardCurrentPage = 1;
        updateFullLbTabStyles();
        renderFullLeaderboard();
      }
    });
  }

  // removed challenge modal wiring
  // if (challengeCloseBtnEl) {
  //   challengeCloseBtnEl.addEventListener("click", () => {
  //     closeChallengeModal();
  //   });
  // }

  startSubtitleTyping();

  // subscribe to normal scores
  room.collection("score_v13").subscribe((scores) => {
    latestScoresNormal = scores || [];
    renderLeaderboards();
    updateDeathModeUnlock();
  });

  // subscribe to death mode scores
  room.collection("scoreDeath_v13").subscribe((scores) => {
    latestScoresDeath = scores || [];
    renderLeaderboards();
    updateDeathModeUnlock();
  });
}

function handleStartClick() {
  if (typeof startCallback === "function") {
    playClickBeginHellSound();
    const isDeathMode = !!(deathModeCheckboxEl && deathModeCheckboxEl.checked && deathModeUnlocked);
    startCallback(isDeathMode);
  }
}

function startSubtitleTyping() {
  if (!subtitleEl) return;
  subtitleEl.textContent = "";
  subtitleIndex = 0;
  if (typingIntervalId) {
    clearInterval(typingIntervalId);
  }
  typingIntervalId = setInterval(() => {
    if (subtitleIndex >= fullSubtitle.length) {
      clearInterval(typingIntervalId);
      typingIntervalId = null;
      return;
    }
    subtitleEl.textContent += fullSubtitle[subtitleIndex];
    playTypingSound();
    subtitleIndex += 1;
  }, 40);
}

function buildBestByUser(scores) {
  const bestByUser = new Map();
  for (const s of scores || []) {
    if (!s || typeof s.time !== "number" || Number.isNaN(s.time)) continue;
    const username = s.username || "anon";
    if (isBannedUsername(username)) continue;
    const key = String(username);
    const existing = bestByUser.get(key);
    if (existing == null || s.time > existing.time) {
      bestByUser.set(key, s);
    }
  }
  return Array.from(bestByUser.values()).sort((a, b) => b.time - a.time);
}

function updateDeathModeUnlock() {
  if (!deathModeCheckboxEl || !deathModeLabelEl) return;
  const username = currentUser?.username;
  if (!username || isBannedUsername(username)) {
    deathModeUnlocked = false;
  } else {
    let best = 0;
    const allScores = [...(latestScoresNormal || []), ...(latestScoresDeath || [])];
    for (const s of allScores) {
      if (!s || typeof s.time !== "number" || Number.isNaN(s.time)) continue;
      if (s.username !== username) continue;
      if (s.time > best) best = s.time;
    }
    deathModeUnlocked = best >= 60;
  }

  deathModeCheckboxEl.disabled = !deathModeUnlocked;
  if (deathModeUnlocked) {
    deathModeLabelEl.textContent = "Death mode";
    deathModeLabelEl.prepend(deathModeCheckboxEl);
  } else {
    deathModeCheckboxEl.checked = false;
    deathModeLabelEl.textContent = "Death mode (survive 60s to unlock)";
    deathModeLabelEl.prepend(deathModeCheckboxEl);
  }
}

function renderLeaderboards(room) {
  if (!leaderboardRow1El || !leaderboardRow2El) return;

  const bestNormal = buildBestByUser(latestScoresNormal).slice(0, 5);
  const bestDeath = buildBestByUser(latestScoresDeath).slice(0, 5);

  leaderboardRow1El.innerHTML = "";
  leaderboardRow2El.innerHTML = "";

  // show two columns only if there is at least one death-mode score
  const showDeathColumn = bestDeath.length > 0;

  if (showDeathColumn) {
    leaderboardRow2El.style.display = "flex";
    if (leaderboardDividerEl) {
      leaderboardDividerEl.style.display = "block";
    }
  } else {
    leaderboardRow2El.style.display = "none";
    if (leaderboardDividerEl) {
      leaderboardDividerEl.style.display = "none";
    }
  }

  // Add column titles
  const normalTitle = document.createElement("div");
  normalTitle.className = "leaderboard-column-title";
  normalTitle.textContent = "normal";
  leaderboardRow1El.appendChild(normalTitle);

  if (showDeathColumn) {
    const deathTitle = document.createElement("div");
    deathTitle.className = "leaderboard-column-title";
    deathTitle.textContent = "death mode";
    leaderboardRow2El.appendChild(deathTitle);
  }

  // normal leaderboard in column 1
  if (bestNormal.length > 0) {
    let maxNameLen = 0;
    bestNormal.forEach((s) => {
      const username = s.username || "anon";
      const safeName = String(username);
      if (safeName.length > maxNameLen) {
        maxNameLen = safeName.length;
      }
    });

    bestNormal.forEach((s, idx) => {
      const timeStr = formatTimeSeconds(s.time);
      const username = s.username || "anon";
      const safeName = String(username);
      const avatarUrl = `https://images.websim.com/avatar/${encodeURIComponent(
        safeName
      )}`;

      const entry = document.createElement("div");
      entry.className = "leaderboard-entry";
      entry.innerHTML = `
        <span class="rank">${idx + 1}.</span>
        <img class="avatar" src="${avatarUrl}" alt="">
        <span class="name">${safeName}</span>
        <span class="time">${timeStr}</span>
      `;
      const nameSpan = entry.querySelector(".name");
      if (nameSpan) {
        nameSpan.style.width = `${maxNameLen}ch`;
      }
      leaderboardRow1El.appendChild(entry);
    });
  }

  // death leaderboard in column 2
  if (showDeathColumn) {
    let maxNameLenDeath = 0;
    bestDeath.forEach((s) => {
      const username = s.username || "anon";
      const safeName = String(username);
      if (safeName.length > maxNameLenDeath) {
        maxNameLenDeath = safeName.length;
      }
    });

    bestDeath.forEach((s, idx) => {
      const timeStr = formatTimeSeconds(s.time);
      const username = s.username || "anon";
      const safeName = String(username);
      const avatarUrl = `https://images.websim.com/avatar/${encodeURIComponent(
        safeName
      )}`;

      const entry = document.createElement("div");
      entry.className = "leaderboard-entry";
      entry.innerHTML = `
        <span class="rank">${idx + 1}.</span>
        <img class="avatar" src="${avatarUrl}" alt="">
        <span class="name">${safeName}</span>
        <span class="time">${timeStr}</span>
      `;
      const nameSpan = entry.querySelector(".name");
      if (nameSpan) {
        nameSpan.style.width = `${maxNameLenDeath}ch`;
      }
      leaderboardRow2El.appendChild(entry);
    });
  }
}

// Full leaderboard modal rendering

function openFullLeaderboard() {
  if (!fullModalEl) return;
  fullLeaderboardCurrentPage = 1;
  fullLeaderboardMode = "normal";
  updateFullLbTabStyles();
  renderFullLeaderboard();
  fullModalEl.classList.remove("hidden-screen");
}

function closeFullLeaderboard() {
  if (!fullModalEl) return;
  fullModalEl.classList.add("hidden-screen");
}

function updateFullLbTabStyles() {
  if (!fullLbTabNormalEl || !fullLbTabDeathEl) return;
  fullLbTabNormalEl.classList.toggle("flb-tab-active", fullLeaderboardMode === "normal");
  fullLbTabDeathEl.classList.toggle("flb-tab-active", fullLeaderboardMode === "death");
  if (fullSectionTitleEl) {
    fullSectionTitleEl.textContent =
      fullLeaderboardMode === "normal" ? "Top 100 survivors" : "Top 100 death mode survivors";
  }
}

function renderFullLeaderboard() {
  if (!fullListEl || !fullPageInfoEl || !fullPrevBtn || !fullNextBtn) return;

  const sourceScores =
    fullLeaderboardMode === "death" ? latestScoresDeath : latestScoresNormal;
  const best = buildBestByUser(sourceScores);
  const totalEntries = Math.min(best.length, FULL_LEADERBOARD_MAX);
  const totalPages = Math.max(1, Math.ceil(totalEntries / FULL_LEADERBOARD_PAGE_SIZE));

  if (fullLeaderboardCurrentPage > totalPages) {
    fullLeaderboardCurrentPage = totalPages;
  }
  if (fullLeaderboardCurrentPage < 1) {
    fullLeaderboardCurrentPage = 1;
  }

  const startIdx = (fullLeaderboardCurrentPage - 1) * FULL_LEADERBOARD_PAGE_SIZE;
  const endIdx = Math.min(startIdx + FULL_LEADERBOARD_PAGE_SIZE, totalEntries);

  fullListEl.innerHTML = "";
  for (let i = startIdx; i < endIdx; i++) {
    const s = best[i];
    if (!s) continue;
    const position = i + 1;
    const timeStr = formatTimeSeconds(s.time);
    const username = s.username || "anon";
    const safeName = String(username);
    const avatarUrl = `https://images.websim.com/avatar/${encodeURIComponent(
      safeName
    )}`;

    const row = document.createElement("div");
    row.className = "full-leaderboard-row";
    row.innerHTML = `
      <span class="rank">${position}.</span>
      <img class="avatar" src="${avatarUrl}" alt="">
      <span class="name">${safeName}</span>
      <span class="time">${timeStr}</span>
    `;
    fullListEl.appendChild(row);
  }

  fullPageInfoEl.textContent = `Page ${fullLeaderboardCurrentPage}/${totalPages}`;
  fullPrevBtn.disabled = fullLeaderboardCurrentPage <= 1;
  fullNextBtn.disabled = fullLeaderboardCurrentPage >= totalPages;
}

// Settings modal

function openSettingsModal() {
  if (!settingsModalEl) return;
  settingsModalEl.classList.remove("hidden-screen");
}

function closeSettingsModal() {
  if (!settingsModalEl) return;
  settingsModalEl.classList.add("hidden-screen");
}

// Allow main.js to force-refresh all leaderboard time strings
export function refreshTimeFormatting() {
  // re-render compact start-screen leaderboard
  renderLeaderboards();

  // if full leaderboard modal is open, re-render it too
  if (fullModalEl && !fullModalEl.classList.contains("hidden-screen")) {
    renderFullLeaderboard();
  }
}

export function showStartScreenAfterDeath() {
  if (startScreenEl) {
    startScreenEl.classList.remove("hidden-screen");
    startScreenEl.classList.remove("no-anim");
  }
  startSubtitleTyping();

  if (clickToBeginEl) {
    clickToBeginEl.classList.add("blink");
  }
}

export function hideStartScreenForGame() {
  if (startScreenEl) {
    startScreenEl.classList.add("hidden-screen");
  }
  if (clickToBeginEl) {
    clickToBeginEl.classList.remove("blink");
  }
}