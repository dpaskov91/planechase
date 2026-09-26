import { el, shuffle, toast, formatTime } from "./util.js?v=__CACHE_BUST__";
import { store } from "./state.js?v=__CACHE_BUST__";
import { openLightbox } from "./lightbox.js?v=__CACHE_BUST__";
import { createPlanarDie, OUTCOME_LABELS } from "./die.js?v=__CACHE_BUST__";

const activePlaneEl = document.getElementById("active-plane");
const deckCountEl = document.getElementById("deck-count");
const planeswalkBtn = document.getElementById("planeswalk-btn");
const rollDieBtn = document.getElementById("roll-die-btn");
const dieResultEl = document.getElementById("die-result");
const rollCostEl = document.getElementById("roll-cost");
const newTurnBtn = document.getElementById("new-turn-btn");
const phenomenonAckBtn = document.getElementById("phenomenon-ack-btn");
const backBtn = document.getElementById("back-btn");
const historyBtn = document.getElementById("history-btn");
const historyPanel = document.getElementById("history-panel");
const historyCloseBtn = document.getElementById("history-close-btn");
const historyList = document.getElementById("history-list");
const newPoolBtn = document.getElementById("new-pool-btn");
const resetGameBtn = document.getElementById("reset-game-btn");

// Delay between a Planeswalk roll landing and actually moving, so the
// player sees the result on the die before the card changes.
const ROLL_PLANESWALK_DELAY_MS = 550;

