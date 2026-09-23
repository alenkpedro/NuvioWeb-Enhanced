(function installEnhancedTvPrefetch(window, document) {
  "use strict";

  var root = typeof globalThis !== "undefined" ? globalThis : window;
  var userAgent = String((window.navigator && window.navigator.userAgent) || "").toLowerCase();
  var isWebOs = Boolean(
    root.__NUVIO_PLATFORM__ === "webos" ||
      root.webOSSystem ||
      root.PalmSystem ||
      userAgent.indexOf("web0s") !== -1 ||
      userAgent.indexOf("webos") !== -1
  );

  if (!isWebOs) {
    return;
  }

  var MAX_TRACKED_URLS = 36;
  var MAX_PREFETCH_PER_PASS = 5;
  var FOCUS_LOOKAHEAD = 2;
  var trackedUrls = [];
  var trackedLookup = Object.create(null);
  var passScheduled = false;

  function normalizeUrl(value) {
    var url = String(value || "").trim();
    if (!url || url.indexOf("data:") === 0 || url.indexOf("blob:") === 0) {
      return "";
    }
    return url;
  }

  function remember(url) {
    if (!url || trackedLookup[url]) {
      return false;
    }
    trackedLookup[url] = true;
    trackedUrls.push(url);
    while (trackedUrls.length > MAX_TRACKED_URLS) {
      var expired = trackedUrls.shift();
      delete trackedLookup[expired];
    }
    return true;
  }

  function warmImage(url) {
    url = normalizeUrl(url);
    if (!url || !remember(url)) {
      return;
    }

    try {
      var image = new Image();
      image.decoding = "async";
      image.src = url;
    } catch (_error) {
      // Prefetch is opportunistic. Playback/navigation must never depend on it.
    }
  }

  function collectImageUrls(node, output) {
    if (!node || !output) {
      return;
    }

    if (node.tagName && String(node.tagName).toLowerCase() === "img") {
      var current = normalizeUrl(node.currentSrc || node.src || node.getAttribute("src"));
      if (current) output.push(current);
    }

    if (typeof node.querySelectorAll !== "function") {
      return;
    }

    var images = node.querySelectorAll("img[src]");
    for (var i = 0; i < images.length; i += 1) {
      var url = normalizeUrl(images[i].currentSrc || images[i].src || images[i].getAttribute("src"));
      if (url) output.push(url);
    }
  }

  function prefetchNodes(nodes) {
    var urls = [];
    for (var i = 0; i < nodes.length && urls.length < MAX_PREFETCH_PER_PASS * 2; i += 1) {
      collectImageUrls(nodes[i], urls);
    }

    var warmed = 0;
    for (var j = 0; j < urls.length && warmed < MAX_PREFETCH_PER_PASS; j += 1) {
      var before = trackedUrls.length;
      warmImage(urls[j]);
      if (trackedUrls.length !== before) warmed += 1;
    }
  }

  function findFocusableCard(node) {
    if (!node) return null;
    if (typeof node.closest === "function") {
      return node.closest(".home-content-card, .focusable, [tabindex]");
    }
    return node;
  }

  function scheduleFocusedLookahead(target) {
    if (passScheduled) {
      return;
    }
    passScheduled = true;

    var run = function () {
      passScheduled = false;
      var card = findFocusableCard(target);
      if (!card) return;

      var parent = card.parentNode;
      if (!parent || !parent.children) {
        prefetchNodes([card]);
        return;
      }

      var children = parent.children;
      var index = -1;
      for (var i = 0; i < children.length; i += 1) {
        if (children[i] === card || (children[i].contains && children[i].contains(card))) {
          index = i;
          break;
        }
      }

      if (index < 0) {
        prefetchNodes([card]);
        return;
      }

      var candidates = [card];
      for (var offset = 1; offset <= FOCUS_LOOKAHEAD; offset += 1) {
        if (children[index + offset]) candidates.push(children[index + offset]);
        if (offset === 1 && children[index - offset]) candidates.push(children[index - offset]);
      }
      prefetchNodes(candidates);
    };

    if (typeof window.requestIdleCallback === "function") {
      window.requestIdleCallback(run, { timeout: 80 });
    } else {
      window.setTimeout(run, 24);
    }
  }

  function warmInitialViewport() {
    var nodes = document.querySelectorAll(
      ".home-track .home-content-card, .home-hero img, .continue-watching img, img[fetchpriority='high']"
    );
    var candidates = [];
    for (var i = 0; i < nodes.length && candidates.length < 8; i += 1) {
      candidates.push(nodes[i]);
    }
    prefetchNodes(candidates);
  }

  document.addEventListener(
    "focusin",
    function (event) {
      scheduleFocusedLookahead(event.target);
    },
    true
  );

  document.addEventListener(
    "keydown",
    function (event) {
      var key = event.key || event.keyCode;
      if (
        key === "ArrowLeft" ||
        key === "ArrowRight" ||
        key === "ArrowUp" ||
        key === "ArrowDown" ||
        key === 37 ||
        key === 38 ||
        key === 39 ||
        key === 40
      ) {
        scheduleFocusedLookahead(document.activeElement);
      }
    },
    true
  );

  if (typeof MutationObserver === "function") {
    var observer = new MutationObserver(function (mutations) {
      for (var i = 0; i < mutations.length; i += 1) {
        if (mutations[i].addedNodes && mutations[i].addedNodes.length) {
          window.setTimeout(warmInitialViewport, 40);
          return;
        }
      }
    });

    if (document.documentElement) {
      observer.observe(document.documentElement, { childList: true, subtree: true });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      window.setTimeout(warmInitialViewport, 80);
    });
  } else {
    window.setTimeout(warmInitialViewport, 80);
  }
})(window, document);
