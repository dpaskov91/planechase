// Shared open/close behavior for the full-screen overlays (card viewer,
// rules): backdrop click, close button and Escape all close it; focus
// moves into the dialog on open, stays there while Tab is pressed, and
// returns to whatever opened it on close.

const FOCUSABLE = 'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

export function createModal({ root, closeBtn, backdrop }) {
  let returnFocusTo = null;

  function open() {
    returnFocusTo = document.activeElement;
    root.hidden = false;
    document.body.style.overflow = "hidden";
    closeBtn.focus();
  }

  function close() {
    if (root.hidden) return;
    root.hidden = true;
    document.body.style.overflow = "";
    returnFocusTo?.focus?.();
    returnFocusTo = null;
  }

  function trapTab(e) {
    const items = [...root.querySelectorAll(FOCUSABLE)];
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    } else if (!root.contains(document.activeElement)) {
      e.preventDefault();
      first.focus();
    }
  }

  backdrop.addEventListener("click", close);
  closeBtn.addEventListener("click", close);
  document.addEventListener("keydown", (e) => {
    if (root.hidden) return;
    if (e.key === "Escape") close();
    else if (e.key === "Tab") trapTab(e);
  });

  return { open, close };
}
