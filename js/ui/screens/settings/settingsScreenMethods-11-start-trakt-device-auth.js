/* eslint-disable no-unused-vars */
import * as internals from "./settingsScreenContext.js";

export function createSettingsScreenMethods11() {
  const {
    Router,
    TraktAuthService,
    TraktLibrarySourceMode,
    TraktSettingsStore,
    WatchProgressSource,
    TRAKT_CONTINUE_WATCHING_DAY_OPTIONS,
    TRAKT_WATCH_PROGRESS_OPTIONS,
    TRAKT_LIBRARY_SOURCE_OPTIONS,
    TRAKT_COMMENTS_OPTIONS,
    t,
    escapeHtml,
    labelForTraktContinueWatchingDays,
    renderTraktCountdownText,
    createTraktQrDataUrl,
    settingsScrollIndicatorMarkup
  } = internals;

  return {
    async startTraktDeviceAuth() {
      this.traktLoading = true;
      this.traktErrorMessage = null;
      this.traktStatusMessage = null;
      this.contentFocusKey = "trakt:back";
      await this.render();
      try {
        await TraktAuthService.startDeviceAuth();
        this.traktStatusMessage = "Enter code on trakt.tv/activate";
        this.startTraktPolling();
      } catch (error) {
        this.traktErrorMessage = String(error?.message || error || t("qr_login_start_failed", {}, "Failed to start QR login"));
      } finally {
        this.traktLoading = false;
        await this.render();
      }
    },
    startTraktPolling(force = false) {
      if (this.traktPollTimer && !force) {
        return;
      }
      this.stopTraktPolling();
      const poll = async () => {
        const state = TraktAuthService.getCurrentAuthState();
        if (!state.deviceCode || Router.getCurrent() !== "settings" || this.activeSection !== "trakt") {
          this.stopTraktPolling();
          return;
        }
        const result = await TraktAuthService.pollDeviceToken().catch((error) => ({
          type: "failed",
          message: String(error?.message || error || "Network error, will retry")
        }));
        if (result.type === "approved") {
          this.stopTraktPolling();
          this.traktStatusMessage = `Connected as ${result.username || "Trakt user"}`;
          this.traktErrorMessage = null;
          await this.loadTraktStats(true);
          await this.render();
          return;
        }
        if (result.type === "pending") {
          this.traktStatusMessage = t("trakt_waiting_approval", {}, "Waiting for approval...");
          this.traktErrorMessage = null;
        } else if (result.type === "slow_down") {
          this.traktStatusMessage = "Rate limited, slowing down polling...";
          this.traktErrorMessage = null;
        } else if (result.type === "expired") {
          this.stopTraktPolling();
          this.traktStatusMessage = null;
          this.traktErrorMessage = t("trakt_error_code_expired", {}, "Code expired. Generate a new code.");
        } else if (result.type === "denied") {
          this.stopTraktPolling();
          this.traktStatusMessage = null;
          this.traktErrorMessage = t("trakt_error_denied", {}, "Trakt authorization was denied.");
        } else if (result.type === "already_used") {
          this.stopTraktPolling();
          this.traktStatusMessage = null;
          this.traktErrorMessage = t("trakt_error_code_used", {}, "This Trakt code was already used.");
        } else if (result.type === "failed") {
          this.traktStatusMessage = null;
          this.traktErrorMessage = result.message || "Token polling failed";
        }
        await this.render();
        const nextState = TraktAuthService.getCurrentAuthState();
        if (nextState.deviceCode && !this.traktPollTimer) {
          this.traktPollTimer = setTimeout(
            () => {
              this.traktPollTimer = null;
              void poll();
            },
            Math.max(1, Number(nextState.pollInterval || 5)) * 1000
          );
        }
      };
      void poll();
    },
    stopTraktPolling() {
      if (this.traktPollTimer) {
        clearTimeout(this.traktPollTimer);
        this.traktPollTimer = null;
      }
    },
    async loadTraktStats(forceRefresh = false) {
      if (!TraktAuthService.isAuthenticated()) {
        this.traktStats = null;
        this.traktStatsLoading = false;
        return;
      }
      this.traktStatsLoading = true;
      try {
        this.traktStats = await TraktAuthService.fetchStats(forceRefresh);
      } catch (error) {
        console.warn("Failed to load Trakt stats", error);
      } finally {
        this.traktStatsLoading = false;
      }
    },
    openTraktDisconnectDialog() {
      this.openOptionDialog({
        title: t("trakt_disconnect_title", {}, "Disconnect Trakt?"),
        options: [
          { id: "disconnect", labelKey: "trakt_disconnect" },
          { id: "cancel", labelKey: "action_cancel", label: "Cancel" }
        ],
        selectedId: "cancel",
        returnFocusKey: "trakt:disconnect",
        dialogClassName: "settings-trakt-confirm-dialog",
        onSelect: async (option) => {
          if (option.id !== "disconnect") {
            return;
          }
          this.stopTraktPolling();
          this.traktLoading = true;
          await TraktAuthService.disconnect();
          this.traktStats = null;
          this.traktLoading = false;
          this.traktStatusMessage = "Disconnected from Trakt";
        }
      });
    },
    renderTraktSection(model) {
      const trakt = model.trakt || this.collectTraktModel();
      const auth = trakt.auth || {};
      const settings = trakt.settings || TraktSettingsStore.get();
      const mode = trakt.mode || "disconnected";
      const isConnected = mode === "connected";
      const isAwaitingApproval = mode === "awaiting_approval";
      const userCode = auth.userCode || "";
      const remaining = auth.expiresAt ? Math.max(0, Number(auth.expiresAt) - Date.now()) : 0;
      const tokenRemaining =
        auth.createdAt && auth.expiresIn ? Math.max(0, (Number(auth.createdAt) + Number(auth.expiresIn)) * 1000 - Date.now()) : 0;

      if (isAwaitingApproval) {
        if (!this.deferTraktAutoWork?.("polling")) {
          this.startTraktPolling();
        }
      }
      if (isConnected && !this.traktStats && !this.traktStatsLoading) {
        if (!this.deferTraktAutoWork?.("stats")) {
          void this.loadTraktStats(false).then(() => {
            if (this.container && this.activeSection === "trakt") {
              void this.render();
            }
          });
        }
      }

      this.actionMap.set("trakt:back", () => {
        this.syncNavFocusToActive();
        this.focusZone = "nav";
      });
      this.actionMap.set("trakt:login", () => this.startTraktDeviceAuth());
      this.actionMap.set("trakt:cancel", async () => {
        this.stopTraktPolling();
        await TraktAuthService.disconnect();
        this.traktStatusMessage = null;
        this.traktErrorMessage = null;
      });
      this.actionMap.set("trakt:retry", () => this.startTraktPolling(true));
      this.actionMap.set("trakt:disconnect", () => this.openTraktDisconnectDialog());
      this.actionMap.set("trakt:librarySource", () => {
        this.openOptionDialog({
          title: t("trakt_library_source_dialog_title", {}, "Library Source"),
          options: TRAKT_LIBRARY_SOURCE_OPTIONS,
          selectedId: settings.librarySourceMode,
          returnFocusKey: "trakt:librarySource",
          dialogClassName: "settings-trakt-dialog",
          onSelect: (option) => {
            TraktSettingsStore.setLibrarySourceMode(option.id);
            this.traktStatusMessage =
              option.id === TraktLibrarySourceMode.TRAKT
                ? t("trakt_library_source_trakt_selected", {}, "Trakt library selected")
                : t("trakt_library_source_nuvio_selected", {}, "Nuvio Enhanced library selected");
          }
        });
      });
      this.actionMap.set("trakt:watchProgress", () => {
        this.openOptionDialog({
          title: t("trakt_watch_progress_dialog_title", {}, "Watch Progress"),
          options: TRAKT_WATCH_PROGRESS_OPTIONS,
          selectedId: settings.watchProgressSource,
          returnFocusKey: "trakt:watchProgress",
          dialogClassName: "settings-trakt-dialog",
          onSelect: (option) => {
            TraktSettingsStore.setWatchProgressSource(option.id);
            this.traktStatusMessage =
              option.id === WatchProgressSource.TRAKT
                ? t("trakt_watch_progress_trakt_selected", {}, "Watch progress source set to Trakt")
                : t("trakt_watch_progress_nuvio_selected", {}, "Watch progress source set to Nuvio Sync");
          }
        });
      });
      this.actionMap.set("trakt:cwWindow", () => {
        this.openOptionDialog({
          title: t("trakt_cw_window_title", {}, "Continue Watching Window"),
          message: t("trakt_cw_window_subtitle", {}, "Choose how much Trakt activity should appear in continue watching."),
          options: TRAKT_CONTINUE_WATCHING_DAY_OPTIONS.map((days) => ({
            id: String(days),
            label: labelForTraktContinueWatchingDays(days)
          })),
          selectedId: String(settings.continueWatchingDaysCap),
          returnFocusKey: "trakt:cwWindow",
          dialogClassName: "settings-trakt-dialog",
          optionRenderer: "single-choice",
          onSelect: (option) => {
            TraktSettingsStore.setContinueWatchingDaysCap(Number(option.id));
            this.traktStatusMessage = t("trakt_status_cw_window_updated", {}, "Continue watching window updated");
          }
        });
      });
      this.actionMap.set("trakt:comments", () => {
        this.openOptionDialog({
          title: t("trakt_comments_dialog_title", {}, "Comments"),
          options: TRAKT_COMMENTS_OPTIONS,
          selectedId: settings.showMetaComments ? "on" : "off",
          returnFocusKey: "trakt:comments",
          dialogClassName: "settings-trakt-dialog",
          onSelect: (option) => {
            const enabled = option.id === "on";
            TraktSettingsStore.setShowMetaComments(enabled);
            this.traktStatusMessage = enabled
              ? t("trakt_comments_now_shown", {}, "Trakt reviews on metadata pages are now shown")
              : t("trakt_comments_now_hidden", {}, "Trakt reviews on metadata pages are now hidden");
          }
        });
      });

      return `
          <div class="settings-slide-panel settings-trakt-panel">
            <div class="settings-trakt-hero">
              <img class="settings-trakt-logo" src="assets/icons/trakt_tv_favicon.svg" alt="" aria-hidden="true" />
              <div class="settings-trakt-title">Trakt</div>
              <p class="settings-trakt-description">${escapeHtml(t("trakt_description", {}, "Sync your watchlist, watch progress, continue watching, scrobbles, and personal lists with Trakt."))}</p>
              ${isConnected ? `<p class="settings-trakt-connected">${escapeHtml(t("trakt_connected_as", [auth.username || "Trakt user"], `Connected as ${auth.username || "Trakt user"}`))}</p>` : ""}
            </div>
            <div class="settings-trakt-card">
              <div class="settings-trakt-scroll-frame settings-content-frame">
                <div class="settings-trakt-scroll-area">
                  <div class="settings-trakt-header-row">
                    <div class="settings-trakt-card-title">${escapeHtml(t("trakt_account_login", {}, "Account Login"))}</div>
                    ${isAwaitingApproval ? `<button class="settings-trakt-small-button settings-content-focusable focusable" data-zone="content" ${this.registerAction("trakt:cancel", this.actionMap.get("trakt:cancel"))}>${escapeHtml(t("action_cancel", {}, "Cancel"))}</button>` : ""}
                  </div>
                  ${isAwaitingApproval ? this.renderTraktAwaitingApproval(userCode, remaining) : ""}
                  ${isConnected ? this.renderTraktConnected(auth, tokenRemaining, trakt) : ""}
                  ${!isAwaitingApproval && !isConnected ? this.renderTraktDisconnected(trakt) : ""}
                  ${isConnected ? this.renderTraktOptions(settings) : ""}
                  ${!isConnected && trakt.statusMessage ? `<p class="settings-trakt-message">${escapeHtml(trakt.statusMessage)}</p>` : ""}
                  ${trakt.errorMessage ? `<p class="settings-trakt-error">${escapeHtml(trakt.errorMessage)}</p>` : ""}
                </div>
                ${settingsScrollIndicatorMarkup("vertical")}
              </div>
              <div class="settings-trakt-footer-row">
                ${isAwaitingApproval ? `<button class="settings-trakt-button settings-content-focusable focusable" data-zone="content" ${this.registerAction("trakt:retry", this.actionMap.get("trakt:retry"))}>${escapeHtml(t("trakt_retry", {}, "Retry"))}</button>` : ""}
                <button class="settings-trakt-button settings-content-focusable focusable" data-zone="content" ${this.registerAction("trakt:back", this.actionMap.get("trakt:back"))}>${escapeHtml(t("trakt_back", {}, "Back"))}</button>
              </div>
            </div>
          </div>
        `;
    },
    renderTraktAwaitingApproval(userCode, remainingMs) {
      const qrDataUrl = createTraktQrDataUrl(userCode);
      return `
          <p class="settings-trakt-body-copy">${escapeHtml(t("trakt_awaiting_instruction", {}, "Go to trakt.tv/activate and enter this code:"))}</p>
          <div class="settings-trakt-code">${escapeHtml(userCode || "-")}</div>
          ${qrDataUrl ? `<img class="settings-trakt-qr" src="${escapeHtml(qrDataUrl)}" alt="${escapeHtml(t("cd_trakt_qr", {}, "Trakt QR code"))}" />` : ""}
          <p class="settings-trakt-meta-copy">${renderTraktCountdownText("trakt_code_expires", remainingMs, "Code expires in", "data-trakt-device-countdown")}</p>
        `;
    },
    renderTraktDisconnected(trakt) {
      return `
          <p class="settings-trakt-body-copy">${escapeHtml(t("trakt_login_instruction", {}, "Press Login to start Trakt device authentication. A QR code will appear here."))}</p>
          <button class="settings-trakt-button settings-trakt-login-button settings-content-focusable focusable${!trakt.credentialsConfigured || trakt.isLoading ? " is-disabled" : ""}"
                  data-zone="content"
                  ${this.registerAction("trakt:login", !trakt.credentialsConfigured || trakt.isLoading ? () => {} : this.actionMap.get("trakt:login"))}>
            ${escapeHtml(t("trakt_login", {}, "Login"))}
          </button>
          ${!trakt.credentialsConfigured ? `<p class="settings-trakt-warning">${escapeHtml(t("trakt_missing_credentials", {}, "Missing TRAKT_CLIENT_ID / TRAKT_CLIENT_SECRET in local.properties."))}</p>` : ""}
        `;
    },
    renderTraktConnected(auth, tokenRemainingMs, trakt) {
      return `
          ${tokenRemainingMs ? `<p class="settings-trakt-meta-copy">${renderTraktCountdownText("trakt_token_refreshes", tokenRemainingMs, "Trakt access token refreshes in", "data-trakt-token-countdown")}</p>` : ""}
          <button class="settings-trakt-button settings-content-focusable focusable" data-zone="content" ${this.registerAction("trakt:disconnect", this.actionMap.get("trakt:disconnect"))}>${escapeHtml(t("trakt_disconnect", {}, "Disconnect"))}</button>
          ${this.renderTraktStatsStrip(trakt.stats, trakt.isStatsLoading)}
        `;
    }
  };
}
