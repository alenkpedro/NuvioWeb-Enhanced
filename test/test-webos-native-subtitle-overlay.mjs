import assert from "node:assert/strict";
import { test } from "node:test";

Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  value: { getItem: () => null, setItem: () => {}, removeItem: () => {} }
});

const { Environment, PlayerController, localMediaEmbeddedSubtitleRepository } =
  await import("../js/ui/screens/player/playerScreenContext.js");
const { createPlayerScreenMethods25 } =
  await import("../js/ui/screens/player/playerScreenMethods-25-get-subtitle-cue-track-list.js");
const { createPlayerScreenMethods44 } =
  await import("../js/ui/screens/player/playerScreenMethods-44-load-web-os-embedded-text-subtitle-window.js");

test("webOS renders a built-in text track through the app overlay only after hiding the TV renderer", async () => {
  const originalIsWebOS = Environment.isWebOS;
  const originalSetVisibility = PlayerController.setWebOsNativeTextTrackVisibility;
  Environment.isWebOS = () => true;
  try {
    const cue = { startTime: 1, endTime: 3, text: "Legenda embutida" };
    const track = { mode: "showing", cues: null, activeCues: [cue] };
    let hideSucceeded = false;
    PlayerController.setWebOsNativeTextTrackVisibility = async () => hideSucceeded;
    const context = {
      ...createPlayerScreenMethods25(),
      selectedEmbeddedSubtitleTrackIndex: -1,
      selectedSubtitleTrackIndex: 0,
      selectedAddonSubtitleId: null,
      selectedManifestSubtitleTrackId: null,
      webOsEmbeddedTextSubtitleUsingAss: false,
      webOsEmbeddedTextSubtitleUsingHtml: false,
      getVideoTextTrackList: () => [track],
      getTextTracks: () => [track],
      resolveBuiltInSubtitleBoundary: () => 1,
      getSubtitleCueArray: (cues) => Array.from(cues || []),
      getSubtitleCueSnapshot: (value) => value,
      parseSubtitleCueText: (value) => value,
      clearHtmlSubtitleOverlay() {},
      renderHtmlSubtitleOverlayAtCurrentTime() {},
      renderHtmlSubtitleOverlayCue() {},
      scheduleHtmlSubtitleOverlayRender() {}
    };

    context.syncWebOsEmbeddedHtmlSubtitleOverlay();
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(context.htmlSubtitleSelectedId, undefined);
    assert.equal(track.mode, "showing");

    hideSucceeded = true;
    context.syncWebOsEmbeddedHtmlSubtitleOverlay();
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(context.htmlSubtitleSelectedId, "webos-native-text-0");
    assert.equal(context.htmlSubtitleCues[0].text, "Legenda embutida");
    assert.equal(track.mode, "hidden");
  } finally {
    Environment.isWebOS = originalIsWebOS;
    PlayerController.setWebOsNativeTextTrackVisibility = originalSetVisibility;
  }
});

test("an empty extracted window preserves the TV subtitle renderer", async () => {
  const originalIsWebOS = Environment.isWebOS;
  const originalGetWindow = localMediaEmbeddedSubtitleRepository.getWindow;
  const originalSetVisibility = PlayerController.setWebOsEmbeddedSubtitleNativeVisibility;
  Environment.isWebOS = () => true;
  try {
    const track = { sourceTrackId: 1, codec: "subrip" };
    localMediaEmbeddedSubtitleRepository.getWindow = async () => ({
      body: "WEBVTT\n\n",
      windowStartSeconds: 0,
      windowEndSeconds: 120
    });
    PlayerController.setWebOsEmbeddedSubtitleNativeVisibility = async () => true;
    const context = {
      ...createPlayerScreenMethods44(),
      webOsEmbeddedTextSubtitleTrack: track,
      webOsEmbeddedTextSubtitleUsingHtml: false,
      selectedEmbeddedSubtitleTrackIndex: 0,
      getTrackProbeUrl: () => "https://example.com/movie.mkv",
      getPlaybackCurrentSeconds: () => 0,
      parseSubtitleCues: () => [],
      renderHtmlSubtitleOverlayCue() {},
      renderHtmlSubtitleOverlayAtCurrentTime() {},
      scheduleHtmlSubtitleOverlayRender() {}
    };
    assert.equal(await context.loadWebOsEmbeddedTextSubtitleWindow(0), false);
    assert.equal(context.webOsEmbeddedTextSubtitleUsingHtml, false);
    assert.equal(context.htmlSubtitleSelectedId, undefined);
  } finally {
    Environment.isWebOS = originalIsWebOS;
    localMediaEmbeddedSubtitleRepository.getWindow = originalGetWindow;
    PlayerController.setWebOsEmbeddedSubtitleNativeVisibility = originalSetVisibility;
  }
});
