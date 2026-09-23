import assert from "node:assert/strict";
import { test } from "node:test";

import {
  rankStreamsByQuality,
  rankStreamsForAutoPlay
} from "../js/core/streams/streamQualityRanking.js";
import {
  isAutoPlayEffectivelyEnabled,
  selectAutoPlayStream
} from "../js/core/streams/streamAutoPlaySelector.js";

const ids = (streams) => streams.map((stream) => stream.id);

test("manual mode never auto-selects, even with a remembered link or binge group", () => {
  const stream = {
    id: "remembered",
    url: "https://example.com/remembered",
    behaviorHints: { bingeGroup: "same-series" }
  };
  assert.equal(
    isAutoPlayEffectivelyEnabled({
      streamAutoPlayMode: "MANUAL",
      streamReuseLastLinkEnabled: true
    }),
    false
  );
  assert.equal(
    selectAutoPlayStream([stream], {
      mode: "MANUAL",
      preferredBingeGroup: "same-series",
      preferBingeGroupInSelection: true
    }),
    null
  );
  assert.equal(isAutoPlayEffectivelyEnabled({ streamAutoPlayMode: "BEST_STREAM" }), true);
});

test("quality ranking uses resolution, release type and preferred group", () => {
  const streams = [
    { id: "web", name: "Film.1080p.WEB-DL-NTb", url: "https://example.com/web.mp4" },
    { id: "unknown", name: "Film.2160p.WEB-DL-Unknown", url: "https://example.com/unknown.mp4" },
    { id: "preferred", name: "Film.2160p.WEB-DL-FLUX", url: "https://example.com/preferred.mp4" },
    { id: "remux", name: "Film.2160p.BluRay.REMUX-FraMeSToR", url: "https://example.com/remux.mkv" }
  ];
  assert.deepEqual(ids(rankStreamsByQuality(streams)), ["remux", "preferred", "unknown", "web"]);
});

test("excluded metadata is demoted while retaining every source", () => {
  const streams = [
    { id: "excluded", name: "Film.2160p.WEB-DL-X", url: "https://example.com/a.mp4" },
    { id: "allowed", name: "Film.1080p.WEB-DL-X", url: "https://example.com/b.mp4" }
  ];
  const ranked = rankStreamsByQuality(streams, { excludedResolutions: ["P2160"] });
  assert.deepEqual(ids(ranked), ["allowed", "excluded"]);
  assert.equal(selectAutoPlayStream(ranked, { mode: "FIRST_STREAM" })?.id, "allowed");
});

test("sources with no quality metadata keep their original order", () => {
  const streams = [
    { id: "one", name: "Source A", url: "https://example.com/a" },
    { id: "two", name: "Source B", url: "https://example.com/b" }
  ];
  assert.deepEqual(ids(rankStreamsByQuality(streams)), ["one", "two"]);
  assert.deepEqual(ids(streams), ["one", "two"]);
});

test("structured source metadata is included in ranking", () => {
  const streams = [
    { id: "plain", name: "Plain source", url: "https://example.com/plain" },
    {
      id: "structured",
      name: "Structured source",
      url: "https://example.com/structured",
      streamPresentation: {
        resolution: "2160p",
        quality: "WEB-DL",
        releaseGroup: "FLUX",
        size: "5 GB"
      }
    }
  ];
  assert.deepEqual(ids(rankStreamsByQuality(streams)), ["structured", "plain"]);
});

test("automatic selection prioritizes preferred audio language before resolution", () => {
  const streams = [
    { id: "english", name: "Film.EN.2160p.WEB-DL", url: "https://example.com/en" },
    {
      id: "unknown",
      name: "Film.2160p.WEB-DL",
      description: "Subtitles: PT-BR",
      url: "https://example.com/en/unknown"
    },
    { id: "dubbed", name: "Film.Dublado.1080p.WEB-DL", url: "https://example.com/pt" },
    { id: "brazilian", name: "Film.PT-BR.2160p.WEB-DL", url: "https://example.com/pt4k" }
  ];
  const ranked = rankStreamsForAutoPlay(
    streams,
    {},
    {
      preferredAudioLanguage: "system",
      systemLanguage: "pt-BR"
    }
  );
  assert.deepEqual(ids(ranked), ["brazilian", "dubbed", "unknown", "english"]);
  assert.equal(selectAutoPlayStream(ranked, { mode: "BEST_STREAM" })?.id, "brazilian");
});

test("automatic selection uses secondary language and structured language metadata", () => {
  const streams = [
    { id: "unknown", name: "Film.2160p", url: "https://example.com/unknown" },
    {
      id: "secondary",
      name: "Film.1080p",
      url: "https://example.com/secondary",
      streamPresentation: { languages: ["EN"], resolution: "1080p" }
    },
    { id: "other", name: "Film.ES.2160p", url: "https://example.com/other" }
  ];
  const ranked = rankStreamsForAutoPlay(
    streams,
    {},
    {
      preferredAudioLanguage: "original",
      contentLanguage: "ja",
      secondaryPreferredAudioLanguage: "eng"
    }
  );
  assert.deepEqual(ids(ranked), ["secondary", "unknown", "other"]);
});

test("excluded resolution stays below allowed languages in automatic selection", () => {
  const streams = [
    { id: "excluded", name: "Film.PT-BR.2160p", url: "https://example.com/excluded" },
    { id: "allowed", name: "Film.EN.1080p", url: "https://example.com/allowed" }
  ];
  const ranked = rankStreamsForAutoPlay(
    streams,
    { excludedResolutions: ["P2160"] },
    {
      preferredAudioLanguage: "pt-br"
    }
  );
  assert.deepEqual(ids(ranked), ["allowed", "excluded"]);
});

test("automatic selection retains quality ordering when no language is configured", () => {
  const streams = [
    { id: "low", name: "Film.720p.WEB-DL", url: "https://example.com/low" },
    { id: "high", name: "Film.2160p.WEB-DL", url: "https://example.com/high" }
  ];
  assert.deepEqual(ids(rankStreamsForAutoPlay(streams, {}, { preferredAudioLanguage: "none" })), [
    "high",
    "low"
  ]);
});
