// Card data layer — fetches every official Planechase-legal card
// (Plane and Phenomenon layouts) from the Scryfall API and caches
// the normalized result in localStorage.
//
// Scryfall's search endpoint is paginated (`has_more` / `next_page`);
// we walk every page until exhausted. Scryfall explicitly allows
// client-side/browser use of this API (CORS enabled) — see
// https://scryfall.com/docs/api for the fair-use request policy.

// Scryfall gives both Plane and Phenomenon cards the single layout
// value "planar" (the same way Archenemy schemes all share "scheme").
// We tell them apart by type_line instead: Phenomenon cards have no
// subtype ("Phenomenon"), Planes always have one ("Plane — Dominaria").
const searchUrl = (unique) =>
  "https://api.scryfall.com/cards/search?" +
  new URLSearchParams({ q: "layout:planar -is:digital", unique, order: "name" }).toString();

// One entry per card (its id is what saved decks/games refer to)...
const CARDS_URL = searchUrl("cards");
// ...plus every printing, used only to learn all the sets each card has
// appeared in. With unique=cards alone, a 2009 plane reprinted in
// Planechase Anthology only "belonged" to Anthology in the set filter.
const PRINTS_URL = searchUrl("prints");

// Scryfall asks API clients to leave 50–100ms between requests.
const REQUEST_GAP_MS = 100;

const CACHE_KEY = "planechase.cardCache.v4";
// Older caches (no per-card set list) are still good enough offline.
const LEGACY_CACHE_KEYS = ["planechase.cardCache.v3"];
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function normalizeCard(raw) {
  const face = raw.image_uris ? raw : raw.card_faces?.[0] ?? raw;
  const uris = face.image_uris ?? {};

  return {
    id: raw.id,
    name: raw.name,
    layout: raw.type_line?.startsWith("Phenomenon") ? "phenomenon" : "plane",
    typeLine: raw.type_line ?? "",
    oracleText: raw.oracle_text ?? face.oracle_text ?? "",
    set: raw.set,
    setName: raw.set_name,
    // Every set this card was printed in, oldest first; filled in from
    // the prints query in loadPlanechaseCards.
    sets: [{ code: raw.set, name: raw.set_name }],
    collectorNumber: raw.collector_number,
    releasedAt: raw.released_at,
    // Three sizes so tiny grid thumbnails don't pull full-resolution
    // images: small for grid/history, normal for the hero display,
    // large/png only when the player asks to zoom in.
    imageSmall: uris.small || uris.normal || uris.large || uris.png || "",
    image: uris.normal || uris.large || uris.png || uris.small || "",
    imageLarge: uris.large || uris.png || uris.normal || uris.small || "",
    scryfallUri: raw.scryfall_uri,
  };
}

async function fetchPage(url) {
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) {
    if (res.status === 404) return { data: [], has_more: false };
    throw new Error(`Scryfall request failed (${res.status})`);
  }
  return res.json();
}

const pause = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchAllPages(firstUrl) {
  const cards = [];
  let url = firstUrl;
  while (url) {
    const page = await fetchPage(url);
    cards.push(...page.data);
    url = page.has_more ? page.next_page : null;
    if (url) await pause(REQUEST_GAP_MS);
  }
  return cards;
}

// Map of oracle_id -> [{ code, name }] across every printing.
function setsByOracleId(prints) {
  const byOracle = new Map();
  const sorted = [...prints].sort((a, b) => (a.released_at || "").localeCompare(b.released_at || ""));
  for (const p of sorted) {
    if (!p.oracle_id) continue;
    const list = byOracle.get(p.oracle_id) ?? [];
    if (!list.some((s) => s.code === p.set)) list.push({ code: p.set, name: p.set_name });
    byOracle.set(p.oracle_id, list);
  }
  return byOracle;
}

function readCache({ allowStale = false, key = CACHE_KEY } = {}) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const expired = !parsed.fetchedAt || Date.now() - parsed.fetchedAt > CACHE_TTL_MS;
    if (expired && !allowStale) return null;
    if (!Array.isArray(parsed.cards) || parsed.cards.length === 0) return null;
    return parsed.cards;
  } catch {
    return null;
  }
}

function writeCache(cards) {
  try {
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ fetchedAt: Date.now(), cards })
    );
    LEGACY_CACHE_KEYS.forEach((key) => localStorage.removeItem(key));
  } catch {
    // Storage full/unavailable — fine, we just skip caching.
  }
}

/** Every set a card appeared in (custom cards may only have set/setName). */
export function cardSets(card) {
  return card.sets?.length ? card.sets : [{ code: card.set, name: card.setName }];
}

/**
 * Extension point: return extra card-like objects (homebrew planes,
 * proxies, cards from products Scryfall hasn't indexed yet) to merge
 * into the pool. Empty by default — see README "Extending" section.
 */
export function getCustomCards() {
  return [];
}

/**
 * Loads every Planechase-format card, using a 7-day localStorage
 * cache to avoid re-fetching on every visit. Pass { force: true }
 * to bypass the cache. If Scryfall can't be reached, falls back to an
 * expired cache (calling onStale) rather than failing outright.
 */
export async function loadPlanechaseCards({ force = false, onStale } = {}) {
  if (!force) {
    const cached = readCache();
    if (cached) return [...cached, ...getCustomCards()];
  }

  let raw, prints;
  try {
    raw = await fetchAllPages(CARDS_URL);
    await pause(REQUEST_GAP_MS);
    prints = await fetchAllPages(PRINTS_URL);
  } catch (err) {
    const stale = [CACHE_KEY, ...LEGACY_CACHE_KEYS]
      .map((key) => readCache({ allowStale: true, key }))
      .find(Boolean);
    if (!stale) throw err;
    onStale?.(err);
    return [...stale, ...getCustomCards()];
  }
  const sets = setsByOracleId(prints);
  const normalized = raw.map((r) => {
    const card = normalizeCard(r);
    const all = sets.get(r.oracle_id);
    if (all?.length) card.sets = all;
    return card;
  });
  writeCache(normalized);
  return [...normalized, ...getCustomCards()];
}
