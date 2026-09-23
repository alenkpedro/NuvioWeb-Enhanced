// The x20 webOS port offers every color theme in Appearance. Keep the
// existing theme IDs so saved profile choices and cloud sync remain compatible.
const THEME_IDS = Object.freeze([
  "GOLD",
  "JADE",
  "ROSE_GOLD",
  "ARCTIC_BLUE",
  "GRAPHITE",
  "WHITE",
  "CRIMSON",
  "OCEAN",
  "VIOLET",
  "EMERALD",
  "AMBER",
  "ROSE"
]);

export function availableThemeIds() {
  return THEME_IDS;
}

export function isThemeAvailable(themeName) {
  return THEME_IDS.includes(String(themeName || "").toUpperCase());
}

export function resolveThemeName(themeName) {
  const normalized = String(themeName || "")
    .trim()
    .toUpperCase();
  return isThemeAvailable(normalized) ? normalized : "WHITE";
}
