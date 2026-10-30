import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url, { jsx: { runtime: "automatic" }, tsconfigPaths: true });
const React = await jiti.import("react");
const { renderToStaticMarkup } = await jiti.import("react-dom/server");
const { I18nProvider } = await jiti.import("@/hooks/useI18n");
const { PiLogoMark, PiLogoSplash } = await jiti.import("./PiLogoSplash.tsx");
const { LOGO_CELL_PX, frameGrid, logoSplashStep } = await jiti.import("@/lib/pi-logo-animation.ts");
const { getLocalePlugin } = await jiti.import("@/lib/i18n/registry.ts");

const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
const chat = await readFile(new URL("./ChatWindow.tsx", import.meta.url), "utf8");

function rule(selector) {
  const start = css.indexOf(`${selector} {`);
  assert.notEqual(start, -1, `${selector} not found`);
  return css.slice(css.indexOf("{", start) + 1, css.indexOf("}", start));
}

test("the mark is the installer's blocks: 30px squares, the opening frame's colors", () => {
  assert.equal(LOGO_CELL_PX, 30);
  const cell = rule(".pi-logo-cell");
  assert.match(cell, /width:\s*30px/);
  assert.match(cell, /height:\s*30px/);
  assert.match(cell, /border-radius:\s*0/);
  const stage = rule(".pi-logo-stage");
  assert.match(stage, /width:\s*240px/);
  assert.match(stage, /height:\s*270px/);
  assert.match(rule(".pi-logo-splash"), /background:\s*var\(--bg\)/);

  const sample = logoSplashStep(0, false);
  const html = renderToStaticMarkup(React.createElement(PiLogoMark, { sample }));
  assert.match(html, /class="pi-logo-stage"/);
  assert.equal(html.match(/class="pi-logo-cell"/g).length, 8);
  assert.match(html, /#4d9abf/);
  assert.match(html, /#83ccd2/);
  assert.doesNotMatch(html, /border-radius/);

  const compact = frameGrid({ phase: 5, active: "none", ax: 0, ay: 0, flash: 0, white: 0 });
  const settled = renderToStaticMarkup(React.createElement(PiLogoMark, { sample: { key: "final", cells: compact, piece: null, done: false } }));
  assert.equal(settled.match(/class="pi-logo-cell"/g).length, 10);
  assert.match(settled, /#f09082/);
  assert.match(settled, /#f1be58/);
  assert.doesNotMatch(settled, /pi-logo-piece/);
});

test("the splash is a button whose name, in every language, says how to skip", () => {
  const html = renderToStaticMarkup(
    React.createElement(I18nProvider, null, React.createElement(PiLogoSplash, { onDone() {} })),
  );
  assert.match(html, /<button type="button" class="pi-logo-splash"/);
  assert.match(html, /Click or press Escape to skip/);
  assert.equal(getLocalePlugin("zh-CN").messages["chat.logoSplashSkip"], "点击或按 Esc 跳过");
  assert.equal(getLocalePlugin("zh-TW").messages["chat.logoSplashSkip"], "點擊或按 Esc 略過");
});

test("ChatWindow plays it only on the empty new-session composer", () => {
  assert.match(chat, /reduceLogoSplash\(logoSplashGateRef\.current, \{\s*blank: isEmptyNew,/);
  assert.match(chat, /logoSplashVisible && isEmptyNew && <PiLogoSplash/);
  assert.match(chat, /writeLogoSplashPlayed\(storage\)/);
});
