// Styled yes/no prompt built on the shared modal behavior, used before
// actions that throw away a game in progress. Cancel, Escape and a
// backdrop tap all count as "no".
import { createModal } from "./modal.js?v=__CACHE_BUST__";

const messageEl = document.getElementById("confirm-message");
const okBtn = document.getElementById("confirm-ok");
let settle = null;

const modal = createModal({
  root: document.getElementById("confirm-modal"),
  closeBtn: document.getElementById("confirm-cancel"),
  backdrop: document.getElementById("confirm-backdrop"),
  onClose: () => finish(false),
});

function finish(answer) {
  const resolve = settle;
  settle = null;
  resolve?.(answer);
}

okBtn.addEventListener("click", () => {
  finish(true);
  modal.close();
});

export function confirmDialog(message, { confirmLabel = "Continue" } = {}) {
  finish(false); // settle any prompt that was somehow still open
  messageEl.textContent = message;
  okBtn.textContent = confirmLabel;
  modal.open();
  return new Promise((resolve) => (settle = resolve));
}
