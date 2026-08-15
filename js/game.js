import { el, shuffle, toast, formatTime } from "./util.js?v=__CACHE_BUST__";
import { store } from "./state.js?v=__CACHE_BUST__";
import { openLightbox } from "./lightbox.js?v=__CACHE_BUST__";
import { createPlanarDie, OUTCOME_LABELS } from "./die.js?v=__CACHE_BUST__";

const activePlaneEl = document.getElementById("active-plane");
const deckCountEl = document.getElementById("deck-count");
const planeswalkBtn = document.getElementById("planeswalk-btn");
const rollDieBtn = document.getElementById("roll-die-btn");
const dieResultEl = document.getElementById("die-result");
const phenomenonBanner = document.getElementById("phenomenon-banner");
const phenomenonText = document.getElementById("phenomenon-text");
const phenomenonAckBtn = document.getElementById("phenomenon-ack-btn");
const historyBtn = document.getElementById("history-btn");
const historyPanel = document.getElementById("history-panel");
const historyCloseBtn = document.getElementById("history-close-btn");
const historyList = document.getElementById("history-list");
const newPoolBtn = document.getElementById("new-pool-btn");
const resetGameBtn = document.getElementById("reset-game-btn");

export function initGame(cardsById, { onEditPool }) {
  let deck = store.getDeck();
  let current = store.getCurrent();
  let pendingPhenomenon = null;
  const die = createPlanarDie(document.getElementById("die-cube"));

  renderActivePlane();
  renderDeckCount();
  renderHistory();
  updateControls();
  preloadUpcomingPlanes();

  planeswalkBtn.addEventListener("click", () => planeswalk());
  rollDieBtn.addEventListener("click", () => handleRoll());
  phenomenonAckBtn.addEventListener("click", () => continueThroughPhenomenon());
  historyBtn.addEventListener("click", () => (historyPanel.hidden = false));
  historyCloseBtn.addEventListener("click", () => (historyPanel.hidden = true));
  newPoolBtn.addEventListener("click", () => onEditPool());
  resetGameBtn.addEventListener("click", () => restartFromPool());

  function startNewGame(selectedIds) {
    deck = shuffle(selectedIds);
    current = null;
    store.setDeck(deck);
    store.setCurrent(null);
    store.setHistory([]);
    pendingPhenomenon = null;
    phenomenonBanner.hidden = true;
    renderHistory();
    drawUntilPlane({ initial: true });
  }

  function restartFromPool() {
    const pool = store.getPool();
    if (pool.length === 0) {
      toast("Your deck is empty — edit your deck first.");
      onEditPool();
      return;
    }
    startNewGame(pool);
    toast("Planar deck reshuffled.");
  }

  function planeswalk() {
    if (deck.length === 0 && !current) {
      toast("Your deck is empty — edit your deck first.");
      return;
    }
    if (current) {
      deck.push(current);
      current = null;
    }
    drawUntilPlane();
  }

  function drawUntilPlane({ initial = false } = {}) {
    if (deck.length === 0) {
      toast("The planar deck is empty.");
      renderDeckCount();
      updateControls();
      return;
    }
    const nextId = deck.shift();
    const card = cardsById.get(nextId);
    if (!card) {
      // Unknown id (e.g. removed from Scryfall) — skip it quietly.
      drawUntilPlane({ initial });
      return;
    }

    if (card.layout === "phenomenon") {
      pendingPhenomenon = card;
      phenomenonText.textContent = `${card.name} — ${card.oracleText}`;
      phenomenonBanner.hidden = false;
      logHistory(card, "phenomenon");
      store.setDeck(deck);
      renderDeckCount();
      preloadUpcomingPlanes();
      scrollStageIntoView();
      return;
    }

    current = card.id;
    store.setCurrent(current);
    store.setDeck(deck);
    logHistory(card, initial ? "start" : "planeswalk");
    renderActivePlane();
    renderDeckCount();
    updateControls();
    preloadUpcomingPlanes();
    scrollStageIntoView();
  }

  // On cramped landscape phones, resolving a Phenomenon banner can
  // scroll the page (bringing "Resolve & Continue" into view); snap
  // back so the newly-revealed plane and its controls are visible
  // together without the player having to scroll manually.
  function scrollStageIntoView() {
    document.querySelector(".game-stage")?.scrollIntoView({ block: "nearest" });
  }

  // Warms the browser's image cache for the next couple of Plane cards
  // (the big hero image) so planeswalking feels instant instead of
  // popping in while a fresh high-res image downloads.
  function preloadUpcomingPlanes(count = 2) {
    let found = 0;
    for (const id of deck) {
      const upcoming = cardsById.get(id);
      if (!upcoming || upcoming.layout !== "plane") continue;
      new Image().src = upcoming.image;
      found++;
      if (found >= count) break;
    }
  }

  function continueThroughPhenomenon() {
    if (!pendingPhenomenon) return;
    deck.push(pendingPhenomenon.id);
    pendingPhenomenon = null;
    phenomenonBanner.hidden = true;
    drawUntilPlane();
  }

  async function handleRoll() {
    rollDieBtn.disabled = true;
    dieResultEl.textContent = "";
    dieResultEl.className = "die-result";
    const result = await die.roll();
    if (!result) {
      rollDieBtn.disabled = false;
      return;
    }
    dieResultEl.textContent = OUTCOME_LABELS[result.outcome];
    dieResultEl.classList.add(result.outcome);
    toast(OUTCOME_LABELS[result.outcome]);
    rollDieBtn.disabled = false;

    if (result.outcome === "planeswalk") {
      setTimeout(() => planeswalk(), 550);
    }
  }

  function logHistory(card, trigger) {
    store.pushHistory({ id: card.id, name: card.name, at: Date.now(), trigger });
    renderHistory();
  }

  function renderActivePlane() {
    activePlaneEl.replaceChildren();
    activePlaneEl.classList.remove("is-entering");
    activePlaneEl.onclick = null;
    const card = current ? cardsById.get(current) : null;

    if (!card) {
      activePlaneEl.append(
        el("div", { class: "active-plane-empty" }, [
          el("p", {}, "No active plane yet."),
          el("p", { class: "muted" }, "Build a deck, then planeswalk to begin."),
        ])
      );
      return;
    }

    // Scryfall's card image is the whole printed card — name, art, type
    // line and rules text together — so it needs no redundant caption
    // bar. Just make the card itself (plus a small corner affordance)
    // open the full-size lightbox.
    const img = el("img", { src: card.image, alt: card.name });
    const zoomBtn = el(
      "button",
      {
        class: "icon-btn active-plane-zoom",
        "aria-label": `View ${card.name} full size`,
        onClick: (e) => {
          e.stopPropagation();
          openLightbox(card);
        },
      },
      "⤢"
    );
    activePlaneEl.append(img, zoomBtn);
    activePlaneEl.onclick = () => openLightbox(card);
    // restart the entrance animation
    void activePlaneEl.offsetWidth;
    activePlaneEl.classList.add("is-entering");
  }

  function renderDeckCount() {
    deckCountEl.textContent = deck.length;
  }

  function renderHistory() {
    const entries = store.getHistory();
    historyList.replaceChildren();
    if (entries.length === 0) {
      historyList.append(el("li", {}, "No planes visited yet."));
      return;
    }
    for (const entry of entries) {
      const card = cardsById.get(entry.id);
      historyList.append(
        el("li", {}, [
          card
            ? el("img", { src: card.imageSmall, alt: "" })
            : el("span", {}, "🌀"),
          el("span", {}, entry.name),
          el("span", { class: "time" }, formatTime(entry.at)),
        ])
      );
    }
  }

  function updateControls() {
    const hasDeck = deck.length > 0 || current;
    planeswalkBtn.disabled = !hasDeck;
    rollDieBtn.disabled = !current;
  }

  return { startNewGame };
}
