# Planechase

A browser-based companion for playing Magic: The Gathering's **Planechase**
variant. Build a planar deck from every official Plane and Phenomenon card,
shuffle it, planeswalk through the multiverse, and roll an animated planar
die — all in a static page hosted on GitHub Pages.

**Live site:** https://dpaskov91.github.io/planechase/

## Features

- **Full card pool** — every Plane and Phenomenon card is loaded live from
  the [Scryfall API](https://scryfall.com/docs/api), so the pool stays
  correct as new sets release. Results are cached in `localStorage` for a
  week to keep repeat visits fast.
- **Deck builder** — search, filter by set or card type, and pick exactly
  which planes are in play. Selections persist between visits.
- **Game board** — shuffles your planar deck, tracks the face-down deck and
  face-up active plane, handles Phenomenon resolution (auto-continues to
  the next Plane per the real rules), and keeps a visit history.
- **Animated planar die** — a real 3D CSS cube, correctly weighted (1 Chaos
  face, 2 Planeswalk faces, 3 blank faces) just like the physical die.
- **No backend, no build step** — plain HTML/CSS/JS modules. Deploys as-is.

## Local development

No build tooling required — it's static files. Serve the repo root with
any static file server and open it in a browser, for example:

```sh
python3 -m http.server 8000
# then open http://localhost:8000
```

(A plain `file://` open won't work because ES module imports require
`http(s)://`.)

## Project structure

```
index.html          Markup for both views (deck builder + game board)
css/styles.css       Design system + all styling
js/
  scryfall.js        Fetches & caches Plane/Phenomenon cards from Scryfall
  state.js            localStorage-backed app state (pool, deck, history)
  picker.js           Deck builder UI
  game.js              Shuffle, planeswalk, phenomenon handling, history
  die.js                Planar die weighting + 3D roll animation
  lightbox.js          Shared full-card viewer
  util.js               Small shared helpers (shuffle, dom, toast)
  main.js                Bootstraps everything, wires up view switching
.github/workflows/deploy.yml   Deploys to GitHub Pages on push to main
```

## Extending

- **Homebrew/extra cards** — add objects to the array returned by
  `getCustomCards()` in `js/scryfall.js`. They're merged into the pool
  alongside Scryfall's data using the same shape:
  `{ id, name, layout, typeLine, oracleText, set, setName, imageSmall, image, imageLarge }`.
- **New views** — the app is a simple two-view tab switcher in `main.js`
  (`showView`). Add a new `<section class="view">`, a tab button, and a
  view key to extend it (e.g. an Archenemy scheme deck, since Scryfall
  indexes `layout:scheme` the same way).
- **Game rules tweaks** — all planeswalk/phenomenon logic lives in
  `js/game.js` behind small, named functions (`planeswalk`,
  `drawUntilPlane`, `continueThroughPhenomenon`).

## One-time setup after pushing

In the repo's **Settings → Pages**, set **Source** to **GitHub Actions**.
The included workflow (`.github/workflows/deploy.yml`) then deploys
automatically on every push to `main`.

## Attribution

This is an unofficial, non-commercial fan project made under Wizards of
the Coast's [Fan Content Policy](https://company.wizards.com/en/legal/fancontentpolicy).
Card data and images are served live from [Scryfall](https://scryfall.com).
Portions of the materials used are property of Wizards of the Coast. ©Wizards
of the Coast LLC.
