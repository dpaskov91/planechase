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
const SEARCH_URL =
  "https://api.scryfall.com/cards/search?" +
  new URLSearchParams({
    q: "layout:planar -is:digital",
    unique: "cards",
    order: "name",
  }).toString();

const CACHE_KEY = "planechase.cardCache.v3";
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

async function fetchAllPages() {
  const cards = [];
  let url = SEARCH_URL;
  while (url) {
    const page = await fetchPage(url);
    cards.push(...page.data);
    url = page.has_more ? page.next_page : null;
  }
  return cards;
}

function readCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed.fetchedAt || Date.now() - parsed.fetchedAt > CACHE_TTL_MS) return null;
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
  } catch {
    // Storage full/unavailable — fine, we just skip caching.
  }
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
 * to bypass the cache.
 */
export async function loadPlanechaseCards({ force = false } = {}) {
  if (!force) {
    const cached = readCache();
    if (cached) return [...cached, ...getCustomCards()];
  }

  const raw = await fetchAllPages();
  const normalized = raw.map(normalizeCard);
  writeCache(normalized);
  return [...normalized, ...getCustomCards()];
}
