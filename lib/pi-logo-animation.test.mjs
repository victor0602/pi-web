import assert from "node:assert/strict";
import test from "node:test";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url, { tsconfigPaths: true });
const {
  LOGO_ANIMATION_MS,
  LOGO_CELL_PX,
  LOGO_COLS,
  LOGO_COLORS,
  LOGO_ROWS,
  LOGO_SPLASH_STORAGE_KEY,
  REDUCED_MOTION_HOLD_MS,
  cellColor,
  compositeLogo,
  frameGrid,
  logoSplashStep,
  readLogoSplashPlayed,
  reduceLogoSplash,
  sampleLogo,
  writeLogoSplashPlayed,
} = await jiti.import("./pi-logo-animation.ts");

const COLOR = {
  ".": "panel",
  C: "coral",
  B: "blue",
  G: "gold",
  T: "turquoise",
  W: "white",
  F: "flash",
};

/** Nine rows, eight columns, shell x = 1..8. */
function grid(rows) {
  assert.equal(rows.length, LOGO_ROWS);
  return rows.map((row) => {
    assert.equal([...row].length, LOGO_COLS);
    return [...row].map((char) => {
      const color = COLOR[char];
      assert.ok(color, char);
      return color;
    });
  });
}

function paint(frame) {
  return frameGrid(frame);
}

test("installer colors and the 8 by 9 cell size", () => {
  assert.equal(LOGO_ROWS, 9);
  assert.equal(LOGO_COLS, 8);
  assert.ok(LOGO_CELL_PX >= 28 && LOGO_CELL_PX <= 32);
  assert.equal(LOGO_COLORS.coral, "#f09082");
  assert.equal(LOGO_COLORS.blue, "#4d9abf");
  assert.equal(LOGO_COLORS.gold, "#f1be58");
  assert.equal(LOGO_COLORS.turquoise, "#83ccd2");
  assert.equal(LOGO_COLORS.flash, "#ffffff");
  assert.equal(LOGO_COLORS.white, "#ffffff");
});

test("the blue T, coral J and turquoise bar match the installer's first frames", () => {
  const falling = grid([
    ".B......",
    ".BB.....",
    ".B......",
    "........",
    "........",
    "........",
    "TTTT....",
    "........",
    "........",
  ]);
  assert.deepEqual(paint({ phase: 0, active: "left", ax: 2, ay: 0, flash: 0, white: 0 }), falling);
  // Landed T. The stem cell is not blue until this piece arrives (phase is still 0).
  assert.equal(cellColor({ phase: 0, active: "left", ax: 2, ay: 0, flash: 0, white: 0 }, 3, 2), "panel");
  assert.deepEqual(paint({ phase: 0, active: "left", ax: 2, ay: 3, flash: 0, white: 0 }), grid([
    "........",
    "........",
    "........",
    ".B......",
    ".BB.....",
    ".B......",
    "TTTT....",
    "........",
    "........",
  ]));

  assert.deepEqual(paint({ phase: 1, active: "top", ax: 2, ay: 0, flash: 0, white: 0 }), grid([
    ".CCC....",
    "...C....",
    "........",
    ".B......",
    ".BB.....",
    ".B......",
    "TTTT....",
    "........",
    "........",
  ]));
  assert.deepEqual(paint({ phase: 1, active: "top", ax: 2, ay: 2, flash: 0, white: 0 }), grid([
    "........",
    "........",
    ".CCC....",
    ".B.C....",
    ".BB.....",
    ".B......",
    "TTTT....",
    "........",
    "........",
  ]));
});

