import { getCursorCenter, getHasMouse } from "./cursor.js";
import {
  playSmallLaserWarningSound,
  playSmallLaserFireSound,
  playLargeLaserWarningSound,
  playLargeLaserFireSound,
  playLargeSawAppearSound,
  playLargeSawWarningSweepSound,
  playLargeSawExplosionSound,
  playBounceCircleWarningSound,
  playBounceCircleImplosionSound,
} from "./sounds.js";

let width = 0;
let height = 0;

let deathMode = false;

// Small lasers
const warnings = [];
const LASER_WARNING_TIME_BASE_NORMAL = 1.0;
const LASER_WARNING_TIME_BASE_DEATH = 0.8;
const LASER_ACTIVE_TIME = 1.0;
const recentSmallLaserTimes = [];

// Large lasers
const largeWarnings = [];
const LARGE_LASER_WARNING_TIME_NORMAL = 3.0;
const LARGE_LASER_WARNING_TIME_DEATH = 2.0;
const LARGE_LASER_ACTIVE_TIME_NORMAL = 3.0;
const LARGE_LASER_ACTIVE_TIME_DEATH = 3.0;
const recentLargeLaserTimes = [];

// Large laser particles (stylized)
let largeLaserParticles = [];

// New: Saws
const saws = [];
const MAX_SAWS_NORMAL = 12;
const MAX_SAWS_DEATH = 20;
const SAW_MIN_SPAWN_TIME_NORMAL = 10;
const SAW_MIN_SPAWN_TIME_DEATH = 0;
const SAW_SPAWN_RATE_NORMAL = 0.8;
const SAW_SPAWN_RATE_DEATH = 1.6;
const SAW_TRAIL_DURATION = 0.4;

// New: Large saw volleys
const largeSaws = [];
const LARGE_SAW_MIN_TIME_NORMAL = 20;
const LARGE_SAW_MIN_TIME_DEATH = 0;
const LARGE_SAW_SPAWN_RATE_NORMAL = 0.25;
const LARGE_SAW_SPAWN_RATE_DEATH = 0.6;
const LARGE_SAW_GROW_TIME = 3.0;
const LARGE_SAW_WARNING_LEAD = 2.0;

// New: particles for large saw explosions
let largeSawParticles = [];

// New: large laser barrage
const barrageGroups = [];
const BARRAGE_MIN_TIME_NORMAL = 30;
const BARRAGE_MIN_TIME_DEATH = 0;
const BARRAGE_SPAWN_RATE_NORMAL = 0.35;
const BARRAGE_SPAWN_RATE_DEATH = 0.9;
const BARRAGE_LASERS_PER_GROUP_NORMAL = 6;
const BARRAGE_LASERS_PER_GROUP_DEATH = 7;
const BARRAGE_SPACING = 24;
const BARRAGE_COOLDOWN_NORMAL = 4.5;
const BARRAGE_COOLDOWN_DEATH = 2.5;
const BARRAGE_WARNING_TIME_NORMAL = 1.4;
const BARRAGE_WARNING_TIME_DEATH = 1.0;

let lastBarrageSpawnTime = 0;

// New: bouncing circle hazards
const bounceCircles = [];
const BOUNCE_CIRCLE_MIN_TIME_NORMAL = 15;
const BOUNCE_CIRCLE_MIN_TIME_DEATH = 0;
const MAX_BOUNCE_CIRCLES_NORMAL = 5;
const MAX_BOUNCE_CIRCLES_DEATH = 7;
const BOUNCE_CIRCLE_WARNING_TIME_NORMAL = 3.0;
const BOUNCE_CIRCLE_WARNING_TIME_DEATH = 0.5;
const BOUNCE_CIRCLE_BOUNCE_TIME_NORMAL = 0.5;
const BOUNCE_CIRCLE_BOUNCE_TIME_DEATH = 2.0;

// New: particles for bouncing circle implosions
let bounceCircleParticles = [];

// Config helpers
function getLaserWarningTime() {
  return deathMode ? LASER_WARNING_TIME_BASE_DEATH : LASER_WARNING_TIME_BASE_NORMAL;
}

function getLargeLaserWarningTime() {
  return deathMode ? LARGE_LASER_WARNING_TIME_DEATH : LARGE_LASER_WARNING_TIME_NORMAL;
}

function getLargeLaserActiveTime() {
  return deathMode ? LARGE_LASER_ACTIVE_TIME_DEATH : LARGE_LASER_ACTIVE_TIME_NORMAL;
}

function getMaxSmallLasersPerSecond(elapsed) {
  if (deathMode) {
    // allow many more lasers immediately, scale a bit further with time
    if (elapsed >= 60) return 10;
    if (elapsed >= 10) return 7;
    return 5;
  }

  if (elapsed >= 120) {
    return 6;
  }
  if (elapsed >= 10) {
    return 2;
  }
  return 3;
}

export function setDeathMode(isDeath) {
  deathMode = !!isDeath;
}

export function initHazards(getDimensions) {
  const dims = getDimensions();
  width = dims.width;
  height = dims.height;
}

export function onResize(newWidth, newHeight) {
  width = newWidth;
  height = newHeight;
}

// Large laser particles
function spawnLargeLaserParticles(lineStartX, lineStartY, lineEndX, lineEndY) {
  const now = performance.now();
  const count = 40;
  largeLaserParticles = largeLaserParticles || [];
  for (let i = 0; i < count; i++) {
    const t = Math.random();
    const x = lineStartX + (lineEndX - lineStartX) * t;
    const y = lineStartY + (lineEndY - lineStartY) * t;
    const angle = Math.random() * Math.PI * 2;
    const speed = 140 + Math.random() * 190;
    largeLaserParticles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 0.6 + Math.random() * 0.3,
      birth: now,
      size: 1.8 + Math.random() * 2.2,
    });
  }
}

function updateLargeLaserParticles(dt) {
  const now = performance.now();
  largeLaserParticles = largeLaserParticles.filter((p) => {
    const age = (now - p.birth) / 1000;
    if (age > p.life) return false;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    return true;
  });
}

