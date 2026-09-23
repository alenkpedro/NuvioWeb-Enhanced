/* eslint-disable no-unused-vars */
import * as internals from "./playerScreenContext.js";
import { getPlayerStreamMetadata } from "./playerPlaybackMetadata.js";

export function createPlayerScreenMethods32() {
  const {
    PlayerController,
    Environment,
    deltaMsForKeyRepeat,
    calculateRemainingPlaybackMilliseconds,
    t,
    formatTime,
    formatClock,
    formatEndsAt,
    formatBytes,
    escapeHtml,
    clamp
  } = internals;
  const formatPlayerTime = (seconds) => {
    const value = formatTime(seconds);
    return value.length === 4 ? `0${value}` : value;
  };

  return {
    updatePlaybackStatsOverlay() {
      const node = this.uiRefs?.statsOverlay;
      if (!node) return;
      node.classList.toggle("hidden", !this.statsOverlayVisible);
      this.uiRefs?.root?.classList.toggle("stats-visible", Boolean(this.statsOverlayVisible));
      if (!this.statsOverlayVisible) return;

      const now = Date.now();
      if (this.currentEngineFsStream && !this.statsNetworkPending && now - Number(this.statsNetworkRequestedAt || 0) > 4000) {
        this.statsNetworkRequestedAt = now;
        this.statsNetworkPending = true;
        const playbackUrl = this.activePlaybackUrl;
        void this.fetchCurrentEngineFsStats({ timeoutMs: 1200 })
          .then((stats) => {
            if (stats && this.playerRouteActive && this.activePlaybackUrl === playbackUrl) {
              this.statsNetworkSample = this.getEngineFsStallSnapshot(stats);
            }
          })
          .catch(() => {
            // Playback continues even when optional network diagnostics fail.
          })
          .finally(() => {
            this.statsNetworkPending = false;
            if (this.playerRouteActive && this.statsOverlayVisible) this.updatePlaybackStatsOverlay();
          });
      }

      const video = PlayerController.video;
      let dimensions = null;
      if (PlayerController.isUsingAvPlay?.()) {
        try {
          dimensions = PlayerController.getAvPlayVideoDimensions?.() || null;
        } catch (_) {
          dimensions = null;
        }
      }
      const actualWidth = Number(video?.videoWidth || dimensions?.width || 0);
      const actualHeight = Number(video?.videoHeight || dimensions?.height || 0);
      const metadata = getPlayerStreamMetadata({
        video,
        avPlayDimensions: dimensions,
        candidate: this.getCurrentStreamCandidate(),
        fallbackSize: this.params?.videoSize
      });
      const current = this.getPlaybackCurrentSeconds();
      const buffered = this.getPlaybackBufferedSeconds();
      const ahead = Number.isFinite(buffered) ? Math.max(0, buffered - current) : null;
      const hlsBandwidth = Number(PlayerController.hlsInstance?.bandwidthEstimate || 0);
      const measuredSpeed = Number(this.statsNetworkSample?.downloadSpeed || 0);
      const speedBytes = measuredSpeed > 0 ? measuredSpeed : hlsBandwidth > 0 ? hlsBandwidth / 8 : 0;
      let audioEntry = null;
      let quality = null;
      try {
        audioEntry = this.getAudioEntries?.().find((entry) => entry.selected) || null;
      } catch (_) {
        audioEntry = null;
      }
      try {
        quality = video?.getVideoPlaybackQuality?.() || null;
      } catch (_) {
        quality = null;
      }
      const rows = [
        [
          t("player_stats_engine", {}, "Player"),
          PlayerController.isUsingAvPlay?.() ? "AVPlay" : PlayerController.hlsInstance ? "hls.js" : "HTML5"
        ],
        [
          t(
            actualWidth && actualHeight ? "player_stats_resolution" : "player_stats_source_resolution",
            {},
            actualWidth && actualHeight ? "Video resolution" : "Source resolution"
          ),
          metadata.resolution
        ],
        [t("player_stats_file_size", {}, "Reported file size"), formatBytes(metadata.sizeBytes)],
        [t("player_stats_buffer", {}, "Buffered ahead"), ahead == null ? "" : `${ahead.toFixed(1)} s`],
        [
          t(
            measuredSpeed > 0 ? "player_stats_download" : "player_stats_estimated_speed",
            {},
            measuredSpeed > 0 ? "Download speed" : "Estimated bandwidth"
          ),
          speedBytes > 0 ? `${formatBytes(speedBytes)}/s` : ""
        ],
        [t("player_stats_audio", {}, "Selected audio"), audioEntry?.label || ""],
        [
          t("player_stats_dropped", {}, "Dropped frames"),
          Number.isFinite(Number(quality?.droppedVideoFrames)) ? String(quality.droppedVideoFrames) : ""
        ]
      ].filter(([, value]) => value);
      const markup = `<div class="player-stats-title">${escapeHtml(t("player_stats_title", {}, "Playback stats"))}</div>${rows
        .map(
          ([label, value]) => `<div class="player-stats-row"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`
        )
        .join("")}`;
      if (node.innerHTML !== markup) node.innerHTML = markup;
    },
    syncPlayerStreamMetadata() {
      const node = this.uiRefs?.streamMetadata;
      if (!node || !Environment.isWebOS()) {
        return;
      }
      const now = Date.now();
      const sourceKey = `${this.currentStreamIndex}:${this.activePlaybackUrl || ""}`;
      if (sourceKey === this.playerStreamMetadataSourceKey && now - Number(this.playerStreamMetadataCheckedAt || 0) < 1500) {
        return;
      }
      this.playerStreamMetadataSourceKey = sourceKey;
      this.playerStreamMetadataCheckedAt = now;

      let avPlayDimensions = null;
      if (typeof PlayerController.isUsingAvPlay === "function" && PlayerController.isUsingAvPlay()) {
        try {
          avPlayDimensions = PlayerController.getAvPlayVideoDimensions?.() || null;
        } catch (_) {
          avPlayDimensions = null;
        }
      }
      const { resolution, sizeBytes } = getPlayerStreamMetadata({
        video: PlayerController.video,
        avPlayDimensions,
        candidate: this.getCurrentStreamCandidate(),
        fallbackSize: this.params?.videoSize
      });
      const chips = [resolution, formatBytes(sizeBytes)].filter(Boolean);
      const signature = chips.join("|");
      if (signature !== this.playerStreamMetadataSignature) {
        node.innerHTML = chips.map((label) => `<span class="player-stream-metadata-chip">${escapeHtml(label)}</span>`).join("");
        node.classList.toggle("hidden", !chips.length);
        this.playerStreamMetadataSignature = signature;
      }
    },
    updateUiTick() {
      if (this.isExternalFrameMode()) {
        return;
      }
      this.syncPlayerStreamSource();
      this.syncPlayerStreamMetadata();
      this.updatePlaybackStatsOverlay();
      this.ensureNextEpisodeStreamsPrefetch();
      this.shouldShowNextEpisodeCard();
      void this.refreshLoadingOverlayProgress();
      const current = this.getPlaybackCurrentSeconds();
      this.updateActiveSkipInterval(current);
      this.updateSkipIntroCountdown(Date.now());
      const duration = this.getPlaybackDurationSeconds();
      this.evaluatePostPlayRecommendation();
      const effectiveProgressSeconds =
        this.controlsVisible && this.controlFocusZone === "progress" && this.seekPreviewSeconds != null
          ? Number(this.seekPreviewSeconds)
          : current;
      const progress = duration > 0 ? clamp(effectiveProgressSeconds / duration, 0, 1) : 0;
      const uiRefs = this.uiRefs || {};
      const uiState = this.lastUiTickState || (this.lastUiTickState = {});
      const progressBuffered = uiRefs.progressBuffered;
      if (progressBuffered) {
        const bufferedSeconds = this.getPlaybackBufferedSeconds();
        const bufferedVisible = Number.isFinite(bufferedSeconds) && duration > 0 && bufferedSeconds > current + 0.25;
        const bufferedProgress = bufferedVisible ? clamp(bufferedSeconds / duration, 0, 1) : 0;
        const nextBufferedWidth = `${Math.round(bufferedProgress * 10000) / 100}%`;
        if (uiState.bufferedWidth !== nextBufferedWidth) {
          progressBuffered.style.width = nextBufferedWidth;
          uiState.bufferedWidth = nextBufferedWidth;
        }
        if (uiState.bufferedVisible !== bufferedVisible) {
          progressBuffered.classList.toggle("is-visible", bufferedVisible);
          uiState.bufferedVisible = bufferedVisible;
        }
      }
      const progressFill = uiRefs.progressFill;
      if (progressFill) {
        const nextWidth = `${Math.round(progress * 10000) / 100}%`;
        if (uiState.progressWidth !== nextWidth) {
          progressFill.style.width = nextWidth;
          uiState.progressWidth = nextWidth;
        }
      }
      this.syncSkipIntroButtonProgress();
      this.renderSkipIntroButton();
      this.syncPlayerOverlayLayoutState();
      this.renderBitmapSubtitleAtCurrentTime();
      this.maybeAutoplayNextEpisode();

      const clock = uiRefs.clock;
      if (clock) {
        const now = new Date();
        const nextClockMinuteKey = `${now.getHours()}:${now.getMinutes()}`;
        if (uiState.clockMinuteKey !== nextClockMinuteKey) {
          const nextClockText = formatClock(now, this.webOsClockLocaleInfo);
          clock.textContent = nextClockText;
          uiState.clockText = nextClockText;
          uiState.clockMinuteKey = nextClockMinuteKey;
        }
      }

      const endsAt = uiRefs.endsAt;
      if (endsAt) {
        const isLivePlayback =
          typeof PlayerController.isLivePlaybackItemType === "function" && Boolean(PlayerController.isLivePlaybackItemType());
        const playbackSpeed = this.getPlaybackSpeed();
        // Keep this clock based on the full media duration. Outro intervals are
        // handled independently by skip/autoplay, as they are on Android TV.
        const remainingMs = isLivePlayback ? null : calculateRemainingPlaybackMilliseconds(current, duration, playbackSpeed);
        const nextEndsAtMinuteBucket = remainingMs == null ? -1 : Math.floor((Date.now() + remainingMs) / 60000);
        endsAt.classList.toggle("hidden", isLivePlayback);
        if (uiState.endsAtMinuteBucket !== nextEndsAtMinuteBucket) {
          const nextEndsAtText = isLivePlayback
            ? ""
            : t("player_ends_at", [formatEndsAt(current, duration, this.webOsClockLocaleInfo, playbackSpeed)], "Ends at %1$s");
          endsAt.textContent = nextEndsAtText;
          uiState.endsAtText = nextEndsAtText;
          uiState.endsAtMinuteBucket = nextEndsAtMinuteBucket;
        }
      }

      if (this.pauseOverlayVisible) {
        const overlayClock = this.uiRefs?.pauseOverlay?.querySelector(".player-pause-overlay-clock");
        if (overlayClock && overlayClock.textContent !== uiState.clockText) {
          overlayClock.textContent = uiState.clockText || "--:--";
        }
        const overlayEndsAt = this.uiRefs?.pauseOverlay?.querySelector(".player-pause-overlay-ends-at");
        if (overlayEndsAt && overlayEndsAt.textContent !== uiState.endsAtText) {
          overlayEndsAt.textContent = uiState.endsAtText || t("player_ends_at", ["--:--"], "Ends at %1$s");
        }
      }

      const timeLabel = uiRefs.timeLabel;
      const elapsedText = formatTime(effectiveProgressSeconds);
      const durationText = formatTime(duration);
      if (timeLabel) {
        const nextTimeLabel = `${elapsedText} / ${durationText}`;
        if (uiState.timeLabelText !== nextTimeLabel) {
          timeLabel.textContent = nextTimeLabel;
          uiState.timeLabelText = nextTimeLabel;
        }
      }
      const displayElapsedText = formatPlayerTime(effectiveProgressSeconds);
      if (uiRefs.timeElapsed && uiRefs.timeElapsed.textContent !== displayElapsedText) {
        uiRefs.timeElapsed.textContent = displayElapsedText;
      }
      const remainingText =
        Number.isFinite(duration) && duration > 0 ? `-${formatPlayerTime(Math.max(0, duration - effectiveProgressSeconds))}` : "";
      if (uiRefs.timeRemaining && uiRefs.timeRemaining.textContent !== remainingText) {
        uiRefs.timeRemaining.textContent = remainingText;
      }

      this.syncPauseOverlayState();
      this.renderNextEpisodeCard();

      if (this.seekOverlayVisible && this.seekPreviewSeconds == null) {
        this.renderSeekOverlay();
      }
    },
    renderSeekOverlay() {
      const overlay = this.uiRefs?.seekOverlay;
      const directionNode = this.uiRefs?.seekDirection;
      const previewNode = this.uiRefs?.seekPreview;
      const fillNode = this.uiRefs?.seekFill;
      if (!overlay || !directionNode || !previewNode || !fillNode) {
        return;
      }

      const duration = this.getPlaybackDurationSeconds();
      const currentPreview = this.seekPreviewSeconds != null ? Number(this.seekPreviewSeconds) : this.getPlaybackCurrentSeconds();

      const shouldShowOverlay = this.seekOverlayVisible && !this.controlsVisible;
      overlay.classList.toggle("hidden", !shouldShowOverlay);
      const uiState = this.lastUiTickState || (this.lastUiTickState = {});
      const nextPreviewText = `${formatTime(currentPreview)} / ${formatTime(duration)}`;
      const nextDirectionText = this.seekPreviewDirection < 0 ? "<<" : this.seekPreviewDirection > 0 ? ">>" : "";
      if (uiState.seekPreviewText !== nextPreviewText) {
        previewNode.textContent = nextPreviewText;
        uiState.seekPreviewText = nextPreviewText;
      }
      if (uiState.seekDirectionText !== nextDirectionText) {
        directionNode.textContent = nextDirectionText;
        uiState.seekDirectionText = nextDirectionText;
      }

      const percent = duration > 0 ? clamp(currentPreview / duration, 0, 1) : 0;
      const nextSeekWidth = `${Math.round(percent * 10000) / 100}%`;
      if (uiState.seekWidth !== nextSeekWidth) {
        fillNode.style.width = nextSeekWidth;
        uiState.seekWidth = nextSeekWidth;
      }
    },
    beginSeekPreview(direction, isRepeat = false) {
      if (!this.isSeekBarAvailable()) {
        return;
      }
      const currentTime = this.getPlaybackCurrentSeconds();
      if (Number.isNaN(currentTime)) {
        return;
      }

      if (direction !== this.seekPreviewDirection || !isRepeat) {
        this.seekRepeatCount = 0;
      }
      this.seekPreviewDirection = direction;
      this.seekRepeatCount += 1;

      const deltaSeconds = deltaMsForKeyRepeat(this.seekRepeatCount - 1, direction > 0) / 1000;
      const duration = this.getPlaybackDurationSeconds();
      const base = this.seekPreviewSeconds == null ? currentTime : Number(this.seekPreviewSeconds);
      let next = base + deltaSeconds;
      if (duration > 0) {
        next = clamp(next, 0, duration);
      } else {
        next = Math.max(0, next);
      }

      this.seekPreviewSeconds = next;
      this.seekOverlayVisible = !this.controlsVisible;
      this.renderSeekOverlay();

      if (this.seekOverlayTimer) {
        clearTimeout(this.seekOverlayTimer);
        this.seekOverlayTimer = null;
      }

      this.scheduleSeekPreviewCommit();
    },
    scheduleSeekPreviewCommit() {
      if (this.seekCommitTimer) {
        clearTimeout(this.seekCommitTimer);
      }
      this.seekCommitTimer = setTimeout(() => {
        this.commitSeekPreview();
      }, 1000);
    },
    commitSeekPreview() {
      if (!PlayerController.video) {
        this.cancelSeekPreview({ commit: false });
        return;
      }

      if (this.seekPreviewSeconds != null) {
        this.suppressControlsForHiddenSeek();
        this.seekPlaybackSeconds(Number(this.seekPreviewSeconds));
      }

      if (this.stickyProgressFocus && this.controlsVisible) {
        this.focusProgressBar();
        this.scheduleProgressBarRefocus();
      }

      this.seekPreviewSeconds = null;
      this.seekRepeatCount = 0;
      if (this.seekCommitTimer) {
        clearTimeout(this.seekCommitTimer);
        this.seekCommitTimer = null;
      }

      this.seekOverlayVisible = !this.controlsVisible;
      this.renderSeekOverlay();

      if (this.seekOverlayTimer) {
        clearTimeout(this.seekOverlayTimer);
      }
      this.seekOverlayTimer = setTimeout(() => {
        this.seekOverlayVisible = false;
        this.seekPreviewDirection = 0;
        this.renderSeekOverlay();
        if (this.autoHideControlsAfterSeek && this.controlsVisible) {
          this.autoHideControlsAfterSeek = false;
          this.stickyProgressFocus = false;
          this.setControlsVisible(false);
          return;
        }
        if (this.stickyProgressFocus && this.controlsVisible) {
          this.focusProgressBar();
          this.scheduleProgressBarRefocus();
        }
        this.resetControlsAutoHide();
      }, 700);
    },
    cancelSeekPreview({ commit = false } = {}) {
      if (commit) {
        this.commitSeekPreview();
        return;
      }

      if (this.seekCommitTimer) {
        clearTimeout(this.seekCommitTimer);
        this.seekCommitTimer = null;
      }
      if (this.seekOverlayTimer) {
        clearTimeout(this.seekOverlayTimer);
        this.seekOverlayTimer = null;
      }

      this.seekPreviewSeconds = null;
      this.seekPreviewDirection = 0;
      this.seekRepeatCount = 0;
      this.seekOverlayVisible = false;
      this.autoHideControlsAfterSeek = false;
      this.seekOverlaySuppressControlsUntil = 0;
      this.renderSeekOverlay();
    },
    togglePause({ focusControls = true } = {}) {
      const preserveProgressFocus = this.controlFocusZone === "progress";
      if (this.isExternalFrameMode()) {
        return;
      }
      if (this.paused) {
        this.dismissPauseOverlay();
        PlayerController.resume();
        this.paused = false;
        this.updateMediaSessionPlaybackState();
        this.setControlsVisible(true, { focus: false });
        if (preserveProgressFocus) {
          this.controlFocusZone = "progress";
        }
        this.renderControlButtons();
        return;
      }

      PlayerController.pause();
      this.paused = true;
      this.updateMediaSessionPlaybackState();
      if (!focusControls && !preserveProgressFocus) {
        this.controlFocusZone = "";
      }
      this.setControlsVisible(true, { focus: focusControls && !preserveProgressFocus });
      if (preserveProgressFocus) {
        this.controlFocusZone = "progress";
      }
      this.renderControlButtons();
      this.schedulePauseOverlay();
    }
  };
}
