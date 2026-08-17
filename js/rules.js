// "How to Play" modal — same open/close pattern as the card lightbox
// (backdrop click, close button, Escape), just for static rules text.

const modal = document.getElementById("rules-modal");
const openBtn = document.getElementById("rules-btn");
const closeBtn = document.getElementById("rules-close");
const backdrop = document.getElementById("rules-backdrop");

function open() {
  modal.hidden = false;
  document.body.style.overflow = "hidden";
}

function close() {
  modal.hidden = true;
  document.body.style.overflow = "";
}

export function initRules() {
  openBtn.addEventListener("click", open);
  closeBtn.addEventListener("click", close);
  backdrop.addEventListener("click", close);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !modal.hidden) close();
  });
}
