import assert from "node:assert/strict";
import { test } from "node:test";

import { Platform } from "../js/platform/index.js";
import { WebOsLunaService } from "../js/platform/webos/webosLunaService.js";
import { localMediaTracksRepository } from "../js/data/repository/localMediaTracksRepository.js";

test("webOS simulator probes the local media server when Luna has no companion service", async () => {
  const original = {
    webos: Platform.isWebOS,
    tizen: Platform.isTizen,
    browser: Platform.isBrowser,
    available: WebOsLunaService.isAvailable,
    request: WebOsLunaService.request,
    fetch: globalThis.fetch,
    navigator: Object.getOwnPropertyDescriptor(globalThis, "navigator")
  };
  try {
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: { userAgent: "webOS Simulator" }
    });
    Platform.isWebOS = () => true;
    Platform.isTizen = () => false;
    Platform.isBrowser = () => false;
    WebOsLunaService.isAvailable = () => true;
    WebOsLunaService.request = async () => {
      throw new Error("companion unavailable");
    };
    let requestedUrl = "";
    globalThis.fetch = async (url) => {
      requestedUrl = String(url);
      return {
        ok: true,
        json: async () => [{ type: "subtitle", codec: "subrip", language: "por" }]
      };
    };
    const tracks = await localMediaTracksRepository.getTracks("https://example.com/movie.mkv");
    assert.equal(tracks.length, 1);
    assert.equal(tracks[0].language, "por");
    assert.match(requestedUrl, /127\.0\.0\.1:2710\/tracks\//);
  } finally {
    Platform.isWebOS = original.webos;
    Platform.isTizen = original.tizen;
    Platform.isBrowser = original.browser;
    WebOsLunaService.isAvailable = original.available;
    WebOsLunaService.request = original.request;
    globalThis.fetch = original.fetch;
    if (original.navigator) {
      Object.defineProperty(globalThis, "navigator", original.navigator);
    } else {
      delete globalThis.navigator;
    }
  }
});
