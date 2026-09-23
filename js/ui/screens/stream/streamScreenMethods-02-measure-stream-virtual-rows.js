/* eslint-disable no-unused-vars */
import * as internals from "./streamScreen.js";

export function createStreamScreenMethods02() {
  const {
    Router,
    addonRepository,
    PlayerSettingsStore,
    I18n,
    DirectDebridStreamPreparer,
    directDebridPreparationKey,
    StreamBadgeSettingsStore,
    getCachedAddonLogoDisplayUrl,
    hasFailedAddonLogo,
    normalizeAddonLogoUrl,
    preloadAddonLogoImages,
    resolveAddonLogo,
    findStreamVirtualIndex,
    getStreamScrollTopForIndex,
    clamp,
    normalizeType
  } = internals;

  return {
    preconnectFocusedStream(url) {
      const value = String(url || "").trim();
      if (!/^https?:\/\//i.test(value)) return;
      let origin = "";
      try {
        origin = new URL(value).origin;
      } catch (_) {
        return;
      }
      if (this.focusedStreamPreconnect?.href === `${origin}/`) return;
      this.focusedStreamPreconnect?.remove?.();
      const link = document.createElement("link");
      link.rel = "preconnect";
      link.href = origin;
      document.head?.appendChild(link);
      this.focusedStreamPreconnect = link;
    },
    scheduleFocusedStreamPreparation(target) {
      if (this.focusedStreamPreparationTimer) clearTimeout(this.focusedStreamPreparationTimer);
      this.focusedStreamPreparationTimer = null;
      const rowNode = target?.closest?.("[data-stream-row]");
      if (!rowNode) return;
      const rowIndex = Number(rowNode.dataset.streamRow);
      const stream = this.getFilteredStreams()[rowIndex];
      if (!stream) return;
      const token = this.loadToken;
      this.focusedStreamPreparationTimer = setTimeout(() => {
        this.focusedStreamPreparationTimer = null;
        if (!this.container || Router.getCurrent() !== "stream" || token !== this.loadToken) return;
        if (Number(this.focusState?.row) !== rowIndex || this.focusState?.zone !== "card") return;
        this.preconnectFocusedStream(stream.url || stream.externalUrl);
        const key = directDebridPreparationKey(stream);
        if (this.focusedStreamPreparationKeys?.has(key)) return;
        this.focusedStreamPreparationKeys?.add(key);
        void DirectDebridStreamPreparer.prepareSelected(stream, {
          season: this.params?.season == null ? null : Number(this.params.season),
          episode: this.params?.episode == null ? null : Number(this.params.episode)
        })
          .then((prepared) => {
            if (!prepared?.url || !this.container || Router.getCurrent() !== "stream" || token !== this.loadToken) return;
            this.streams = this.streams.map((entry) =>
              directDebridPreparationKey(entry) === key
                ? { ...entry, ...prepared, addonName: entry.addonName, addonLogo: entry.addonLogo, badges: entry.badges }
                : entry
            );
            this.preconnectFocusedStream(prepared.url);
            this.requestRender({ delayMs: 0 });
          })
          .catch(() => {
            this.focusedStreamPreparationKeys?.delete(key);
          });
      }, 400);
    },
    measureStreamVirtualRows() {
      if (!this.streamVirtualized || !this.container) {
        return;
      }
      const list = this.container.querySelector(".stream-route-list");
      const windowNode = list?.querySelector?.("[data-stream-virtual-window]");
      if (!list || !windowNode) {
        return;
      }
      if (!(this.streamVirtualHeights instanceof Map)) {
        this.streamVirtualHeights = new Map();
      }
      let changed = false;
      windowNode.querySelectorAll(".stream-route-card-row[data-stream-row]").forEach((row) => {
        const key = String(row.dataset.streamKey || "");
        const height = Number(row.offsetHeight || 0);
        if (!key || !Number.isFinite(height) || height <= 0) {
          return;
        }
        const previous = Number(this.streamVirtualHeights.get(key) || 0);
        if (Math.abs(previous - height) > 0.5) {
          this.streamVirtualHeights.set(key, height);
          changed = true;
        }
      });
      if (!changed) {
        return;
      }

      const previousModel = this.streamVirtualModel;
      const previousScrollTop = this.getListScrollTop(list);
      const previousAnchorIndex = previousModel ? findStreamVirtualIndex(previousModel.offsets, previousScrollTop) : -1;
      const previousAnchorKey = previousAnchorIndex >= 0 ? previousModel.keys[previousAnchorIndex] : "";
      const previousAnchorOffset = previousAnchorIndex >= 0 ? Number(previousModel.offsets[previousAnchorIndex] || 0) : 0;
      this.streamVirtualModel = null;
      const model = this.getStreamVirtualModel(this.streamVirtualItems);
      this.streamVirtualWindow = null;
      this.syncStreamVirtualization(null, { force: true });
      if (previousAnchorKey) {
        const nextAnchorIndex = model.keys.indexOf(previousAnchorKey);
        if (nextAnchorIndex >= 0) {
          const anchorOffset = previousScrollTop - previousAnchorOffset;
          const nextScrollTop = Math.max(0, Number(model.offsets[nextAnchorIndex] || 0) + anchorOffset);
          if (Math.abs(nextScrollTop - previousScrollTop) > 0.5) {
            this.setListScrollTop(list, nextScrollTop);
            this.requestStreamVirtualSync();
          }
        }
      }
    },
    ensureStreamVirtualRowMounted(index) {
      if (!this.streamVirtualized || !this.container) {
        return false;
      }
      const list = this.container.querySelector(".stream-route-list");
      if (!list) {
        return false;
      }
      const model = this.getStreamVirtualModel(this.streamVirtualItems);
      const rowIndex = clamp(Number(index || 0), 0, Math.max(0, model.keys.length - 1));
      if (this.getMountedStreamVirtualRow(rowIndex)) {
        return true;
      }
      const currentScrollTop = this.getListScrollTop(list);
      const nextScrollTop = getStreamScrollTopForIndex(model, rowIndex, {
        currentScrollTop,
        viewportHeight: this.getStreamVirtualViewportHeight(list),
        padding: 16
      });
      if (Math.abs(nextScrollTop - currentScrollTop) > 0.5) {
        this.setListScrollTop(list, nextScrollTop);
      }
      this.syncStreamVirtualization(rowIndex, { force: true });
      return Boolean(this.getMountedStreamVirtualRow(rowIndex));
    },
    requestRender({ delayMs = 0 } = {}) {
      if (!this.container || Router.getCurrent() !== "stream") {
        return;
      }
      const delay = Math.max(0, Number(delayMs || 0));
      if (delay === 0 && this.renderDelayTimer) {
        clearTimeout(this.renderDelayTimer);
        this.renderDelayTimer = null;
      }
      if (delay > 0) {
        if (this.renderFrame || this.renderDelayTimer) {
          return;
        }
        this.renderDelayTimer = setTimeout(() => {
          this.renderDelayTimer = null;
          this.requestRender();
        }, delay);
        return;
      }
      if (this.renderFrame) {
        return;
      }
      this.renderFrame = requestAnimationFrame(() => {
        this.renderFrame = null;
        if (!this.container || Router.getCurrent() !== "stream") {
          return;
        }
        this.render();
      });
    },
    applyAddonLogos(streams = []) {
      const lookup = this.addonLogoLookup || {};
      return (streams || []).map((stream) => {
        const currentLogo = normalizeAddonLogoUrl(stream?.addonLogo);
        if (currentLogo) {
          return stream;
        }
        const addonLogo = resolveAddonLogo(stream?.addonName, lookup);
        return addonLogo ? { ...stream, addonLogo } : stream;
      });
    },
    areAddonLogosReady(streams = []) {
      if (StreamBadgeSettingsStore.snapshot().showAddonLogo !== true) {
        return true;
      }
      return (streams || []).every((stream) => {
        const addonLogoUrl = normalizeAddonLogoUrl(stream?.addonLogo) || resolveAddonLogo(stream?.addonName, this.addonLogoLookup);
        if (!addonLogoUrl || hasFailedAddonLogo(addonLogoUrl)) {
          return true;
        }
        return Boolean(getCachedAddonLogoDisplayUrl(addonLogoUrl));
      });
    },
    requestAddonLogoPrerender(streams = []) {
      if (StreamBadgeSettingsStore.snapshot().showAddonLogo !== true) {
        return;
      }
      const urls = Array.from(
        new Set(
          (streams || [])
            .map((stream) => normalizeAddonLogoUrl(stream?.addonLogo) || resolveAddonLogo(stream?.addonName, this.addonLogoLookup))
            .filter((url) => url && !hasFailedAddonLogo(url) && !getCachedAddonLogoDisplayUrl(url))
        )
      );
      if (!urls.length) {
        return;
      }
      const key = urls.sort().join("|");
      if (this.pendingAddonLogoPrerenderKey === key) {
        return;
      }
      const token = this.loadToken || 0;
      this.pendingAddonLogoPrerenderKey = key;
      void preloadAddonLogoImages(streams, this.addonLogoLookup).finally(() => {
        if (this.pendingAddonLogoPrerenderKey === key) {
          this.pendingAddonLogoPrerenderKey = "";
        }
        if (this.container && Router.getCurrent() === "stream" && token === this.loadToken) {
          this.requestRender();
        }
      });
    },
    scheduleDebridPreparation() {
      const token = this.loadToken || 0;
      if (this.debridPreparationScheduled) {
        return;
      }
      this.debridPreparationScheduled = true;
      setTimeout(() => {
        this.debridPreparationScheduled = false;
        if (!this.container || Router.getCurrent() !== "stream" || token !== this.loadToken) {
          return;
        }
        const season = this.params?.season == null ? null : Number(this.params.season);
        const episode = this.params?.episode == null ? null : Number(this.params.episode);
        const playerSettings = PlayerSettingsStore.get();
        const installedAddonNames = new Set(
          (addonRepository.getCachedInstalledAddons() || [])
            .map((addon) => String(addon?.displayName || addon?.name || "").trim())
            .filter(Boolean)
        );
        void DirectDebridStreamPreparer.prepare(this.streams, {
          season,
          episode,
          playerSettings,
          systemLanguage: I18n.getLocale(),
          contentLanguage: this.params?.contentLanguage || this.params?.originalLanguage || this.params?.original_language,
          installedAddonNames,
          onPrepared: (original, prepared) => {
            if (!this.container || Router.getCurrent() !== "stream" || token !== this.loadToken) {
              return;
            }
            const originalKey = directDebridPreparationKey(original);
            this.streams = this.streams.map((stream) =>
              directDebridPreparationKey(stream) === originalKey
                ? {
                    ...stream,
                    ...prepared,
                    addonName: stream.addonName,
                    addonLogo: stream.addonLogo,
                    badges: stream.badges
                  }
                : stream
            );
            this.requestRender();
          }
        });
      }, 0);
    },
    getBackdropUrl() {
      return this.params?.backdrop || this.params?.landscapePoster || this.params?.poster || "";
    },
    getRouteStateKey(params = {}) {
      const itemType = normalizeType(params?.itemType);
      const itemId = String(params?.itemId || "").trim();
      const videoId = String(params?.videoId || "").trim();
      if (!itemId && !videoId) {
        return null;
      }
      return `stream:${itemType}:${itemId}:${videoId}`;
    },
    navigateBackFromStream() {
      if (this.streamBackNavigationInProgress) {
        // A pending history pop is the first Back transition. Do not let a
        // duplicate Tizen event turn it into the next Android stack transition.
        return "history";
      }
      const itemId = String(this.params?.itemId || "").trim();
      if (!itemId) {
        return false;
      }
      this.streamBackNavigationInProgress = true;
      const itemType = normalizeType(this.params?.itemType);
      const isSeries = itemType === "series" || itemType === "tv";
      if (this.params?.continueWatchingBackHome && !isSeries) {
        // Android returns movies opened from Continue Watching straight Home;
        // only episodic content reconstructs a Detail route on Back.
        if (Router.popToExistingRoute?.("home", {})) {
          return "history";
        }
        void Router.navigate(
          "home",
          {},
          {
            skipStackPush: true,
            replaceHistory: true,
            isBackNavigation: true
          }
        );
        return true;
      }
      const detailParams = {
        itemId,
        itemType,
        imdbId: this.params?.imdbId || null,
        tmdbId: this.params?.tmdbId || null,
        traktId: this.params?.traktId || null,
        originalItemId: this.params?.originalItemId || null,
        fallbackTitle: this.params?.itemTitle || this.params?.playerTitle || "Untitled",
        returnToSearchOnBack: Boolean(this.params?.returnToSearchOnBack),
        returnHomeOnBack: Boolean(
          !this.params?.returnToSearchOnBack && (this.params?.continueWatchingBackHome || this.params?.returnHomeOnBack)
        )
      };
      if (Router.popToExistingRoute?.("detail", detailParams)) {
        return "history";
      }
      void Router.navigate("detail", detailParams, {
        skipStackPush: true,
        replaceHistory: true,
        isBackNavigation: true
      });
      return true;
    },
    consumeBackRequest() {
      return this.navigateBackFromStream();
    },
    captureRouteState() {
      const list = this.container?.querySelector(".stream-route-list");
      return {
        params: this.params ? { ...this.params } : {},
        loading: Boolean(this.loading),
        error: String(this.error || ""),
        streams: Array.isArray(this.streams) ? this.streams.map((stream) => ({ ...stream })) : [],
        addonFilter: String(this.addonFilter || "all"),
        focusState: this.focusState ? { ...this.focusState } : { zone: "filter", index: 0 },
        sourceChips: Array.isArray(this.sourceChips) ? this.sourceChips.map((chip) => ({ ...chip })) : [],
        addonLogoLookup: this.addonLogoLookup ? { ...this.addonLogoLookup } : {},
        streamSearchCompleted: Boolean(this.streamSearchCompleted),
        listScrollTop: this.getListScrollTop(list)
      };
    }
  };
}
