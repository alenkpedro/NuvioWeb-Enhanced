/* eslint-disable no-unused-vars */
import * as internals from "./playerScreenContext.js";

export function createPlayerScreenMethods15() {
  const { PlayerController, PlayerSettingsStore, renderLoadingIndicator, t, escapeHtml, escapeAttribute } = internals;

  return {
    applyManifestTrackSelection({ audioTrackId, subtitleTrackId } = {}) {
      if (audioTrackId !== undefined) {
        this.selectedManifestAudioTrackId = audioTrackId;
      }
      if (subtitleTrackId !== undefined) {
        this.selectedManifestSubtitleTrackId = subtitleTrackId;
      }

      const selectedAudio = this.manifestAudioTracks.find((track) => track.id === this.selectedManifestAudioTrackId) || null;
      const selectedSubtitle = this.manifestSubtitleTracks.find((track) => track.id === this.selectedManifestSubtitleTrackId) || null;
      const variant = this.pickManifestVariant({
        audioGroupId: selectedAudio?.groupId || null,
        subtitleGroupId: selectedSubtitle ? selectedSubtitle.groupId || null : null
      });

      if (!variant?.uri) {
        this.refreshTrackDialogs();
        return;
      }

      const targetUrl = variant.uri;
      if (targetUrl === this.activePlaybackUrl) {
        this.refreshTrackDialogs();
        return;
      }

      const video = PlayerController.video;
      const restoreTimeSeconds = this.getPlaybackCurrentSeconds();
      const usingAvPlay = typeof PlayerController.isUsingAvPlay === "function" ? PlayerController.isUsingAvPlay() : false;
      const restorePaused = Boolean(this.paused || (!usingAvPlay && video?.paused));
      this.pendingPlaybackRestore = {
        timeSeconds: Number.isFinite(restoreTimeSeconds) ? restoreTimeSeconds : 0,
        paused: restorePaused,
        attempts: 0,
        lastAttemptAt: 0
      };

      this.activePlaybackUrl = targetUrl;
      const currentStreamCandidate = this.getCurrentStreamCandidate();
      this.paused = false;
      this.playbackRecoveryActive = false;
      this.playbackRecoveryAttempts = 0;
      this.resetPlaybackEngineValidation();
      this.hasPresentedPlaybackFrame = false;
      this.startupPlaybackBaselineSeconds = null;
      this.startupPlaybackHasAdvanced = false;
      this.loadingVisible = true;
      this.loadingProgress = null;
      this.loadingLogoFillActive = false;
      this.loadingLogoFillProgress = 0;
      this.loadingLogoFillTarget = 0;
      this.loadingTorrentStatus = "";
      this.torrentOverlayData = null;
      this.syncLoadingOverlayProgress();
      this.syncTorrentOverlay();
      this.updateLoadingVisibility();
      this.enableStartupAudioGate();
      this.startPlayerControllerPlayback(targetUrl, this.buildPlaybackContext(currentStreamCandidate), {
        sourceCandidate: currentStreamCandidate
      });
      this.schedulePlaybackStallGuard();
      this.setControlsVisible(true, { focus: false });
    },
    renderPlayerUi() {
      this.uiRefs = null;
      this.lastUiTickState = null;
      this.playerStreamMetadataSignature = null;
      this.playerStreamMetadataSourceKey = null;
      this.playerStreamMetadataCheckedAt = 0;
      this.container.querySelector("#playerUiRoot")?.remove();

      const root = document.createElement("div");
      root.id = "playerUiRoot";
      root.className = "player-ui-root";
      root.classList.toggle("player-awaiting-first-frame", !this.hasPresentedPlaybackFrame);
      root.tabIndex = -1;

      if (this.isExternalFrameMode()) {
        root.innerHTML = `
            <div class="player-external-frame-shell">
              <iframe
                class="player-external-frame"
                src="${escapeHtml(this.externalFrameUrl)}"
                title="${escapeHtml(this.params.playerTitle || "Trailer")}"
                allow="autoplay; encrypted-media; picture-in-picture"
                referrerpolicy="strict-origin-when-cross-origin"
                allowfullscreen
                scrolling="no"
              ></iframe>
            </div>
          `;
      } else {
        const header = this.getPlayerHeaderData();
        const loadingMeta = this.getLoadingOverlayMeta();
        const osdClockEnabled = Boolean(PlayerSettingsStore.get().osdClockEnabled);
        root.innerHTML = `
            <div id="playerLoadingOverlay" class="player-loading-overlay" role="status" aria-label="${escapeAttribute(t("player_loading_starting"))}">
              <div class="player-loading-backdrop"${loadingMeta.backdropUrl ? ` style="background-image:url('${loadingMeta.backdropUrl}')"` : ""}></div>
              <div class="player-loading-gradient"></div>
              <div class="player-loading-center">
                <div class="player-loading-identity-anchor">
                  <div class="player-loading-identity${loadingMeta.logoUrl ? " has-logo" : ""}">
                    ${
                      loadingMeta.logoUrl
                        ? `
                      <div class="player-loading-logo-stack">
                        <img class="player-loading-logo player-loading-logo-base" src="${escapeAttribute(loadingMeta.logoUrl)}" alt="${escapeAttribute(loadingMeta.title || "logo")}" />
                        <div class="player-loading-logo-fill-clip hidden">
                          <img class="player-loading-logo player-loading-logo-fill" src="${escapeAttribute(loadingMeta.logoUrl)}" alt="" aria-hidden="true" />
                        </div>
                      </div>
                    `
                        : ""
                    }
                    <div class="player-loading-title">${escapeHtml(loadingMeta.title || this.params.playerTitle || this.params.itemId || "Nuvio Enhanced")}</div>
                  </div>
                </div>
                <div class="player-loading-details">
                  <div class="player-loading-subtitle${loadingMeta.subtitle ? "" : " hidden"}">${escapeHtml(loadingMeta.subtitle || "")}</div>
                  <div class="player-loading-message">${escapeHtml(t("player_loading_starting"))}</div>
                  <div class="player-loading-source"></div>
                  ${renderLoadingIndicator({ className: "player-loading-startup-ring" })}
                  <div class="player-loading-status hidden"></div>
                </div>
              </div>
            </div>

            <div id="playerBufferingSpinner" class="player-loading-spinner hidden" aria-hidden="true">
              ${renderLoadingIndicator({ className: "player-loading-spinner-ring" })}
              <div class="player-loading-status player-loading-spinner-status hidden"></div>
            </div>

            <div id="playerStartupErrorOverlay" class="player-startup-error-overlay hidden" aria-hidden="true"></div>

            <div id="playerTorrentOverlay" class="player-torrent-overlay hidden" aria-hidden="true">
              <div class="player-torrent-overlay-row">
                <span class="player-torrent-overlay-tag">P2P</span>
                <span class="player-torrent-overlay-speed"></span>
              </div>
              <div class="player-torrent-overlay-detail"></div>
            </div>

            <div id="playerStatsOverlay" class="player-stats-overlay hidden" aria-live="off"></div>

            <div id="playerParentalGuide" class="player-parental-guide hidden"></div>
            <div id="playerSkipIntro" class="player-skip-intro hidden"></div>

            <div id="playerAspectToast" class="player-aspect-toast hidden"></div>

            <div id="playerHtmlSubtitles" class="player-html-subtitles hidden" aria-hidden="true"></div>
            <canvas id="playerBitmapSubtitles" class="player-bitmap-subtitles hidden" aria-hidden="true"></canvas>
            <div id="playerAssSubtitles" class="player-ass-subtitles hidden" aria-hidden="true"></div>

            <div id="playerSeekOverlay" class="player-seek-overlay hidden">
              <div class="player-seek-overlay-track"><div id="playerSeekFill" class="player-seek-fill"></div></div>
              <div class="player-seek-overlay-bottom">
                <span id="playerSeekDirection" class="player-seek-direction"></span>
                <span id="playerSeekPreview" class="player-seek-preview">0:00 / 0:00</span>
              </div>
            </div>

            <div id="playerPauseOverlay" class="player-pause-overlay hidden"></div>

            <div id="playerNextEpisodeCard" class="player-next-episode-card hidden"></div>

            <div id="playerPostPlayRecommendation" class="player-post-play-recommendation" aria-hidden="true"></div>

            <div id="playerModalBackdrop" class="player-modal-backdrop hidden"></div>
            <div id="playerSubtitleDialog" class="player-modal player-subtitle-modal hidden"></div>
            <div id="playerSubtitleDelayOverlay" class="player-subtitle-delay-overlay hidden"></div>
            <div id="playerSubtitleTimingDialog" class="player-subtitle-timing-modal hidden"></div>
            <div id="playerAudioDialog" class="player-modal player-audio-modal hidden"></div>
            <div id="playerSpeedDialog" class="player-modal player-speed-modal hidden"></div>
            <div id="playerSourcesPanel" class="player-sources-panel hidden"></div>

            <div id="playerControlsOverlay" class="player-controls-overlay">
              <div class="player-controls-gradient player-controls-gradient-top"></div>
              <div class="player-controls-gradient player-controls-gradient-bottom"></div>

              <div id="playerStreamMetadata" class="player-stream-metadata hidden" aria-label="${escapeAttribute(t("player_stream_metadata", {}, "Stream details"))}"></div>

              <div class="player-controls-top${osdClockEnabled ? "" : " hidden"}">
                <div id="playerClock" class="player-clock">--:--</div>
                <div id="playerEndsAt" class="player-ends-at">${escapeHtml(t("player_ends_at", ["--:--"], "Ends at %1$s"))}</div>
              </div>

              <div class="player-controls-bottom">
                <div class="player-meta">
                  <div class="player-artwork${header.logoUrl ? " has-logo" : ""}">
                    <img class="player-title-logo"${header.logoUrl ? ` src="${escapeAttribute(header.logoUrl)}"` : ""} alt="${escapeAttribute(header.title)}"${header.logoUrl ? "" : " hidden"} />
                    <div class="player-title">${escapeHtml(header.title)}</div>
                  </div>
                  ${header.subtitle ? `<div class="player-subtitle">${escapeHtml(header.subtitle)}</div>` : ""}
                  ${header.meta ? `<div class="player-meta-secondary">${escapeHtml(header.meta)}</div>` : ""}
                  <div id="playerStreamSource" class="player-meta-secondary player-stream-source hidden" aria-hidden="true"></div>
                </div>

                <div class="player-controls-bar">
                  <div id="playerProgressShell" class="player-progress-shell focusable" tabindex="-1" data-player-pointer-action="progress">
                    <div class="player-progress-track">
                      <div id="playerProgressBuffered" class="player-progress-buffered"></div>
                      <div id="playerProgressFill" class="player-progress-fill"></div>
                    </div>
                  </div>

                  <div class="player-time-row" aria-hidden="true">
                    <span id="playerTimeElapsed">0:00</span>
                    <span id="playerTimeRemaining">-0:00</span>
                  </div>

                  <div class="player-controls-row">
                    <div id="playerControlButtons" class="player-control-buttons"></div>
                    <div id="playerTimeLabel" class="player-time-label">0:00 / 0:00</div>
                  </div>
                </div>
              </div>
            </div>
          `;
      }

      this.container.appendChild(root);
      this.cachePlayerUiRefs(root);
      this.bindPlayerHeaderArtworkFallback();
      this.syncPlayerStreamSource();
      this.syncPlayerOverlayLayoutState();
      this.bindLoadingLogoFallback();
      if (!this.isExternalFrameMode()) {
        this.renderControlButtons();
        this.renderSubtitleDialog();
        this.renderSubtitleDelayOverlay();
        this.renderSubtitleTimingDialog();
        this.renderAudioDialog();
        this.renderSpeedDialog();
        this.renderSourcesPanel();
        this.renderParentalGuideOverlay();
        this.renderSkipIntroButton();
        this.renderSeekOverlay();
        this.renderPauseOverlay();
        this.renderNextEpisodeCard();
      }
    },
    cachePlayerUiRefs(root = null) {
      const uiRoot = root || this.container?.querySelector("#playerUiRoot");
      this.uiRefs = uiRoot
        ? {
            root: uiRoot,
            loadingOverlay: uiRoot.querySelector("#playerLoadingOverlay"),
            bufferingSpinner: uiRoot.querySelector("#playerBufferingSpinner"),
            startupErrorOverlay: uiRoot.querySelector("#playerStartupErrorOverlay"),
            torrentOverlay: uiRoot.querySelector("#playerTorrentOverlay"),
            torrentOverlaySpeed: uiRoot.querySelector("#playerTorrentOverlay .player-torrent-overlay-speed"),
            torrentOverlayDetail: uiRoot.querySelector("#playerTorrentOverlay .player-torrent-overlay-detail"),
            statsOverlay: uiRoot.querySelector("#playerStatsOverlay"),
            loadingIdentity: uiRoot.querySelector(".player-loading-identity"),
            loadingLogoStack: uiRoot.querySelector(".player-loading-logo-stack"),
            loadingLogoBase: uiRoot.querySelector(".player-loading-logo-base"),
            loadingLogoFillClip: uiRoot.querySelector(".player-loading-logo-fill-clip"),
            loadingLogoFill: uiRoot.querySelector(".player-loading-logo-fill"),
            loadingTitle: uiRoot.querySelector(".player-loading-title"),
            loadingSubtitle: uiRoot.querySelector(".player-loading-subtitle"),
            loadingSource: uiRoot.querySelector(".player-loading-source"),
            loadingStatus: uiRoot.querySelector("#playerLoadingOverlay .player-loading-status"),
            bufferingStatus: uiRoot.querySelector("#playerBufferingSpinner .player-loading-status"),
            parentalGuide: uiRoot.querySelector("#playerParentalGuide"),
            skipIntro: uiRoot.querySelector("#playerSkipIntro"),
            aspectToast: uiRoot.querySelector("#playerAspectToast"),
            htmlSubtitles: uiRoot.querySelector("#playerHtmlSubtitles"),
            assSubtitles: uiRoot.querySelector("#playerAssSubtitles"),
            bitmapSubtitles: uiRoot.querySelector("#playerBitmapSubtitles"),
            seekOverlay: uiRoot.querySelector("#playerSeekOverlay"),
            seekDirection: uiRoot.querySelector("#playerSeekDirection"),
            seekPreview: uiRoot.querySelector("#playerSeekPreview"),
            seekFill: uiRoot.querySelector("#playerSeekFill"),
            pauseOverlay: uiRoot.querySelector("#playerPauseOverlay"),
            nextEpisodeCard: uiRoot.querySelector("#playerNextEpisodeCard"),
            postPlay: uiRoot.querySelector("#playerPostPlayRecommendation"),
            modalBackdrop: uiRoot.querySelector("#playerModalBackdrop"),
            subtitleDialog: uiRoot.querySelector("#playerSubtitleDialog"),
            subtitleDelayOverlay: uiRoot.querySelector("#playerSubtitleDelayOverlay"),
            subtitleTimingDialog: uiRoot.querySelector("#playerSubtitleTimingDialog"),
            audioDialog: uiRoot.querySelector("#playerAudioDialog"),
            speedDialog: uiRoot.querySelector("#playerSpeedDialog"),
            sourcesPanel: uiRoot.querySelector("#playerSourcesPanel"),
            controlsOverlay: uiRoot.querySelector("#playerControlsOverlay"),
            controlsBottom: uiRoot.querySelector(".player-controls-bottom"),
            streamMetadata: uiRoot.querySelector("#playerStreamMetadata"),
            headerArtwork: uiRoot.querySelector(".player-artwork"),
            titleLogo: uiRoot.querySelector(".player-title-logo"),
            streamSource: uiRoot.querySelector("#playerStreamSource"),
            progressShell: uiRoot.querySelector("#playerProgressShell"),
            clock: uiRoot.querySelector("#playerClock"),
            endsAt: uiRoot.querySelector("#playerEndsAt"),
            progressBuffered: uiRoot.querySelector("#playerProgressBuffered"),
            progressFill: uiRoot.querySelector("#playerProgressFill"),
            controlButtons: uiRoot.querySelector("#playerControlButtons"),
            timeLabel: uiRoot.querySelector("#playerTimeLabel"),
            timeElapsed: uiRoot.querySelector("#playerTimeElapsed"),
            timeRemaining: uiRoot.querySelector("#playerTimeRemaining"),
            startupErrorButton: uiRoot.querySelector("#playerStartupErrorOverlay .player-startup-error-button")
          }
        : null;
      this.lastUiTickState = {
        bufferedVisible: false,
        bufferedWidth: "",
        progressWidth: "",
        clockText: "",
        clockMinuteKey: "",
        endsAtText: "",
        endsAtMinuteBucket: null,
        timeLabelText: "",
        seekWidth: "",
        seekPreviewText: "",
        seekDirectionText: "",
        progressFocused: false
      };
      this.refreshLoadingOverlayPresentation();
      this.renderStartupErrorOverlay();
    },
    bindPlayerHeaderArtworkFallback() {
      const artwork = this.uiRefs?.headerArtwork;
      const logo = this.uiRefs?.titleLogo;
      if (!artwork || !logo) {
        return;
      }
      logo.addEventListener("error", () => artwork.classList.add("logo-failed"));
      this.syncPlayerHeaderArtwork();
    },
    syncPlayerHeaderArtwork() {
      const artwork = this.uiRefs?.headerArtwork;
      const logo = this.uiRefs?.titleLogo;
      if (!artwork || !logo) {
        return;
      }
      const logoUrl =
        [this.pauseOverlayMeta?.logoUrl, this.params?.playerLogoUrl, this.params?.logo]
          .map((candidate) => String(candidate || "").trim())
          .find((candidate) => /^https?:\/\//i.test(candidate)) || "";
      const hasLogo = Boolean(logoUrl);
      artwork.classList.toggle("has-logo", hasLogo);
      if (!hasLogo) {
        logo.removeAttribute("src");
        logo.hidden = true;
        return;
      }
      if (logo.getAttribute("src") !== logoUrl) {
        artwork.classList.remove("logo-failed");
        logo.setAttribute("src", logoUrl);
      }
      logo.hidden = false;
      if (logo.complete && !logo.naturalWidth) {
        artwork.classList.add("logo-failed");
      }
    },
    getLoadingOverlayMeta() {
      const transition = this.nextEpisodeTransitionMeta || null;
      return {
        title: String(
          transition?.title || this.params?.playerTitle || this.params?.itemTitle || this.params?.itemId || "Nuvio Enhanced"
        ).trim(),
        subtitle: String(transition?.subtitle || this.params?.playerSubtitle || "").trim(),
        logoUrl: String(transition?.logoUrl || this.params?.playerLogoUrl || "").trim(),
        backdropUrl: String(transition?.backdropUrl || this.params?.playerBackdropUrl || "").trim()
      };
    }
  };
}
