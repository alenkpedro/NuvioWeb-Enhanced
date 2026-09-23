import assert from "node:assert/strict";
import { test } from "node:test";

import { shouldPromptForProfile } from "../js/core/profile/profileEntryPolicy.js";

test("authenticated TV launch prompts even for one profile, unless remembering an unlocked profile", () => {
  assert.equal(shouldPromptForProfile({ profileCount: 1 }), true);
  assert.equal(
    shouldPromptForProfile({
      profileCount: 2,
      rememberLastProfile: true,
      hasEverSelectedProfile: true
    }),
    false
  );
  assert.equal(
    shouldPromptForProfile({
      profileCount: 1,
      rememberLastProfile: true,
      hasEverSelectedProfile: true,
      activeProfileHasPin: true
    }),
    true
  );
  assert.equal(shouldPromptForProfile({ profileCount: 2, selectedThisLaunch: true }), false);
});
