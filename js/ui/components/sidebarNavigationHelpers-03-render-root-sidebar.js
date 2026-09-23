/* eslint-disable no-unused-vars */

import { Router } from "../navigation/routerState.js";

import { ProfileManager } from "../../core/profile/profileManager.js";

import { AvatarRepository } from "../../data/remote/supabase/avatarRepository.js";

import { MemberAccessRepository } from "../../data/remote/supabase/memberAccessRepository.js";

import { I18n } from "../../i18n/index.js";

import { getTvRuntimePerformanceProfile } from "../../platform/tvRuntimePerformance.js";

import {
  renderModernSidebar,
  isModernSidebarBlurAvailable,
  renderLegacySidebar,
  activateLegacySidebarAction,
  isSelectedSidebarAction
} from "./sidebarNavigationHelpers-02-get-sidebar-avatar-catalog.js";
import { focusWithoutAutoScroll } from "./sidebarNavigationHelpers-04-set-modern-sidebar-expanded.js";
import { scheduleRootSidebarTextFit, syncSidebarStateClasses } from "./sidebarNavigationHelpers-01-root-sidebar-items.js";
import { Environment } from "../../platform/environment.js";
import { renderWebOsTopNavigation } from "./webOsTopNavigation.js";

export function renderRootSidebar({ selectedRoute = "home", profile = null, layout = {}, expanded = false, pillIconOnly = false } = {}) {
  if (Environment.isWebOS() && layout?.webOsNavigationMode !== "sidebar") {
    return renderWebOsTopNavigation({ selectedRoute, profile, layout });
  }
  if (layout?.modernSidebar) {
    return renderModernSidebar({
      selectedRoute,
      profile,
      expanded,
      pillIconOnly,
      blurEnabled: Boolean(layout?.modernSidebarBlur) && isModernSidebarBlurAvailable(),
      layout
    });
  }
  return renderLegacySidebar({ selectedRoute, profile, layout, expanded });
}

export function bindRootSidebarEvents(container, { currentRoute = "", onExpandSidebar = null, onSelectedAction = null } = {}) {
  const focusables = Array.from(container?.querySelectorAll(".home-sidebar .focusable, .modern-sidebar-panel .focusable") || []);

  const moveSidebarFocus = (currentNode, delta) => {
    const nodes = focusables.filter((node) => node.isConnected);
    const currentIndex = nodes.indexOf(currentNode);
    if (currentIndex === -1) {
      return false;
    }
    const nextIndex = Math.max(0, Math.min(nodes.length - 1, currentIndex + delta));
    const target = nodes[nextIndex] || null;
    if (!target || target === currentNode) {
      return true;
    }
    nodes.forEach((node) => node.classList.remove("focused"));
    target.classList.add("focused");
    const screen = Router.getCurrentScreen();
    if (screen) {
      screen.sidebarFocusIndex = nextIndex;
      if ("focusZone" in screen) screen.focusZone = "sidebar";
    }
    focusWithoutAutoScroll(target);
    return true;
  };

  focusables.forEach((node) => {
    node.onclick = async (event) => {
      event?.preventDefault?.();
      event?.stopPropagation?.();
      event?.stopImmediatePropagation?.();
      const action = String(node.dataset.action || "");
      activateLegacySidebarAction(action, currentRoute);
      if (isSelectedSidebarAction(action, currentRoute) && typeof onSelectedAction === "function") {
        await onSelectedAction(node);
      }
    };

    node.onkeydown = (event) => {
      const keyCode = Number(event?.keyCode || 0);
      if (node.closest(".nuvio-top-navigation")) {
        if (keyCode === 37 || keyCode === 39) {
          event?.preventDefault?.();
          event?.stopPropagation?.();
          moveSidebarFocus(node, keyCode === 37 ? -1 : 1);
          return;
        }
        if (keyCode === 40 && typeof onSelectedAction === "function") {
          event?.preventDefault?.();
          event?.stopPropagation?.();
          onSelectedAction(node);
          return;
        }
        return;
      }
      if (keyCode === 38) {
        event?.preventDefault?.();
        event?.stopPropagation?.();
        moveSidebarFocus(node, -1);
        return;
      }
      if (keyCode === 40) {
        event?.preventDefault?.();
        event?.stopPropagation?.();
        moveSidebarFocus(node, 1);
      }
    };
  });

  container?.querySelectorAll(".modern-sidebar-pill[data-action='expandSidebar']").forEach((node) => {
    node.onclick = (event) => {
      event?.preventDefault?.();
      event?.stopPropagation?.();
      event?.stopImmediatePropagation?.();
      if (typeof onExpandSidebar === "function") {
        onExpandSidebar(node);
      }
    };
  });

  const topNavigation = container?.querySelector(".nuvio-top-navigation");
  if (topNavigation) {
    topNavigation.addEventListener("pointerenter", () => topNavigation.classList.add("is-expanded"));
    topNavigation.addEventListener("pointerleave", () => {
      if (!topNavigation.contains(document.activeElement)) topNavigation.classList.remove("is-expanded");
    });
    topNavigation.addEventListener("focusin", () => topNavigation.classList.add("is-expanded"));
    topNavigation.addEventListener("focusout", () => {
      requestAnimationFrame(() => {
        if (!topNavigation.matches(":hover") && !topNavigation.contains(document.activeElement)) {
          topNavigation.classList.remove("is-expanded");
        }
      });
    });
  }

  scheduleRootSidebarTextFit(container);
  syncSidebarStateClasses(container);
}

