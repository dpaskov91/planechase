// Keeps the phone screen from dimming/locking while a game is on screen
// (Screen Wake Lock API). Browsers drop the lock whenever the tab is
// hidden, so it's re-requested when the page becomes visible again.
// Unsupported browsers simply keep their normal screen timeout.

let wanted = false;
let lock = null;
let requesting = false;

async function acquire() {
  if (!wanted || lock || requesting || document.visibilityState !== "visible") return;
  requesting = true;
  try {
    const granted = await navigator.wakeLock.request("screen");
    // The player may have left the game view while we were waiting.
    if (!wanted) {
      granted.release().catch(() => {});
      return;
    }
    lock = granted;
    lock.addEventListener("release", () => (lock = null));
  } catch {
    // e.g. battery saver, or not allowed right now — keep the normal timeout
  } finally {
    requesting = false;
  }
}

export function setWakeLock(on) {
  if (!("wakeLock" in navigator)) return;
  wanted = on;
  if (on) acquire();
  else if (lock) {
    lock.release().catch(() => {});
    lock = null;
  }
}

document.addEventListener("visibilitychange", () => {
  if ("wakeLock" in navigator) acquire();
});
