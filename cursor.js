const DEFAULT_CURSOR_SRC = "/cursor.png";
const cursorImg = new Image();
// ensure custom / uploaded cursor images don't taint the canvas
cursorImg.crossOrigin = "anonymous";
cursorImg.src = DEFAULT_CURSOR_SRC;

let cursorX = 0;
let cursorY = 0;
// treat player as present even if they haven't moved yet
let hasMouse = true;

// fixed logical cursor size (custom PNGs should be made to this size)
const CURSOR_WIDTH = 15;
const CURSOR_HEIGHT = 17;

export function initCursor(canvas) {
  const rect = canvas.getBoundingClientRect();
  cursorX = rect.width / 2;
  cursorY = rect.height / 2;
  hasMouse = true;

  canvas.addEventListener("mousemove", (e) => {
    const r = canvas.getBoundingClientRect();
    cursorX = e.clientX - r.left;
    cursorY = e.clientY - r.top;
    hasMouse = true;
  });

  // Allow mobile/touch users to move the cursor by dragging
  canvas.addEventListener("pointermove", (e) => {
    // Track all pointer types so dragging works on touch and pen
    const r = canvas.getBoundingClientRect();
    cursorX = e.clientX - r.left;
    cursorY = e.clientY - r.top;
    hasMouse = true;
  });
}

export function setGameCursor(active) {
  if (active) {
    document.body.style.cursor = "none";
  } else {
    document.body.style.cursor = "auto";
  }
}

export function setCustomCursorImage(url) {
  const src = url && typeof url === "string" ? url : DEFAULT_CURSOR_SRC;
  cursorImg.src = src;
}

export function drawCursor(ctx) {
  const w = CURSOR_WIDTH;
  const h = CURSOR_HEIGHT;
  if (!cursorImg.complete || cursorImg.naturalWidth === 0) {
    ctx.fillStyle = "#000";
    ctx.beginPath();
    ctx.arc(cursorX + w / 2, cursorY + h / 2, 5, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  ctx.drawImage(cursorImg, cursorX, cursorY, w, h);
}

export function drawCursorHitbox(ctx) {
  // Use the logical cursor size so users can design around this hitbox
  const spriteW = CURSOR_WIDTH;
  const spriteH = CURSOR_HEIGHT;

  // Make the shown hitbox 5% smaller around the sprite center
  const scale = 0.95;
  const w = spriteW * scale;
  const h = spriteH * scale;

  // Center the scaled box on the cursor sprite
  const x = cursorX + (spriteW - w) / 2;
  const y = cursorY + (spriteH - h) / 2;

  ctx.save();
  ctx.strokeStyle = "rgba(255,0,0,0.6)";
  ctx.fillStyle = "rgba(255,0,0,0.15)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

export function getCursorCenter() {
  return { x: cursorX + CURSOR_WIDTH / 2, y: cursorY + CURSOR_HEIGHT / 2 };
}

export function getCursorPosition() {
  return { x: cursorX, y: cursorY };
}

export function getHasMouse() {
  return hasMouse;
}

