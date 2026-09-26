import { loadPlanechaseCards } from "./scryfall.js?v=__CACHE_BUST__";
import { store } from "./state.js?v=__CACHE_BUST__";
import { initPicker } from "./picker.js?v=__CACHE_BUST__";
import { initGame } from "./game.js?v=__CACHE_BUST__";
import { toast } from "./util.js?v=__CACHE_BUST__";
import { initRules } from "./rules.js?v=__CACHE_BUST__";
import { confirmDialog } from "./confirm.js?v=__CACHE_BUST__";
import { setWakeLock } from "./wakelock.js?v=__CACHE_BUST__";

const tabButtons = document.querySelectorAll(".tab-btn");
const views = {
  picker: document.getElementById("view-picker"),
  game: document.getElementById("view-game"),
};
const statusBanner = document.getElementById("picker-status");
const startGameBtn = document.getElementById("start-game-btn");

// Views are driven by the URL hash so the phone's Back button moves
// between tabs instead of changing the address with nothing else
// happening (and then leaving the site on the next press).
function viewFromHash() {
  const name = location.hash.slice(1);
  return name in views ? name : null;
}

function renderView(name) {
  for (const [key, section] of Object.entries(views)) {
    section.classList.toggle("is-active", key === name);
  }
  for (const btn of tabButtons) {
    btn.classList.toggle("is-active", btn.dataset.view === name);
  }
  // Keep the phone awake while playing, not while browsing cards.
  setWakeLock(name === "game");
  window.scrollTo(0, 0);
}

// Tab clicks and in-app navigation add a history entry (so Back can
// undo them); the initial view replaces the current one instead.
function showView(name, { replace = false } = {}) {
  if (viewFromHash() === name) {
    renderView(name);
    return;
  }
  if (replace) {
    history.replaceState(null, "", `#${name}`);
    renderView(name);
  } else {
    location.hash = name; // renders via the hashchange listener
  }
}

window.addEventListener("hashchange", () => {
  renderView(viewFromHash() ?? "picker");
});

for (const btn of tabButtons) {
  btn.addEventListener("click", () => showView(btn.dataset.view));
}

function setStatus(message, isLoading = false) {
  if (!message) {
    statusBanner.hidden = true;
    return;
  }
  statusBanner.hidden = false;
  statusBanner.textContent = message;
  statusBanner.classList.toggle("is-loading", isLoading);
}

initRules();

// Offline support + "Add to Home Screen" as a full-screen app. The
// worker is network-first, so an online visit always gets the latest
// deploy; the cache only answers when the network can't.
if ("serviceWorker" in navigator && window.isSecureContext) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}

async function bootstrap() {
  setStatus("Loading Planechase cards from Scryfall…", true);
  startGameBtn.disabled = true;

  let cards;
  try {
    cards = await loadPlanechaseCards({
      onStale: () => toast("Couldn't reach Scryfall — using your saved card data."),
    });
  } catch (err) {
    console.error(err);
    setStatus(
      "Couldn't reach Scryfall to load card data. Check your connection and reload the page.",
      false
    );
    return;
  }

  if (cards.length === 0) {
    setStatus("Scryfall returned no Planechase cards — something's off upstream.", false);
    return;
  }

  setStatus(null);

  const cardsById = new Map(cards.map((c) => [c.id, c]));

  initPicker(cards, {
    onStartGame: async (selectedIds) => {
      if (game.hasProgress() && !(await confirmDialog(
        "Start a new game with this deck? The game in progress will end.",
        { confirmLabel: "Start new game" }
      ))) return;
      if (game.startNewGame(selectedIds)) showView("game");
    },
  });

  const game = initGame(cardsById, {
    onEditPool: () => showView("picker"),
  });

  // Resume an in-progress game, if any.
  const initialView =
    viewFromHash() ??
    (store.getDeck().length > 0 || store.getCurrent() || store.getPending() ? "game" : "picker");
  showView(initialView, { replace: true });
}

bootstrap();
