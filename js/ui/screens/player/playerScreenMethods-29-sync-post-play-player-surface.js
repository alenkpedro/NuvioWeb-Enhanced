/* eslint-disable no-unused-vars */
import * as internals from "./playerScreenContext.js";

export function createPlayerScreenMethods29() {
  const { PlayerController, Environment, STARTUP_PLAYBACK_ADVANCE_EPSILON_SECONDS, BUFFERING_SPINNER_STALL_MS, interpolatePostPlayRect } =
    internals;

  return {
    syncPostPlayPlayerSurface(state = this.getPostPlayState()) {
      if (!Environment.isTizen() || !PlayerController.isUsingAvPlay?.()) {
        return;
      }
      const avPlayObject = document.getElementById("avPlayerObject");
      const viewport = PlayerController.getAvPlayViewportSize?.() || {
        width: 1920,
        height: 1080
      };
      const viewportWidth = Math.max(1, Math.round(Number(viewport.width || 1920)));
      const viewportHeight = Math.max(1, Math.round(Number(viewport.height || 1080)));
      const isTrailerSurfaceHidden = Boolean(state.isVisible && (state.isTrailerPlaying || state.hasAutoPlayedTrailer));
      const isMiniSurface = Boolean(state.isVisible && !isTrailerSurfaceHidden);
      const surfaceMode = isTrailerSurfaceHidden ? "hidden" : isMiniSurface ? "mini" : "normal";
      const key = `${surfaceMode}:${viewportWidth}x${viewportHeight}:${document.documentElement?.dir || "ltr"}`;
      if (key === this.postPlayNativeSurfaceStateKey) {
        return;
      }
      this.postPlayNativeSurfaceStateKey = key;
      this.cancelPostPlayNativeSurfaceAnimation();
      const fullRect = {
        x: 0,
        y: 0,
        width: viewportWidth,
        height: viewportHeight
      };
      if (avPlayObject?.style) {
        avPlayObject.style.visibility = isTrailerSurfaceHidden ? "hidden" : "visible";
      }

      if (surfaceMode === "hidden") {
        // The Android implementation releases the player surface while the
        // trailer owns the screen. Keep the native surface out of the way and
        // reset its geometry so a later lifecycle cannot resurrect a stale mini
        // rectangle.
        this.postPlayNativeSurfaceRect = fullRect;
        PlayerController.setAvPlayDisplayRect?.(fullRect, "PLAYER_DISPLAY_MODE_FULL_SCREEN");
        return;
      }

      const video = PlayerController.video;
      if (video?.style) {
        // Tizen's AVPlay object is the visible surface; the HTML video element
        // still needs the same fullscreen box when the mini-window is restored.
        video.style.position = "fixed";
        video.style.left = "0px";
        video.style.top = "0px";
        video.style.right = "auto";
        video.style.bottom = "auto";
        video.style.width = "100vw";
        video.style.height = "100vh";
        video.style.maxWidth = "100vw";
        video.style.maxHeight = "100vh";
        video.style.objectFit = "fill";
        video.style.transform = "none";
      }

      const targetRect = { ...fullRect };
      if (surfaceMode === "mini") {
        const cssViewportWidth = Math.max(1, Number(window.innerWidth || viewportWidth));
        const scale = viewportWidth / cssViewportWidth;
        const gutter = Math.max(0, Math.round(32 * scale));
        const width = Math.min(viewportWidth, Math.max(1, Math.round(cssViewportWidth * 0.32 * scale)));
        targetRect.width = width;
        targetRect.height = Math.min(viewportHeight, Math.max(1, Math.round(width * (9 / 16))));
        targetRect.x = document.documentElement?.dir === "rtl" ? gutter : Math.max(0, viewportWidth - width - gutter);
        targetRect.y = gutter;
      }

      const currentRect = this.postPlayNativeSurfaceRect || PlayerController.avplayDisplayRect || fullRect;
      const sameRect = ["x", "y", "width", "height"].every((keyName) => Number(currentRect[keyName]) === Number(targetRect[keyName]));
      if (sameRect) {
        this.postPlayNativeSurfaceRect = { ...targetRect };
        PlayerController.setAvPlayDisplayRect?.(targetRect, "PLAYER_DISPLAY_MODE_FULL_SCREEN");
        return;
      }

      const startedAt = typeof globalThis.performance?.now === "function" ? globalThis.performance.now() : Date.now();
      const schedule = (callback) => {
        if (typeof requestAnimationFrame === "function") {
          this.postPlayNativeSurfaceAnimationUsesRaf = true;
          return requestAnimationFrame(callback);
        }
        this.postPlayNativeSurfaceAnimationUsesRaf = false;
        return setTimeout(callback, 16);
      };
      const applyRect = (rect) => {
        this.postPlayNativeSurfaceRect = { ...rect };
        PlayerController.setAvPlayDisplayRect?.(rect, "PLAYER_DISPLAY_MODE_FULL_SCREEN");
      };
      const animate = () => {
        if (this.postPlayNativeSurfaceStateKey !== key) {
          return;
        }
        const now = typeof globalThis.performance?.now === "function" ? globalThis.performance.now() : Date.now();
        const progress = Math.max(0, Math.min(1, (now - startedAt) / 420));
        applyRect(interpolatePostPlayRect(currentRect, targetRect, progress));
        if (progress >= 1) {
          this.postPlayNativeSurfaceAnimationFrame = null;
          return;
        }
        this.postPlayNativeSurfaceAnimationFrame = schedule(animate);
      };
      animate();
    },
    measurePlayerActionOverlayOffset() {
      const root = this.uiRefs?.root;
      const controlsBottom = this.uiRefs?.controlsBottom;
      if (!root || !controlsBottom || !this.controlsVisible || this.isExternalFrameMode()) {
        return null;
      }

      const rootRect = root.getBoundingClientRect?.();
      const controlsRect = controlsBottom.getBoundingClientRect?.();
      if (!rootRect || !controlsRect) {
        return null;
      }

      const rootBottom = Number(rootRect.bottom);
      const controlsTop = Number(controlsRect.top);
      const rootHeight = Number(rootRect.height);
      if (!Number.isFinite(rootBottom) || !Number.isFinite(controlsTop) || !Number.isFinite(rootHeight) || rootHeight <= 0) {
        return null;
      }

      const controlsHeightFromBottom = Math.max(0, rootBottom - controlsTop);
      const safetyGap = Math.max(18, Math.min(48, rootHeight * 0.03));
      return Math.ceil(controlsHeightFromBottom + safetyGap);
    },
    syncPlayerActionOverlayOffset() {
      const root = this.uiRefs?.root;
      if (!root) {
        return;
      }

      if (!this.controlsVisible || this.isExternalFrameMode()) {
        root.style.removeProperty("--player-action-controls-open-bottom");
        this.lastActionOverlayBottomPx = null;
        return;
      }

      const measuredBottom = this.measurePlayerActionOverlayOffset();
      if (!Number.isFinite(measuredBottom) || measuredBottom <= 0) {
        return;
      }
      if (Math.abs(Number(this.lastActionOverlayBottomPx || 0) - measuredBottom) < 1) {
        return;
      }

      this.lastActionOverlayBottomPx = measuredBottom;
      root.style.setProperty("--player-action-controls-open-bottom", `${measuredBottom}px`);
    },
    setControlsVisible(visible, { focus = false } = {}) {
      const wasControlsVisible = this.controlsVisible;
      this.controlsVisible = Boolean(
        visible && (!this.container?.classList.contains("player-platform-webos") || this.hasPresentedPlaybackFrame)
      );
      this.syncPlayerStreamSource?.();
      if (this.isExternalFrameMode()) {
        return;
      }
      const overlay = this.uiRefs?.controlsOverlay;
      if (!overlay) {
        return;
      }
      overlay.classList.toggle("hidden", !this.controlsVisible);
      this.syncPlayerOverlayLayoutState();
      this.updateSkipIntroCountdown(Date.now());
      this.renderSkipIntroButton();
      if (this.controlsVisible) {
        this.renderControlButtons();
        if (focus) {
          this.focusFirstControl();
        }
        this.resetControlsAutoHide();
      } else {
        this.clearControlsAutoHide();
        // Android transfers focus to the visible next-episode overlay as part
        // of the same controls-hidden state update. Smart manages focus
        // manually, so waiting for the next playback tick leaves the DOM card
        // selected while the logical focus remains on the player root.
        if (wasControlsVisible) {
          this.renderNextEpisodeCard();
        }
        if (this.controlFocusZone === "nextEpisode" && this.isNextEpisodeCardFocusable()) {
          this.syncNextEpisodeCardFocusState();
        } else {
          this.focusPlayerRootForHiddenControls();
        }
      }
    },
    focusPlayerRootForHiddenControls() {
      if (this.isExternalFrameMode() || this.controlsVisible || this.isDialogOpen()) {
        return;
      }
      const root = this.uiRefs?.root;
      if (!root || typeof root.focus !== "function") {
        return;
      }
      try {
        root.focus({ preventScroll: true });
      } catch (_) {
        try {
          root.focus();
        } catch (_) {
          // Best effort on older TV engines.
        }
      }
    },
    focusFirstControl() {
      this.stickyProgressFocus = false;
      this.autoHideControlsAfterSeek = false;
      this.controlFocusZone = "buttons";
      this.controlFocusIndex = 0;
      this.syncControlFocusDom();
      const firstButton = this.container.querySelector(".player-control-btn[data-action]");
      firstButton?.focus?.();
    },
    focusProgressBar() {
      if (!this.isSeekBarAvailable()) {
        this.stickyProgressFocus = false;
        this.autoHideControlsAfterSeek = false;
        this.controlFocusZone = "buttons";
        this.syncControlFocusDom();
        return;
      }
      const activeElement = document.activeElement;
      if (activeElement && activeElement !== document.body && typeof activeElement.blur === "function") {
        activeElement.blur();
      }
      this.stickyProgressFocus = true;
      this.controlFocusZone = "progress";
      this.syncControlFocusDom();
      this.uiRefs?.progressShell?.focus?.();
      this.scheduleProgressBarRefocus();
    },
    scheduleProgressBarRefocus() {
      if (!this.controlsVisible || this.controlFocusZone !== "progress") {
        return;
      }
      const run = () => {
        if (!this.controlsVisible || this.controlFocusZone !== "progress") {
          return;
        }
        const buttons = Array.from(this.uiRefs?.controlButtons?.querySelectorAll?.(".player-control-btn") || []);
        buttons.forEach((button) => {
          button.classList.remove("focused");
          if (typeof button.blur === "function") {
            button.blur();
          }
        });
        this.uiRefs?.progressShell?.classList?.add("focused");
        this.uiRefs?.progressShell?.focus?.();
      };
      run();
      if (typeof requestAnimationFrame === "function") {
        requestAnimationFrame(run);
      }
      setTimeout(run, 0);
    },
    isStartupLoadingVisible() {
      return Boolean(this.loadingVisible && !this.hasPresentedPlaybackFrame);
    },
    isBufferingSpinnerVisible() {
      if (this.seekLoading) {
        if (this.isStartupLoadingVisible()) {
          return false;
        }
        return !this.isExternalFrameMode() && !this.isStartupErrorVisible();
      }
      if (
        (!this.loadingVisible && !this.bufferingActive) ||
        !this.hasPresentedPlaybackFrame ||
        this.isExternalFrameMode() ||
        this.isStartupErrorVisible()
      ) {
        return false;
      }
      const currentSeconds = Number(this.getPlaybackCurrentSeconds());
      const baselineSeconds = Number(this.bufferingSpinnerBaselineSeconds);
      if (Number.isFinite(currentSeconds) && Number.isFinite(baselineSeconds)) {
        if (currentSeconds > baselineSeconds + STARTUP_PLAYBACK_ADVANCE_EPSILON_SECONDS) {
          return false;
        }
      }
      const stalledForMs = Date.now() - Number(this.lastPlaybackProgressAt || 0);
      return stalledForMs >= BUFFERING_SPINNER_STALL_MS;
    },
    isSeekBarAvailable() {
      return !this.loadingVisible || this.hasPresentedPlaybackFrame || this.seekLoading;
    },
    isSeekOverlaySuppressingControls() {
      return Date.now() < Number(this.seekOverlaySuppressControlsUntil || 0);
    },
    suppressControlsForHiddenSeek(durationMs = 2500) {
      if (this.controlsVisible) {
        return;
      }
      this.seekOverlaySuppressControlsUntil = Math.max(
        Number(this.seekOverlaySuppressControlsUntil || 0),
        Date.now() + Math.max(0, Number(durationMs || 0))
      );
    },
    clearLoadingCompletionTimer() {
      if (this.loadingCompletionTimer) {
        clearTimeout(this.loadingCompletionTimer);
        this.loadingCompletionTimer = null;
      }
    },
    clearBufferingSpinnerTimer() {
      if (this.bufferingSpinnerTimer) {
        clearTimeout(this.bufferingSpinnerTimer);
        this.bufferingSpinnerTimer = null;
      }
    }
  };
}
