/* eslint-disable no-unused-vars */
import * as internals from "./playerScreenContext.js";

export function createPlayerScreenMethods50() {
  const {
    PlayerController,
    PlayerSettingsStore,
    I18n,
    Environment,
    STARTUP_AUDIO_PREFERENCE_RETRY_WINDOW_MS,
    STARTUP_AUDIO_PREFERENCE_RETRY_INTERVAL_MS,
    SUBTITLE_LANGUAGE_OFF_KEY,
    SUBTITLE_LANGUAGE_EMBEDDED_KEY,
    normalizeTrackLanguageCode,
    normalizeSubtitleLanguageKey,
    extractSubtitleLanguageSetting
  } = internals;

  return {
    scrollSubtitleRailNodeIntoView(node, { center = false } = {}) {
      if (!(node instanceof HTMLElement)) {
        return;
      }
      const rail = node.closest(".player-subtitle-rail");
      if (!(rail instanceof HTMLElement)) {
        return;
      }
      const margin = 12;
      const viewTop = Number(rail.scrollTop || 0);
      const maxScrollTop = Math.max(0, Number(rail.scrollHeight || 0) - Number(rail.clientHeight || 0));
      if (maxScrollTop <= 0) {
        return;
      }
      let nextScrollTop = viewTop;

      const railRect = typeof rail.getBoundingClientRect === "function" ? rail.getBoundingClientRect() : null;
      const nodeRect = typeof node.getBoundingClientRect === "function" ? node.getBoundingClientRect() : null;
      if (railRect && nodeRect && Number.isFinite(railRect.top) && Number.isFinite(nodeRect.top)) {
        if (center) {
          nextScrollTop = viewTop + (nodeRect.top - railRect.top) - Math.max(0, (rail.clientHeight - node.offsetHeight) / 2);
        } else if (nodeRect.top < railRect.top + margin) {
          nextScrollTop = viewTop - (railRect.top + margin - nodeRect.top);
        } else if (nodeRect.bottom > railRect.bottom - margin) {
          nextScrollTop = viewTop + (nodeRect.bottom - (railRect.bottom - margin));
        }
      } else {
        const nodeTop = Number(node.offsetTop || 0);
        const nodeBottom = nodeTop + Number(node.offsetHeight || 0);
        const viewBottom = viewTop + Number(rail.clientHeight || 0);
        if (center) {
          nextScrollTop = nodeTop - Math.max(0, (Number(rail.clientHeight || 0) - Number(node.offsetHeight || 0)) / 2);
        } else if (nodeTop < viewTop + margin) {
          nextScrollTop = nodeTop - margin;
        } else if (nodeBottom > viewBottom - margin) {
          nextScrollTop = nodeBottom - Number(rail.clientHeight || 0) + margin;
        }
      }
      // Legacy Chromium/Tizen can return a stale bounding rectangle directly
      // after a keyed DOM update. The offset-parent coordinates are independent
      // of that paint cycle and provide the same nearest-item fallback used by
      // Android's LazyListState when the focused row is outside the viewport.
      if (nextScrollTop === viewTop) {
        const offsetTop = Number(node.offsetTop || 0);
        const offsetBottom = offsetTop + Number(node.offsetHeight || 0);
        const offsetViewBottom = viewTop + Number(rail.clientHeight || 0);
        if (center) {
          nextScrollTop = offsetTop - Math.max(0, (Number(rail.clientHeight || 0) - Number(node.offsetHeight || 0)) / 2);
        } else if (offsetTop < viewTop + margin) {
          nextScrollTop = offsetTop - margin;
        } else if (offsetBottom > offsetViewBottom - margin) {
          nextScrollTop = offsetBottom - Number(rail.clientHeight || 0) + margin;
        }
      }
      if (nextScrollTop !== viewTop) {
        const nextValue = Math.max(0, Math.min(maxScrollTop, Math.round(nextScrollTop)));
        rail.scrollTop = nextValue;
        if (rail.classList.contains("player-subtitle-options-rail") && this.subtitleOptionVirtualState?.window) {
          this.subtitleOptionVirtualState.scrollTop = nextValue;
        }
      }
    },
    scheduleSubtitleDialogScrollIntoView() {
      if (this.subtitleDialogScrollTimer) {
        clearTimeout(this.subtitleDialogScrollTimer);
        this.subtitleDialogScrollTimer = null;
      }
      this.subtitleDialogScrollTimer = setTimeout(() => {
        this.subtitleDialogScrollTimer = null;
        this.scrollSubtitleDialogIntoView();
      }, 0);
    },
    scrollSubtitleDialogIntoView() {
      const dialog = this.uiRefs?.subtitleDialog;
      if (!dialog || !this.subtitleDialogVisible) {
        return;
      }
      const selectedLanguageNode = dialog.querySelector(".player-subtitle-language-rail .player-dialog-item.selected");
      const focusedLanguageNode = dialog.querySelector(".player-subtitle-language-rail .player-dialog-item.focused");
      const languageNode = focusedLanguageNode || selectedLanguageNode;
      const optionNode = dialog.querySelector(".player-subtitle-options-rail .player-dialog-item.focused");
      const styleNode = dialog.querySelector(".player-subtitle-style-rail .player-dialog-item.focused");

      if (this.subtitleFocusedRail === "language") {
        this.scrollSubtitleRailNodeIntoView(languageNode);
      } else if (this.subtitleFocusedRail === "options") {
        this.scrollSubtitleRailNodeIntoView(optionNode);
      } else if (this.subtitleFocusedRail === "style") {
        this.scrollSubtitleRailNodeIntoView(styleNode);
      }
      this.subtitleDialogScrollMode = "nearest";
    },
    getSubtitleOptionsForLanguage(languageKey = this.getSelectedSubtitleLanguageKey()) {
      const normalizedLanguageKey = languageKey || SUBTITLE_LANGUAGE_OFF_KEY;
      const optionsByLanguage = this.trackDialogCache?.subtitleOptionsByLanguage;
      if (optionsByLanguage?.has(normalizedLanguageKey)) {
        return optionsByLanguage.get(normalizedLanguageKey);
      }
      const sourceRank = { internal: 0, addon: 1, off: 2 };
      const locale = typeof I18n.getLocale === "function" ? I18n.getLocale() : undefined;
      const filteredOptions = this.collectSubtitleOptionItems()
        .filter((entry) => {
          if (normalizedLanguageKey === SUBTITLE_LANGUAGE_EMBEDDED_KEY) {
            return Environment.isWebOS() && entry.sourceType === "internal";
          }
          return (
            entry.languageKey === normalizedLanguageKey &&
            entry.languageKey !== SUBTITLE_LANGUAGE_OFF_KEY &&
            (!Environment.isWebOS() || entry.sourceType !== "internal")
          );
        })
        .sort((left, right) => {
          const sourceDelta = (sourceRank[left.sourceType] ?? 99) - (sourceRank[right.sourceType] ?? 99);
          if (sourceDelta !== 0) {
            return sourceDelta;
          }
          const secondaryDelta = String(left.secondary || "").localeCompare(String(right.secondary || ""), locale, { sensitivity: "base" });
          if (secondaryDelta !== 0) {
            return secondaryDelta;
          }
          return String(left.title || "").localeCompare(String(right.title || ""), locale, {
            sensitivity: "base"
          });
        });
      optionsByLanguage?.set(normalizedLanguageKey, filteredOptions);
      return filteredOptions;
    },
    isTrackDiscoveryWindowPending() {
      return Number(this.trackDiscoveryDeadline || 0) > Date.now();
    },
    isWebOsEngineFsEmbeddedTrackDiscoveryPending() {
      if (!Environment.isWebOS() || !this.currentEngineFsStream) {
        return false;
      }

      const probeUrl = this.getTrackProbeUrl();
      if (!probeUrl || this.isCurrentSourceAdaptiveManifest() || !this.isTrackDiscoveryWindowPending()) {
        return false;
      }

      const canDiscoverEmbeddedTracks = this.canDiscoverEmbeddedSubtitleTracks() || this.canDiscoverEmbeddedAudioTracks();
      if (!canDiscoverEmbeddedTracks) {
        // EngineFS can expose a playable URL before the native WebOS player has
        // exposed metadata. Keep the startup decision pending until that probe
        // becomes possible instead of treating candidate metadata as a track.
        return true;
      }

      if (this.embeddedSubtitleLoading || this.embeddedAudioLoading) {
        return true;
      }
      if (this.embeddedSubtitleTracks.length > 0 || this.embeddedAudioTracks.length > 0) {
        return false;
      }

      // An empty successful response is a valid result (the file may have no
      // embedded tracks). An unattempted probe must remain pending so a later
      // response cannot be hidden by an early "off" decision.
      return this.lastEmbeddedTrackProbeUrl !== probeUrl;
    },
    isAudioPreferenceDiscoveryPending() {
      return Boolean(
        this.embeddedAudioLoading ||
        this.manifestLoading ||
        this.trackDiscoveryInProgress ||
        this.pendingWebOsAudioSelection ||
        this.isStartupAudioPreferenceRetryPending() ||
        (!this.getAudioEntries().length && this.isTrackDiscoveryWindowPending())
      );
    },
    clearStartupAudioPreferenceRetry() {
      if (this.startupAudioPreferenceRetryTimer) {
        clearTimeout(this.startupAudioPreferenceRetryTimer);
        this.startupAudioPreferenceRetryTimer = null;
      }
      this.startupAudioPreferenceRetryDeadline = 0;
    },
    isTizenAvPlayStartupAudioRetryPending() {
      return Boolean(
        Environment.isTizen() &&
        typeof PlayerController.isUsingAvPlay === "function" &&
        PlayerController.isUsingAvPlay() &&
        Number(this.startupAudioPreferenceRetryDeadline || 0) > Date.now()
      );
    },
    isStartupAudioPreferenceRetryPending() {
      return Number(this.startupAudioPreferenceRetryDeadline || 0) > Date.now();
    },
    scheduleStartupAudioPreferenceRetry() {
      const canRetryTizenAvPlay = Boolean(
        Environment.isTizen() && typeof PlayerController.isUsingAvPlay === "function" && PlayerController.isUsingAvPlay()
      );
      const canRetryWebOsTracks = Environment.isWebOS();
      if (!canRetryTizenAvPlay && !canRetryWebOsTracks) {
        return false;
      }

      const now = Date.now();
      if (!Number(this.startupAudioPreferenceRetryDeadline || 0)) {
        this.startupAudioPreferenceRetryDeadline = now + STARTUP_AUDIO_PREFERENCE_RETRY_WINDOW_MS;
      }
      if (now >= Number(this.startupAudioPreferenceRetryDeadline || 0)) {
        this.clearStartupAudioPreferenceRetry();
        return false;
      }
      if (this.startupAudioPreferenceRetryTimer) {
        return true;
      }

      this.startupAudioPreferenceRetryTimer = setTimeout(() => {
        this.startupAudioPreferenceRetryTimer = null;
        if (this.startupAudioPreferenceApplied || !this.playerRouteActive) {
          this.clearStartupAudioPreferenceRetry();
          return;
        }
        if (typeof PlayerController.syncAvPlayTrackInfo === "function") {
          PlayerController.syncAvPlayTrackInfo({ force: true });
        }
        if (canRetryWebOsTracks) {
          this.loadEmbeddedSubtitleTracks();
          this.loadManifestTrackDataForCurrentStream(this.activePlaybackUrl || this.getCurrentStreamCandidate()?.url || null);
        }
        this.invalidateTrackDialogCaches();
        this.syncTrackState();
        this.applyStartupAudioPreference();
        this.renderControlButtons();
        if (this.audioDialogVisible) {
          this.renderAudioDialog();
        }
      }, STARTUP_AUDIO_PREFERENCE_RETRY_INTERVAL_MS);
      return true;
    },
    isSubtitlePreferenceDiscoveryPending() {
      const hasSubtitleOptions = this.collectSubtitleOptionItems().some((entry) => entry.languageKey !== SUBTITLE_LANGUAGE_OFF_KEY);
      const webOsEngineFsEmbeddedTrackDiscoveryPending = this.isWebOsEngineFsEmbeddedTrackDiscoveryPending();
      return Boolean(
        this.subtitleLoading ||
        this.embeddedSubtitleLoading ||
        this.manifestLoading ||
        this.trackDiscoveryInProgress ||
        webOsEngineFsEmbeddedTrackDiscoveryPending ||
        (!hasSubtitleOptions && this.isTrackDiscoveryWindowPending())
      );
    },
    getStartupPreferredSubtitleLanguageKey() {
      const settings = PlayerSettingsStore.get();
      if (!settings.subtitlesEnabled) {
        return SUBTITLE_LANGUAGE_OFF_KEY;
      }

      const configured = extractSubtitleLanguageSetting(settings.subtitleStyle?.preferredLanguage || settings.subtitleLanguage || "off")
        .trim()
        .toLowerCase();
      if (!configured || configured === "off" || configured === "none" || configured === "forced") {
        return SUBTITLE_LANGUAGE_OFF_KEY;
      }

      if (configured === "system") {
        const locale = typeof I18n.getLocale === "function" ? I18n.getLocale() : globalThis.navigator?.language || "";
        const systemLanguage = normalizeTrackLanguageCode(locale);
        return systemLanguage ? normalizeSubtitleLanguageKey(systemLanguage) : SUBTITLE_LANGUAGE_OFF_KEY;
      }

      return normalizeSubtitleLanguageKey(configured);
    }
  };
}