function drawLargeLaserParticles(ctx) {
  const now = performance.now();
  for (const p of largeLaserParticles) {
    const age = (now - p.birth) / 1000;
    const alpha = 1 - age / p.life;
    if (alpha <= 0) continue;
    ctx.fillStyle = `rgba(0,0,0,${alpha})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
}

// New: large saw explosion particles
function spawnLargeSawParticles(x, y) {
  const now = performance.now();
  const count = 60;
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 220 + Math.random() * 300;
    const wobble = (Math.random() - 0.5) * 0.7;
    largeSawParticles.push({
      x,
      y,
      vx: Math.cos(angle + wobble) * speed,
      vy: Math.sin(angle + wobble) * speed,
      life: 0.7 + Math.random() * 0.4,
      birth: now,
      size: 2.5 + Math.random() * 3.5,
    });
  }
}

function updateLargeSawParticles(dt) {
  const now = performance.now();
  largeSawParticles = largeSawParticles.filter((p) => {
    const age = (now - p.birth) / 1000;
    if (age > p.life) return false;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 420 * dt;
    return true;
  });
}

function drawLargeSawParticles(ctx) {
  const now = performance.now();
  for (const p of largeSawParticles) {
    const age = (now - p.birth) / 1000;
    const alpha = 1 - age / p.life;
    if (alpha <= 0) continue;
    ctx.fillStyle = `rgba(0,0,0,${alpha})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
}

// New: bouncing circle implosion particles
function spawnBounceCircleParticles(x, y, maxRadius) {
  const now = performance.now();
  const count = 45;
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const baseSpeed = 260 + Math.random() * 180;
    const inward = Math.random() < 0.5;
    const dir = inward ? -1 : 1;
    const speed = baseSpeed * dir;

    const startR = maxRadius * (0.7 + Math.random() * 0.3);
    const startX = x + Math.cos(angle) * startR;
    const startY = y + Math.sin(angle) * startR;

    bounceCircleParticles.push({
      x: startX,
      y: startY,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 0.45 + Math.random() * 0.25,
      birth: now,
      size: 1.5 + Math.random() * 2.0,
    });
  }
}

function updateBounceCircleParticles(dt) {
  const now = performance.now();
  bounceCircleParticles = bounceCircleParticles.filter((p) => {
    const age = (now - p.birth) / 1000;
    if (age > p.life) return false;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.96;
    p.vy *= 0.96;
    return true;
  });
}

