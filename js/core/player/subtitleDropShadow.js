export function buildSubtitleDropShadow(enabled, color = "#000000") {
  if (!enabled) return "none";
  const hex = /^#[0-9a-f]{6}$/i.test(String(color || "")) ? color.slice(1) : "000000";
  const red = Number.parseInt(hex.slice(0, 2), 16);
  const green = Number.parseInt(hex.slice(2, 4), 16);
  const blue = Number.parseInt(hex.slice(4, 6), 16);
  const rgba = (opacity) => `rgba(${red}, ${green}, ${blue}, ${opacity})`;
  return `0 1px 2px ${rgba(0.95)}, 0 3px 6px ${rgba(0.78)}, 0 6px 12px ${rgba(0.45)}`;
}
