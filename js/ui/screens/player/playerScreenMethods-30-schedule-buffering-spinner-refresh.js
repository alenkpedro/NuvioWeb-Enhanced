/* eslint-disable no-unused-vars */
import * as internals from "./playerScreenContext.js";

export function createPlayerScreenMethods30() {
  const {
    PlayerController,
    canReleasePlayingNativeStartupAudioGate,
    Environment,
    STARTUP_PLAYBACK_ADVANCE_EPSILON_SECONDS,
    BUFFERING_SPINNER_STALL_MS,
    PLAYER_SPEEDS
  } = internals;

  return {
    scheduleBufferingSpinnerRefresh(delayMs = BUFFERING_SPINNER_STALL_MS) {
      this.clearBufferingSpinnerTimer();
      if (
        (!this.loadingVisible && !this.bufferingActive) ||
        !this.hasPresentedPlaybackFrame ||
        this.isExternalFrameMode() ||
        this.isStartupErrorVisible()
      ) {
        return;
      }
      this.bufferingSpinnerTimer = setTimeout(
        () => {
          this.bufferingSpinnerTimer = null;
          if (
            (!this.loadingVisible && !this.bufferingActive) ||
            !this.hasPresentedPlaybackFrame ||
            this.isExternalFrameMode() ||
            this.isStartupErrorVisible()
          ) {
            return;
          }
          this.updateLoadingVisibility();
        },
        Math.max(0, Number(delayMs || 0))
      );
    },
    enableStartupAudioGate({ allowNativePlayback = false, maxWaitMs = 0 } = {}) {
      this.startupAudioGateActive = true;
      this.startupAudioGateAllowsNativePlayback = Boolean(allowNativePlayback);
      const boundedWaitMs = Math.max(0, Number(maxWaitMs || 0));
      this.startupAudioGateDeadline = boundedWaitMs > 0 ? Date.now() + boundedWaitMs : 0;
      PlayerController.setStartupAudioGate?.(true, {
        pauseNativePlayback: !allowNativePlayback
      });
    },
    releaseStartupAudioGate({ resume = true } = {}) {
      if (!this.startupAudioGateActive) {
        return;
      }
      this.startupAudioGateActive = false;
      this.startupAudioGateAllowsNativePlayback = false;
      this.startupAudioGateDeadline = 0;
      // Once playback leaves the startup gate, later webOS track-list churn must
      // not reopen automatic language matching. A Luna selectTrack request during
      // normal playback can interrupt the native decoder on some LG TVs.
      this.startupAudioFallbackApplied = false;
      this.startupAudioTrackSetSignature = "";
      PlayerController.setStartupAudioGate?.(false, { resume });
    },
    isPlaybackStartupSettled() {
      if (!this.hasPresentedPlaybackFrame || this.pendingPlaybackRestore || this.startupAudioGateActive) {
        return false;
      }
      return true;
    },
    hasStartupPlaybackAdvanced(currentSeconds = this.getPlaybackCurrentSeconds()) {
      if (this.startupPlaybackHasAdvanced) {
        return true;
      }
      if (this.pendingPlaybackRestore) {
        this.startupPlaybackBaselineSeconds = null;
        return false;
      }
      const current = Number(currentSeconds);
      if (!Number.isFinite(current) || current < 0) {
        return false;
      }
      const baseline = Number(this.startupPlaybackBaselineSeconds);
      if (!Number.isFinite(baseline)) {
        this.startupPlaybackBaselineSeconds = current;
        return false;
      }
      if (current < baseline - 0.25) {
        this.startupPlaybackBaselineSeconds = current;
        return false;
      }
      if (current - baseline >= STARTUP_PLAYBACK_ADVANCE_EPSILON_SECONDS) {
        this.startupPlaybackHasAdvanced = true;
        return true;
      }
      return false;
    },
    markPlaybackPresentedAfterAdvance(currentSeconds = this.getPlaybackCurrentSeconds()) {
      if (this.hasPresentedPlaybackFrame) {
        return true;
      }
      if (!this.hasStartupPlaybackAdvanced(currentSeconds)) {
        return false;
      }
      this.hasPresentedPlaybackFrame = true;
      this.beginPlaybackEngineValidation();
      this.warmBitmapSubtitleSharedResources();
      if (!this.startupTrackPreferenceReady) {
        // Some P2P / engineFs startups expose tracks before the first real frame
        // is presented. Re-run the startup track pass once playback is actually live.
        this.startupTrackPreferenceReady = true;
        this.refreshTrackDialogs();
      }
      this.setLoadingLogoFillTarget(1, { immediate: true });
      if (this.isStartupGateReleaseReady()) {
        this.releaseStartupAudioGate();
      }
      this.clearPlaybackStallGuard();
      return true;
    },
    isStartupLogoDismissReady() {
      return Boolean(
        this.hasPresentedPlaybackFrame && this.startupPlaybackHasAdvanced && !this.pendingPlaybackRestore && !this.startupAudioGateActive
      );
    },
    presentStartedPlayback() {
      const overlay = this.uiRefs?.loadingOverlay;
      overlay?.classList.add("playback-ready");
      this.loadingVisible = false;
      this.updateLoadingVisibility();
      if (Environment.isWebOS()) {
        this.setControlsVisible(true, { focus: false });
      }
      PlayerController.setStartupPresentationAudioMuted?.(false);
      setTimeout(() => overlay?.classList.remove("playback-ready"), 250);
      this.updateUiTick();
      setTimeout(() => this.maybeShowParentalGuideOverlay(), 80);
    },
    isStartupGateReleaseReady() {
      if (!this.startupAudioGateActive) {
        return false;
      }
      const readyState =
        typeof PlayerController.getPlaybackReadyState === "function"
          ? Number(PlayerController.getPlaybackReadyState() || 0)
          : Number(PlayerController.video?.readyState || 0);
      const gateDeadlineExpired =
        Number(this.startupAudioGateDeadline || 0) > 0 && Date.now() >= Number(this.startupAudioGateDeadline || 0);
      if (
        canReleasePlayingNativeStartupAudioGate({
          allowNativePlayback: this.startupAudioGateAllowsNativePlayback,
          hasPresentedPlaybackFrame: this.hasPresentedPlaybackFrame,
          pendingAudioSelection: Boolean(this.pendingWebOsAudioSelection),
          readyState
        })
      ) {
        if (!this.startupAudioPreferenceApplied) {
          this.applyStartupAudioFallback();
        }
        return Boolean(this.startupAudioPreferenceApplied) && !this.pendingWebOsAudioSelection;
      }
      if (gateDeadlineExpired && !this.pendingWebOsAudioSelection) {
        if (!this.startupAudioPreferenceApplied) {
          this.applyStartupAudioFallback();
        }
        return Boolean(this.startupAudioPreferenceApplied) && Number.isFinite(readyState) && readyState >= 2;
      }
      if (this.pendingPlaybackRestore) {
        return false;
      }
      const audioPreferenceSettled =
        !this.pendingWebOsAudioSelection &&
        (Boolean(this.startupAudioPreferenceApplied) ||
          (!Environment.isWebOS() && !this.startupAudioPreferenceApplying && !this.hasAudioTracksAvailable()));
      return audioPreferenceSettled && Number.isFinite(readyState) && readyState >= 3;
    },
    scheduleLoadingCompletionCheck(delayMs = 250, { force = false } = {}) {
      this.clearLoadingCompletionTimer();
      if (!this.loadingVisible || this.isExternalFrameMode()) {
        return;
      }
      this.loadingCompletionTimer = setTimeout(
        () => {
          this.loadingCompletionTimer = null;
          if (!this.loadingVisible || this.isExternalFrameMode()) {
            return;
          }
          if (this.isStartupGateReleaseReady()) {
            this.releaseStartupAudioGate();
            this.scheduleLoadingCompletionCheck(120, { force: true });
            return;
          }
          const fillProgress = Number(this.loadingLogoFillProgress || 0);
          if (fillProgress >= 1 && !this.isPlaybackStartupSettled()) {
            this.markPlaybackPresentedAfterAdvance();
            if (this.isStartupLogoDismissReady()) {
              this.presentStartedPlayback();
              return;
            }
            this.updateUiTick();
            this.scheduleLoadingCompletionCheck(180, { force: true });
            return;
          }
          if (!force && !this.isPlaybackStartupSettled()) {
            this.scheduleLoadingCompletionCheck(250);
            return;
          }
          if (this.loadingProgress != null && fillProgress < 1) {
            this.loadingProgress = 1;
            this.setLoadingLogoFillTarget(1);
            this.scheduleLoadingCompletionCheck(180, { force: true });
            return;
          }
          if (!this.markPlaybackPresentedAfterAdvance()) {
            this.scheduleLoadingCompletionCheck(120, { force: true });
            return;
          }
          const currentFillProgress = Number(this.loadingLogoFillProgress || 0);
          const currentFillTarget = Number(this.loadingLogoFillTarget || 0);
          if (currentFillTarget >= 1 && currentFillProgress < 0.995) {
            this.scheduleLoadingCompletionCheck(120, { force: true });
            return;
          }
          this.presentStartedPlayback();
        },
        Math.max(0, Number(delayMs || 0))
      );
    },
    clearControlsAutoHide() {
      if (this.controlsHideTimer) {
        clearTimeout(this.controlsHideTimer);
        this.controlsHideTimer = null;
      }
    },
    resetControlsAutoHide() {
      this.clearControlsAutoHide();
      if (!this.controlsVisible || this.paused || this.isDialogOpen() || this.seekOverlayVisible) {
        return;
      }
      this.controlsHideTimer = setTimeout(() => {
        this.setControlsVisible(false);
      }, 4200);
    },
    getPlaybackCurrentSeconds() {
      if (typeof PlayerController.getCurrentTimeSeconds === "function") {
        return Number(PlayerController.getCurrentTimeSeconds() || 0);
      }
      return Number(PlayerController.video?.currentTime || 0);
    },
    getPlaybackDurationSeconds() {
      if (typeof PlayerController.getDurationSeconds === "function") {
        return Number(PlayerController.getDurationSeconds() || 0);
      }
      return Number(PlayerController.video?.duration || 0);
    },
    getPlaybackBufferedSeconds() {
      if (typeof PlayerController.getBufferedTimeSeconds !== "function") {
        return null;
      }
      const bufferedSeconds = PlayerController.getBufferedTimeSeconds();
      return bufferedSeconds == null ? null : Number(bufferedSeconds);
    },
    getPlaybackSpeed() {
      if (typeof PlayerController.getPlaybackRate === "function") {
        return Number(PlayerController.getPlaybackRate() || 1);
      }
      return Number(PlayerController.video?.playbackRate || 1);
    },
    getPlaybackSpeedOptions() {
      if (typeof PlayerController.getSupportedPlaybackRates === "function") {
        const speeds = PlayerController.getSupportedPlaybackRates();
        if (Array.isArray(speeds) && speeds.length) {
          return speeds;
        }
      }
      return PLAYER_SPEEDS;
    },
    hasKnownPlaybackDuration() {
      const durationSeconds = Number(this.getPlaybackDurationSeconds() || 0);
      return Number.isFinite(durationSeconds) && durationSeconds > 0;
    },
    isPlaybackFrameReady() {
      const readyState =
        typeof PlayerController.getPlaybackReadyState === "function"
          ? Number(PlayerController.getPlaybackReadyState() || 0)
          : Number(PlayerController.video?.readyState || 0);
      return Number.isFinite(readyState) && readyState >= 2;
    },
    clearSeekLoading({ hideBuffering = false } = {}) {
      if (!this.seekLoading && this.seekLoadingBaselineSeconds == null && this.seekLoadingTargetSeconds == null) {
        return false;
      }
      this.seekLoading = false;
      this.bufferingActive = false;
      this.seekLoadingBaselineSeconds = null;
      this.seekLoadingTargetSeconds = null;
      if (hideBuffering && this.hasPresentedPlaybackFrame) {
        this.loadingVisible = false;
      }
      this.clearBufferingSpinnerTimer();
      this.updateLoadingVisibility();
      return true;
    },
    completeSeekLoadingIfReady() {
      if (!this.seekLoading || this.pendingPlaybackRestore || this.isStartupLoadingVisible()) {
        return false;
      }
      if (!this.isPlaybackFrameReady()) {
        return false;
      }
      return this.clearSeekLoading({ hideBuffering: true });
    },
    isEngineFsStartupReady() {
      if (!this.currentEngineFsStream) {
        return true;
      }
      const currentSeconds = Number(this.getPlaybackCurrentSeconds() || 0);
      return this.isPlaybackFrameReady() || (this.hasKnownPlaybackDuration() && Number.isFinite(currentSeconds) && currentSeconds > 0.2);
    },
    clearSkipIntroSeekSuppression() {
      this.skipIntroSuppressedKey = "";
      this.skipIntroSuppressedUntil = 0;
    }
  };
}
