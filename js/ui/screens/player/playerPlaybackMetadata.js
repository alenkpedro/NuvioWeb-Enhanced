function positiveNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

function sizeFromText(value) {
  const match = String(value || "").match(/(\d+(?:[.,]\d+)?)\s*(TB|GB|MB|KB)\b/i);
  if (!match) {
    return 0;
  }
  const unitPower = { KB: 1, MB: 2, GB: 3, TB: 4 }[match[2].toUpperCase()];
  return positiveNumber(Number(match[1].replace(",", ".")) * 1024 ** unitPower);
}

export function getPlayerStreamMetadata({ video = null, avPlayDimensions = null, candidate = null, fallbackSize = null } = {}) {
  const videoWidth = positiveNumber(video?.videoWidth);
  const videoHeight = positiveNumber(video?.videoHeight);
  const avPlayWidth = positiveNumber(avPlayDimensions?.width);
  const avPlayHeight = positiveNumber(avPlayDimensions?.height);
  const [width, height] = videoWidth && videoHeight ? [videoWidth, videoHeight] : [avPlayWidth, avPlayHeight];
  let resolution = width && height ? `${Math.round(width)} × ${Math.round(height)}` : "";
  if (!resolution) {
    const sourceResolution = [
      candidate?.streamPresentation?.resolution,
      candidate?.raw?.streamPresentation?.resolution,
      candidate?.quality,
      candidate?.title,
      candidate?.name
    ]
      .map((value) => String(value || ""))
      .find((value) => /(\d{3,5}\s*[x×]\s*\d{3,5}|\b(?:8K|4K|2160p|1080p|720p|480p|360p)\b)/i.test(value));
    const dimensions = sourceResolution?.match(/(\d{3,5})\s*[x×]\s*(\d{3,5})/i);
    const quality = sourceResolution?.match(/\b(8K|4K|2160p|1080p|720p|480p|360p)\b/i);
    const qualityLabel = quality?.[1] || "";
    resolution = dimensions
      ? `${dimensions[1]} × ${dimensions[2]}`
      : /k$/i.test(qualityLabel)
        ? qualityLabel.toUpperCase()
        : qualityLabel.toLowerCase();
  }

  const sizeBytes =
    [
      candidate?.behaviorHints?.videoSize,
      candidate?.raw?.behaviorHints?.videoSize,
      candidate?.videoSize,
      candidate?.raw?.videoSize,
      candidate?.raw?.size,
      candidate?.clientResolve?.stream?.raw?.size,
      candidate?.debridCacheStatus?.cachedSize,
      candidate?.streamPresentation?.size,
      candidate?.raw?.streamPresentation?.size,
      fallbackSize
    ]
      .map((value) => positiveNumber(value) || sizeFromText(value))
      .find(Boolean) ||
    [candidate?.description, candidate?.title, candidate?.name].map(sizeFromText).find(Boolean) ||
    0;

  return { resolution, sizeBytes };
}