export function setLegacySidebarExpanded(container, expanded) {
  const sidebar = container?.querySelector(".home-sidebar");
  if (!sidebar) {
    return;
  }
  if (sidebar._legacyCloseFrame) {
    cancelAnimationFrame(sidebar._legacyCloseFrame);
    sidebar._legacyCloseFrame = null;
  }
  if (sidebar._legacyOpenTimer) {
    clearTimeout(sidebar._legacyOpenTimer);
    sidebar._legacyOpenTimer = null;
  }
  const shouldExpand = Boolean(expanded);
  if (shouldExpand) {
    sidebar.classList.add("opening");
    sidebar.classList.add("content-expanded");
    syncSidebarStateClasses(container);
    void sidebar.offsetWidth;
    requestAnimationFrame(() => {
      sidebar.classList.add("expanded");
      syncSidebarStateClasses(container);
    });
    sidebar._legacyOpenTimer = setTimeout(() => {
      sidebar.classList.remove("opening");
      sidebar._legacyOpenTimer = null;
      scheduleRootSidebarTextFit(container);
      syncSidebarStateClasses(container);
    }, 350);
    scheduleRootSidebarTextFit(container);
    return;
  }

  sidebar.classList.remove("opening");
  sidebar.classList.remove("content-expanded");
  syncSidebarStateClasses(container);
  void sidebar.offsetWidth;
  sidebar._legacyCloseFrame = requestAnimationFrame(() => {
    sidebar.classList.remove("expanded");
    sidebar._legacyCloseFrame = null;
    scheduleRootSidebarTextFit(container);
    syncSidebarStateClasses(container);
  });
  scheduleRootSidebarTextFit(container);
}

export function getLegacySidebarNodes(container) {
  return Array.from(container?.querySelectorAll(".home-sidebar .focusable") || []).filter(
    (node) => !node.closest(".modern-sidebar-panel:not(.nuvio-top-navigation)")
  );
}

export function getLegacySidebarSelectedNode(container) {
  return (
    container?.querySelector(".home-sidebar .home-nav-item.selected") ||
    container?.querySelector(".home-sidebar .home-nav-item") ||
    container?.querySelector(".home-sidebar .focusable") ||
    null
  );
}

export function handleLegacySidebarBack(screen, event) {
  const keyCode = Number(event?.keyCode || 0);
  const isBackEvent = keyCode === 8 || keyCode === 27 || keyCode === 461 || keyCode === 10009;
  if (!isBackEvent) {
    return false;
  }

  event?.preventDefault?.();

  const current = screen?.container?.querySelector(".focusable.focused") || document.activeElement || null;
  const sidebarFocused = Boolean(current?.closest?.(".home-sidebar"));

  if (sidebarFocused) {
    Router.navigate("home");
    return true;
  }

  if (typeof screen?.focusSidebarNode === "function") {
    screen.focusSidebarNode();
    return true;
  }

  if (screen && typeof screen.applyFocus === "function") {
    const nodes = getLegacySidebarNodes(screen.container);
    const selected = getLegacySidebarSelectedNode(screen.container);
    screen.focusZone = "sidebar";
    screen.sidebarFocusIndex = Math.max(0, nodes.indexOf(selected));
    screen.applyFocus();
    return true;
  }

  return false;
}

export function getModernSidebarNodes(container) {
  return Array.from(container?.querySelectorAll(".modern-sidebar-panel .focusable") || []);
}

export function getModernSidebarSelectedNode(container) {
  return (
    container?.querySelector(".modern-sidebar-panel .modern-sidebar-nav-item.selected") ||
    container?.querySelector(".modern-sidebar-panel .modern-sidebar-nav-item") ||
    container?.querySelector(".modern-sidebar-panel .focusable") ||
    null
  );
}

export function getRootSidebarNodes(container, layout = {}) {
  return layout?.modernSidebar ? getModernSidebarNodes(container) : getLegacySidebarNodes(container);
}

export function getRootSidebarSelectedNode(container, layout = {}) {
  return layout?.modernSidebar ? getModernSidebarSelectedNode(container) : getLegacySidebarSelectedNode(container);
}

export function isRootSidebarNode(node) {
  return Boolean(node?.closest?.(".home-sidebar, .modern-sidebar-panel"));
}

export function setModernSidebarPillIconOnly(container, iconOnly, keepExpanded = false) {
  const shell = container?.querySelector(".modern-sidebar-shell");
  const pill = container?.querySelector(".modern-sidebar-pill");
  const shouldKeepExpanded = Boolean(keepExpanded || shell?.classList?.contains("keep-pill-expanded"));
  if (!pill || shouldKeepExpanded) {
    pill?.classList.remove("icon-only");
    return;
  }
  pill.classList.toggle("icon-only", Boolean(iconOnly));
}