test("the gold L lands, the bar flashes, then the logo compacts and pulses white", () => {
  assert.deepEqual(paint({ phase: 2, active: "right", ax: 5, ay: 0, flash: 0, white: 0 }), grid([
    "....G...",
    "....G...",
    ".CCCGG..",
    ".B.C....",
    ".BB.....",
    ".B......",
    "TTTT....",
    "........",
    "........",
  ]));
  const settled = grid([
    "........",
    "........",
    ".CCC....",
    ".B.C....",
    ".BB.G...",
    ".B..G...",
    "TTTTGG..",
    "........",
    "........",
  ]);
  assert.deepEqual(paint({ phase: 2, active: "right", ax: 5, ay: 4, flash: 0, white: 0 }), settled);
  assert.deepEqual(paint({ phase: 3, active: "none", ax: 0, ay: 0, flash: 0, white: 0 }), settled);
  assert.deepEqual(paint({ phase: 3, active: "none", ax: 0, ay: 0, flash: 1, white: 0 }), grid([
    "........",
    "........",
    ".CCC....",
    ".B.C....",
    ".BB.G...",
    ".B..G...",
    "FFFFFF..",
    "........",
    "........",
  ]));
  assert.deepEqual(paint({ phase: 4, active: "none", ax: 0, ay: 0, flash: 0, white: 0 }), grid([
    "........",
    "........",
    ".CCC....",
    ".B.C....",
    ".BB.G...",
    ".B..G...",
    "........",
    "........",
    "........",
  ]));
  const compact = grid([
    "........",
    "........",
    "........",
    ".CCC....",
    ".B.C....",
    ".BB.G...",
    ".B..G...",
    "........",
    "........",
  ]);
  assert.deepEqual(paint({ phase: 5, active: "none", ax: 0, ay: 0, flash: 0, white: 0 }), compact);
  assert.deepEqual(paint({ phase: 5, active: "none", ax: 0, ay: 0, flash: 0, white: 1 }), grid([
    "........",
    "........",
    "........",
    ".WWW....",
    ".W.W....",
    ".WW.W...",
    ".W..W...",
    "........",
    "........",
  ]));
  // White replaces the whole mark; a leftover bar or the uncompacted row stays off.
  assert.equal(cellColor({ phase: 5, active: "none", ax: 0, ay: 0, flash: 0, white: 1 }, 2, 2), "panel");
  assert.equal(cellColor({ phase: 5, active: "none", ax: 0, ay: 0, flash: 0, white: 1 }, 6, 1), "panel");
});

test("each installer frame is the sample at that frame's start, and the drop lerps between them", () => {
  // Sleeps from pi_logo_animation: 75ms per drop row, then the settle/flash/pulse holds.
  const frames = [
    [0, { phase: 0, active: "left", ax: 2, ay: 0, flash: 0, white: 0 }],
    [75, { phase: 0, active: "left", ax: 2, ay: 1, flash: 0, white: 0 }],
    [150, { phase: 0, active: "left", ax: 2, ay: 2, flash: 0, white: 0 }],
    [225, { phase: 0, active: "left", ax: 2, ay: 3, flash: 0, white: 0 }],
    [300, { phase: 1, active: "top", ax: 2, ay: 0, flash: 0, white: 0 }],
    [375, { phase: 1, active: "top", ax: 2, ay: 1, flash: 0, white: 0 }],
    [450, { phase: 1, active: "top", ax: 2, ay: 2, flash: 0, white: 0 }],
    [525, { phase: 2, active: "right", ax: 5, ay: 0, flash: 0, white: 0 }],
    [600, { phase: 2, active: "right", ax: 5, ay: 1, flash: 0, white: 0 }],
    [675, { phase: 2, active: "right", ax: 5, ay: 2, flash: 0, white: 0 }],
    [750, { phase: 2, active: "right", ax: 5, ay: 3, flash: 0, white: 0 }],
    [825, { phase: 2, active: "right", ax: 5, ay: 4, flash: 0, white: 0 }],
    [900, { phase: 3, active: "none", ax: 0, ay: 0, flash: 0, white: 0 }],
    [1150, { phase: 3, active: "none", ax: 0, ay: 0, flash: 1, white: 0 }],
    [1230, { phase: 3, active: "none", ax: 0, ay: 0, flash: 0, white: 0 }],
    [1310, { phase: 3, active: "none", ax: 0, ay: 0, flash: 1, white: 0 }],
    [1390, { phase: 4, active: "none", ax: 0, ay: 0, flash: 0, white: 0 }],
    [1490, { phase: 5, active: "none", ax: 0, ay: 0, flash: 0, white: 0 }],
    [1940, { phase: 5, active: "none", ax: 0, ay: 0, flash: 0, white: 1 }],
    [2060, { phase: 5, active: "none", ax: 0, ay: 0, flash: 0, white: 0 }],
    [2180, { phase: 5, active: "none", ax: 0, ay: 0, flash: 0, white: 1 }],
  ];
  for (const [time, frame] of frames) {
    assert.deepEqual(compositeLogo(sampleLogo(time)), frameGrid(frame), `t=${time}`);
  }

  const start = sampleLogo(0);
  const mid = sampleLogo(37.5);
  const next = sampleLogo(75);
  assert.equal(start.piece?.color, "blue");
  assert.equal(start.piece?.y, 0);
  assert.equal(mid.piece?.color, "blue");
  assert.equal(mid.piece?.y, 0.5);
  assert.equal(mid.key, start.key);
  assert.equal(next.piece?.y, 1);
  assert.notEqual(next.key, start.key);
  // The last drop row is held, then the next piece starts at the top.
  assert.equal(sampleLogo(299).piece?.y, 3);
  assert.equal(sampleLogo(299).piece?.color, "blue");
  assert.equal(sampleLogo(300).piece?.color, "coral");
  assert.equal(sampleLogo(300).piece?.y, 0);
  assert.equal(sampleLogo(525).piece?.color, "gold");

  assert.equal(LOGO_ANIMATION_MS, 2630);
  assert.equal(sampleLogo(LOGO_ANIMATION_MS - 1).done, false);
  assert.deepEqual(compositeLogo(sampleLogo(LOGO_ANIMATION_MS - 1)), frameGrid(frames.at(-1)[1]));
  assert.equal(sampleLogo(LOGO_ANIMATION_MS).done, true);
  assert.equal(sampleLogo(-10).piece?.y, 0);
});

