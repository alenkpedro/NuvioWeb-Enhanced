import assert from "node:assert/strict";
import { test } from "node:test";

Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  value: { getItem: () => null, setItem: () => {}, removeItem: () => {} }
});

const { Router, PlayerSettingsStore, DebridSettingsStore, I18n, addonRepository } =
  await import("../js/ui/screens/stream/streamScreen.js");
const { createStreamScreenMethods05 } =
  await import("../js/ui/screens/stream/streamScreenMethods-05-maybe-auto-resume-stream.js");
const { createStreamScreenMethods09 } =
  await import("../js/ui/screens/stream/streamScreenMethods-09-render.js");

test("source selection follows the saved mode and explicit manual selection", () => {
  const originals = {
    route: Router.getCurrent,
    player: PlayerSettingsStore.get,
    debrid: DebridSettingsStore.get,
    locale: I18n.getLocale,
    addons: addonRepository.getCachedInstalledAddons
  };
  try {
    Router.getCurrent = () => "stream";
    let mode = "MANUAL";
    PlayerSettingsStore.get = () => ({
      streamAutoPlayMode: mode,
      streamAutoPlaySource: "ALL_SOURCES",
      preferredAudioLanguage: "pt-br",
      streamReuseLastLinkEnabled: true
    });
    DebridSettingsStore.get = () => ({ streamPreferences: {} });
    I18n.getLocale = () => "pt-br";
    addonRepository.getCachedInstalledAddons = () => [];

    const played = [];
    const context = {
      params: {},
      streams: [
        { id: "english", name: "Movie.EN.2160p", url: "https://example.com/en" },
        { id: "pt-hd", name: "Movie.PT-BR.1080p", url: "https://example.com/pt-hd" },
        { id: "pt-4k", name: "Movie.PT-BR.2160p", url: "https://example.com/pt-4k" }
      ],
      autoPlaySelectionReady: true,
      getFilteredStreams() {
        return this.streams;
      },
      cancelAutoPlaySelectionWait() {},
      playStream(id) {
        played.push(id);
      }
    };
    const { maybeAutoPlayStream } = createStreamScreenMethods05();
    maybeAutoPlayStream.call(context);
    assert.deepEqual(played, []);

    mode = "FIRST_STREAM";
    maybeAutoPlayStream.call(context);
    assert.deepEqual(played, ["english"]);

    mode = "BEST_STREAM";
    context.autoPlayAttempted = false;
    context.autoSourceSearchUiActive = true;
    maybeAutoPlayStream.call(context);
    assert.deepEqual(played, ["english", "pt-4k"]);
    assert.equal(context.autoSourceSearchUiActive, true);

    context.params = { manualSelection: true };
    context.autoPlayAttempted = false;
    maybeAutoPlayStream.call(context);
    assert.deepEqual(played, ["english", "pt-4k"]);
  } finally {
    Router.getCurrent = originals.route;
    PlayerSettingsStore.get = originals.player;
    DebridSettingsStore.get = originals.debrid;
    I18n.getLocale = originals.locale;
    addonRepository.getCachedInstalledAddons = originals.addons;
  }
});

test("manual mode does not auto-resume a remembered stream", () => {
  const original = PlayerSettingsStore.get;
  try {
    PlayerSettingsStore.get = () => ({
      streamAutoPlayMode: "MANUAL",
      streamReuseLastLinkEnabled: true
    });
    const context = { params: {}, autoResumeUiActive: true, autoResumeAttempted: false };
    createStreamScreenMethods05().maybeAutoResumeStream.call(context);
    assert.equal(context.autoResumeUiActive, false);
  } finally {
    PlayerSettingsStore.get = original;
  }
});

test("best-source search shows the player loading screen before any source is selected", () => {
  const originalTranslate = I18n.t;
  try {
    I18n.t = (_key, _params, { fallback }) => fallback;
    const methods = createStreamScreenMethods09();
    const context = {
      autoSourceSearchUiActive: true,
      container: { innerHTML: "" },
      params: { logo: "https://example.com/logo.png" },
      getHeaderMeta: () => ({ title: "Filme", subtitle: "" }),
      getBackdropUrl: () => "https://example.com/backdrop.png",
      cancelScheduledRender() {},
      renderAutoSourceSearch: methods.renderAutoSourceSearch
    };
    methods.render.call(context);
    assert.match(context.container.innerHTML, /player-loading-overlay/);
    assert.match(context.container.innerHTML, /Buscando a melhor fonte\.\.\./);
    assert.doesNotMatch(context.container.innerHTML, /stream-route-content/);
  } finally {
    I18n.t = originalTranslate;
  }
});

test("best-source search releases the picker when no playable source exists", () => {
  const originals = {
    route: Router.getCurrent,
    player: PlayerSettingsStore.get,
    debrid: DebridSettingsStore.get,
    locale: I18n.getLocale,
    addons: addonRepository.getCachedInstalledAddons
  };
  try {
    Router.getCurrent = () => "stream";
    PlayerSettingsStore.get = () => ({
      streamAutoPlayMode: "BEST_STREAM",
      streamAutoPlaySource: "ALL_SOURCES"
    });
    DebridSettingsStore.get = () => ({ streamPreferences: {} });
    I18n.getLocale = () => "pt-br";
    addonRepository.getCachedInstalledAddons = () => [];
    let renderRequested = false;
    const context = {
      params: {},
      streams: [{ id: "external", externalUrl: "https://example.com" }],
      autoSourceSearchUiActive: true,
      autoPlaySelectionReady: true,
      getFilteredStreams() {
        return this.streams;
      },
      requestRender() {
        renderRequested = true;
      }
    };
    createStreamScreenMethods05().maybeAutoPlayStream.call(context, { allLoaded: true });
    assert.equal(context.autoSourceSearchUiActive, false);
    assert.equal(renderRequested, true);
  } finally {
    Router.getCurrent = originals.route;
    PlayerSettingsStore.get = originals.player;
    DebridSettingsStore.get = originals.debrid;
    I18n.getLocale = originals.locale;
    addonRepository.getCachedInstalledAddons = originals.addons;
  }
});
