"use client";

import { useEffect, useLayoutEffect, useRef, useState, type Ref } from "react";
import { useI18n } from "@/hooks/useI18n";
import {
  LOGO_CELL_PX,
  LOGO_COLORS,
  REDUCED_MOTION_HOLD_MS,
  logoSplashStep,
  type LogoSample,
} from "@/lib/pi-logo-animation";

/**
 * The installer's Tetris Pi logo, played over a blank composer.
 * Click, Enter, Space or Escape finishes it. `prefers-reduced-motion`
 * holds the compact colored logo instead of dropping the pieces.
 */
export function PiLogoSplash({ onDone, reducedMotion }: {
  onDone: () => void;
  /** Test seam. Omitted, the splash reads `prefers-reduced-motion` itself. */
  reducedMotion?: boolean;
}) {
  const { t } = useI18n();
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  const buttonRef = useRef<HTMLButtonElement>(null);
  const pieceRef = useRef<HTMLDivElement>(null);
  const pieceYRef = useRef(0);
  const stopRef = useRef<(() => void) | null>(null);
  const [sample, setSample] = useState<LogoSample>(() => logoSplashStep(0, false));
  const sampleKeyRef = useRef(sample.key);

  useLayoutEffect(() => {
    const reduced = reducedMotion ?? window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
    if (reduced) setSample(logoSplashStep(0, true));
  }, [reducedMotion]);

  useLayoutEffect(() => {
    const node = pieceRef.current;
    if (!node || !sample.piece) return;
    node.style.transform = `translate3d(0, ${pieceYRef.current * LOGO_CELL_PX}px, 0)`;
  });

  useEffect(() => {
    const reduced = reducedMotion ?? window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
    let stopped = false;
    let raf = 0;
    const finish = () => {
      if (stopped) return;
      stopped = true;
      cancelAnimationFrame(raf);
      onDoneRef.current();
    };
    stopRef.current = finish;

    if (reduced) {
      pieceYRef.current = 0;
      setSample(logoSplashStep(0, true));
      const timer = window.setTimeout(finish, REDUCED_MOTION_HOLD_MS);
      return () => {
        stopped = true;
        window.clearTimeout(timer);
        stopRef.current = null;
      };
    }

    const start = performance.now();
    let key = sampleKeyRef.current;
    const tick = (now: number) => {
      if (stopped) return;
      const next = logoSplashStep(now - start, false);
      if (next.piece) pieceYRef.current = next.piece.y;
      const node = pieceRef.current;
      if (node && next.piece) node.style.transform = `translate3d(0, ${next.piece.y * LOGO_CELL_PX}px, 0)`;
      if (next.key !== key) {
        key = next.key;
        setSample(next);
      }
      if (next.done) {
        finish();
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      stopRef.current = null;
    };
  }, [reducedMotion]);

  useEffect(() => {
    const focusSplash = () => buttonRef.current?.focus({ preventScroll: true });
    focusSplash();
    // After the fresh composer's own focus, so keystrokes don't land under the overlay.
    const raf = requestAnimationFrame(focusSplash);
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape" && event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      event.stopPropagation();
      stopRef.current?.();
    };
    window.addEventListener("keydown", onKey, true);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKey, true);
    };
  }, []);

  return (
    <button
      ref={buttonRef}
      type="button"
      className="pi-logo-splash"
      onClick={() => {
        if (stopRef.current) stopRef.current();
        else onDoneRef.current();
      }}
    >
      <PiLogoMark sample={sample} pieceRef={pieceRef} />
      <span className="pi-logo-splash-hint">{t("chat.logoSplashSkip")}</span>
    </button>
  );
}

/** The 8×9 mark for one sample. The falling piece is a layer so its y can move every frame. */
export function PiLogoMark({ sample, pieceRef }: {
  sample: LogoSample;
  pieceRef?: Ref<HTMLDivElement>;
}) {
  const piece = sample.piece;
  return (
    <div className="pi-logo-stage" aria-hidden="true">
      {sample.cells.flatMap((row, y) => row.map((color, x) => {
        if (color === "panel") return null;
        return (
          <span
            key={`${y}-${x}`}
            className="pi-logo-cell"
            style={{ top: y * LOGO_CELL_PX, left: x * LOGO_CELL_PX, background: LOGO_COLORS[color] }}
          />
        );
      }))}
      {piece && (
        <div ref={pieceRef} className="pi-logo-piece">
          {piece.cells.map(([dy, dx]) => (
            <span
              key={`${dy}-${dx}`}
              className="pi-logo-cell"
              style={{
                top: dy * LOGO_CELL_PX,
                left: (piece.x + dx - 1) * LOGO_CELL_PX,
                background: LOGO_COLORS[piece.color],
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
