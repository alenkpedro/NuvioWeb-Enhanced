/* eslint-disable no-unused-vars */
import * as internals from "./playerController.js";

export function createPlayerControllerMethods02() {
  const { Platform, WebOsLunaService, subscribeWebOsCompanionService, WebOSPlayerExtensions } = internals;

  return {
    isLikelyDirectFileUrl(url) {
      const raw = String(url || "").trim();
      if (!raw) {
        return false;
      }

      const probes = [raw];
      try {
        probes.push(decodeURIComponent(raw));
      } catch (_) {
        // Ignore decode failures.
      }

      return probes.some((value) => /\.(mkv|mp4|m4v|mov|webm|avi|wmv|ts|m2ts|mpg|mpeg|3gp)(?=($|[/?#&]))/i.test(String(value || "")));
    },
    isUsingAvPlay() {
      return String(this.playbackEngine || "").endsWith("avplay") && this.avplayActive;
    },
    shouldKeepWebOsPlaybackAwake() {
      return Boolean(Platform.isWebOS() && this.playbackSessionActive && this.isPlaying && !this.isPlaybackEnded());
    },
    syncWebOsPlaybackKeepAwake() {
      if (!Platform.isWebOS()) {
        return;
      }
      if (this.shouldKeepWebOsPlaybackAwake()) {
        WebOSPlayerExtensions.startPlaybackKeepAwake(() => this.shouldKeepWebOsPlaybackAwake());
      } else {
        WebOSPlayerExtensions.stopPlaybackKeepAwake();
      }
    },
    startWebOsPlaybackKeepAlive() {
      if (!Platform.isWebOS()) {
        return;
      }

      this.stopWebOsPlaybackKeepAlive();
      const token = `media-playback:${Date.now()}:${Math.random().toString(36).slice(2)}`;
      this.webOsPlaybackKeepAliveToken = token;
      try {
        this.webOsPlaybackKeepAliveHandle = subscribeWebOsCompanionService({
          method: "mediaPlaybackKeepAlive",
          parameters: {
            token,
            // Keep the interval below the shortest observed webOS service
            // eviction window while avoiding an excessive Luna request rate.
            intervalMs: 5000
          },
          onFailure: (error) => {
            if (token !== this.webOsPlaybackKeepAliveToken) {
              return;
            }
            console.warn("webOS media playback keepalive failed", { token, error });
          }
        });
      } catch (error) {
        this.webOsPlaybackKeepAliveHandle = null;
        this.webOsPlaybackKeepAliveToken = "";
        console.warn("webOS media playback keepalive could not start", { token, error });
      }
    },
    stopWebOsPlaybackKeepAlive() {
      if (this.webOsPlaybackKeepAliveHandle) {
        try {
          this.webOsPlaybackKeepAliveHandle.cancel?.();
        } catch (_) {
          // Ignore local cancellation failures.
        }
        this.webOsPlaybackKeepAliveHandle = null;
      }
      // Cancelling the Luna subscription is enough to trigger the service-side
      // cancel handler. Avoid a second stop request that could relaunch an
      // evicted on-demand service during teardown.
      this.webOsPlaybackKeepAliveToken = "";
    },
    startWebOsServiceKeepAlive() {
      if (!Platform.isWebOS() || this.webOsServiceKeepAliveHandle) {
        return;
      }

      const token = `webos-playback:${Date.now()}:${Math.random().toString(36).slice(2)}`;
      this.webOsServiceKeepAliveToken = token;
      try {
        this.webOsServiceKeepAliveHandle = subscribeWebOsCompanionService({
          method: "playbackServiceKeepAlive",
          parameters: {
            token,
            intervalMs: 5000
          },
          onFailure: (error) => {
            if (token !== this.webOsServiceKeepAliveToken) {
              return;
            }
            console.warn("webOS playback service keepalive failed", { token, error });
          }
        });
      } catch (error) {
        this.webOsServiceKeepAliveHandle = null;
        this.webOsServiceKeepAliveToken = "";
        console.warn("webOS playback service keepalive could not start", { token, error });
      }
    },
    stopWebOsServiceKeepAlive() {
      if (this.webOsServiceKeepAliveHandle) {
        try {
          this.webOsServiceKeepAliveHandle.cancel?.();
        } catch (_) {
          // Ignore local cancellation failures.
        }
        this.webOsServiceKeepAliveHandle = null;
      }
      this.webOsServiceKeepAliveToken = "";
    },
    emitVideoEvent(eventName, detail = null) {
      if (!this.video || !eventName) {
        return;
      }

      try {
        const event =
          typeof CustomEvent === "function"
            ? new CustomEvent(eventName, { detail: detail || null })
            : (() => {
                const legacyEvent = document.createEvent("CustomEvent");
                legacyEvent.initCustomEvent(eventName, false, false, detail || null);
                return legacyEvent;
              })();
        this.video.dispatchEvent(event);
      } catch (_) {
        // Ignore synthetic event failures.
      }
    },
    requestWebOsMediaCommand(method, parameters = {}) {
      if (!Platform.isWebOS() || !WebOsLunaService.isAvailable()) {
        return Promise.reject(new Error("webOS Luna media service unavailable"));
      }
      return WebOsLunaService.request("luna://com.webos.media", {
        method,
        parameters
      });
    },
    resetNativeMediaState() {
      this.nativeMediaId = "";
      this.nativeMediaIdLookupToken = Number(this.nativeMediaIdLookupToken || 0) + 1;
      this.webOsPlaybackRateRequestToken = Number(this.webOsPlaybackRateRequestToken || 0) + 1;
      this.appliedWebOsPlaybackRate = 1;
      this.webOsPlaybackRateCommandPromise = null;
      this.webOsPlaybackRateReapplyPromise = null;
      this.cancelWebOsAudioTrackSelection();
      this.webOsTrackReapplyMediaId = "";
      this.appliedWebOsSubtitleFontSizeKey = "";
    },
    clearWebOsTrackSelections() {
      this.cancelWebOsAudioTrackSelection();
      this.selectedWebOsAudioTrackIndex = -1;
      this.selectedWebOsSubtitleTrackIndex = -1;
      this.webOsHtmlTextTrackIndex = -1;
      this.selectedWebOsEmbeddedAudioTrackIndex = -1;
      this.selectedWebOsEmbeddedSubtitleTrackIndex = -1;
      this.webOsAudioSelectionExplicit = false;
      this.webOsSubtitleSelectionExplicit = false;
      this.webOsTrackReapplyMediaId = "";
    },
    syncNativeMediaId() {
      const mediaId = String(this.video?.mediaId || "").trim();
      if (mediaId) {
        this.nativeMediaId = mediaId;
      }
      return this.nativeMediaId;
    },
    reapplyWebOsNativeTrackSelections() {
      if (!Platform.isWebOS() || !this.video || !this.isUsingNativePlayback()) {
        return false;
      }

      const mediaId = this.syncNativeMediaId();
      const mediaKey = mediaId || "local-native-media";
      if (this.webOsTrackReapplyMediaId === mediaKey) {
        return false;
      }

      const audioTracks = this.nativeAudioTrackListToArray();
      const audioIndex = Number(this.selectedWebOsAudioTrackIndex);
      const hasAudioSelection =
        this.webOsAudioSelectionExplicit && Number.isFinite(audioIndex) && audioIndex >= 0 && audioIndex < audioTracks.length;
      const textTrackList = this.video.textTracks || this.video.webkitTextTracks || this.video.mozTextTracks || null;
      let textTracks = [];
      if (textTrackList) {
        try {
          textTracks = Array.from(textTrackList).filter(Boolean);
        } catch (_) {
          const trackCount = Number(textTrackList.length || 0);
          for (let trackIndex = 0; trackIndex < trackCount; trackIndex += 1) {
            const track = textTrackList[trackIndex] || textTrackList.item?.(trackIndex) || null;
            if (track) {
              textTracks.push(track);
            }
          }
        }
      }
      const subtitleIndex = Number(this.selectedWebOsSubtitleTrackIndex);
      const hasSubtitleSelection =
        this.webOsSubtitleSelectionExplicit && (subtitleIndex < 0 || (Number.isFinite(subtitleIndex) && subtitleIndex < textTracks.length));
      const audioSelectionNeedsTrackList = this.webOsAudioSelectionExplicit && !hasAudioSelection;
      const subtitleSelectionNeedsTrackList = this.webOsSubtitleSelectionExplicit && !hasSubtitleSelection;

      if (!hasAudioSelection && !hasSubtitleSelection) {
        return false;
      }

      if (hasAudioSelection) {
        audioTracks.forEach((track, trackIndex) => {
          const selected = trackIndex === audioIndex;
          try {
            if ("enabled" in track) {
              track.enabled = selected;
            }
          } catch (_) {
            // Best effort.
          }
          try {
            if ("selected" in track) {
              track.selected = selected;
            }
          } catch (_) {
            // Best effort.
          }
        });
      }

      if (hasSubtitleSelection) {
        textTracks.forEach((track, trackIndex) => {
          try {
            track.mode =
              subtitleIndex >= 0 && trackIndex === subtitleIndex
                ? this.webOsHtmlTextTrackIndex === subtitleIndex
                  ? "hidden"
                  : "showing"
                : "disabled";
          } catch (_) {
            // Best effort.
          }
        });
      }

      if (!audioSelectionNeedsTrackList && !subtitleSelectionNeedsTrackList) {
        this.webOsTrackReapplyMediaId = mediaKey;
      }
      const commands = [];
      if (mediaId && WebOsLunaService.isAvailable()) {
        if (hasAudioSelection) {
          commands.push(
            this.requestWebOsMediaCommand("selectTrack", {
              type: "audio",
              mediaId,
              index: audioIndex
            })
          );
        }
        if (hasSubtitleSelection) {
          commands.push(
            this.requestWebOsMediaCommand("setSubtitleEnable", {
              mediaId,
              enable: subtitleIndex >= 0 && this.webOsHtmlTextTrackIndex !== subtitleIndex
            })
          );
          if (subtitleIndex >= 0) {
            this.applyWebOsSubtitleFontSize(mediaId, { force: true });
            setTimeout(() => {
              if (
                mediaId !== this.nativeMediaId ||
                !this.webOsSubtitleSelectionExplicit ||
                Number(this.selectedWebOsSubtitleTrackIndex) !== subtitleIndex
              ) {
                return;
              }
              this.requestWebOsMediaCommand("selectTrack", {
                type: "text",
                mediaId,
                index: subtitleIndex
              })
                .then(() => {
                  if (this.webOsHtmlTextTrackIndex === subtitleIndex) {
                    return this.setWebOsNativeTextTrackVisibility(false, subtitleIndex);
                  }
                  return null;
                })
                .catch(() => {
                  // Ignore Luna subtitle track selection failures and keep native toggles.
                });
            }, 350);
          }
        }
      }

      if (commands.length) {
        Promise.all(
          commands.map((command) =>
            Promise.resolve(command).then((result) => {
              if (result?.returnValue === false || result?.errorCode) {
                throw new Error("webOS track selection reapply failed");
              }
              return result;
            })
          )
        ).catch(() => {
          if (this.webOsTrackReapplyMediaId === mediaKey) {
            this.webOsTrackReapplyMediaId = "";
          }
        });
      }
      return true;
    },
    waitForNativeMediaId({ maxAttempts = 4, intervalMs = 300 } = {}) {
      if (!Platform.isWebOS() || !this.video || !this.isUsingNativePlayback()) {
        return Promise.resolve(null);
      }

      const existingMediaId = this.syncNativeMediaId();
      if (existingMediaId) {
        return Promise.resolve(existingMediaId);
      }

      const lookupToken = Number(this.nativeMediaIdLookupToken || 0) + 1;
      this.nativeMediaIdLookupToken = lookupToken;

      return new Promise((resolve) => {
        let attempts = 0;
        const poll = () => {
          if (lookupToken !== this.nativeMediaIdLookupToken) {
            resolve(null);
            return;
          }
          const mediaId = this.syncNativeMediaId();
          if (mediaId || attempts >= maxAttempts) {
            resolve(mediaId || null);
            return;
          }
          attempts += 1;
          setTimeout(poll, intervalMs);
        };
        poll();
      });
    },
    nativeAudioTrackListToArray() {
      const audioTrackList = this.video?.audioTracks || this.video?.webkitAudioTracks || this.video?.mozAudioTracks || null;
      if (!audioTrackList) {
        return [];
      }
      try {
        return Array.from(audioTrackList).filter(Boolean);
      } catch (_) {
        const tracks = [];
        const trackCount = Number(audioTrackList.length || 0);
        for (let trackIndex = 0; trackIndex < trackCount; trackIndex += 1) {
          const track = audioTrackList[trackIndex] || audioTrackList.item?.(trackIndex) || null;
          if (track) {
            tracks.push(track);
          }
        }
        return tracks;
      }
    },
    stopAvPlayTickTimer() {
      if (this.avplayTickTimer) {
        clearInterval(this.avplayTickTimer);
        this.avplayTickTimer = null;
      }
    },
    clearAvPlaySeekTimeout() {
      if (this.avplaySeekTimeoutTimer !== null) {
        clearTimeout(this.avplaySeekTimeoutTimer);
        this.avplaySeekTimeoutTimer = null;
      }
    }
  };
}