export function initGame(cardsById, { onEditPool }) {
  let deck = store.getDeck();
  let current = store.getCurrent();
  // Persisted, not just in memory — otherwise reloading while a
  // Phenomenon is showing lost that card and duplicated the plane
  // that had already been moved to the bottom of the deck.
  let pendingPhenomenon = cardsById.get(store.getPending()) || null;
  if (pendingPhenomenon) current = null;
  // Repair saves made before the Phenomenon was persisted: the active
  // plane may also be sitting at the bottom of the deck.
  if (current && deck.includes(current)) {
    deck = deck.filter((id) => id !== current);
    store.setDeck(deck);
  }
  let rollsThisTurn = store.getRolls();
  // One snapshot per planeswalk (manual or die-rolled), taken before
  // the deck/current change — however many phenomena get resolved
  // along the way to the next plane, it's still a single logical step
  // to undo. Session-only: a page reload starts a game with no undo.
  let undoStack = [];
  // True from the moment a roll starts until any planeswalk it causes
  // has happened — blocks every other deck-changing action meanwhile.
  let busy = false;
  // Bumped per game, so a delayed roll-planeswalk from a game that has
  // since been restarted doesn't fire into the new one.
  let gameToken = 0;
  const die = createPlanarDie(document.getElementById("die-cube"));

  phenomenonAckBtn.hidden = !pendingPhenomenon;
  renderActivePlane();
  renderDeckCount();
  renderHistory();
  renderRollCost();
  updateControls();
  preloadUpcomingPlanes();

  planeswalkBtn.addEventListener("click", () => planeswalk());
  rollDieBtn.addEventListener("click", () => handleRoll());
  phenomenonAckBtn.addEventListener("click", () => continueThroughPhenomenon());
  backBtn.addEventListener("click", () => stepBack());
  newTurnBtn.addEventListener("click", () => setRolls(0));
  historyBtn.addEventListener("click", () => (historyPanel.hidden = false));
  historyCloseBtn.addEventListener("click", () => (historyPanel.hidden = true));
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !historyPanel.hidden) historyPanel.hidden = true;
  });
  document.addEventListener("click", (e) => {
    if (historyPanel.hidden) return;
    if (historyPanel.contains(e.target) || historyBtn.contains(e.target)) return;
    historyPanel.hidden = true;
  });
  newPoolBtn.addEventListener("click", () => onEditPool());
  resetGameBtn.addEventListener("click", () => restartFromPool());

  function startNewGame(selectedIds) {
    if (!selectedIds.some((id) => cardsById.get(id)?.layout === "plane")) {
      toast("Your deck needs at least one Plane.");
      onEditPool();
      return;
    }
    gameToken++;
    deck = shuffle(selectedIds);
    current = null;
    store.setDeck(deck);
    store.setCurrent(null);
    store.setHistory([]);
    setPending(null);
    undoStack = [];
    clearDieResult();
    setRolls(0);
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

  function planeswalk({ fromRoll = false } = {}) {
    if (deck.length === 0 && !current) {
      toast("Your deck is empty — edit your deck first.");
      return;
    }
    // A roll-triggered planeswalk keeps its "Planeswalk!" text, since
    // it still describes what just happened; a manual one clears it.
    if (!fromRoll) clearDieResult();
    undoStack.push({ deck: deck.slice(), current, history: store.getHistory() });
    if (current) {
      deck.push(current);
      current = null;
    }
    drawUntilPlane();
  }

  // Undoes the most recent planeswalk (manual or die-rolled), including
  // any phenomena that were resolved along the way to the plane you're
  // currently on — restoring the deck, active plane and history log to
  // exactly how they looked right before that step.
  function stepBack() {
    if (undoStack.length === 0 || busy) return;
    const snap = undoStack.pop();
    deck = snap.deck;
    current = snap.current;
    setPending(null);
    clearDieResult();
    store.setDeck(deck);
    store.setCurrent(current);
    store.setHistory(snap.history);
    renderActivePlane();
    renderDeckCount();
    renderHistory();
    updateControls();
    preloadUpcomingPlanes();
    scrollStageIntoView();
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
      setPending(card);
      logHistory(card, "phenomenon");
      store.setCurrent(null);
      store.setDeck(deck);
      renderActivePlane();
      renderDeckCount();
      updateControls();
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

  function setPending(card) {
    pendingPhenomenon = card;
    store.setPending(card ? card.id : null);
    phenomenonAckBtn.hidden = !card;
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
    // Resolved Phenomena go to the bottom of the planar deck.
    deck.push(pendingPhenomenon.id);
    setPending(null);
    drawUntilPlane();
  }

  async function handleRoll() {
    if (busy || !current) return;
    busy = true;
    const token = gameToken;
    updateControls();
    clearDieResult();
    const result = await die.roll();
    if (!result || token !== gameToken) {
      busy = false;
      updateControls();
      return;
    }
    setRolls(rollsThisTurn + 1);
    dieResultEl.textContent = OUTCOME_LABELS[result.outcome];
    dieResultEl.classList.add(result.outcome);

    if (result.outcome !== "planeswalk") {
      busy = false;
      updateControls();
      return;
    }
    setTimeout(() => {
      busy = false;
      if (token === gameToken) planeswalk({ fromRoll: true });
      updateControls();
    }, ROLL_PLANESWALK_DELAY_MS);
  }

  function clearDieResult() {
    dieResultEl.textContent = "";
    dieResultEl.className = "die-result";
  }

  // Paper rule: the active player may roll as often as they like on
  // their turn — the first roll is free, each further roll that turn
  // costs {1} more than the last. The app can't see turns, so the
  // player taps "New turn" to reset the count.
  function setRolls(n) {
    rollsThisTurn = n;
    store.setRolls(n);
    renderRollCost();
  }

  function renderRollCost() {
    rollCostEl.replaceChildren(
      "Next roll: ",
      rollsThisTurn === 0
        ? el("strong", {}, "free")
        : el("span", { class: "mana", title: `${rollsThisTurn} generic mana` }, String(rollsThisTurn))
    );
    newTurnBtn.disabled = rollsThisTurn === 0;
  }

  function logHistory(card, trigger) {
    store.pushHistory({ id: card.id, name: card.name, at: Date.now(), trigger });
    renderHistory();
  }

  function renderActivePlane() {
    activePlaneEl.replaceChildren();
    activePlaneEl.classList.remove("is-entering", "is-phenomenon");
    activePlaneEl.onclick = null;

    // A pending Phenomenon takes over the display until it's resolved —
    // the player needs to actually see the card, not just a placeholder,
    // while the plane it interrupted stays hidden underneath.
    const card = pendingPhenomenon || (current ? cardsById.get(current) : null);

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
    // open the full-size lightbox. The image lives in its own clipped
    // wrapper so the rounded corner doesn't cut into the zoom button.
    const img = el("img", { src: card.image, alt: card.name });
    const media = el("div", { class: "active-plane-media" }, [img]);
    const zoomBtn = el("button", {
      class: "icon-btn active-plane-zoom",
      "aria-label": `View ${card.name} full size`,
      onClick: (e) => {
        e.stopPropagation();
        openLightbox(card);
      },
    });
    // A hand-drawn, point-symmetric SVG instead of the "⤢" glyph —
    // Unicode arrow characters aren't reliably optically centered
    // within their own cell, and that varies by platform/font.
    zoomBtn.innerHTML =
      '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
      '<path d="M9 15 L16 8 M11 8 L16 8 L16 13" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<path d="M15 9 L8 16 M13 16 L8 16 L8 11" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>' +
      "</svg>";
    activePlaneEl.append(media, zoomBtn);
    activePlaneEl.onclick = () => openLightbox(card);
    activePlaneEl.classList.toggle("is-phenomenon", card === pendingPhenomenon);
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
    // Rule: rolling the planar die or manually planeswalking away is
    // only legal while an actual Plane is active — not while a
    // Phenomenon is sitting unresolved as the just-turned-up card.
    // Also locked while a roll (and any planeswalk it causes) plays out.
    const blocked = !!pendingPhenomenon || busy;
    planeswalkBtn.disabled = !hasDeck || blocked;
    rollDieBtn.disabled = !current || blocked;
    backBtn.disabled = undoStack.length === 0 || busy;
  }

  return { startNewGame };
}
