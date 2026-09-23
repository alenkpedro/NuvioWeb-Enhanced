import {
  facts,
  encodeFromText,
  languagesFromText,
  releaseGroupFromText
} from "../debrid/debridStreamPresentationHelpers-02-has-token.js";
import { resolutionFromFields } from "../debrid/streamResolution.js";
import { sizeBytesFromText } from "../debrid/streamTextSizeParser.js";
import {
  DEFAULT_RESOLUTION_ORDER,
  DEFAULT_QUALITY_ORDER,
  DEFAULT_VISUAL_TAG_ORDER,
  DEFAULT_AUDIO_CHANNEL_ORDER,
  DEFAULT_ENCODE_ORDER,
  qualityFromText
} from "../debrid/debridStreamPresentationHelpers-01-resolution-labels.js";

// Release-group ladder adapted from NuvioTV-Fork's TRaSH-aligned defaults.
// Keep resolution and release type ahead of the group, as in StreamQualityRank.
const RELEASE_GROUPS = [
  "3L",
  "BiZKiT",
  "BLURANiUM",
  "BMF",
  "CiNEPHiLES",
  "FraMeSToR",
  "PiRAMiDHEAD",
  "PmP",
  "WiLDCAT",
  "ZQ",
  "ATELiER",
  "NCmt",
  "playBD",
  "SiCFoI",
  "SURFINBIRD",
  "TEPES",
  "12GaugeShotgun",
  "decibeL",
  "EPSiLON",
  "HiFi",
  "iFT",
  "KRaLiMaRKo",
  "NTb",
  "PTP",
  "SumVision",
  "TOA",
  "TRiToN",
  "CtrlHD",
  "MainFrame",
  "DON",
  "W4NK3R",
  "HiDt",
  "HQMUX",
  "BHDStudio",
  "hallowed",
  "HONE",
  "PTer",
  "SPHD",
  "WEBDV",
  "BBQ",
  "c0kE",
  "Chotab",
  "CRiSC",
  "D-Z0N3",
  "Dariush",
  "EbP",
  "EDPH",
  "Geek",
  "LolHD",
  "TayTO",
  "TDD",
  "TnP",
  "VietHD",
  "ZoroSenpai",
  "EA",
  "HiSD",
  "QOQ",
  "SA89",
  "sbR",
  "LoRD",
  "playHD",
  "ABBIE",
  "AJP69",
  "APEX",
  "PAXA",
  "PEXA",
  "XEPA",
  "BLUTONiUM",
  "BYNDR",
  "CMRG",
  "CRFW",
  "CRUD",
  "FLUX",
  "GNOME",
  "KiNGS",
  "Kitsune",
  "MADSKY",
  "NOSiViD",
  "NTG",
  "RAWR",
  "SiC",
  "TheFarm",
  "dB",
  "Flights",
  "MiU",
  "monkee",
  "MZABI",
  "PHOENiX",
  "playWEB",
  "SMURF",
  "TOMMY",
  "XEBEC",
  "4KBEC",
  "CEBEX",
  "BLOOM",
  "Dooky",
  "GNOMiSSiON",
  "HHWEB",
  "NINJACENTRAL",
  "NPMS",
  "ROCCaT",
  "SiGMA",
  "SLiGNOME",
  "SwAgLaNdEr"
];
const GROUP_RANKS = new Map(RELEASE_GROUPS.map((group, index) => [group.toLowerCase(), index]));
const AUDIO_ORDER = [
  "TRUEHD",
  "DTS_HD_MA",
  "DTS_X",
  "ATMOS",
  "DTS_HD",
  "FLAC",
  "DD_PLUS",
  "DD",
  "DTS",
  "OPUS",
  "AAC",
  "UNKNOWN"
];

function position(value, order) {
  const index = order.indexOf(value);
  return index < 0 ? order.length : index;
}

function bestPosition(values, order) {
  return Math.min(
    ...(Array.isArray(values) && values.length
      ? values.map((value) => position(value, order))
      : [order.length])
  );
}

function preferredOrder(values, fallback) {
  return Array.isArray(values) && values.length ? values : fallback;
}

