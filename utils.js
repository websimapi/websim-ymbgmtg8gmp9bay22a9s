export function formatTimeSeconds(sec) {
  // Default classic formatter (ss.cc)
  const classicFormatter = (secondsFloat) => {
    const seconds = Math.floor(secondsFloat);
    const centi = Math.floor((secondsFloat % 1) * 100);
    const ss = String(seconds).padStart(2, "0");
    const cc = String(centi).padStart(2, "0");
    return `${ss}.${cc}`;
  };

  // Try to read the user's preferred timer style from settings
  let timerStyle = "classic";
  try {
    const raw = localStorage.getItem("cursorDeathSettings_v1");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.timerStyle === "minutes" || parsed.timerStyle === "classic") {
        timerStyle = parsed.timerStyle;
      }
    }
  } catch (e) {
    // If anything fails, silently fall back to classic
    timerStyle = "classic";
  }

  if (timerStyle === "minutes") {
    // Minutes style: mm:ss.mmm (3-digit milliseconds)
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

  // Classic fallback
  return classicFormatter(sec);
}

