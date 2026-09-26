// Shared full-card viewer, used by both the deck builder grid and the
// active-plane display so players can always read full oracle text.
import { createModal } from "./modal.js?v=__CACHE_BUST__";

const img = document.getElementById("lightbox-img");
const nameEl = document.getElementById("lightbox-name");
const typeEl = document.getElementById("lightbox-type");
const textEl = document.getElementById("lightbox-text");
const setEl = document.getElementById("lightbox-set");

const modal = createModal({
  root: document.getElementById("card-lightbox"),
  closeBtn: document.getElementById("lightbox-close"),
  backdrop: document.getElementById("lightbox-backdrop"),
});

export function openLightbox(card) {
  img.src = card.imageLarge;
  img.alt = card.name;
  nameEl.textContent = card.name;
  typeEl.textContent = card.typeLine;
  textEl.textContent = card.oracleText;
  setEl.textContent = `${card.setName} (${card.set?.toUpperCase()})`;
  modal.open();
}
