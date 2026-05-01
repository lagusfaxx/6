/* eslint-disable */
/**
 * Tests del invariante "todo iframe que apunta a chaturbate usa /in/?room=…".
 *
 * Cómo correrlos (Node ≥22.6 — el repo usa Node 22 en CI y dev):
 *   cd apps/web && node --experimental-strip-types --test \
 *     lib/chaturbate/transform.test.mjs
 *
 * El archivo importa la lógica TS real desde transform.ts — no hay copia.
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  toEmbeddableUrl,
  withTrack,
  trackParamFor,
} from "./transform.ts";

const TRACK_SOURCES = [
  "live_grid",
  "home_row",
  "perfil_reco",
  "sidebar_reco",
  "live_cam_page",
];

const PUBLIC_PAGE_URLS = [
  "https://chaturbate.com/sofic_b/?campaign=Ifv4A&disable_sound=0&join_overlay=1&room=sofic_b&tour=LQps",
  "https://chaturbate.com/bonnettbonett/?campaign=Ifv4A&disable_sound=0&join_overlay=1&room=bonnettbonett&tour=LQps",
  "https://chaturbate.com/anais_as/",
  "https://chaturbate.com/UPPERCASE_USER/?tour=LQps",
];

const ALREADY_EMBEDDABLE = [
  "https://chaturbate.com/in/?tour=LQps&campaign=Ifv4A&room=anais_as",
  "https://chaturbate.com/in/",
  "https://chaturbate.com/embed/?room=foo",
];

test("toEmbeddableUrl rewrites /<username>/ → /in/", () => {
  for (const raw of PUBLIC_PAGE_URLS) {
    const out = toEmbeddableUrl(raw, "fallback");
    const u = new URL(out);
    assert.equal(u.pathname, "/in/", `expected /in/ for ${raw}, got ${u.pathname}`);
    assert.ok(u.searchParams.has("room"), `room param missing for ${raw}`);
  }
});

test("toEmbeddableUrl preserves all query params from the original URL", () => {
  const raw =
    "https://chaturbate.com/sofic_b/?campaign=Ifv4A&disable_sound=0&join_overlay=1&room=sofic_b&tour=LQps";
  const out = new URL(toEmbeddableUrl(raw, "sofic_b"));
  assert.equal(out.searchParams.get("campaign"), "Ifv4A");
  assert.equal(out.searchParams.get("disable_sound"), "0");
  assert.equal(out.searchParams.get("join_overlay"), "1");
  assert.equal(out.searchParams.get("room"), "sofic_b");
  assert.equal(out.searchParams.get("tour"), "LQps");
});

test("toEmbeddableUrl leaves /in/ and /embed/ paths untouched", () => {
  for (const raw of ALREADY_EMBEDDABLE) {
    const out = toEmbeddableUrl(raw, "fallback");
    const u = new URL(out);
    assert.match(u.pathname, /^\/(in|embed)\/?$/i, `unexpected rewrite for ${raw}`);
  }
});

test("toEmbeddableUrl falls back to provided username when room param missing", () => {
  // El fallback solo se usa si pathname está vacío y room no viene; la página
  // pública del modelo trae el username en el path o en el param `room`.
  const raw = "https://chaturbate.com/maria24/";
  const out = new URL(toEmbeddableUrl(raw, "maria24"));
  assert.equal(out.searchParams.get("room"), "maria24");
});

test("withTrack always produces /in/ regardless of input format", () => {
  const inputs = [...PUBLIC_PAGE_URLS, ...ALREADY_EMBEDDABLE];
  for (const source of TRACK_SOURCES) {
    for (const raw of inputs) {
      const final = withTrack(raw, source);
      assert.ok(final, `withTrack returned null for ${source} on ${raw}`);
      const u = new URL(final);
      assert.match(
        u.pathname,
        /^\/(in|embed)\/?$/i,
        `track=${source} produced non-embeddable path ${u.pathname} for ${raw}`,
      );
      assert.equal(
        u.searchParams.get("track"),
        trackParamFor(source),
        `track param wrong for source ${source}`,
      );
    }
  }
});

test("withTrack never emits chaturbate.com/<username>/ for any track source", () => {
  const inputs = [...PUBLIC_PAGE_URLS, ...ALREADY_EMBEDDABLE];
  for (const source of TRACK_SOURCES) {
    for (const raw of inputs) {
      const final = withTrack(raw, source);
      assert.ok(final);
      assert.doesNotMatch(
        new URL(final).pathname,
        /^\/(?!in\/?$)(?!embed\/?$)[^/]+\/?$/,
        `iframe URL ${final} still uses public page path`,
      );
    }
  }
});

test("withTrack returns null on empty input", () => {
  assert.equal(withTrack("", "live_grid"), null);
});
