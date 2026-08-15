import { loadPlanechaseCards } from "./scryfall.js";
import { store } from "./state.js";
import { initPicker } from "./picker.js";
import { initGame } from "./game.js";
import { toast } from "./util.js";

const tabButtons = document.querySelectorAll(".tab-btn");
const views = {
  picker: document.getElementById("view-picker"),
  game: document.getElementById("view-game"),
};
const statusBanner = document.getElementById("picker-status");
const startGameBtn = document.getElementById("start-game-btn");

function showView(name) {
  for (const [key, section] of Object.entries(views)) {
    section.classList.toggle("is-active", key === name);
  }
  for (const btn of tabButtons) {
    btn.classList.toggle("is-active", btn.dataset.view === name);
  }
  location.hash = name;
}

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

async function bootstrap() {
  setStatus("Loading Planechase cards from Scryfall…", true);
  startGameBtn.disabled = true;

  let cards;
  try {
    cards = await loadPlanechaseCards();
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
    onStartGame: (selectedIds) => {
      game.startNewGame(selectedIds);
      showView("game");
    },
  });

  const game = initGame(cardsById, {
    onEditPool: () => showView("picker"),
  });

  // Resume an in-progress game, if any.
  const initialView =
    location.hash === "#game" || store.getDeck().length > 0 || store.getCurrent()
      ? "game"
      : "picker";
  showView(initialView);

  toast(`Loaded ${cards.length} planes & phenomena.`);
}

bootstrap();
