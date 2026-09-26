import { el, debounce, toast, shuffle } from "./util.js?v=__CACHE_BUST__";
import { store } from "./state.js?v=__CACHE_BUST__";
import { openLightbox } from "./lightbox.js?v=__CACHE_BUST__";
import { cardSets } from "./scryfall.js?v=__CACHE_BUST__";

const grid = document.getElementById("card-grid");
const searchInput = document.getElementById("search-input");
const setFilter = document.getElementById("set-filter");
const selectionCountEl = document.getElementById("selection-count");
const startGameBtn = document.getElementById("start-game-btn");
const startGameCountEl = document.getElementById("start-game-count");
const deckWarningEl = document.getElementById("deck-warning");

// Official per-player planar deck limits (the app itself allows any
// deck with at least one Plane; these only drive a soft warning).
const OFFICIAL_MIN_CARDS = 10;
const OFFICIAL_MAX_PHENOMENA = 2;

// A magnifying glass (not the expand arrows used on the big card), so it
// reads as "look closer" and can't be mistaken for the ringed selection
// circle in the opposite corner.
const MAGNIFIER_SVG =
  '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
  '<circle cx="10.5" cy="10.5" r="6" stroke="currentColor" stroke-width="2.4"/>' +
  '<path d="M15 15 L20 20" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>' +
  "</svg>";

