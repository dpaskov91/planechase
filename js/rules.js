// "How to Play" modal — same overlay behavior as the card lightbox
// (see modal.js), just for static rules text.
import { createModal } from "./modal.js?v=__CACHE_BUST__";

export function initRules() {
  const modal = createModal({
    root: document.getElementById("rules-modal"),
    closeBtn: document.getElementById("rules-close"),
    backdrop: document.getElementById("rules-backdrop"),
  });
  document.getElementById("rules-btn").addEventListener("click", modal.open);
}
