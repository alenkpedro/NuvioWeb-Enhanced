/* eslint-disable no-unused-vars */
import * as internals from "./playerController.js";

export function createPlayerControllerMethods15() {
  const { Platform, isValidAvPlayPlaybackSpeedState, resolveWebOsSubtitleFontSizeLevel } = internals;

  return {
    async setPlaybackRate(speed = 1) {
      if (!this.video) {
        return false;
      }
      const targetSpeed = this.normalizePlaybackRate(speed);
      if (!Number.isFinite(targetSpeed)) {
        return false;
      }

      if (this.isUsingAvPlay()) {
        if (!this.isSupportedAvPlayPlaybackRate(targetSpeed)) {
          return false;
        }
        const state = this.getAvPlayState();
        if (isValidAvPlayPlaybackSpeedState(state) && !this.applyAvPlayPlaybackRate(targetSpeed)) {
          return false;
        }
        this.desiredPlaybackRate = targetSpeed;
        return true;
      }

      if (Platform.isWebOS()) {
        if (!this.isSupportedWebOsPlaybackRate(targetSpeed)) {
          return false;
        }
        if (!this.isUsingNativePlayback()) {
          // A non-native (MSE) pipeline is already at normal speed and has no
          // mediaId that Luna can address.
          if (targetSpeed === 1) {
            this.desiredPlaybackRate = 1;
            this.appliedWebOsPlaybackRate = 1;
            return true;
          }
          return false;
        }

        const requestToken = Number(this.webOsPlaybackRateRequestToken || 0) + 1;
        this.webOsPlaybackRateRequestToken = requestToken;
        const applied = await this.queueWebOsPlaybackRate(targetSpeed);
        if (!applied || requestToken !== this.webOsPlaybackRateRequestToken) {
          return false;
        }
        this.desiredPlaybackRate = targetSpeed;
        return true;
      }

      try {
        this.video.playbackRate = targetSpeed;
      } catch (_) {
        return false;
      }
      this.desiredPlaybackRate = targetSpeed;

      return true;
    },
    setNativeAudioTrack(index) {
      if (!this.video) {
        return false;
      }
      const targetIndex = Number(index);
      const tracks = this.nativeAudioTrackListToArray();
      if (!Number.isFinite(targetIndex) || targetIndex < 0 || targetIndex >= tracks.length) {
        return false;
      }

      const applySelection = () => {
        tracks.forEach((track, trackIndex) => {
          const selected = trackIndex === targetIndex;
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
      };

      if (Platform.isWebOS() && this.isUsingNativePlayback()) {
        return this.requestConfirmedWebOsAudioTrackSelection({
          targetTrackIndex: targetIndex,
          selectedTrackIndex: targetIndex,
          selectionKind: "native",
          applySelection
        });
      }

      this.selectedWebOsAudioTrackIndex = -1;
      this.webOsAudioSelectionExplicit = false;
      this.selectedWebOsEmbeddedAudioTrackIndex = -1;
      applySelection();
      return true;
    },
    setWebOsEmbeddedAudioTrack(trackIndex, selectedTrackIndex = trackIndex) {
      if (!Platform.isWebOS() || !this.video || !this.isUsingNativePlayback()) {
        return false;
      }

      const targetIndex = Number(trackIndex);
      const selectedIndex = Number(selectedTrackIndex);
      const storedSelectedIndex = Number.isFinite(selectedIndex) && selectedIndex >= 0 ? selectedIndex : targetIndex;
      if (!Number.isFinite(targetIndex) || targetIndex < 0) {
        this.selectedWebOsAudioTrackIndex = -1;
        this.webOsAudioSelectionExplicit = false;
        this.selectedWebOsEmbeddedAudioTrackIndex = -1;
        return false;
      }

      const applySelection = () => {
        const tracks = this.nativeAudioTrackListToArray();
        if (!tracks.length) {
          return;
        }

        tracks.forEach((track, trackListIndex) => {
          const selected = trackListIndex === targetIndex;
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
      };

      return this.requestConfirmedWebOsAudioTrackSelection({
        targetTrackIndex: targetIndex,
        selectedTrackIndex: storedSelectedIndex,
        selectionKind: "embedded",
        applySelection
      });
    },
    setNativeTextTrack(index) {
      if (!this.video) {
        return false;
      }
      const targetIndex = Number(index);
      const textTrackList = this.video.textTracks || this.video.webkitTextTracks || this.video.mozTextTracks || null;
      let tracks = [];
      if (textTrackList) {
        try {
          tracks = Array.from(textTrackList).filter(Boolean);
        } catch (_) {
          const trackCount = Number(textTrackList.length || 0);
          for (let trackIndex = 0; trackIndex < trackCount; trackIndex += 1) {
            const track = textTrackList[trackIndex] || textTrackList.item?.(trackIndex) || null;
            if (track) {
              tracks.push(track);
            }
          }
        }
      }
      if (!Number.isFinite(targetIndex) || targetIndex < -1 || targetIndex >= tracks.length) {
        return false;
      }

      if (Platform.isWebOS() && this.isUsingNativePlayback()) {
        this.selectedWebOsSubtitleTrackIndex = targetIndex;
        this.webOsSubtitleSelectionExplicit = true;
      }
      this.webOsHtmlTextTrackIndex = -1;
      this.selectedWebOsEmbeddedSubtitleTrackIndex = -1;

      const mediaId = this.syncNativeMediaId();
      if (mediaId && Platform.isWebOS()) {
        if (targetIndex < 0) {
          this.requestWebOsMediaCommand("setSubtitleEnable", {
            mediaId,
            enable: false
          }).catch(() => {
            // Ignore Luna subtitle disable failures and keep native toggles.
          });
        } else {
          this.requestWebOsMediaCommand("setSubtitleEnable", {
            mediaId,
            enable: true
          }).catch(() => {
            // Ignore Luna subtitle enable failures and keep native toggles.
          });
          this.applyWebOsSubtitleFontSize(mediaId, { force: true });
          setTimeout(() => {
            if (mediaId !== this.nativeMediaId) {
              return;
            }
            this.requestWebOsMediaCommand("selectTrack", {
              type: "text",
              mediaId,
              index: targetIndex
            })
              .then(() => {
                if (this.webOsHtmlTextTrackIndex === targetIndex) {
                  return this.setWebOsNativeTextTrackVisibility(false, targetIndex);
                }
                return null;
              })
              .catch(() => {
                // Ignore Luna subtitle track selection failures and keep native toggles.
              });
          }, 350);
        }
      }

      tracks.forEach((track, trackIndex) => {
        try {
          track.mode = targetIndex >= 0 && trackIndex === targetIndex ? "showing" : "disabled";
        } catch (_) {
          // Best effort.
        }
      });

      return true;
    },
    applyWebOsSubtitleFontSize(mediaId, { force = false } = {}) {
      const normalizedMediaId = String(mediaId || "").trim();
      if (!Platform.isWebOS() || !normalizedMediaId) {
        return false;
      }

      const fontSize = Math.min(4, Math.max(0, Math.trunc(Number(this.webOsSubtitleFontSizeLevel) || 0)));
      const applyKey = `${normalizedMediaId}:${fontSize}`;
      if (!force && this.appliedWebOsSubtitleFontSizeKey === applyKey) {
        return true;
      }

      this.appliedWebOsSubtitleFontSizeKey = applyKey;
      this.requestWebOsMediaCommand("setSubtitleFontSize", {
        mediaId: normalizedMediaId,
        fontSize
      }).catch(() => {
        if (this.appliedWebOsSubtitleFontSizeKey === applyKey) {
          this.appliedWebOsSubtitleFontSizeKey = "";
        }
      });
      return true;
    },
    setWebOsSubtitleFontSize(value) {
      if (!Platform.isWebOS()) {
        return false;
      }

      this.webOsSubtitleFontSizeLevel = resolveWebOsSubtitleFontSizeLevel(value);
      const mediaId = this.syncNativeMediaId();
      if (mediaId) {
        return this.applyWebOsSubtitleFontSize(mediaId);
      }
      return true;
    },
    setWebOsEmbeddedSubtitleNativeVisibility(enabled, selectedTrackIndex = this.selectedWebOsEmbeddedSubtitleTrackIndex) {
      if (!Platform.isWebOS() || !this.video || !this.isUsingNativePlayback()) {
        return Promise.resolve(false);
      }
      const expectedSelectedIndex = Number(selectedTrackIndex);
      if (
        !Number.isFinite(expectedSelectedIndex) ||
        expectedSelectedIndex < 0 ||
        Number(this.selectedWebOsEmbeddedSubtitleTrackIndex) !== expectedSelectedIndex
      ) {
        return Promise.resolve(false);
      }

      const applyVisibility = (mediaId) => {
        if (!mediaId || Number(this.selectedWebOsEmbeddedSubtitleTrackIndex) !== expectedSelectedIndex) {
          return false;
        }
        return this.requestWebOsMediaCommand("setSubtitleEnable", {
          mediaId,
          enable: Boolean(enabled)
        })
          .then((result) => {
            if (result?.returnValue === false || result?.errorCode) return false;
            if (
              Boolean(enabled) &&
              mediaId === this.nativeMediaId &&
              Number(this.selectedWebOsEmbeddedSubtitleTrackIndex) === expectedSelectedIndex
            ) {
              this.applyWebOsSubtitleFontSize(mediaId, { force: true });
            }
            return true;
          })
          .catch(() => false);
      };

      const mediaId = this.syncNativeMediaId();
      if (mediaId) {
        return Promise.resolve(applyVisibility(mediaId));
      }

      return this.waitForNativeMediaId()
        .then(applyVisibility)
        .catch(() => false);
    },
    setWebOsNativeTextTrackVisibility(enabled, selectedTrackIndex = this.selectedWebOsSubtitleTrackIndex) {
      if (!Platform.isWebOS() || !this.video || !this.isUsingNativePlayback()) {
        return Promise.resolve(false);
      }
      const expectedIndex = Number(selectedTrackIndex);
      if (
        !Number.isInteger(expectedIndex) ||
        expectedIndex < 0 ||
        Number(this.selectedWebOsSubtitleTrackIndex) !== expectedIndex ||
        Number(this.selectedWebOsEmbeddedSubtitleTrackIndex) >= 0
      ) {
        return Promise.resolve(false);
      }
      const applyVisibility = (mediaId) => {
        if (!mediaId || Number(this.selectedWebOsSubtitleTrackIndex) !== expectedIndex) return false;
        return this.requestWebOsMediaCommand("setSubtitleEnable", {
          mediaId,
          enable: Boolean(enabled)
        })
          .then((result) => {
            if (result?.returnValue === false || result?.errorCode) return false;
            if (mediaId !== this.nativeMediaId || Number(this.selectedWebOsSubtitleTrackIndex) !== expectedIndex) {
              return false;
            }
            this.webOsHtmlTextTrackIndex = enabled ? -1 : expectedIndex;
            return true;
          })
          .catch(() => false);
      };
      const mediaId = this.syncNativeMediaId();
      return (mediaId ? Promise.resolve(mediaId) : this.waitForNativeMediaId()).then(applyVisibility).catch(() => false);
    }
  };
}
