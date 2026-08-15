import { el, debounce, toast } from "./util.js";
import { store } from "./state.js";
import { openLightbox } from "./lightbox.js";

const grid = document.getElementById("card-grid");
const searchInput = document.getElementById("search-input");
const setFilter = document.getElementById("set-filter");
const selectionCountEl = document.getElementById("selection-count");
const startGameBtn = document.getElementById("start-game-btn");
const startGameCountEl = document.getElementById("start-game-count");

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
    const picks = [...pool].sort(() => Math.random() - 0.5).slice(0, 10);
    picks.forEach((c) => selected.add(c.id));
    persistAndRefresh();
    if (pool.length < 10) {
      toast(`Only ${pool.length} cards matched the current filters.`);
    }
  });

  startGameBtn.addEventListener("click", () => {
    if (selected.size === 0) return;
    onStartGame([...selected]);
  });

  function visibleCards() {
    return allCards.filter((c) => {
      if (typeFilter !== "all" && c.layout !== typeFilter) return false;
      if (setValue !== "all" && c.set !== setValue) return false;
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

  function updateSummary() {
    selectionCountEl.textContent = selected.size;
    startGameCountEl.textContent = `(${selected.size} card${selected.size === 1 ? "" : "s"})`;
    startGameBtn.disabled = selected.size === 0;
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
    const isSelected = selected.has(card.id);
    const tile = el(
      "div",
      {
        class: `card-tile${isSelected ? " is-selected" : ""}`,
        role: "checkbox",
        "aria-checked": String(isSelected),
        tabindex: "0",
      },
      [
        el("img", { src: card.imageSmall, alt: card.name, loading: "lazy" }),
        el("div", { class: "card-tile-check" }, isSelected ? "✓" : ""),
        el("div", { class: "card-tile-zoom" }, "Tap to view"),
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

    const toggle = () => {
      if (selected.has(card.id)) selected.delete(card.id);
      else selected.add(card.id);
      persistAndRefresh();
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
    tile.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      openLightbox(card);
    });

    return tile;
  }

  function populateSetFilter(cards) {
    const sets = new Map();
    for (const c of cards) sets.set(c.set, c.setName);
    const sorted = [...sets.entries()].sort((a, b) => a[1].localeCompare(b[1]));
    for (const [code, name] of sorted) {
      setFilter.append(el("option", { value: code }, name));
    }
  }
}
