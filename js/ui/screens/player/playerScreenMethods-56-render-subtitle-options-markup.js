/* eslint-disable no-unused-vars */
import * as internals from "./playerScreenContext.js";

export function createPlayerScreenMethods56() {
  const {
    renderLoadingIndicator,
    SubtitleDelayPreferencesStore,
    SUBTITLE_AUTO_SYNC_MARGIN_MS,
    SUBTITLE_AUTO_SYNC_MAX_VISIBLE_CUES,
    SUBTITLE_DELAY_OVERLAY_TIMEOUT_MS,
    selectSubtitleAutoSyncVisibleCues,
    SUBTITLE_VIRTUALIZATION_DEFAULT_ROW_EXTENT,
    SUBTITLE_VIRTUALIZATION_MIN_WINDOW,
    SUBTITLE_VIRTUALIZATION_OVERSCAN_PX,
    SUBTITLE_VIRTUALIZATION_THRESHOLD,
    buildSubtitleVirtualModel,
    getSubtitleScrollTopForIndex,
    getSubtitleVirtualWindow,
    SUBTITLE_LANGUAGE_OFF_KEY,
    t,
    cleanDisplayText,
    clamp,
    escapeHtml,
    formatSubtitleTrackDisplay
  } = internals;

  return {
    renderSubtitleOptionsMarkup(options = [], { subtitleLoadingVisible = false, languageKey = "" } = {}) {
      if (!options.length) {
        return subtitleLoadingVisible
          ? `
            <div class="player-dialog-empty player-dialog-loading">
              ${renderLoadingIndicator()}
              <span>${escapeHtml(t("subtitle_loading_builtin", {}, "Loading subtitle tracks..."))}</span>
            </div>
          `
          : `<div class="player-dialog-empty">${escapeHtml(t("subtitle_none", {}, "No subtitles"))}</div>`;
      }

      const optionKeys = this.getSubtitleOptionKeys(options);
      const { state, languageChanged } = this.prepareSubtitleOptionVirtualState(languageKey, optionKeys);
      if (options.length < SUBTITLE_VIRTUALIZATION_THRESHOLD) {
        state.model = null;
        state.window = null;
        state.scrollTop = 0;
        state.initialized = true;
        return options.map((item, index) => this.renderSubtitleOptionItemMarkup(item, index, optionKeys[index])).join("");
      }

      const rail = this.uiRefs?.subtitleDialog?.querySelector?.(".player-subtitle-options-rail");
      const viewportHeight = Number(rail?.clientHeight || 0) || 720;
      const estimatedExtent = Number(state.model?.estimatedExtent || 0) || SUBTITLE_VIRTUALIZATION_DEFAULT_ROW_EXTENT;
      const rowGap = this.getSubtitleVirtualRowGap();
      const model = buildSubtitleVirtualModel(optionKeys, state.measuredExtents, estimatedExtent, {
        rowGap
      });
      const preferredIndex = clamp(Number(this.subtitleOptionRailIndex || 0), 0, Math.max(0, options.length - 1));
      let scrollTop = Number(state.scrollTop || 0);
      if (languageChanged || !state.initialized) {
        scrollTop = getSubtitleScrollTopForIndex(model, preferredIndex, {
          currentScrollTop: 0,
          viewportHeight,
          padding: 16
        });
      }
      if (state.window && (preferredIndex < state.window.start || preferredIndex > state.window.end)) {
        scrollTop = getSubtitleScrollTopForIndex(model, preferredIndex, {
          currentScrollTop: scrollTop,
          viewportHeight,
          padding: 16
        });
      }
      const virtualWindow = getSubtitleVirtualWindow(model, {
        scrollTop,
        viewportHeight,
        overscanPx: SUBTITLE_VIRTUALIZATION_OVERSCAN_PX,
        minWindow: SUBTITLE_VIRTUALIZATION_MIN_WINDOW
      });
      state.model = model;
      state.window = virtualWindow;
      state.scrollTop = scrollTop;
      state.initialized = true;

      const visibleItems = options
        .slice(virtualWindow.start, virtualWindow.end + 1)
        .map((item, relativeIndex) => {
          const index = virtualWindow.start + relativeIndex;
          return this.renderSubtitleOptionItemMarkup(item, index, optionKeys[index]);
        })
        .join("");
      const topSpacerHeight = Math.max(0, Number(virtualWindow.topSpacer || 0) - rowGap);
      const bottomSpacerHeight = Math.max(0, Number(virtualWindow.bottomSpacer || 0) - rowGap);
      const topSpacer = topSpacerHeight
        ? `<div class="player-subtitle-virtual-spacer" style="height:${Math.round(topSpacerHeight)}px" aria-hidden="true"></div>`
        : "";
      const bottomSpacer = bottomSpacerHeight
        ? `<div class="player-subtitle-virtual-spacer" style="height:${Math.round(bottomSpacerHeight)}px" aria-hidden="true"></div>`
        : "";
      return `${topSpacer}${visibleItems}${bottomSpacer}`;
    },
    applySubtitleOptionVirtualScrollPosition() {
      const state = this.subtitleOptionVirtualState;
      const rail = this.uiRefs?.subtitleDialog?.querySelector?.(".player-subtitle-options-rail");
      if (!state?.window || !(rail instanceof HTMLElement)) {
        return;
      }
      rail.scrollTop = Math.max(0, Number(state.scrollTop || 0));
    },
    scheduleSubtitleOptionVirtualMeasurement() {
      if (this.subtitleOptionVirtualMeasureTimer) {
        clearTimeout(this.subtitleOptionVirtualMeasureTimer);
        this.subtitleOptionVirtualMeasureTimer = null;
      }
      const options = this.getSubtitleOptionsForLanguage(this.getSelectedSubtitleLanguageKey());
      if (!this.subtitleDialogVisible || options.length < SUBTITLE_VIRTUALIZATION_THRESHOLD) {
        return;
      }
      this.subtitleOptionVirtualMeasureTimer = setTimeout(() => {
        this.subtitleOptionVirtualMeasureTimer = null;
        this.measureSubtitleOptionVirtualRows();
      }, 0);
    },
    measureSubtitleOptionVirtualRows() {
      const state = this.subtitleOptionVirtualState;
      const rail = this.uiRefs?.subtitleDialog?.querySelector?.(".player-subtitle-options-rail");
      if (!this.subtitleDialogVisible || !state?.window || !(rail instanceof HTMLElement) || !state.model) {
        return;
      }
      const measuredRows = Array.from(rail.querySelectorAll("[data-subtitle-rail='options'][data-subtitle-key]"));
      let changed = false;
      measuredRows.forEach((node) => {
        const key = String(node.dataset?.subtitleKey || "");
        const height = Number(node.offsetHeight || 0);
        if (!key || !Number.isFinite(height) || height <= 0) {
          return;
        }
        const previous = Number(state.measuredExtents.get(key) || 0);
        if (Math.abs(previous - height) > 1) {
          state.measuredExtents.set(key, height);
          changed = true;
        }
      });
      if (!changed) {
        return;
      }
      const options = this.getSubtitleOptionsForLanguage(this.getSelectedSubtitleLanguageKey());
      if (options.length < SUBTITLE_VIRTUALIZATION_THRESHOLD) {
        return;
      }
      const optionKeys = this.getSubtitleOptionKeys(options);
      const rowGap = this.getSubtitleVirtualRowGap();
      const model = buildSubtitleVirtualModel(optionKeys, state.measuredExtents, state.model.estimatedExtent, { rowGap });
      const viewportHeight = Number(rail.clientHeight || 0) || 720;
      state.model = model;
      state.scrollTop = getSubtitleScrollTopForIndex(model, this.subtitleOptionRailIndex, {
        currentScrollTop: state.scrollTop,
        viewportHeight,
        padding: 16
      });
      state.window = getSubtitleVirtualWindow(model, {
        scrollTop: state.scrollTop,
        viewportHeight,
        overscanPx: SUBTITLE_VIRTUALIZATION_OVERSCAN_PX,
        minWindow: SUBTITLE_VIRTUALIZATION_MIN_WINDOW
      });
      this.renderSubtitleOptionsRailInPlace({ scheduleMeasurement: false, syncFocus: false });
    },
    renderSubtitleOptionsRailInPlace({ scheduleMeasurement = true, syncFocus = true } = {}) {
      const dialog = this.uiRefs?.subtitleDialog;
      const rail = dialog?.querySelector?.(".player-subtitle-options-rail");
      if (!(rail instanceof HTMLElement) || !this.subtitleDialogVisible) {
        return false;
      }
      const selectedLanguageKey = this.getSelectedSubtitleLanguageKey();
      const options = this.getSubtitleOptionsForLanguage(selectedLanguageKey);
      const subtitleLoadingVisible = Boolean(
        this.subtitleLoading ||
        this.manifestLoading ||
        this.trackDiscoveryInProgress ||
        (this.embeddedSubtitleLoading && this.canDiscoverEmbeddedSubtitleTracks())
      );
      rail.innerHTML = this.renderSubtitleOptionsMarkup(options, {
        subtitleLoadingVisible,
        languageKey: selectedLanguageKey
      });
      rail.classList.toggle(
        "hidden",
        Boolean(this.subtitleSettingsPage) || (selectedLanguageKey === SUBTITLE_LANGUAGE_OFF_KEY && !subtitleLoadingVisible)
      );
      this.renderedSubtitleDialogMarkup = "";
      this.applySubtitleOptionVirtualScrollPosition();
      if (scheduleMeasurement) {
        this.scheduleSubtitleOptionVirtualMeasurement();
      }
      if (syncFocus) {
        this.syncSubtitleDialogFocusDom({ scroll: false });
      }
      return true;
    },
    syncSubtitleDialogFocusDom({ scroll = true } = {}) {
      const dialog = this.uiRefs?.subtitleDialog;
      if (!dialog || !this.subtitleDialogVisible) {
        return false;
      }
      const railName = String(this.subtitleFocusedRail || "language");
      const index =
        railName === "header"
          ? 0
          : railName === "language"
            ? this.subtitleLanguageRailIndex
            : railName === "options"
              ? this.subtitleOptionRailIndex
              : this.subtitleStyleRailIndex;
      let selector =
        railName === "header"
          ? ".player-subtitle-page-button"
          : `.player-subtitle-${railName}-rail .player-dialog-item[data-subtitle-index="${Number(index || 0)}"]`;
      let target = dialog.querySelector(selector);
      if (!target && railName === "options") {
        this.renderSubtitleOptionsRailInPlace({ syncFocus: false });
        target = dialog.querySelector(selector);
      }
      if (!target) {
        return false;
      }

      dialog.querySelectorAll(".focused").forEach((node) => node.classList.remove("focused"));
      target.classList.add("focused");
      if (railName === "style") {
        const side = this.subtitleStyleControlSide === "plus" ? "plus" : "minus";
        target.querySelector(`.player-dialog-step-${side}`)?.classList.add("focused");
      }
      if (scroll) {
        this.scrollSubtitleRailNodeIntoView(target);
        // Tizen 5 can expose stale scrollHeight/clientHeight for one layout
        // tick after the in-place focus class update. The full dialog render
        // already had an asynchronous retry; keep that retry for the lighter
        // in-place navigation path as well so a focused language cannot remain
        // outside the visible rail.
        this.scheduleSubtitleDialogScrollIntoView();
      }
      return true;
    },
    getSubtitleDelayPreferenceVideoId() {
      return String(this.params?.videoId || this.params?.itemId || this.trackPreferenceContentId || "").trim();
    },
    persistSubtitleDelayPreference() {
      const videoId = String(this.subtitleDelayPreferenceVideoId || this.getSubtitleDelayPreferenceVideoId() || "").trim();
      if (!videoId) {
        return;
      }
      SubtitleDelayPreferencesStore.set(videoId, this.subtitleDelayMs);
    },
    getSelectedAddonSubtitle() {
      const selectedId = String(this.selectedAddonSubtitleId || "").trim();
      if (!selectedId) {
        return null;
      }
      return (
        this.getSubtitleDialogSubtitles().find((subtitle, index) => {
          const subtitleId = String(subtitle?.id || subtitle?.url || `subtitle-${index}`).trim();
          return subtitleId === selectedId;
        }) || null
      );
    },
    getSubtitleAutoSyncTrackKey(subtitle = null) {
      if (!subtitle) {
        return "";
      }
      return `${String(subtitle.id || "").trim()}|${String(subtitle.url || "").trim()}`;
    },
    getSubtitleAutoSyncVisibleCues(anchorTimeMs = null) {
      const anchor =
        anchorTimeMs == null
          ? (this.subtitleAutoSyncCapturedVideoMs ?? Math.max(0, Math.trunc(this.getPlaybackCurrentSeconds() * 1000)))
          : Number(anchorTimeMs);
      return selectSubtitleAutoSyncVisibleCues(
        this.subtitleAutoSyncCues,
        Number.isFinite(anchor) ? anchor : 0,
        SUBTITLE_AUTO_SYNC_MARGIN_MS,
        SUBTITLE_AUTO_SYNC_MAX_VISIBLE_CUES
      );
    },
    getSubtitleAutoSyncLanguageLabel(subtitle = null) {
      if (!subtitle) {
        return "";
      }
      const display = formatSubtitleTrackDisplay(subtitle, 0);
      return display.languageLabel || display.label || cleanDisplayText(subtitle.lang);
    },
    clearSubtitleDelayOverlayTimer() {
      if (this.subtitleDelayOverlayTimer) {
        clearTimeout(this.subtitleDelayOverlayTimer);
        this.subtitleDelayOverlayTimer = null;
      }
    },
    scheduleHideSubtitleDelayOverlay() {
      this.clearSubtitleDelayOverlayTimer();
      this.subtitleDelayOverlayTimer = setTimeout(() => {
        this.subtitleDelayOverlayTimer = null;
        this.hideSubtitleDelayOverlay();
      }, SUBTITLE_DELAY_OVERLAY_TIMEOUT_MS);
    }
  };
}
