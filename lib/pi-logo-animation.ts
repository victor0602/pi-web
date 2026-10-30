/**
 * The Pi installer's logo animation (pi.dev/install.sh, `pi_logo_animation` /
 * `draw_logo_frame` / `set_logo_cell_color`), as data a 60fps splash can sample.
 *
 * The shell draws an 8×9 grid (columns 1..8, rows 0..8) and sleeps between
 * discrete frames. Drop rows are 75ms apart; this module keeps that phase
 * order and those durations, and lerps the falling piece's y across each
 * step so the splash can paint every frame instead of jumping.
 */

export const LOGO_ROWS = 9;
export const LOGO_COLS = 8;
/** Square cells, larger than the installer's terminal glyphs. */
export const LOGO_CELL_PX = 30;

export const LOGO_COLORS = {
  coral: "#f09082",
  blue: "#4d9abf",
  gold: "#f1be58",
  turquoise: "#83ccd2",
  white: "#ffffff",
  flash: "#ffffff",
} as const;

export type LogoColorName = "panel" | keyof typeof LOGO_COLORS;
export type LogoActive = "none" | "left" | "top" | "right";

export interface LogoFrame {
  phase: number;
  active: LogoActive;
  /** Shell column of a falling piece's origin (columns are 1..8). */
  ax: number;
  /** Shell row of a falling piece's origin. Integer for `cellColor`. */
  ay: number;
  flash: 0 | 1;
  white: 0 | 1;
}

type Cell = readonly [number, number];

/** Blue T, on its side: the left piece. */
const LEFT_PIECE: readonly Cell[] = [[0, 0], [1, 0], [1, 1], [2, 0]];
/** Coral J: the top piece. */
const TOP_PIECE: readonly Cell[] = [[0, 0], [0, 1], [0, 2], [1, 2]];
/** Gold L: the right piece. */
const RIGHT_PIECE: readonly Cell[] = [[0, 0], [1, 0], [2, 0], [2, 1]];

const CORAL_OPEN: readonly Cell[] = [[2, 2], [2, 3], [2, 4], [3, 4]];
const BLUE_OPEN: readonly Cell[] = [[3, 2], [4, 2], [4, 3], [5, 2]];
const GOLD_OPEN: readonly Cell[] = [[4, 5], [5, 5], [6, 5], [6, 6]];
const GOLD_COMPACTING: readonly Cell[] = [[4, 5], [5, 5]];
const CORAL_COMPACT: readonly Cell[] = [[3, 2], [3, 3], [3, 4], [4, 4]];
const BLUE_COMPACT: readonly Cell[] = [[4, 2], [5, 2], [5, 3], [6, 2]];
const GOLD_COMPACT: readonly Cell[] = [[5, 5], [6, 5]];
const BAR: readonly Cell[] = [[6, 1], [6, 2], [6, 3], [6, 4]];
const WHITE_MARK: readonly Cell[] = [[3, 2], [3, 3], [3, 4], [4, 2], [4, 4], [5, 2], [5, 3], [5, 5], [6, 2], [6, 5]];

const PIECES = {
  left: { color: "blue" as const, cells: LEFT_PIECE },
  top: { color: "coral" as const, cells: TOP_PIECE },
  right: { color: "gold" as const, cells: RIGHT_PIECE },
};

function inCells(y: number, x: number, cells: readonly Cell[]): boolean {
  for (const [cy, cx] of cells) {
    if (cy === y && cx === x) return true;
  }
  return false;
}

function inPiece(y: number, x: number, py: number, px: number, cells: readonly Cell[]): boolean {
  for (const [dy, dx] of cells) {
    if (y === py + dy && x === px + dx) return true;
  }
  return false;
}