function drawBounceCircleParticles(ctx) {
  const now = performance.now();
  for (const p of bounceCircleParticles) {
    const age = (now - p.birth) / 1000;
    const alpha = 1 - age / p.life;
    if (alpha <= 0) continue;
    ctx.fillStyle = `rgba(0,0,0,${alpha})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
}

// Small laser spawn
function spawnWarning(gameStartTime) {
  if (!getHasMouse()) return;

  const now = performance.now() / 1000;
  const elapsed = (performance.now() - gameStartTime) / 1000;

  const windowStart = now - (deathMode ? 0.6 : 1.0);
  while (recentSmallLaserTimes.length && recentSmallLaserTimes[0] < windowStart) {
    recentSmallLaserTimes.shift();
  }
  const maxSmall = getMaxSmallLasersPerSecond(elapsed);
  if (recentSmallLaserTimes.length >= maxSmall) return;

  const cursorCenter = getCursorCenter();

  const distances = [0, 100, 300];
  const d = distances[Math.floor(Math.random() * distances.length)];

  const phi = Math.random() * Math.PI * 2;
  const nx = Math.cos(phi);
  const ny = Math.sin(phi);

  const normal = { x: nx, y: ny };
  const tx = -ny;
  const ty = nx;
  const tangent = { x: tx, y: ty };

  // ensure the warning origin stays inside the screen
  let px = cursorCenter.x + nx * d;
  let py = cursorCenter.y + ny * d;
  px = Math.min(Math.max(px, 0), width);
  py = Math.min(Math.max(py, 0), height);

  warnings.push({
    px,
    py,
    normal,
    tangent,
    spawnTime: now,
    fired: false,
    fireTime: null,
  });

  playSmallLaserWarningSound();
}

// Large laser spawn (only 90 or 180 deg; moves toward player)
function spawnLargeWarning(ignoreLimits = false) {
  if (!getHasMouse()) return;

  const now = performance.now() / 1000;

  const totalLarge = largeWarnings.filter((lw) => !lw.isBarrage).length;
  const maxLarge = deathMode ? 6 : 4;
  if (!ignoreLimits && totalLarge >= maxLarge) return;

  const distances = deathMode ? [120, 200, 320] : [140, 220, 320];
  const d = distances[Math.floor(Math.random() * distances.length)];

  const allowedAngles = [Math.PI / 2, Math.PI];
  const phi = allowedAngles[Math.floor(Math.random() * allowedAngles.length)];
  const nx = Math.cos(phi);
  const ny = Math.sin(phi);

  const normal = { x: nx, y: ny };
  const tangent = { x: -ny, y: nx };

  const cursorCenter = getCursorCenter();

  // clamp origin inside the visible playfield
  let px = cursorCenter.x + nx * d;
  let py = cursorCenter.y + ny * d;
  px = Math.min(Math.max(px, 0), width);
  py = Math.min(Math.max(py, 0), height);

  const dx = cursorCenter.x - px;
  const dy = cursorCenter.y - py;
  const signedDist = dx * normal.x + dy * normal.y;
  const direction = signedDist >= 0 ? 1 : -1;

  largeWarnings.push({
    px,
    py,
    normal,
    tangent,
    direction,
    spawnTime: now,
    fired: false,
    fireTime: null,
    totalTravel: 0,
    travelSoFar: 0,
    moveDuration: 0,
    isBarrage: false,
  });

  playLargeLaserWarningSound();
}

// New: spawn a barrage of large lasers
function spawnLargeLaserBarrage(gameStartTime, ignoreGuards = false, cause = null) {
  if (!getHasMouse()) return;

  const now = performance.now() / 1000;

  if (!ignoreGuards) {
    const activeBarrage = largeWarnings.some((lw) => lw.isBarrage);
    if (activeBarrage) return;
    const cooldown = deathMode ? BARRAGE_COOLDOWN_DEATH : BARRAGE_COOLDOWN_NORMAL;
    if (now - lastBarrageSpawnTime < cooldown) return;
  }

  const orientations = [Math.PI / 2, Math.PI];
  const phi = orientations[Math.floor(Math.random() * orientations.length)];
  const nx = Math.cos(phi);
  const ny = Math.sin(phi);
  const normal = { x: nx, y: ny };
  const tangent = { x: -ny, y: nx };

  const count = deathMode ? BARRAGE_LASERS_PER_GROUP_DEATH : BARRAGE_LASERS_PER_GROUP_NORMAL;
  for (let i = 0; i < count; i++) {
    // allow barrages to spawn all the way to the edges/corners
    const px = Math.random() * width;
    const py = Math.random() * height;

    const fireOffset = Math.random() * (deathMode ? 1.0 : 1.5);

    largeWarnings.push({
      px,
      py,
      normal,
      tangent,
      direction: 0,
      spawnTime: now,
      fired: false,
      fireTime: null,
      totalTravel: 0,
      travelSoFar: 0,
      moveDuration: getLargeLaserActiveTime(),
      isBarrage: true,
      barrageFireOffset: fireOffset,
      cause, // track origin cause for this barrage
    });
  }

  barrageGroups.push({
    spawnTime: now,
  });
  lastBarrageSpawnTime = now;

  playLargeLaserWarningSound();
}

// New: Saws spawn
function spawnSaw() {
  if (!getHasMouse()) return;
  const maxSaws = deathMode ? MAX_SAWS_DEATH : MAX_SAWS_NORMAL;
  if (saws.length >= maxSaws) return;

  const now = performance.now() / 1000;
  const radius = 14;

  // Spawn just offscreen at a random edge, moving inward
  const side = Math.floor(Math.random() * 4); // 0=left,1=right,2=top,3=bottom
  let x, y, vx, vy;

  const speed = 100 + Math.random() * 60;

  switch (side) {
    case 0: // left
      x = -radius - 40;
      y = Math.random() * height;
      vx = speed;
      vy = (Math.random() - 0.5) * speed;
      break;
    case 1: // right
      x = width + radius + 40;
      y = Math.random() * height;
      vx = -speed;
      vy = (Math.random() - 0.5) * speed;
      break;
    case 2: // top
      x = Math.random() * width;
      y = -radius - 40;
      vx = (Math.random() - 0.5) * speed;
      vy = speed;
      break;
    default: // bottom
      x = Math.random() * width;
      y = height + radius + 40;
      vx = (Math.random() - 0.5) * speed;
      vy = -speed;
      break;
  }

  saws.push({
    x,
    y,
    vx,
    vy,
    r: radius,
    birth: now,
    angle: Math.random() * Math.PI * 2,
    spin: (Math.random() > 0.5 ? 1 : -1) * (1.2 + Math.random() * 0.8),
    trail: [],
  });
}

// New: Large saw volley spawn (appears, then explodes into 6 saws)
function spawnLargeSawVolley(ignoreLimit = false, cause = null) {
  if (!getHasMouse()) return;

  const now = performance.now() / 1000;

  // limit concurrent large saws
  if (!ignoreLimit && largeSaws.length >= 4) return;

  // place near the play area center-ish
  const margin = Math.min(width, height) * 0.2;
  const x = margin + Math.random() * (width - margin * 2);
  const y = margin + Math.random() * (height - margin * 2);

  // six evenly spaced outgoing directions for the spawned saws
  const directions = [];
  const count = 6;
  for (let i = 0; i < count; i++) {
    const a = (i * 2 * Math.PI) / count;
    directions.push({ x: Math.cos(a), y: Math.sin(a) });
  }

  // new timing: 1s grey warning, then 3s active before explosion
  const warningDuration = 1.0;
  const activeDuration = 3.0;
  const appearTime = now + warningDuration;
  const explodeTime = appearTime + activeDuration;

  largeSaws.push({
    x,
    y,
    baseRadius: 12,
    maxRadius: 44,
    spawnTime: now,
    appearTime,
    explodeTime,
    directions,
    exploded: false,
    _playedWarningSound: false,
    cause, // track cause for punishment deaths
  });

  playLargeSawAppearSound();
}

// Helper: explode a large saw into 6 normal saws
function explodeLargeSaw(ls) {
  const now = performance.now() / 1000;
  const speed = 200;

  // spawn 6 saws following the stored directions
  const dirs = ls.directions && ls.directions.length === 6
    ? ls.directions
    : Array.from({ length: 6 }, (_, i) => {
        const a = (i * 2 * Math.PI) / 6;
        return { x: Math.cos(a), y: Math.sin(a) };
      });

  for (let i = 0; i < dirs.length; i++) {
    const dir = dirs[i];
    const vx = dir.x * speed;
    const vy = dir.y * speed;

    saws.push({
      x: ls.x,
      y: ls.y,
      vx,
      vy,
      r: 14,
      birth: now,
      angle: Math.random() * Math.PI * 2,
      spin: (Math.random() > 0.5 ? 1 : -1) * (1.5 + Math.random() * 0.8),
      trail: [],
      cause: ls.cause || null,
    });
  }

  spawnLargeSawParticles(ls.x, ls.y);
  playLargeSawExplosionSound();
}

// New: bouncing circle spawn
function spawnBounceCircle() {
  if (!getHasMouse()) return;
  const maxCircles = deathMode ? MAX_BOUNCE_CIRCLES_DEATH : MAX_BOUNCE_CIRCLES_NORMAL;
  if (bounceCircles.length >= maxCircles) return;

  const now = performance.now() / 1000;

  const margin = 80;
  const x = margin + Math.random() * (width - margin * 2);
  const y = margin + Math.random() * (height - margin * 2);

  const warningTime = deathMode ? BOUNCE_CIRCLE_WARNING_TIME_DEATH : BOUNCE_CIRCLE_WARNING_TIME_NORMAL;
  const bounceTime = deathMode ? BOUNCE_CIRCLE_BOUNCE_TIME_DEATH : BOUNCE_CIRCLE_BOUNCE_TIME_NORMAL;

  const spawnTime = now;
  const appearTime = spawnTime + warningTime;
  const disappearTime = appearTime + bounceTime;

  const base = Math.min(width, height) * 0.16;
  let maxRadius = Math.max(30, Math.min(60, base));
  maxRadius *= 1.25;

  bounceCircles.push({
    x,
    y,
    spawnTime,
    appearTime,
    disappearTime,
    maxRadius,
    implosionTime: appearTime + bounceTime * 0.85,
    exploded: false,
    playedWarningSound: false,
  });

  playBounceCircleWarningSound();
}

// NEW: externally-triggered barrage wave (e.g. on right-click)
export function triggerBarrageWave(count = 5, gameStartTime) {
  const n = Math.max(1, count | 0);
  for (let i = 0; i < n; i++) {
    spawnLargeLaserBarrage(gameStartTime, true, "rightClickBarrage");
  }
}

// NEW: externally-triggered large saw punishment (e.g. window/tab switch)
export function triggerLargeSawPunishment(count = 15) {
  const n = Math.max(1, count | 0);
  // for window punishment now spawn only barrages, tagged with windowPunish
  for (let i = 0; i < n; i++) {
    spawnLargeLaserBarrage(0, true, "windowPunish");
  }
}

export function resetHazards() {
  warnings.length = 0;
  largeWarnings.length = 0;
  recentSmallLaserTimes.length = 0;
  recentLargeLaserTimes.length = 0;
  largeLaserParticles.length = 0;
  saws.length = 0;
  largeSaws.length = 0;
  largeSawParticles.length = 0;
  barrageGroups.length = 0;
  lastBarrageSpawnTime = 0;
  bounceCircles.length = 0;
  bounceCircleParticles.length = 0;
}

export function updateHazards(dt, allowSpawns, gameRunning, gameStartTime) {
  const now = performance.now() / 1000;

  if (allowSpawns && gameRunning) {
    const elapsed = (performance.now() - gameStartTime) / 1000;
    let difficultyFactorBase = 0.6 + Math.min(elapsed / 40, 1.0);

    // Death mode: start slightly harder and ramp up further over time
    let difficultyFactor;
    if (deathMode) {
      const extraRamp = 1 + Math.min(elapsed / 120, 1.0); // up to +100% over 2 minutes
      difficultyFactor = difficultyFactorBase * 1.25 * 1.25 * extraRamp; // ~56% harder baseline vs normal, then ramps
    } else {
      difficultyFactor = difficultyFactorBase;
    }

    // GLOBAL DIFFICULTY SCALING: +50% for normal, +100% for death mode
    if (deathMode) {
      difficultyFactor *= 2.0;
    } else {
      difficultyFactor *= 1.5;
    }

    // Extra 10% difficulty boost in death mode
    if (deathMode) {
      difficultyFactor *= 1.1;
    }

    const smallLaserOnlyPhase = !deathMode && elapsed >= 60 && elapsed < 90;
    const sawMayhemPhase = !deathMode && elapsed >= 104 && elapsed < 120;
    const hardMode = !deathMode && elapsed >= 120;

    // Small lasers
    if (!sawMayhemPhase) {
      let baseSpawnRate;
      if (deathMode) {
        baseSpawnRate = 1.0;
      } else if (smallLaserOnlyPhase) {
        baseSpawnRate = 2.0;
      } else {
        baseSpawnRate = elapsed >= 10 ? 0.7 : 1.0;
      }
      if (hardMode) {
        baseSpawnRate *= 4.0;
      }
      const spawnChance = baseSpawnRate * difficultyFactor * dt;
      if (Math.random() < spawnChance) {
        spawnWarning(gameStartTime);
      }
    }

    // Large lasers
    if ((!smallLaserOnlyPhase && !sawMayhemPhase && elapsed >= 5) || deathMode) {
      const activeLarge = largeWarnings.filter((lw) => lw.fired && !lw.isBarrage).length;
      let baseLargeSpawnRate = deathMode ? 0.2 : 0.18;
      if (!deathMode) {
        if (activeLarge >= 3) {
          baseLargeSpawnRate = 0.04;
        } else if (activeLarge === 2) {
          baseLargeSpawnRate = 0.09;
        }
      }
      if (hardMode) {
        baseLargeSpawnRate *= 4.0;
      }
      const largeSpawnChance = baseLargeSpawnRate * difficultyFactor * dt;
      if (Math.random() < largeSpawnChance) {
        spawnLargeWarning();
      }
    }

    // Saws
    const totalSawHazards = saws.length + largeSaws.length;
    const maxSawHazards = deathMode
      ? MAX_SAWS_DEATH
      : sawMayhemPhase
      ? 20
      : MAX_SAWS_NORMAL;

    const sawMinTime = deathMode ? SAW_MIN_SPAWN_TIME_DEATH : SAW_MIN_SPAWN_TIME_NORMAL;
    if (
      elapsed >= sawMinTime &&
      totalSawHazards < maxSawHazards &&
      !smallLaserOnlyPhase
    ) {
      let sawSpawnRate = deathMode ? SAW_SPAWN_RATE_DEATH : SAW_SPAWN_RATE_NORMAL;
      if (sawMayhemPhase) {
        sawSpawnRate = SAW_SPAWN_RATE_NORMAL * 2.5;
      }
      if (hardMode) {
        sawSpawnRate *= 4.0;
      }
      const sawSpawnChance = sawSpawnRate * difficultyFactor * dt;
      if (Math.random() < sawSpawnChance) {
        spawnSaw();
      }
    }

    // Large saw volleys
    const largeSawMinTime = deathMode ? LARGE_SAW_MIN_TIME_DEATH : LARGE_SAW_MIN_TIME_NORMAL;
    if (
      elapsed >= largeSawMinTime &&
      totalSawHazards < maxSawHazards &&
      !smallLaserOnlyPhase
    ) {
      let largeSawChance =
        (deathMode ? LARGE_SAW_SPAWN_RATE_DEATH : LARGE_SAW_SPAWN_RATE_NORMAL) * dt;
      if (sawMayhemPhase) {
        largeSawChance = LARGE_SAW_SPAWN_RATE_NORMAL * 2.5 * dt;
      }
      if (hardMode) {
        largeSawChance *= 4.0;
      }
      if (Math.random() < largeSawChance) {
        spawnLargeSawVolley();
      }
    }

    // Large-laser barrage
    const barrageMinTime = deathMode ? BARRAGE_MIN_TIME_DEATH : BARRAGE_MIN_TIME_NORMAL;
    const barrageCooldown = deathMode ? BARRAGE_COOLDOWN_DEATH : BARRAGE_COOLDOWN_NORMAL;
    if (
      !smallLaserOnlyPhase &&
      !sawMayhemPhase &&
      elapsed >= barrageMinTime &&
      now - lastBarrageSpawnTime >= barrageCooldown
    ) {
      let barrageRate = deathMode ? BARRAGE_SPAWN_RATE_DEATH : BARRAGE_SPAWN_RATE_NORMAL;
      if (hardMode) {
        barrageRate *= 4.0;
      }
      const barrageChance = barrageRate * difficultyFactor * dt;
      if (Math.random() < barrageChance) {
        spawnLargeLaserBarrage(gameStartTime, false);
      }
    }

    // Bouncing circles
    const circleMinTime = deathMode ? BOUNCE_CIRCLE_MIN_TIME_DEATH : BOUNCE_CIRCLE_MIN_TIME_NORMAL;
    const maxBounceCircles = deathMode ? MAX_BOUNCE_CIRCLES_DEATH : MAX_BOUNCE_CIRCLES_NORMAL;
    if (elapsed >= circleMinTime && bounceCircles.length < maxBounceCircles) {
      let circleRate = 0.2;
      if (hardMode) {
        circleRate *= 3.0;
      }
      const circleChance = circleRate * difficultyFactor * dt;
      if (Math.random() < circleChance) {
        spawnBounceCircle();
      }
    }
  }

  // Small warnings
  for (const w of warnings) {
    const age = now - w.spawnTime;
    const warningTime = getLaserWarningTime();
    if (!w.fired && age >= warningTime) {
      w.fired = true;
      w.fireTime = now;
      recentSmallLaserTimes.push(now);
      playSmallLaserFireSound();
    }
  }

  // Remove old small lasers
  for (let i = warnings.length - 1; i >= 0; i--) {
    const w = warnings[i];
    if (w.fired && now - w.fireTime > LASER_ACTIVE_TIME) {
      warnings.splice(i, 1);
    }
  }

  // Large warnings update
  for (const lw of largeWarnings) {
    const age = now - lw.spawnTime;
    const extraDelay =
      lw.isBarrage && typeof lw.barrageFireOffset === "number"
        ? lw.barrageFireOffset
        : 0;
    const baseWarningTime = lw.isBarrage
      ? (deathMode ? BARRAGE_WARNING_TIME_DEATH : BARRAGE_WARNING_TIME_NORMAL)
      : getLargeLaserWarningTime();

    if (!lw.fired && age >= baseWarningTime + extraDelay) {
      lw.fired = true;
      lw.fireTime = now;
      recentLargeLaserTimes.push(now);

      if (!lw.isBarrage) {
        lw.activeTime = getLargeLaserActiveTime();
        const elapsed = (performance.now() - gameStartTime) / 1000;
        const t = Math.max(0, Math.min((elapsed - 5) / 30, 1));
        lw.totalTravel = 50 + 75 * t;
        lw.travelSoFar = 0;
        lw.moveDuration = lw.activeTime * 0.6;
      } else {
        lw.activeTime = 2 + Math.random() * 2.5;
        lw.totalTravel = 0;
        lw.travelSoFar = 0;
        lw.moveDuration = lw.activeTime * 0.6;
      }

      const L = Math.max(width, height) * 2;
      const startX = lw.px - lw.tangent.x * L;
      const startY = lw.py - lw.tangent.y * L;
      const endX = lw.px + lw.tangent.x * L;
      const endY = lw.py + lw.tangent.y * L;
      spawnLargeLaserParticles(startX, startY, endX, endY);

      playLargeLaserFireSound();
    }

    if (lw.fired && !lw.isBarrage) {
      const lifeSoFar = now - lw.fireTime;
      if (lifeSoFar < lw.moveDuration && lw.travelSoFar < lw.totalTravel) {
        const remainingDist = lw.totalTravel - lw.travelSoFar;
        const remainingTime = lw.moveDuration - lifeSoFar;
        if (remainingTime > 0) {
          const speed = remainingDist / remainingTime;
          const moveDist = speed * dt * lw.direction;

          lw.px += lw.normal.x * moveDist;
          lw.py += lw.normal.y * moveDist;
          lw.travelSoFar += Math.abs(moveDist);
        }
      }
    }
  }

  // Remove old large lasers
  for (let i = largeWarnings.length - 1; i >= 0; i--) {
    const lw = largeWarnings[i];
    const activeTime = lw.activeTime || getLargeLaserActiveTime();
    if (lw.fired && now - lw.fireTime > activeTime) {
      largeWarnings.splice(i, 1);
    }
  }

  // Update saws and their trails
  const cutoff = now - SAW_TRAIL_DURATION;
  for (let i = saws.length - 1; i >= 0; i--) {
    const s = saws[i];
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    s.angle += s.spin * dt;

    s.trail.push({ x: s.x, y: s.y, t: now });
    while (s.trail.length && s.trail[0].t < cutoff) {
      s.trail.shift();
    }

    if (
      s.x < -s.r - 60 ||
      s.x > width + s.r + 60 ||
      s.y < -s.r - 60 ||
      s.y > height + s.r + 60
    ) {
      saws.splice(i, 1);
    }
  }

  // Update large saws (growth, warning timing, explosion)
  for (let i = largeSaws.length - 1; i >= 0; i--) {
    const ls = largeSaws[i];
    const ageSinceSpawn = now - ls.spawnTime;

    if (!ls._playedWarningSound && ageSinceSpawn >= 0) {
      ls._playedWarningSound = true;
      playLargeSawWarningSweepSound();
    }

    if (!ls.exploded && now >= ls.explodeTime) {
      ls.exploded = true;
      explodeLargeSaw(ls);
    }

    if (ls.exploded && now > ls.explodeTime + 0.25) {
      largeSaws.splice(i, 1);
    }
  }

  // Update bouncing circles (lifetime + implosion particles)
  for (let i = bounceCircles.length - 1; i >= 0; i--) {
    const bc = bounceCircles[i];

    if (!bc.exploded && now >= bc.implosionTime && now < bc.disappearTime) {
      bc.exploded = true;
      spawnBounceCircleParticles(bc.x, bc.y, bc.maxRadius);
      playBounceCircleImplosionSound();
    }

    if (now >= bc.disappearTime) {
      bounceCircles.splice(i, 1);
    }
  }

  updateLargeLaserParticles(dt);
  updateLargeSawParticles(dt);
  updateBounceCircleParticles(dt);
}

export function drawHazards(ctx) {
  const now = performance.now() / 1000;
  const L = Math.max(width, height) * 2;

  // Draw saw trails
  for (const s of saws) {
    if (s.trail.length < 2) continue;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    for (let i = 0; i < s.trail.length; i++) {
      const p = s.trail[i];
      const age = now - p.t;
      const alpha = 1 - age / SAW_TRAIL_DURATION;
      if (alpha <= 0) continue;
      ctx.strokeStyle = `rgba(0,0,0,${0.2 * alpha})`;
      ctx.lineWidth = 3 * alpha;
      if (i === 0) {
        ctx.moveTo(p.x, p.y);
      } else {
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
      }
    }
  }

  // Draw saws (black circle with spikes)
  for (const s of saws) {
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(s.angle);

    ctx.fillStyle = "#000";
    ctx.beginPath();
    ctx.arc(0, 0, s.r * 0.7, 0, Math.PI * 2);
    ctx.fill();

    const spikes = 10;
    const innerR = s.r * 0.7;
    const outerR = s.r;
    ctx.beginPath();
    for (let i = 0; i < spikes; i++) {
      const a0 = (i * 2 * Math.PI) / spikes;
      const a1 = ((i + 0.5) * 2 * Math.PI) / spikes;
      const a2 = ((i + 1) * 2 * Math.PI) / spikes;
      const x0 = Math.cos(a0) * innerR;
      const y0 = Math.sin(a0) * innerR;
      const x1 = Math.cos(a1) * outerR;
      const y1 = Math.sin(a1) * outerR;
      const x2 = Math.cos(a2) * innerR;
      const y2 = Math.sin(a2) * innerR;
      if (i === 0) {
        ctx.moveTo(x0, y0);
      }
      ctx.lineTo(x1, y1);
      ctx.lineTo(x2, y2);
    }
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  // Draw large saws (center, new warning + bounce-in + blinking)
  for (const ls of largeSaws) {
    const ageSinceSpawn = now - ls.spawnTime;
    const ageSinceAppear = now - ls.appearTime;

    const maxRadius = ls.maxRadius;
    const appearDuration = 0.35;
    const activeDuration = ls.explodeTime - ls.appearTime;

    ctx.save();
    ctx.translate(ls.x, ls.y);

    // PHASE 1: grey warning saw (before appearTime)
    if (ageSinceAppear < 0) {
      const warnT = Math.max(0, Math.min(1, ageSinceSpawn / (ls.appearTime - ls.spawnTime)));
      const radius = maxRadius * 0.8;
      const alpha = 0.15 + 0.25 * warnT;

      ctx.globalAlpha = alpha;
      const warningGrey = "#b0b0b0";
      ctx.fillStyle = warningGrey;
      ctx.strokeStyle = warningGrey;

      const spikes = 14;
      const innerR = radius * 0.7;
      const outerR = radius;

      ctx.beginPath();
      ctx.arc(0, 0, innerR, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      for (let i = 0; i < spikes; i++) {
        const a0 = (i * 2 * Math.PI) / spikes;
        const a1 = ((i + 0.5) * 2 * Math.PI) / spikes;
        const a2 = ((i + 1) * 2 * Math.PI) / spikes;
        const x0 = Math.cos(a0) * innerR;
        const y0 = Math.sin(a0) * innerR;
        const x1 = Math.cos(a1) * outerR;
        const y1 = Math.sin(a1) * outerR;
        const x2 = Math.cos(a2) * innerR;
        const y2 = Math.sin(a2) * innerR;
        if (i === 0) {
          ctx.moveTo(x0, y0);
        }
        ctx.lineTo(x1, y1);
        ctx.lineTo(x2, y2);
      }
      ctx.closePath();
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.restore();
      continue;
    }

    // PHASE 2+3: appear (bounce-in) then active blinking
    const activeT = Math.max(0, ageSinceAppear);
    const appearT = Math.min(1, activeT / appearDuration);

    // one-time bounce curve from 0 -> overshoot -> 1
    const overshoot = 0.18;
    let baseScale;
    if (appearT < 1) {
      const s = Math.sin(appearT * Math.PI);
      baseScale = appearT + overshoot * s;
    } else {
      baseScale = 1;
    }

    // additional subtle bouncing while blinking (does not affect hitbox)
    const blinkProgress = Math.max(0, Math.min(1, activeT / activeDuration));
    const blinkFreq = 2 + 6 * blinkProgress;
    const blinkPhase = Math.sin(2 * Math.PI * blinkFreq * activeT);
    const blinkAmount = (blinkPhase + 1) / 2;

    const bounceScale = 1 + 0.08 * blinkAmount;
    const visualScale = baseScale * bounceScale;
    const radius = maxRadius * visualScale;

    const warningWindowStart = ls.explodeTime - 2.0;
    if (now >= warningWindowStart && now < ls.explodeTime) {
      const tWarn = (now - warningWindowStart) / 2.0;
      const alphaWarn = 0.1 + 0.5 * tWarn;
      const maxLineLen = Math.max(width, height) + 80;

      ctx.save();
      ctx.setLineDash([10, 8]);
      ctx.lineWidth = 3.5;

      for (const dir of ls.directions || []) {
        const sx = -dir.x * maxLineLen;
        const sy = -dir.y * maxLineLen;
        const ex = dir.x * radius * 0.8;
        const ey = dir.y * radius * 0.8;

        ctx.strokeStyle = `rgba(0,0,0,${alphaWarn * 0.4})`;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(ex, ey);
        ctx.stroke();

        ctx.lineWidth = 2.1;
        ctx.strokeStyle = `rgba(0,0,0,${alphaWarn})`;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(ex, ey);
        ctx.stroke();
      }

      ctx.setLineDash([]);
      ctx.restore();
    }

    const mix = blinkAmount;
    const bodyGrey = 0 + Math.round(255 * mix);
    const bodyColor = `rgb(${bodyGrey},${bodyGrey},${bodyGrey})`;

    const alpha = 0.4 + 0.6 * appearT;

    const spikes = 14;
    const innerR = radius * 0.7;
    const outerR = radius;

    ctx.globalAlpha = alpha;
    ctx.fillStyle = bodyColor;
    ctx.strokeStyle = bodyColor;

    ctx.beginPath();
    ctx.arc(0, 0, innerR, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    for (let i = 0; i < spikes; i++) {
      const a0 = (i * 2 * Math.PI) / spikes;
      const a1 = ((i + 0.5) * 2 * Math.PI) / spikes;
      const a2 = ((i + 1) * 2 * Math.PI) / spikes;
      const x0 = Math.cos(a0) * innerR;
      const y0 = Math.sin(a0) * innerR;
      const x1 = Math.cos(a1) * outerR;
      const y1 = Math.sin(a1) * outerR;
      const x2 = Math.cos(a2) * innerR;
      const y2 = Math.sin(a2) * innerR;
      if (i === 0) {
        ctx.moveTo(x0, y0);
      }
      ctx.lineTo(x1, y1);
      ctx.lineTo(x2, y2);
    }
    ctx.closePath();
    ctx.fill();

    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.restore();
  }

  // Draw bouncing circle hazards
  for (const bc of bounceCircles) {
    const { x, y, spawnTime, appearTime, disappearTime, maxRadius } = bc;
    ctx.save();
    ctx.translate(x, y);

    const warningTime = deathMode ? BOUNCE_CIRCLE_WARNING_TIME_DEATH : BOUNCE_CIRCLE_WARNING_TIME_NORMAL;
    const bounceTime = deathMode ? BOUNCE_CIRCLE_BOUNCE_TIME_DEATH : BOUNCE_CIRCLE_BOUNCE_TIME_NORMAL;

    if (now < appearTime) {
      const growDuration = Math.max(0.1, warningTime - 0.5);
      const tRaw = growDuration > 0 ? (now - spawnTime) / growDuration : 1;
      const growT = Math.max(0, Math.min(1, tRaw));
      const eased = growT * growT;

      let radius;
      if (tRaw < 1) {
        radius = maxRadius * (0.25 + 0.75 * eased);
      } else {
        radius = maxRadius;
      }

      const alpha =
        tRaw < 1
          ? 0.08 + 0.4 * eased
          : 0.08 + 0.4 * 1;

      ctx.globalAlpha = alpha;
      ctx.fillStyle = "#b0b0b0";
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.fill();
    } else if (now < disappearTime) {
      const bounceT = Math.max(
        0,
        Math.min(1, (now - appearTime) / bounceTime)
      );
      const easeOut = 1 - Math.pow(1 - bounceT, 3);
      const scaleUp = Math.sin(bounceT * Math.PI);
      const radius = maxRadius * scaleUp;

      if (radius > 0) {
        ctx.globalAlpha = 1;
        ctx.fillStyle = "#000000";
        ctx.beginPath();
        ctx.arc(0, 0, radius, 0, Math.PI * 2);
        ctx.fill();

        const ringRadius = radius * (0.55 + 0.15 * (1 - easeOut));
        const ringAlpha = 0.35 + 0.35 * easeOut;
        ctx.globalAlpha = ringAlpha;
        ctx.strokeStyle = "#000000";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, ringRadius, 0, Math.PI * 2);
        ctx.stroke();

        ctx.globalAlpha = ringAlpha * 0.5;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(0, 0, radius * 1.05, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  // Small warnings
  for (const w of warnings) {
    const startX = w.px - w.tangent.x * L;
    const startY = w.py - w.tangent.y * L;
    const endX = w.px + w.tangent.x * L;
    const endY = w.py + w.tangent.y * L;

    const age = now - w.spawnTime;

    if (!w.fired) {
      const t = Math.min(1, age / LASER_WARNING_TIME_BASE_NORMAL);
      const eased = t * t;
      const alpha = 0.1 + 0.5 * eased;
      const widthLine = 1 + 3 * eased;
      ctx.strokeStyle = `rgba(0,0,0,${alpha})`;
      ctx.lineWidth = widthLine;
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(endX, endY);
      ctx.stroke();
    } else {
      const life = now - w.fireTime;
      const t = Math.min(1, life / LASER_ACTIVE_TIME);
      const easedOut = 1 - t * t;
      const alpha = easedOut;
      const widthLine = 5 - 2 * t;
      ctx.strokeStyle = `rgba(0,0,0,${alpha})`;
      ctx.lineWidth = widthLine;

      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(endX, endY);
      ctx.stroke();

      ctx.strokeStyle = `rgba(0,0,0,${alpha * 0.3})`;
      ctx.lineWidth = widthLine + 2;
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(endX, endY);
      ctx.stroke();
    }
  }

  // Large warnings
  for (const lw of largeWarnings) {
    const startX = lw.px - lw.tangent.x * L;
    const startY = lw.py - lw.tangent.y * L;
    const endX = lw.px + lw.tangent.x * L;
    const endY = lw.py + lw.tangent.y * L;

    const age = now - lw.spawnTime;

    if (!lw.fired) {
      if (lw.isBarrage) {
        const t = Math.min(1, age / BARRAGE_WARNING_TIME_NORMAL);
        const alpha = 0.15 + 0.45 * t;
        const widthLine = 5;

        ctx.save();
        ctx.setLineDash([10, 8]);
        ctx.lineDashOffset = -age * 110;

        ctx.strokeStyle = `rgba(0,0,0,${alpha})`;
        ctx.lineWidth = widthLine;
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
        ctx.stroke();

        const coreAlpha = alpha * 0.6;
        ctx.strokeStyle = `rgba(0,0,0,${coreAlpha})`;
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
        ctx.stroke();

        ctx.setLineDash([]);
        ctx.restore();
      } else {
        let stage = age / getLargeLaserWarningTime();
        const pulse = 0.9 + 0.2 * Math.sin(age * 6);
        if (stage < 1 / 3) {
          ctx.strokeStyle = "rgba(0,0,0,0.18)";
          ctx.lineWidth = 4 * pulse;
        } else if (stage < 2 / 3) {
          ctx.strokeStyle = "rgba(0,0,0,0.3)";
          ctx.lineWidth = 7 * pulse;
        } else {
          ctx.strokeStyle = "rgba(0,0,0,0.45)";
          ctx.lineWidth = 11 * pulse;
        }
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
        ctx.stroke();
      }
    } else {
      const life = now - lw.fireTime;
      const activeTime = lw.activeTime || getLargeLaserActiveTime();
      let alpha = 1;
      if (life > lw.moveDuration) {
        const fadeDuration = activeTime - lw.moveDuration;
        if (fadeDuration > 0) {
          const fadeT = Math.min(
            1,
            Math.max(0, (life - lw.moveDuration) / fadeDuration)
          );
          alpha = (1 - fadeT) * (1 - fadeT);
        }
      }
      let widthLine = 16 - 4 * Math.min(1, life / activeTime);

      if (lw.isBarrage) {
        widthLine *= 0.8;
      }

      const outerAlpha = lw.isBarrage ? alpha * 0.9 : alpha * 0.25;
      const outerWidth = lw.isBarrage ? widthLine + 4 : widthLine + 4;

      // outer glow (still black but softer)
      ctx.strokeStyle = `rgba(0,0,0,${outerAlpha})`;
      ctx.lineWidth = outerWidth;
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(endX, endY);
      ctx.stroke();

      // solid black core stroke so the beam clearly looks black
      const coreAlpha = Math.min(1, alpha * 1.1);
      const coreWidth = lw.isBarrage ? widthLine * 0.7 : widthLine;
      ctx.strokeStyle = `rgba(0,0,0,${coreAlpha})`;
      ctx.lineWidth = coreWidth;
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(endX, endY);
      ctx.stroke();
    }
  }

  drawLargeLaserParticles(ctx);
  drawLargeSawParticles(ctx);
  drawBounceCircleParticles(ctx);
}

export function triggerAllPendingHazards(gameStartTime, deathTime) {
  const nowSec = performance.now() / 1000;

  // Small lasers
  for (const w of warnings) {
    if (!w.fired) {
      w.fired = true;
      w.fireTime = nowSec;
      recentSmallLaserTimes.push(nowSec);
      playSmallLaserFireSound();
    }
  }

  // Large lasers
  for (const lw of largeWarnings) {
    if (!lw.fired) {
      lw.fired = true;
      lw.fireTime = nowSec;
      recentLargeLaserTimes.push(nowSec);

      const elapsed = (deathTime - gameStartTime) / 1000;
      const t = Math.max(0, Math.min((elapsed - 5) / 30, 1));
      if (!lw.isBarrage) {
        lw.activeTime = getLargeLaserActiveTime();
        lw.totalTravel = 50 + 75 * t;
        lw.travelSoFar = 0;
        lw.moveDuration = lw.activeTime * 0.6;
      } else {
        lw.activeTime = 2 + Math.random() * 2.5;
        lw.totalTravel = 0;
        lw.travelSoFar = 0;
        lw.moveDuration = lw.activeTime * 0.6;
      }

      const L = Math.max(width, height) * 2;
      const startX = lw.px - lw.tangent.x * L;
      const startY = lw.py - lw.tangent.y * L;
      const endX = lw.px + lw.tangent.x * L;
      const endY = lw.py + lw.tangent.y * L;
      spawnLargeLaserParticles(startX, startY, endX, endY);
      playLargeLaserFireSound();
    }
  }
}

export function checkHazardCollisions(cursorCenter, onDeath) {
  const now = performance.now() / 1000;
  const point = cursorCenter;

  // Small lasers
  for (const w of warnings) {
    if (!w.fired) continue;
    const life = now - w.fireTime;
    if (life < 0 || life > LASER_ACTIVE_TIME) continue;

    const tLife = Math.min(1, Math.max(0, life / LASER_ACTIVE_TIME));
    const currentWidth = 5 - 2 * tLife;
    const thresholdSmall = currentWidth * 0.6;

    const dx = point.x - w.px;
    const dy = point.y - w.py;
    const dist = Math.abs(dx * w.normal.x + dy * w.normal.y);

    if (dist <= thresholdSmall) {
      onDeath();
      return;
    }
  }

  // Large lasers
  for (const lw of largeWarnings) {
    if (!lw.fired) continue;
    const life = now - lw.fireTime;
    const activeTime = lw.activeTime || getLargeLaserActiveTime();
    if (life < 0 || life > activeTime) continue;

    const tLife = Math.min(1, Math.max(0, life / activeTime));
    let currentWidth = 16 - 4 * tLife;
    if (lw.isBarrage) {
      currentWidth *= 0.8;
    }
    const thresholdLarge = currentWidth * 0.6;

    const dx = point.x - lw.px;
    const dy = point.y - lw.py;
    const dist = Math.abs(dx * lw.normal.x + dy * lw.normal.y);

    if (dist <= thresholdLarge) {
      const cause = lw.isBarrage && lw.cause ? lw.cause : null;
      onDeath(cause);
      return;
    }
  }

  // Saws (simple circular collision)
  for (const s of saws) {
    const dx = point.x - s.x;
    const dy = point.y - s.y;
    const distSq = dx * dx + dy * dy;
    const r = s.r;
    if (distSq <= r * r) {
      const cause = s.cause || null;
      onDeath(cause);
      return;
    }
  }

  // Large saws (player dies on touch)
  for (const ls of largeSaws) {
    if (now < ls.appearTime || now > ls.explodeTime) continue;

    const radius = ls.maxRadius;
    const dx = point.x - ls.x;
    const dy = point.y - ls.y;
    const distSq = dx * dx + dy * dy;
    if (distSq <= radius * radius) {
      const cause = ls.cause || null;
      onDeath(cause);
      return;
    }
  }

  // Bouncing circles: lethal only during black bounce phase
  for (const bc of bounceCircles) {
    if (now < bc.appearTime || now > bc.disappearTime) continue;
    const bounceT = Math.max(
      0,
      Math.min(1, (now - bc.appearTime) / BOUNCE_CIRCLE_BOUNCE_TIME_NORMAL)
    );
    const scale = Math.sin(bounceT * Math.PI);
    const radius = bc.maxRadius * scale;
    if (radius <= 0) continue;

    const dx = point.x - bc.x;
    const dy = point.y - bc.y;
    const distSq = dx * dx + dy * dy;
    if (distSq <= radius * radius) {
      onDeath(null);
      return;
    }
  }
}