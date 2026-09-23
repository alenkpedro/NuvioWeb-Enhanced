import assert from "node:assert/strict";
import { test } from "node:test";

Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  value: { getItem: () => null, setItem: () => {}, removeItem: () => {} }
});

const { Environment, SUBTITLE_LANGUAGE_OFF_KEY, SUBTITLE_LANGUAGE_EMBEDDED_KEY } =
  await import("../js/ui/screens/player/playerScreenContext.js");
const { createPlayerScreenMethods49 } =
  await import("../js/ui/screens/player/playerScreenMethods-49-collect-subtitle-option-items.js");
const { createPlayerScreenMethods50 } =
  await import("../js/ui/screens/player/playerScreenMethods-50-scroll-subtitle-rail-node-into-view.js");
const { createPlayerScreenMethods59 } =
  await import("../js/ui/screens/player/playerScreenMethods-59-handle-subtitle-dialog-key.js");

test("webOS lists embedded subtitles directly below None and selects them from that group", () => {
  const originalIsWebOS = Environment.isWebOS;
  Environment.isWebOS = () => true;
  try {
    const internalEntry = { id: "embedded-pt" };
    const options = [
      { id: "off", languageKey: SUBTITLE_LANGUAGE_OFF_KEY, sourceType: "off", selected: false },
      {
        id: "embedded-pt",
        languageKey: "pt-br",
        sourceType: "internal",
        selected: true,
        entry: internalEntry
      },
      {
        id: "addon-pt",
        languageKey: "pt-br",
        languageLabel: "Português (Brasil)",
        sourceType: "addon",
        selected: false
      }
    ];
    let appliedEntry = null;
    const context = {
      ...createPlayerScreenMethods49(),
      ...createPlayerScreenMethods50(),
      trackDialogCache: { subtitleLanguageRail: null, subtitleOptionsByLanguage: new Map() },
      collectSubtitleOptionItems: () => options,
      getStartupPreferredSubtitleLanguageTargets: () => [],
      subtitleStyleSettings: {},
      applySubtitleEntry(entry) {
        appliedEntry = entry;
      }
    };
    const languages = context.getSubtitleLanguageRailItems();
    assert.deepEqual(
      languages.map((item) => item.key),
      [SUBTITLE_LANGUAGE_OFF_KEY, SUBTITLE_LANGUAGE_EMBEDDED_KEY, "pt-br"]
    );
    assert.equal(languages[1].selected, true);
    assert.deepEqual(
      context.getSubtitleOptionsForLanguage(SUBTITLE_LANGUAGE_EMBEDDED_KEY).map((item) => item.id),
      ["embedded-pt"]
    );
    assert.deepEqual(
      context.getSubtitleOptionsForLanguage("pt-br").map((item) => item.id),
      ["addon-pt"]
    );
    assert.equal(
      context.selectFirstSubtitleOptionForLanguage(SUBTITLE_LANGUAGE_EMBEDDED_KEY),
      true
    );
    assert.equal(appliedEntry, internalEntry);
    assert.equal(context.subtitleFocusedLanguageKey, SUBTITLE_LANGUAGE_EMBEDDED_KEY);
  } finally {
    Environment.isWebOS = originalIsWebOS;
  }
});

test("webOS subtitle settings open from the header and leave the track list scrollable", () => {
  const originalIsWebOS = Environment.isWebOS;
  Environment.isWebOS = () => true;
  try {
    const context = {
      subtitleFocusedRail: "language",
      subtitleSettingsPage: false,
      subtitleLanguageRailIndex: 0,
      subtitleOptionRailIndex: 0,
      subtitleStyleRailIndex: 0,
      subtitleStyleControlSide: "minus",
      getSubtitleLanguageRailItems: () => [{ key: "off" }, { key: "pt-br" }],
      getSelectedSubtitleLanguageKey: () => "pt-br",
      getSubtitleOptionsForLanguage: () => [{ id: "embedded" }],
      getSubtitleStyleControls: () => [{ id: "fontSize" }],
      syncSubtitleDialogFocusDom: () => true,
      renderSubtitleDialog() {},
      rememberSubtitleOptionFocus() {}
    };
    const handle = createPlayerScreenMethods59().handleSubtitleDialogKey;
    handle.call(context, { keyCode: 38 });
    assert.equal(context.subtitleFocusedRail, "header");
    handle.call(context, { keyCode: 13 });
    assert.equal(context.subtitleSettingsPage, true);
    assert.equal(context.subtitleFocusedRail, "style");
    handle.call(context, { keyCode: 38 });
    assert.equal(context.subtitleFocusedRail, "header");
    handle.call(context, { keyCode: 13 });
    assert.equal(context.subtitleSettingsPage, false);
    assert.equal(context.subtitleFocusedRail, "language");
    handle.call(context, { keyCode: 40 });
    handle.call(context, { keyCode: 40 });
    assert.equal(context.subtitleFocusedRail, "options");
    handle.call(context, { keyCode: 40 });
    assert.equal(context.subtitleFocusedRail, "options");
  } finally {
    Environment.isWebOS = originalIsWebOS;
  }
});