/** `set_logo_cell_color`. `x` is the shell column, 1..8. */
export function cellColor(frame: LogoFrame, y: number, x: number): LogoColorName {
  const { phase, active, ax, ay, flash, white } = frame;
  if (white === 1) return inCells(y, x, WHITE_MARK) ? "white" : "panel";
  if (flash === 1 && y === 6 && x >= 1 && x <= 6) return "flash";

  if (active === "left" && inPiece(y, x, ay, ax, LEFT_PIECE)) return "blue";
  if (active === "top" && inPiece(y, x, ay, ax, TOP_PIECE)) return "coral";
  if (active === "right" && inPiece(y, x, ay, ax, RIGHT_PIECE)) return "gold";

  if (phase === 4) {
    if (inCells(y, x, CORAL_OPEN)) return "coral";
    if (inCells(y, x, BLUE_OPEN)) return "blue";
    if (inCells(y, x, GOLD_COMPACTING)) return "gold";
    return "panel";
  }

  if (phase >= 5) {
    if (inCells(y, x, CORAL_COMPACT)) return "coral";
    if (inCells(y, x, BLUE_COMPACT)) return "blue";
    if (inCells(y, x, GOLD_COMPACT)) return "gold";
    return "panel";
  }

  if (phase <= 3 && inCells(y, x, BAR)) return "turquoise";
  if (phase >= 2 && inCells(y, x, CORAL_OPEN)) return "coral";
  if (phase >= 1 && inCells(y, x, BLUE_OPEN)) return "blue";
  if (phase >= 3 && inCells(y, x, GOLD_OPEN)) return "gold";
  return "panel";
}

/** One installer frame: row 0 first, shell column 1 in column 0. */
export function frameGrid(frame: LogoFrame): LogoColorName[][] {
  const rows: LogoColorName[][] = [];
  for (let y = 0; y < LOGO_ROWS; y++) {
    const row: LogoColorName[] = [];
    for (let x = 1; x <= LOGO_COLS; x++) row.push(cellColor(frame, y, x));
    rows.push(row);
  }
  return rows;
}

export interface LogoPiece {
  color: "blue" | "coral" | "gold";
  /** Shell column of the piece origin. */
  x: number;
  /** Row of the piece origin. Fractional while a drop is between two steps. */
  y: number;
  cells: readonly Cell[];
}

export interface LogoSample {
  /** Changes when the settled cells or the piece shape change, not while y lerps. */
  key: string;
  /** Settled cells and flashes. The falling piece is `piece`, so y can move without repainting these. */
  cells: LogoColorName[][];
  piece: LogoPiece | null;
  done: boolean;
}

const STEP_MS = 75;

interface DropSegment {
  kind: "drop";
  phase: 0 | 1 | 2;
  active: "left" | "top" | "right";
  ax: number;
  fromY: number;
  toY: number;
  duration: number;
}

interface HoldSegment {
  kind: "hold";
  phase: number;
  flash: 0 | 1;
  white: 0 | 1;
  duration: number;
}

type Segment = DropSegment | HoldSegment;

/** One shell `sleep` per row: travel to the next row, then hold the landing row. */
function dropSegments(phase: 0 | 1 | 2, active: DropSegment["active"], ax: number, rows: readonly number[]): Segment[] {
  const segments: Segment[] = [];
  for (let i = 0; i < rows.length - 1; i++) {
    segments.push({ kind: "drop", phase, active, ax, fromY: rows[i], toY: rows[i + 1], duration: STEP_MS });
  }
  const landed = rows[rows.length - 1];
  segments.push({ kind: "drop", phase, active, ax, fromY: landed, toY: landed, duration: STEP_MS });
  return segments;
}

const SEGMENTS: readonly Segment[] = [
  ...dropSegments(0, "left", 2, [0, 1, 2, 3]),
  ...dropSegments(1, "top", 2, [0, 1, 2]),
  ...dropSegments(2, "right", 5, [0, 1, 2, 3, 4]),
  { kind: "hold", phase: 3, flash: 0, white: 0, duration: 250 },
  { kind: "hold", phase: 3, flash: 1, white: 0, duration: 80 },
  { kind: "hold", phase: 3, flash: 0, white: 0, duration: 80 },
  { kind: "hold", phase: 3, flash: 1, white: 0, duration: 80 },
  { kind: "hold", phase: 4, flash: 0, white: 0, duration: 100 },
  { kind: "hold", phase: 5, flash: 0, white: 0, duration: 450 },
  { kind: "hold", phase: 5, flash: 0, white: 1, duration: 120 },
  { kind: "hold", phase: 5, flash: 0, white: 0, duration: 120 },
  { kind: "hold", phase: 5, flash: 0, white: 1, duration: 450 },
];

export const LOGO_ANIMATION_MS = SEGMENTS.reduce((sum, segment) => sum + segment.duration, 0);

const SETTLED: LogoFrame = { phase: 0, active: "none", ax: 0, ay: 0, flash: 0, white: 0 };

