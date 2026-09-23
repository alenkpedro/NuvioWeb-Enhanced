export function shouldPromptForProfile({
  selectedThisLaunch = false,
  rememberLastProfile = false,
  hasEverSelectedProfile = false,
  activeProfileHasPin = false,
  profileCount = 0
} = {}) {
  if (selectedThisLaunch) return false;
  if (rememberLastProfile && hasEverSelectedProfile && !activeProfileHasPin) return false;
  return profileCount > 0 || activeProfileHasPin;
}
