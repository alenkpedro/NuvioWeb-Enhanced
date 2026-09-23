import assert from "node:assert/strict";
import { test } from "node:test";

Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  value: { getItem: () => null, setItem: () => {}, removeItem: () => {} }
});

const { Environment } = await import("../js/ui/screens/player/playerScreenContext.js");
const { createPlayerScreenMethods61 } =
  await import("../js/ui/screens/player/playerScreenMethods-61-apply-audio-track.js");
const { createPlayerScreenMethods62 } =
  await import("../js/ui/screens/player/playerScreenMethods-62-render-audio-control-item.js");

test("webOS audio panel keeps tracks and settings on separate pages", () => {
  const originalIsWebOS = Environment.isWebOS;
  Environment.isWebOS = () => true;
  try {
    const dialog = {
      classList: { toggle() {} },
      innerHTML: ""
    };
    const entries = [
      { label: "Português", secondary: "5.1", selected: true, supported: true },
      { label: "English", secondary: "Stereo", selected: false, supported: true }
    ];
    const context = {
      uiRefs: { audioDialog: dialog },
      audioDialogVisible: true,
      audioSettingsPage: false,
      audioFocusedColumn: "tracks",
      audioDialogIndex: 0,
      audioMixFocusIndex: 0,
      audioAmplificationDb: 0,
      audioAmplificationAvailable: true,
      persistAudioAmplification: false,
      embeddedAudioLoading: false,
      getAudioEntries: () => entries,
      getAudioDialogSupportNotice: () => "",
      isAudioEntryPending: () => false,
      isCurrentSourceAdaptiveManifest: () => false,
      renderAudioControlItem: () => "<div class='audio-setting'></div>",
      scrollAudioDialogIntoView() {},
      renderAudioDialog() {
        createPlayerScreenMethods61().renderAudioDialog.call(this);
      }
    };
    const handle = createPlayerScreenMethods62().handleAudioDialogKey;
    context.renderAudioDialog();
    assert.match(dialog.innerHTML, /player-audio-page-button/);
    assert.match(dialog.innerHTML, /player-audio-track-list/);
    assert.doesNotMatch(dialog.innerHTML, /player-audio-controls-list/);

    handle.call(context, { keyCode: 38 });
    assert.equal(context.audioFocusedColumn, "header");
    handle.call(context, { keyCode: 13 });
    assert.equal(context.audioSettingsPage, true);
    assert.equal(context.audioFocusedColumn, "controls");
    assert.match(dialog.innerHTML, /player-audio-controls-list/);
    assert.doesNotMatch(dialog.innerHTML, /player-audio-track-list/);

    handle.call(context, { keyCode: 38 });
    assert.equal(context.audioFocusedColumn, "header");
    handle.call(context, { keyCode: 13 });
    assert.equal(context.audioSettingsPage, false);
    assert.equal(context.audioFocusedColumn, "tracks");
    handle.call(context, { keyCode: 40 });
    assert.equal(context.audioDialogIndex, 1);
    handle.call(context, { keyCode: 40 });
    assert.equal(context.audioFocusedColumn, "tracks");
    handle.call(context, { keyCode: 39 });
    assert.equal(context.audioFocusedColumn, "tracks");
  } finally {
    Environment.isWebOS = originalIsWebOS;
  }
});