function segmentAt(timeMs: number): { index: number; segment: Segment; local: number; done: boolean } {
  const time = timeMs < 0 ? 0 : timeMs;
  let cursor = 0;
  for (let index = 0; index < SEGMENTS.length; index++) {
    const segment = SEGMENTS[index];
    if (time < cursor + segment.duration) {
      return { index, segment, local: time - cursor, done: false };
    }
    cursor += segment.duration;
  }
  const index = SEGMENTS.length - 1;
  return { index, segment: SEGMENTS[index], local: SEGMENTS[index].duration, done: true };
}

/** The splash's picture at `timeMs` from the start. Done at `LOGO_ANIMATION_MS`. */
export function sampleLogo(timeMs: number): LogoSample {
  const { index, segment, local, done } = segmentAt(timeMs);
  if (segment.kind === "drop") {
    const progress = local / segment.duration;
    const y = segment.fromY + (segment.toY - segment.fromY) * progress;
    const shape = PIECES[segment.active];
    return {
      key: String(index),
      cells: frameGrid({ ...SETTLED, phase: segment.phase }),
      piece: { color: shape.color, x: segment.ax, y, cells: shape.cells },
      done,
    };
  }
  return {
    key: String(index),
    cells: frameGrid({ ...SETTLED, phase: segment.phase, flash: segment.flash, white: segment.white }),
    piece: null,
    done,
  };
}

/**
 * Settled cells plus the falling piece, when it sits on whole cells.
 * A fractional y is left to the splash's transform; snapping it here would
 * hide the lerp the tests check on `piece.y`.
 */
export function compositeLogo(sample: LogoSample): LogoColorName[][] {
  const cells = sample.cells.map((row) => row.slice());
  const piece = sample.piece;
  if (!piece || !Number.isInteger(piece.y)) return cells;
  for (const [dy, dx] of piece.cells) {
    const y = piece.y + dy;
    const x = piece.x + dx;
    if (y >= 0 && y < LOGO_ROWS && x >= 1 && x <= LOGO_COLS) cells[y][x - 1] = piece.color;
  }
  return cells;
}

/** How long the compact colored logo stays when motion is reduced. */
export const REDUCED_MOTION_HOLD_MS = 800;

const FINAL_FRAME: LogoFrame = { phase: 5, active: "none", ax: 0, ay: 0, flash: 0, white: 0 };

/** `sampleLogo`, or the compact logo held still when the user prefers reduced motion. */
export function logoSplashStep(timeMs: number, reducedMotion: boolean): LogoSample {
  if (!reducedMotion) return sampleLogo(timeMs);
  return {
    key: "final",
    cells: frameGrid(FINAL_FRAME),
    piece: null,
    done: timeMs >= REDUCED_MOTION_HOLD_MS,
  };
}

export const LOGO_SPLASH_STORAGE_KEY = "pi-web:logo-splash-played";

export interface LogoSplashGate {
  /** This page has already decided, so a second effect run does not hide a splash it just showed. */
  claimed: boolean;
  visible: boolean;
}

/**
 * Show the splash only for a blank session that has not played it yet.
 * A session with history (`blank: false`) never claims the page, so the
 * first blank composer afterwards still can. Once claimed, a repeat of the
 * same effect (React Strict Mode) leaves a visible splash visible.
 */
export function reduceLogoSplash(
  state: LogoSplashGate,
  event: { blank: boolean; alreadyPlayed: boolean },
): { state: LogoSplashGate; persistPlayed: boolean } {
  if (!event.blank) return { state: { claimed: state.claimed, visible: false }, persistPlayed: false };
  if (state.claimed) return { state, persistPlayed: false };
  if (event.alreadyPlayed) return { state: { claimed: true, visible: false }, persistPlayed: false };
  return { state: { claimed: true, visible: true }, persistPlayed: true };
}

export function readLogoSplashPlayed(storage: { getItem(key: string): string | null } | null): boolean {
  if (!storage) return false;
  try {
    return storage.getItem(LOGO_SPLASH_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function writeLogoSplashPlayed(storage: { setItem(key: string, value: string): void } | null): void {
  if (!storage) return;
  try {
    storage.setItem(LOGO_SPLASH_STORAGE_KEY, "1");
  } catch {
    // Private mode, or storage blocked: the in-memory claim still covers this page.
  }
}
