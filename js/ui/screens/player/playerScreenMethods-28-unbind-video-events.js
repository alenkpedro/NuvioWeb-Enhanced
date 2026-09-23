/* eslint-disable no-unused-vars */
import * as internals from "./playerScreenContext.js";

export function createPlayerScreenMethods28() {
  const { Environment, t, clamp, escapeHtml } = internals;

  return {
    unbindVideoEvents() {
      this.videoListeners.forEach(({ target, eventName, handler }) => {
        target?.removeEventListener?.(eventName, handler);
      });
      this.videoListeners = [];
    },
    getControlDefinitions() {
      const uiState = this.getPlayerUiState();
      const nextEpisode = this.resolveNextEpisodeInfo();
      const isWebOS = Environment.isWebOS();
      const hasEpisodes = Array.isArray(uiState.episodesAll) && uiState.episodesAll.length > 0;
      const base = [
        {
          action: "playPause",
          label: this.paused ? t("player_control_play", {}, "Play") : t("cd_pause", {}, "Pause"),
          icon: this.paused ? "assets/icons/ic_player_play.svg" : "assets/icons/ic_player_pause.svg",
          title: this.paused ? t("player_control_play", {}, "Play") : t("cd_pause", {}, "Pause"),
          primary: true
        }
      ];

      if (isWebOS) {
        base.push({
          action: "restart",
          label: t("player_restart", {}, "Restart"),
          icon: "assets/icons/ic_player_restart.svg",
          title: t("player_restart", {}, "Restart")
        });
      }

      if (nextEpisode?.hasAired && !this.nextEpisodeLaunching) {
        base.push({
          action: "playNextEpisode",
          icon: "assets/icons/ic_player_skip_next.svg",
          useMask: true,
          title: t("next_episode_label", {}, "Next episode")
        });
      }

      if (isWebOS && hasEpisodes) {
        base.push({
          action: "episodes",
          label: t("episodes_panel_title", {}, "Episodes"),
          icon: "assets/icons/ic_player_episodes.svg",
          title: t("episodes_panel_title", {}, "Episodes")
        });
      }

      base.push({
        action: "subtitleDialog",
        icon: "assets/icons/ic_player_subtitles.svg",
        title: t("subtitle_dialog_title", {}, "Subtitles")
      });

      base.push({
        action: "audioTrack",
        icon:
          this.selectedAudioTrackIndex >= 0 || this.selectedManifestAudioTrackId
            ? "assets/icons/ic_player_audio_filled.svg"
            : "assets/icons/ic_player_audio_outline.svg",
        useMask: true,
        title: t("audio_dialog_title", {}, "Audio")
      });

      base.push({
        action: "source",
        icon: "assets/icons/ic_player_source.svg",
        title: t("sources_title", {}, "Sources")
      });

      if (!isWebOS && hasEpisodes) {
        base.push({
          action: "episodes",
          icon: "assets/icons/ic_player_episodes.svg",
          title: t("episodes_panel_title", {}, "Episodes")
        });
      }

      base.push({
        action: "more",
        label: this.moreActionsVisible ? "<" : ">",
        title: t("player_more_actions_title", {}, "More Actions")
      });

      if (!this.moreActionsVisible) {
        return base;
      }

      const playbackSpeed = this.getPlaybackSpeed();
      const playbackSpeedOptions = this.getPlaybackSpeedOptions();
      return [
        ...base.slice(0, Math.max(0, base.length - 1)),
        ...(playbackSpeedOptions.length > 1
          ? [
              {
                action: "speed",
                label: `${playbackSpeed.toFixed(playbackSpeed % 1 ? 2 : 0)}x`,
                title: t("player_playback_speed", {}, "Playback speed")
              }
            ]
          : []),
        {
          action: "aspect",
          icon: "assets/icons/ic_player_aspect_ratio.svg",
          title: t("player_more_aspect_ratio", {}, "Aspect Ratio")
        },
        {
          action: "stats",
          label: "i",
          title: t("player_stats_title", {}, "Playback stats")
        },
        { action: "backFromMore", label: "<", title: t("player_go_back", {}, "Back") }
      ];
    },
    getQuickControlStartIndex(controls = this.getControlDefinitions()) {
      return controls.findIndex((control) => !["playPause", "restart", "playNextEpisode", "episodes"].includes(control.action));
    },
    getControlRenderSignature(controls = this.getControlDefinitions()) {
      return JSON.stringify(
        controls.map((control) => [
          control.action || "",
          control.label || "",
          control.icon || "",
          control.title || "",
          Boolean(control.primary),
          Boolean(control.useMask)
        ])
      );
    },
    renderControlButtons() {
      if (this.isExternalFrameMode()) {
        return;
      }
      const wrap = this.uiRefs?.controlButtons;
      if (!wrap) {
        return;
      }

      if (this.isPostPlayVisible() || this.isPostPlayLoading()) {
        wrap.innerHTML = "";
        this.renderedControlSignature = "";
        this.syncPlayerOverlayLayoutState();
        return;
      }

      const controls = this.getControlDefinitions();
      const controlRenderSignature = this.getControlRenderSignature(controls);
      if (this.stickyProgressFocus && this.controlsVisible && !this.isDialogOpen() && this.isSeekBarAvailable()) {
        this.controlFocusZone = "progress";
      }
      this.controlFocusIndex = clamp(this.controlFocusIndex, 0, Math.max(0, controls.length - 1));

      const renderButton = (control) =>
        `
          <button class="player-control-btn focusable${control.primary ? " is-primary" : ""}${control.action === "restart" ? " is-restart" : ""}${control.action === "episodes" && Environment.isWebOS() ? " is-episodes" : ""}"
                  data-action="${control.action}"
                  title="${escapeHtml(control.title || "")}" aria-label="${escapeHtml(control.title || control.label || "")}">
            ${
              control.icon
                ? control.primary || control.useMask
                  ? `<span class="player-control-icon player-control-icon-mask" style="-webkit-mask-image:url('${escapeHtml(control.icon)}');mask-image:url('${escapeHtml(control.icon)}');" aria-hidden="true"></span>`
                  : `<img class="player-control-icon" src="${control.icon}" alt="" aria-hidden="true" />`
                : `<span class="player-control-label">${escapeHtml(control.label || "")}</span>`
            }
            ${control.primary || control.action === "restart" || (control.action === "episodes" && Environment.isWebOS()) ? `<span class="player-control-pill-label">${escapeHtml(control.label || "")}</span>` : ""}
          </button>
        `;
      if (Environment.isWebOS()) {
        const quickStart = this.getQuickControlStartIndex(controls);
        wrap.innerHTML = `
          <div class="player-control-playback-actions">
            ${controls.slice(0, quickStart).map(renderButton).join("")}
          </div>
          <div class="player-control-quick-actions">
            ${controls.slice(quickStart).map(renderButton).join("")}
          </div>
        `;
      } else {
        wrap.innerHTML = controls.map(renderButton).join("");
      }
      this.renderedControlSignature = controlRenderSignature;

      const buttons = Array.from(wrap.querySelectorAll(".player-control-btn"));
      buttons.forEach((button, index) => {
        button.classList.toggle("focused", this.controlFocusZone === "buttons" && index === this.controlFocusIndex);
      });
      const progressShell = this.uiRefs?.progressShell;
      if (progressShell) {
        progressShell.classList.toggle("focused", this.controlFocusZone === "progress");
      }

      if (this.controlFocusZone === "progress") {
        buttons.forEach((button) => {
          if (typeof button.blur === "function") {
            button.blur();
          }
        });
        if (progressShell && document.activeElement !== progressShell && typeof progressShell.focus === "function") {
          progressShell.focus();
        }
      } else if (this.controlFocusZone === "buttons") {
        if (progressShell && document.activeElement === progressShell && typeof progressShell.blur === "function") {
          progressShell.blur();
        }
        const focusedButton = buttons[this.controlFocusIndex] || null;
        if (focusedButton && document.activeElement !== focusedButton && typeof focusedButton.focus === "function") {
          focusedButton.focus();
        }
      } else if (this.controlFocusZone === "skipIntro" || this.controlFocusZone === "nextEpisode") {
        buttons.forEach((button) => {
          if (typeof button.blur === "function") {
            button.blur();
          }
        });
        if (progressShell && document.activeElement === progressShell && typeof progressShell.blur === "function") {
          progressShell.blur();
        }
      }
      this.syncSkipIntroFocusState();
      this.renderNextEpisodeCard();
      this.syncNextEpisodeCardFocusState();
      this.syncPlayerOverlayLayoutState();
      this.renderBitmapSubtitleAtCurrentTime();
    },
    syncControlFocusDom() {
      if (this.isExternalFrameMode()) {
        return;
      }
      const wrap = this.uiRefs?.controlButtons;
      if (!wrap) {
        return;
      }

      const controls = this.getControlDefinitions();
      const buttons = Array.from(wrap.querySelectorAll(".player-control-btn"));
      const controlsMatchDom = buttons.every((button, index) => button.dataset.action === String(controls[index]?.action || ""));
      // This path is used only when focus moves. If playback state changed the
      // available controls without rendering them first, fall back to the full
      // state render instead of focusing a stale button.
      if (
        buttons.length !== controls.length ||
        !controlsMatchDom ||
        this.renderedControlSignature !== this.getControlRenderSignature(controls)
      ) {
        this.renderControlButtons();
        return;
      }

      this.controlFocusIndex = clamp(this.controlFocusIndex, 0, Math.max(0, controls.length - 1));
      buttons.forEach((button, index) => {
        button.classList.toggle("focused", this.controlFocusZone === "buttons" && index === this.controlFocusIndex);
      });

      const progressShell = this.uiRefs?.progressShell;
      progressShell?.classList.toggle("focused", this.controlFocusZone === "progress");

      if (this.controlFocusZone === "progress") {
        buttons.forEach((button) => button.blur?.());
        if (progressShell && document.activeElement !== progressShell) {
          progressShell.focus?.();
        }
      } else if (this.controlFocusZone === "buttons") {
        if (progressShell && document.activeElement === progressShell) {
          progressShell.blur?.();
        }
        const focusedButton = buttons[this.controlFocusIndex] || null;
        if (focusedButton && document.activeElement !== focusedButton) {
          focusedButton.focus?.();
        }
      } else if (this.controlFocusZone === "skipIntro" || this.controlFocusZone === "nextEpisode") {
        buttons.forEach((button) => button.blur?.());
        if (progressShell && document.activeElement === progressShell) {
          progressShell.blur?.();
        }
      }

      // Preserve the non-markup side effects of renderControlButtons().
      this.syncSkipIntroFocusState();
      this.renderNextEpisodeCard();
      this.syncNextEpisodeCardFocusState();
      this.syncPlayerOverlayLayoutState();
      this.renderBitmapSubtitleAtCurrentTime();
    },
    isDialogOpen() {
      return (
        this.subtitleDialogVisible ||
        this.subtitleTimingDialogVisible ||
        this.subtitleDelayOverlayVisible ||
        this.audioDialogVisible ||
        this.sourcesPanelVisible ||
        this.episodePanelVisible ||
        this.speedDialogVisible
      );
    },
    syncPlayerOverlayLayoutState() {
      const root = this.uiRefs?.root;
      if (!root) {
        return;
      }
      const postPlayState = this.getPostPlayState();
      const postPlayVisible = Boolean(postPlayState.isVisible);
      const postPlayTrailer = Boolean(postPlayState.isTrailerPlaying);
      const postPlayTrailerConsumed = Boolean(postPlayVisible && postPlayState.hasAutoPlayedTrailer);
      root.classList.toggle("controls-visible", Boolean(this.controlsVisible) && !this.isExternalFrameMode() && !postPlayVisible);
      root.classList.toggle("post-play-visible", postPlayVisible);
      root.classList.toggle("post-play-loading", Boolean(postPlayState.isLoadingRecommendation));
      root.classList.toggle("post-play-trailer", postPlayTrailer);
      root.classList.toggle("post-play-trailer-consumed", postPlayTrailerConsumed);
      root.classList.toggle("post-play-returning", Boolean(postPlayState.hasReturnedToPlayer));
      this.container?.classList.toggle("post-play-visible", postPlayVisible);
      this.container?.classList.toggle("post-play-trailer", postPlayTrailer);
      this.container?.classList.toggle("post-play-trailer-consumed", postPlayTrailerConsumed);
      this.container?.classList.toggle("post-play-returning", Boolean(postPlayState.hasReturnedToPlayer));
      this.syncPostPlayPlayerSurface(postPlayState);
      this.syncPlayerActionOverlayOffset();
    },
    cancelPostPlayNativeSurfaceAnimation() {
      if (this.postPlayNativeSurfaceAnimationFrame == null) {
        return;
      }
      if (this.postPlayNativeSurfaceAnimationUsesRaf) {
        globalThis.cancelAnimationFrame?.(this.postPlayNativeSurfaceAnimationFrame);
      } else {
        clearTimeout(this.postPlayNativeSurfaceAnimationFrame);
      }
      this.postPlayNativeSurfaceAnimationFrame = null;
    }
  };
}
