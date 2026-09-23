import {
  iconMarkup,
  itemLabel,
  sidebarItems,
  t
} from "./sidebarNavigationHelpers-01-root-sidebar-items.js";

function escapeAttribute(value) {
  return String(value ?? "").replace(
    /[&"<>]/g,
    (character) =>
      ({
        "&": "&amp;",
        '"': "&quot;",
        "<": "&lt;",
        ">": "&gt;"
      })[character]
  );
}

// The navigation stays in the existing sidebar focus zone so every root screen
// keeps its route and focus state while the webOS presentation moves to the top.
export function renderWebOsTopNavigation({
  selectedRoute = "home",
  profile = null,
  layout = {}
} = {}) {
  const items = sidebarItems(layout);
  const activeRoute =
    selectedRoute === "discover" && !items.some((item) => item.route === "discover")
      ? "search"
      : selectedRoute;
  const profileLabel = t("sidebar.settings");
  return `
    <aside class="home-sidebar root-sidebar root-sidebar-legacy modern-sidebar-panel nuvio-top-navigation"
           data-selected-route="${escapeAttribute(selectedRoute)}" data-collapsible="true"
           data-has-discover="${items.some((item) => item.route === "discover") ? "true" : "false"}"
           role="navigation" aria-label="${escapeAttribute(t("nav_main", {}, "Main navigation"))}">
      ${items
        .map((item, index) => {
          const isSettings = item.route === "settings";
          const label = isSettings ? profileLabel : itemLabel(item);
          const avatarUrl = String(profile?.activeProfileAvatarUrl || "").trim();
          const icon =
            isSettings && avatarUrl
              ? `<img class="nuvio-top-nav-avatar" src="${escapeAttribute(avatarUrl)}" alt="" />`
              : iconMarkup(item, "nuvio-top-nav-icon");
          return `<button class="home-nav-item modern-sidebar-nav-item focusable nuvio-top-nav-item${activeRoute === item.route ? " selected" : ""}"
                        data-nav-zone="sidebar" data-nav-index="${index}" data-action="${item.action}"
                        aria-label="${escapeAttribute(label)}" ${activeRoute === item.route ? 'aria-current="page"' : ""}>
                  <span class="nuvio-top-nav-icon-wrap">${icon}</span>
                  <span class="home-nav-label nuvio-top-nav-label">${escapeAttribute(label)}</span>
                </button>`;
        })
        .join("")}
    </aside>
  `;
}
