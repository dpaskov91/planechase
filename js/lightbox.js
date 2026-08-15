// Shared full-card viewer, used by both the deck builder grid and the
// active-plane display so players can always read full oracle text.

const box = document.getElementById("card-lightbox");
const img = document.getElementById("lightbox-img");
const nameEl = document.getElementById("lightbox-name");
const typeEl = document.getElementById("lightbox-type");
const textEl = document.getElementById("lightbox-text");
const setEl = document.getElementById("lightbox-set");
const backdrop = document.getElementById("lightbox-backdrop");
const closeBtn = document.getElementById("lightbox-close");

export function openLightbox(card) {
  img.src = card.imageLarge;
  img.alt = card.name;
  nameEl.textContent = card.name;
  typeEl.textContent = card.typeLine;
  textEl.textContent = card.oracleText;
  setEl.textContent = `${card.setName} (${card.set?.toUpperCase()})`;
  box.hidden = false;
  document.body.style.overflow = "hidden";
}

function close() {
  box.hidden = true;
  document.body.style.overflow = "";
}

backdrop.addEventListener("click", close);
closeBtn.addEventListener("click", close);
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !box.hidden) close();
});