const LANGUAGE_ALIASES = {
  eng: "en",
  english: "en",
  por: "pt",
  portuguese: "pt",
  portugues: "pt",
  pob: "pt-br",
  br: "pt-br",
  brazilian: "pt-br",
  spa: "es",
  esp: "es",
  spanish: "es",
  fra: "fr",
  fre: "fr",
  french: "fr",
  deu: "de",
  ger: "de",
  german: "de",
  ita: "it",
  italian: "it",
  jpn: "ja",
  japanese: "ja",
  kor: "ko",
  korean: "ko",
  zho: "zh",
  chi: "zh",
  chinese: "zh",
  hin: "hi",
  hindi: "hi"
};

function normalizeLanguage(value) {
  const raw =
    value && typeof value === "object"
      ? (value.code ?? value.languageCode ?? value.language ?? value.id ?? value.name ?? "")
      : value;
  const code = String(raw || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replaceAll("_", "-");
  if (!code) return "";
  if (["ptbr", "brazilian portuguese", "portuguese brazil", "portugues brasileiro"].includes(code))
    return "pt-br";
  if (code === "pt-pt") return "pt";
  if (code === "multi" || code === "dual audio" || code === "dual-audio") return "multi";
  return LANGUAGE_ALIASES[code] || (/^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/.test(code) ? code : "");
}

function preferredLanguages(settings = {}) {
  const systemLanguage = normalizeLanguage(
    settings.systemLanguage || globalThis.navigator?.language
  );
  const originalLanguage = normalizeLanguage(settings.contentLanguage || settings.originalLanguage);
  const resolve = (value) => {
    const configured = String(value || "")
      .trim()
      .toLowerCase();
    if (configured === "system" || configured === "device") return systemLanguage;
    if (configured === "original") return originalLanguage || systemLanguage;
    if (["", "none", "off", "default"].includes(configured)) return "";
    return normalizeLanguage(configured);
  };
  return [
    ...new Set(
      [
        resolve(settings.preferredAudioLanguage),
        resolve(settings.secondaryPreferredAudioLanguage)
      ].filter(Boolean)
    )
  ];
}

function streamLanguages(stream) {
  const presentation = stream?.streamPresentation || stream?.raw?.streamPresentation || {};
  const parsed =
    stream?.clientResolve?.stream?.raw?.parsed ||
    stream?.raw?.clientResolve?.stream?.raw?.parsed ||
    {};
  const values = [
    ...(Array.isArray(parsed.languages) ? parsed.languages : []),
    ...(Array.isArray(presentation.languages) ? presentation.languages : []),
    ...(Array.isArray(stream?.languages) ? stream.languages : []),
    ...(Array.isArray(stream?.raw?.languages) ? stream.raw.languages : []),
    stream?.language,
    stream?.audioLanguage,
    stream?.raw?.language,
    stream?.raw?.audioLanguage
  ];
  const titleText = [
    stream?.behaviorHints?.filename,
    stream?.name,
    stream?.title,
    stream?.raw?.behaviorHints?.filename,
    stream?.clientResolve?.filename,
    stream?.raw?.clientResolve?.filename
  ]
    .filter(Boolean)
    .join(" ");
  const languages = new Set(
    [...values, ...languagesFromText([], titleText)].map(normalizeLanguage).filter(Boolean)
  );
  const audioText = [titleText, stream?.description].filter(Boolean).join(" ");
  if (
    /\b(dublado|brazilian portuguese|portugu[eê]s(?: brasileiro)?|pt[._ -]?br|pob)\b|🇧🇷/i.test(
      titleText
    ) ||
    /\bdublado\b/i.test(audioText)
  ) {
    languages.add("pt-br");
  }
  if (/\b(dual[ ._-]?audio|multi[ ._-]?audio)\b/i.test(audioText)) {
    languages.add("multi");
  }
  return languages;
}

function languageRank(stream, targets) {
  if (!targets.length) return 0;
  const languages = streamLanguages(stream);
  for (let index = 0; index < targets.length; index += 1) {
    if (languages.has(targets[index])) return index * 2;
    if (
      [...languages].some(
        (language) =>
          language !== "multi" && language.split("-")[0] === targets[index].split("-")[0]
      )
    ) {
      return index * 2 + 1;
    }
  }
  if (languages.has("multi")) return 4;
  return languages.size ? 6 : 5;
}

function streamFacts(stream) {
  const parsed = facts(stream);
  const presentation = stream?.streamPresentation || stream?.raw?.streamPresentation || {};
  const presentationResolution = resolutionFromFields([presentation.resolution]);
  const presentationQuality = qualityFromText(presentation.quality || "");
  const presentationSize = Number(presentation.size) || sizeBytesFromText(presentation.size) || 0;
  const filenameGroup = [stream?.behaviorHints?.filename, stream?.name, stream?.title]
    .map((value) => releaseGroupFromText(value))
    .find(Boolean);
  return {
    ...parsed,
    resolution: presentationResolution === "UNKNOWN" ? parsed.resolution : presentationResolution,
    quality: presentationQuality === "UNKNOWN" ? parsed.quality : presentationQuality,
    size: parsed.size || presentationSize,
    visualTags: presentation.visualTags?.length ? presentation.visualTags : parsed.visualTags,
    audioTags: presentation.audioTags?.length ? presentation.audioTags : parsed.audioTags,
    audioChannels: presentation.audioChannels?.length
      ? presentation.audioChannels
      : parsed.audioChannels,
    codec: presentation.encode ? encodeFromText(presentation.encode) : parsed.codec,
    releaseGroup: presentation.releaseGroup || parsed.releaseGroup || filenameGroup || ""
  };
}

function excluded(fact, preferences) {
  const includes = (key, value) =>
    Array.isArray(preferences[key]) && preferences[key].includes(value);
  const includesAny = (key, values) =>
    Array.isArray(values) && values.some((value) => includes(key, value));
  return (
    includes("excludedResolutions", fact.resolution) ||
    includes("excludedQualities", fact.quality) ||
    includesAny("excludedVisualTags", fact.visualTags) ||
    includesAny("excludedAudioTags", fact.audioTags) ||
    includesAny("excludedAudioChannels", fact.audioChannels) ||
    includes("excludedEncodes", fact.codec) ||
    (fact.releaseGroup &&
      (preferences.excludedReleaseGroups || []).some(
        (group) => String(group).toLowerCase() === fact.releaseGroup.toLowerCase()
      ))
  );
}

function score(stream, preferences, languageTargets = []) {
  const fact = streamFacts(stream);
  const groupRank =
    GROUP_RANKS.get(String(fact.releaseGroup || "").toLowerCase()) ?? GROUP_RANKS.size;
  const size = Number(fact.size) || 0;
  const text = [
    stream?.behaviorHints?.filename,
    stream?.title,
    stream?.name,
    stream?.description,
    stream?.url
  ]
    .filter(Boolean)
    .join(" ");
  return [
    excluded(fact, preferences) ? 1 : 0,
    ...(languageTargets.length ? [languageRank(stream, languageTargets)] : []),
    position(
      fact.resolution,
      preferredOrder(preferences.preferredResolutions, DEFAULT_RESOLUTION_ORDER)
    ),
    position(fact.quality, preferredOrder(preferences.preferredQualities, DEFAULT_QUALITY_ORDER)),
    groupRank,
    bestPosition(
      fact.visualTags,
      preferredOrder(preferences.preferredVisualTags, DEFAULT_VISUAL_TAG_ORDER)
    ),
    bestPosition(fact.audioTags, AUDIO_ORDER),
    bestPosition(
      fact.audioChannels,
      preferredOrder(preferences.preferredAudioChannels, DEFAULT_AUDIO_CHANNEL_ORDER)
    ),
    position(fact.codec, preferredOrder(preferences.preferredEncodes, DEFAULT_ENCODE_ORDER)),
    -size,
    /(?:\.|\b)mkv\b/i.test(text) ? 0 : 1
  ];
}

function rankStreams(streams, preferences, languageTargets = []) {
  const entries = (Array.isArray(streams) ? streams : []).filter(Boolean);
  if (entries.length < 2) return entries.slice();
  const ranked = entries.map((stream, index) => ({
    stream,
    index,
    score: score(stream, preferences, languageTargets)
  }));
  ranked.sort((left, right) => {
    for (let index = 0; index < left.score.length; index += 1) {
      if (left.score[index] !== right.score[index]) return left.score[index] - right.score[index];
    }
    return left.index - right.index;
  });
  return ranked.map(({ stream }) => stream);
}

export function rankStreamsByQuality(streams = [], preferences = {}) {
  return rankStreams(streams, preferences);
}

export function rankStreamsForAutoPlay(streams = [], preferences = {}, settings = {}) {
  return rankStreams(streams, preferences, preferredLanguages(settings));
}
