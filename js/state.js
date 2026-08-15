// Centralized, localStorage-backed app state.
// Keeping persistence in one small module makes it easy to extend
// later (e.g. add a "multiple saved decks" feature) without hunting
// through UI code for scattered localStorage calls.

const KEYS = {
  pool: "planechase.pool.v1", // ids of cards selected in the deck builder
  deck: "planechase.deck.v1", // ordered ids: [0] is on top of the face-down deck
  current: "planechase.current.v1", // id of the active plane, or null
  history: "planechase.history.v1", // [{ id, name, at, trigger }]
};

function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw == null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function writeJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore quota/availability errors — app still works, just won't persist
  }
}

export const store = {
  getPool: () => readJSON(KEYS.pool, []),
  setPool: (ids) => writeJSON(KEYS.pool, ids),

  getDeck: () => readJSON(KEYS.deck, []),
  setDeck: (ids) => writeJSON(KEYS.deck, ids),

  getCurrent: () => readJSON(KEYS.current, null),
  setCurrent: (id) => writeJSON(KEYS.current, id),

  getHistory: () => readJSON(KEYS.history, []),
  setHistory: (entries) => writeJSON(KEYS.history, entries),
  pushHistory: (entry) => {
    const next = [entry, ...readJSON(KEYS.history, [])].slice(0, 200);
    writeJSON(KEYS.history, next);
    return next;
  },

  resetGame: () => {
    writeJSON(KEYS.deck, []);
    writeJSON(KEYS.current, null);
    writeJSON(KEYS.history, []);
  },
};
