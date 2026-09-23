import assert from "node:assert/strict";
import { test } from "node:test";

const storage = new Map();
Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  value: {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
    removeItem: (key) => storage.delete(key)
  }
});

const { Platform } = await import("../js/platform/index.js");
const { OptimizedModeStore } = await import("../js/data/local/optimizedModeStore.js");
const {
  getTvRuntimePerformanceProfile,
  getTvHeroTransitionMode,
  resetTvRuntimePerformanceProfile
} = await import("../js/platform/tvRuntimePerformance.js");

test("optimized mode applies the constrained TV policy to a modern LG runtime and is reversible", () => {
  const originalWebOS = Platform.isWebOS;
  const originalTizen = Platform.isTizen;
  const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  const changes = [];
  const unsubscribe = OptimizedModeStore.subscribe((enabled) => changes.push(enabled));
  try {
    Platform.isWebOS = () => true;
    Platform.isTizen = () => false;
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: { userAgent: "Mozilla/5.0 (Web0S.TV-24.0.0) Chrome/120.0.0.0" }
    });
    resetTvRuntimePerformanceProfile();

    const normal = getTvRuntimePerformanceProfile();
    assert.equal(normal.isPerformanceConstrained, false);
    assert.equal(normal.optimizedModeEnabled, false);
    assert.equal(getTvHeroTransitionMode(), "crossfade");

    OptimizedModeStore.setEnabled(true);
    const optimized = getTvRuntimePerformanceProfile();
    assert.equal(optimized.isLegacyTvRuntime, false);
    assert.equal(optimized.isPerformanceConstrained, true);
    assert.equal(optimized.optimizedModeEnabled, true);
    assert.equal(getTvHeroTransitionMode(), "single-layer");
    assert.equal(storage.get("optimizedModeEnabled"), "true");

    OptimizedModeStore.setEnabled(false);
    assert.equal(getTvRuntimePerformanceProfile(), normal);
    assert.equal(getTvHeroTransitionMode(), "crossfade");
    assert.deepEqual(changes, [true, false]);
  } finally {
    unsubscribe();
    OptimizedModeStore.setEnabled(false);
    Platform.isWebOS = originalWebOS;
    Platform.isTizen = originalTizen;
    if (originalNavigator) Object.defineProperty(globalThis, "navigator", originalNavigator);
    else delete globalThis.navigator;
    resetTvRuntimePerformanceProfile();
  }
});