export function initPicker(allCards, { onStartGame }) {
  const selected = new Set(
    store.getPool().filter((id) => allCards.some((c) => c.id === id))
  );
  let typeFilter = "all";
  let searchTerm = "";
  let setValue = "all";

  populateSetFilter(allCards);
  render();
  updateSummary();

  document.querySelectorAll("[data-type-filter]").forEach((btn) => {
    btn.addEventListener("click", () => {
      document
        .querySelectorAll("[data-type-filter]")
        .forEach((b) => b.classList.toggle("is-active", b === btn));
      typeFilter = btn.dataset.typeFilter;
      render();
    });
  });

  searchInput.addEventListener(
    "input",
    debounce((e) => {
      searchTerm = e.target.value.trim().toLowerCase();
      render();
    }, 180)
  );

  setFilter.addEventListener("change", (e) => {
    setValue = e.target.value;
    render();
  });

  document.getElementById("select-all-btn").addEventListener("click", () => {
    // Replace, not merge — otherwise a filtered "Select All" would be a
    // no-op after selecting everything once with no filter applied.
    selected.clear();
    visibleCards().forEach((c) => selected.add(c.id));
    persistAndRefresh();
  });

  document.getElementById("select-none-btn").addEventListener("click", () => {
    selected.clear();
    persistAndRefresh();
  });

  document.getElementById("select-random-btn").addEventListener("click", () => {
    const pool = visibleCards();
    selected.clear();
    const picks = shuffle(pool).slice(0, 10);
    picks.forEach((c) => selected.add(c.id));
    persistAndRefresh();
    if (pool.length < 10) {
      toast(`Only ${pool.length} cards matched the current filters.`);
    }
  });

  startGameBtn.addEventListener("click", () => {
    if (!hasPlane()) return;
    onStartGame([...selected]);
  });

  function visibleCards() {
    return allCards.filter((c) => {
      if (typeFilter !== "all" && c.layout !== typeFilter) return false;
      // A card counts as "in" every set it was ever printed in, not
      // just the one printing we show.
      if (setValue !== "all" && !cardSets(c).some((s) => s.code === setValue)) return false;
      if (searchTerm) {
        const haystack = `${c.name} ${c.oracleText}`.toLowerCase();
        if (!haystack.includes(searchTerm)) return false;
      }
      return true;
    });
  }

  function persistAndRefresh() {
    store.setPool([...selected]);
    render();
    updateSummary();
  }

  // A deck of only Phenomena can never land on a plane, so the game
  // would loop through "Resolve & Continue" forever.
  function hasPlane() {
    return allCards.some((c) => c.layout === "plane" && selected.has(c.id));
  }

  function updateSummary() {
    selectionCountEl.textContent = selected.size;
    const needsPlane = selected.size > 0 && !hasPlane();
    startGameCountEl.textContent = needsPlane
      ? "(add at least one Plane)"
      : `(${selected.size} card${selected.size === 1 ? "" : "s"})`;
    startGameBtn.disabled = selected.size === 0 || needsPlane;
    updateDeckWarning();
  }

  function updateDeckWarning() {
    const phenomena = allCards.filter((c) => c.layout === "phenomenon" && selected.has(c.id)).length;
    const issues = [];
    if (selected.size > 0 && selected.size < OFFICIAL_MIN_CARDS) {
      issues.push(`at least ${OFFICIAL_MIN_CARDS} cards (you have ${selected.size})`);
    }
    if (phenomena > OFFICIAL_MAX_PHENOMENA) {
      issues.push(`no more than ${OFFICIAL_MAX_PHENOMENA} Phenomena (you have ${phenomena})`);
    }
    deckWarningEl.hidden = issues.length === 0;
    deckWarningEl.textContent = issues.length
      ? `Outside the official deck limits: ${issues.join(" and ")}. Fine for casual play.`
      : "";
  }

  function render() {
    const cards = visibleCards();
    grid.replaceChildren();

    if (cards.length === 0) {
      grid.append(
        el("p", { class: "muted" }, "No cards match your filters.")
      );
      return;
    }

    const frag = document.createDocumentFragment();
    for (const card of cards) {
      frag.append(renderTile(card));
    }
    grid.append(frag);
  }

  function renderTile(card) {
    const check = el("div", { class: "card-tile-check" });
    const tile = el(
      "div",
      {
        class: "card-tile",
        role: "checkbox",
        tabindex: "0",
        "aria-label": `${card.name} (${card.layout === "phenomenon" ? "Phenomenon" : "Plane"})`,
      },
      [
        el("img", { src: card.imageSmall, alt: "", loading: "lazy" }),
        check,
        el("div", { class: "card-tile-label" }, [
          card.name,
          el(
            "span",
            { class: "kind" },
            card.layout === "phenomenon" ? "Phenomenon" : "Plane"
          ),
        ]),
      ]
    );
    tile.checkEl = check;

    // Updates just this tile in place — rebuilding all ~200 tiles on
    // every tap was needless work.
    const toggle = () => {
      if (selected.has(card.id)) selected.delete(card.id);
      else selected.add(card.id);
      store.setPool([...selected]);
      syncTile(tile, card);
      updateSummary();
    };

    tile.addEventListener("click", toggle);
    tile.addEventListener("keydown", (e) => {
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        toggle();
      } else if (e.key === "i" || e.key === "I") {
        openLightbox(card);
      }
    });
    // Kept as shortcuts; the magnifier button is the discoverable way.
    tile.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      openLightbox(card);
    });

    // A sibling of the tile (not inside its role="checkbox"), so it's
    // its own button for screen readers and never toggles selection.
    const zoomBtn = el("button", {
      class: "icon-btn card-tile-zoom-btn",
      type: "button",
      "aria-label": `View ${card.name} full size`,
      title: "View full size",
      onClick: () => openLightbox(card),
    });
    zoomBtn.innerHTML = MAGNIFIER_SVG;

    syncTile(tile, card);
    return el("div", { class: "card-tile-wrap" }, [tile, zoomBtn]);
  }

  function syncTile(tile, card) {
    const isSelected = selected.has(card.id);
    tile.classList.toggle("is-selected", isSelected);
    tile.setAttribute("aria-checked", String(isSelected));
    tile.checkEl.textContent = isSelected ? "✓" : "";
  }

  function populateSetFilter(cards) {
    const sets = new Map();
    for (const c of cards) for (const s of cardSets(c)) sets.set(s.code, s.name);
    const sorted = [...sets.entries()].sort((a, b) => a[1].localeCompare(b[1]));
    for (const [code, name] of sorted) {
      setFilter.append(el("option", { value: code }, name));
    }
  }
}
