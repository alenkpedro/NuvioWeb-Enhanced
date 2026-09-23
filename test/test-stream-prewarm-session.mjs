import assert from "node:assert/strict";
import { test } from "node:test";

import { StreamSearchSessionCache } from "../js/data/repository/streamSearchSessionCache.js";

const key = { profileId: "1", type: "movie", videoId: "tt123", sourceConfiguration: "source" };

test("abandoned detail prewarm stops its stream search", async () => {
  const cache = new StreamSearchSessionCache();
  const controller = new AbortController();
  let producerAborted = false;
  const pending = cache.observe(key, {
    signal: controller.signal,
    cancelWhenUnobserved: true,
    producer: ({ signal }) =>
      new Promise((resolve) =>
        signal.addEventListener(
          "abort",
          () => {
            producerAborted = true;
            resolve({ status: "success", data: [] });
          },
          { once: true }
        )
      )
  });
  await Promise.resolve();
  controller.abort();
  await pending;
  assert.equal(producerAborted, true);
  assert.equal(cache.sessions.size, 0);
});

test("stream screen joining a prewarm keeps the shared search alive", async () => {
  const cache = new StreamSearchSessionCache();
  const controller = new AbortController();
  let complete;
  let producerCount = 0;
  const producer = () => {
    producerCount += 1;
    return new Promise((resolve) => {
      complete = resolve;
    });
  };
  const prewarm = cache.observe(key, {
    signal: controller.signal,
    cancelWhenUnobserved: true,
    producer
  });
  const streamScreen = cache.observe(key, { producer });
  await Promise.resolve();
  controller.abort();
  await prewarm;
  assert.equal(cache.sessions.size, 1);
  complete({ status: "success", data: [{ streams: [{ url: "https://example.com/a.mp4" }] }] });
  const result = await streamScreen;
  assert.equal(result.data.length, 1);
  assert.equal(producerCount, 1);
});