test("reduced motion holds the compact colored logo, then finishes", () => {
  assert.equal(REDUCED_MOTION_HOLD_MS, 800);
  const still = logoSplashStep(0, true);
  assert.equal(still.done, false);
  assert.equal(still.piece, null);
  assert.deepEqual(still.cells, frameGrid({ phase: 5, active: "none", ax: 0, ay: 0, flash: 0, white: 0 }));
  assert.equal(logoSplashStep(REDUCED_MOTION_HOLD_MS - 1, true).done, false);
  assert.equal(logoSplashStep(REDUCED_MOTION_HOLD_MS, true).done, true);
  assert.equal(logoSplashStep(REDUCED_MOTION_HOLD_MS, false).done, false);
});

test("the splash plays once for a blank session and stays off after that", () => {
  const fresh = { claimed: false, visible: false };
  const first = reduceLogoSplash(fresh, { blank: true, alreadyPlayed: false });
  assert.deepEqual(first, { state: { claimed: true, visible: true }, persistPlayed: true });
  // Strict Mode runs the effect again; the claim already made keeps it up.
  const replay = reduceLogoSplash(first.state, { blank: true, alreadyPlayed: true });
  assert.deepEqual(replay, { state: first.state, persistPlayed: false });
  assert.equal(replay.state.visible, true);

  const history = reduceLogoSplash(fresh, { blank: false, alreadyPlayed: false });
  assert.deepEqual(history, { state: { claimed: false, visible: false }, persistPlayed: false });
  const later = reduceLogoSplash(history.state, { blank: true, alreadyPlayed: false });
  assert.equal(later.state.visible, true);

  const played = reduceLogoSplash(fresh, { blank: true, alreadyPlayed: true });
  assert.deepEqual(played.state, { claimed: true, visible: false });
  assert.equal(played.persistPlayed, false);
  const again = reduceLogoSplash(played.state, { blank: true, alreadyPlayed: true });
  assert.equal(again.state.visible, false);

  const hidden = reduceLogoSplash(first.state, { blank: false, alreadyPlayed: true });
  assert.equal(hidden.state.visible, false);
  assert.equal(hidden.state.claimed, true);
});

test("sessionStorage remembers the splash for this browser session only", () => {
  const saved = new Map();
  const storage = {
    getItem: (key) => saved.get(key) ?? null,
    setItem: (key, value) => saved.set(key, value),
  };
  assert.equal(LOGO_SPLASH_STORAGE_KEY, "pi-web:logo-splash-played");
  assert.equal(readLogoSplashPlayed(storage), false);
  assert.equal(readLogoSplashPlayed(null), false);
  writeLogoSplashPlayed(storage);
  assert.equal(saved.get(LOGO_SPLASH_STORAGE_KEY), "1");
  assert.equal(readLogoSplashPlayed(storage), true);
  writeLogoSplashPlayed(null);

  const throwing = {
    getItem() {
      throw new Error("denied");
    },
    setItem() {
      throw new Error("denied");
    },
  };
  assert.equal(readLogoSplashPlayed(throwing), false);
  assert.doesNotThrow(() => writeLogoSplashPlayed(throwing));
});
