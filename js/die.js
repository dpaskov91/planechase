// Planar die: a real Planechase die has six faces — one Chaos symbol,
// two Planeswalk symbols, and three blank faces. This module rolls a
// correctly weighted result and drives a 3D CSS-cube animation that
// physically lands on the matching face.

const FACE_ROTATIONS = {
  front: { x: 0, y: 0 },
  back: { x: 0, y: 180 },
  right: { x: 0, y: -90 },
  left: { x: 0, y: 90 },
  top: { x: -90, y: 0 },
  bottom: { x: 90, y: 0 },
};

const FACE_OUTCOME = {
  front: "blank",
  back: "blank",
  top: "blank",
  right: "planeswalk",
  left: "planeswalk",
  bottom: "chaos",
};

const OUTCOME_WEIGHTS = [
  ["chaos", 1],
  ["planeswalk", 2],
  ["blank", 3],
];

const INITIAL_ROTATION = { x: -24, y: 35 };

function weightedOutcome() {
  const total = OUTCOME_WEIGHTS.reduce((sum, [, w]) => sum + w, 0);
  let r = Math.random() * total;
  for (const [outcome, w] of OUTCOME_WEIGHTS) {
    if (r < w) return outcome;
    r -= w;
  }
  return "blank";
}

function faceForOutcome(outcome) {
  const faces = Object.keys(FACE_OUTCOME).filter((f) => FACE_OUTCOME[f] === outcome);
  return faces[Math.floor(Math.random() * faces.length)];
}

function norm360(deg) {
  return ((deg % 360) + 360) % 360;
}

function nextAngle(prev, baseDeg, minTurns = 2, maxTurns = 4) {
  const diff = norm360(norm360(baseDeg) - norm360(prev)) || 0;
  const turns = minTurns + Math.floor(Math.random() * (maxTurns - minTurns + 1));
  return prev + diff + 360 * turns;
}

export function createPlanarDie(cubeEl) {
  let rotation = { ...INITIAL_ROTATION };
  let rolling = false;

  function roll() {
    if (rolling) return Promise.resolve(null);
    rolling = true;

    const outcome = weightedOutcome();
    const face = faceForOutcome(outcome);
    const base = FACE_ROTATIONS[face];

    rotation = {
      x: nextAngle(rotation.x, base.x),
      y: nextAngle(rotation.y, base.y),
    };

    cubeEl.style.transform = `rotateX(${rotation.x}deg) rotateY(${rotation.y}deg)`;

    return new Promise((resolve) => {
      const onEnd = (e) => {
        if (e.target !== cubeEl || e.propertyName !== "transform") return;
        cubeEl.removeEventListener("transitionend", onEnd);
        rolling = false;
        resolve({ outcome, face });
      };
      cubeEl.addEventListener("transitionend", onEnd);
    });
  }

  return { roll };
}

export const OUTCOME_LABELS = {
  chaos: "Chaos! Trigger this plane's chaos ability.",
  planeswalk: "Planeswalk! Move to a new plane.",
  blank: "Nothing happens.",
};
